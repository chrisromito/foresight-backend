import * as R from 'ramda'
import moment from 'moment'
import { ASSOCIATE_MODULE, extendModel, QUERY } from '../base'
import { StatTypes } from '../constants'

/**
 * @typedef statType - A way to denote how an aggregate
 * was performed.  Essentially a 'lens' for statistics.
 * This is primarily used to denormalize aggregate queries
 * for a daily cron-job, and retrospectively piece them together
 * from a higher-level.
 * @property {Number} id
 * @property {String} name
 * @property {String} description
 * @property {Number} sort_order
 */
export const StatType = extendModel('stat_type',
    model => ({
        statTypes: StatTypes,
        assocStatType: ()=>
            ASSOCIATE_MODULE`
                - stat_type ${{
                    left_key: 'stat_type_id',
                    key: 'id',
                    table: model.tableName
                }}
            `
    })
)


/**
 * @typedef {Object} statValue - A representation of a value
 * obtained from an aggregate.  If {statType} is a 'lens' for statistics,
 * then this is the value that you see when you look through the lens.
 * Example: If the stat_type is for days of the week, we would have stat_values
 * that look something like:
 * @example
 * > const daysOfTheWeek = [
 * ...  { id: 1, name: 'Sunday', value: 0, stat_type_id: 3, meta_data: null },
 * ...  { id: 2, name: 'Monday', value: 1, stat_type_id: 3, meta_data: null }
 * ...  // Etc, etc.
 * ...]
 * @property {Number} id
 * @property {Number} stat_type_id - FK to stat_type {statType}
 * @property {Number} value - The value of type {statType}
 * @property {String} name
 * @property {Object|null} meta_data - Other data useful for this specific
 * value.  This helps us store data that we want to use everywhere for a specific
 * value, that we can't quite express with {stat_type_id} & {value} alone
 * For example, if we want to have different date formats, or it turns out that
 * we need to have a compound value to use it some ML model, then we can dump it here
 */
export const StatValue = extendModel('stat_value',
    model => ({
        statTypes: StatTypes,
        assocStatType: StatType.assocStatType,
        assocStatValue: ()=>
            ASSOCIATE_MODULE`
                - stat_value ${{
                    left_key: 'stat_value_id',
                    key: 'id',
                    table: 'stat_value'
                }}
            `,

        /**
         * @func forDate - Get the StatValue for a specific date
         * @param {Date|String} d
         * @returns {Promise<statValue>}
         */
        forDate: async d => {
            const value = await getDateTrunc(d)
            const fields = { ...value, stat_type_id: StatTypes.date }
            return await model.getOrCreate(fields, fields)
        },

        forToday: async () => {
            const value = await getTodayDateTrunc()
            const fields = { ...value, stat_type_id: StatTypes.date }
            return await model.getOrCreate(fields, fields)
        }
    })
)


const getTodayDateTrunc = ()=>
    QUERY`
        SELECT
            EXTRACT(
               EPOCH FROM CURRENT_DATE
            ) as value,
            CURRENT_TIMESTAMP as name
                 
    `.then(
        R.pipe(
            R.head
        )
    )


const getDateTrunc = d =>
    QUERY`
        SELECT CURRENT_TIMESTAMP as name
    `.then(
        R.pipe(
            R.head,
            ({ name })=> ({
                name,
                value: Number(moment(d).toDate())
            })
        )
    )


export const assocStatValue = () => StatValue.assocStatValue()


/**
 * @func getHourlyStatValues - Utility function for getting hourly StatValues
 * so you don't have to import StatTypes everywhere
 * @returns {Promise<statValue[]>}
 */
export const getHourlyStatValues = ()=>
    StatValue.selectWhere({ stat_type_id: StatTypes.hour })

