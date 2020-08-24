/**
 * @module signup - Contains the routes for the 'signup site'.
 */
import { Router } from 'express'
import { createTrial } from '../../controllers/signup'
import { userLoginGet, userLoginPost } from '../../controllers/user/user'


const SignUpRouter_ = Router()


SignUpRouter_.get('/', (req, res)=> res.render('signup/home/index.html', {}))
SignUpRouter_.get('/home', (req, res)=> res.redirect('/'))

SignUpRouter_.get('/login', userLoginGet)
SignUpRouter_.post('/login', userLoginPost)


SignUpRouter_.get('/trial', (req, res)=> res.render('signup/trial/index.html', {}))
SignUpRouter_.post('/trial', createTrial)

export const SignUpRouter = SignUpRouter_
export default SignUpRouter