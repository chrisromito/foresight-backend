import jwt from 'jsonwebtoken'
import {
    ASSOCIATE_MODULE,
    extendModel
} from '../base'
import { JwtService } from './service'


/**
 * @typedef {Object} Token - JSON Web Token representation
 * @property {Number} client_id - Client who's "secret_key" was used
 * to generate the JWT
 * @property {Number} user_id - User that the token was issued to
 * @property {String} token - JSON string representation of the JWT
 * @property {Boolean} is_active - Is this token still active?
 * @property {Date} [created=Date.now()] - Timestamp for when the token was created
 */


export const Jwt = extendModel('jwt', model => ({
    /**
     * @method createForUser - Create a JWT token for the given user
     * & client
     * @param {Number} client_id
     * @param {Number} user_id
     * @returns {Promise<Token>}
     */
    createForUser: JwtService(model).createForUser,

    assocClient: ()=>
        ASSOCIATE_MODULE`
            - client ${{
                left_key: 'client_id',
                key: 'id',
                table: 'client'
           }}
        `,

    assocUser: ()=>
        ASSOCIATE_MODULE`
            - user ${{
                left_key: 'user_id',
                key: 'id',
                table: 'app_user'
            }}
        `,
}))

export default Jwt

