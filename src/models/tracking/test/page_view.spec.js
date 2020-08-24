import chai from 'chai'
chai.config.includeStack = true
const assert = chai.assert
import { IN, SQL, ASSOCIATE } from '../../base'
import {
    getTestClient,
    getTestPages,
    testUserData
} from '../../test_utils/test_models'
import { testReferrerUrls } from '../../test_utils/constants'
import { User } from '../../user/index'
import { PageView, PageViewPath } from '../page_view'
import { randomIntBetween, sample } from 'utils/random'


const makeIdMap = list =>
    list.reduce(
        (m, o)=> {
            m.set(o.id, o)
            return m
        },
        new Map()
    )


const createTestUser = client_id =>
    User.getOrCreate({ client_id, ...testUserData }, { client_id, ...testUserData })


// eslint-disable-next-line no-undef
describe('Page Views provide the ability to map a user to a page.', ()=> {
    let client_id = null
    let pages = []
    let user = null
    let user_id = null

    // eslint-disable-next-line no-undef
    before(async ()=> {
        const client = await getTestClient()
        client_id = client.id
        pages = await getTestPages()
        user = await createTestUser(client_id)
        user_id = user.id
    })


    // eslint-disable-next-line no-undef
    it('Page views get mapped to pages', done => {
        const page_id = pages[0].id
        PageView.insert({ user_id, page_id, active: true })
            .then(pageView => {
                assert.equal(pageView.user_id, user_id, `Page views map to the user that did it`)
                assert.equal(pageView.page_id, page_id, `Page views map to the correct page`)
                done()
            }).catch(done)
    })
})

// eslint-disable-next-line no-undef
describe('Page View Paths create a union between page views', function() {
    let client_id = null
    let pages = []
    let user = null
    let user_id = null
    let page_views = null

    // eslint-disable-next-line no-undef
    before(async ()=> {
        const client = await getTestClient()
        client_id = client.id
        pages = await getTestPages()
        user = await createTestUser(client_id)
        user_id = user.id
        page_views = await createTestPageViews(user_id, pages.map(page => page.id))
    })

    //-- Single Page View Path
    // eslint-disable-next-line no-undef
    it(`Page view paths don't require a 'parent_id' or a 'from_page_view_id' param`, done => {
        const to_page_view_id = page_views[0].id
        PageViewPath.insert({
            to_page_view_id,
            user_id,
            parent_id: null,
        })
        .then(()=> done())
        .catch(done)
    })

    //-- Page View Path Chains
    // eslint-disable-next-line no-undef
    it(
        `
            Page view paths will create chains where the previous PageViewPath
            is set to the child's parent_id, and the parent's 'to_page_view_id'
            value is the child's 'from_page_view_id' value.
        `,
        function(done) {
            this.timeout(0)
            chainPageViews({ user_id }, page_views)
                .then(pageViewPaths => {
                    const pvpIdMap = makeIdMap(pageViewPaths)
                    return Promise.all(
                        pageViewPaths.map(pvp =>
                            testPageViewPathPair(
                                pvp,
                                pvpIdMap.get(pvp.parent_id)
                            )
                        )
                    )
                })
                .then(()=> done())
                .catch(done)
        }
    )
})


// eslint-disable-next-line no-undef
describe('The `lift` method of PageViewPaths will handle mapping to external and internal referrer URLs', function() {
    let client_id = null
    let pages = []
    let user = null
    let user_id = null

    // eslint-disable-next-line no-undef
    before(async ()=> {
        const client = await getTestClient()
        client_id = client.id
        pages = await getTestPages()
        user = await createTestUser(client_id)
        user_id = user.id
    })

    //-- Page View Paths - External Referrers
    // eslint-disable-next-line no-undef
    it(
        `
            The 'lift' method of PageViewPaths will map to
            referrers when the 'referrer' param doesn't map to a domain
            owned by the Client.
        `,
        function(done) {
            this.timeout(0)
            createTestPageViews(user_id, pages.map(page => page.id))
                .then(pageViews => {
                    const firstPvp = PageViewPath.lift({
                        client_id,
                        pageView: pageViews[0],
                        referrer: testReferrerUrls[1]
                    })
        
                    const secondPvp = PageViewPath.lift({
                        client_id,
                        pageView: pageViews[1],
                        referrer: testReferrerUrls[1]
                    })
        
                    return Promise.all([
                        firstPvp,
                        secondPvp
                    ]).then(pvpList => {
                        pvpList.forEach(pvp => {
                            assert.isNotNull(pvp.referrer_id)
                        })
                        return pvpList
                    })
                })
                .then(()=> done())
                .catch(done)
        }
    )
})


const createTestPageViews = (user_id, pageIdList)=> {
    // Baseline = all pages
    // Add duplicate pages to simulate randomization
    const pageSample = pageIdList.concat(
        sample(pageIdList, 1000)
    )

    return Promise.all(
        pageSample.map(page_id =>
            PageView.insert({ user_id, page_id, active: true })
        )
    ).then(() =>
        PageView.meta.QUERY`
            SELECT *
            FROM page_view
            WHERE user_id = ${user_id}
            ORDER BY id DESC
        `
    )

}



const chainPageViews = async ({ user_id }, pageViewList )=> {
    const defaultFields = {
        referrer_id: null,
        ip_location_id: null,
        parent_id: null,
        from_page_view_id: null,
        user_id
    }
    let last = null
    let idList = []
    for (let i = 0; i < pageViewList.length; i++) {
        const pageView = pageViewList[i]
        const parent_id = last ? last.id : null
        const ip_location_id = last ? last.ip_location_id : null
        last = await PageViewPath.insert({
            ...defaultFields,
            parent_id,
            ip_location_id,
            to_page_view_id: pageView.id
        })
        idList.push(last.id)
        if (0 === i % 5) {
            // Reset every 5th item
            last = null
        }
    }

    return ASSOCIATE`
        page_view_path ${SQL`
            WHERE ${IN('id', idList)}
            ORDER BY id ASC
        `}
            ${PageViewPath.assocPageViews}
    `
}


/**
 * @func testPageViewPathPair - Test that the pageViewPath has the correct values
 */
const testPageViewPathPair = (currentPvPath, lastPvPath=null) => {    
    const lastPv = currentPvPath._.from_page_view
    const currentPv = currentPvPath._.to_page_view
    const index = currentPvPath.index

    assert.equal(currentPvPath.depth, index,
        `Depth === the index of a sequence of views`)

    if (lastPvPath) {
        assert.equal(currentPvPath.index, lastPvPath.index + 1,
            `Child.depth = (parent depth + 1)`)
        assert.equal(currentPvPath.ip_location, lastPvPath.ip_location,
            `Child Page View Paths inherit their parent's ip_location`)
        assert.equal(currentPvPath.referrer_id, lastPvPath.referrer_id,
            `Child Page View Paths inherit their parent's referrer_id
            to ensure we always know what brought the user to the site (acquisition)`)
        assert.include(currentPvPath.path, lastPvPath.path || '',
            `Children extend their parent's path`)
        assert.equal(currentPvPath.from_page_view_id, lastPvPath.to_page_view_id,
            `Children point to their parent via the from_page_view_path_id field`)
    }

    assert.equal(currentPvPath.to_page_view_id, currentPv.id,
        `to_page_view_id points to the current page view`)
    if (lastPv) {
        assert.equal(currentPvPath.from_page_view_id, lastPv.id,
            `from_page_view_id points to the last page view`)   
    }
    return [currentPv.id, currentPvPath.id]
}

