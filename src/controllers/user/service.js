/**
 * @module service - Provide services/interfaces for Users, UserSessions, & Accounts
 */
const R = require('ramda')
const { Future } = require('ramda-fantasy')
const { checkSchema } = require('./express-validator/check')
const { User, Account, UserSession } = require('../../models/index')
const ObjectId = require('mongoose').Types.ObjectId
const SessionMonad = require('./interfaces')
const { tapLog } = require('../../utils/common')


const findAccount = userSession =>
    Account.findOne({ 
        first_name: 'Chris',
        last_name: 'Romito',
        username: 'chrisacreative@gmail.com'
    })
    .exec()
    .then((a) => a._id)


const getOrCreateSession_ = ({ accountId, userId, sessionId, clientId }) =>
    sessionId
        ? UserSession.findById(ObjectId(sessionId))
            .populate('user')
            .exec()
        :
        new User({
                client: clientId ? ObjectId(clientId) : null,
                account: accountId ? ObjectId(accountId) : null
            })
            .save()
            .then(user =>
                new UserSession({
                    sessionId,
                    user: user._id,
                    active: true,
                    client: clientId ? ObjectId(clientId) : null,
                    account: accountId ? ObjectId(accountId) : null
                })
                .save()
                .then(userSession => {
                    user.sessions = [userSession._id]
                    return user.save()
                        .then(() => userSession)
                })
            )

const getOrCreateSession = ({ accountId, userId, sessionId, clientId }) =>
    getOrCreateSession_({ accountId, userId, sessionId, clientId })
        .then(tapLog(
            `\n\ngetOrCreateSession -> accountId: ${accountId} \nuserId: ${userId} \nclientId ${clientId}`)
        )
        .then(userSession =>
            ({
                clientId,
                userSession
            })
        )


const getAndSetSession = req =>
    Promise.resolve( SessionMonad(req).value() )
        .then(({ accountId, userId, sessionId, clientId })=>
            getOrCreateSession({ accountId, userId, sessionId, clientId }))
        .then(({ clientId, userSession }) => {
            // Add our data to the request object
            // to (hopefully) make life easier
            const account = userSession.user.account
            const accountId = account ? account._id : null
            req.accountId = accountId
            req.user = userSession.user
            req.userSession = userSession
            req.clientId = clientId

            return SessionMonad(req).map({
                clientId,
                accountId,
                user: userSession.user,
                sessionId: userSession._id,
            })
            .save()
        })


const CreateUserFuture = accountData =>
    createAccount(accountData)
        .map(account => ({ account }))
        .chain(createUser)
        .chain(createUserSession)


/**
 * @function UserService - Service/interface for User-related actions
 * 
 * @method createAccount - Creates a UserAccount based on the data provided in request.body
 * NOTE: This assumes the request body has been validated & sanitized
 * @returns {Future[{ account: Account, user: User, userSession: UserSession}]}
 * 
 * @method getAccount - Get the account of the current user based on the request
 * @returns {Future <(null|Error), Account}
 * 
 * @method getAccountByUsername
 * @returns {Future <(null|Error), Account}
 * 
 * @method login - Resolves w/ the account, rejects failed login attempts
 * @see SessionMonad
 * @param {Account} account
 * @param {String} password - Password entered by the user
 * @returns {Future <Error, Account} - Resolves with the Account, Rejects Mongoose Errors and plain Errors
 */

