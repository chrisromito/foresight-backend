const moment = require('./moment')
const R = require('ramda')
const ObjectId = require('mongoose').Types.ObjectId
const { Future, Maybe } = require('ramda-fantasy')
// Models/Data
const { PageStats, NeuralStep, Client } = require('../../models/index')
const { NeuralSubModel} = require('./data/data')
// Types & utils
const { DataState, NetworkState } = require('./types')
const pChain = require('../../utils/pchain')
const { dateFloor, dateCeil, toDate } = require('../../utils/dates')


/**
 * @typedef {Object} PageStat
 * @property {mongoose.Types.ObjectId} page - Page ID
 * @property {mongoose.Types.ObjectId} client - Client ID
 * @property {Date} timestamp
 * @property {Number} uniqueViews
 * @property {Number} totalViews
 * @property {Number} popularity - Popularity of the page for that day
 *      (totalViews / totalViews for all client Pages)
 */


 /**
  * @typedef {Object} Context - The shape that NetworkState._context needs to have
  * for this interface
  * 
  * @property {String} clientId - The ObjectId for this client/customer
  * @property {Date} minDate - The min date this Network's data will analyze
  * @property {Date} maxDate - The max date this Network's data will analyze
  * @property {Number} trainingType - Constant value associated w/ the type of Network being run
  */

//-- Date Functions
const floorDate = R.pipe(dateFloor, toDate)

const ceilDate = R.pipe(dateCeil, toDate)

//-- Utils
const objToMap = (obj)=> Object.entries(obj).reduce((accum, [k, v])=> accum.set(k, v), new Map())


const trainModelForAllClients = (timestamp=Date.now())=> {
    console.log('trainModelForAllClients()')

    return Client.find()
        .select('_id')
        .exec()
        .then((clients)=> {
            console.log(`Clients:`)
            console.log(clients)
            const thunkList = clients.map((client)=> {
                const id = ObjectId(client._id)
                return ()=> new Promise((resolve, reject)=>
                    trainModelForClient(id, timestamp)
                        .fork(reject, resolve)
                )
            })

            return pChain(thunkList)
        })
        .then((results)=> {
            console.log(`\n\n\n trainModelForAllClients - Complete`)
            return results
        })
        .catch((err)=> {
            console.log('ERROR!!!')
            console.log(err)
            return Promise.reject(err)
        })
}


const trainModelForClient = (clientId, timestamp)=> {
    console.log('trainModelForClient()')
    console.log(`Client ID: ${clientId}`)
    console.log(`Timestamp: ${timestamp}`)
    const context = {
        clientId,
        timestamp,
        minDate: floorDate(timestamp),
        maxDate: ceilDate(timestamp)
    }
    const dataState = new DataState(null, context)
    const networkState = new NetworkState(null, context)
    return pageStatsNetworkPipeline(dataState, networkState)
}



const pageStatsNetworkPipeline = (dataState, networkState)=>
    setLastStepData(dataState, networkState)
        .chain((args)=>
            getPageStats(...args))
        .chain((args)=> {
            console.log('\n\n\ngetPageStats.then...')

            const [dataState, networkState] = args
            return preBatchRun(networkState.apNeuralStep(), dataState, networkState)
        })
        .chain((args)=> batchPipeLine(...args))
        .chain((args)=> afterBatchesComplete(...args))


const setLastStepData = (dataState, networkState)=>
    NeuralSubModel(networkState)
        .getLastStep()
        .map((netState)=> [dataState, netState])
        .map(R.tap((...args)=> {
            console.log(`\n\nsetLastStepData - args`)
            args.forEach((a)=> console.log(a))
        }))


const preBatchRun = (network, dataState, networkState)=> Future((reject, resolve)=> 
    createNeuralStep(network, networkState.context())
        .then((ns)=> networkState.mapData(()=> ns))
        .then((ns)=> [network, dataState, ns])
        .then(resolve)
        .catch(reject)
)


const createNeuralStep = (network, { clientId, running=false })=>
    NeuralStep.create({
        client: ObjectId(clientId),
        originModel: 'PageStats',
        fields: FIELDS,
        data: new Map(),
        state: {
            running,
            startDate: Date.now()
        },
        meta: JSON.stringify(network.toJSON())
    })


const batchPipeLine = (network, dataState, networkState)=> Future((reject, resolve)=> {
    console.log('\n\n\nbatchPipeLine')
    if (!networkState.runnable()) {
        return reject(network, dataState, networkState)
    }

    return batchPipeLine_(network, dataState, networkState)
        .then(resolve)
        .catch(reject)
})


/**
 * @func batchPipeLine_ - Trains a network on a set of PageStats
 * @param {brain.recurrent.RNNTimeStep} network
 * @param {DataState} dataState - DataState bound to a (potentially massive) list of PageStats
 * @param {NetworkState} networkState - NetworkState instance bound to a NeuralStep & context
 * @returns {Promise<[trainedNetwork, dataState, freshNetworkState]>}
 */
const batchPipeLine_ = (network, dataState, networkState)=> {
    console.log('\n\n\nbatchPipeLine_')
    const thunkList = splitBatch(dataState.data())
        .map((eachBatch)=> {
            const batchDataState = dataState.mapData(()=> eachBatch)
            return ()=> trainBatch(
                network,
                batchDataState.mapData(normalizePageStats),
                networkState
            )
        })
    return pChain(thunkList)
        .then(R.last)
        .then((args)=> args ? args : [network, dataState, networkState])
}



