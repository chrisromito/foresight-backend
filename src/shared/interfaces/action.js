/**
 * @module interfaces/action.js - Provide a consistent interface/Object-representation of a 
 */
const R = require('ramda')
const empty = {}



class Action {
    constructor(actionType, target=empty, breadCrumbs=null) {
        this.actionType = actionType
        this.target = target
        this.breadCrumbs = breadCrumbs
        this.user = null
    }

    static get [Symbol.species]() {
        /**
         * @static @method get [Symbol.species] - Helper method to distinguish
         * between class instances
         * @returns {this}
         */
        return this
    }

    _Cls() {
        return this[Symbol.species]
    }

    pushBreadCrumb(crumb) {
        this.breadCrumbs = this.breadCrumbs.concat(crumb)
        return this
    }

    toObject() {
        return {
            actionType: this.actionType,
            target: this.target,
            breadCrumbs: this.breadCrumbs,
            user: this.user
        }
    }

    static of(action) {
        const Cls = this[Symbol.species]
        return action
            ?  new Cls(action.actionType, action.target, action.breadCrumbs)
            : new Cls(null)
    }
}



/**
 * Element/DOM actions
 *================================*/
const numberOrNull = (v)=> isNaN(v) ? null : parseInt(v)

const nodeAttrs = (el)=> ({
    id: numberOrNull(el.dataset.id || el.id),
    data: R.tryCatch(
        R.compose(JSON.parse, JSON.stringify, R.prop('dataset')),
        R.identity({})
    )(el),
    name: el.dataset.name || el.name || el.title || ''
})



class EventAction extends Action {
    constructor(event=empty, data=null) {
        super(event.type, data || nodeAttrs(event.target))
    }

    static of(...args) {
        const Cls = this.constructor[Symbol.species]
        return new Cls(...args)
    }

    lift(...args) {
        /**
         * @method lift - Lift an Event into an existing EventAction,
         * and make the existing EventAction a breadcrumb in the new EventAction
         */
        return this.of(...args).pushBreadCrumb(this.toObject())
    }
}


/**
 * @class SearchAction - Interface for interacting w/
 * Instances where a user entered a value into a search field
 * 
 */
class SearchAction extends Action {
    constructor(target, breadCrumbs=null) {
        super('search', target, breadCrumbs)
    }

    fromEvent(event) {
        const Cls = this.constructor[Symbol.species]
        const nodeData = nodeAttrs(event.target)
        const targetData = {
            query: event.target.value.trim()
        }
        nodeData.data = Object.assign({}, nodeData.data, targetData)
        return new Cls(nodeData)
    }
}




module.exports = {
    Action,
    EventAction,
    SearchAction
}