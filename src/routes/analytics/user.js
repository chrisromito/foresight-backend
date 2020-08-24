const Router = require('./express').Router
const user = require('../../controllers/user/user')


const UserRouter = Router()

UserRouter.get('/user', user.userList)
// Login
UserRouter.get('/user/login', user.userLoginGet)
UserRouter.post('/user/login', user.userLoginPost)
// Sign-up
UserRouter.get('/user/signup', user.userSignupGet)
UserRouter.post('/user/signup', user.userSignupPost)

UserRouter.get('/user/:userId', user.userDetail)


module.exports = UserRouter