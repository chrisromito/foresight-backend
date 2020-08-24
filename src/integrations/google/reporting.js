const moment = require('./moment')
const R = require('ramda')
const Io = require('../../../../src/shared/functional_types/io')
require('mongoose')
const { Account, Client, Google } = require('../../models/index')
const { GoogleService } = require('./service')
const { google } = require('./googleapis')


/**
 * Metrics & Dimensions
 */

const mapToMetrics = strList =>
    strList.map(expression => ({ expression }))


const mapToDimensions = strList =>
    strList.map(name => ({ name }))


const EVENT_DIMENSIONS = mapToDimensions([
    'ga:eventCategory',
    'ga:eventAction',
    'ga:eventLabel'
])


const EVENT_METRICS = mapToMetrics([
    'ga:totalEvents',
    'ga:eventValue',
    'ga:sessionsWithEvent'
])


const PAGE_DIMENSIONS = mapToDimensions([
    'ga:pagePath',
    'ga:pageTitle',
    'ga:landingPagePath',
    'ga:exitPagePath',
    'ga:pageDepth'
])


const PAGE_METRICS = mapToMetrics([
    'ga:entrances',
    'ga:pageviews',
    'ga:uniquePageViews',
    'ga:timeOnPage',
    'ga:exits'
])


const SOURCE_DIMENSIONS = mapToDimensions([
    'ga:source',
    'ga:sourceMedium'
])


const USER_REPORTING_METRICS = mapToMetrics([
    'ga:users',
    'ga:newUsers',
    'ga:percentNewSessions',
    'ga:sessionsPerUser',
])


/**
 * Reporting
 */


/**
 * @func googleReports - Curried function that auto-magically handles
 * the boilerplate of fetching the Google Accounts, pulling out the profile/view IDs, etc.
 * 
 * 
 */
const googleReport = gAuth => {
    const gAnalytics = google.analytics({
        auth: gAuth,
        version: 'v3'
    })
    const gReporting = google.analyticsreporting({
        auth: gAuth,
        version: 'v4'
    })

    const googleAccounts = gAnalytics.management.accountSummaries.list()
        .then(accountResponse => {
            const profileIds = accountResponse.data.items
                .map(R.prop('webProperties'))
                .flat()
                .flatMap(R.prop('profiles'))
                .flatMap(R.prop('id'))

            const viewId = R.head(profileIds)
            return viewId
        })

    return (startDate, endDate, metrics=[], dimensions=[]) =>
        googleAccounts
            .then(viewId => 
                gReporting.reports.batchGet({
                    requestBody: {
                        reportRequests: [{
                            dimensions,
                            metrics,
                            viewId,
                            dateRanges: [{
                                startDate: moment(startDate).format('YYYY-MM-DD'),
                                endDate: moment(endDate).format('YYYY-MM-DD')
                            }]
                        }]
                    }
                })
                .then(arg => {
                    console.log('viewId:')
                    console.log(viewId)
                    return arg
                })
            )
            .then(R.prop('data'))
}





module.exports = {
    googleReport,
    EVENT_DIMENSIONS,
    EVENT_METRICS,
    PAGE_DIMENSIONS,
    PAGE_METRICS,
    SOURCE_DIMENSIONS,
    USER_REPORTING_METRICS
}
