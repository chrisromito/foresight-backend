import * as R from 'ramda'
import pathMatch from 'path-match'
import Url from 'url'
import { isNumber } from '../utils/common'


const matchFactory = pathMatch({
    end: false,
    sensitive: false,
    strict: false
})


const urlParser = p => Url.parse(p)

/**
 * @func liftUrl
 * @param {String} u - Request URL
 * @param {String} expressPath - Express Path
 * @returns {{queryParams: *, kwargs: Object}}
 */
export const liftUrl = (u, expressPath) => ({
    kwargs: pathIsMatch(expressPath)(u),
    queryParams: queryParser(u)
})

/**
 * @func pathIsMatch - Determine if a query URL matches an Express-style URL path
 * @param {String} expressPath
 * @returns {function(String): (Object|null)}
 */
export const pathIsMatch = expressPath => {
    const matcher = matchFactory(expressPath)
    const defaultValue = null

    return requestPath => {
        try {
            const pathParams = matcher(
                urlParser(requestPath).pathname
            )
            return pathParams
                ? pathParams
                : defaultValue
        } catch (e) {}
        return defaultValue
    }
}


const queryParamParser = R.pipe(
    R.split('&'),
    R.map(
        R.split('=')
    ),
    R.reduce(
        (accum, [k, v]) => {
            if (k && v) {
                accum[k] = isNumber(v)
                    ? Number(v)
                    : v
            }
            return accum
        },
        {}
    )
)


export const queryParser = R.tryCatch(
    R.pipe(
        urlParser,
        R.prop('query'),
        queryParamParser
    ),
    R.always({})
)
