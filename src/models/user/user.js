import bcrypt from 'bcrypt'
import { Model } from '../base'


const SALT_WORK_FACTOR = 10


/**
 * @typedef {Object} user
 * @property {Number} id
 * @property {(Number|null)} account_id
 * @property {Number} client_id
 * @property {Number} session_id
 * @property {Boolean} active
 * @property {Date} created
 * @property {(Date|null)} updated
 */

export const User = Model('app_user')
export default User


/**
 * @typedef {Object} account
 * @property {Number} id
 * @property {String} first_name
 * @property {String} last_name
 * @property {String} password - Encrypted password
 * @property {String} email - Email address that they use to log in
 * @property {(Object|null)} meta_data - Optional info that we pass around for the account
 *      - Can reference login methods, integrations, etc
 *      - Ex. { isGoogleSso: true }
 *      - DO NOT DO: { googleSessionId: 'This is ephemeral, so store it on the user instead'}
 * @property {Date} created
 * @property {(Date|null)} updated
 */

export const Account = Model('account')


/**
 * @func validatePassword - Validate a text pw against an encrypted pw.
 * This will reject with the following types/reasons:
 * - Error: An error occurs
 * - null : The password is invalid
 * 
 * @param {String} textPw - Potentially valid password entered by the user
 * @returns {function(String): Promise} 
 */

export const validatePassword = textPw => encrypted =>
    new Promise((resolve, reject)=>
        bcrypt.compare(
            textPw,
            encrypted,
            (err, success)=>
                err
                ? reject(err)
                : success
                    ? resolve(success)
                    : reject(null)
        )
    )


const genHash = textPw => salt =>
    new Promise((resolve, reject)=> 
        bcrypt.hash(
            textPw,
            salt,
            (err, hash)=> err ? reject(err) : resolve(hash)
        )
    )


/**
 * @func encryptPassword - Transform a plain text password
 * into an encrypted one
 * @param {String} textPw
 * @returns {String} encrypted pw
 */

export const encryptPassword = textPw =>
    new Promise((resolve, reject)=>
        bcrypt.genSalt(
            SALT_WORK_FACTOR,
            (err, salt)=>
                err
                    ? reject(err)
                    : genHash(textPw)(salt)
                        .then(resolve)
                        .catch(reject)
        )
    )


/**
 * @func createAnonymousUser - Create a user instance without an associated account
 * @param {(Number|null)} sessionId
 * @param {Number} clientId
 * @returns {Promise<user>}
 */

export const createAnonymousUser = (sessionId, clientId)=>
    User.insert({
        client_id: clientId,
        session_id: sessionId
    })
