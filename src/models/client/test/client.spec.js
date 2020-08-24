import chai from 'chai'
import { testClientData } from '../../test_utils/constants'
import { Client } from '../client'

chai.config.includeStack = true
const assert = chai.assert


const deleteTestClient = ()=> Client.deleteWhere(testClientData)


const createTestClient = ()=>
    deleteTestClient()
        .then(()=>
            Client.insert(testClientData)
        )


// eslint-disable-next-line no-undef
describe(
    'Client table allows us to store an instance of a Client/customer, their name, secret key, and public key', function() {
        this.timeout(5000)

        it('Creating a client gives us an Object with a public key, secret key, and name', done => {
            createTestClient()
                .then(client => {
                    const { name, public_key, secret_key } = client
                    const targetKeys = [name, public_key, secret_key]
    
                    targetKeys.forEach(key =>
                        assert.isNotNull(key, 'Name, public, and secret are not null')
                    )
                    done()
                })
                .catch(e => {
                    throw e
                })
        })
    }
)

