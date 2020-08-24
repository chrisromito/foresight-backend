/**
 * @module middleware/public_api/auth - Handles JWT Authentication for the Public API
 *
 * The logical workflow looks like:
 *
 * 1. Request has a client_key?
 *      - Yes: Get client from DB & Pass along to 1.A
 *      - No: Throw 403 Unauthenticated
 * * -- Data ------------*
 * | client {Object}
 * *---------------------*
 *
 * 2.A. Request has `jwt` key/val?
 *      - Yes: Verify/validate the JWT, receive token and user objects
 *      - Yes but invalid: Update JWT -> set inactive.  Pass on to 'no' branch
 *      - No: Generate JWT
 *      - Both: Add 'jwt': { token: 'my_jwt_token_jafoiejofajnaj;l' }
 *
 * 2.B. Create JWT + Anonymous user aligned to client, pass id
 * * -- Data ------------*
 * | client {Object}
 * | user_id {Number}
 * *---------------------*
 *
 * * -- Data ------------*
 * | client {Object}
 * | user {Object}
 * | jwt {{ token: String }}
 * *---------------------*
 *
 */
import { UNAUTHENTICATED } from '../../status_codes'
import { createAnonymousUser } from '../../models/user/index'
import { isValidClient } from '../../models/client/index'
import {
    Jwt,
    JwtService,
    parseAuthHeader
} from '../../models/jwt'


export const ApiAuthMiddleware = (req, res, next) => {
    return validateRequest(req, res)
        .then(()=> next())
        .catch(next)
}

export default ApiAuthMiddleware


//-- Utils
const hasClientKey = req => req.body.client_key !== null


const throwUnAuthenticated = (_, res)=> res.sendStatus(UNAUTHENTICATED.status)


//-- Request/Token validation
const validateRequest = (req, res) => {
    // 1.
    if (!hasClientKey(req)) {
        return throwUnAuthenticated(req, res)
    }

    return isValidClient(req.body.client_key)
        .then(client => {
            // 2.A - Validate JWT if one exists
            const requestJwt = parseAuthHeader(req)
            if (requestJwt) {
                return JwtService(Jwt)
                    .verifyToken(requestJwt)
                    .then(({ jwt, user }) => ({
                        jwt,
                        client,
                        user
                    }))
                    .then(setRequestContext(req))
                    .catch(e => {
                        return throwUnAuthenticated(req, res)
                    })
            }

            // 2.B - Create JWT + Anonymous user
            return createAnonymousUser(null, client.id)
                .then(user =>
                    JwtService(Jwt)
                        .createForUser(client.id, user.id)
                        .then(jwt => ({
                            jwt,
                            client,
                            user
                        }))
                )
                .then(({ jwt, user })=>
                    setRequestContext(req)({ jwt, user, client })
                )
        })
}


const setRequestContext = req => ({ jwt, user, client })=> {
    req.jwt = jwt
    req.user = user
    req.client = client
    req.userId = user.id
    req.user_id = user.id
    req.clientId = client.id
    req.client_id = client.id
    return req
}
