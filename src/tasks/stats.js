/**
 * @module stats - Main entry-point for the Page Stats & Action Stats tasks.
 * This is designed to handle one day (24 hours) worth of stats for a given Client
 * If that becomes insufficient, just be aware of how dates are `floored` (@see dateFloor)
 * & `ceiled` (@see dateCeil)
 * 
 * 
 * 
 */
// @ts-nocheck
const R = require('ramda')
const pChain = require('../utils/pchain')

const {
    dateFloor,
    dateCeil,
    toDate
} = require('../utils/dates')

const {
    // Count
    Count,
    compoundSeqCount,
    countMapReducer,

    seqLensCount,
    // Accum
    BrowserAccum,
    CountryAccum,
    CityStateAccum,
    DeviceAccum,
    getHours,
    TimeDistribution,
    ReferrerAccum,

    // Interfaces
    UserLight,
    UserList,
    liftUserSessions,

    // Lenses
    idLens,
    createdLens,
    userSessionLens,
    pageLens,
    parentLens,
    referrerLens,
    seqLens,

    // Misc
    groupByPage
} = require('./utils')

const {
    ActionStats,
    ClientStats,
    Page,
    PageFlowNode,
    PageFlowStats,
    PageStats,
    PageView
} = require('../models/index')

const { GenerateActionStats } = require('./action_stats')

const ObjectId = require('mongoose').Types.ObjectId


/**
 * Utils
 */
const viewId = R.view(idLens)
const parentIdLens = R.compose(parentLens, idLens)
const viewParentId = R.view(parentIdLens)

const pageIdLens = R.compose(pageLens, idLens)

const viewPageId = R.view(pageIdLens)


const pathLens = R.lensPath(['path'])

const viewPath = R.view(pathLens)

const parentPathLens = R.lensPath(['parentPath'])

const viewParentPath = R.view(parentPathLens)


const zero = R.always(0)


const safePositive = R.ifElse(
    R.tryCatch(
        R.partialRight(
            R.gt,
            [0]
        ),
        R.F
    ),
    R.identity,
    zero
)


const safeSubtract = value => R.tryCatch(
    R.compose(
        safePositive,
        R.subtract(R.__, value)
    ),
    zero
)


const safeDec = safeSubtract(1)


/**
 * Query Helpers
 */

const toIdList = R.map(R.view(idLens))


const mapToObjectId = R.compose(
    R.map(ObjectId),
    R.filter(
        R.either(
            R.is(String),
            R.is(ObjectId)
        )
    )
)


const getClientPageIds = client =>
    Page.find({ client: ObjectId(client) })
        .exec()
        .then(toIdList)



/**
 * @func liftSession - Mapping function that corresponds w/ `liftUserSessions`
 * this will lift the lightweight userSession object out of an individual Object
 * and up into a UserLight Object
 * @param {Object} obj
 * @return {UserLight<Object>}
 */
const liftSession = R.compose(
    UserLight,
    R.view(userSessionLens)
)


const getPageViews = ({ pageIds, timeStamp })=>
    PageView.find({})
        .where('page')
        .in( mapToObjectId(pageIds) )
        .where('created')
        .gte(timeStamp)
        .populate({
            path: 'parent',
            model: 'PageView',
            populate: {
                path: 'page',
                model: 'Page'
            }
        })
        .populate({
            path: 'page',
            model: 'Page'
        })
        .populate({
            path: 'tags',
            model: 'Tag',
            populate: {
                path: 'tagType',
                model: 'TagType'
            }
        })
        .exec()
        .then(liftUserSessions)


/**
 * @func GenerateClientStats - Generate ClientStats, PageStats, PageFlowStats & ActionStats
 * for a day's worth of activity.  The day is based on `startTime`
 * @param {Client} client
 * @param {Date} startTime - The day that the stats will fall on
 * @return {Promise}
 */
const GenerateClientStats = (client, startTime) => {
    const timeStamp = startTime
    const clientId = client._id
    return cleanUpExistingStats(clientId, timeStamp)
        .then(()=>
            Page.find({ client: clientId })
                .exec()
                .then(pages => pages.map(p => p._id))
        )
        .then(pageIds =>
            getPageViews({ pageIds, timeStamp }))
        .then(pageViews =>
            getClientStatsChain({ timeStamp, pageViews, client: clientId }))
        .then(({ pageViews, clientStats }) =>
            GeneratePageStats({ timeStamp, pageViews, clientStats, client: clientId }))
}


const cleanUpExistingStats = (client, timeStamp)=>
    ClientStats.find({
        client,
        timestamp: {
            $gte: timeStamp,
            $lte: toDate(dateCeil(timeStamp))
        }
    })
    .exec()
    .then(clientStats =>
        PageStats.find({})
            .where('clientStats')
            .in(clientStats.map(cs => cs._id))
            .exec()
            .then(toIdList)
            .then(mapToObjectId)
            .then(pageStats => ({
                pageStats,
                clientStats
            }))
    )
    .then(({ clientStats, pageStats })=>
        Promise.all([
            ClientStats.deleteMany({
                _id: {
                    $in: toIdList(clientStats)
                }
            }).exec(),
            PageStats.deleteMany({ _id: { $in: pageStats } }).exec(),
            ActionStats.deleteMany({ pageStats: { $in: pageStats } }).exec()
        ])
    )


/**
 * @func getClientStatsChain - Handles creation of ClientStats
 */
