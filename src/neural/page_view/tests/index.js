/**
 * @module neural/page_view/tests/index - Tests for Page View Neural Networks & Pipelines
 * TODO: (CR 2019-May-18) Add chain methods for 'Network', 'Controller', & 'Module' when they are complete
 * TODO: (CR 2019-May-18) Implement tests for the above
 */
const R = require('ramda')
const { Future } = require('ramda-fantasy')
const { User, Action, Client, Domain, Page, PageView, NeuralStep } = require('../../../models/index')
const { DataState } = require('../types')
const {
    NeuralModel,
    NeuralSubModel,
    PvModel,
    PvSubModel,
    clientPageViewsSince
} = require('../data')

const {
    getTestAccounts,
    getTestClient,
    getTestDomain,
    getTestPages,
    getTestUsers,
    testDomainUrl
} = require('../../test_data/index')


const getClientId = ()=> Future((reject, resolve)=>
    getTestClient()
        .then((c)=> c._id)
        .then(resolve)
        .catch(reject)
)

//-- Begin pipeline

// Data Chain methods
const getInitialDataState = ()=> getClientId()
    .map((id)=> new DataState({}, { clientId: id }))


const testNeuralSubModel = ()=> getInitialDataState()
    .chain((dataState)=> NeuralSubModel().getLastStep(dataState))


const testNeuralModel = ()=> testNeuralSubModel()
    .map((dataState)=> NeuralModel(dataState).getLastStep(dataState).value())


const testPvSubModel = ()=> testNeuralModel()
    .chain((dataState)=>
        PvSubModel(dataState).pageViewsSince()
    )


const testPvModel = ()=> testPvSubModel()
    .map((dataState)=> PvModel.of(dataState))


const getPvModel = ()=> new Promise((resolve, reject)=>
    testPvModel.fork(reject, resolve)
)



// TODO: Chain 'Network', 'Controller', & 'Module' into the data pipeline when they are complete
// TODO: Implement tests for the above

module.exports = {
    testNeuralSubModel,
    getInitialDataState,
    testNeuralModel,
    testPvSubModel,
    testPvModel,
    getPvModel,

    // TODO: Delete these vv from module.exports after test are implemented
    // Shell/REPL helpers
    R,
    Future,
    User,
    Action,
    Client,
    Domain,
    Page,
    PageView,
    NeuralStep,

    NeuralModel,
    NeuralSubModel,
    PvModel,
    PvSubModel,
    clientPageViewsSince,

    getTestAccounts,
    getTestClient,
    getTestDomain,
    getTestPages,
    getTestUsers,
    testDomainUrl
}



const COPY_PASTE_INTO_REPL = `



var neural_pv_tests = {
    testNeuralSubModel,
    getInitialDataState,
    testNeuralModel,
    testPvSubModel,
    testPvModel,

    // Shell/REPL helpers
    R,
    Future,

    NeuralModel,
    NeuralSubModel,
    PvModel,
    PvSubModel,
    clientPageViewsSince,

    getTestAccounts,
    getTestClient,
    getTestDomain,
    getTestPages,
    getTestUsers,
    testDomainUrl
} = require('./src/server/neural/page_view/tests/index')

const { User, Action, Client, Domain, Page, PageView, NeuralStep } = require('./src/server/models/index')


var onResolve = (x)=> {
    console.log('onResolve')
    console.log(x)
    neuralSub = x
    return x
}

var onReject = (err)=> {
    console.log('onReject()')
    console.log(err)
    return err
}


var pvModel = null

testPvModel().fork(onReject, (dataState)=> {
    pvModel = dataState
    return dataState
})

`
