import * as R from 'ramda'
import { tryToJson, tryToParse, uuid } from '../utils/common'

const SOCKET_STATES = {
    connecting: 0,
    open: 1,
    closing: 2,
    closed: 3
}


const socketState = {
    isAlive: true,
    isOpen: false,
    isError: false,
    isReconnecting: false,
    interval: 5000,
    _reconnectTimer: null
}

/**
 * @func socketSerializer
 * @param data
 * @returns {{toSocket: (function(): any), fromSocket: (function(): any)}}
 */
const socketSerializer = data => ({
    toSocket: ()=> tryToJson(data),
    fromSocket: ()=> tryToParse(data)
})

/**
 * @typedef {Object} socketContext
 * @property {Object} kwargs - URL/expressPath parameters
 * @property {Object} queryParams - URL query parameters
 */

/**
 * @typedef {Object} socketActions
 * @property {Object} context
 * @property {socketSerializer} serializer
 * @property {function(Object): Object} update
 * @property {function(): *} close
 * @property {function(...*):*} send
 */


/**
 * @typedef {Object} socketPayload
 * Data format used to send & receive info
 * between the client (user) & the websocket server
 * @property {String} action
 * @property {Object} data
 */


/**
 * @typedef {Object} socketObserver
 * @property {function(socketActions, { type: String, data: Object })} next
 * @property {function(Error): *} error
 * @property {function(): *} complete
 */


export class SocketSubject {
    /**
     * @class SocketSubject
     * @param {Object} context
     * @param {function(*):*[]} middleware
     * @param {socketSerializer} serializer
     */
    constructor(context, middleware=null, serializer=socketSerializer) {
        this.ws = null
        this.context = { ...context }
        this.middleware = middleware || null
        this.serializer = serializer
        this.observers = []
        this.state = {...socketState}
        this._isInit = false
        this._isAlive = false
    }

    lift(context) {
        const instance = new this.constructor(
            {...this.context, ...context},
            this.middleware,
            this.serializer
        )
        instance.state = {
            ...instance.state,
            ...this.state
        }
        instance.observers = this.observers
        instance._isInit = this._isInit
        return instance
    }

    init(ws, context, ...args) {
        this.ws = ws
        if (!this._isInit) {
            this._isInit = true
            const instance = this.lift(context)
            // If it wasn't initialized, then we need to
            instance.ws = ws
            if (instance.middleware) {
                instance.middleware.forEach(fn =>
                    fn(instance.ws, { ...instance.context })
                )
            }
            instance.ws.on('open', (...args)=> this.onOpen(...args))
            instance.ws.on('message', (...args)=> this.onMessage(...args))
            instance.ws.on('close', (...args)=> this.onClose(...args))
            instance._isInit = true
            return instance
        }
        return this
    }

    /**
     * @property {socketActions} actions
     * @returns {socketActions}
     */
    get actions() {
        return {
            context: { ...this.context },
            serializer: this.serializer,
            update: context => this.update(context),
            close: () => this.onClose(false),
            send: payload => this.send(payload)
        }
    }

    // Subject methods
    /**
     * @method next - Dispatches to our observers
     * @param {socketPayload} payload
     * @param {WebSocket} ws
     * @returns {SocketSubject}
     */
    next(payload, ws) {
        this.observers.forEach(o => {
            try {
                const actions = {...this.actions, ws}
                o.next(actions, payload)
            } catch(e) {
                o.error(e)
            }
        })
        return this
    }

    /**
     * @method subscribe
     * @param {socketObserver} observer
     * @returns {{
     *      observer: {id},
     *      unsubscribe: (function(): SocketSubject),
     *      id: String
     * }}
     */
    subscribe(observer) {
        const id = uuid()
        const observerWithUuid = { ...observer, id }
        this.observers.push(observerWithUuid)

        return {
            id,
            observer: observerWithUuid,
            unsubscribe: ()=> this.unsubscribe(observerWithUuid)
        }
    }

    unsubscribe(observer, reason=null) {
        const id = observer.id
            ? observer.id
            : observer
        const context = { ...this.context }
        this.observers = this.observers.reduce((list, o) => {
            if (o.id === id
                || o === id
                || o === observer) {
                try {
                    o.complete({ context }, reason, { ...this.state })
                } catch(e) {
                    this.onError(e)
                }
                return list
            }
            return list.concat(o)
        }, [])
        return this
    }

    //-- Websocket methods
    /**
     * @method send - Send data to the user
     * @param {socketPayload} payload
     * @returns {SocketSubject}
     */
    send(payload) {
        const serialized = this.serializer(payload).toSocket()
        if (this.ws.readyState === SOCKET_STATES.open) {
            try {
                this.ws.send(serialized)
            } catch(e) {
                this.onError(e)
            }
        }
        return this
    }

    /**
     * @method receive - Handle 'message' events from the websocket
     * @param message
     * @returns {SocketSubject}
     */
    receive(message) {
        return this.next({
                data: this.serializer(message).fromSocket(),
                type: 'message'
            },
            this.ws
        )
    }

    update(context={}) {
        this.context = R.mergeDeepRight(this.context, context || {})
        this.onUpdate(this.context)
        return {...this.context}
    }

    //-- Events
    onMessage(message) {
        this.receive(message)
    }

    onOpen(...args) {
        this.state = {
            ...this.state,
            isOpen: true
        }

        this.next({
                data: {},
                type: 'open'
            },
            this.ws
        )
    }

    onClose() {
        if (this._isAlive) {
            this.onComplete(null)
        }
    }

    onError(e) {
        this.observers.forEach(o => {
            o.error(e)
        })
    }

    onUpdate(context) {
        this.next({
                data: context,
                type: 'update'
            },
            this.ws
        )
        return this
    }

    onComplete(reason) {
        this._isAlive = false
        this._tearDownObservers()
        this._tearDownSocket()

        this.ws = null
        this.middleware = null
        this.serializer = null
        this.observers = null
        this.state = null
    }

    _tearDownObservers(reason) {
        this.observers.forEach(o => {
            this.unsubscribe(o, reason)
        })
    }

    _tearDownSocket() {
        try {
            this.ws.removeAllListeners()
            this.ws.close()
        } catch (e) {}
    }

}
