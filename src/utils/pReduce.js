/**
 * @module pReduce - Reduce a list of Promises into a single value
 * Works like Array.prototype.reduce, for the most part
 * 
 * @example
 * const randomIntBetween = (min, max)=> Math.floor(Math.random() * (max - min)) + min
 * 
 * const logThunk = (index)=> ()=> new Promise((resolve)=> setTimeout(()=> {
 *     console.log(`Function index: ${index}`)
 *     resolve(index)
 * }, randomIntBetween(10, 1000))) 
 * 
 * 
 * const thunks = [
 *     logThunk(10),
 *     logThunk(11),
 *     logThunk(12),
 *     logThunk(13)
 * ]
 * 
 * 
 * const sumThunk = (index)=> (num)=> new Promise((resolve)=> setTimeout(()=> {
 *     console.log(`Function index: ${index}`)
 *     console.log(`old num: ${num}`)
 *     console.log(`New num: ${index + num}`)
 *     resolve(index + num)
 * }, randomIntBetween(10, 1000)))
 * 
 *
 * const sumThunks = [
 *     sumThunk(0),
 *     sumThunk(1),
 *     sumThunk(2),
 *     sumThunk(3)
 * ]
 * pReduce(sumThunks, 0).then(console.log)
 * // => 6
 *
 */
import * as R from 'ramda'


export const pReducer = (prev, fn)=>
    prev.then(accum =>
        R.tryCatch(
            R.pipe(
                fn,
                R.andThen
            ),
            R.always(accum)
        )(accum)
    )

export const pReduce = (fns, startValue)=> fns.reduce(pReducer, Promise.resolve(startValue))



export const promiseReducer = async (reducer, startValue, list)=> {
    let accum = startValue
    const length = list.length
    for (let i = 0; i < length; i++) {
        const item = list[i]
        accum = await reducer(accum, item, i, list)
    }
    return accum
}

