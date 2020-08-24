
const { identity } = require('ramda')


class Io {
    constructor(fn=identity) {
        this.fn = fn
    }

    run() {
        // Lazily call this.fn
        return this.fn()
    }

    map(pred) {
        /**
         * @method map :: Io a => (a => b) => Io b
         * 
         * Create a new IO containing a function that
         * calls the current function (this.fn) and passes
         * the result into `pred`
         */
        return new Io(
            ()=> pred(this.run())
        )
    }

    chain(pred) {
        /**
         * @method chain :: Io a => (a => Io b) => Io b
         * 
         * Create a new Io value from another Io instance
         * Ie. this.run() will get passed into `pred`, which must return an Io.
         * The returned Io has `fn` set to the result of calling `pred(this.run()).run()`
         */
        return new Io(
            ()=> pred(this.run()).run()
        )
    }

    static lift(val) {
        return new Io(
            ()=> identity(val)
        )
    }

    static of(val) {
        return new Io(
            ()=> val
        )
    }
}

module.exports = Io



const ioExample = ()=> {

    const oneEleven = Io.lift(5)
        .map((x)=> x * 2) // Double five === 10
        .map((x)=> x + 1) // 10 + 1 === 11
        .chain(
            (x)=> Io.lift(100).map((y)=> x + y)
        )

    // Nothing gets evaluated until we call 'run()' =D
    return oneEleven.run()
}