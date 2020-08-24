import * as R from 'ramda'
import { ASSOCIATE_MODULE, extendModel, QUERY } from '../base'
import { StatTypes } from '../constants'



export const getOrCreateForPair = model => fkName => (goal_id, fkId)=>
    model.getOrCreate(
        { goal_id, [fkName]: fkId },
        { goal_id, [fkName]: fkId}
    )


export const GoalAction = extendModel('goal_action',
    model => ({
        assoc: () =>
            ASSOCIATE_MODULE`
                x actions ${{
                    left_key: 'id',
                    left_xkey: 'goal_id',
                    xtable: 'goal_action',
                    xkey: 'action_id',
                    key: 'id'
                }}
            `,
        getOrCreateForPair: getOrCreateForPair(model)('action_id')
    })
)


export const GoalTag = extendModel('goal_tag',
    model => ({
        assoc: () =>
            ASSOCIATE_MODULE`
                x tags ${{
                    left_key: 'id',
                    left_xkey: 'goal_id',
                    xtable: 'goal_tag',
                    xkey: 'tag_id',
                    key: 'id'
                }}
            `,
        getOrCreateForPair: getOrCreateForPair(model)('tag_id')
    })
)


export const GoalPage = extendModel('goal_page',
    model => ({
        assoc: () =>
            ASSOCIATE_MODULE`
                x pages ${{
                    left_key: 'id',
                    left_xkey: 'goal_id',
                    xtable: 'goal_page',
                    xkey: 'page_id',
                    key: 'id'
                }}
            `,
        getOrCreateForPair: getOrCreateForPair(model)('page_id')
    })
)


export const GoalReferrer = extendModel('goal_referrer',
    model => ({
        assoc: () =>
            ASSOCIATE_MODULE`
                x referrers ${{
                    left_key: 'id',
                    left_xkey: 'goal_id',
                    xtable: 'goal_referrer',
                    xkey: 'referrer_id',
                    key: 'id'
                }}
            `,
        getOrCreateForPair: getOrCreateForPair(model)('referrer_id')
    })
)
