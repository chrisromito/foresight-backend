/** @module nunjucks.context - Provides global variables for nunjucks templates
 */
import nunjucks from 'nunjucks'
import app from '../app/app'
import { IS_DEV } from '../constants'



const templateMiddleware = nunjucksEnv => {
    // nunjucksEnv.addGlobal('csrfToken', req.csrfToken())
    nunjucksEnv.addGlobal('DEBUG', IS_DEV)

    // Mimick Jinja's "static()" function
    nunjucksEnv.addGlobal('staticUrl', filePath => `/static/${filePath}`)

    // Bundle loader helpers
    nunjucksEnv.addGlobal('loadBundle', bundleName => `
        <link href="/${bundleName}.bundle.css" rel="stylesheet">
        <script src="/${bundleName}.bundle.js"></script>
    `)
    nunjucksEnv.addGlobal('loadScript', bundleName => `
        <script src="/${bundleName}.bundle.js"></script>
    `.trim())
    nunjucksEnv.addGlobal('loadStyle', bundleName => `
        <link href="/${bundleName}.bundle.css" rel="stylesheet">
    `.trim())
}


export const nunjucksMiddleware = app => {
    const nunjucksEnv = new nunjucks.Environment(
        new nunjucks.FileSystemLoader('server/src/views/', {
            watch: true
        }),
        {
            autoescape: false
        }
    )

    templateMiddleware(nunjucksEnv)
    // app.use(templateFn)
    nunjucksEnv.express(app)
    app.set('view engine', 'html')
    return nunjucksEnv
}

export default nunjucksMiddleware
