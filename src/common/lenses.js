import * as R from 'ramda'
/**
 * Lenses
 */
export const idLens = R.lensPath(['_id'])
export const createdLens = R.lensPath(['created'])
export const parentLens = R.lensPath(['parent'])


// Actions
export const actionBreadCrumbsLens = R.lensPath(['breadCrumbs'])
export const actionTargetLens = R.lensPath(['target'])
export const actionIdLens = R.compose(actionTargetLens, R.lensPath(['id']))
export const actionNameLens = R.compose(actionTargetLens, R.lensPath(['name']))
export const actionDataLens = R.compose(actionTargetLens, R.lensPath(['data']))
export const actionTypeLens = R.lensPath(['actionType'])


// Users
export const userIdLens = R.lensPath(['userId'])
export const accountIdLens = R.lensPath(['accountId'])
export const userSessionLens = R.lensPath(['userSession'])

