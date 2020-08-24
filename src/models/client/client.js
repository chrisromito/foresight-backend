import  crypto from 'crypto'
import { extendModel } from '../base'


/**
 * @func generateToken - Generate a cryptographic key for 
 * a client's public and secret keys
 */
export const generateToken = ()=>
    new Promise((resolve, reject)=>
        crypto.randomBytes(
            48,
            (err, buffer)=>
                err
                    ? reject(err)
                    : resolve(buffer.toString('hex'))
        )
    )

/**
 * @typedef {Object} client
 * @property {String} name
 * @property {Number|null} account_id - Account for the user that
 *     owns the account and/or is the point-of-contact
 * @property {Date|null} trial_start
 * @property {Date|null} trial_end
 * @property {Object|null} meta_data
 * @property {Date|null} created
 * @property {Date|null} updated
 * @property {String} public_key - Key used to identify clients (REST API calls)
 * @property {String} secret_key - Key used to encrypt user JWTs
 */
export const Client = extendModel('client',
    model => ({
        insert: data =>
            Promise.all([
                generateToken(),
                generateToken()
            ]).then(([secret_key, public_key])=>
                model.base.insert({
                    ...data,
                    secret_key,
                    public_key
                })
            ),

        getOrCreate: (where, data)=>
            model.selectOneWhere(where)
                .then(client =>
                    client
                        ? client
                        : Client.insert(data)
                )
    })
)




/**
 * @func validPublicKey - Check if a clientKey (received from a request)
 * is valid for the given client Object
 * @param {String} clientKey
 * @returns {function(Object): Boolean}
 */
export const validPublicKey = clientKey => client => clientKey === client.public_key


/**
 * @func isValidClient
 * @param clientKey
 * @returns {Promise}
 */
export const isValidClient = clientKey =>
    Client.findOneWhere({ public_key: clientKey })
        .then(client =>
            client && validPublicKey(clientKey)(client)
                ? Promise.resolve(client)
                : Promise.reject(client)
        )
