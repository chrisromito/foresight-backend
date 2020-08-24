const moment = require('./moment')
const R = require('ramda')
const Io = require('../../../../src/shared/functional_types/io')
require('mongoose')
const { Account, Client, Google } = require('../../models/index')
const { toPojo } = require('../../utils/common')
const { GoogleService } = require('./service')
const { google } = require('./googleapis')
const {
    googleReport,
    EVENT_DIMENSIONS,
    EVENT_METRICS,
    PAGE_DIMENSIONS,
    PAGE_METRICS,
    SOURCE_DIMENSIONS,
    USER_REPORTING_METRICS
} = require('./reporting')




/**
 * Utils
 */
const testClientData = {
    name: 'The Local Host',
    description: 'Living right in your computer',
    sortOrder: 0
}

const getTestClient = () =>
    Client.findOne({ name: testClientData.name })
        .exec()
        .then((client) => client._id)


const getTestAccount = ({ client }) =>
    Account.findOne({ 
        username: 'chrisacreative@gmail.com'
     }).exec()
        .then((a) => a._id)

const getUserContext = () =>
    getTestClient()
        .then((client) =>
            getTestAccount(client)
                .then((account) => ({
                    account,
                    client
                }))
        )

    

const getTestGoogle = () =>
    getUserContext()
        .then(({ account, client }) =>
            Google.findOne({ client })
                .exec()
        )


/**
 * Analytics Reporting API
 * @see https://github.com/googleapis/google-api-nodejs-client/blob/master/samples/analyticsReporting/batchGet.js
 */

 


const googleObj = ()=> getUserContext()
    .then(({ account, client })=>
        GoogleService({}, null)
            .getG(client, account)
    ).then((gAuth)=> ({
        gAuth,
        analytics: google.analytics({
            auth: gAuth,
            version: 'v3'
        }),

        reporting: google.analyticsreporting({
            auth: gAuth,
            version: 'v4'
        })
    })).catch((e)=> {
        console.log(`googleObj says: NO GOOGLE FOR YOU!`)
        console.log(e)
        console.log(e.stack)
        return e
    })


const userReport = gAuth =>
    googleReport(gAuth)(
        moment().subtract(30, 'days'),
        moment(),
        USER_REPORTING_METRICS
    )


const pageReport = gAuth =>
    googleReport(gAuth)(
        moment().subtract(30, 'days'),
        moment(),
        PAGE_METRICS,
        PAGE_DIMENSIONS
    )




const COPY_PASTE = `
var R = require('ramda')
var meow = {
    getUserContext,
    getTestClient,
    getTestAccount,
    getTestGoogle,
    googleObj,
    google,
    getProfileViews,
    googleReport,
    userReport,
    pageReport
} = require('./src/server/integrations/google/test')


var Go = null
var gAuth = null
var reporting = null
var analytics = null
var userResp = null
var pageResp = null



googleObj().then((go)=> {
    Go = go
    gAuth = go.gAuth
    reporting = go.reporting
    analytics = go.analytics
    return go
}).then(()=> {
    return userReport(gAuth).then(resp => userResp = resp).then(()=> {
        console.log('user report complete')
    })
}).then(()=> {
    return pageReport(gAuth).then(resp => pageResp = resp).then(()=> {
        console.log('page report complete')
    })
}).catch(e => {
    console.log('FUCKING ERROR')
    console.log(e)
    return Promise.resolve(e)
})






`


module.exports = {
    getUserContext,
    getTestClient,
    getTestAccount,
    getTestGoogle,

    googleObj,
    google,
    googleReport,
    userReport,
    pageReport
}
