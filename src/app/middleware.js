import dotenv from 'dotenv'
dotenv.config()
import cors from 'cors'
import bodyParser from 'body-parser'
import session from 'express-session'
import pgSimple from 'connect-pg-simple'
import morgan from 'morgan'
//-- Project imports
import { DB_URI } from '../models'
import {
    IS_DEV,
    SECRET_KEY
} from '../constants'
import nunjucksMiddleware from '../middleware/nunjucks.context'
import staticMiddleware from '../middleware/static'


export default ({ app, ...args })=> {
    app.options('*', cors({
        credentials: true,
        origin: true
    }))

    /**
     * Use Morgan for logging
     * `dev` : Color coded, abbreviated format (red = error, yellow = warning, etc.)
     */
    app.use(
        morgan('dev', {
            skip: (req, res) => res.statusCode < 400
        })
    )

    /** Cookies/sessions, request parsing, url encoding, etc
     * @see https://www.codementor.io/mayowa.a/how-to-build-a-simple-session-based-authentication-system-with-nodejs-from-scratch-6vn67mcy3
     */
    app.use(bodyParser.json())

    app.use(bodyParser.urlencoded({
        extended: false
    }))

    const dayMs = 1000 * 60 * 60 * 24
    const monthMs = dayMs * 30

    const pgSession = pgSimple(session)
    app.use(
        session({
            cookie: {
                maxAge: monthMs,
                secure: undefined
            },
            key: 'user_sid',
            resave: false,
            saveUninitialized: false,
            secret: SECRET_KEY,
            store: new pgSession({
                conString: DB_URI
            })
        })
    )

    app.set('trust proxy', 1)

    /**  Routes, static assets, & Error Handling
     *===============================================*/
    nunjucksMiddleware(app)
    staticMiddleware(app)

    return {
        app,
        ...args
    }
}
