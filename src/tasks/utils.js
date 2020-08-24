import * as R from 'ramda'
import pReduce from '../utils/pReduce'
import { Account, UserSession } from '../models/index'

/**
 * Lenses
 */
export const idLens = R.lensPath(['_id'])
export const createdLens = R.lensPath(['created'])
export const parentLens = R.lensPath(['parent'])


// Actions
export const actionBreadCrumbsLens = R.lensPath(['breadCrumbs'])
export const actionTargetLens = R.lensPath(['target'])
export const actionIdLens = R.compose(actionTargetLens, R.lensPath(['id']))
export const actionNameLens = R.compose(actionTargetLens, R.lensPath(['name']))
export const actionDataLens = R.compose(actionTargetLens, R.lensPath(['data']))
export const actionTypeLens = R.lensPath(['actionType'])


// Users
export const userIdLens = R.lensPath(['userId'])
export const accountIdLens = R.lensPath(['accountId'])
export const userSessionLens = R.lensPath(['userSession'])

// PageView
export const pageLens = R.lensPath(['page'])
export const referrerOrNull = R.compose(
    R.ifElse(
        R.isNil,
        R.always(null),
        R.identity
    ),
    R.prop('referrer')
)

export const referrerLens = R.lens(
    referrerOrNull,
    R.assoc('referrer')
)

// Aggregate
export const seqLens = R.lensPath(['sequence'])


/**
 * @func asBatch - Break up data processing into smaller batches of work
 * Note: Personal findings indicate that doing Promise.all([]) with 1,000 Promises
 * will blow up most machines.  This is to help keep your machine in-tact.
 * @see pReduce for details on what each parameter does
 */
export const asBatch = (reduceFn, startValue=[], batchSize=1000)=> data => {
    const batches = batchList(batchSize, data)
    const mapBatch = valueList => accum => pReduce(
        valueList.reduce(reduceFn, accum),
        accum
    )
    return pReduce(
        batches.map(mapBatch),
        startValue
    )
}


export const batchList = (batchSize, list, accum=[])=> {
    const batch = [list.slice(0, batchSize)]
    return list.length < batchSize
        ? accum.concat(batch)
        : batchList(
            batchSize,
            list.slice(batchSize),
            accum.concat(batch)
        )
}


/**
 * Aggregate Utilities
 */

/**
 * @func liftUserSessions - Lift the UserSessions out of a list of Objects containing
 * UserSession IDs
 * @param {Object[]} list - List of Objects to lift
 * @returns {Promise}
 */
export const liftUserSessions = list =>
    UserSession.find({
        _id: {
            $in: list.map(item => item.userSession)
        }
    })
    .exec()
    .then(userSessions => {
        // Build out an Object of UserSession._id/{_id, userId, accountId} key/value pairs
        const lookUps = userSessions.reduce((acc, item)=> {
            acc[item._id] = {
                _id: item._id,
                userId: item.user || null,
                accountId: item.account || null
            }
            return acc
        }, {})

        // Re-insert the lightWeight userSessions into the list of POJO's
        return list.map(item => {
            const target = item.toObject()
            target.userSession = R.prop(
                String(item.userSession),
                lookUps
            )
            return target
        })
    })

export const accumKeys = ['countryCode', 'cityState', 'browser', 'device', 'timeDistribution']


/**
 * @func reduceCountList - Reduce a list of PageViews into a list of Counts, ultimately
 * receiving the popularity scores formatted as an Array of Any Types (likely mixed Strings and Numbers)
 * @param {Count[]} countList
 * @param {Object[]} pageViews
 * @returns {*[]}
 */
export const reduceCountList = (countList, pageViews)=>
    pageViews.reduce(countReducer, countList)
        .map(accumulator =>
            accumulator
                .asFrequencyTuple()
                .toList()
                .value()
        )


export const countReducer = (counts, pageView)=> counts.map(count => count.count(pageView))


export const emptyMap_ = new Map()


export const copyMap = map => new Map(map)


/**
 * @func countMapReducer - Reduce an Object of [k, Count<Empty>] pairs into a new
 * Object of [k, frequencyTuple] pairs based on the data in `list`
 * @param {Object} countMap
 * @param {Object[]} list
 * @returns {Object<frequencyTuple>}
 */
// Pass each item in the list to each 'Count'.  This will return a new 'Count'
// We reduce so we end up with a list of [key, count] pairs, which we rebuild back into an Object
export const countMapReducer = countMap =>
    R.compose(
        R.fromPairs,
        R.map(([k, v])=>
            ([
                k,
                v.asFrequencyTuple().toList().value()
            ])
        ),
        list => list.reduce(
            countPairReducer,
            Object.entries(countMap)
        ),
        R.toPairs
    )


export const countPairReducer = (countPairs, item) =>
    countPairs.map(([k, v]) => ([
        k,
        v.count(item)
    ]))


