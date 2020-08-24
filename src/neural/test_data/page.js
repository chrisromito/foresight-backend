/**
 * @module test_data.page - Generate records for:
 * - Pages (linked to our test client & their domains)
 * - PageViews (linked to our test pages)
 * 
 * This simulates web/app traffic over the course of a year,
 * where each page gets more and more views per day.  The # of views,
 * and the users viewing each page are randomized and weighted.
 * 
 * This is deliberately broken out into a ton of pure tiny functions because of the large dataset,
 * and the potential for memory leaks.
 * 
 * The promise chains help avoid concurrency issues.  Without them, it ends up creating
 * ~30-60 million promises that are all racing to complete ASAP, which results in a StackOverflow (lol).
 * 
 * Dataset biases:
 * - Page : Parent pages ('home', 'search', 'blog', 'profile') are weighted so
 * they receive more views than child pages ('blog/123', 'profile/456') to simulate
 * users going to a 'blog' page that lists all of the blogs, then selecting a blog from that page.
 * - Day of the week: To simulate trends in site activity based on the given day,
 *
 */

const R = require('ramda')
const moment = require('./moment')
const { Action, Page, PageView, UserSession } = require('../../models/index')
const { randomIntBetween, randomItemFrom } = require('./utils')
const { generateClientTestData, testDomainUrl, getTestClient } = require('./clients')
const { generateRandomAccounts, deleteRandomAccounts, getTestUsers } = require('./user_generator')
const pChain = require('../../utils/pchain')


/**
 * constants
 * 
 * @const END_VIEW_COUNT : This is the number of daily views that our
 * dataset will progressively trend toward.
 * We start at 365 days before the day this script is run, and over time,
 * each page will start to get more and more views.  Toward the end of that year,
 * the # of views will get closer to (or exceed) this number.
 * 
 * @const {Number} TOTAL_DAYS - Total # of days to generate views for
 * Keep in mind that, on average, each page will get ~7k views per day
 * (when END_VIEW_COUNT is 10k).  Since we have 24 test pages, that means each day
 * will have a total of approximately 16,8000 UserSessions & PageViews.
 * So 1 year will create about 30 million to 60 million UserSessions AND PageViews
 */
const END_VIEW_COUNT = 100  // Ten thousand views per day

const TOTAL_DAYS = 5

const parentPathsWithoutChildren = ['search', 'home']
const parentPathsWithChildren = ['blog', 'profile']
const childCount = 10

// [0, 1, 2, 3... 10]
const childPageIds = R.times(R.identity, childCount)


const unflattenedPagePaths = childPageIds.reduce((accum, n)=>
    accum.concat(
        parentPathsWithChildren.map((p)=> `${p}/${n}/`)
    ),
    [parentPathsWithoutChildren, parentPathsWithChildren]
)

const flattenedPagePaths = R.flatten(unflattenedPagePaths)



//-- Page Data

const generateTestPage = (clientId, pathname)=> new Page({
    client: clientId,
    name:  `Test Page: ${pathname}`,
    url: {
        pathname: pathname,
        host: testDomainUrl.host,
        hostname: testDomainUrl.hostname,
        port: testDomainUrl.port,
        protocol: testDomainUrl.protocol,
        origin: testDomainUrl.origin,
    }
}).save()



const generateTestPages = ()=> deleteTestPages()
    .then(getTestClient)
    .then((client)=> {
        const clientId = client._id
        const thunkList = flattenedPagePaths
            .map((p)=> ()=> generateTestPage(clientId, p))
        return pChain(thunkList)
    })


const deleteTestPages = ()=> Page.deleteMany({
    name: /.*Test Page*./i
}).exec()


const getTestPages = ()=> Page.find({
    name: /.*Test Page*./i
}).exec()


//-- PageViews

/**
 * @const {Number[]} dayIndexes - Array of numbers that increment up to @see TOTAL_DAYS
 * [0, 1, 2, 3, ...365]
 */
const dayIndexes = R.times(
    R.add(0, R.__),
    TOTAL_DAYS
).reverse()


const dayOfTheWeekWeights = [
    1,   // Sunday
    1.1, // M
    1.2, // T
    0.8, // W
    1,   // Thurs
    1.8, // Fri
    1.5  // Sat
]


const parentPageWeightMap = parentPathsWithoutChildren.concat(parentPathsWithChildren)
    .reduce((accum, p)=> {
        accum[p] = 1.5
        return accum
    }, {})


const childPageWeightMap = flattenedPagePaths
    .reduce((accum, p)=> {
        accum[p] = 1
        return accum
    }, {})


