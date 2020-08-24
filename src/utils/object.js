import * as R from 'ramda'
import { tryOrIdentity_ } from './error'


export const excludeNullValues = R.compose(
    R.fromPairs,
    R.filter(([k, v]) => !R.isNil(v)),
    R.toPairs
)


export const passiveMerge = R.curry(
    (left, right) =>
        R.mergeDeepRight(
            excludeNullValues(left),
            excludeNullValues(right)
        )
)


export const toPojo = tryOrIdentity_(
    R.compose(JSON.parse, JSON.stringify))

export const tryToJson = tryOrIdentity_(
    x => JSON.stringify(x, null, 4))

export const tryToParse = tryOrIdentity_(
    x => JSON.parse(x))

