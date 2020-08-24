import dotenv from 'dotenv'
dotenv.config()
import { pipe } from 'ramda'
import express from 'express'
import middleware from './middleware'
// import socket from './socket'
import routes from './routes'
// import server from './server'
import { IS_DEV } from '../constants'


//-- App Setup just ties it all together ;)
const setUpApp = pipe(
    middleware,
    routes
)

export const App = setUpApp({ app: express() })
export default App
export const expressApp = App.app