/**
 * @const {Object} pageWeightMap - Weights/biases to use for each page/path
 * The keys are paths ('blog/123'),
 * values are weights {Number} for each respective path
 */
const pageWeightMap = R.mergeDeepLeft(parentPageWeightMap, childPageWeightMap)


const parseModelList = R.pipe(JSON.stringify, JSON.parse)

const idProp = R.prop('_id')


/**
 * @typedef {Object} Stats
 * @property {String} pageId
 * @property {Number} unique - Unique views for this page
 * @property {Number} total - Total views for this page
 */

const PageStats = (arg)=> ({
    of: (x)=> PageStats(x),
    value: ()=> arg,

    ap: (ps)=> ps.map(PageStats(arg).value()),
    map: (fn)=> PageStats(fn(arg)),
    chain: (pageStats)=> pageStats.map(arg),
   
    // Monadic
    project: (props)=> PageStats(
        R.project(props, arg)
    ),

    transform: (obj)=> ([
        idProp(obj),
        R.path(['url', 'pathname'], obj)
    ]),

    parse: ()=> PageStats(arg)
        .map(parseModelList)
        .map((list)=>
            list.map((o)=> PageStats().transform(o))
        ),

    find: (url)=> R.find(
        R.compose(R.equals(url, R.__), R.view(PageStats.urlLens)),
        arg
    ),

    /**
     * @method cReduce - Create a curried PageStats reducer
     * @param {Number} dayIndex - Index of the day the PageStats are for
     * @param {Number} loopIndex - Index of the nested loop
     * @param {Map<Date, Stats[]>} accum - Accumulated map of Dates & lists of Stats
     * @param {String} url - URL/path for the current page
     * @returns {Map<Date, Stats[]>} - Returns a copy of the accumulated Map 
     */
    cReduce: (dayIndex, loopIndex)=> {
        // Cache our moment calculations & DOTW weight lookups outside of the reduce fn
        const viewMoment = moment().subtract(dayIndex, 'days')
        const date = viewMoment.toDate()
        const dayOfTheWeek = viewMoment.day()
        const dayWeight = dayOfTheWeekWeights[dayOfTheWeek]

        return (accum, url)=> {
            const copy = new Map(accum)
            const pageId = R.view(
                PageStats.idLens,
                PageStats(arg).find(url)
            )
            const apWeights = R.pipe(
                R.multiply(dayWeight, R.__),
                R.multiply(R.prop(url, pageWeightMap), R.__),
                (n)=> Math.round(n)
        )

            const bottomEnd = apWeights(randomIntBetween(loopIndex, END_VIEW_COUNT))
            const upperEnd = Math.round(
                randomIntBetween(bottomEnd, END_VIEW_COUNT)
            )
            const unique = bottomEnd < upperEnd ? bottomEnd : upperEnd
            const total = bottomEnd < upperEnd ? upperEnd : bottomEnd 
            
            const viewsPerDate = (copy.get(date) || []).concat({
                pageId,
                unique,
                total
            })

            copy.set(date, viewsPerDate)
            return copy
        }
    }
})

PageStats.of = (x)=> PageStats(x)
PageStats.idLens = R.lensIndex(0)
PageStats.urlLens = R.lensIndex(1)





/**
 * @func generatePageViewTimeSeries
 * @param {Object[]} pageList - Array of Objects w/ the same shape
 * as our Page Model
 * @returns {Map<Date, Stats[]} - Array of Stats
 */
const generatePageViewTimeSeries = (pageList)=> {
    const stats = PageStats(pageList).parse()

    return dayIndexes.reduce((dayAccum, distance, index)=> {
        const dayReducable = stats.cReduce(distance, index)

       return flattenedPagePaths
            .reduce((accum, url)=> dayReducable(accum, url), dayAccum)
    }, new Map())
}



//-- Persistent data

const PvScope = (arg)=> ({
    of: ({ pageIdList, userIdList, ...args})=> PvScope({ pageIdList, userIdList, ...args}),
    value: ()=> arg,
    map: (fn)=> PvScope(fn(arg)),
    chain: (pv)=> pv.map(arg),
    pageId: ()=> PvScope(arg).value().pageId,
    userSession: ()=> PvScope(arg).value().userSession,

    mergeContext: (data)=> PvScope(R.mergeRight(arg, data)),

    mapDate: (date)=> PvScope(arg).mergeContext({ date }),

    mapPageId: (pageId)=> PvScope(arg).mergeContext({ pageId }),
    
    mapUserSession: (userSession)=> PvScope(arg).mergeContext({ userSession: userSession._id })
})

