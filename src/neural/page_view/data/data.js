/**
 * @module data - Comprises the Sub Model & Data Model layers/components
 * 
 * @TLDR - pipe(NeuralSubModel[DataState], NeuralModel[DataState], PvSubModel[DataState], PvModel[DataState])
 *      - SubModels return Future<Error, DataState>. 
 *      - Models return Model<DataState>
* 
 * @doc
 * The Sub Models manage how we query Mongoose models.  They are bound to a DataState, and most query methods
 * return a Future that:
 *  - Resolves w/ a new DataState with its 'data' set to a copy of the query results &/or updated context
 *  - Rejects w/ the original DataState.  Errors are handled internally and will not propagate up.
 * 
 * The Data & Context obtained from the Sub Models determines how/what (if any)
 * PageViews are used throughout the rest of the application.
 * 
 * The Models are bound to DataState, and provide generic ways to compose, map, apply, group, sort, etc.
 * the underlying DataState's Data.
 *
 */

const R = require('ramda')
const { Future, Maybe } = require('ramda-fantasy')
// const { BaseType, DataState } = require('./types')
const { Page, PageStats, PageView, NeuralStep } = require('../../../models')


//-- Utils
const transformModels = R.compose(JSON.parse, JSON.stringify)



//-- NeuralStep Sub Model

const lastStep = (_, {clientId})=> NeuralStep.find()
    .where('client', clientId)
    .where('originModel', 'PageView')
    .sort({ timestamp: 'desc' })
    .limit(1)
    .exec()


const NeuralSubModel = (arg)=> ({
    getLastStep: (dataState=arg)=> Future((reject, resolve)=>
        lastStep(...dataState.args())
            .then(transformModels)
            .then((m)=> !m.length ? dataState : dataState.mapData(()=> m[0]))
            .then(resolve)
            .catch(reject)
    ),

    value: ()=> arg
})

NeuralSubModel.of = (...args)=> NeuralSubModel(...args)


/**
 * @func NeuralModel - Data transformations for NeuralSteps
 * @param {(DataState|*)} arg
 */
const NeuralModel = (arg)=> ({
    map: (fn)=> NeuralModel(arg.map(fn)),
    mapData: (fn)=> NeuralModel(arg.mapData(fn)),
    mapContext: (fn)=> NeuralModel(arg.mapContext(fn)),

    getTimeStamp: ()=> {
        // Since the DataState.data might contain a NeuralStep,
        // this will either be a Nothing, or a Just w/ the value set
        // to the 'timestamp' value of our last step
        const mTimestamp = Maybe(arg.data())
            .map(R.prop('timestamp'))
        return Maybe(mTimestamp.value)
    },

    getLastStep: (arg)=> {
        const mTimestamp = NeuralModel(arg).getTimeStamp()
        const timeStampSetter = R.set(R.lensPath(['timestamp']))
        const setContext = mTimestamp.isNothing
            ? timeStampSetter(null)
            : timeStampSetter(mTimestamp.value)

        return NeuralModel(arg).mapContext(setContext)
    },

    value: ()=> arg
})

NeuralModel.of = (...args)=> NeuralModel(...args)



//-- PageView Sub Model

const clientPageViewsBetween = (_, { clientId, timestamp=null, newestDate=null})=>
    Page.find()
        .where('client', clientId)
        .select('_id')
        .exec()
        .then(
            R.map(R.prop('_id'))
        ).then((pageIds)=> {
            const query = PageView.find()
                .where('page')
                .in(pageIds)
                .where('updated')
                .lte(newestDate ? newestDate : Date.now())
                .populate('page')
                .populate({
                    path: 'userSession',
                    model: 'UserSession',
                    populate: {
                        path: 'user',
                        model: 'User',
                        select: 'account active updated created'
                    }
                })
                .limit(10000) // Limit to 10k records
            
            const filteredQuery = timestamp
                ? query.or([
                    { updated: { $gte: timestamp } },
                    { created: { $gte: timestamp } }
                ])
                : query

            return filteredQuery.exec()
                .then(transformModels)
        })

/**
 * @func PvSubModel - Handles query logic for Client PageViews
 * 
 */
const PvSubModel = (arg)=> ({

    pageViewsBetween: ()=> Future((reject, resolve)=>
        clientPageViewsBetween(...arg.args())
            .then(transformModels)
            .then((pv)=> arg.mapData(()=> pv))
            .then(resolve) // Resolve w/ the updated DataState
            .catch(reject)
    ),

    pageViewsSince: ()=> Future((reject, resolve)=>
        clientPageViewsBetween(...arg.args())
            .then(transformModels)
            .then((pv)=> arg.mapData(()=> pv))
            .then(resolve) // Resolve w/ the updated DataState
            .catch(reject)
    ),

    value: ()=> arg
})

PvSubModel.of = (...args)=> PvSubModel(...args)

const idLens = R.lensPath(['_id'])

const pageLens = R.lensPath(['page'])

const pageIdLens = R.compose(pageLens, idLens)

const pageIndexLens = R.compose(pageLens, R.lensPath(['index']))
const pageUrlLens = R.compose(pageLens, R.lensPath(['url', 'pathname']))

const userSessionLens = R.compose(R.lensPath(['userSession']), idLens)

const sequenceLens = R.lensPath(['sequence'])


/**
 * @func PvModel - Data transformations for PageViews
 * @param {(DataState|*)} arg
 */
const PvModel = (arg)=> ({
    map: (fn)=> PvModel(arg.map(fn)),
    mapData: (fn)=> PvModel(arg.mapData(fn)),
    mapContext: (fn)=> PvModel(arg.mapContext(fn)),

    filterByUserSession: ()=> PvModel(arg).mapData(
        R.reject(
            R.pipe(
                R.view(userSessionLens),
                R.isNil
            )
        )
    ),

    groupByPage: ()=> PvModel(arg).mapData(
        R.groupWith(R.view(pageIdLens))
    ),

    groupByUserSession: ()=> PvModel(arg).mapData(
        R.groupWith(R.view(userSessionLens))
    ),

    // Set the url & urlIndex properties based on the Page's url.pathname & 'index'
    // to facilitate data-normalization (NN normalization, not DB normalization)
    setUrl: ()=> PvModel(arg).mapData(
        R.map((o)=>
            R.pipe(
                R.set(
                    R.lensPath(['url']),
                    R.view(pageUrlLens, o),
                    o
                ),
                R.set(
                    R.lensPath(['urlIndex']),
                    R.view(pageIndexLens, o),
                    o
                )
            )
        )
    ),

    sort: (lens=sequenceLens)=> PvModel(arg).mapData(
        R.sortBy(R.view(lens))
    ),

    value: ()=> arg
})

PvModel.of = (...args)=> PvModel(...args)



module.exports = {
    PvSubModel,
    PvModel,
    NeuralSubModel,
    NeuralModel,

    clientPageViewsBetween
}
