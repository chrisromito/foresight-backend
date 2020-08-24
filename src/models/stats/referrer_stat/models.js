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
 * @typedef {Object} referrerStat
 * @property {Number} id
 * @property {Number} referrer_id - The referrer that was responsible for the Page Views
 * that the statistic values are scoped to
 * @property {Number} stat_value_id - Determines the scope of the timeframe that the statistic
 * values correspond w/.
 * Ex. if the stat_value.stat_type.name = 'hour' & stat_value.value = 8,
 * then the unique_count, total_count, bounce_count, etc. would be the
 * # of each value that occurred at 8 A.M.
 * The day that those values are scoped to is determined by the `created` field
 * @property {Number} client_id - The client that the Page Views are associated w/
 * @property {Number} unique_count - Total # of unique users
 * @property {Number} total_count - Total # of users
 * @property {Number} bounce_count - Total # of bounce Page Views associated w/ this referrer
 * @property {Date} created
 */

export const ReferrerStat = extendModel('referrer_stat',
    model => ({
        assocStatValue,
        assocClient: ()=>
            ASSOCIATE_MODULE`
                - client ${{
                    left_key: 'client_id'
                }}
            `,
        assocReferrer: ()=>
            ASSOCIATE_MODULE`
                - referrer ${{
                    left_key: 'referrer_id'
                }}
            `,
    })
)
