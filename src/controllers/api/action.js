const R = require('ramda')
const Maybe = require('./maybe')

const { toJson, socketContext, getRequestUser, DateRangeFilter } = require('../common/common')
const Io = require('../../../../src/shared/functional_types/io')
const { Action } = require('../../models/index')
const { ActionInterface, UserInterface } = require('../../../../src/shared/interfaces/index')

const { setSession } = require('../user/user.session')
const SessionMonad = require('../user/interfaces')
const { UserSessionService } = require('../user/service')
const { ActionService } = require('../action/service')


/**
 * @constant onOpen :: context {socketContext} => Promise => UserSession {JSON}
 * NOTE: This assumes the 'auth' & 'user' Middleware are used prior to this being called,
 * so this just needs to set the UserSession's active status
 */
const onOpen = context => {
    const sessionMonad = SessionMonad(context.request)
    const accountId = sessionMonad.value().accountId

    return new Promise((resolve, reject)=> {
        UserSessionService(context.request)
            .updateUserActiveStatus(accountId, true)
            .fork(reject, resolve)
    })
}


/**
 * @constant onClose :: context {socketContext} => Promise => User
 */
const onClose = context => {
    const sessionMonad = SessionMonad(context.request)
    const accountId = sessionMonad.value().accountId

    return new Promise((resolve, reject)=> {
        UserSessionService(context.request)
            .updateUserActiveStatus(accountId, false)
            .fork(reject, resolve)
    })
}


/**
 * @constant createAction :: context {socketContext}, action {Object} => Action {JSON}
 * Create an Action instance.  This expects a 'user' instance to exist on request.session
 */

const createAction = (context, action)=>
    onOpen(context)
        .then(()=> {
            action.user = getRequestUser(context)
            return new Action(action)
                .save()
                .then((a)=> a.toObject())
        })
        .then(toJson)
        .catch(e => {
            console.log('Error!')
            console.log(e.stack)
            throw e
        })

/*
 *
 *  REST Interfaces
 *-------------------------------------------------*/


//-- Filter Builder Helpers
const viewLens = (lens, query)=> R.view(lens, query)


const actionTypeFilter = R.curry((query, obj)=> {
    const typeLens = R.lensPath(['actionType'])
    const param = viewLens(typeLens, query)
    return param ? R.over(
        typeLens,
        R.always(R.view(typeLens, query)),
        obj
    ) : obj
})


const timeStampFilter = R.curry((query, obj)=> DateRangeFilter('timestamp', query, obj))


const targetNameFilter = R.curry(
    (query, obj)=> R.has('target_name', query) ?
        R.over(
            R.lensPath(['target.name']),
            R.always(R.prop('target_name', query)),
            obj
        ) :
        obj
)


const userIdFilter = R.curry(
    (query, obj)=> R.has('user', query) ?
        R.over(
            R.lensPath(['user._id']),
            R.always(R.prop('user', query)),
            obj
        ) :
        obj
)


//-- Serialization
const parse = R.pipe(JSON.stringify, JSON.parse)


const liftUser_ = o => Maybe(o).isJust() ? new UserInterface(o).toObject(true) : null


const liftUser = R.tryCatch(liftUser_, R.always(null))


const liftAction_ = a => R.over(
    R.lensPath('user'),
    liftUser,
    ActionInterface.of(a).toObject()
)


const liftAction = R.tryCatch(liftAction_, R.identity)


const serializeActions = R.pipe(
    parse,
    R.map(liftAction),
    JSON.stringify
)


/**
 * @const actionList - Handle RESTful GET requests for many actions
 */
const setActionFilters = (query, obj)=>
    Io.lift(obj)
        .map(actionTypeFilter(query))
        .map(timeStampFilter(query))
        .map(targetNameFilter(query))
        .map(userIdFilter(query))


const actionList = (req, res)=> {
    const queries = req.query

    const pageNumber = queries.page || 1
    const lowerLimit = (pageNumber - 1) * 100
    const upperLimit = pageNumber * 100
    const filterObj = setActionFilters(queries, {}).run()

    return Action.find(filterObj, null, { sort: { timestamp: -1 } })
        .skip(lowerLimit)
        .limit(upperLimit)
        .populate('user')
        .exec()
        .then(R.pipe(
            serializeActions,
            (l)=> res.send(l)
        ))
}


/**
 * @func ActionPost - Create an Action for a user
 */
const ActionPost = (req, res, next)=>
    ActionService({ ...req.body, pageView: req.body.pageViewId })
        .create({ userSession: SessionMonad(req).value().sessionId })
        .fork(next, action => res.json(action))


module.exports = {
    ActionPost,
    socketContext,
    onOpen,
    onClose,
    createAction,
    actionList
}
