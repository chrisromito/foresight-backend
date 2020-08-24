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
 * @typedef {Object} pageViewStat
 * @property {Number} id
 * @property {Number} page_id - FK -> page table
 * @property {Number} client_id - FK -> client table.  This helps us
 * avoid having to do a join clause on every page when we want to query
 * by client (and aggregate/group on Page)
 * @property {Date} created - Date that this was created
 */
export const PageViewStat = extendModel('page_view_stat',
    model => ({
        forDateRange: (min, max)=> {
            const sql = dateBetween('created')(min, max)
            return QUERY`
                SELECT *
                    FROM page_view_stat
                    ${sql}
            `
        },

        assocTotal: ()=>
            ASSOCIATE_MODULE`
                < page_view_total ${{
                    key: 'page_view_stat_id'
                }}
            `
    })
)


/**
 * @typedef {Object} pageViewTotal
 * @property {Number} id
 * @property {Number} stat_value_id - FK -> stat_value table
 * @property {Number} stat_count - Total # of page views
 * @property {Number} entry_count - Total # of page views where
 * this page was FIRST in the page_view_path sequence
 * @property {Number} exit_count - Total # of page views where
 * this page was LAST in the page_view_path sequence
 */

export const PageViewTotal = extendModel('page_view_total',
    model => ({
        assocStatValue
    })
)


export const PageViewTotalAction = extendModel('page_view_total_action',
    model => ({
        mapAction: page_view_total_id => actionMap => {
            const { action_id, stat_count } = actionMap
            return model.insert({ action_id, stat_count, page_view_total_id })
                .catch(e =>
                    model.updateWhere({ action_id, page_view_total_id }, { stat_count })
                        .then(R.head)
                        .catch(()=> Promise.reject(e))
                )
                .catch(e => model.errorHandler(e))
        },

        mapMany: page_view_total_id => actionMaps =>
            pMap( model.mapAction(page_view_total_id) )(actionMaps)
                .catch(e => model.errorHandler(e)),

        assocTotalAction: () =>
            ASSOCIATE_MODULE`
                < page_view_total_action ${{
                    key: 'page_view_total_id'
                }}
            `
    })
)


export const PageViewTotalTag = extendModel('page_view_total_tag',
    model => ({
        mapTag: page_view_total_id => tagMap => {
            const { tag_id, stat_count } = tagMap
            return model.insert({ tag_id, stat_count, page_view_total_id })
                .catch(e =>
                    model.updateWhere({ tag_id, page_view_total_id }, { stat_count })
                        .then(R.head)
                        .catch(() => Promise.reject(e))
                )
                .catch(e => model.errorHandler(e))
        },

        mapMany: page_view_total_id => tagMaps =>
            pMap( model.mapTag(page_view_total_id) )(tagMaps)
                .catch(e => model.errorHandler(e)),

        assocTotalTag: () =>
            ASSOCIATE_MODULE`
                < page_view_total_tag ${{
                    key: 'page_view_total_id'
                }}
            `
    })
)
