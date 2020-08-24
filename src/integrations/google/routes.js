const express = require('./express')
const isLoggedIn = require('../../middleware/login')
const { GoogleSignOnService } = require('./service')


const router = express.Router()
router.use(
    isLoggedIn({ enforceLogin: true })
)


router.get('/google/oauth2callback', (req, res) => GoogleSignOnService(req, res))

module.exports = router