/**
 * @module neural.page_view.network - Provides interfaces
 * for interacting with Neural Networks using Page Views.
 * 
 */
const brain = require('./brain.js.js')
const R = require('ramda')
const { Future, Maybe } = require('ramda-fantasy')
const { NetworkState, DataState } = require('../types')



//-- Page View frequency Network


/**
 *  - Input: year, month, day, dayOfTheWeek, pageUrl, pageSequence
 *  - Output: uniqueViews, totalViews, percentOfTotalViews
 */


// TODO: Move these to 'data'


const yearLens = R.lensIndex(0)
const monthLens = R.lensIndex(1)
const dayLens = R.lensIndex(2)
const dayOfTheWeekLens = R.lensIndex(3)
const urlLens = R.lensIndex(4)
const seqLens = R.lensIndex(5)
const inputLenses = [yearLens, monthLens, dayLens, dayOfTheWeekLens, urlLens, seqLens]


const inputSpec = (pv)=> {
    const date = R.view(R.lensPath(['timestamp']), pv)
    const url = R.view(R.lensPath(['url']), pv)
    const urlIndex = R.view(R.lensPath(['urlIndex']), pv)

    return [
        date.getUTCFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getDay(),
        url,
        urlIndex
    ]
}

const outputSpec = (pv)=> [
        R.view(R.lensPath(['unique'])),
        R.view(R.lensPath(['total'])),
        R.view(R.lensPath(['percent']))
    ].map((fn)=> fn(pv))


const isFunction = R.is(Function)
const hasMapMethod = R.either(
    (o)=> R.has('map', o) && isFunction('map', o),
    (o)=> R.hasIn('map', o) && isFunction('map', o)
)


const Freq = (arg)=> ({
    value: ()=> arg,
    of: (x)=> Freq(x),

    map: (fn)=> Freq(fn(arg)),
    flatMap: (fn)=> hasMapMethod(arg)
        ? Freq(arg.map(fn))
        : Freq(arg).map(fn),

    toInput: (o)=> Freq(inputSpec(o)),
    toOutput: (o)=> Freq(outputSpec(o)),
    toPair: (o)=> Freq([
        inputSpec(o),
        outputSpec(o)
    ])
})




