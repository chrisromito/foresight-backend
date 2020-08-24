/**
 * @module action - Models for Actions.
 * 
 * Actions are records of application interaction (user-to-application
 * or application-to-application) chained into sequential events
 * 
 * Action Paths tie Actions together to create a graph-like structure that
 * facilitates a hierachical, sequential relationship between those Actions
 * so end-users can make sense of the individual actions at a high-level
 */
import * as R from 'ramda'
import { promiseReducer } from '../../utils/pReduce'
import {
    ASSOCIATE_MODULE,
    EQ,
    QUERY,
    Model,
    extendModel
} from '../base'
import { PageView } from './page_view'
import { getPath as _getPath} from './utils'
import { ActionTypes } from '../constants'
import { ActionType } from './action_type'


const validateActionType = ({ action_type_id })=>
    R.values(ActionTypes).includes(action_type_id)
        ? true
        : ({
            type: `Invalid action type
                Valid options include: ${R.values(ActionTypes)}
                But received ${type} instead.
            `
        })


const validateAction = action => {
    const validators = [
        validateActionType
    ]
    const validationResults = validators.reduce(
        (invalid, fn)=> (
            fn(action)
                ? invalid
                : invalid.concat({
                    ...fn(action)  
                })
        ),
        []
    )
    return validationResults.length
        ? Promise.reject(validationResults)
        : Promise.resolve(action)
}


/**
 * @typedef {Object} action Interaction with the application
 * @property {Number} id
 * @property {Number} action_id
 * @property {String} path - Path in the 'graph' sense, not URL path
 * This lets us quickly sort, search, filter etc. actions
 * in aggregates/queries, and arrange graph nodes starting from any point
 * @property {Number} action_type_id - Action type FK
 * @property {(Object|null)} meta_data 
 */
const Action_ = ()=> {
    const name = 'action'
    const model = Model(name)
    const separator = '-'
    return {
        ...model,
        model,
        separator,
        actionTypes: ActionTypes,
        assocActionType: () =>
            ASSOCIATE_MODULE`
                - to_action ${{
                    left_key: 'action_type_id',
                    key: 'id',
                    table: 'action_type'
                }}
            `,
    }
}


export const Action = Action_()


/**
 * @typedef {Object} actionPath Connector for >= 1 action
 * actionPaths connect actions.  This allows us to treat actions
 * as nodes in a graph
 * 
 * @property {Number} id
 * @property {(Number|null)} page_view_path_id
 * @property {(Number|null)} parent_id
 * @property {(Number|null)} from_action_id - Null for the first action in a sequence
 * @property {Number} to_action_id - The target action in a sequence
 * @property {String} path - Path in the 'graph' sense, not URL path
 * This lets us quickly sort, search, filter etc. actions.
 *      Path format: {parentPath},t{action_type_id},i{index}
 * @property {Number} index
 * @property {Number} depth
 * @property {Date} created
 * @property {Date} updated
 * @property {(Object|null)} meta_data 
 */

