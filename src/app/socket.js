/**
 * Facilitate WebSocket connections via WebSocket (ws)
 * @see https://github.com/websockets/ws/blob/master/examples/express-session-parse/index.js
 *
 * For the source of where this logic is derived.
 *
 * Essentially, we use 'upgrade' events from the http server,
 * to capture when a user connects via WebSocket,
 * and we use the 'handleUpgrade' method on the WebSocket server instance
 * to lift the request into a socket connection, which is then
 * piped into the socketRouter
 */
import dotenv from 'dotenv'
dotenv.config()
import { SOCKET_PORT, SITE_URL, SOCKET_URL } from '../constants'
import WebSocket from 'ws'
import SocketSubjectRouter from '../routes/socket'
import server from './server'


const socketOptions = {
    origin: SITE_URL,
    port: SOCKET_PORT,
    clientTracking: false,
    noServer: true
}


export const Socket = new WebSocket.Server(socketOptions)

export default Socket


/**
 * Handle upgrade events on the server
 *      -> socket.onConnection()
 */
server.on('upgrade', (request, socket, head) => {
    pretty('app.socket -> Request:')(request)

    Socket.handleUpgrade(request, socket, head, function (ws) {
        Socket.emit('connection', ws, request)
    })
})

/**
 * Socket.onConnection()
 */
Socket.on('connection', (ws, request)=> {
    SocketSubjectRouter.lookUp(request.url, ws, request)

    ws.on('message', message => {
        pretty('app.socket -> ws.onmessage ->', message)
    })

    ws.on('close', ()=> {
        console.log('app.socket -> ws.onclose()')
    })
})


const pretty = message => o => {
    let value = o
    try {
        value = tryToJson(o)
    } catch(e) {}
    console.log(message)
    console.log(value)
}


const tryToJson = o => {
    try {
        return JSON.stringify(JSON.parse(o), null, 4)
    } catch(e) {}
    try {
        return JSON.stringify(o, null, 4)
    } catch (err) {}
    return o
}
