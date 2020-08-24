const brain = require('./brain.js.js')
const R = require('ramda')

class BaseType {
    constructor(data, context) {
        this._data = data
        this._context = {...context}
    }

    static get [Symbol.species]() {
        /**
         * @static @method get [Symbol.species] - Helper method to distinguish
         * between class instances
         * @returns {this}
         */
        return this
    }

    value() {
        return {
            data: this._data,
            context: this._context
        }
    }

    args() {
        return [this._data, this._context]
    }

    of() {
        /**
         * @method of - Creates a new BaseType instance
         * with the same values as this instance
         * @returns {BaseType}
         */
        const cls = this.constructor[Symbol.species]
        const args = Object.values(this.value())
        return new cls(...args)
    }

    ap(fn) {
        /**
         * @method ap - Applies function `fn` to the current value,
         * and returns the transformed value
         * @sig BaseType[a, b] :: fn ( ( a, b )-> c ) -> c
         * @param {Function} fn - A 2-arity function
         * @returns {*}
         */
        return fn(...this.args())
    }

    map(fn) {
        /**
         * @method map - Passes data & context to `fn` & wraps in a new NetworkState
         * @sig BaseType[a, b] :: fn ( ( a, b )-> c ) -> BaseType[c]
         * @param {Function} fn - A 2-arity function
         * @returns {BaseType[a, b]}
         */
        const cls = this.constructor[Symbol.species]
        return new cls(
            fn(...this.args())
        )
    }

    data() {
        return this.value().data
    }

    context() {
        return this.value().context
    }

    mapData(fn) {
        const cls = this.constructor[Symbol.species]
        return new cls(
            fn(...this.args()),
            this.context()
        )
    }

    mapContext(fn) {
        // Deconstruct, apply fn, reconstruct
        const cls = this.constructor[Symbol.species]
        const newContext = R.mergeDeepRight(
            this.context(),
            fn(...this.args())
        )

        return new cls(
            this.data(),
            newContext
        )
    }
}


/**
 * @class DataState - Generic representation of the state of the data within
 * different parts of our Network chain.
 */
class DataState extends BaseType {
    constructor(...args) {
        super(...args)
        this['@@type'] = 'neural.page_view.DataState'
    }
}


/**
 * @class NetworkState - Generic representation of the state of our Neural Network
 */
class NetworkState extends BaseType {
    constructor(...args) {
        super(...args)
        this['@@type'] = 'neural.page_view.NetworkState'
    }

    static brain() {
        return brain
    }

    network(obj=false) {
        const config = this.config(obj || {})
        return new brain.recurrent.RNNTimeStep(config)
    }

    config(obj) {
        obj = obj || {}
        return {
            log: true,
            inputSize: 5,
            outputSize: 3,
            ...obj
        }
    }

    apNeuralStep(network=false, configObj=false) {
        const net = network || this.network(configObj)
        const memory = this.data() && this.data().meta
            ? JSON.parse(this.data().meta)
            : null 
        const timeJump = memory
            ? net.fromJSON(memory)
            : net
        return timeJump
    }


    runnable() {
        try {
            return !this.data().state.running
        }
        catch(err) {
            return false
        }
    }

    train(fn) {
        const startSession = Date.now()
        const withDate = this.mapContext(()=> ({ startSession }))
        const memory = this.data() && this.data().meta
            ? JSON.parse(this.data().meta)
            : null
        const network = memory
            ? this.network().fromJSON(memory)
            : this.network()

        return new Promise((resolve, reject)=>
            fn(network, ...this.args())
                .then((trainedNetwork)=>
                    withDate.mapData(()=> trainedNetwork)
                        .mapContext(()=> ({ endSession: Date.now()}))
                )
                .then(resolve)
                .catch(reject)
        )
    }

}






module.exports = {
    BaseType,
    DataState,
    NetworkState
}
