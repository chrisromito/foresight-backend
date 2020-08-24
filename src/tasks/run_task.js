const { RunForLastNDays } = require('./index')


RunForLastNDays()
    .then(result => {
        console.log(`Successfully ran stats task for the last 30 days`)
        return result
    })
    .catch(e => {
        console.error(`Caught an error while attempting to run stats task for clients.`)
        console.trace(e)
        console.dir(e)
        return Promise.reject(e)
    })
