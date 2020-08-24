/**
 * @module - Provide interfaces for User, UserSession, Action, and ActionTarget interactions
 */

const { Action, EventAction, SearchAction } = require('./action')
const { UserInterface } = require('./user')

module.exports = {
    ActionInterface: Action,
    EventActionInterface: EventAction,
    SearchActionInterface: SearchAction,
    UserInterface
}