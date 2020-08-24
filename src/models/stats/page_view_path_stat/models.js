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
 * @typedef {Object} pageViewPathStat
 * @property {Number} id
 * @property {Number} stat_value_id
 * @property {Number|null} from_page_id
 * @property {Number} to_page_id
 * @property {Number} index
 * @property {String} path
 * @property {Number} stat_count
 * @property {Date} created
 */

export const PageViewPathStat = extendModel('page_view_path_stat',
    model => ({
        assocStatValue,
        forDateRange: (min, max) => {
            const sql = dateBetween('created')(min, max)
            return QUERY`
                SELECT *
                    FROM page_view_path_stat
                    ${sql}
            `
        },
        assocActionStat: ()=>
            ASSOCIATE_MODULE`
                < page_view_path_stat_action ${{
                    key: 'page_view_path_stat_id'
                }}
            `,
        assocTagStat: ()=>
            ASSOCIATE_MODULE`
                < page_view_path_stat_tag ${{
                    key: 'page_view_path_stat_id'
                }}
            `
    })
)


export const PageViewPathStatAction = extendModel('page_view_path_stat_action',
    model => ({
        mapAction: page_view_path_stat_id => actionMap => {
            const { action_id, stat_count } = actionMap
            return model.insert({ action_id, stat_count, page_view_path_stat_id })
                .catch(e =>
                    model.updateWhere({ action_id, page_view_path_stat_id }, { stat_count })
                        .then(R.head)
                        .catch(() => Promise.reject(e))
                )
                .catch(e => model.errorHandler(e))
        },

        mapMany: page_view_path_stat_id => actionMaps =>
            pMap(model.mapAction(page_view_path_stat_id))(actionMaps)
                .catch(e => model.errorHandler(e)),
    })
)



export const PageViewPathStatTag = extendModel('page_view_path_stat_tag',
    model => ({
        mapTag: page_view_path_stat_id => tagMap => {
            const { tag_id, stat_count } = tagMap
            return model.insert({ tag_id, stat_count, page_view_path_stat_id })
                .catch(e =>
                    model.updateWhere({ tag_id, page_view_path_stat_id }, { stat_count })
                        .then(R.head)
                        .catch(() => Promise.reject(e))
                )
                .catch(e => model.errorHandler(e))
        },

        mapMany: page_view_path_stat_id => tagMaps =>
            pMap(model.mapTag(page_view_path_stat_id))(tagMaps)
                .catch(e => model.errorHandler(e)),
    })
)

