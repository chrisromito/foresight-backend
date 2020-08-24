import chai from 'chai'
chai.config.includeStack = true
const assert = chai.assert
import * as R from 'ramda'
import { QUERY } from '../../base'
import { Action, ActionPath } from '../action'


const getLatestPageViewPaths = ()=>
    QUERY`
        SELECT *
            FROM page_view_path
            ORDER BY created DESC
            LIMIT(3)
    `

const getLatestActions = ()=>
    QUERY`
        SELECT *
            FROM action
            ORDER BY created DESC
            LIMIT(3)
    `

const createTestActions = ()=> {
    const actionTypeValues = R.values(Action.actionTypes)
    const meta_data = { is_test: true }
    return Promise.all(
        actionTypeValues.map(action_type_id =>
            Action.insert({
                meta_data,
                action_type_id
            })
        )
    )
}


describe('Actions provide records of application interaction', ()=> {
    it(`
        Actions have "type" and "meta_data" fields to (respectively) store:
         - the category that the action falls into
         - arbitrary information about the action itself
        `,
        done => {
            Action.insert({
                action_type_id: Action.actionTypes.interaction,
                meta_data: {
                    timestamp: Date.now(),
                    user_id: 123,
                    event_type: 'submit',
                    event_target: {
                        selector: '#test-form',
                        name: 'sign-up-form'
                    }
                }
            })
            .then(action => {
                assert.equal(action.action_type_id, Action.actionTypes.interaction,
                    'We can determine the action type when given an action')
                assert.property(action, 'meta_data',
                    'Actions have meta data')
                assert.isObject(action.meta_data,
                    'Meta data is an object, so we can store arbitrary data')
                done()
            })
            .catch(done)
        }
    )
})


describe('Action Paths create a graph structure for actions', ()=> {
    let pvps = null
    let actions = null

    before(async ()=> {
        pvps = await getLatestPageViewPaths()
        actions = await createTestActions()
    })

    it('Action Paths get mapped to actions', done => {
        // First action
        const from_action = R.head(actions)
        // Second action
        const to_action = actions[1]
        // All actions occurred on this page view
        const pvp = R.head(pvps)

        ActionPath.insert({
            parent_id: null,
            to_action_id: from_action.id,
            page_view_path_id: pvp.id
        })
        .then(first => {
            assert.isNull(
                first.parent_id,
                `Action Paths don't require a parent_id`
            )
            return ActionPath.insert({
                parent_id: first.id,
                to_action_id: to_action.id
            }).then(second => ([
                first,
                second
            ]))
        })
        .then(([first, second])=> {
            assert.equal(
                first.id,
                second.parent_id,
                `Child Action Paths point to their parent via the 'parent_id' field`
            )
            assert.equal(
                second.from_action_id,
                first.to_action_id,
                `Child Action Paths create chains via their 'from_action_id'
                    and 'to_action_id' fields, respectively`
            )

            assert.include(
                second.path,
                first.path,
                `Child Action Path 'path' fields extend their parent 'path' fields`
            )

            assert.equal(first.index, 0,
                'Action Path Chains start w/ an index = 0'
            )

            assert.equal(
                second.index,
                first.index + 1,
                'Action Path child.index = parent.index + 1'
            )

            done()
        })
        .catch(done)
    })


    it(
        `The 'lift method allows us to chain actions without requiring knowledge of the previous action`,
        done => {
            const reverseActions = actions.reverse()
            // First action
            const from_action = R.head(reverseActions)
            // Second action
            const to_action = reverseActions[1]
            // All actions occurred on this page view path
            const pvp = R.last(pvps)

            ActionPath.insert({
                parent_id: null,
                to_action_id: from_action.id,
                page_view_path_id: pvp.id
            })
            .then(first =>
                ActionPath.lift({
                    page_view_path_id: pvp.id,
                    action: to_action
                }).then(second => ([
                    first,
                    second
                ]))
            )
            .then(([first, second])=> {
                assert.equal(
                    first.id,
                    second.parent_id,
                    `Child Action Paths point to their parent via the 'parent_id' field`
                )
                assert.equal(
                    second.from_action_id,
                    first.to_action_id,
                    `Child Action Paths create chains via their 'from_action_id'
                    and 'to_action_id' fields, respectively`
                )
                done()
            })
            .catch(done)
        }
    )
})
