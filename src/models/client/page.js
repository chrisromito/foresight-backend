import { URL } from 'url'
import * as R from 'ramda'
import { extendModel, TABLE, QUERY, EQ } from '../base'


// const urlCtor = R.constructN(1, URL)


const urlCtor = str => new URL(str)


const domainUrlKeys= ['host', 'hostname', 'protocol']


const liftUrl = str => {
    const url = urlCtor(str)
    return domainUrlKeys.reduce(
        (obj, key)=> ({
            ...obj,
            [key]: R.prop(key, url)
        }),
        {}
    )
}


const liftPath = R.tryCatch(
    R.compose(
        R.prop('pathname'),
        urlCtor
    ),
    R.always(null)
)


export const Domain = extendModel('domain', model => ({
        insertFromUrl: (url, client_id)=>
            model.insert({
                client_id,
                ...liftUrl(url)
            }),

        getOrCreateForUrl: (url, client_id)=> {
            const lifted = liftUrl(url)
            return model.getOrCreate(
                { client_id, href: lifted.href },
                { client_id, ...lifted }
            )
        },

        isAllowed: (url, client_id)=>
            (QUERY`
                SELECT COUNT(*)
                    FROM ${TABLE('domain')}
                    WHERE ${EQ({ client_id, ...liftUrl(url) })}
            `).then(R.head)
                .then(({ count })=> Number(count) > 0),

        getOrReject: (url, client_id)=>
            Domain
                .isAllowed(url, client_id)
                .then(isAllowed =>
                    isAllowed
                        ? model.selectOneWhere({ client_id, ...liftUrl(url) })
                        .then(domain =>
                            domain
                                ? domain
                                : Promise.reject([url, client_id])
                        )
                        : Promise.reject([url, client_id])
                )
    })
)


export const Page = extendModel('page', model => ({
        getOrCreate: ({ url, client_id, ...data })=> {
            const path = liftPath(url)
            if (R.isNil(path)) {
                return Promise.reject(
                    new TypeError(`
                        The Page model attempted to lift a pathname from the provided URL, but got
                        an invalid value instead.
                        Pages require URLs that provide a non-null, valid pathname when lifted into a URL instance.
                        The provided url: ${url}
                        Provided the pathname ${path}
                    `)
                )
            }
            return Domain
                .getOrReject(url, client_id)
                .then(domain => domain.id)
                .then(domain_id =>
                    model.base.getOrCreate(
                        { client_id, path, domain_id },
                        { client_id, path, domain_id, ...data }
                    )
                )
        }
    })
)
