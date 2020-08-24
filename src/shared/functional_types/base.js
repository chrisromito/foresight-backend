const R = require('ramda')
const Maybe = require('maybe')


class Container {
    constructor(data) {
        this.data = data
    }

    _Cls() {
        return this.constructor[Symbol.species]
    }

    value() {
        return this.data
    }


    static get [Symbol.species]() {
        /**
         * @static @method get [Symbol.species] - Helper method to distinguish
         * between class instances
         * @returns {this}
         */
        return this
    }
    
    static of(data) {
        /**
         * @static @method of - Create a new Container w/ context
         * @param {Object} data - Data/state for this Container
         * @returns {Container[data]} - A new instance of this Container
         * with the specified context
         */
        const Cls = this[Symbol.species]
        return new Cls(data)
    }

    static lift(data) {
        /**
         * @static @method lift:: (o)=> A[o]
         * Lift 'data' into a Container
         * If it is already a Container, make it a new one (Immutability)
         * Otherwise, return a Container w/ the context
         * @param {(Object | A[Object])} data - Data/state for this Container
         * @returns {A[Object]}
         */
        const Cls = this[Symbol.species]
        const scope =  data instanceof Cls ? data.value() : data
        return Cls.of(scope)
    }

    map(fn=R.identity) {
        /**
         * @method map:: (fn a => a)=> B[a] 
         * Create a new Container, with the context being the
         * current context after applying function `fn` to its data
         * @param {Function} fn - The function to apply to this.data
         * @returns {Container[data]}
         */
        return this._Cls().lift(
            fn(this.value())
        )
    }
}


class BaseFunctor {
    constructor(...values) {
        /**
         * @param  {...any} values - Data/state for this functor
         */
        this._values = values
    }

    static of(...values) {
        /**
         * @static @method of - Create a new functor w/ context
         * @param {...any} values - Data/state for this functor
         * @returns {BaseFunctor[...values]} - A new instance of this functor
         * with the specified context
         */
        const Cls = this[Symbol.species]
        return new Cls(...values)
    }

    static lift(...values) {
        /**
         * @static @method lift:: (...v)=> A[...v]
         * Lift '...values' into a BaseFunctor
         * If it is already a functor, make it a new one (Immutability)
         * Otherwise, return a functor w/ the context
         * @param {(...any | A[...any])} values - Data/state for this functor
         * @returns {A[...values]}
         */
        // const Cls = this.constructor[Symbol.species]
        const Cls = this[Symbol.species]
        const scope =  values instanceof Cls ? values.value() : values
        return Cls.of(scope)
    }

    static get [Symbol.species]() {
        /**
         * @static @method get [Symbol.species] - Helper method to distinguish
         * between class instances
         * @returns {this}
         */
        return this
    }

    _Cls() {
        return this.constructor[Symbol.species]
    }

    value() {
        return this._values
    }

    map(fn=R.identity) {
        /**
         * @method map:: (fn a => a)=> B[...a] 
         * Create a new functor, with the context
         * being the current context after applying function `fn` to each value
         * @param {Function} fn - The function to apply to this.values
         * @returns {BaseFunctor[...values]}
         */
        const Cls = this._Cls()
        return new Cls(...this.value().map(fn))
    }
}


class BaseApplicative extends BaseFunctor {
    flatMap(fn=R.identity) {
        const Cls = this._Cls()
        // Flatten the result array & apply `fn` to all values
        const result = [].concat.apply([], this.value().map(
            R.ifElse(
                (v)=> v instanceof Cls,
                (v)=> v.value().map(fn),
                (v)=> fn(v)
            )
        ))

        return Cls.of(...result)
    }
}


module.exports = {
    Container,
    BaseFunctor,
    BaseApplicative
}