const { URL } = require('url')
const { check, validationResult } = require('./express-validator/check')
const { Domain, Client, Account, User, UserSession } = require('../../models/index')
const { CreateUserFuture } = require('../user/service')
const SessionMonad = require('../user/interfaces')



/**
 * Client Fields:
 *   name
 *   description
 *   active
 *   updated
 *   created
 *   domains {ObjectId[]}
 */

const createClient = (data)=>
    Client.create({
        name: data.companyName,
        active: true,
        updated: Date.now(),
        created: Date.now()
    }).then((client)=> {
        console.log('client()')
        console.log(client)
        const url = new URL(data.website)
        return Domain.create({
            name: `${client.name} company website`,
            client: client._id,
            host: url.host,
            hostname: url.hostname,
            port: url.port,
            protocol: url.protocol,
            origin: url.origin
        }).then((domain)=> ({
            client,
            domain
        }))
    }).then((foo)=> {
        console.log('createClient.then()')
        console.log(foo)
        return foo
    })


/**
 * Account Fields
 *   client
 *   username
 *   password
 *   first_name
 *   last_name
 */
const createAccount = (request, body, clientData)=> new Promise((res, rej)=> {
        // Rename form fields so they line up w/ the Account fields
        console.log('createAccount')
        console.log(CreateUserFuture)
        CreateUserFuture({
            client: clientData.client._id,
            username: body.email,
            password: body.password1,
            first_name: body.firstName,
            last_name: body.lastName
        })
        .fork((e)=> rej(e), (v)=> res(v))
    })
    .then((userData)=> {
        console.log('pushing to session monad')
        SessionMonad(request)
            .map({
                accountId: userData.account._id,
                clientId: clientData.client._id,
                domainId: clientData.domain._id,
                user: userData.user._id,
                sessionId: userData.userSession._id
            })
        return {...userData, ...clientData}
    })





/**
 * @func createTrial - Handles two key functionalities:
 * Creates a Client instance
 * Creates a user account & associates it w/ the new Client
 */
const createTrial = [
    //-- Client Validation
    check('companyName')
        .custom((value)=>
            Client.find({
                name: new RegExp(value.trim().toLowerCase(), 'gi'),
            })
            .exec()
            .then((clients)=> clients.length
                ? Promise.reject('This client already exists')
                : Promise.resolve(true)
            )
        ),
    check('website')
        .isURL()
        .custom((value)=> 
            Domain.find({
                hostname: new URL(value).hostname    
            })
            .exec()
            .then((domains)=> domains.length
                ? Promise.reject('This client already exists')
                : Promise.resolve(true)
            )
        ),
    //-- User/Account validation
    check('password1').exists(),
    check('password2')
        .exists()
        .custom((value, { req })=> {
            if (value !== req.body.password1) {
                throw new Error('Passwords do not match')
            }
            return true
        }),
    check('email')
        .isEmail(),
    check('firstName')
        .isLength({ min: 3, max: 250 }),
    check('lastName')
        .isLength({ min: 3, max: 250 }),
    (request, response)=> {
        const errors = validationResult(request)
        if (!errors.isEmpty()) {
            return response.status(422).json({ errors: errors.array() })
        }

        return createClient(request.body)
            .then((arg)=> {
                console.log('createClient.chain()')
                console.log(arg)
                console.log(createAccount)
                return createAccount(request, request.body, arg)
            })
            .then(
                ()=> response.json({ nextUrl: '/analytics/'})
            )
            .catch((err)=> {
                console.log('ERROR!!!')
                console.log(err)
                console.log(err.fileName)
                console.log(err.lineNumber)
                return response.status(500).json({ error: String(err) })
            })
    }
]

module.exports = {
    createTrial
}