const getClientStatsChain = ({ client, timeStamp, pageViews })=> {
    // const userList = UserList.liftUserSessions(userSessions)
    const userList = UserList( pageViews.map(liftSession) )

    const uniqueUsers = userList.uniqByUser().count()
    const registeredUsers = userList.registered().count()
    const unRegisteredUsers = userList.unRegistered().count()
    const totalUsers = unRegisteredUsers + registeredUsers
    const bounceUserList = userList.bounceSessions()
    const bounceSessions = bounceUserList.uniq().count()
    const bounceUsers = bounceUserList.uniqByUser().count()

    const totalViews = pageViews.length
    const uniqueViews = uniqueUsers

    // TODO: Add a way to split out the PageViews so we can figure out
    // Which pages were first and which pages were last in a user's journey
    const clientStatsReducer = countMapReducer({
        timeDistribution: TimeDistribution,
        browser: BrowserAccum,
        device: DeviceAccum,
        cityState: CityStateAccum,
        countryCode: CountryAccum,
        referrers: ReferrerAccum
    })

    const clientStatsMap = clientStatsReducer(pageViews)

    return new ClientStats({
            ...clientStatsMap,
            client,
            // Views
            totalViews,
            uniqueViews,
            // User fields
            totalUsers,
            uniqueUsers,
            registeredUsers,
            unRegisteredUsers,
            bounceSessions,
            bounceUsers,
            timestamp: timeStamp
        })
        .save()
        .then(clientStats =>
            ({
                clientStats,
                pageViews
            })
        )
}


/**
 * @func GeneratePageStats - Handles generating new PageStats for each respective page
 */
const GeneratePageStats = ({ client, timeStamp, pageViews, clientStats })=> {
    // Partial application of args that don't change on a page-by-page basis
    const pageStatsPred = statsPerPage({
        client,
        timeStamp,
        clientStats: clientStats._id,
        clientViewCount: pageViews.length
    })

    const statMapThunks = R.compose(
        R.map(
            ([k, v]) => ()=> pageStatsPred(k, v)
        ),           // => ()=> pageStatsPred(pageId, [PageView, PageView, PageView, ...])
        R.toPairs,   // => [ [pageId, [PageView, PageView, PageView, ...]] ]
        groupByPage  // => { pageId: [PageView, PageView, PageView, ...] }
    )

    return pChain( statMapThunks(pageViews) )
        .then(pageStats => ({
            pageStats,
            pageViews
        }))
        .catch(e => {
            console.log('getPageViewStats error')
            console.log(e)
            try {
                console.log(e.stack)
            // eslint-disable-next-line no-empty
            } catch(err) {}
            return Promise.reject(e)
        })
}

/**
 * @func statsPerPage - Handles calculations & generating a new PageStats instance
 * for a single page
 */
const statsPerPage = ({ client, timeStamp, clientStats, clientViewCount }) => (pageId, pageViews)=> {
    const userList = UserList( pageViews.map(liftSession) )
    const uniqueUsers = userList.uniqByUser().count()
    const registeredUsers = userList.registered().count()
    const unRegisteredUsers = userList.unRegistered().count()
    const totalUsers = unRegisteredUsers + registeredUsers

    const bounceUserList = userList.bounceSessions()
    const bounceSessions = bounceUserList.uniq().count()
    const bounceUsers = bounceUserList.uniqByUser().count()
    const totalViews = pageViews.length

    // TODO: Add a way to split out the PageViews so we can figure out
    // Which pages were first and which pages were last in a user's journey
    const pageStatsReducer = countMapReducer({
        timeDistribution: TimeDistribution,
        browser: BrowserAccum,
        device: DeviceAccum,
        cityState: CityStateAccum,
        countryCode: CountryAccum,
        referrers: ReferrerAccum
    })

    const pageStatsMap = pageStatsReducer(pageViews)

    return new PageStats({
        ...pageStatsMap,
        client,
        clientStats,
        totalViews,
        uniqueViews: uniqueUsers,
        totalUsers,
        uniqueUsers,
        registeredUsers,
        unRegisteredUsers,
        bounceSessions,
        bounceUsers,

        popularity: totalViews / clientViewCount,
        timestamp: timeStamp,
        page: ObjectId(pageId)
    })
    .save()
    .then(pageStats => handlePageStatsRelatives({ client, pageViews, timeStamp, pageStats, clientStats }))
}


const handlePageStatsRelatives = ({ client, pageViews, timeStamp, pageStats, clientStats })=>
    GeneratePageFlowStats({ client, pageViews, timeStamp, clientStats, pageStats: pageStats._id })
        .then(()=>
            GenerateActionStats({ client, pageViews, timeStamp }, pageStats))
        .then(()=> pageStats)


// throw new Error(`
//     TODO: 2019-Dec-08 - Update the flow stats below to reflect the implementation
//     of Materialized Path Trees.

//     TODO: Review if we would be better off adding a plugin to handle 'Count Reducers'
//     Ie. Encapsulation of that mind-wrenching logic & hand-crippling verbosity.
// `)



/**
 * @func flowNodeTree - Build out the tree data for PageFlowNodes
 * @param {ObjectId} client
 * @param {PageView[]} pageViews
 * @param {Date} timeStamp
 * @param {ClientStats[]} clientStats
 * @return {Promise<Object[]>}
 */


module.exports = {
    GenerateClientStats,
    GeneratePageStats,
    getClientStatsChain,
    
    // Helper Fns
    getClientPageIds,
    getPageViews,
    statsPerPage,
    GenerateActionStats,

    dateFloor,
    dateCeil,
    toDate
}
