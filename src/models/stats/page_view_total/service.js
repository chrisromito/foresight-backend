import moment from 'moment'
import * as R from 'ramda'
import { dateFloor, dateCeil } from 'utils/dates'
import { EQ, IN, QUERY } from 'models/config'
import { Client, Page } from 'models/client'
import { PageViewStat, PageViewTotal, PageViewTotalAction, PageViewTotalTag } from 'models/stats/page_view_total/models'
import { StatValue } from 'models/stats/shared'


/**
 * @func generatePageViewStats - Generate Page-View related stats for a day's
 * worth of Page Views.
 * Facade for generating PageViewStat, PageViewTotal, PageViewTotalAction, PageViewTotalTag
 * records, and all of the behind-the-scenes data mapping associated w/ each implementation
 *
 * @param {Number} client_id
 * @param {Date} date - The date that you want to generate Stats for
 *      Internally, we floor the date to get our min, and ceil it to get our max
 *      so the stats encompass an entire day.  ;)
 * @returns {Promise<{
 *      pageViewTotal: Object,
 *      pageViewStat: Object,
 *      pageViewTotalActions: Object,
 *      pageViewTotalTags: Object
 * }[]>}
 */
export const generatePageViewStats = async ({ client_id }, date=null)=> {
    const min = dateFloor(date ? date : moment()).toDate()
    const max = dateCeil(min).toDate()

    const stat_value = await StatValue.forDate(min)
    const client = await Client.getById(client_id)
    const pages = await Page.selectWhere({ client_id })

    let results = []
    for (const page of pages) {
        const taskResult = await pageViewStatTask({
            client,
            page,
            max,
            min,
            client_id: client_id,
            page_id: page.id,
            stat_value_id: stat_value.id
        })
        results.push(taskResult)
    }
    return results
}


/**
 * @typedef {Object} TaskContext
 * @property {Number} client_id
 * @property {Number} page_id
 * @property {Number} stat_value_id
 * @property {Date} max
 * @property {Date} min
 */

/**
 * @func pageViewStatTask - Generate PageViewStat records for each Page
 * @param {TaskContext} context
 * @returns {Promise<{
 *      pageViewTotal: Object,
 *      pageViewStat: Object,
 *      pageViewTotalActions: Object,
 *      pageViewTotalTags: Object
 * }>}
 */
const pageViewStatTask = async context => {
    const { client_id, page_id, max, min } = context
    const page_view_ids = await getPageViewIds({ page_id, max, min })
    const fullContext = { ...context, page_view_ids }
    const pageViewStat = await PageViewStat.insert({ page_id, client_id, created: min })
    const pageViewTotal = await getPageViewTotal(fullContext)(pageViewStat.id)
    const pageViewTotalTags = await mapPageViewTotalTags({
        ...fullContext,
        page_view_total_id: pageViewTotal.id
    })
    const pageViewTotalActions = await mapPageViewTotalActions({
        ...fullContext,
        page_view_total_id: pageViewTotal.id
    })
    return {
        pageViewStat,
        pageViewTotal,
        pageViewTotalTags,
        pageViewTotalActions
    }
}



const flatMerge = R.pipe(R.flatten, R.mergeAll)

//-- PageViewTotal funcs
const getPageViewTotal = context => page_view_stat_id =>
    Promise.all([
        getStatCount(context),
        getEntryCount(context),
        getExitCount(context),
    ]).then((...args) =>
        flatMerge(args)
    ).then(({ stat_count, entry_count, exit_count }) => {
            return PageViewTotal.insert(({
                page_view_stat_id,
                stat_count,
                entry_count,
                exit_count,
                stat_value_id: context.stat_value_id
            }))
        }
    )



export const getPageViewIds = ({ page_id, min, max }) =>
    QUERY`
        SELECT id
            FROM page_view
            WHERE ${EQ({ page_id })}
                AND created BETWEEN ${min} AND ${max}
    `.then(
        R.pipe(
            R.map(R.prop('id')),
            R.flatten
        )
    )



export const getStatCount = ({ page_view_ids }) =>
    QUERY`
        SELECT COUNT(pv.page_id) as stat_count
            FROM page_view pv
            WHERE ${IN('pv.id', page_view_ids)}
            GROUP BY pv.page_id
    `.then(
        R.pipe(
            R.map(R.prop('stat_count')),
            R.flatten,
            R.sum,
            stat_count => ({ stat_count })
        )
    )


const getEntryCount = ({ page_view_ids }) => {
    return QUERY`
        SELECT COUNT(pv.page_id) as entry_count
            FROM page_view_path pvp
            INNER JOIN page_view pv
                ON pv.id = pvp.to_page_view_id
            WHERE ${IN('pv.id', page_view_ids)}
                AND pvp.from_page_view_id IS NULL
                AND pvp.depth = 0
    `.then(
        R.pipe(
            R.map(R.prop('entry_count')),
            R.flatten,
            R.sum,
            entry_count => ({ entry_count })
        )
    )
}


export const getExitCount = ({ page_view_ids }) =>
    QUERY`
        SELECT COUNT(pv.page_id) as exit_count
            FROM page_view_path pvp
            INNER JOIN page_view pv
                ON pv.id = pvp.to_page_view_id
            WHERE ${IN('pv.id', page_view_ids)}
                AND pvp.id NOT IN (
                    SELECT parent_id
                        FROM page_view_path
                        WHERE parent_id IS NOT NULL
                )
            GROUP BY pv.page_id
    `.then(
        R.pipe(
            R.map(R.prop('exit_count')),
            R.flatten,
            R.sum,
            exit_count => ({ exit_count })
        )
    )


//-- Page View Total Tags & Actions
export const mapPageViewTotalTags = ({ page_view_ids, page_view_total_id }) =>
    QUERY`
        SELECT pv_tag.tag_id, COUNT(pv_tag.tag_id) as stat_count
            FROM page_view_path pvp
            INNER JOIN page_view pv 
                ON pv.id = pvp.to_page_view_id or pv.id = pvp.from_page_view_id
            INNER JOIN page_view_path_tag pv_tag 
                ON pvp.id = pv_tag.page_view_path_id
            WHERE ${IN('pv.id', page_view_ids)}
            GROUP BY pv.page_id, pv_tag.tag_id
    `.then(
        PageViewTotalTag.mapMany(page_view_total_id)
    )


export const mapPageViewTotalActions = ({ page_view_ids, page_view_total_id }) =>
    QUERY`
        SELECT ap.to_action_id AS action_id,
                COUNT(ap.to_action_id) AS stat_count
            FROM page_view_path pvp
            INNER JOIN page_view pv
                ON (
                    pv.id = pvp.to_page_view_id
                    AND ${IN('pv.id', page_view_ids)}
                )
            INNER JOIN action_path ap
                ON ap.page_view_path_id = pvp.id
            GROUP BY 1
    `.then(
        PageViewTotalAction.mapMany(page_view_total_id)
    )

