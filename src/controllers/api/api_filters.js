const moment = require('./moment')
const { ObjectId } = require('mongoose').Types
const R = require('ramda')
const { Either, Future } = require('ramda-fantasy')
const { Left, Right } = Either

const {
    dateFloor,
    dateCeil,
    abbreviatedFormat,
    flipAbbreviatedFormat,
    commonFormat,
    numeric,
    toDate,
    asString,
    dateRange,
    deltaTime,
    deltaSeconds
} = require('../../utils/dates')
const { tapLog, toPojo, tryToJson } = require('../../utils/common')
const SessionMonad = require('../user/interfaces')
const { serialize } = require('../common/serialize')
const { Client, Account } = require('../../models/index')


/**
 * Utils
 */

const validDateRange = (start, end)=> numeric(start) < numeric(end)
    ? Right({ start, end })
    : Left({ start, end })


const startLens = R.lensPath(['timestamp_start'])

const endLens = R.lensPath(['timestamp_end'])


const liftDate = liftFn => dateLens =>
    R.compose(
        toDate,
        liftFn,
        R.tryCatch(
            R.view(dateLens),
            R.always(moment())
        )
    )

const liftStartDate = liftDate(dateFloor)(startLens)

const liftEndDate = liftDate(dateCeil)(endLens)



/**
 * @func serializeDateRange - Grab the start date & end date from an Object,
 * return a new Object w/ the dates mapped to 'start' & 'end'
 * @example
 * const requestDateRange = (req, res)=> {
 *     const serializedRequestDateRange = serializedDateRange(req.query)
 *     const { start, end } = serializedRequestDateRange.value
 *     return res.json({ start, end })
 * }
 * @param {Object} o - Object that contains start date & end date filter values
 * @returns {Either<Left({ start, end }), Right({ start, end })>}
 */
const serializeDateRange = o =>
    validDateRange(liftStartDate(o), liftEndDate(o))

/**
 * @func timeStampDateRange
 * @example
 * const myController = (req, res)=>
 *      MyModel.filter(
 *          timeStampDateRange(req.query)
 *      )
 *      .exec()
 *      .then(myModels => req.json(myModels))
 * 
 * @param {Object} query - Object w/ 'timestamp_start' & 'timestamp_end' props
 * @returns {Object} Object that can be used to filter Mongoose models
 */
const timeStampDateRange = query => {
    const { start, end } = serializeDateRange(query)
    return {
        timestamp: {
            $gte: start,
            $lte: end
        }
    }
}


/**
 * @func filterByPageId - Grab the pageId list from a request.query &
 * return a Mongoose Filter object
 */

const filterByPageId = query =>
    R.isNil(query.pageIds)
        ? {}
        : {
            pageId: {
                $in: query.pageIds.map(ObjectId)
            }
        }


const reduceFilters = filterList => query =>
    filterList.reduce((acc, fn)=>
        R.mergeDeepRight(acc, fn(query)),
        {}
    )


module.exports = {
    filterByPageId,
    reduceFilters,
    timeStampDateRange
}
