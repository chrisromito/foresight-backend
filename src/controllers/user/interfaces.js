/**
 * @module user/interfaces - Provides interface for getting/setting values in Express Request Sessions
 * This exists solely to avoid having to search through the codebase to figure out how the hell to get the accountId
 */

const R = require('ramda')
const { Str, toPojo } = require('../../utils/common')


const SESSION_KEYS = [
    'clientId',
    'domainId',
    'accountId',
    'user',
    'sessionId'
]

const sessionLens_ = R.lensPath(['session'])


const composeSession = (propName)=> R.compose(sessionLens_, R.lensPath([propName]))


const baseLenses = SESSION_KEYS.reduce((acc, key)=> {
    acc[key] = R.lensPath([key])
    return acc
}, {})


const sessionLenses = SESSION_KEYS.reduce((acc, key)=> {
    acc[ Str.camelCase(`request-${key}`) ] = composeSession(key)
    return acc
}, {})


const lenses = {
    ...baseLenses,
    ...sessionLenses
}

 
const SessionMonad = request => ({
    isSessionMonad: true,
    req: ()=> request,

    value: ()=> {
        const ofKeys = SESSION_KEYS.reduce((acc, k)=> {
            acc[k] = request.session[k] || null
            return acc
        }, toPojo(request.session) || {})
        ofKeys.account = ofKeys.accountId || null
        ofKeys.client = ofKeys.clientId || null

        const obj = {...request.session, ...ofKeys}
        return obj
    },

    map: obj => {
        // Set the key/val pairs on the request.session & return the request
        Object.entries(obj)
            .filter(([k, v])=> SESSION_KEYS.includes(k) && v !== undefined)
            .forEach(([k, v])=> request.session[k] = v)
        return SessionMonad(request)
    },

    isLoggedIn: ()=> {
        const m = SessionMonad(request).value()
        return m.clientId && m.accountId
    },

    save: ()=>
        new Promise((resolve, reject)=>
            request.session.save(err => err ? reject(err) : resolve(request))
        ).then(req =>
            new Promise((resolve, reject)=>
                req.session.reload(err => err ? reject(err) : resolve(req))
            )
        )
})

SessionMonad.isSessionMonad = true
SessionMonad.lenses = lenses


module.exports = SessionMonad
