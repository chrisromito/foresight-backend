const R = require('ramda')
const { Either } = require('ramda-fantasy')
const { Left, Right } = Either
const moment = require('./moment')
const { ObjectId } = require('mongoose').Types
const SessionMonad = require('../user/interfaces')
const { 
    ActionStats,
    Client,
    ClientStats,
    Domain,
    Page,
    PageStats,
    PageFlowStats
 } = require('../../models/index')
const { dateCeil, dateFloor, numeric, toDate } = require('../../utils/dates')



const queryToObject = R.map(o => o.toObject())


// URL Filters

const floorToDate = R.compose(toDate, dateFloor)
const ceilToDate = R.compose(toDate, dateCeil)


const defaultStart = ()=> floorToDate( moment().subtract(30 * 6, 'days') )

const defaultEnd = ()=> ceilToDate( moment() )


const validDate = d => !moment(Number(d)).isValid()
    ? Left( moment() )
    : Right( moment(Number(d)) )


const parseStart = o =>
    validDate(o.timestamp_start)
        .bimap(
            ()=> defaultStart(),
            m => m
        )
        .either(floorToDate, floorToDate)


const parseEnd = o =>
    validDate(o.timestamp_end)
        .bimap(
            m => m,
            m => m
        )
        .either(ceilToDate, ceilToDate)


const validDateRange = (startDate, endDate)=> (
    moment(startDate).isBefore(endDate)
    && moment(endDate).isBefore(moment())
)


const parseDateRange = query => {
    const start = parseStart(query).value
    const end = parseEnd(query).value

    return validDateRange(start, end)
        ? {
            startDate: start,
            endDate: end
        }
        : { startDate: defaultStart(),
            endDate: defaultEnd()
        }
}


const timestampFilter = query => obj => {
    const dateRange = parseDateRange(query)
    console.log('timestampFilter()')
    console.log(dateRange.startDate)
    return {...obj, ...{
        timestamp: {
            $gte: dateRange.startDate,
            $lte: dateRange.endDate
        }
    }}
}


const pageFilter = ({ pageId=null })=> obj => !pageId
    ? obj
    : R.assoc('page', ObjectId(pageId), obj)


/**
 * Sankey Serialization
 */
const liftPageFlowStats = pageFlowStats => {
    const liftedSeq = pageFlowStats
        .reduce(({ seqSet, seqKeyMap }, flowStats)=> {
            const lifted = liftSeqParents(seqSet, flowStats)
            return {
                seqSet: lifted.seqSet,
                seqKeyMap: {...seqKeyMap, ...lifted.seqKeyMap}
            }
        }, {
            seqSet: new Set(),
            seqKeyMap: {}
        })
    const flowSeqList = Object.values(liftedSeq.seqKeyMap)
    const minSeq = Math.min(...Array.from(liftedSeq.seqSet))
    flowSeqList.forEach(seq => {
        console.log(`seq -> parentId: ${seq.parentId}
        seq -> sequence: ${seq.sequence}`)
    })
    const flowTree = flowSeqList.filter(flowSeq => flowSeq.sequence === minSeq)
        .map(flowSeq => ({
            ...flowSeq,
            children: getChildren(flowSeq.pageId, minSeq + 1, flowSeqList, [])
        }))
    return flowTree
}


const liftSeqParents = (seqSet, flowStats) => {
    const page = flowStats.page
    const pageId = page._id
    const seqKeyMap = flowStats.seqParentDistribution
        .reduce((accum, [keyString, currentCount, popularity])=> {
            // Keystring = '{sequence},{parentPageId}
            const splitKeys = keyString.split(',')
            const sequence = toNumber(R.head(splitKeys))
            const parentId = R.last(splitKeys)
            if (R.isNil(sequence)) {
                return accum
            }

            // Add to the seqSet so we can keep track of the sequences we encountered
            seqSet.add(sequence)
            const parentSequence = sequence < 0 ? null : sequence - 1

            // Now that we have it all laid out, sum them up based on their sequence, page, parentId, and parentSequence
            const accumKey = `${parentSequence}-${parentId}-${sequence}-${page}`
            const count = accum[accumKey] ? accum[accumKey].count + currentCount : currentCount
            accum[accumKey] = {
                sequence,
                count,
                page,
                pageId,
                parentId,
                parentSequence
            }
            return accum
        }, {})
    return {
        seqSet,
        seqKeyMap
    }
}


const getChildren = (parentPageId, sequence, available, accum=[])=> {
    const matches = available
        .filter(flowStat => flowStat.sequence === sequence && flowStat.parentId === parentPageId)
        .map(flowStat => ({
            ...flowStat,
            children: getChildren(flowStat.parentId, sequence + 1, available)
        }))
    return accum.concat(matches)
}


const isNumber = R.both(
    R.is(Number),
    R.complement(isNaN)
)


const toNumber = R.compose(
    R.ifElse(
        isNumber,
        R.identity,
        R.always(null)
    ),
    Number
)
    

/**
 * Models & Query Helpers
 */

const clientFilter = ({ client, ...kwargs })=> model => {
    const schemaFields = Object.keys(model.schema.obj)
    const schemaContains = key => schemaFields.includes(key)

    const find = model.find({
        ...kwargs,
        client: ObjectId(client)
    })
    .select('-__v')

    const findExcludeClient = schemaContains('client')
        ? find.select('-client')
        : find
    
    const findWithPage = schemaContains('page')
        ? findExcludeClient.populate('page')
        : findExcludeClient

    return findWithPage.exec().then(queryToObject)
}


/**
 * Controller methods / HTTP
 */

const PageStatsList = (req, res)=> {
    const filters = [
        timestampFilter,
        pageFilter
    ].map(f => f(req.query))

    const filterPred = clientFilter({
        ...filters.reduce((accum, fn)=> fn(accum), {}),
        client: SessionMonad(req).value().client
    })

    return filterPred(PageStats)
        .then(data => res.json(data))
}


const TrafficStats = (req, res)=> {
    const baseFilter = {
        ...timestampFilter(req.query)({}),
        client: SessionMonad(req).value().client
    }
    const clientStats = clientFilter(baseFilter)(ClientStats)
    const pageStats = clientFilter({
        ...baseFilter,
        ...pageFilter(req.query)({})
    })(PageStats)


    console.log(baseFilter)

    return Promise.all([
        pageStats,
        clientStats
    ])
    .then(([ pageStats, clientStats ])=>
        res.json({ pageStats, clientStats })
    )
}


const InteractionStats = (req, res)=> {
    const client = SessionMonad(req).value().client
    const baseFilter = {
        client,
        ...timestampFilter(req.query)({})
    }

    const pageStats = clientFilter({
        ...baseFilter,
        ...pageFilter(req.query)({})
    })(PageStats)

    const clientTimeFilter = clientFilter(baseFilter)
    const clientStats = clientTimeFilter(ClientStats)
    const pageFlowStats = clientTimeFilter(PageFlowStats)

    return Promise.all([
        pageStats,
        pageFlowStats,
        clientStats,
        Domain.find({ client: ObjectId(client) })
            .select('origin')
            .exec(),
        Page.find({ client: ObjectId(client) })
            .select('_id created updated name description url.origin url.pathname')
            .exec()
    ]).then(([
        pageStats,
        pageFlowStats,
        clientStats,
        domains,
        pages
    ])=>
        res.json({
            pageStats,
            pageFlowStats,
            clientStats,
            domains,
            pages
        })
    )
}





module.exports = {
    InteractionStats,
    PageStatsList,
    TrafficStats
}
