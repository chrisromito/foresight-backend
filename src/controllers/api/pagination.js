const { mergeDeepRight, curry } = require('ramda')


const Pagination = curry((config, query, req)=> {
    const conf = mergeDeepRight(defaultConfig, config || {})
    const pageParam = req.query[conf.param]
    const pageNum = isNaN(Number(pageParam)) ? 0 : Number(pageParam)
    const urls = getUrls(req, conf, pageNum)
    const min = conf.pageLength * pageNum
    const max = min + conf.pageLength
    return conf.render(
        pageNum,
        urls.nextPage,
        urls.lastPage,
        query.skip(min).limit(max)
    )
})


const defaultConfig = {
    pageLength: 100,
    param: 'page',
    render: (pageNum, nextPage, lastPage, data)=> ({
        nextPage,
        lastPage,
        data,
        page: pageNum,
    })
}


const getUrls = (req, { param }, pageNum=0)=> {
    const basePath = `${req.path}?${param}=`
    const nextPage = `${basePath}${pageNum + 1}`
    const lastPage = pageNum < 1 ? null : `${basePath}${pageNum - 1}`
    return {
        nextPage,
        lastPage
    }
}


module.exports = Pagination
