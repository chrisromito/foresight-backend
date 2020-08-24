const { getTestPages, PageStats } = require('./page')
const page = require('./page')

const users = require('./user_generator')
const { getTestAccounts, getTestUsers, generateRandomAccounts, generateRandomSearchActions } = require('./user_generator')

const clients = require('./clients')
const { getTestClient, getTestDomain, testDomainUrl } = require('./clients')

module.exports = {
    page,
    getTestPages,
    PageStats,

    users,
    getTestAccounts,
    getTestUsers,
    generateRandomAccounts,
    generateRandomSearchActions,

    clients,
    getTestClient,
    getTestDomain,
    testDomainUrl
}