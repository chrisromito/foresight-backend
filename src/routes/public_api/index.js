import { Router } from 'express'
import ApiAuthMiddleware from '../../middleware/public_api/auth'
import PageViewRouter from './page_view'
import { publicApiEndpoints } from '../endpoints'

const api = Router()

// Wire up the middleware for this router
api.use(ApiAuthMiddleware)

// Routes
api.use(publicApiEndpoints.pageView, PageViewRouter)
// api.use('/page_stats', PageStatsRouter)

export default api
