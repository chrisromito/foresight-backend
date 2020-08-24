import * as R from 'ramda'
import jwt from 'jsonwebtoken'
import { ASSOCIATE, QUERY, SET, SQL } from '../base'
import { Client } from '../client'

/**
 * @typedef {import('./model').Token} Token
 */

/**
 * @typedef {{
 *     user_id: Number,
 *     client_id: Number,
 *     token: String,
 *     client: Client,
 *     user: User,
 *     jwt: Token
 * }} TokenResult - The result of a verifying a valid token
 */


/**
 * @func JwtService - Service interface for JWT Auth
 * @param {import('./model').Jwt} model
 * @returns {{
 *      verifyToken: (function(*=): Promise<TokenResult>),
 *      createForUser: (function(Number, Number): Promise<Token>),
 *      invalidateStaleTokens: (function(): Promise<null>)
 * }}
 */
export const JwtService = model => ({
    /**
     * @method createForUser - Create a JWT token for the given user
     * & client
     * @param {Number} client_id
     * @param {Number} user_id
     * @returns {Promise<Token>}
     */
    createForUser: (client_id, user_id)=>
        Client.getById(client_id)
            .then(createJwtForUser(user_id))
            .then(token =>
                model.insert({
                    client_id,
                    user_id,
                    token,
                    is_active: true
                })
            )
            .catch(e =>
                model.errorHandler(e)
            ),

    /**
     * @method verifyToken - Verify/validate a token
     * Since tokens are unique and indexed in the `jwt` table, we can
     * use them as a lookup, and populate the client based on
     * the corresponding jwt record (where available)
     * @param token
     * @returns {Promise<TokenResult>}
     */
    verifyToken: token =>
        ASSOCIATE`
            jwt ${SQL` WHERE token = ${token} `}
                ${model.assocClient}
                ${model.assocUser}
        `.then(R.head)
        .then(jwtToken =>
            verifyToken(token, jwtToken._.client.secret_key)
                .then(decoded => ({
                    ...decoded,
                    token,
                    client: jwtToken._.client,
                    user: jwtToken._.user,
                    jwt: jwtToken
                }))
        ),

    /**
     * @method invalidateStaleTokens - Sets 'is_active' on all
     * tokens that have expired.  Meant to run as a cron-job/task
     * @returns Void
     */
    invalidateStaleTokens: ()=> {
        return QUERY`
            UPDATE jwt
                ${SET({ is_active: false })}
                WHERE created < (NOW() - INTERVAL '8 hours')
        `.then(()=> null)
    }
})

export default JwtService


const JWT_CONFIG = {
    expiresIn: '8h'
}


export const createJwtForUser = user_id => client =>
    new Promise((resolve, reject) =>
        jwt.sign(
            {
                user_id,
                client_id: client.id
            },
            client.secret_key,
            JWT_CONFIG,
            (err, token) =>
                err
                    ? reject(err)
                    : resolve(token)
        )
    )


const verifyToken = (token, secret)=>
    new Promise((resolve, reject)=> {
        jwt.verify(token, secret,
            (err, decoded) =>
                err
                    ? reject(err)
                    : resolve(decoded)
        )
    })


/**
 * @func parseAuthHeader - parse the 'authorization' key/val pair when
 * given an express Request Object
 * @param req
 * @returns {*}
 */
export const parseAuthHeader = req => {
    const auth = req.get('authorization')
    return !auth || !auth.toLowerCase().startsWith('bearer')
        ? null
        : stripTokenFromAuthValue(auth)
}


const stripTokenFromAuthValue = authString => authString.slice(bearerLength).trim()


const bearerLength = 'bearer'.length

