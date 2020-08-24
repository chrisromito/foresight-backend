import { identity } from 'ramda'
import {
    ASSOCIATE,
    ASSOCIATE_MODULE,
    extendModel,
    SQL,
    QUERY
} from '../base'
import { getOrCreateForPair } from './goal_maps'

/**
 * @typedef {Object} goal
 * @property {Number} id
 * @property {Number} client_id
 * @property {Date|null} start_date
 * @property {Date|null} end_date
 * @property {Boolean} is_success
 * @property {Boolean} started
 * @property {Boolean} ended
 */
export const Goal = extendModel('goal',
    model => ({
        assocForClient: client_id =>
            ASSOCIATE_MODULE`
                - goal ${SQL`WHERE client_id = ${client_id}`}
            `
    })
)

export default Goal


/**
 * @typedef {Object} goalType
 * @property {Number} id
 * @property {Number} tag_type_id - The tag type ID that will be used to grab tags
 * associated w/ a given goal
 * @property {Number} stat_type_id - The type of statistics that this Goal will be
 * represented by.  Ie. Does it have to do with values calculated on a daily basis,
 * hourly basis, day-of-the week, etc?
 * @property {String} name
 * @property {String} description
 * @property {Number} scope
 * @property {Date} created
 */
export const GoalType = extendModel('goal_type',
    model => ({
        getOrCreateForPair: (goal_id, goal_type_id)=>
            goalTypeMap.getOrCreateForPair(goal_id, goal_type_id),

        assoc: () =>
            ASSOCIATE_MODULE`
                x goal_types ${{
                    left_key: 'id',
                    left_xkey: 'goal_id',
                    xtable: 'goal_type_goal',
                    xkey: 'goal_type_id',
                    key: 'id'
                }}
            `,

        assocWithFks: ()=>
            ASSOCIATE_MODULE`
                ${GoalType.assoc}
                    ${GoalType.assocTagType}
                    ${GoalType.assocStatType}
            `,

        assocTagType: ()=>
            ASSOCIATE_MODULE`
                - tag_type ${{
                    left_key: 'id',
                    key: 'tag_type_id',
                    table: 'tag_type'
                }}
            `,

        assocStatType: () =>
            ASSOCIATE_MODULE`
                - stat_type ${{
                    left_key: 'id',
                    key: 'stat_type_id',
                    table: 'stat_type'
                }}
            `
    })
)


const goalTypeMap = extendModel('goal_type_goal', m => ({
        getOrCreateForPair: getOrCreateForPair(m)('goal_type_id')
    })
)
