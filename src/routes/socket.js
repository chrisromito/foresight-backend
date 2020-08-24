/**
 * @module socket - Exports the router responsible for wiring up the
 * socket endpoints to the public socket route/url paths
 */
import { SocketRouter } from '../lib/router'
import autoDisconnect from '../lib/auto_disconnect'
import ApiAuthMiddleware from '../middleware/public_api/auth'
import { socketEndpoints } from './endpoints'
import { PageViewSocketObserver } from '../controllers/public_api/socket'


const socketRouter = new SocketRouter('/', {
    // middleware: [ApiAuthMiddleware]
    middleware: []
})

// WS -> /socket/page_view/:page_view_id
socketRouter.ws(socketEndpoints.pageView, PageViewSocketObserver)
// socketRouter.ws(socketEndpoints.pageView, autoDisconnect(pageViewSocketController.pageView))
// socketRouter.ws(socketEndpoints.pageView, pageViewSocketController.pageView)

export const SocketSubjectRouter = socketRouter
export default SocketSubjectRouter