/**
 * @func Count - Uses getters, setters, and an accumulator
 * to count instances of a given value
 * Useful for incrementally finding how many times given values
 * show up in a given dataset
 * 
 * @param {Function} getter - Determines how the key is retrieved from a PageView
 * @param {Function} setter - Determines how values are stored in the accumulator
 * @param {(Map|Array)} accum - The accumulator.  Holds on to the 'state' of this value
 */
export const Count = (getter, setter=(x => x + 1), accum=emptyMap_)=> ({
    isCount: true,

    value: ()=> accum,

    chain: fn => Count(getter, setter, fn(accum).value()),
    map: fn => Count(getter, setter, fn(accum)),

    /**
     * @method add - Add `num` to the current value.
     * @param {Number} num - Value to add to the accumulated value.  1 is used instead of `num` if `num` is falsey
     * @param {Countable} countable
     * @returns {Count[getter, setter, Map]}
     */
    add: (num, countable)=>
        Count(getter, current => current + (num || 1), accum)
            .count(countable),

    /**
     * @method count - Increment the value
     * @param {Countable} countable
     * @returns {Count[getter, setter, Map]}
     */
    count: countable => {
        const key = R.tryCatch(
            R.pipe(getter, String),
            R.always(null)
        )(countable)

        if (likeNullOrUndefined(key)) {
            return Count(getter, setter, accum)
        }

        const current = accum.get(key) || 0
        const copy = copyMap(accum)
        copy.set(key, setter(current, key, countable))
        return Count(getter, setter, copy)
    },

    toList: ()=>
        Count(getter, setter,
            Array.isArray(accum)
                ? accum
                : Array.from(accum.entries())
                    .map(args => R.flatten(args))
        ),

    asFrequencyTuple: ()=> {
        const entries = Array.from(accum.entries())
        const totalCount = entries.reduce((sum, [_, count])=> sum + count, 0)
        const accumulator = new Map()
        entries.forEach(([key, count])=> {
            if (!likeNullOrUndefined(key)) {
                accumulator.set(key, [
                    count,
                    count / totalCount
                ])
            }
        })
        return Count(getter, setter, accumulator)
    },

})



export const compoundSeqCount = getter => 
    Count(
        pv => {
            const value = getter(pv)
            return !value // Reject null/false-y values
                ? null
                : ([
                    R.view(seqLens, pv),
                    value
                ])
        }
    )


export const seqLensCount = lens => compoundSeqCount(R.view(lens))


export const likeNullOrUndefined = R.either(
    R.isNil,
    s => String(s) === 'null' || String(s) === 'undefined')


/**
 * Common field accumulators
 */


/**
 * @func PageViewAccum - Calculate stats for browsers, devices, countries, cities/states, and time distribution
 * @param {Object[]} pageViews
 * @returns {Object[Map]} - Returns an Object of Map<String, [total, frequency %]>
 */
export const PageViewAccum = pageViews => {
    const countList = [
        CountryAccum,
        CityStateAccum,
        BrowserAccum,
        DeviceAccum,
        TimeDistribution
    ]
    const accumulated = reduceCountList(countList, pageViews)
    // Now that we have our list of Counts w/ the appropriate data,
    // map them to the appropriate key/val pairs so we can inject straight
    // into PageStats
    return accumKeys.reduce((obj, key, index)=> R.assoc(key, accumulated[index], obj), {})
}


export const CountryAccum = Count(
    R.view(R.lensPath(['location', 'countryCode']))
)


export const CityStateAccum = Count(
    pv => pv.location && pv.location.city
        ? [pv.location.city, pv.location.state]
        : null
)


export const BrowserAccum = Count(
    pv => pv.browser && pv.browser.name
        ? [pv.browser.name, pv.browser.version]
        : null
)


export const DeviceAccum = Count(
    R.view(R.lensPath(['browser', 'os', 'family']))
)


export const ReferrerAccum = Count(
    R.view(referrerLens)
)


export const getHours = d => moment(d).hour()


export const TimeDistribution = Count(
    R.compose(
        String,
        getHours,
        R.prop('created')
    )
)


/**
 * @typedef {Function} Filterable - Filter predicate function
 * @sig Filterable (a {*}) -> b {Boolean}
 * @param {*} x - A thing that you want your Filterable to handle
 * @example
 * const onlyGreaterThanFive = n => n > 5
 */

/**
 * @func Sum - Summable Monad (useful for accumulating totals, counting unique instances, generating popularity scores, etc)
 * @param {Function} getter - Unary function, used to lift values out of coun
 * @param {Filterable} filter - 
 */


