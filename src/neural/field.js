const moment = require('./moment')
const R = require('ramda')
// Stemmer - parses words to remove the 'white noise' that messes with
// string-similarity algorithms
const stemmer = require('./stemmer')
const stringSimilarity = require('./string-similarity')
const { Container, BaseApplicative } = require('../../../src/shared/functional_types/base')



const percentDifference = (a, b)=> Math.abs(a - b) / ((a + b) / 2)


/**
 * @const reduceToMap:: fn, arr => obj
 * @param {Function} fn - function that returns an Array of [key, val] pairs for the Object
 * @param {Object[]} arr - Array of values that we want to reduce into an Object (Map)
 * @returns {Object}
 */
const reduceToMap = R.curry(
    (fn, arr)=> arr.reduce((accum, item, index)=> {
        const pair = fn(accum, item, index)
        accum[pair[0]] = pair[1]
        return accum
    }, {})
)



const serializeString = R.compose(
    R.join(' '),
    R.map(stemmer),
    R.split(' '),
    R.toLower,
    R.ifElse(
        R.complement(R.isNil),
        R.identity,
        R.always('')
    )
)


const serializeValue = R.compose(
    R.clamp(0, 1),
    Math.abs,
    parseFloat
)



const nowAsNumber = Number(Date.now())

const safeDate = (value)=> (
    R.isNil(value) || !value || isNaN(value)
) ? nowAsNumber : parseFloat(value)



/**
 * @const relativeRelevance - Get the 'relative' relevance of each field
 * Ie. If 'name' had a relevance score of 23%, and the 'last_modified' field
 * was 10% relevant; how relevant was each field, relative to one another?
 * 
 * This gives us our 'output' field for Brain JS, since these are the values
 * that we ultimately need to adjust for the "ideal search-relevance"
 * 
 * @param {Object} similarity - Object of relevance scores (Floats between 0-1)
 * @returns {Object} Object w/ relativeRelevanceScores (also floats between 0-1)
 */
const relativeRelevance = (similarity)=> {
    const total = R.sum(Object.values(similarity))
    const percentRelevanceMap = Object.entries(similarity)
        .reduce((accum, pair)=> {
            const fieldName = pair[0]
            const fieldSimilarity = pair[1]
            accum[fieldName] = fieldSimilarity / total
            return accum
        }, {})
    return percentRelevanceMap
}


/**
 * Fields
 *==============================*/

class Field extends Container {
    constructor(path) {
        /**
         * @param {String|String[]} path - Either the key name, or an array of key
         * names that point to the data we want
         */
        super(path)
        const lensPath = Array.isArray(path) ? path : [path]
        this.lens = R.lensPath(lensPath)
        this.path = path
    }

    view(obj) {
        /**
         * Get the value from 'obj'
         * @param {Object} obj
         * @returns {*}
         */
        return R.view(this.lens, obj)
    }

    set(...args) {
        return R.view(this.lens, ...args)
    }

    over(...args) {
        return R.over(this.lens, ...args)
    }

    compose(fn) {
        /**
         * @method compose :: Field a => (a => Field b)=> Field b
         * @param {Function} fn - A unary function that will wrap this.view
         */
        const cls = this._Cls()
        return (obj)=> fn(
            new cls(this.lens).view(obj)
        )
    }

    serialize(obj) {
        /*
         * Base class does nothing, just gets the value
         */
        return this.view(obj)
    }

    similarity(query) {
        return (obj)=> {
            try {
                return this.view(obj) === query ? 1 : 0
            } catch(err) {
                this.catchError(err, {
                    query: query,
                    data: obj
                })
            }
        }
    }

    catchError(err, data) {
        /**
         * @method catchError - Catches errors =)
         * @param {Error} err
         * @param {*} data
         * @returns {Void}
         */
        const className = this.constructor[Symbol.species].name
        console.error(`${className} caught an error ${err.name} @ line ${err.lineNumber} in ${err.fileName}:
            ${err.message}
            Stack trace: ${err.stack}
        `)
        console.error(`${className} error data:`)
        const logData = R.tryCatch(
            JSON.stringify,
            R.identity
        )(data)
        console.error(logData)
    }
}




class TextField extends Field {

    serialize(obj) {
        return serializeString(this.view(obj))
    }

    compose(fn) {
        return (obj)=> fn(
            new TextField(this.lens).view(obj)
        )
    }

    view(obj) {
        const result = super.view(obj)
        if (!R.is(String, result)) {
            const className = this.constructor[Symbol.species].name
            const resultType = R.type(result)
            throw new TypeError(
            `${className}.view returned a value of type ${resultType} instead of a String.\n`+
            `The path that was inspected: ${this.path}\n`+
            `The object that threw this error: ${obj}`
            )
        }
        return result
    }

