import * as R from 'ramda'
import {
    ASSOCIATE,
    ASSOCIATE_MODULE,
    extendModel,
    SQL,
    QUERY,
    VALUES
} from 'models/base'
import { assocStatValue } from 'models/stats/shared'
import { pMap } from 'utils/pMap'
import { dateBetween } from 'models/shared/date_filter'


/**
 * @typedef {Object} pageViewUserStat
 * @property {Number} id
 * @property {Number} page_id - The page that the values are scoped to
 * @property {Number} stat_value_id - Determines the scope of the
 * timeframe that the statistic values correspond w/.
 * Ex. if the stat_value.stat_type.name = 'hour' & stat_value.value = 8,
 * then the unique_count, total_count, bounce_count, etc. would be the
 * # of each value that occurred at 8 A.M.
 * The day that those values are scoped to is determined by the `created` field
 * @property {Number} unique_count - Total # of unique users
 * @property {Number} total_count - Total # of users
 * @property {Number} bounce_count - Total # of bounce Page Views
 * @property {Date} created
 */

export const PageViewUserStat = extendModel('page_view_user_stat',
    model => ({
        assocStatValue,
        assocUser: ()=>
            ASSOCIATE_MODULE`
                - user ${{
                    key: 'user_id'                
                }}
            `,
        assocPage: ()=>
            ASSOCIATE_MODULE`
                - page ${{
                    key: 'page_id'
                }}
            `,
        forDateRange: (min, max)=>
            QUERY`
                SELECT *
                    FROM page_view_user_stat
                    ${dateBetween('created')(min, max)}
            `
    })
)
