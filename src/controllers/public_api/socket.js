import * as R from 'ramda'
import {
    tryToJson,
    tryToParse
} from '../../utils/common'
import { excludeNullValues, passiveMerge } from '../../utils/object'
import {
    Action,
    ActionPath,
    PageView,
    PageViewPath,
    PageViewPathTag,
    ActionPathTag
} from '../../models/tracking'
import { isValidClient } from '../../models/client/index'
import {
    Jwt,
    JwtService,
    parseAuthHeader
} from '../../models/jwt'
import {
    publicApiEndpoints,
    reverseAbsolute,
    socketEndpoints
} from '../../routes/endpoints'


/**
 * FIXME: CR 2020-May-24: Finish building out the PageViewSocketObserver
 *     See pageViewSocketController for current implementation.  You need
 *     to translate it into the socketObserver
 */
export const PageViewSocketObserver = {
    next: ({ context, close, send, update }, { type, data }) => {
        const {
            isAuth,
            user,
            client,
            kwargs,
            queryParams
        } = context
        const { clientKey, jwt } = queryParams
        const { page_view_id } = kwargs
        if (!jwt || !clientKey) {
            console.log(`\n\n\nPageViewSocketObserver.next ->
                missing JWT or clientKey... closing...`)
            return close()
        }
        const mergedContext = excludeNullValues({
            ...kwargs,
            ...context,
            client,
            user,
            page_view_id: Number(page_view_id)
        })
        const pred = isAuth
            ? ()=> Promise.resolve(mergedContext)
            : ()=> socketAuth(jwt, clientKey)
                .then(authContext =>
                    passiveMerge(authContext, { isAuth: true })
                )
        if ('message' === type) {

            return pred()
                .then(
                    passiveMerge(mergedContext)
                )
                .then(o =>
                    onMessage({ type, data }, o)
                )
                .then(actionData =>
                    ({
                        type,
                        data: actionData
                    })
                )
                .then(send)
        }
    },

    complete: ({ context }, reason) => {
        const { kwargs, user } = context
        const { page_view_id } = kwargs
        return PageView.updateWhere({
                id: page_view_id,
                user_id: user.id
            },
            { active: false }
        )
    },

    error: error => {
        console.error(`\n\n\nPageViewSocketObserver.error()`)
        console.error(error)
        return error
    }
}


const socketActions = {
    /**
     * @method tag - Map tags to a PageView Path
     * @param {Object[]} tags
     * @param {{ user: Object, page_view_id: Number }} context
     * @returns {Promise<Object[] | null>}
     */
    tag: (tags, { page_view_id, user }) =>
        PageViewPath.selectOneWhere({ to_page_view_id: page_view_id, user_id: user.id })
            .then(pageViewPath =>
                pageViewPath
                    ? PageViewPathTag.mapMany(pageViewPath.id, tags).then(R.flatten)
                    : []
            ),

    /**
     * @method action - Maps actions to a PageView Path
     * @param {Object[]} actionData - Actions to map to the PageViewPath
     * @param {{ user: Object, page_view_id: Number }} context
     * @returns {Promise<Object[]>}
     */
    action: (actionData, { page_view_id, user }) => {
        const user_id = user.id
        return PageViewPath.selectOneWhere({ user_id, to_page_view_id: page_view_id })
            .then(pageViewPath => {
                if (!pageViewPath) {
                    return []
                }

                const { id } = pageViewPath
                const actionList = R.flatten([actionData])
                    .map(action => ({
                        action,
                        page_view_path_id: id
                    }))

                return ActionPath.mapSequence(actionList)
            })
            .then(actionPathIdList =>
                ActionPath.selectWhereIn('id', actionPathIdList)
            )
    }
}


const socketAuth = (token, clientKey)=>
    isValidClient(clientKey)
        .then(client =>
            JwtService(Jwt)
                .verifyToken(token)
                .then(({ jwt, user }) => ({
                    jwt,
                    client,
                    user
                }))
        )
        .catch(e => {
            console.log(`public_api/socket -> auth -> 
                    token: ${token}
                    clientKey: ${clientKey}
                    error:
                `)
            console.error(e)
            return Promise.reject(e)
        })


const onMessage = ({ type, data }, context)=> {
    // Exit early if it's not a valid 'action' field
    const action = data && data.action
        ? data.action
        : null
    if (!action || !R.has(action, socketActions)) {
        return Promise.resolve(null)
    }


    // Pass the socket data to our delegated handler,
    // serialize the result, then send it to the client
    const method = R.prop(action, socketActions)
    const mergedData = R.has('data', data)
        ? R.prop('data', data)
        : data
    return method(mergedData, context)
        .catch(e => {
            console.error(`action.catch() -> ${e}`)
            return Promise.reject(e)
        })
}
