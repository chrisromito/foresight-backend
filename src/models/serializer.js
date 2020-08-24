import * as R from 'ramda'
import { toPojo } from 'utils/common'


const tryOrIdentity = fn => value =>
    R.tryCatch(
        fn,
        R.always(value)
    )(value)


const relationProp = R.prop('_')


const hasRelationProp = R.prop('_')

/**
 * @func mergeRelationProp - Recursively lift any '_' properties
 * into their parent object.
 * @param {Object} o - Object that may or may not contain a '_' property
 * @returns {Object}
 * @type {function(*=): any}
 */
const mergeRelationProp = tryOrIdentity(
    o => R.pipe(
        relationProp,
        relation => liftRelation(relation),
        R.mergeDeepLeft(o),
        R.dissoc('_')
    )
)


const liftRelation = R.ifElse(
    hasRelationProp,
    mergeRelationProp,
    R.identity
)


export const serializer = R.compose(
    toPojo,
    R.ifElse(
        Array.isArray,
        R.map(liftRelation),
        liftRelation
    )
)


export default serializer
