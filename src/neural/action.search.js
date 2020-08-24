const R = require('ramda')
const { Maybe } = require('ramda-fantasy')
// Internal utils
const Io = require('../../../src/shared/functional_types/io')
const { Container } = require('../../../src/shared/functional_types/base')
// Models & Data
const { Action, actionTypes, NeuralStep } = require('../models/index')
const brain = require('./brain.js.js')

/**
 * Lenses & Utils
 */
const timeStampLens = R.lensPath(['timestamp'])

const searchFromSelected = R.view(R.compose(
    R.lensPath(['breadCrumbs']),
    R.lensIndex(0),
    R.lensPath(['target', 'data'])
))


const selectedActionFilter = R.filter(R.propEq('actionType', actionTypes.searchSelection))


const getLatestActionId = R.compose(
    R.tryCatch(
        R.pipe(R.last, R.prop('_id')),
        R.always(null)
    ),
    R.sortBy(R.view(timeStampLens))
)


/**
 * Search Action Neural Net Implementation
 *=====================================*/

// TODO: (CR 2019-Mar-09) Review this
class NetworkContext extends Container  {
    constructor(data) {
        /**
         * @param {Object} data
         * @property {(RNNTimeStep|null)} network
         * @property {(Action.Query|null)} actions
         * @property {(NeuralStep|null)} step
         */
        super(data)
    }

    extend(new_data) {
        this.data = R.mergeDeepLeft(new_data, this.data)
        return this.map(R.mergeDeepLeft(new_data))
    }
}


const objectToMap = (obj)=> Object.entries(obj).reduce((accum, [k, v])=> {
    accum.set(k, v)
    return accum
}, new Map())



class SearchRelevanceNetwork {
    constructor(modelName, fieldSpec, context=null, debug=true) {
        /**
         * @param {String} modelName
         * @param {FieldSpec} fieldSpec - What fields are we using to determine relevance?
         */
        this.modelName = modelName
        this.fieldSpec = fieldSpec
        this.context = new NetworkContext(context || {})
        this.debug = debug
    }

    _logger(message) {
        if (this.debug) {
            console.log(`SearchRelevanceNetwork:`, message)
        }
        return message
    }

    getLastStep() {
        /**
         * @method getLastStep - Get the most recent NeuralStep where
         * this.modelName was 'assessed'
         * @returns {Promise <NeuralStep>}
         */
        const filterParams = { originModel: this.modelName }
        const sortParams = { sort: { timestamp: -1 }}
        return NeuralStep.find(filterParams, null, sortParams)
            .limit(1)
            .exec()
            .then((step)=> {
                this.context.step = step
                return step[0] || null
            })
    }

    saveStep(network, networkData, lastActionId) {
        /**
         * @method saveStep - Save the 'state' of the network by creating
         * a new NeuralStep instance
         * @param {RNNTimeStep} network
         * @param {Object[]} networkData: The data used to train the network
         * @param {(String|null)=null} lastActionId
         * @returns {Promise <(NeuralStep|null)>}
         */
        // Build the map based off the result of running
        // the network against the input that was used to train it
        // const predictedWeights = network.run(networkData[0].input)
        const predictedWeights = network.run(
            network.forecast(networkData, 1)
        )
        if (!predictedWeights) {
            return Promise.resolve(null)
        }

        const stepDataMap = objectToMap(predictedWeights)
        return new NeuralStep({
            origin: lastActionId,
            originModel: 'Action',
            data: stepDataMap,
            meta: JSON.stringify(network.toJSON())
        }).save().then((step)=> {
            this.context.step = step
            return step
        })
    }

    getConfig() {
        return {
            log: true,
            // iterations: 1000,
            // errorThresh: 0.1,
            // learningRate: 0.2
        }
    }

    getNetwork(last_step=null) {
        const network = new brain.recurrent.RNNTimeStep(this.getConfig())
        const mStep = Maybe(last_step)
        if (mStep.isJust) {
            // Help the network remember where it left off
            // by lifting the 'meta' property of the NeuralStep Object
            const networkMemoryMeta = R.tryCatch(
                R.pipe(R.prop('meta'), JSON.parse),
                R.F
            )(last_step)

            if (networkMemoryMeta) {
                console.log(`networkMemoryMeta: ${networkMemoryMeta}`)
                network.fromJSON(networkMemoryMeta)
            }
        }
        this.context.network = network
        return network
    }

    getActions(last_step=null) {
        const params = !last_step ? {} : {
            timestamp: {
                $gt: R.view(timeStampLens, last_step)
            }
        }
        
        return Action.find(params)
            .where('target.name', this.modelName)
            .or([
                {actionType: actionTypes.search},
                {actionType: actionTypes.searchSelection}
            ])
            .exec()
            .then((actions)=> {
                this.context.actions = actions
                return actions
            })
    }

    actionRelevance(actions) {
        /**
         * @method compare - Get the relativeRelevance of our Search Actions & Selected Actions
         * based on this.fieldSpec
         * @param {Object[]} actions - Actions to assess
         * @returns {Object[]} - Array of Objects w/ 'input' & 'output' key/val pairs mapped
         * to their relevance scores and % relevance, respectively
         */
        const toPair = (action)=> this.fieldSpec.toPair(searchFromSelected(action), action)
        return Io.lift(actions)
            .map(selectedActionFilter)
            .map((selectedActions)=> selectedActions.map(toPair))
            .run()
    }

    train() {
        return this.getLastStep()
            .then((step)=> this.getActions(step))
            .then((actions)=> {
                const step = this.context.step
                const network = this.getNetwork(step)

                // Get the network training data & train it
                const networkData = this.actionRelevance(actions)

                const config = this.getConfig()

                const start_time = Date.now()
                this._logger(`Begin training session @ ${start_time}`)

                network.train(networkData, config)

                const end_time = Date.now()
                this._logger(`End training session @ ${end_time}`)

                // Save the step, then return our trainingContext
                return this.saveStep(network, networkData, getLatestActionId(actions))
                    .then((neural_step)=> ({
                        start: start_time,
                        end: end_time,
                        actions,
                        network,
                        networkData,
                        neural_step
                    }))
            })
    }
}


/**
 * @const SearchModelActionTask - Task for Action Model Neural Network.
 * 1. Looks for a recent NeuralStep for this model.
 *     NOTE: This step + the model name are used to get the Actions
 * 2. Loads up a RNNTimeStep by either:
 *     A. Creating a new RNNTimeStep network
 *     B. Loading the data from the last time this task ran & passing it into a RNNTimeStep instance
 * 3. Gets all Actions w/ actionType === 'search.select' & target.name === `modelName`.
 * 4. Gets the % relevance for all searches that have occurred since the last time this task ran successfully
 * 5. Trains the RNNTimeStep
 * 6. Creates a new `NeuralStep` using data from the network:
 * 
 * `NeuralStep`:
 *     @property {Object} meta: myRnnTimeStep.toJSON() gives us the ability to 'remember' training models.
 *     @property {Map} data: myRnnTimeStep.forecast() gives us the % relevance values for each field
 *     @property {Action} origin: The '_id' of the last `search.select` action in the data series.
 *     @property {String} originModel: 'Action'
 */
const SearchModelActionTask = (modelName, fieldSpec)=> {
    const actionSearch = new SearchRelevanceNetwork(modelName, fieldSpec)

    return actionSearch.train()
}


module.exports = {
    SearchModelActionTask,
    SearchRelevanceNetwork,
    NetworkContext
}
