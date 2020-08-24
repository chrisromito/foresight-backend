import chai from 'chai'
import { Client } from '../client'
import { Domain, Page } from '../page'
import {
    testClientData,
    testDomainData,
    testPageData,
    validUrl,
    invalidUrl,
    invalidDomainUrl
} from '../../test_utils/constants'

chai.config.includeStack = true
const assert = chai.assert


const getTestClient = ()=>
    Client.selectOneWhere(testClientData)



const createTestDomain = client_id =>
    Domain.insert({
        ...testDomainData,
        client_id
    })
    .then(()=>
        Domain.selectOneWhere({ client_id })
    )


describe(
    'Domain gives us a collection of Client URL domains.  Pages only map to valid domains.', ()=> {
        let client_id = null
        let domain_id = null
        let page_id = null

        before(async function() {
            const client = await getTestClient()
            client_id = client.id
            const domain = await createTestDomain(client_id)
            domain_id = domain.id
        })

        it('Domains reject invalid URLs', done => {
            Domain.getOrReject(invalidDomainUrl, client_id)
                .then(arg =>{
                    const message = `Domain was supposed to reject ${invalidDomainUrl}` 
                    assert.fail(arg, Promise.reject, message)
                    done(new RangeError(message))
                    return arg
                })
                .catch(e => { 
                    assert.deepEqual(
                        e,
                        [invalidDomainUrl, client_id],
                        `Domain rejected an Array containing the given URL string & the client_id`    
                    )
                    done()
                    return Promise.resolve(true)
                })
                .catch(e =>
                    Promise.resolve(
                        done(e)
                    )
                )
        })

        it('Pages get mapped to domains & clients', done => {
            Page.deleteWhere(testPageData)
                .then(()=>
                    Page.getOrCreate({
                        url: validUrl,
                        client_id,
                        domain_id,
                        ...testPageData
                    })
                )
                .then(page => {
                    assert.equal(page.client_id, client_id)
                    assert.equal(page.domain_id, domain_id)
                    done()
                    return page
                })
                .catch(e => {
                    if (Array.isArray(e)) {
                        assert.notInstanceOf(e, Array, `This is not supposed to throw an invalid url error`)
                        return done(new RangeError(`Domain was not supposed to reject ${validUrl}`))
                    }
                    else if (e instanceof Error) {
                        return done(e)
                    }
                    return done(
                        new RangeError(`WTF? ${e}`)
                    )
                })
        })
    }
)