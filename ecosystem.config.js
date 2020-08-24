require('dotenv').config()
const path = require('path')

const isDev = process.env.NODE_ENV !== 'production'
const logDir = './log'

const clientLogFile = `${logDir}/client_log.log`

const serverLogFile = `${logDir}/server_log.log`



const ignore_watch = [
    './server/dist',
    './client_dist',
    'node_modules',
    './private',
    './static',
    './test'
]


const DELAY = 3000

const baseAppConfig = {
    ignore_watch,
    cwd: path.join(__dirname),
    exp_backoff_restart_delay: 100,
    kill_timeout: DELAY,
    watch_delay: DELAY,
    wait_ready: true,
    combine_logs: true
}


//-- Server App Config
const serverConfig = {
    ...baseAppConfig,
    name: 'server',
    // script: 'npm',
    // args: 'run server',
    script: './dist/index.js',
    error_file: serverLogFile,
    out_file: serverLogFile,
    watch_delay: DELAY
}


module.exports = {
    apps : [
        serverConfig,
        {
            ...baseAppConfig,
            ignore_watch: [
                ...ignore_watch,
                '**/dist/**'
            ],
            name: 'server_builder',
            script: 'npm',
            args: 'run build_server',
            watch: [
                './src/index.js'
            ]
        }
        // clientConfig
    ]
}
