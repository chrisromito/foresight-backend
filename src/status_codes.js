import * as R from 'ramda'

export const BAD_REQUEST = {
    status: 400,
    description: `Bad request due to invalid payload  L(°O°L)`
}


export const UNAUTHORIZED = {
    status: 401,
    description: `Insufficient authorization level ಠ╭╮ಠ`
}


export const UNAUTHENTICATED = {
    status: 403,
    description: `Invalid or stale credentials ಠ_ಠ`
}


export const NOT_FOUND = {
    status: 404,
    description: `Unknown URL ¯\\_(ツ)_/¯`,
    template: '404_view.html'
}


export const statusCodes = {
    BAD_REQUEST,
    UNAUTHORIZED,
    UNAUTHENTICATED,
    NOT_FOUND
}

export default statusCodes


export const statusCodeMap = Object.values(statusCodes)
    .reduce(
        (obj, { description, status })=> ({
            ...obj,
            [status]: { description, status }
        }),
        {}
    )

export const middleWare = (err, req, res, next)=> {
    const statusMap = res.status && R.has(res.status, statusCodeMap)
        ? R.prop(res.status, statusCodeMap)
        : null
    if (statusMap) {
        const renderHtml = R.has('template', statusMap) && res.accepts('html')
            ? R.prop('template', statusMap)
            : false
        const renderJson = !renderHtml && res.accepts('json')
            ? { error: statusMap.description }
            : false

        res.status(statusMap.status)
        return renderHtml
            ? res.render(renderHtml, { url: req.url })
            : renderJson
            ? res.json(renderJson)
            : next()
    }
}
