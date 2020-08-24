import * as R from 'ramda'
import { Model, EQ, TABLE, QUERY, VALUES } from '../base'
import {
    DefaultTagTypes,
    Scope
} from '../constants'


/**
 * @typedef {Object} validTagId
 * @property {Number} id
 */
/**
 * @typedef {Object} validTagPair
 * @property {String} name
 * @property {Number} tag_type_id
 * @property {String|null} description
 * @property {Number|null} parent_id
 * @property {Number|null} scope
 */

/**
 * @typedef {validTagId | validTagPair} tagData
 */

const isNotNull = R.complement(R.isNil)


const propIsNotNull = R.propSatisfies(isNotNull)


const validateId = propIsNotNull('id')


const validateTagPair = R.allPass([
    propIsNotNull('name'),
    propIsNotNull('tag_type_id')
])


const validateTag = tagData => R.has('id', tagData)
    ? validateId(tagData)
    : validateTagPair(tagData)


const liftTag = tagData => {
    const isString = R.is(String, tagData)
    const name = isString
        ? tagData.trim()
        : tagData.name.trim()
    const tag_type_id = tagData.tag_type_id || DefaultTagTypes.unCategorized
    const description = tagData.description || null
    return {
        name,
        description,
        tag_type_id,
        scope: Scope.client
    }
}


/**
 * @func Tag - Tag model/table
 */
const Tag_ = ()=> {
    const name = 'tag'
    const model = Model(name)

    return {
        ...model,
        model,
        scopes: Scope,
        tagTypes: DefaultTagTypes,
        associateWithClient: (tagId, clientId)=>
            ClientTag.assoc(clientId, tagId),

        forClient: clientId =>
            ClientTag.selectTagsFor(clientId),

        validate: validateTag
    }
}

export const Tag = Tag_()



/**
 * @func MappedTagTable - Generic model for creating a m2m relationship between
 * tags & another table. Ex. Client Tags, User Tags, & Page View Path Tags)
 * NOTE: This assumes that there's a unique constraint between `tag_id` & the alias_id.
 * To ensure that this exists, one could run the following on the client_tag table:
 * ```
 * alter table client_tag
 *     add unique (client_id, tag_id);
 * ```
 * 
 * @param {String} name - Name of the m2m table
 * @param {String} aliasField - Name of the other column.
 *                              Ex. `client_id` for client_tag table
 * @returns {Object.<String, function(*): *>}
 */
export const MappedTagTable = (name, aliasField)=> {
    const model = Model(name)
    const mapAlias = aliasId => ({ [aliasField]: aliasId })
    const recursive = ()=> MappedTagTable(name, aliasField)

    return {
        ...model,
        aliasField,
        mapAlias,
        recursive,

        /**
         * @method assoc - Associate a tag with the given aliasId
         * This 
         */
        assoc: (aliasId, tag_id)=> {
            const fields = { tag_id, ...mapAlias(aliasId)}
            return (
                QUERY`
                    INSERT INTO ${TABLE(name)}
                        ${VALUES(fields)}
                        ON CONFLICT DO NOTHING;
                `
            ).then(()=> 
                QUERY`
                    SELECT *
                        FROM ${TABLE(name)}
                        WHERE ${EQ(fields)}
                `
            )
        },

        /**
         * @method mapMany - Get or a create a list of tags, then map them
         * to the aliasId
         * @param {Number} aliasId
         * @param {tagData[]} tagList - List of `tagData` objects.  Ie. Either a list of objects
         * w/ 'id' properties, or the other required tag properties
         * @returns {Promise}
         */
        mapMany: (aliasId, tagList)=> {
            const validTagList = tagList.filter(validateTag).map(liftTag)
            return Promise.all(
                validTagList.map(obj => {
                    const resolver = validateId(obj)
                        ? Tag.getById(obj.id)
                        : Tag.getOrCreate({ name: obj.name }, obj)
                    return resolver.then(tag => tag ? tag.id : null)
                })
            ).then(tagIdList => {
                const ids = R.uniq(R.filter(isNotNull, tagIdList))
                return Promise.all(
                    ids.map(id => recursive().assoc(aliasId, id))
                )
            })
        },

        /**
         * @method selectTagsFor - Get the Tags that have a relationship
         * in the alias table.
         * @param {Number} aliasId - Value of the alias field.  Ex. a clientId, user Id, etc.
         * @returns {Promise<Object[]>}
         */
        selectTagsFor: aliasId => {
            const field = mapAlias(aliasId)
            const aliasTable = `${name} as ta`
            return QUERY`
                SELECT *
                    FROM ${TABLE('tag as tt')}
                    INNER JOIN ${TABLE(aliasTable)} on ta.tag_id = tt.id
                    WHERE ${EQ(field)}
            `
        }
    }
}


export const ClientTag = MappedTagTable('client_tag', 'client_id')
