import chai from 'chai'
chai.config.includeStack = true
const assert = chai.assert
import moment from 'moment'
import * as R from 'ramda'
import { IN, SET, QUERY } from '../../base'
import { Jwt } from '../model'
import { JwtService } from '../service'
import { getTestClient, getTestUser } from '../../test_utils/test_models'



describe('Jwt model allows us to store JWTs as encrypted strings', ()=> {
    let client_id = null
    let user_id = null

    before(async ()=> {
        const client = await getTestClient()
        const user = await getTestUser()
        client_id = client.id
        user_id = user.id
    })

    it('Jwt model facilitates creating a JWT token when given a user_id & client_id', done => {
        Jwt.createForUser(client_id, user_id)
            .then(token => {
                assert.equal(token.user_id, user_id,
                    'Tokens reference users')
                assert.equal(token.client_id, client_id,
                    'Tokens reference clients')
                assert.isTrue(token.is_active,
                    'Tokens are active upon creation')
                done()
            })
            .catch(done)
    })

    it(
        `
            JwtService allows us to completely validate a 
            JWT token when given an encrypted token (String)
        `,
        done => {
            QUERY`
                SELECT *
                    FROM jwt
                    WHERE user_id = ${user_id}
                    ORDER BY id DESC
                    LIMIT(1)
            `.then(
                R.pipe(
                    R.head,
                    R.prop('token')
                )
            )
            .then(JwtService(Jwt).verifyToken)
            .then(tokenResult => {
                assert.isObject(tokenResult.client,
                    'Token Results contain the full client object')
                assert.isObject(tokenResult.user,
                    'Token results give us back the full user object')
                assert.isString(tokenResult.token,
                    'Token result give us the JWT token')
                assert.equal(tokenResult.user_id, user_id,
                    'Token results give us a reference to the decoded user_id')
                assert.equal(tokenResult.client_id, client_id,
                    'Token results give us a reference to the decoded client_id')
                done()
            })
            .catch(done)
        }
    )
})


describe('Jwt service correctly marks tokens as invalid', ()=> {
    let token_ids = null

    before(async ()=> {
        const user = await getTestUser()
        const tokens = await Jwt.selectWhere({ user_id: user.id })
        token_ids = tokens.map(R.prop('id'))
    })

    it('Tokens that were created > 8 hours ago are marked invalid', done => {
        const expiredDate = moment()
            .subtract(1, 'day')
            .toDate()
        QUERY`
            UPDATE jwt
                ${SET({ created: expiredDate })}
                WHERE ${IN('id', token_ids)}
        `
        .then(()=> JwtService(Jwt).invalidateStaleTokens())
        .then(()=> Jwt.selectWhereIn('id', token_ids))
        .then(tokens => {
            tokens.forEach(token => {
                assert.isFalse(token.is_active, 'All tokens were deactivated')
            })
            done()
        })
        .catch(done)
    })
})
