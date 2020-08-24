import { liftUrl, pathIsMatch } from './router_utils'
import { SocketSubject } from './socket_subject'

/**
 * @typedef {import('./socket_subject').SocketSubject} SocketSubject
 */


/**
 * @typedef {{
 *      isMatch: pathIsMatch<String>,
 *      expressPath: String,
 *      socketSubject: SocketSubject
 * }} pathMap
 */


/**
 * @class SocketRouter
 * @property {String} path
 * @property {Map} pathSubscribers
 * @property {*} middleware
 * @property {SocketSubjectAdapter} _adapter
 */
export class SocketRouter {
    constructor(path = '/', { middleware = [], adapter=null, socketSubject=SocketSubject }) {
        this.path = stripDoubleSlashes(path)
        this.pathSubscribers = new Map()
        this.middleware = middleware
        this.socketSubject = socketSubject
        this._adapter = adapter || SocketSubjectAdapter
    }

    get adapter() {
        return this._adapter(this)
    }

    /**
     * @method ws - Register a WS route & callback
     * @param {String} path
     * @param {socketObserver} socketObserver
     */
    ws(path, socketObserver) {
        const isMatch = pathIsMatch(path)
        this.pathSubscribers.set(path, {
            isMatch,
            socketObserver,
            expressPath: path
        })
    }

    //-- Server methods (proxy'd via the adapter)
    /**
     * @method lookUp - Check if we have a callback that matches
     * the request path
     * If a match is found, we delegate to `this.initSubscriber`
     * to handle the actual match
     *
     * This is designed to allow you to swap out this adapter with
     * something else, without completely rewriting the whole damn
     * thing yourself.  L(°O°L)
     *
     * @param {String} requestUrl
     * @param {WebSocket} ws
     * @param {import('http').IncomingMessage} request
     * @returns {null}
     */
    lookUp(requestUrl, ws, request) {
        return this._adapter(this).lookUp(requestUrl, ws, request)
    }

    /**
     * @method initSubscriber - Delegate to the adapter's
     * `initSubscriber` method, which we assume will call
     * the `init` method on the respective subscriber
     *
     * NOTE: If you want to change how that's done, or completely replace that
     * logic, you probably want to do that on the adapter level,
     * and not on the router level.
     * @param args
     * @returns {*}
     */
    initSubscriber(...args) {
        return this._adapter(this).initSubscriber(...args)
    }
}


const SocketSubjectAdapter = router => ({
    value: ()=> router,
    lookUp: (requestUrl, ws, request)=> {
        const pathSubscribers = router.pathSubscribers
        for (const pathMap of pathSubscribers.values()) {
            const { isMatch, expressPath, socketObserver } = pathMap
            if (isMatch && isMatch(requestUrl)) {
                return router.initSubscriber(
                    pathMap,
                    {
                        request,
                        ws,
                        context: liftUrl(requestUrl, expressPath),
                    }
                )
            }
        }
        return null
    },

    initSubscriber: ({ socketObserver }, { request, ws, context }) => {
        const subject = new router.socketSubject(context, router.middleware)
        subject.subscribe(socketObserver)
        return subject.init(ws, context)
    }
})


export default SocketRouter


const stripDoubleSlashes = path =>
    !path.includes('//')
        ? path
        : stripDoubleSlashes(path.replace('//', '/'))
