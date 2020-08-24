import { URL } from 'url'
import { compile } from 'path-to-regexp'
import { curry } from 'ramda'
import {
    SITE_URL,
    SOCKET_URL
} from '../constants'


/**
 * @func liftPath
 * @param {String} domain
 * @param {String} path
 * @param {Object|null} [queryParams=null]
 * @returns {String}
 */
const liftPath = (domain, path, queryParams = null)=> {
    const url = new URL(domain)
    url.pathname = path
    if (queryParams) {
        Object.entries(queryParams)
            .forEach(([k, v]) =>
                url.searchParams.set(k, v)
            )
    }
    return url.toString()
}



/**
 * API - HTTP(s)
 */
const apiRoute = '/api'
const socketRoute = '/socket'

const pageView = `${apiRoute}/page_view`

//-- Endpoints for the public facing API used by embed codes
export const publicApiEndpoints = {
    pageView: pageView,
    pageViewDetail: `${pageView}/:id`,
    // POST -> mark a page view as active
    pageViewActive: `${pageView}/:id/active`,
    // POST -> mark a page view as inactive
    pageViewInactive: `${pageView}/:id/inactive`,
    // Get/Create tags for a Page View
    pageViewTags: `${pageView}/:page_view_id/tag`,
    // CRUD for actions associated w/ a PageView
    action: `${pageView}/:page_view_id/action`,
    actionDetail: `${pageView}/:page_view_id/action/:id`
}


/**
 * Sockets
 */
export const socketEndpoints = {
    socketRoute,
    pageView: `${socketRoute}/page_view/:page_view_id`
}


// TODO: Add other endpoints to this object to act as the main registry for app-wide HTTP endpoints
const endpoints = Object.entries({
    ...publicApiEndpoints,
    apiRoute
}).reduce(
    (o, [k, v])=> ({
        ...o,
        [k]: liftPath(SITE_URL, v)
    }),
    {}
)

// TODO: Add other endpoints to this object to act as the main registry for app-wide socket endpoints
const sockets = Object.entries({
    ...socketEndpoints
}).reduce(
    (o, [k, v]) => ({
        ...o,
        [k]: liftPath(SOCKET_URL, `${socketRoute}${v}`)
    }),
    {}
)


//-- App-wide Socket and HTTP endpoints
export const absoluteEndpoints = {
    sockets,
    endpoints
}


/**
 * @func reverse_ - Convert an Express URL path to a legit URL
 * with the params populated based on the provided kwargs
 * Inspired by Django's 'reverse' function:
 * {@link https://docs.djangoproject.com/en/dev/ref/urlresolvers/#reverse}
 *
 * @param {String} url
 * @param {Object} kwargs
 * @returns {string}
 * @private
 */
const reverse_ = (url, kwargs) => {
    const compiler = compile(url, {
        encode: encodeURIComponent,
        decode: decodeURIComponent
    })

    return compiler(kwargs)
}


/**
 * @func reverse - Curried function to populate the params of
 * an Express URL path with the given kwargs
 * @param {String} url
 * @param {Object} kwargs
 * @param {Boolean} [socket=false] - Is this a socket endpoint or an HTTP endpoint?
 * @returns {String}
 *
 * @see reverse_
 * @example
 * > const myApiPath = '/my_api/:my_key/:id'
 * > const myUrl = reverse(myApiPath, { my_key: 'my_value', id: 123 })
 * > console.log(myUrl)
 * ... '/my_api/my_value/123'
 */
export const reverse = curry(reverse_)


export const reverseAbsolute = (url, kwargs, socket=false, queryParams=null)=>
    liftPath(
        (socket ? SOCKET_URL : SITE_URL),
        reverse(url, kwargs),
        queryParams
    )
