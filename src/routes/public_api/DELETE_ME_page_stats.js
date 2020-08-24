const { Router } = require('./express')
const { InteractionStats, PageStatsList, TrafficStats } = require('../../controllers/api/page_stats')

const PageStatsRouter = Router()

PageStatsRouter.get('/', PageStatsList)
PageStatsRouter.get('/traffic/', TrafficStats)
PageStatsRouter.get('/interaction/', InteractionStats)



module.exports = PageStatsRouter