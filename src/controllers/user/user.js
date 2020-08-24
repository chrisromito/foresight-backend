/**
 * @module
 * @exports
 *    userList : JSON, paginated view for Users.
 *        - Filter by active, sort by, created, & updated
 *    userDetail : JSON view for a single user.
 *        - Includes 50 most recent sessions for this user 
 *     
 *    userCreate : Creates a new user (based on POST'd form)
 *  //-- Login Workflows
 *    userLoginGet : Renders the form for the user login page
 *    userLoginPost : Validates user submitted credentials (based on POST'd form w/ username & email)
 *      
 */
const R = require('ramda')
const { fToPromise } = require('../../utils/future_promise_interop')

const { check, validationResult } = require('./express-validator/check')
const { User } = require('../../models/index')

const { UserInterface } = require('../../../../src/shared/interfaces/index')
const { SessionMonad } = require('./interfaces')
const { UserService, SignUpSchema } = require('./service')

const { DateRangeFilter } = require('../common/common')


/**
 *  Filter helpers
 *----------------------------------------
 *----------------------------------------*/

const viewLens = (lens, query)=> R.view(lens, query)

const activeFilter = (query, obj)=> {
    const activeLens = R.lensPath(['active'])
    const param = viewLens(activeLens, query)
    return param ? R.over(
        activeLens,
        R.ifElse(
            R.equals('true'),
            R.T,
            R.F
        ),
        obj
    ) : obj
}


const updatedFilter = (query, obj)=> DateRangeFilter('updated', query, obj)

const createdFilter = (query, obj)=> DateRangeFilter('created', query, obj)


const setUserFilters = (query, obj)=>{
    const filterList = [activeFilter, updatedFilter, createdFilter]
        .map(R.curry)
        .map((fn)=> fn(query))
    const filterFn = R.compose(...filterList)
    return filterFn(obj)
}


//-- Serialization
const parse = R.pipe(JSON.stringify, JSON.parse)

const liftUser = (o)=> new UserInterface(o).toObject(true)

const liftUserToJson = R.pipe(
    parse,
    liftUser,
    JSON.stringify
)

const liftUsersToJson = R.pipe(
    parse,
    R.map(liftUser),
    JSON.stringify
)


/**
 *  View Controllers
 *----------------------------------------
 *----------------------------------------*/


// All users
exports.userList = (req, res)=> {
    const queries = req.query

    const pageNumber = queries.page || 1
    const lowerLimit = (pageNumber - 1) * 100
    const upperLimit = pageNumber * 100
    const filterObj = setUserFilters(queries, {})

    return User.find(filterObj, null, { sort: { created: -1 } })
        .skip(lowerLimit)
        .limit(upperLimit)
        .populate('account')
        .populate({
            path: 'sessions',
            select: 'active ip_address device updated created', 
            options: {
                sort: {
                    updated: -1  // Sort descending on 'updated' field
                },
                limit: 1
            }
        }).exec()
        .then(R.pipe(
            liftUsersToJson,
            (l)=> res.send(l)
        ))
}


// User detail - Get user by ID
exports.userDetail = (req, res)=> User.findById(req.params.userId)
    .populate('account')
    .populate({
        path: 'sessions',
        select: 'active ip_address device updated created', 
        options: {
            sort: {
                updated: -1  // Sort descending on 'updated' field
            },
            limit: 50
        }
    }).exec()
    .then(R.pipe(
        liftUserToJson,
        (user)=> res.send(user)
    ))


// Update user
exports.userUpdate = (req, res)=> {

}

// Delete user
exports.userDelete = (req, res)=> {

}




//-- Login & write operations
//------------------------------------
//----------------------------------------


/**
 * @method userLoginGet : Renders the login page
 */
exports.userLoginGet = (req, res)=> {
    const msg = 'userLoginGet - Nunjucks message =D'
    return res.render('signup/login.html', {
        message: msg
    })
}


/**
 * @method userLoginPost : Validates submitted credentials (username & email),
 * & adds username, user ID, etc. to the requested session
 */

exports.userLoginPost = (req, res)=>
    new Promise((resolve, reject)=>
        UserService(req)
            .loginWithUserName(req.body.username, req.body.password)
            .map(x => {
                console.log('logged in!')
                console.log(x)
                return x
            })
            .fork(reject, resolve)
    )
    .then(account =>
        SessionMonad(req).map({ accountId: account._id })
    )
    .then(()=> res.redirect('/analytics/'))
    .catch(e => {
        console.log(e)
        if (e.status && e.status === 400) {
            return res.status(400).json(e)
        }
        return Promise.reject(e)
    })


/**
 * @method userSignupGet : Display the signup page
 */
exports.userSignupGet = (req, res)=> {
    return res.render('account/signup.html', {
        // csrfToken: req.csrfToken(),
        errors: []
    })
}


/**
 * @method userSignupPost : Validate form, create an Account, User, & UserSession (if everything is valid)
 * Then redirect to the home page
 */
exports.userSignupPost = [
    SignUpSchema,
    (req, res, next)=> {
        const errors = validationResult(req)
        // Render any validation errors & return
        if (!errors.isEmpty()) {
            res.render('user/signup.html', {
                errors: errors.array()
            })
            return next()
        }

        return fToPromise(UserService(req).createAccount())
            .then(context => {
                // Set the account id, user session, etc. on the request session
                SessionMonad(req).map({
                    accountId: context.account._id,
                    sessionId: context.userSession._id,
                    user: context.user
                })
                return res.redirect('/home')
            })
            .catch(next)
    }
]


