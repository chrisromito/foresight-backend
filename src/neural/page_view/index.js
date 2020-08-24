/**
 * 
 * Underlying System Components & Concepts:
 * -----------------------------------------
 * 
 * 1. Sub Model - Handles query logic.  Provides immutable representations of PageView (mongoose.Query) instances, and NeuralNetwork instances
 *  - Type: DataState[m] -> Future[Error, DataState[b]]
 *  - When given a DataState instance, it returns a Future bound to a 
 *     new DataState with the data set to an immutable set of mongoose.Query/mongoose.Model instances
 *  - This is where our query logic is handled
 * 
 * 2. Data Model - Performs transformations on DataSets (generally DataSets derived from SubModel functions)
 * - Type: DataState[a] -> DataState[b]
 * - When given a DataState instance, it returns an transformed DataState instance
 * 
 * 3. Network - Interacts w/ a Neural Network
 * - Type: NetworkState[a, c] -> DataState[b]
 * - When given a NetworkState bound to data + context, it returns a DataState bound to the state of the underlying Neural Network
 * 
 * 4. Controller - Describes the connection between Network, Model, and Data Model
 * - Type: (DataState, NetworkState) => c -> DataState[b]
 * 
 * 5. Module - What actually gets exposed as a NodeJS module.  This is a function that returns a Future monad
 * This ties all of the other components together.  It essentially just needs context to tell it who/what to run
 * - Type: State[a] -> Future[Error, b]
 */
const types = require('./types')
const data = require('./data/data')

module.exports = {
    types,
    data
}