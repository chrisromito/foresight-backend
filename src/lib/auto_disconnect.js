/**
 * @func autoDisconnect - Decorator function that automatically detects and closes broken connections
 * {@link https://github.com/websockets/ws#how-to-detect-and-close-broken-connections}
 */

const INTERVAL = 30000


export const autoDisconnect = fn => (ws, req) => {
    ws.isAlive = true

    ws.on('pong', function heartBeat() {
        ws.isAlive = true
        this.isAlive = true
    })

    const socketInterval = setInterval(function ping() {
        if (ws.isAlive === false) {
            console.log(`closing because socket isn't alive`)
            return ws.close()
        }

        ws.isAlive = false
        ws.ping(function noop() {
            // Do nothing
        })
    }, INTERVAL)

    ws.on('close', function close() {
        console.log(`auto_disconnect() -> close()`)
        clearInterval(socketInterval)
    })

    return fn(ws, req)
}

export default autoDisconnect
