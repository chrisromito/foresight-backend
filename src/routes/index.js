import express from 'express'
import PublicApiRouter from './public_api/index'


export const router = express.Router()

//-- Public API - Used by our client-side plugin to
// allow interactions between client sites & our system
router.use('/', PublicApiRouter)


// Sign-up Site (doesn't require account)
// This is where we handle user logins as well
// router.use('/', require('./signup/index'))


// Platform/Analytics Site (requires account)
// router.use('/analytics/', require('./analytics/index'))
export default router