export const Sum = (getter, filter=R.T, accum=0) => ({
    isSum: true,
    isCount: false,
    
    value: ()=> accum,
    of: (g, f) => Sum(g, f, 0),
    chain: fn => fn(accum),
    map: fn => Sum(getter, filter, fn(accum)),
    ap: val => Sum(getter, filter, accum(val)),

    /**
     * @method count - Increment the value
     * @param {Sum} countable
     * @returns {Sum[getter, Number]}
     */
    count: countable => {
        const liftedValue = R.tryCatch(
            getter,
            R.always(0)
        )(countable)

        return Sum(getter, filter, safeAdd(accum)(liftedValue))
    },

    sum: list =>
        list.filter(filter)
            .reduce(
                (s, item)=> s.count(item),
                Sum(getter, filter, accum)
            ),
    asFrequencyTuple: ()=> Sum(getter, filter, 0).sum(accum),
})


Sum.of = fn => Sum(fn, 0)
Sum.isCount = R.F


export const isActuallyANumber = R.both(
    R.is(Number),
    x => !isNaN(x)
)

export const numberOrZero = R.compose(
    R.ifElse(
        isActuallyANumber,
        R.identity,
        R.always(0)
    ),
    Number
)


export const safeAdd = base => R.tryCatch(
    n => base + numberOrZero(n),
    R.always(base)
)


/**
 * User Helpers
 */

export const stringIfNotNull = R.ifElse(R.isNil, R.always(null), String)


export const isUserLight = R.tryCatch(
    R.compose(Boolean, R.prop('isUserLight')),
    R.F
)


export const isRegistered = R.tryCatch(
    R.compose(
        R.complement(R.isNil),
        R.view(accountIdLens)
    ),
    R.F
)


export const UserLight = arg => ({
    isUserLight: true,
    value: arg,
    id: ()=>
        UserLight(arg)
            .map( R.compose(stringIfNotNull, R.view(idLens)) ),

    accountId: ()=>
        UserLight(arg)
            .map( R.view(accountIdLens) ).value,
    
    userId: ()=>
        UserLight(arg)
            .map( R.view(userIdLens) ).value,

    identity: ()=> arg,
    of: x => UserLight.of(x),
    map: fn => UserLight(fn(arg)),
    ap: val => UserLight(arg(val)),
    chain: fn => fn(arg),
    eq: userLight => UserLight(arg).id() === userLight.id(),

    isRegistered: ()=> isRegistered(arg)
})


UserLight.isUserLight = true


UserLight.of = x => {
    if (x && safeCheckIfUserSession(x)) {
        const userAccount = x.account
        const accountId = userAccount
            ? (
                safeCheckIfAccount(userAccount)
                    ? userAccount.account._id
                    : userAccount.account
            )
            : null
        const sessionId = x._id

        return UserLight({
            accountId,
            _id: sessionId,
            userId: x.user._id
        })
    }

    // Unwrap any UserLight instances by recursively calling this
    // function as needed 'till it's no longer a UserLight
    return isUserLight(x)
        ? UserLight.of(x.value)
        : UserLight(x)
}


export const safeCheckIfUserSession = R.tryCatch(R.is(UserSession), R.F)

export const safeCheckIfAccount = R.tryCatch(R.is(Account), R.F)


export const UserList = arg => ({
    isUserList: true,
    value: arg,
    get length() {
        return arg.length
    },

    count: ()=> UserList(arg).uniq().length,
    identity: ()=> arg,
    of: x => UserList.of(x),
    map: fn => UserList(fn(arg)),
    ap: val => UserList(arg(val)),
    chain: fn => fn(arg),

    uniq: ()=> UserList(arg).map(
        R.uniqBy(userLight => userLight.id())
    ),

    uniqByUser: ()=> UserList(arg).map(
        R.uniqBy(userLight => userLight.userId())
    ),

    uniqByAccount: ()=> UserList(arg).map(
        R.uniqBy(userLight =>
            userLight.accountId()
            || userLight.userId()
        )
    ),

    registered: ()=> UserList(arg).map(
        R.filter(userLight => userLight.isRegistered())
    ),

    unRegistered: ()=> UserList(arg).map(
        R.filter(userLight => !userLight.isRegistered())
    ),

    totalUsers: ()=> UserList(arg).count(),

    bounceSessions: ()=>
        UserList( getBounceSessions(arg) )
            .map(
                R.compose(
                    R.flatten,
                    R.values
                )
            )
})

UserList.isUserList = true
UserList.of = x => UserList(x)

UserList.liftUserSessions = userSessions =>
    UserList( userSessions.map(u => UserLight.of(u)) )



/**
 * User List Helpers
 */

export const groupByPage = R.groupBy(
    R.view(R.compose(pageLens, idLens))
)


export const groupByActionType = R.groupBy(
    R.view(actionTypeLens)
)


export const lengthGtOne = R.compose(
    R.gt(R.__, 1),
    R.length
)


export const getBounceSessions = R.compose(
    R.fromPairs,
    R.filter(
        ([_, instances])=> lengthGtOne(instances)
    ),
    R.toPairs,
    R.groupBy(userLight => userLight.id())
)
