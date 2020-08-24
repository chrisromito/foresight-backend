const R = require('ramda')
const { check, validationResult } = require('./express-validator/check')
const { PageView, UserSession, Page } = require('../../models/index')
const SessionMonad = require('../user/interfaces')
const { setSession } = require('../user/user.session')
const { ofUrl, PageService, PageViewService } = require('../page_view/service')
const { fToPromise } = require('../../utils/future_promise_interop')
const { socketContext, DateRangeFilter } = require('../common/common')
const { ObjectId, tapLog, toPojo } = require('../../utils/common')
const Io = require('../../../../src/shared/functional_types/io')


/**
 * URL Filter Params:
 * active {Boolean}
 * url {String}
 * created_start {Date|Number}
 * created_end {Date|Number}
 */
const activeLens = R.lensPath(['active'])


const activeFilter = (query) => (obj) => R.view(activeLens, query) ? R.over(
    activeLens,
    R.either(
        Boolean,
        R.equals('true', R.__)
    ),
    query
) :
    obj


const urlLens = R.lensPath(['url'])


const urlFilter = (query) => (obj) => R.view(urlLens, query) ? R.over(
    urlLens,
    R.always(R.view(urlLens, query)),
    obj
) :
    obj


const createdFilter = (query) => (obj) => DateRangeFilter('created', query, obj)


const setPageViewFilters = (query, obj) =>
    Io.lift(obj)
        .map(activeFilter(query))
        .map(urlFilter(query))
        .map(createdFilter(query))


const normalizeId = (o)=> R.assoc('id', R.prop('_id', o), o)


const serializeModels = R.map(normalizeId)


//-- Common functions

const getPopulatedPageViews = (filterObj={})=>
    PageView.find(filterObj)
        .populate('page')
        .populate('children')
        .populate({
            path: 'userSession',
            populate: {
                path: 'user',
                select: 'account active updated created'
            }
        })


const getPopulatedPageView = pageViewId =>
    getPopulatedPageViews({ _id: ObjectId(pageViewId) })
        .limit(1)
        .exec()
        .then(R.head)


/**
 * PageView Controller methods
 *=========================================*/

const PageViewCharts = (req, res) =>
    setSession(socketContext({}, req))
        .then(() => res.render('page_view_demo/page_view_demo.html', {
            data: {}
        }))


/**
 * PageView REST(ish) API Controller methods
 */
const PageViewList = (req, res) => 
    getPopulatedPageViews({...setPageViewFilters(req.query, {}).run()})
        .exec()
        .then(R.pipe(
            serializeModels,
            (pv) => res.json(pv)
        ))


const PageViewDetail = (req, res)=>
    getPopulatedPageView(req.params.pageViewId)
        .then((pv)=> res.json(pv))


/**
 * @func PageViewPost - Handles creating a new Page View instance & creates a new Page if needed.
 * Returns a deeply populated PageView instance
 */
const PageViewPost = (req, res, next) => {
    const { clientId, sessionId } = SessionMonad(req).value()
    const url = liftUrl(req)
    // Grab the UserSession & the page
    // Then create a PageView record
    return UserSession.findById(ObjectId(sessionId))
        .exec()
        .then(userSession => Promise.all([
            userSession,
            fToPromise(liftPage(clientId)(url))
        ]))
        .then(([userSession, page]) =>
            PageViewService({ url })
                .createPageView({
                    userSession,
                    ip_address: req.body.ip_address || userSession.ip_address || req.ip,
                    pageId: page._id,
                    referrer: req.body.referrer
                })
        )
        .then(pageView =>
            res.json(pageView))
        .catch(next)
}


const liftUrl = req => ofUrl(req.body.url)


const liftPage = clientId => url =>
    PageService({ url })
        .getClientPage(clientId)


module.exports = {
    PageViewCharts,
    PageViewList,
    PageViewDetail,
    PageViewPost
}
