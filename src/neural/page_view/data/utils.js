const { compose, keys } = require('ramda')


const transformModels = compose(JSON.parse, JSON.stringify)


const modelFields = (model)=> model.schema.obj


const modelFieldNames = compose(keys, modelFields)


module.exports = {
    modelFields,
    modelFieldNames,
    transformModels,
}
