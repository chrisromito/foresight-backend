import * as R from 'ramda'


/**
 * @func reduceCountList - Reduce a list of PageViews into a list of Counts, ultimately
 * receiving the popularity scores formatted as an Array of Any Types (likely mixed Strings and Numbers)
 * @param {Count[]} countList
 * @param {Object[]} pageViews
 * @returns {*[]}
 */
export const reduceCountList = (countList, pageViews)=>
    pageViews.reduce(countReducer, countList)
        .map(accumulator =>
            accumulator
                .asFrequencyTuple()
                .toList()
                .value()
        )


export const countReducer = (counts, pageView)=> counts.map(count => count.count(pageView))


const emptyMap_ = new Map()


const copyMap = map => new Map(map)


/**
 * @func countMapReducer - Reduce an Object of [k, Count<Empty>] pairs into a new
 * Object of [k, frequencyTuple] pairs based on the data in `list`
 * @param {Object} countMap
 * @param {Object[]} list
 * @returns {Object<frequencyTuple>}
 */
// Pass each item in the list to each 'Count'.  This will return a new 'Count'
// We reduce so we end up with a list of [key, count] pairs, which we rebuild back into an Object
const countMapReducer = countMap =>
    R.compose(
        R.fromPairs,
        R.map(([k, v])=>
            ([
                k,
                v.asFrequencyTuple().toList().value()
            ])
        ),
        list => list.reduce(
            countPairReducer,
            Object.entries(countMap)
        ),
        R.toPairs
    )


const countPairReducer = (countPairs, item) =>
    countPairs.map(([k, v]) => ([
        k,
        v.count(item)
    ]))



/**
 * @func Count - Uses getters, setters, and an accumulator
 * to count instances of a given value
 * Useful for incrementally finding how many times given values
 * show up in a given dataset
 * 
 * @param {Function} getter - Determines how the key is retrieved from a PageView
 * @param {Function} setter - Determines how values are stored in the accumulator
 * @param {(Map|Array)} accum - The accumulator.  Holds on to the 'state' of this value
 */
export const Count = (getter, setter=(x => x + 1), accum=emptyMap_)=> ({
    isCount: true,

    value: ()=> accum,

    chain: fn => Count(getter, setter, fn(accum).value()),
    map: fn => Count(getter, setter, fn(accum)),

    /**
     * @method add - Add `num` to the current value.
     * @param {Number} num - Value to add to the accumulated value.  1 is used instead of `num` if `num` is falsey
     * @param {Countable} countable
     * @returns {Count[getter, setter, Map]}
     */
    add: (num, countable)=>
        Count(getter, current => current + (num || 1), accum)
            .count(countable),

    /**
     * @method count - Increment the value
     * @param {Countable} countable
     * @returns {Count[getter, setter, Map]}
     */
    count: countable => {
        const key = R.tryCatch(
            R.pipe(getter, String),
            R.always(null)
        )(countable)

        if (likeNullOrUndefined(key)) {
            return Count(getter, setter, accum)
        }

        const current = accum.get(key) || 0
        const copy = copyMap(accum)
        copy.set(key, setter(current, key, countable))
        return Count(getter, setter, copy)
    },

    toList: ()=>
        Count(getter, setter,
            Array.isArray(accum)
                ? accum
                : Array.from(accum.entries())
                    .map(args => R.flatten(args))
        ),

    asFrequencyTuple: ()=> {
        const entries = Array.from(accum.entries())
        const totalCount = entries.reduce((sum, [_, count])=> sum + count, 0)
        const accumulator = new Map()
        entries.forEach(([key, count])=> {
            if (!likeNullOrUndefined(key)) {
                accumulator.set(key, [
                    count,
                    count / totalCount
                ])
            }
        })
        return Count(getter, setter, accumulator)
    },

})

