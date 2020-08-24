import * as R from 'ramda'
import moment from 'moment'
import { Page } from 'models/client'
import { ReferrerStat } from 'models/stats/referrer_stat/models'
import { getUserValues, getBounceCount } from 'models/stats/page_view_user_stat/service'
import { StatValue } from 'models/stats/shared'
import { dateCeil, dateFloor } from 'utils/dates'
import { dateBetween } from 'models/shared/date_filter'
import { QUERY, EQ, IN, SQL } from 'models/base'


export const generateReferrerStats = async ({ client_id }, date) => {
    const min = dateFloor(date ? date : moment()).toDate()
    const max = dateCeil(min).toDate()

    const stat_value = await StatValue.forDate(min)
    const pages = await Page.selectWhere({ client_id })
    const page_ids = R.map(R.prop('id'), pages)

    const referrer_ids = await getPvpReferrers({
        page_ids,
        client_id,
        min,
        max
    })

    let results = []
    for (const referrer_id of referrer_ids) {
        const taskResult = await referrerStatTask({
            referrer_id,
            max,
            min,
            client_id,
            page_ids: page_ids,
            stat_value_id: stat_value.id
        })
        results.push(taskResult)
    }
    return results
}


async function referrerStatTask({ max, min, stat_value_id, referrer_id, page_ids, client_id }) {
    const page_view_ids = await getPageViewIds({ referrer_id, page_ids, min, max })
    const { total_count, unique_count } = await getUserValues({ page_view_ids })
    const { bounce_count } = await getBounceCount({ page_view_ids })
    return await ReferrerStat.insert({
        client_id,
        stat_value_id,
        referrer_id,
        total_count,
        unique_count,
        bounce_count,
        created: min
    })
}


const getPvpReferrers = ({ page_ids, min, max, client_id })=> {
    const dateFilter = dateBetween('pvp.created')(min, max)
    return QUERY`
        SELECT DISTINCT pvp.referrer_id
            FROM page_view_path pvp
            INNER JOIN page_view pv
                ON pv.id = pvp.to_page_view_id
            INNER JOIN page p
                ON p.id = pv.page_id
            ${dateFilter}
            AND ${EQ({ client_id })}
            AND ${IN('p.id', page_ids )}
            AND pvp.referrer_id IS NOT NULL
    `.then(
        R.pipe(
            R.map(R.values),
            R.flatten
        )
    )
}


const getPageViewIds = ({ referrer_id, page_ids, min, max })=> {
    const dateFilter = dateBetween('pvp.created')(min, max)
    return QUERY`
        SELECT pv.id
            FROM page_view pv
            INNER JOIN page_view_path pvp
                ON pv.id = pvp.to_page_view_id
            INNER JOIN page p
                ON p.id = pv.page_id
            ${dateFilter}
            AND ${IN('p.id', page_ids)}
            AND pvp.referrer_id = ${referrer_id}
    `.then(
        R.pipe(
            R.map(R.values),
            R.flatten
        )
    )
}
