/**
 * @module future_promise_interop - Provides interoperability between Promises & Futures (ramda-fantasy)
 */
import { Future } from 'ramda-fantasy'


// Checks
export const isPromise = (x)=> typeof x.then === 'function'

export const isFuture = (x)=> x['@@type'] === 'ramda-fantasy/Future'


// Type Swapping
export const fToPromise = (future)=> new Promise((res, rej)=> future.fork(rej, res))

export const pToFuture = (promise)=> Future((reject, resolve)=> promise.then(resolve).catch(reject))


// Type Casting/Enforcement
export const castToPromise = (x)=> isFuture(x) ? fToPromise(x) : x

export const castToFuture = (x)=> isPromise(x) ? pToFuture(x) : x