const UserService = request => ({
    createAccount: ()=> CreateUserFuture(request.body),
    createUser: ()=>
        UserService(request)
            .getAccount()
            .map(account => ({ account }))
            .chain(createUser)
            .chainReject(()=>
                createUser( SessionMonad(request).value() )
            ),

    getAccount: ()=>
        Future((reject, resolve)=> 
            Account.findById(
                SessionMonad(request).value().accountId
            )
            .then(account => account ? resolve(account) : reject(account))
            .catch(reject)
        ),

    getAccountByUserName: username =>
        Future((reject, resolve)=> 
            Account.findOne({ username })
                .exec()
                .then(account =>
                    account
                        ? resolve(account)
                        : reject(username))
                .catch(reject)
        ),

    login: (account, password)=>
        Future((reject, resolve)=>
            account.passwordValid(password)
                .then(valid =>
                    valid
                        ? resolve(account)
                        : reject({ reason: 'Invalid Credentials', status: 400 })
                )
                .catch(reject)
        ),

    loginWithUserName: (username, password) =>
        Future((reject, resolve)=>
            Account.findOne({ username })
                .exec()
                .then(account =>
                    account
                        ? account.passwordValid(password).then(resolve)
                        : reject({ reason: 'Invalid Credentials', status: 400 })
                ).catch(e => {
                    reject(e)
                    return Promise.reject(e)
                })
        )
})


/**
 * @function UserSessionService {Functor}
 * We attempt to re-use User objects as much as possible, but ultimately
 * they are meant to be ephemeral because they are used to track the
 * activity of registered AND anonymous users.
 * An inactive UserSession means it will not be used again.
 * @returns {Future[(Error | UserSession)]}
 */
const UserSessionService = request => ({
    getOrCreateSession: ()=>
        Future((reject, resolve)=>
            getAndSetSession(request)
                .then(resolve)
                .catch(reject)
        ),

    getAndSetSessionP: ()=>
        new Promise((resolve, reject)=>
            UserSessionService(request)
                .getOrCreateSession()
                .fork(reject, resolve)
        ),

    updateUserSession: ({ active, ip_address=false })=> {
        const payload = { active }
        if (ip_address) {
            payload.ip_address = ip_address
        }
        const sessionId = ObjectId( SessionMonad(request).value().sessionId )

        return Future((reject, resolve)=>
            UserSession.find({ _id: sessionId })
                .update(payload)
                .exec()
                .then(resolve)
                .catch(reject)
        )
    },

    updateUserActiveStatus: (_, active)=> UserSessionService(request).updateUserSession({ active })
})


/**
 * Utils
 */

const existsAndLengthIsOneToTwoFifty_ = {
    exists: true,
    isLength: {
        options: {
            min: 1,
            max: 250
        }
    }
}


/**
 * @exports SignUpSchema - express-validator schema for creating a new User
 * 
 * @example
 * >>> const { validationResult } = require('express-validator/check')
 * >>> app.post('/user/', [SignUpSchema, (req, res, next)=> {
 * ...     const signUpErrors = validationResult(req)
 * ... }])
 */
const SignUpSchema = checkSchema({
    password1: {
        exists: true
    },

    password2: {
        exists: true,
        isLength: {
            errorMessage: 'Password must be at least 6 characters',
            options: {
                min: 6,
                max: 250
            }
        },
        custom: {
            options: (value, { request })=> value === request.body.password1
        }
    },

    username: {
        exists: true,
        isEmail: true
    },

    firstName: existsAndLengthIsOneToTwoFifty_,
    lastName: existsAndLengthIsOneToTwoFifty_
})


// Accounts
const createAccount = accountData => Future((reject, resolve)=>
    new Account(accountData)
        .save()
        .then(resolve)
        .catch(reject)
)


const createUser = context => Future((reject, resolve)=>
    new User({
            account: context.account ? context.account._id : null,
            active: true,
            client: context.account ? context.account.client : context.clientId
    })
    .save()
    .then(user => ({
        account: context.account,
        user
    }))
    .then(resolve)
    .catch(reject)
)


const createUserSession = (context, data=null)=>
    Future((reject, resolve)=>
        new UserSession(
            Object.assign({}, data || {}, { user: context.user._id, active: true })
        )
        .save()
        .then(userSession => ({
            account: context.account,
            user: context.user,
            userSession
        }))
        .then(resolve)
        .catch(reject)
    )



module.exports = {
    SignUpSchema,
    CreateUserFuture,
    UserService,
    UserSessionService
}