const ActionPath_ = ()=> {
    const name = 'action_path'
    const model = Model(name)
    const separator = ','
    const getPath = _getPath(separator)

    return {
        ...model,
        model,
        getPath,

        /**
         * @method assocActions - Use as a partial argument
         * to an ASSOCIATE() instance
         * @example
         * > // Get action paths + actions for page_view_path_id 123
         * > const myActionPathsWithActions = await ActionPath.meta.ASSOCIATE`
         *      - action_path ${SQL`WHERE page_view_path_id = 123`}
         *         ${ActionPath.assocActions}
         * `
         * > const firstAp = myActionPathsWithActions[0]
         * > const fromAction = firstAp._.from_action
         * > const toAction = firstAp._.to_action
         * > assert fromAction.id === firstAp.from_action_id
         * > assert toAction.id === firstAp.to_action_id
         */
        assocActions: ()=>
            ASSOCIATE_MODULE`
                - to_action ${{
                    left_key: 'to_action_id',
                    key: 'id',
                    table: 'action'
                }}
                - from_action ${{
                    left_key: 'from_action_id',
                    key: 'id',
                    table: 'action'
                }}
            `,

        /**
         * @method assocPageViewPaths - Use as a partial arg
         * to an ASSOCIATE() instance on Page View Paths
         * @example
         * > const myPageViewPaths = await PageViewPath.meta.ASSOCIATE`
         *      - page_view_path ${SQL`WHERE id = 123`}
         *          ${ActionPath.assocPageViewPaths}
         *              ${ActionPath.assocActions}
         * `
         */
        assocPageViewPaths: ()=>
            ASSOCIATE_MODULE`
                < action_path ${{
                    left_key: 'page_view_path_id',
                    key: 'id',
                    table: 'action_path'
                }}
            `,

        /**
         * @method insert - Insert a ActionPath record
         * If parent_id is included, we attempt to pull in the parent's
         * data as outlined above
         * The `...data` spread operator allows you to override this
         * logic at any point w/ minimal consequences
         * @param {{
         *      parent_id: (Number|null),
         *      to_action_id: Number,
         *      page_view_path_id: (Number|null)
         *      ...data: *
         * }} fields - Fields for the ActionPath record
         * @returns {Promise<actionPath>}
         */
        insert: ({ parent_id, to_action_id, ...data })=>
            // Get the parent (if possible) && the target action
            Promise.all([
                model.getById(parent_id),
                Action.getById(to_action_id)
            ])
            .then(([parent, toAction]) => {
                // Build out fields that extend the parent
                const depth = parent ? parent.depth + 1 : 0
                const index = parent ? parent.index + 1 : 0
                const from_action_id = parent ? parent.to_action_id : null
                const parentPath = parent
                    ? `${parent.path}`
                    : null
                const path = getPath([`t${toAction.action_type_id}`, `i${index}`])(parentPath)
                return model.insert({
                    ...data,
                    parent_id,
                    from_action_id,
                    to_action_id,
                    path,
                    index,
                    depth,
                })
            }),

        insertWithAction: ({ action, ...data })=> {
              return Action.insert(action)
                .then(({ id })=>
                    ActionPath.insert({
                        to_action_id: id,
                        ...data
                    })
                )
        },

        chain: data => {
            const method = R.has('action', data)
                ? ActionPath.insertWithAction
                : ActionPath.insert

            return method(data)
                .then(actionPath =>
                    ({
                        data: actionPath,
                        chain: child => ActionPath.chain({ parent_id: actionPath.id, ...child })
                    })
                )
        },

        mapSequence: dataList => {
            if (!dataList.length) {
                return Promise.resolve([])
            }
            return promiseReducer(
                ({ idList, chain }, item)=>
                    chain(item)
                        .then(next =>
                            ({
                                idList: idList.accum(next.data.id),
                                chain: next.chain
                            })
                        ),
                {
                    idList: [],
                    chain: ActionPath.chain
                },
                dataList
            )
        },

        lift: (...args)=> liftActionPath(...args)
    }
}

export const ActionPath = ActionPath_()


/**
 * @function liftActionPath - Helper method to make Actions
 * easier to interact with (does some lookups for you).
 *
 * We just need the page_view_path_id that the ActionPath is
 * associated with, and the "target" action.  This automagically
 * fetches the parent_id and what not to help reduce errors with respect
 * to maintaining the Action hierarchy.
 * @param page_view_path_id
 * @param action
 * @param data
 * @returns {Promise<Object>}
 */
export const liftActionPath = ({ page_view_path_id, action, ...data })=> {
    const hasParentId = R.has('parent_id', data)
    const parentId = hasParentId
        ? Promise.resolve(data.parent_id)
        : mostRecentActionPathIdForPvp(page_view_path_id)
    return parentId.then(parent_id =>
        ActionPath.insert({
            parent_id,
            to_action_id: action.id,
            ...data
        })
    )
}


/**
 * @function mostRecentActionPathIdForPvp - Get the most recent ActionPath record
 * for the given page_view_path
 * @param {Number} page_view_path_id
 * @returns {Promise<Number|null>}
 */
const mostRecentActionPathIdForPvp = page_view_path_id =>
    QUERY`
        SELECT id
            FROM action_path
            WHERE ${EQ({ page_view_path_id })}
            ORDER BY id DESC
            LIMIT(1)
    `.then(
        actionPaths =>
            actionPaths.length
                ? R.prop('id', R.head(actionPaths))
                : null
    )
