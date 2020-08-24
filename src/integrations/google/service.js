/**
 * @module service - Provide Service interface for working with our data model
 * 
 */

const path = require('path')
const fs = require('fs')
const R = require('ramda')
const ObjectId = require('mongoose').Types.ObjectId
const { google } = require('./googleapis')
const { tryToJson } = require('../../utils/common')
const SessionMonad = require('../../controllers/user/interfaces')
const { Google } = require('../../models/index')


const accountLens = R.lens(
    R.prop('account'),
    (val, target)=> R.assoc(
        'account',
        ObjectId(val),
        target
    )
)


const viewAccountLens = R.view(accountLens)


const renderAuthError = (res)=> (e)=> {
    console.log(`\n\n\nrenderAuthError`)
    try {
        console.log(e)
        console.log(e.stack)
    } catch(err) {
        // Let it slide, it's all good
    }
    return res.render('analytics/google_api_test.html', {
        errors: true
    })
}


/**
 * Google Service
 */
const GoogleSignOnService = (req, res)=> {
    //-- Receive a response from the Google oAuth redirect
    const authCode = req.query.code
    if (authCode) {
        const auth = getGoogleAuth()
        return auth.getToken(authCode)
            .then((response) => {
                auth.setCredentials(response)
    
                return onAuthResponse(req, res)( {
                    authCode,
                    response,
                    tokens: response.tokens,
                })
            })
            .catch(renderAuthError(res))
    }
    return handleOauthWorkflow(req, res, req.query.redirect_to)
        .catch(renderAuthError(res))
}


const GoogleService = (env, arg)=> ({
    getGoogle: (client)=>
        Google.findOne({ client })
            .exec()
            .then((G)=>
                G || new Google({ client }).save()
            ),

    getCredentials: (client, account)=>
        GoogleService(env, arg)
            .getGoogle(client)
            .then((g)=> {
                const gAuth = R.head( accountAuth(account, g.auth) )
                return gAuth && gAuth.tokens.refresh_token
                    ? ({ g, auth: gAuth })
                    : Promise.reject(g)
            }),

    getG: (client, account)=> 
        GoogleService(env, arg)
            .getCredentials(client, account)
            .then(({ g, auth})=> {
                const gAuth = getGoogleAuth()
                gAuth.setCredentials(auth.tokens)

                // Keep our tokens in sync
                // @see https://github.com/googleapis/google-api-nodejs-client#handling-refresh-tokens
                gAuth.on('tokens', tokens => mergeAuthWith(g)(account)({ tokens }))
                return gAuth
            })
})


const handleOauthWorkflow = (req, res, redirectTo)=>
    Promise.resolve(SessionMonad(req).value())
        .then(({ client, account })=> {
            console.log(`handleOauthWorkflow - client ${client} - account: ${account}`)
            // The `getCredentials` method will reject if we don't have credentials
            // which tells us that we have to go through the oAuth workflow
            return GoogleService({ client, account }, null)
                .getCredentials(client, account)
                .then(()=>
                    res.render('analytics/google_api_test.html', {
                        client,
                        account,
                        redirectTo
                    })
                )
        }).catch((e)=> {
            console.log(`\n\n\nhandleOauthWorkflow - catch`)
            console.log(e)
            if (e._id || e.account || e.client) {
                const resp = res.render('analytics/google_api_test.html', {
                    redirectTo,
                    googleOauthUrl: getAuthUrl()
                })
                return Promise.resolve(resp)
            }
            return Promise.reject(e)
        })


const keyPath = path.join(
    __dirname,
    '..', // integrations
    '..', // server
    '..', // src
    '..', // root
    'private',
    'action_tracker__google_oauth_key.json'
)


const defaultKeys = {
    redirect_uris: ['https://cromito.com:8080/google/oauth2callback']
}


const mapIfExists = fn => kPath =>
    fs.existsSync(kPath)
        ? fn(require(kPath))
        : defaultKeys


const keyPred = keyFile => keyFile.installed || keyFile.web


const getGoogleAuth = R.once(() => {
    const keys = mapIfExists(keyPred)(keyPath)
    return new google.auth.OAuth2(
        keys.client_id,
        keys.client_secret,
        R.last(keys.redirect_uris)
    )
})


const SCOPES = [
    'https://www.googleapis.com/auth/analytics',
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/analytics.edit',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid'
]


const AUTH_CONFIG = {
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
}


const getAuthUrl = (auth = null) =>
    (auth ? auth : getGoogleAuth())
        .generateAuthUrl(AUTH_CONFIG)


/**
 * Data Persistance/Workflow
 */

const onAuthResponse = (req, res)=> ({ authCode, tokens, response })=>
    Promise.resolve(SessionMonad(req).value())
        .then(({ client, account })=>
            GoogleService({ client, account }, null)
                .getGoogle(client)
                .then((g)=>
                    updateAccountAuth(g)(account)({ authCode, tokens, response })
                )
        )
        .then(()=>
            res.render('analytics/google_api_test.html')
        )


const updateAccountAuth = g => account => ({ authCode, tokens, response }) =>
    mergeAuthWith(g)(account)({
        account,
        authCode,
        tokens,
        authConfig: AUTH_CONFIG,
        rawResponse: tryToJson(response)
    })


const mergeAuthWith = g => account => newAuth => {
    const auth = filterSerializeReduceSet(account)(newAuth)(g.auth)
    g.auth.push(auth)
    return g.save().then(()=> g)
}


const filterSerializeReduceSet = account => newAuth => R.compose(
    R.set(
        accountLens,
        ObjectId(account)
    ),
    list => list.reduce((a, b)=> ({...a, ...b}), {}),
    R.append(newAuth),
    serializeAuth,
    accountAuth(account)
)


const serializeAuth = R.map(R.dissoc('_id'))


const accountAuth = R.curry((accountId, list)=>
    R.filter(
        R.compose(
            R.equals(R.__, String(accountId)),
            R.toString,
            viewAccountLens
        ),
        list
    )
)



module.exports = {
    GoogleSignOnService,
    GoogleService,
    getAuthUrl
}
