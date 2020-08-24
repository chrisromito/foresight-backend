/**
 * @module page_view.tasks.index - Provides a Task that
 * populates PageStats models.  This is designed to run ONCE per day.
 * Please modify 'timeStamp' variable/params where needed if this design changes.
 * 
 * NOTE: This heavily utilizes 'pChain' as a way to call Promises in loops (map, reduce, etc),
 * without blowing out the Stack.  This provides safety by chaining promises (unlike Promise.all())
 * & is necessary because of the StackOverflow Errors that pop up w/ tests of over 6k PageViews at once.
 */
const moment = require('./moment')
const R = require('ramda')
const pChain = require('../utils/pchain')
const { dateFloor, dateRangeFromNow } = require('../utils/dates')
const { GenerateClientStats } = require('./stats')
const { Client } = require('../models/index')


const RunTaskForAllClients = (timeStamp=Date.now())=> {
    const startTime = dateFloor(timeStamp).toDate()
    return Client.find()
        .exec()
        .then(clients =>
            pChain(
                clients.map(c => ()=>
                    GenerateClientStats(c, startTime)
                )
            )
        )
}



/**
 * @func RunForLastNDays - Run the `RunTaskForAllClients` function
 * for every day that's occurred between now and `n`
 * @param {Number} n - Number of days
 * @returns {Promise}
 */
const RunForLastNDays = (n=30)=> 
    pChain(
        R.map(
            date => ()=> RunTaskForAllClients(date),
            dateRangeFromNow(n)
        )
    )




module.exports = {
    GenerateClientStats,
    RunTaskForAllClients,
    RunForLastNDays
}
