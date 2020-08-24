import {
    ASSOCIATE_MODULE,
    EQ,
    QUERY,
    TABLE,
    Model,
    extendModel
} from '../base'
import { ActionTypes } from '../constants'


const TABLE_NAME = 'action_type'

export const ActionType = extendModel(TABLE_NAME,
    model => ({
        defaultActionTypes: ActionTypes,

        getByName: name => {
            const parsed = String(name).trim().toLowerCase()
            return (QUERY`
                SELECT *
                    FROM ${TABLE(TABLE_NAME)}
                    WHERE name LIKE '%${parsed}%'
            `).then(list => list.length ? list[0] : null)
        },

        validate: arg => validator(arg, model)
    })
)


const validator = (arg, model) =>
    idNameGetter(arg, model)
        .then(value =>
            value || validationLeft()
        )
        .catch(validationLeft)


const validationLeft = () => Promise.reject(
    `ActionType.validate requires a valid 'name' or 'id' field`
)


const idNameGetter = ({ id = null, name = null }, model) =>
    id
        ? model.getById(id)
        : name
        ? model.getByName(name)
        : Promise.reject(
            `ActionType.validate requires either a 'name' or 'id' field`
        )
