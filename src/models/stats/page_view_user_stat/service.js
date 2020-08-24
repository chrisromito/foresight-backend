import { PageViewUserStat } from 'models/stats/page_view_user_stat/models'
import moment from 'moment'
import * as R from 'ramda'
import { Client, Page } from 'models/client'
import { IN, QUERY } from 'models/config'
import { StatValue } from 'models/stats/shared'
import { dateCeil, dateFloor } from 'utils/dates'
import { getPageViewIds } from 'models/stats/page_view_total/service'


export const generatePageViewUserStats = async ({ client_id }, date)=> {
    const min = dateFloor(date || moment()).toDate()
    const max = dateCeil(min).toDate()

    const stat_value = await StatValue.forDate(min)
    const pages = await Page.selectWhere({ client_id })

    let results = []
    for (const page of pages) {
        const taskResult = await pageViewUserStatTask({
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


async function pageViewUserStatTask({ max, min, page_id, stat_value_id }){
    const page_view_ids = await getPageViewIds({ page_id, min, max })
    const { total_count, unique_count } = await getUserValues({ page_view_ids })
    const { bounce_count } = await getBounceCount({ page_view_ids })
    return await PageViewUserStat.insert({
        page_id,
        stat_value_id,
        unique_count,
        total_count,
        bounce_count,
        created: min
    })
}


export const getUserValues = ({ page_view_ids  })=>
    QUERY`
        SELECT COUNT(pv.user_id) as total_count,
                COUNT(DISTINCT pv.user_id) as unique_count
            FROM page_view pv
            WHERE ${IN('pv.id', page_view_ids)}
    `.then(
        R.head
    )


export const getBounceCount = ({ page_view_ids })=>
    QUERY`
        SELECT COUNT(pvp.id) as bounce_count
            FROM page_view_path pvp
            LEFT JOIN page_view_path pvpp
                ON pvpp.parent_id = pvp.id
            WHERE pvpp.id IS NULL
            AND (
                ${IN('pvp.to_page_view_id', page_view_ids)}
                OR ${IN('pvp.from_page_view_id', page_view_ids)}
            )
    `.then(
        R.head
    )
