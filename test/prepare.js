require('dotenv').config()
import { Client } from 'models/client'
import { getTestClient } from 'models/test_utils/test_models'
import { User } from 'models/user'

// Note: You can comment this out if you need to inspect the test data (ex. if they fail).
// IF YOU DO THIS, READ THE COMMENT BELOW
before(function(){
    this.timeout(0)

    return getTestClient()
        .then(({ id }) =>
            User.deleteWhere({ client_id: id })
                .then(() => ({ id }))
        )
        .then(({ id }) =>
            Client.deleteWhere({ id })
        )
})


// IF YOU COMMENT OUT THE TEARDOWN FUNCTION ABOVE, YOU MUST RUN THIS BEFORE RUNNING TESTS AGAIN:
// npm run build_server
// node
// PASTE THE SNIPPET BELOW INTO THE NODE REPL
const COPY_PASTE_TEARDOWN = `

var { getTestClient } = require('./server/dist/models/test_utils/test_models')
var { User } = require('./server/dist/models/user/index')
var { Client } = require('./server/dist/models/client/index')

var err = null

getTestClient().
    then(({ id })=>
        Promise.all([
            User.deleteWhere({ client_id: id }),
            Client.deleteWhere({ id })
        ])
    ).then(()=>
        console.log('DONE!  THANK YOU FOR LISTENING TO YOURSELF!  YOU CAN STOP YELLING NOW!')
    ).catch(e => {
        console.error('DID YOU FORGET TO SYNC THE DATABASE FKs AGAIN?!')
        console.error(e)
        err = e
        return Promise.resolve(e)
    })

`
