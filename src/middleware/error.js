// export default (err, req, res, next) => {
//     try {
//         console.error('TRY ERROR MIDDLEWARE')
//         if (err) {
//             res.status(500)
//             return res.send(`500 Error =(`)
//         }
//
//         console.error(err.stack)
//         console.trace(err)
//         res.status(404)
//         const message = 'Not found. ¯\\_(ツ)_/¯'
//
//         if (req.accepts('html')) {
//             return res.render('404_view.html', {
//                 url: req.url
//             })
//         } else if (req.accepts('json')) {
//             return res.json({
//                 error: message
//             })
//         }
//
//         return res.render(message)
//     } catch(e) {
//         console.error('FUCK')
//         return next(e)
//     }
// }

/**
 * @source https://github.com/expressjs/express/blob/master/examples/error-pages/index.js
 * @param {express} app
 * @returns {express}
 */
export const errorMiddleware = app => {
    app.use(function(err, req, res, next) {
        console.error('EXPRESS -> APP -> ERROR IN ERROR MIDDLEWARE!')
        try {
            console.error(err)
            console.error(req.status)
        } catch(e) {}
        return next(err)
    })

    // app.get('/404', function (req, res, next) {
    //     // trigger a 404 since no other middleware
    //     // will match /404 after this one, and we're not
    //     // responding here
    //     next()
    // })
    //
    // app.get('/403', function (req, res, next) {
    //     // trigger a 403 error
    //     const err = new Error('not allowed!')
    //     err.status = 403
    //     return next(err)
    // })
    //
    // app.get('/500', function (req, res, next) {
    //     // trigger a generic (500) error
    //     return next(new Error('keyboard cat!'));
    // })

    // Error handlers

    // Since this is the last non-error-handling
    // middleware use()d, we assume 404, as nothing else
    // responded.

    // $ curl http://localhost:3000/notfound
    // $ curl http://localhost:3000/notfound -H "Accept: application/json"
    // $ curl http://localhost:3000/notfound -H "Accept: text/plain"
    //
    // app.use(function (req, res, next) {
    //     const status = 404
    //     res.status(status)
    //     return res.format({
    //         default: () => res.type('txt').send('Not found'),
    //         html: ()=> res.render('404', { url: req.url, status }),
    //         json: ()=> res.json({ error: 'Not found', status }),
    //     })
    // })
    //
    // // error-handling middleware, take the same form
    // // as regular middleware, however they require an
    // // arity of 4, aka the signature (err, req, res, next).
    // // when connect has an error, it will invoke ONLY error-handling
    // // middleware.
    //
    // // If we were to next() here any remaining non-error-handling
    // // middleware would then be executed, or if we next(err) to
    // // continue passing the error, only error-handling middleware
    // // would remain being executed, however here
    // // we simply respond with an error page.
    //
    // app.use(function (err, req, res, next) {
    //     // we may use properties of the error object
    //     // here and next(err) appropriately, or if
    //     // we possibly recovered from the error, simply next().
    //     res.status(err.status || 500)
    //     console.log(`Caught an error: ${err}`)
    //     return res.render('500', {
    //         error: err,
    //         status: err.status || 500
    //     })
    // })
}

export default errorMiddleware