PvScope.of = ({ pageIdList, userIdList, ...args})=> PvScope({ pageIdList, userIdList, ...args})



/**
 * @func createUserSession - Create a UserSession instance
 * @param {Date} date
 * @param {PvScope} scope
 * @returns {Promise<PvScope>}
 */
const createUserSession = (date, scope)=>
    new UserSession({
        user: randomItemFrom(scope.value().userIdList),
        active: false,
        created: date,
        updated: date
    }).save()
    .then((userSession)=> scope.mapUserSession(userSession))



/**
 * @func createPageView - Create a UserSession instance, & map it to a new PageView instance
 * @param {Date} date
 * @param {PvScope} scope
 * @returns {Promise<PvScope>}
 */
const createPageView = (date, scope)=> createUserSession(date, scope)
    .then((pvs)=> Promise.all([
        pvs,
        new PageView({ page: pvs.pageId(), userSession: pvs.userSession() })
            .save()
            .then((pv)=> 
                new Action({
                    userSession: pvs.userSession(),
                    pageView: pv._id,
                    actionType: 'GET',
                    timestamp: Date.now(),
                    target: {
                        id: pvs.pageId(),
                        name: 'Page',
                        data: pv.toJSON()
                    }
                })
                .save()
                .then(()=> pv)
            )
    ]))
    .then(([ pvScope, pageView])=>
        pvScope.mergeContext({ pageView: pageView._id})
    )


const handleChainErr = (doThrow)=> (err)=> {
    console.log('\n\n ERROR \n\n')
    console.log(err)
    if (doThrow) {
        throw err
    }
}



/**
 * @func chainPageViews
 * @param {PvScope<Object>} scope
 * @param {Date} date
 * @param {Number} viewCount
 * @returns {Promise<Error, PvScope[]}
 */
const chainPageViews = (scope, date, viewCount)=> {
    const pvThunkList = R.repeat(
        ()=> createPageView(date, scope),
        viewCount
    )
    return pChain(pvThunkList).catch(handleChainErr(true))
}


const chainViewsPerDate = (scope, date, viewStatsList)=> pChain(
    viewStatsList.map(
        ({ pageId, total })=> ()=> chainPageViews(scope.mapPageId(pageId), date, total)
    )
).catch(handleChainErr(true))


/**
 * @func timeSeriesToPageViews
 * @param {Map<Date, PageStats>} timeSeries
 * @returns {Promise<Error, PvScope[]}
 */
const timeSeriesToPageViews = (userIdList, pageList, timeSeries)=> {
    const pageIdList = PageStats(pageList)
        .parse()
        .map((list)=> list.map( R.view(PageStats.idLens) ))
        .value()

    const baseScope = PvScope.of({ pageIdList, userIdList })

    return pChain(
        Array.from(timeSeries.entries())
            .map(([date, viewStatsList])=> ()=>
                chainViewsPerDate(baseScope, date, viewStatsList)
            )
    )
}


const liftModelIds = R.compose(R.map(idProp), parseModelList)


const generateTestPageViews = ()=> Promise.all([getTestUsers(), getTestPages()])
    .then(([userList, pageList])=> 
        timeSeriesToPageViews(
            liftModelIds(userList),
            pageList,
            generatePageViewTimeSeries(pageList)
        )
    )
    .catch(handleChainErr(false))



const Run = (destroy=false)=> (destroy ? deleteRandomAccounts() : Promise.resolve(true))
    .then(()=> {
        console.log('\n\nGenerating Client Test Data...')
        return generateClientTestData()
    }).then(()=> {
        console.log('\n\nGenerating test accounts & users')
        return generateRandomAccounts()
    }).then(()=> {
        console.log('\n\nGenerating test pages...')
        return generateTestPages()
    }).then(()=> {
        console.log('\n\nAbout to generate Test Page Views.  This may take several HOURS')
        return generateTestPageViews()
    }).then((d)=> {
        console.log('\n\n Run Complete')
        return d
    })

module.exports = {
    generateTestPages,
    deleteTestPages,
    getTestPages,
    generatePageViewTimeSeries,
    generateTestPageViews,
    Run,
    
    // For testing in the shell...
    PageStats,
    flattenedPagePaths,
    liftModelIds,
    getTestUsers
}


const COPY_PASTE = `

var dataGenerator = { Run } = require('./src/server/neural/test_data/page')


var results = null

Run().then((x)=> { console.log('Done running task');  results = x;  return x; }).catch(console.log)

`
