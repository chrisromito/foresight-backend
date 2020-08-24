/**
 * @module page_view_path_stat/service - Service function for
 * generating Page View Path Stat records.
 * @see generatePageViewPathStats
 * FIXME/TODO: Add PageViewHourly functionality to `generatePageViewPathStats`
 */
import { Client, Page } from 'models/client'
import { IN, QUERY } from 'models/config'
import { PageViewPathStat, PageViewPathStatAction, PageViewPathStatTag } from 'models/stats/page_view_path_stat/models'
import { StatValue } from 'models/stats/shared'
import { PageViewPath } from 'models/tracking'
import moment from 'moment'
import * as R from 'ramda'
import { dateCeil, dateFloor } from 'utils/dates'

/**
 * @func generatePageViewPathStats - Generate Page View Path related stats for a day's
 * worth of Page Views.
 * Facade for generating PageViewPathStat, PageViewPathStatTag, PageViewPathStatAction
 * records, and all of the behind-the-scenes data mapping associated w/ each implementation
 *
 * @param {Number} client_id
 * @param {Date} date - The date that you want to generate Stats for
 *      Internally, we floor the date to get our min, and ceil it to get our max
 *      so the stats encompass an entire day.  ;)
 * @returns {Promise<{
 *      pageViewPathStat: Object,
 * }[]>}
 */
export const generatePageViewPathStats = async ({ client_id }, date = null) => {
    const min = dateFloor(date ? date : moment()).toDate()
    const max = dateCeil(min).toDate()

    const stat_value = await StatValue.forDate(min)
    const client = await Client.getById(client_id)
    const pages = await Page.selectWhere({ client_id }, 'id')
    const page_ids = R.map(R.prop('id'), pages)
    // Get all of the PVP Ids for the client pages
    const page_view_path_ids = await getPageViewPathIds({ min, max, page_ids })
    // Get the Path & stat_values for each of those paths
    // We'll then take those values, and use the paths to grab the 'from_page_id' & 'to_page_id'
    // values for the respective paths
    const pathCounts = await getPathCounts({ page_view_path_ids })
    return await mapPathCounts(pathCounts, { stat_value_id: stat_value.id })
}


//-- PageViewPath funcs
const getPageViewPathIds = ({ min, max, page_ids })=>
    QUERY`
        SELECT DISTINCT pvp.id
            FROM page_view_path pvp
            INNER JOIN page_view pv
                ON pv.id = pvp.to_page_view_id or pv.id = pvp.from_page_view_id
            WHERE ${IN('pv.page_id', page_ids)}
                AND pvp.created BETWEEN ${min} AND ${max}
    `.then(
        R.pipe(
            R.map(R.prop('id')),
            R.flatten,
            R.uniq
        )
    )

/**
 * @func getPathCounts - Get the pvp.paths for the given page_view_path ids
 * and retrieve the # of occurrences for each of those paths that occurred
 * between `min` and `max` (represented via the 'stat_count' alias field)
 *
 * NOTE: Resist the urge to combine this query w/ the query in `getPageViewPathIds`.
 * We have to do this separately because of nuances w/ PostgreSQL's GROUP BY
 * implementation.  While it would be easier to grab the page_ids within this query,
 * PostgreSQL forces us to GROUP by them... which makes the 'stat_count' values
 * incorrect.
 *
 * As such, it's easier for us to just grab the correct values here, then do follow-up
 * queries to grab the page_ids.  =(
 *
 * @param page_view_path_ids
 * @returns {Promise<Object[]|Error>}
 */
const getPathCounts = ({ page_view_path_ids })=>
    QUERY`
        SELECT COUNT(LOWER(pvp.path)) AS stat_count,
            pvp.path
        FROM page_view_path pvp
        WHERE ${IN('pvp.id', page_view_path_ids)}
        GROUP BY pvp.path
        ORDER BY stat_count DESC
    `

/**
 * @func mapPathCounts - Handles the business-logic behind the Pvp -> Stat
 * relationship via mapping 'pathCounts' to stat_value_id's
 * PvpStat Actions's & PvpStat Tags are mapped here as well to further
 * reduce space-time complexity (especially space/memory allocation)
 * @param pathCounts
 * @param stat_value_id
 * @returns {Promise<[]>}
 */
const mapPathCounts = async (pathCounts, { stat_value_id }) => {
    let pageViewPathStats = []
    for (const pathMap of pathCounts) {
        const { path, stat_count } = pathMap
        const { to_page_id, from_page_id } = await getFromPageIdAndToPageId(path)
        const pvpStat = await PageViewPathStat.insert({
            stat_value_id,
            path,
            stat_count,
            to_page_id,
            from_page_id
        })
        pageViewPathStats.push(pvpStat)

        // Handle actions & tags
        const page_view_path_stat_id = pvpStat.id
        const page_view_path_ids = await PageViewPath.selectWhere({ path }, 'id')
                .then(R.map(R.prop('id')))
        await mapPageViewPathStatTags({ page_view_path_ids, page_view_path_stat_id })
        await mapPageViewPathStatActions({ page_view_path_ids, page_view_path_stat_id })
    }
    return pageViewPathStats
}


const getFromPageIdAndToPageId = path =>
    QUERY`
        SELECT pvp.path,
            (SELECT left_pv.page_id
                FROM page_view left_pv
                WHERE left_pv.id = pvp.from_page_view_id
                LIMIT 1
            ) AS from_page_id,
            (SELECT right_pv.page_id
                FROM page_view right_pv
                WHERE right_pv.id = pvp.to_page_view_id
                LIMIT 1
            ) AS to_page_id
            FROM page_view_path pvp
            WHERE pvp.path = ${path}
            LIMIT 1
    `.then(R.head)


//-- Page View Total Tags & Actions
export const mapPageViewPathStatTags = ({ page_view_path_ids, page_view_path_stat_id }) =>
    QUERY`
        SELECT pv_tag.tag_id,
                COUNT(pv_tag.tag_id) as stat_count
            FROM page_view_path pvp
            INNER JOIN page_view_path_tag pv_tag 
                ON pvp.id = pv_tag.page_view_path_id
            WHERE ${IN('pvp.id', page_view_path_ids)}
            GROUP BY 1
    `.then(
        PageViewPathStatTag.mapMany(page_view_path_stat_id)
    )

export const mapPageViewPathStatActions = ({ page_view_path_ids, page_view_path_stat_id }) =>
    QUERY`
        SELECT ap.to_action_id AS action_id,
                COUNT(ap.to_action_id) AS stat_count
            FROM page_view_path pvp
            INNER JOIN action_path ap
                ON ap.page_view_path_id = pvp.id
            WHERE ${IN('pvp.id', page_view_path_ids)}
            GROUP BY 1
    `.then(
        PageViewPathStatAction.mapMany(page_view_path_stat_id)
    )

