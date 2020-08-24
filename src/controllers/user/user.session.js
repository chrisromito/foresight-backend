
const Maybe = require('./maybe')
const R = require('ramda')
const { User, UserSession, Action } = require('../../models/index');
const {
    tryOrNull,
    viewRequest,
    sessionLens,
    sessionIdLens,
    getUserId,
    getRequestUser
} = require('../common/common')
const SessionMonad = require('./interfaces')


/**
 * Get/Set the User
 */


//-- User mutations
// Set the 'active' field for this user
// userRight :: (context {Object})=> Promise[User]
const userRight = (context)=> User.findOneAndUpdate(
    { id: getUserId(viewRequest(context)).value() },
    { active: true }
).exec()


// Create a User
// userLeft :: => Promise[User]
const userLeft = (context)=> {
    console.log('userLeft')
    console.log(User)
    return new User({ active: true}).save()
}


const updateUser = R.ifElse(
    R.compose(
        (m)=> m.isJust(),
        getUserId,
        viewRequest
    ),
    userRight,
    userLeft
)


// Set the user instance on the request session
const setUser = (context)=> updateUser(context)
    .then((user)=> {
        if (Maybe(user).isJust()) {
            const req = context.request
            req.session.user_id = user.id
            req.session.user = user
        }
        return context
    })


//-- IP Address

const requestIp = tryOrNull(
    R.compose(
        (ip_address)=> String(ip_address).split(',')[0].trim(),
        (req)=> req.headers && req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'] : req.connection.remoteAddress,
    )
)

const getDevice = tryOrNull(
    (req)=> req.headers['user-agent']
)



// The user does have a session set - get & update the 'active' field for the session
// sessionRight :: (context {Object})=> Promise[UserSession]
const sessionRight = (context)=> UserSession.findOneAndUpdate(
    { id: R.view(sessionIdLens, viewRequest(context)) },
    { active: true}
).save()


// The user does not have a session set
// sessionLeft :: (context {Object})=> Promise[UserSession]
const sessionLeft = (context)=> new UserSession({
    user: getRequestUser(context),
    session: context.request.session.id || null,
    active: true,
    ip_address: requestIp(viewRequest(context)),
    device: getDevice(viewRequest(context))
}).save()


const hasSessionAndSessionId = R.allPass([
    R.compose(R.complement(R.isNil), R.view(sessionLens)),
    R.compose(
        R.complement(R.isNil),
        R.view(
            R.compose(sessionLens, sessionIdLens)
        )
    )
])


// getOrCreateSession :: (context {Object})=> Promise[UserSession]
const getOrCreateSession = R.ifElse(
    R.compose(hasSessionAndSessionId, viewRequest),
    (context)=> R.tryCatch(
        R.thunkify(sessionRight)(context),
        R.thunkify(sessionLeft)(context)
    )(context),
    sessionLeft
)

// Get or create a UserSession, set the session_id for the current request & return the UserSession
const setSession = (context)=> setUser(context)
    .then(getOrCreateSession)
    .then((session)=> {
        context.request.session.session_id = session.id

        return new Promise((resolve, reject)=> {
            context.request.session.save(
                (err)=> err ? reject(err) : resolve(session)
            )
        })
    })


// module.exports = setSession
module.exports = {
    setUser,
    setSession
}
