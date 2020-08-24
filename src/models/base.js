import { assoc, head, isNil, prop } from 'ramda'
import * as config from './config'
import {
    COLUMN,
    EQ,
    QUERY,
    IN,
    SET,
    TABLE,
    VALUES
} from './config'
export * from './config'


export const cast = typeMap => {
    const typePairs = Object.entries(typeMap)
    return obj =>
        typePairs.reduce(
            (accum, [k, v])=>
            assoc(
                k, 
                v( prop(k, obj) ),
                accum
            ),
            {...obj}
        )
}


export const Model = tableName => ({
    tableName,
    cast,
    name: tableName,
    errorHandler: err => {
        try {
            if (err.message && err.constructor) {
                const extended = new err.constructor(`${tableName} -> ${err.message}`)
                extended.stack = err.stack
                return Promise.reject(extended)
            }
        } catch(e) {}
        return Promise.reject(err)
    },

    get meta() {
        return config
    },

    /**
     * @method selectWhere - SELECT
     * @param {Object} where
     * @param {String[]|null} [columns=null] - Columns to grab
     * @returns {Promise}
     */
    selectWhere: (where, columns=null) =>
        QUERY`
            SELECT ${COLUMN(columns || '*')}
                FROM ${TABLE(tableName)}
                WHERE ${EQ(where)}
        `,

    /**
     * @borrows selectWhere as findWhere
     */
    findWhere: (...args) => Model(tableName).selectWhere(...args),

    /**
     * @method selectWhereIn - SELECT WHERE IN ...
     * @param {String} columnName
     * @param {*[]} list - List of values to filter by
     * @param {String[]|null} [columns=null] - Columns to grab
     * @returns {Promise<Object[]>}
     */
    selectWhereIn: (columnName, list, columns=null)=>
        QUERY`
            SELECT ${COLUMN(columns || '*')}
                FROM ${TABLE(tableName)}
                WHERE ${IN(columnName, list)}
        `,

    /**
     * @borrows selectWhereIn as findIn
     */
    findIn: (...args)=> Model(tableName).selectWhereIn(...args),

    /**
     * @method selectOneWhere - Get 1 or null
     * @param {Object} where
     * @param {String[]|null} [columns=null] - Columns to grab
     * @returns {Promise<Object[]|null>}
     */
    selectOneWhere: (where, columns=null)=>
        (QUERY`
            SELECT ${COLUMN(columns || '*')}
                FROM ${TABLE(tableName)}
                WHERE ${EQ(where)}
                LIMIT(1)
        `)
        .then(list => list.length ? head(list) : null),
    
    /**
     * @borrows selectOneWhere as findOneWhere
     */
    findOneWhere: (...args)=> Model(tableName).selectOneWhere(...args),

    /**
     * @method insert - Create a new record
     * @param {Object} newData
     * @returns {Promise<Object>}
     */
    insert: newData =>
        (QUERY`
            INSERT INTO ${TABLE(tableName)}
                ${VALUES(newData)}
                RETURNING *
        `)
        .then(head)
        .catch(e =>
            Model(tableName).errorHandler(e)
        ),

    /**
     * @method updateWhere
     * @param {Object} where
     * @param {Object} newData
     * @returns {Promise<Object[]|null>}
     */
    updateWhere: (where, newData)=>
        (QUERY`
            UPDATE ${TABLE(tableName)}
                ${SET(newData)}
                WHERE ${EQ(where)}
                RETURNING *
        `)
        .catch(e =>
            Model(tableName).errorHandler(e)
        ),

    /**
     * @method updateIn - UPDATE WHERE IN ...
     * @param {String} columnName
     * @param {*[]} list - List of values to filter by
     * @param {Object|null} newData - Object containing values for matching rows
     * @returns {Promise<Object[]>}
     */
    updateIn: (columnName, list, newData)=>
        QUERY`
            UPDATE ${TABLE(tableName)}
                ${SET(newData)}
                WHERE ${IN(columnName, list)}
                RETURNING *
        `,

    /**
     * @method deleteWhere - DELETE WHERE
     * @param {Object} where
     * @returns {*}
     */
    deleteWhere: where =>
        QUERY`
            DELETE FROM ${TABLE(tableName)}
                WHERE ${EQ(where)}
        `,

    //-- Generic helper methods
    getById: id =>
        isNil(id)
            ? Promise.resolve(null)
            : (QUERY`
                SELECT * 
                    FROM ${TABLE(tableName)}
                    WHERE id = ${id}
                    LIMIT(1)
            `)
            .then(rows =>
                rows.length
                    ? head(rows)
                    : null
            ),

    /**
     * @method getOrCreate - Get a row based on `where`,
     * if one does not exist, create one with `data`
     * @param {Object} where
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    getOrCreate: (where, data)=>
        (QUERY`
            SELECT * 
                FROM ${TABLE(tableName)}
                WHERE ${EQ(where)}
                LIMIT(1)
        `)
        .then(rows =>
            rows.length
                ? head(rows)
                : Model(tableName).insert(data)
        )
})



const applyMixin = ctor => (arg, callback) => {
    const base = ctor(arg)
    const extension = {
        ...base,
        ...callback(base),
        base  // Deliberately set the property 'base' to the base constructor
    }
    // Return a flattened object containing the
    // callback again, this time with the (composed) extension
    return {
        ...extension,
        ...callback(extension),
        base
    }
}


export const extendModel = applyMixin(Model)


/**
 * @example

var MyExtendModelExample = extendModel(
    'my_extended_model_table_name',
    model => ({
        myMethod: data => {
            console.log('myExtension -> myMethod')
            console.log(data)
            return model.insert({ myMethodKey: 'myMethodValue', ...data })
        },
        myMixinMethod: data => {
            console.log('myExtension -> myMixinMethod')
            console.log(data)
            return model.myMethod({ myMixinKey: 'myMixinValue', ...data })
        }
    })
)

var myExtendedValue = myExtendedModelExample.myMixinMethod({ test: 'has myMethod and myMixinMethod})
assert.equal(myExtendedValue.myMixinKey, 'myMixinValue')
assert.equal(myExtendedValue.myMethodKey, 'myMethodValue')

 */


//
