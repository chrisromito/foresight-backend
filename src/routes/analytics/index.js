/**
 * @module routes/analytics/index.js - Entry point for the "analytics site"
 * - Users MUST be signed in
 * - Facilitates viewing analytics, statistics, & other information related to the website/application
 *   owned by the Client that owns the User's Account. (Action.client._id === User.account.client._id)
 * 
 */
const router = require('./express').Router()
const controller = require('../../controllers/analytics')
const loginMiddleware = require('../../middleware/login')

router.use(loginMiddleware())

router.get('/popover', (req, res)=> res.render('popover.html'))



// Nested routers & routes
//-- dashboard, real_time, traffic, interaction
router.get('/', controller.Dashboard)
router.get('/real_time', controller.RealTime)
router.get('/traffic', controller.Traffic)
router.get('/interaction', controller.Interaction)

//-- Nested views
router.use('/user/', require('./user'))
router.use('/action/', require('./action'))
router.use('/neural_step/', require('./neural_step'))


// module.exports = router
module.exports = router