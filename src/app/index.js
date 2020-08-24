import dotenv from 'dotenv'
dotenv.config()
import App from './app'
import server from './server'
import socket from './socket'
import { CERT, PORT, SITE_DOMAIN } from '../constants'


//-- Project imports

server.listen(PORT, () => console.log(`Listening on port ${SITE_DOMAIN}:${PORT}`))

export default {
    App,
    server,
    socket
}
