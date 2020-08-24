/**
 * @module auth - Provides authentication
 * to ensure the request comes from a registered Domain
 */
const { IS_DEV, ABSOLUTE_DOMAIN } = require('../constants')
const cors = require('./cors')
const { URL } = require('url')
const { Domain } = require('../models/index')
const { UserSessionService } = require('../controllers/user/service')
const { getUserContext } = require('../integrations/google/test')
const SessionMonad = require('../controllers/user/interfaces')


const getWhiteList = url =>
    Domain.find({})
        .where('hostname', url.hostname)
        .where('protocol', url.protocol)
        .limit(1)
        .exec()


const handleSession = (req, clientId, domainId) => {
    let pred = Promise.resolve(req)

    if (IS_DEV) {
        pred = getUserContext()
            .then(({ account, client }) => {
                console.log('getUserContext ->')
                console.log(account)
                console.log(client)
                return SessionMonad(req)
                    .map({
                        domainId,
                        clientId: client,
                        accountId: account
                    })
                    .save()
            })
    } else {
        pred = SessionMonad(req)
            .map({
                clientId,
                domainId
            })
            .save()
    }
    return pred.then(request =>
        UserSessionService(request)
        .getAndSetSessionP()
    )
}


const corsConfig = (req, res, next)=> {
    const url = req.header('Origin')
        || IS_DEV
            ? ABSOLUTE_DOMAIN
            : null

    if (!url) {
        // If origin isn't present on the header,
        // then we can't set anything on the session
        // so we need to throw an Error, because this is not a valid request
        throw new Error('Invalid request origin')
    }
    return getWhiteList(new URL(url))
        .then(domains => {
            let isValid = false
            let domainId = null
            let clientId = null
            if (domains.length) {
                domainId = domains[0]._id
                clientId = domains[0].client
            }

            return handleSession(req, clientId, domainId)
                .then(()=> next())
                .catch(next)
        })
}


const defaultCorsConfig = {
    credentials: true,
    preflightContinue: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']
}


const setCorsConfig = (req, callback)=> {
    const origin = req.header('Origin')
    if (IS_DEV || !origin) {
        return callback(null, {
            ...defaultCorsConfig,
            origin: true
        })
    }

    return Domain.find({})
        .select('origin')
        .exec()
        .then(domains =>
            callback(null, {
                ...defaultCorsConfig,
                origin: domains.map('origin')
            })
        )
        .catch(()=>
            callback(null, {
                ...defaultCorsConfig,
                origin: false
            })
        )
}


const authConfig = cors(setCorsConfig)


// module.exports = corsConfig
module.exports = authConfig
