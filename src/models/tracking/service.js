import * as R from 'ramda'
import { QUERY } from '../base'
import { Page } from '../client/index'
import { Referrer } from './referrer'
import { IpLocation } from '../ip_location/index'


const propOrNull = prop =>
    R.tryCatch(
        R.prop(prop),
        R.always(null)
    )


const maybeId = propOrNull('id')


//-- Service
export const PageViewPathService = model => ({
    liftPageViewPath: async ({ user_id, client_id, pageView, referrer=null, ip_address=null })=> {
        const service = PageViewPathService(model)
        const urlIsClientPage = await service.urlIsClientPage(referrer, client_id)
        const ip_location_id = await service.getOrCreateIp(ip_address).then(maybeId)
        const parent = await service.getLastForUser(
            client_id,
            pageView.user_id,
            referrer,
            urlIsClientPage
        )

        const referrer_id = await service.liftReferrer(referrer, urlIsClientPage)
        const parent_id = parent
            ? parent.id
            : null
        return model.insert({
            ip_location_id,
            parent_id,
            referrer_id,
            user_id: user_id || pageView.user_id,
            to_page_view_id: pageView.id
        })
    },

    getLastForUser: async (client_id, user_id, referrer_url, urlIsClientPage)=> {
        try {
            if (urlIsClientPage) {
                const page = await getPage(referrer_url, client_id)
                return lastPageViewPathByPage(user_id, page.id)
            }

            const referrer = await getReferrer(referrer_url)
            if (!urlIsClientPage && referrer) {
                return lastPageViewPathByReferrer(user_id, referrer.id)
            }
            if (!urlIsClientPage && referrer_url) {
                await Referrer.getOrCreate(referrer_url)
            }
        } catch(e) {}
        return Promise.resolve(null)
    },

    urlIsClientPage: (url, client_id) =>
        getPage(url, client_id)
            .then(p => Boolean(p))
            .catch(()=> Promise.resolve(false)),

    liftReferrer: (url, urlIsClientPage) =>
        urlIsClientPage || !url
            ? Promise.resolve(null)
            : Referrer.getOrCreate(url).then(maybeId),

    getOrCreateIp: ip_address =>
        !ip_address
            ? Promise.resolve(null)
            : IpLocation.getOrCreate(ip_address)
                .catch(() => Promise.resolve(null))

})


const getPage = (url, client_id)=>
    Page.getOrCreate({ url, client_id })
        .catch(e =>
            Array.isArray(e)
                ? Promise.resolve(null)
                : Promise.reject(e)
        )


const getReferrer = url => Referrer.getForUrl(url)


const lastPageViewPathByPage = (user_id, page_id)=>
    QUERY`
        SELECT pvp.id, pvp.to_page_view_id
            FROM page_view_path pvp
            INNER JOIN page_view pv
                ON pv.id = pvp.to_page_view_id
                AND pv.page_id = ${page_id}
            WHERE pvp.user_id = ${user_id}
            AND pvp.created > NOW() - INTERVAL '8 hours'
            ORDER BY pvp.created DESC
            LIMIT(1)
    `.then(R.head)


const lastPageViewPathByReferrer = (user_id, referrer_id)=>
    QUERY`
        SELECT id, to_page_view_id
            FROM page_view_path
            WHERE user_id = ${user_id}
            AND referrer_id = ${referrer_id}
            AND created > NOW() - INTERVAL '8 hours'
            ORDER BY created DESC
            LIMIT(1)
    `.then(R.head)


const lastPageViewPathForUser = user_id =>
    QUERY`
        SELECT id, to_page_view_id
            FROM page_view_path
            WHERE user_id = ${user_id}
            AND created > NOW() - INTERVAL '8 hours'
            ORDER BY created DESC
            LIMIT(1)
    `.then(R.head)
