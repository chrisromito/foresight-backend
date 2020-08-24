/**
 * @module tasks - Declares tasks/cron-jobs that are executed behind-the-scenes in the application
 */

const CronJob = require('cron').CronJob

const { RunTaskForAllClients } = require('./models/page_view/tasks/index')
const { trainModelForAllClients } = require('./neural/page_view/page_view_analysis')



const job = new CronJob('00 00 00 * * *', function() {
    const timestamp = Date.now()

    // Execute the PageStats calculation task, then train the Neural Networks for each client
    return RunTaskForAllClients(timestamp)
        .then(()=> trainModelForAllClients(timestamp))
})

job.start()