    similarity(query) {
        /**
         * @method similarity :: a {String}=> (obj) => {Number}
         * Get the % similarity between `query` & this.view(obj)
         * This handles string serialization prior to comparison
         * Similarity is a Number between 0 and 1 
         *
         * @param query {String}
         * @returns {Function} :: ({Object}) => {Number}
         */
        try {

            const serializedQuery = serializeString(query)
            const similarity = R.compose(
                serializeValue,
                (concreteField)=> stringSimilarity.compareTwoStrings(serializedQuery, concreteField),
                (obj)=> this.view(obj)
            )

            return similarity
        } catch(err) {
            this.catchError(err, query)
            throw err
        }
    }
}




class DateField extends Field {
    serialize(obj) {
        return parseFloat(this.view(obj))
    }

    similarity(relative_date=nowAsNumber) {
        /**
         * @method similarity :: [d=Number] => (obj) => {Number}
         * @param {Number=Number(Date.now())} relative_date - Date
         * to compare the object's Date to.
         * Date must be formatted as milliseconds since Unix Epoch,
         * like you would receive from Date.now()
         * @returns ({Object})=> {Number}
         */
        const dateAsNumber = safeDate(relative_date)
        const serializePred = R.compose(
            serializeValue,
            (obj)=> percentDifference(dateAsNumber, this.serialize(obj))
        )
        return serializePred
    }
}


const defaultConfig = {
    debug: true
}


/**
 * @class FieldSpec - Class that makes it easier to group fields together.
 * Accepts an Object of field name/Field Instance key/value pairs
 * 
 * The field map helps the `FieldSpec.similarity` method compare an Array of Objects to
 * a `query` object using the `similarity` functions of each respective field
 */
class FieldSpec {
    constructor(field_map, config=defaultConfig) {
        /**
         * @param {Field[]} field_map - An Object with the property names as keys,
         *   and values being Field instances
         * @param {Object={}} config - Optional config object,
         *   can be used for debugging and stuff
         */
        this.field_map = field_map
        this.config = config

        this._spec = null
    }

    setQuery(query_map) {
        /**
         * @method setQuery :: q => (obj {Spec})=> obj
         *   This builds out an Object of Functions using the fields' `similarity` methods
         *   which are used to build out Objects that contain the `similarity` between
         *   the query Object (user input) to the Output Object (concrete data)
         * @param {Object} query_map - The Object of query key/value pairs
         * @returns {Object}
         */
        const field_map = this.field_map
        const querySimilarity = (map_key)=> field_map[map_key].similarity(query_map[map_key])
        
        const queryMap = reduceToMap(
            (accum, item)=> [item, querySimilarity(item)],
            Object.keys(field_map)
        )

        this._spec = queryMap
        return queryMap
    }

    similarity(query_map, data) {
        /**
         * @method similarity :: d => l
         * Get comparison values for an Object's key/val pairs 
         * using this._spec as the 'spec' to compare each of the Object's
         * key/val pairs to their respective key/val pairs on the `data` object
         * 
         * @param {Object} query_map - Query data to compare each object to
         * @param {Object} data - Data to compare to the query data
         * @returns {Object[]} Object where the keys are field names
         *                     & values are comparison values (Floats between 0-1)
         */
        const field_map = this.field_map
        // CR 2019-Mar-31: Commenting out this "optimization" to determine if
        // it's the root cause of some comparisons staying cached
        // const specMap = this._spec ? this._spec : this.setQuery(query_map)
        const specMap = this.setQuery(query_map)

        // specMap provides a way to look up the predicate
        // returned by `myField.similarity()`. Build out an Object like { field_name: comparison_value }
        return reduceToMap(
            (accum, item)=> [item, specMap[item](data)],
            Object.keys(field_map)
        )
    }

    toPair(query_map, data) {
        /**
         * @method toPair - Get the relative relevance scores for `data`
         * Calls `similarity` internally, so we can get the % similarity relative to the query data,
         * then uses the % similarity (relevance) to get the relative relevance of each field
         * 
         * @param {Object} query_map
         * @param {Object} data
         * @returns {Object} - Object of floats between 0-1.  
         */
        const relevanceMap = this.similarity(query_map, data)
        return {
            input: relevanceMap,
            output: relativeRelevance(relevanceMap)
        }
    }
}


/**
 * @class ActionFieldSpec - This extends FieldSpec, based on the assumption
 * that this FieldSpec needs to inspect an `Action`'s `target.data` when
 * comparing an Action to a Query
 */
class ActionFieldSpec extends FieldSpec {

    toPair(query_map, data) {
        const targetDataLens = R.lensPath(['target', 'data'])
        return super.toPair(
            query_map,
            R.view(targetDataLens, data)
        )
    }
}


module.exports = {
    reduceToMap,
    percentDifference,
    serializeString,
    serializeValue,
    Field,
    TextField,
    DateField,
    FieldSpec,
    ActionFieldSpec
}
