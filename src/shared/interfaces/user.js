const Maybe = require('maybe')
const R = require('ramda')

const dateToInt = (mDate)=> mDate.isJust() ? mDate.value() : null

const intToDate = (mInt)=> mInt.isJust() ? new Date(mInt.value()) : null

const serializeField = (key)=> R.over(
    R.lensPath([key]),
    R.pipe(Maybe, dateToInt)
)

const deserializeField = (key)=> R.over(
    R.lensPath([key]),
    R.pipe(Maybe, intToDate)
)

const serializeFields = (fields, obj)=> fields.reduce((accum, field)=> serializeField(field), obj)

const deserializeFields = (fields, obj)=> fields.reduce((accum, field)=> deserializeField(field), obj)





class UserInterface {
    constructor(user) {
        this.user = user
    }

    toObject(merge=false) {
        /**
        * @method toObject :: => {Object}
        * @property {String} id
        * @property {(Object | null)} account
        * @property {Boolean} active
        * @property {String} uuid
        * @property {Date} created
        * @property {Date} updated
        */
        let obj = {
            id: (this.user._id || this.user.id).toString(),
            account: this.user.account || null,
            active: this.user.active,
            uuid: this.user.uuid,
            created: this.user.created,
            updated: this.user.updated
        }

        return merge ? Object.assign({}, this.user, obj) : obj
    }

    serialize() {
        /**
        * @method serialize - Transform a DB model into a user-facing representation
        * Casts Date fields (created/updated) into integers
        * @returns {Object}
        */
        return serializeFields(['created', 'updated'], this.toObject())
    }

    deserialize() {
        return deserializeFields(['created', 'updated'], this.toObject())
    }
}

exports.UserInterface = UserInterface