const { URL } = require('url')
const { Client, Domain } = require('../../models/index')


// const testDomainUrl = new URL('https://www.action_tracker_test.com')
const localHost = 'http://0.0.0.0:8080'
const testDomainUrl = new URL(localHost) // Lol

const testClientData = {
    name: 'The Local Host',
    description: 'Living right in your computer',
    sortOrder: 0
}

//-- Client Data
const createTestClient = ()=> new Client(testClientData).save()


const getOrCreateTestClient = ()=>
    Client.find({ name: testClientData.name })
        .exec()
        .then((clients)=>
            !clients.length
                ? createTestClient()
                : clients[0]
        )


//-- Domain Data
const createTestDomain = (urlObj)=> (clientId)=>
    new Domain({
        client: clientId,
        host: urlObj.host,
        hostname: urlObj.hostname,
        port: urlObj.port,
        protocol: urlObj.protocol,
        origin: urlObj.origin
    })
    .save()


const getTestDomain = ()=> 
    Domain.findOne({ host: testDomainUrl.host })
        .exec()


//-- All together now
const getClientTestData = ()=>
    Domain.find({ host: testDomainUrl.host })
        .exec()
        .then((domains)=>
            !domains.length
                ? createTestDomain()
                : domains[0]
        )
        .then((domain)=>
            getOrCreateTestClient()
                .then((client)=> {
                    client.domains = [domain._id]
                    return client.save()
                })
                .then((client)=> ({
                    client,
                    domain
                }))
        )


module.exports = {
    getTestDomain,
    localHost,
    testDomainUrl,
    getClientTestData
}
