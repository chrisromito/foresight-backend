import { URL } from 'url'
import * as R from 'ramda'
import { extendModel } from '../base'


const urlCtor = R.constructN(1, URL)


const urlKeys = ['host', 'hostname', 'href', 'path', 'origin']


const liftUrl = R.compose(
    o => o.pathname ? {...o, path: o.pathname} : o,
    R.pick(urlKeys),
    urlCtor
)


export const Referrer = extendModel(
    'referrer',
    model => ({
        getOrCreate: url => {
            const lifted = liftUrl(url)
            return model.base.getOrCreate(
                { href: lifted.href },
                lifted
            )
        },

        getForUrl: url => {
            try {
                if (url) {
                    return model.selectOneWhere({ url: liftUrl(url) })
                }
            } catch(e) {}
            return Promise.resolve(null)
        }
    })
)

export default Referrer

