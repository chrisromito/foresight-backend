import chai from 'chai'
import chaiHttp from 'chai-http'
import * as R from 'ramda'
import { IN, SQL, ASSOCIATE } from '../../../models'
import { getTestClient } from '../../../models/test_utils/test_models'
import { testPagePaths } from '../../../models/test_utils/constants'
import { PageViewPath } from '../../../models/tracking'
import { Jwt, JwtService } from '../../../models/jwt'
import {
    absoluteEndpoints,
    publicApiEndpoints,
    reverseAbsolute,
    socketEndpoints
} from '../../../routes/endpoints'


const assert = chai.assert
chai.use(chaiHttp)

const testAppUrls = {
    home: R.head(testPagePaths),
    blog: R.last(testPagePaths),
    testPath: R.prop(1, testPagePaths)
}


describe(
    `The Page View public API endpoint allows users to make a POST request
        that returns a JSON response w/ the shape {PageViewPostResponse}.
        
        Doing so populates the DB w/ a new PageView and PageViewPath.
        
        If a referrer is included:
            - If the domain matches the client's domain, it will be used
                to get the previous PageViewPath & continue the session sequence
            - Otherwise, it will generate a Referrer record
    `,
    ()=> {
        let client = null
        let client_id = null
        let first_response = null
        let payload = {}
        let secondPayload = {}

        // eslint-disable-next-line no-undef
        before(async () => {
            client = await getTestClient()
            client_id = client.id
            payload = {
                client_key: client.public_key,
                url: testAppUrls.home,
                tags: [
                    'first request - first tag name',
                    'first request - second tag name'
                ]
            }

            secondPayload = {
                ...payload,
                url: testAppUrls.blog,
                referrer: testAppUrls.home
            }
        })

        // eslint-disable-next-line no-undef
        it(
            `POST'ing to the Page View API gives us back a response w/ a JWT,
                page view, and helper URLs
            `,
            done => {
                chai.request(absoluteEndpoints.endpoints.apiRoute)
                    .post('/page_view')
                    .send(payload)
                    .then(value => {
                        return value.text
                            ? tryToParse(value.text)
                            : value
                    })
                    .then(testJwtMiddleware)
                    .then(response => {
                        assert.containsAllKeys(response, [
                            'jwt',
                            'page_view',
                            'end_points'
                        ])
                        first_response = response

                        const { end_points, page_view } = response
                        const actionUrlEndpoint = reverseAbsolute(
                            publicApiEndpoints.action,
                            { page_view_id: page_view.id }
                        )
                        assert.equal(actionUrlEndpoint, end_points.action_url, `
                            The response provides an absolute URL pointing to the action API URL
                            corresponding w/ this page view
                        `)

                        const socketUrlEndpoint = reverseAbsolute(
                            socketEndpoints.pageView,
                            { page_view_id: page_view.id },
                            true,
                            { jwt: response.jwt.jwt, clientKey: client.public_key }
                        )
                        assert.equal(socketUrlEndpoint, end_points.socket_url, `
                            The Page View API response provides an absolute URL
                            pointing to the websocket endpoint for this PageView connection
                        `)
                        return true

                    })
                    .then(()=> done())
                    .catch(done)
            }
        )

        // eslint-disable-next-line no-undef
        it(`Subsequent requests with referrers create PageViewPath chains`, done => {
            // Fire the follow-up request (mock a user clicking an internal link)
            chai.request(absoluteEndpoints.endpoints.apiRoute)
                .post('/page_view')
                .set('authorization', `Bearer ${first_response.jwt.jwt}`)
                .send(secondPayload)
                .then(value => {
                    return value.text
                        ? tryToParse(value.text)
                        : value
                })
                .then(testJwtMiddleware)
                .then(response => {
                    assert.containsAllKeys(response, [
                        'jwt',
                        'page_view',
                        'end_points'
                    ])

                    const pageViewIds = [
                        response.page_view.id,
                        first_response.page_view.id
                    ]

                    // Dig yourself out of callback hell...
                    return getPageViewPathsForPageViews(pageViewIds)
                        .then(pageViewPaths => {
                            const first = R.find(
                                R.propEq('user_id', first_response.jwt.user_id),
                                pageViewPaths
                            )
                            const second = R.find(
                                R.propEq('user_id', response.jwt.user_id),
                                R.reject(
                                    R.propEq('id', first.id),
                                    pageViewPaths
                                )
                            )
                            return {
                                response,
                                first,
                                second
                            }
                        })
                })
                .then(({ response, first, second })=> {
                    // Validate that the second points to the first
                    assert.equal(first.id, second.parent_id,
                        `The API is able to chain PageViewPaths via the referrer field`)
                    assert.equal(first.to_page_view_id, second.from_page_view_id,
                        `The API links up the first and second PageViewPaths to form a sequence`)
                    // Validate that the second response points to the second pvp
                    assert.equal(response.page_view.id, second.to_page_view_id,
                        `The second response points to the second PageViewPath`)
                    done()
                })
                .catch(done)
        })
    }
)


const tryToParse = o => {
    try {
        return JSON.parse(o)
    } catch(e) {
        return o
    }
}

const tryToStringify = o => {
    try {
        return JSON.stringify(o, null, 4)
    } catch(e) {
        return o
    }
}


const testJwtMiddleware = res => {
    const responseJwtToken = res.jwt.jwt
    return Promise.all([
        Jwt.selectWhere({ token: responseJwtToken })
            .then(
                R.pipe(
                    R.sortBy(R.prop('created')),
                    R.last
                )
            ),
        getTestClient()
    ]).then(([jwt, client]) => {
        assert.equal(jwt.client_id, client.id,
            `JWT is associated w/ the target client`)
        assert.equal(jwt.token, responseJwtToken)
        return JwtService(Jwt).verifyToken(jwt.token)
            .then(() => Promise.resolve(res))
    })
}


const getPageViewPathsForPageViews = pageViewIds =>
    ASSOCIATE`
        page_view_path ${SQL`
            WHERE (
                ${IN('to_page_view_id', pageViewIds)}
                OR ${IN('from_page_view_id', pageViewIds)}
            )
            ORDER BY id ASC
        `}
            ${PageViewPath.assocPageViews}
    `
