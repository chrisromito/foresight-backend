const Router = require('./express').Router
const action = require('../../controllers/api/action')
const socketContext = action.socketContext

const ActionRouter = Router()

const logMessage = (msg)=> console.log(`

        ${msg}
    `)

/**
* WebSocket Implementation
* @see www.npmjs.com/package/express-ws
*/
ActionRouter.ws('/', (ws, req)=> {

    logMessage('Received ws request')

    ws.onopen = ()=> {
        logMessage('Action Socket opened')
        action.onOpen(socketContext(ws, req))
            .then(ws.send)
    }

    ws.on('message', (message)=> {
        logMessage(`Message received:`)
        action.createAction(socketContext(ws, req), JSON.parse(JSON.parse(String(message))))
            .then((data)=> {
                logMessage(`Action data: ${data}`)
                ws.send(data)
                return data
            })
    })

    ws.on('close', ()=> action.onClose(
        socketContext(ws, req)
    ))
})



/**
 * HTTP Implementation
 * routes:
 *    /user - POST - Update/Create User & UserSession
 *    /action - POST - Create an instance of an action
 */

ActionRouter.get('/action', action.actionList)

ActionRouter.post('/user', (req, res)=> {
    return action.onOpen(socketContext(undefined, req))
        .then(res.send)
})

ActionRouter.post('/action', (req, res)=> {
    return action.createAction(socketContext(undefined, req), JSON.parse(req.body))
        .then(res.send)
})


module.exports = ActionRouter