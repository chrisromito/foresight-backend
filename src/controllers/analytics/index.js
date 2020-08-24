/**
 * @module controllers/analytics/index.js - Renders the base template for the Analytics portion of the application.
 * This consists of:
 * - Dashboard
 * - Real-Time
 * - Traffic
 * - Interaction
 * 
 * For each of these pages, we render the "base template" (everything that's actually HTML, not JS),
 * and set the global JS config so the SPA can load up the corresponding bundles.
 * 
 * The details of "what bundle" is loaded is determined by the `client/src/analytics/index.js` implementation,
 * we just need to include the correct 'page' string in the template context, and the bundle takes care of the rest.
 */
const SessionMonad = require('../user/interfaces')


const getTemplate = (dirName)=> `analytics/${dirName}/index.html`


const getClientPages = ({ clientId })=> Promise.resolve([])
    // Page.find({ client: ObjectId(clientId) })
    //     .sort({ index: 1 })
    //     .exec()
    //     .then(
    //         R.pipe(
    //             JSON.stringify,
    //             JSON.parse,
    //             R.map(
    //                 (o)=> R.assoc('id', R.prop('_id', o), o)
    //             )
    //         )
    //     )


const getContext = (req)=> {
    const sessionMonad = SessionMonad(req)
    const baseContext = sessionMonad.value()
    return getClientPages(baseContext)
        .then((pages)=> ({...baseContext, pages }))
}


const renderWithContext = (pageName)=> (req, res)=>
    getContext(req)
        .then((context)=>
            res.render(getTemplate(pageName), {
                context,
                page: pageName
            })
        )


const Dashboard = renderWithContext('dashboard')


const RealTime = renderWithContext('real_time')


const Traffic = renderWithContext('traffic')


const Interaction = renderWithContext('interaction')


module.exports = {
    Dashboard,
    Interaction,
    RealTime,
    Traffic
}