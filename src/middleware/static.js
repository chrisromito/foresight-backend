import express from 'express'


export default app => {
    app.use(express.static('client/dist'))
    app.use('/static', express.static('static', { dotfiles: 'ignore' }))
    return app
}
