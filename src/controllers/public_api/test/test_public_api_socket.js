import chai from 'chai'
import WebSocket from 'ws'
import * as R from 'ramda'
import { tryToJson, tryToParse } from '../../../utils/common'
import { testPagePaths } from '../../../models/test_utils/constants'
import {
    absoluteEndpoints,
    publicApiEndpoints,
    reverseAbsolute,
    socketEndpoints
} from '../../../routes/endpoints'
import { IN, SQL, ASSOCIATE, QUERY } from '../../../models'
import { getTestClient } from '../../../models/test_utils/test_models'
import { Tag } from '../../../models/tag'
import { PageViewPath, PageViewPathTag } from '../../../models/tracking'
import { Jwt, JwtService } from '../../../models/jwt'


/**
 * @typedef {import('../../../models/tracking').pageViewPath} pageViewPath
 */
/**
 * @typedef {import('../../../models/client').client} client
 */


const assert = chai.assert

const SOCKET_TIMEOUT = 1000 * 10


const TAG_DATA = [
    {
        name: 'Test Tag 0 - Un-categorized',
        tag_type_id: Tag.tagTypes.unCategorized
    },
    {
        name: 'Test Tag 1 - Client Tag',
        tag_type_id: Tag.tagTypes.client
    }
]


describe(
    `Page View Socket leverages websockets to facilitate real-time interaction
        w/ a Page View via tag mapping, action mapping, & "active" state
    `,
    function() {

        this.timeout(SOCKET_TIMEOUT * 3)
        let context = null
        let connection = null
        let isConnected = false
        const socketMessages = []

        //-- Helper functions
        function _send(action, data) {
            const payload = tryToJson({
                action,
                data: data
            })
            connection.send(payload)
        }

        function send(action, data) {
            if (isConnected) {
                _send(action, data)
            } else {
                connection.once('open', function() {
                    _send(action, data)
                })
            }
        }

        function receive(str) {
            socketMessages.push(tryToParse(str))
        }

        function close(fn=null) {
            if (isConnected) {
                connection.close()
                isConnected = false
            }
            if (fn) {
                fn()
            }
        }


        //-- Initialization & setup
        // eslint-disable-next-line no-undef
        before(async () => {
            context = await getSocketContext()
            connection = new WebSocket(context.socketEndpoint)
            connection.once('open', ()=> isConnected = true)
            connection.once('close', ()=> {
                isConnected = false
                close()
            })
            connection.on('message', receive)
        })

        it(`Page View socket lets us map tags to a Page View`, function(done) {
            let isValid = null
            connection.once('message', socketResponse =>
                validatePageViewPathTagMaps(context)(socketResponse)
                    .then(()=> {
                        isValid = true
                        done()
                        return isValid
                    })
                    .catch(e => {
                        isValid = false
                        return done(e)
                    })
                    .finally(()=> {
                        close(()=> {
                            clearTimeout(eventTimeout)
                        })
                    })
            )

            send('tag',TAG_DATA)

            let eventTimeout = setTimeout(()=> {
                if (isValid === null) {
                    close(() =>
                        done(new Error('WE DID NOT RECEIVE A RESPONSE!'))
                    )
                } else if (isValid) {
                    done()
                    close()
                } else {
                    close()
                }
            }, SOCKET_TIMEOUT)
        })
    }
)



const validatePageViewPathTagMaps = ({ pageViewPath }) => socketResponse => {
    const { type, data } = tryToParse(socketResponse)
    // Socket response data for 'tag' action:
    assert.isArray(data, `Socket response for 'tag' action gives us a list of tags`)
    data.forEach(tagMap => {
        assert.containsAllKeys(tagMap, ['id', 'page_view_path_id', 'tag_id'],
            `Each tag in the response maps to an id, a page view path id, & a tag id`)
    })

    // const pvpTagMaps =
    return Promise.resolve(true)
}


/**
 * Helper Functions
 * =====================
 */

/**
 * @func getSocketContext
 * @returns {Promise<{socketEndpoint: String, pageViewPath: pageViewPath, client: client, jwtToken: String, client_id: Number}>}
 */
const getSocketContext = async ()=> {
    const client = await getTestClient()
    const client_id = client.id
    const pageViewPath = await getTestPvp()
    const jwtToken = await getTestJwtToken(pageViewPath.user_id)
    const socketEndpoint = await getSocketEndpoint(pageViewPath.to_page_view_id, jwtToken, client.public_key)
    return {
        client,
        client_id,
        jwtToken,
        pageViewPath,
        socketEndpoint
    }
}


/**
 * @func getTestJwtToken
 * @param {Number} user_id
 * @returns {Promise<String>}
 */
const getTestJwtToken = user_id =>
    (QUERY`
        SELECT *
            FROM jwt
            WHERE user_id = ${user_id}
    `).then(
        R.pipe(
            R.head,
            R.prop('token')
        )
    )

/**
 * @function getTestPvp
 * @returns {Promise<pageViewPath>}
 */
const getTestPvp = ()=>
    ASSOCIATE`
        page_view_path ${SQL` ORDER BY id DESC `}
            ${PageViewPath.assocPageViews}
            ${PageViewPath.assocUser}
    `.then(R.head)


const getSocketEndpoint = (page_view_id, jwtToken, clientKey)=>
    reverseAbsolute(
        socketEndpoints.pageView,
        { page_view_id },
        true,
        { clientKey, jwt: jwtToken }
    )

