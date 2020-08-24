import dotenv from 'dotenv'
dotenv.config()
import appRouter from '../routes'
import errorMiddleware from '../middleware/error'


export default args => {
    args.app.use('/', appRouter)
    errorMiddleware(args.app)
    return args
}
