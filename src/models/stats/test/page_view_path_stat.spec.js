import chai from 'chai'

chai.config.includeStack = true
const assert = chai.assert
import { getTestClient } from '../../test_utils/test_models'
import { generatePageViewPathStats } from 'models/stats/page_view_path_stat/service'

describe(`
        Page View Path Stats allows us to map Page View Path Stats,
        Page View Path Stat Actions, & Page View Path Stat Tags
        back to PageViewPaths so we can have denormalized aggregates
        on a day-to-day basis
    `,
    function() {
        let client = null

        before(async () => {
            client = await getTestClient()
        })

        it(
            'Page View Path Stats Task lets us map Page View Paths, Tags, etc. to Stats',
            function() {
                this.timeout(0)
                const date = new Date()
                return generatePageViewPathStats({ client_id: client.id }, date)
            }
        )

        // FIXME: Build out the rest of the test cases
    }
)

