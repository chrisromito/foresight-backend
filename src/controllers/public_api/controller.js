/**
 * FIXME: CR 2020-Mar-14 - Write tests for PageViews/PageViewPaths
 */
import { Page } from 'models/client'
import {
    Action,
    ActionPath,
    PageView,
    PageViewPath,
    PageViewPathTag,
    ActionPathTag
} from 'models/tracking'
import { PageViewPathService } from 'models/tracking/service'
import {
    publicApiEndpoints,
    reverseAbsolute,
    socketEndpoints
} from 'routes/endpoints'


/**
 * @typedef {Object} PageViewPostResponse - Shape of our API responses to POST requests
 * on the Page View public API
 *
 * @property {pageView} page_view
 * @property {PageViewEndPoints} end_points
 * @property {PageViewJwt} jwt - JWT key/val pairs that the end-user/client needs
 *      to authorize subsequent requests
 */

/**
 * @typedef {{
 *     action_url: String,
 *     next_api_url: String,
 *     socket_url: String
 * }} PageViewEndPoints
 */

/**
 * @typedef {{
 *     jwt: String,
 *     user_id: Number,
 *     client_id: Number
 * }} PageViewJwt
 */

export const PageViewController = {

    /**
     * @method pageViewPost - Create a page view
     * POST /api/page_view/
     * Required fields:
     *      @property {String} url - URL for the current page
     *      @property {String} referrer - URL for the previous page
     *      @property {Object[]} actions - Optional actions to map to this PageView
     *      @property {(Object|string)[]} tags - Optional tags to map to this PageView
     *      @property {(String|null)} ip_address - Ip Address that the request was sent from
     * @returns {Promise<{
     *      end_points: {
     *          action_url: String,
     *          next_api_url: String,
     *          socket_url: String
     *      },
     *      jwt: {
     *          user_id: Number,
     *          jwt: String,
     *          client_id: Number
     *      },
     *      page_view: {
     *          tags: unknown
     *      }
     *  }>}
     */
    pageViewPost: (req, res, next)=> {
        const { clientId, jwt, userId, client } = req
        const { url, referrer = null, actions = [], tags = [] } = req.body
        const ip_address = req.body.ip_address || req.ip

        return Page.getOrCreate({ url, client_id: clientId })
            .then(page =>
                PageView.insert({
                    page_id: page.id,
                    user_id: userId,
                    active: true
                })
            )
            .then(pageView =>
                PageViewPath.lift({
                        referrer,
                        pageView,
                        actions,
                        tags,
                        ip_address,
                        client_id: clientId
                    })
                    .then(pageViewPath => ({
                        pageView,
                        pageViewPath
                    }))
            )
            .then(({ pageView, pageViewPath }) =>
                PageViewPathTag.mapMany(pageViewPath.id, tags)
                    .then(mappedTags => ({
                        pageView,
                        mappedTags
                    }))
            )
            .then(({ pageView, mappedTags }) => ({
                jwt: {
                    jwt: jwt.token,
                    user_id: req.user_id,
                    client_id: req.client_id
                },
                page_view: {
                    ...pageView,
                    tags: mappedTags
                },
                end_points: {
                    action_url: reverseAbsolute(
                        publicApiEndpoints.action,
                        { page_view_id: pageView.id }
                    ),
                    next_api_url: reverseAbsolute(
                        publicApiEndpoints.pageViewDetail,
                        { id: pageView.id }
                    ),
                    socket_url: reverseAbsolute(
                        socketEndpoints.pageView,
                        { page_view_id: pageView.id },
                        true,
                        { jwt: jwt.token, clientKey: client.public_key }
                    )
                }
            }))
            .then(data => res.send(data))
            .catch(next)
    },
    //-- POST /api/page_view/:id/active
    pageViewActive: (req, res, next) =>
        updatePageViewActive(true)({
            id: req.params.id,
            user_id: req.userId
        })
        .then(data => res.send(data))
        .catch(next),
    //-- POST /api/page_view/:id/inactive
    pageViewInActive: (req, res, next) =>
        updatePageViewActive(false)({
            id: req.params.id,
            user_id: req.userId
        })
        .then(data => res.send(data))
        .catch(next)
}





export const ActionController = {
    //-- GET /api/page_view/:id/action
    pageViewActionGet: (req, res, next)=> {},
    //-- POST /api/page_view/:id/action
    pageViewActionPost: (req, res, next)=> {},
    //-- PATCH /api/page_view/:id/action
    pageViewActionPatch: (req, res, next)=> {},
    //-- POST /api/page_view/:id/action/:actionId
    pageViewActionChildPost: (req, res, next)=> {}
}



//-- Utils

const updatePageViewActive = is_active => ({ id, user_id }) =>
    PageView.updateWhere({ id, user_id }, { is_active })
