import { URL } from 'url'
import {
    SOCKET_DOMAIN,
    SITE_DOMAIN
} from '../constants'


export const getUrl = (path, domain=SITE_DOMAIN) => {
    const url = new URL(domain)
    url.pathname = stripDoubleSlash(path)
    return url.toString()
}

export default getUrl


export const getSocketUrl = path => getUrl(path, SOCKET_DOMAIN)


const stripDoubleSlash = path =>
    !path.includes('/')
        ? path
        : stripDoubleSlash(path.replace(doubleSlashRegex, '/'))


const doubleSlashRegex = /\/\//gmi