/**
 * @func trainBatch - Train a network on a batch of data
 * @param {brain.recurrent.RNNTimeStep} network
 * @param {DataState} dataState - DataState bound to a batch of PageStats
 * @param {NetworkState} networkState - NetworkState instance bound to a NeuralStep & context
 * @returns {Promise<[brain.recurrent.RNNTimeStep, DataState, NetworkState]>}
 */
const trainBatch = (network, dataState, networkState)=>
    network.trainAsync(dataState.data())
        .then(()=> {
            const trainingSet = dataState.data()
            const results = Maybe(R.last(trainingSet))
                .map(({ input })=> ({
                    input,
                    output: network.run(input)
                }))
                .map(deNormalizePageStats)
                .map(objToMap)

            // Update fields on the NeuralStep & save to DB
            const neuralStep = networkState.data()
            neuralStep.meta = JSON.stringify(network.toJSON())
            neuralStep.data = results.getOrElse(neuralStep.data)
            neuralStep.state = R.mergeDeepRight(neuralStep.state, {
                amountPerBatch: 100,
                batchState: trainingSet.length
            })

            console.log('trainBatch.trained - Saving neuralStep')
            return neuralStep.save()
        }).then((ns)=> [
            network,
            dataState,
            networkState.mapData(()=> ns)
        ]).then((args)=> {
            console.log('\n\ntrainBatch()')
            return args
        })


const afterBatchesComplete = (network, dataState, networkState)=> Future((reject, resolve)=> {
    const neuralStep = networkState.data()
    neuralStep.state = R.mergeDeepRight(neuralStep.state, {
        endDate: Date.now(),
        running: false
    })

    return neuralStep.save()
        .then((step)=> networkState.mapData(()=> step))
        .then((ns)=> 
            resolve([
                network,
                dataState,
                ns
            ])
        ).catch(reject)
})


const splitBatch = (list)=> list.reduce(({ temp, accum }, item, index)=> {
        if (temp.length < 100) {
            temp.push(item)
        } else {
            accum.push(temp)
            temp = []
        }
        accum = index === list.length ? temp : accum
        return { temp, accum }
    },
    {
        temp: [],
        accum: []
    }).accum


const getPageStats = (dataState, networkState)=> {
    console.log('\n\n\ngetPageStats()')
    
    const { minDate, maxDate, clientId } = dataState.context()
    console.log(minDate)
    console.log(maxDate)
    console.log(clientId)

    return Future((reject, resolve)=>
        PageStats.find()
            .where('client', ObjectId(clientId))
            .where('timestamp')
            .gte(minDate)
            .where('timestamp')
            .lte(maxDate)
            .populate({
                path: 'page',
                model: 'Page'
            })
            .exec()
            .then(
                R.pipe(
                    (ps)=> ps.map((p)=> p.toJSON()),
                    (ps)=> {
                        console.log('\n\n\ngetPageStats.pipe')
                        console.log(ps.length)
                        return ps
                    },
                    (ps)=> resolve([
                        dataState.mapData(()=> ps),
                        networkState
                    ])
                )
            )
            .catch(reject)
    )
}


//-- (Data <-> Network) normalization & de-normalization
//-----------------------------------------------------------

//-- Local Constants
const INPUT_FIELDS = [
    'year',
    'month',
    'date',
    'day',
    'pageIndex'
]


const OUTPUT_FIELDS = [
    'popularity',
    'totalViews',
    'uniqueViews'
]


const FIELDS = INPUT_FIELDS.concat(OUTPUT_FIELDS)


//-- Lenses
const pageLens = R.lensPath(['page'])
const pageIndexLens = R.compose(pageLens, R.lensPath(['index']))


// Data -> Network Normalization
const normalizePageStats = (pStats)=>
    pStats.reduce((accum, pStat)=>
        accum.concat({
            input: normalizePageStatsInput(pStat),
            output: normalizePageStatsOutput(pStat)
        }),
        []
    )


const normalizePageStatsInput = (pStats)=> {
    const date = R.view(R.lensPath(['timestamp']), pStats)
    return [
        date.getUTCFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getDay(),
        R.view(pageIndexLens, pStats)
    ]
}


const normalizePageStatsOutput = (pStats)=> [
    R.view(R.lensPath(['popularity']), pStats),
    R.view(R.lensPath(['totalViews']), pStats),
    R.view(R.lensPath(['uniqueViews']), pStats)
]


//-- Network -> Data De-Normalization
const deNormalizePageStats = ({ input, output })=> R.mergeDeepRight(
    deNormalizeInput(input),
    deNormalizeOutput(output)
)


const reduceLensMap = (lensMap, obj, arr)=> Object.entries(lensMap)
    .reduce((accum, [k, v])=> {
        accum[k] = R.view(v, arr)
        return accum
    }, obj)


const inputLenses = INPUT_FIELDS.reduce((accum, name, index)=> {
    accum[name] = R.lensIndex(index)
    return accum
}, {})


const deNormalizeInput = R.partial(reduceLensMap, [inputLenses, {}])


const outputLenses = OUTPUT_FIELDS.reduce((accum, name, index)=> {
    accum[name] = R.lensIndex(index)
    return accum
}, {})


const deNormalizeOutput = R.partial(reduceLensMap, [outputLenses, {}])



module.exports = {
    trainModelForClient,
    trainModelForAllClients
}



// eslint-disable-next-line no-unused-vars
const COPY_PASTE = `

var R = require('ramda')
var m = require('moment')
var modelStuff = { PageView, Client, PageStats } = require('./src/server/models/index')

var analysis = {
    trainModelForClient,
    trainModelForAllClients
} = require('./src/server/neural/page_view/page_view_analysis')


trainModelForAllClients()



`
