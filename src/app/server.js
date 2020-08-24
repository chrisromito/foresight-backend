import dotenv from 'dotenv'
dotenv.config()
import http from 'http'
import { CERT, PORT, SITE_DOMAIN } from '../constants'
import { expressApp } from './app'


//-- Project imports

const server = http.createServer(expressApp)
export default server

