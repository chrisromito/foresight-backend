import chai from 'chai'
chai.config.includeStack = true
const assert = chai.assert
import { getTestClient } from '../../test_utils/test_models'
import { generatePageViewUserStats } from 'models/stats/page_view_user_stat/service'
import { generateReferrerStats } from 'models/stats/referrer_stat/service'


describe(`
        Runs generatePageViewUserStats & generateReferrerStats
    `,
    function () {
        let client = null

        before(async () => {
            client = await getTestClient()
        })

        it(
            'Page View User Stats generate Stats for total_count, unique_count, & bounce_count',
            function () {
                this.timeout(0)
                const date = new Date()
                return generatePageViewUserStats({ client_id: client.id }, date)
            }
        )

        it(
            'Referrer Stats generate Stats for total_count, unique_count, & bounce_count',
            function () {
                this.timeout(0)
                const date = new Date()
                return generateReferrerStats({ client_id: client.id }, date)
            }
        )

    }
)

