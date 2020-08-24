/**
 * @module routes/public_api/page_view - Routes for the Page View & Action public APIs
 * This assumes that the exported router will be nested under the 'api/page_view' URL suffix/namespace
 */
import { Router } from 'express'
import {
    ActionController,
    PageViewController
} from '../../controllers/public_api/controller'

const PageViewRouter = Router()


// Page View CRUD
PageViewRouter.post('/', PageViewController.pageViewPost)

//-- Page View -> Activate/deactivate
PageViewRouter.post('/:id/active', PageViewController.pageViewActive)
PageViewRouter.post('/:id/inactive', PageViewController.pageViewInActive)

export default PageViewRouter
