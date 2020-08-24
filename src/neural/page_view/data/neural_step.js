/**
 * @module data.neural_step - Provides the SubModel & DataModel components for NeuralSteps
 */
const R = require('ramda')
const { Future, Maybe } = require('ramda-fantasy')
const { Page, PageView, NeuralStep } = require('../../../models')
const { transformModels } = require('./utils')

/**
 * @typedef {import('../types').NetworkState} NetworkState
 */

 /**
  * @typedef {Object} Context - The shape that NetworkState._context needs to have
  * for this interface
  * 
  * @property {String} clientId - The ObjectId for this client/customer
  * @property {Date} minDate - The min date this Network's data will analyze
  * @property {Date} maxDate - The max date this Network's data will analyze
  * @property {Number} trainingType - Constant value associated w/ the type of Network being run
  */


  
/**
 * @func baseQuery - The 'base' NeuralStep query to build off of when referencing a Client's PageViews
 * @param {NetworkState} networkState
 * @returns {PageView.Query}
 */
function baseQuery(networkState) {
    return NeuralStep.find({
        client: networkState.context().clientId,
        originModel: 'PageView'
    })
}

/**
 * @func createNeuralStep - Create a NeuralStep document
 * @returns {Promise<NetworkState[NeuralStep, Context]>}
 */
function createNeuralStep(networkState, network, { fields, origin=null, originModel='PageStats' }) {
    const context = networkState.context()

    const data = {
        client: context.clientId,
        origin: origin,
        originModel: originModel,
        fields: fields,
        data: new Map(),
        meta: JSON.stringify(network.toJSON()),
        state: {
            startDate: context.minDate,
            endDate: context.maxDate,
            running: !context.endSession
        }
    }
    return new NeuralStep(data)
        .save()
        .then((ns)=> networkState.mapData(()=> ns))
}


const pushBatchState = (networkState, {meta=false, data=false}, { totalBatchSize=0, amountPerBatch=100, batchState=null })=> {
    const neuralStep = networkState.data()
    neuralStep.state = R.mergeDeepRight(neuralStep.state, {
        amountPerBatch,
        batchState,
        totalBatchSize,
        running: true
    })
    neuralStep.meta = meta || neuralStep.meta
    neuralStep.data = data || neuralStep.data
    
    return neuralStep.save()
        .then((step)=> networkState.mapData(()=> step))
}


module.exports = {
    baseQuery,
    createNeuralStep,
    pushBatchState,
}
