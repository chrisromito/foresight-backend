import chai from 'chai'
chai.config.includeStack = true
const assert = chai.assert
import moment from 'moment'
import * as R from 'ramda'
import { EQ, IN, SQL, ASSOCIATE, QUERY } from '../../base'
import { pMap } from 'utils/pMap'
import {
    getTestClient,
    getTestPages,
    testUserData
} from '../../test_utils/test_models'
import { StatType, StatValue } from '../shared'
import { PageViewStat, PageViewTotal, PageViewTotalAction, PageViewTotalTag } from 'models/stats/page_view_total/models'
import { PageView, PageViewPath } from 'models/tracking'
import { generatePageViewStats } from 'models/stats/page_view_total/service'


describe(`
        Page View Stat allows us to map Page View Totals,
        Page View Total Actions, & Page View Total Tags
        back to Pages so we can have denormalized aggregates
        on a day-to-day basis
    `, ()=> {
    let client = null

    before(async ()=> {
        console.log('Getting context...')
        client = await getTestClient()
    })

    it('Page View Stats Task lets us map Page View Totals, Tags, etc. to Stats', done => {
        const date = new Date()

        generatePageViewStats({ client_id: client.id }, date)
            .then(()=> done())
            .catch(done)
    })

    // FIXME: Build out the rest of the test cases
})

