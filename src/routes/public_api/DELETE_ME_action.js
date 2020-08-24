
/**
 * HTTP Implementation
 * routes:
 *    /action - POST - Create an instance of an action
 *    /action/user - POST - Update/Create User & UserSession * 
 */
import { Router } from 'express'
import action from '../../controllers/api/action'


const socketContext = action.socketContext


const ActionRouter = Router()


ActionRouter.get('/', action.actionList)


ActionRouter.post('/', (req, res)=> {
    return action.createAction(socketContext(undefined, req), JSON.parse(req.body))
        .then(res.send)
})


ActionRouter.post('/user', (req, res)=> {
    return action.onOpen(socketContext(undefined, req))
        .then(res.send)
})


export const actionRouter = actionRouter
export default actionRouter