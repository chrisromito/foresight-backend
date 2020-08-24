import * as R from 'ramda'
import { tryToJson } from './object'


export const tryOrIdentity_ = fn => arg => R.tryCatch(fn, () => arg)(arg)

export const prettyPrint = o => {
    const value = tryToJson(o)
    console.log(value)
    return o
}


export const prettyMessage = msg => o => {
    console.log(msg)
    return prettyPrint(o)
}
