import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { URL } from 'url'

dotenv.config()


export const {
    SITE_DOMAIN,
    SITE_URL,
    SOCKET_DOMAIN,
    SOCKET_URL,
    SOCKET_PORT,
    SECRET_KEY,
    JWT_SECRET,
    PORT,
} = process.env


export const IS_DEV = process.env.NODE_ENV !== 'production'


export const ROOT_DIR = path.join(
    __dirname,
    '..'
)


/**
 * Paths
 */
export const privatePath = path.join(ROOT_DIR, 'private')

export const keyPath = path.join(privatePath, 'server.key')
export const certPath = path.join(privatePath, 'server.cert')

export const CERT = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
}


/**
 * URLS
 */


const domainUrl = new URL(SITE_URL)


export const devServer = {
    port: Number(domainUrl.port),
    host: domainUrl.hostname,
    https: CERT
}


export const staticUrl = yourPath => `${SITE_URL}/${yourPath}`


export const ABSOLUTE_DOMAIN = SITE_URL

export const LOGIN_URL = '/login'

export const LOGIN_ABSOLUTE_URL = `${SITE_URL}${LOGIN_URL}`
