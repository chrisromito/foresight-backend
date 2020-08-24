const R = require('ramda')
const pChain = require('../utils/pchain')
const {
    dateFloor,
    dateCeil,
    toDate
} = require('../utils/dates')
const {
    ObjectId,
    isObjectId,
    mapToObjectId
} = require('../utils/common')
const {
    BrowserAccum,
    // Count
    Count,
    compoundSeqCount,
    seqLensCount,
    countMapReducer,
    countPairReducer,

    // Accum
    CountryAccum,
    CityStateAccum,
    DeviceAccum,
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
    referrerLens,
    seqLens,
    // Misc
    groupByActionType
} = require('./utils')
const {
    Action,
    ActionFlowStats,
    ActionStats,
    ClientStats,
    Page,
    PageFlowStats,
    PageStats,
    PageView,
    UserSession
} = require('../models/index')


/**
 * Action Stats
 */



/**
 * @func GenerateActionStats - Handles generating new Action Stats associated
 * w/ a single pageStat
 */

const GenerateActionStats = ({ client, pageViews, timeStamp }, pageStats)=> {
    const pageStatsId = pageStats._id
    const pageViewIds = pageViews.map(
        R.view(idLens)
    )

    const statMapThunkList = actions =>
        Object.entries(groupByActionType(actions))
            .map(([actionType, targetActions])=> ()=>
                statsPerActionType(
                    {
                        actions,
                        client,
                        timeStamp,
                        pageViews,
                        pageStats: pageStatsId
                    },
                    actionType,
                    targetActions
                )
            )

    return getPageViewActions({ pageViewIds })
        .then(actions => pChain(statMapThunkList(actions)))
        .catch(e => {
            try {
                console.log(e.stack)
            // eslint-disable-next-line no-empty
            } catch(err) {}
            return Promise.reject(e)
        })
}


const statsPerActionType = ({
    actions,
    client,
    pageViews,
    pageStats,
    timeStamp
},
actionType,
actionsForActionType) => {
const userList = UserList.liftUserSessions(
    pageViews.map(R.view(userSessionLens))
)

const totalActions = actionsForActionType.length
const uniqueActions = userList.totalUsers()

//-- CLIENT IMPORT

const totalUsers = userList.count()
const registeredUsers = userList.registered().count()
const unRegisteredUsers = userList.unRegistered().count()

const popularity = totalActions / actions.length

// TODO: Add a way to split out the PageViews so we can figure out
// Which pages were first and which pages were last in a user's journey
const actionStatsReducer = countMapReducer({
    targetDistribution: ActionTargetAccum,
    referrers: ReferrerAccum,

    timeDistribution: TimeDistribution,
    browser: BrowserAccum,
    device: DeviceAccum,
    cityState: CityStateAccum,
    countryCode: CountryAccum,
})

const flatActions = actionsForActionType.map(action => R.mergeDeepRight(action.pageView, action))
const actionStatsMap = actionStatsReducer(flatActions)

return new ActionStats({
        ...actionStatsMap,
        actionType,
        client,
        popularity,

        totalUsers,
        registeredUsers,
        unRegisteredUsers,

        totalActions,
        uniqueActions,
        timestamp: timeStamp,
        pageStats: ObjectId(pageStats)
    })
    .save()
}



const getPageViewActions = ({ pageViewIds })=>
    Action.find({})
        .where('pageView')
        .in( mapToObjectId(pageViewIds) )
        .populate('pageView')
        .exec()
        .then(liftUserSessions)


const liftPageViewUser = R.compose(
    u => UserLight.of(u),
    R.view(userSessionLens)
)


const seqRegistrationAccum = compoundSeqCount(
    pv => liftPageViewUser(pv).isRegistered())


const _actionTargetLens = R.lens(
    action => `${action.target.id},${action.target.name || ''},${action.target.data || ''}`,
    R.assoc('target')
)


const ActionTargetAccum = Count(
    R.view(_actionTargetLens)
)


module.exports = {
    GenerateActionStats
}
