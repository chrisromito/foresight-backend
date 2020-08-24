import * as R from 'ramda'
import moment from 'moment'


export const dateFloor = (d)=> moment(d).hour(0).minute(0).millisecond(0)


export const dateCeil = (d)=> moment(d).hour(23).minute(59).millisecond(999)


export const abbreviatedFormat = (d)=> moment(d).format('MMM D')


export const flipAbbreviatedFormat = (d)=> moment(d).format('D MMM')


export const commonFormat = (d)=> moment(d).format('DD-MM-YYYY')


export const toDate = (d)=> moment(d).toDate()


export const numeric = (d)=> moment(d).valueOf()


export const asString = (d)=> moment(d).toISOString()



/**
 * @func dateRange - Generate a list of Moments from `startDate` to `endDate`
 * @param {Date} startDate - lowest date
 * @param {Date} endDate - Max date
 * @returns {moment<Date>[]}
 */
export const dateRange = (startDate, endDate)=> {
    const diff = moment(endDate).diff(moment(startDate), 'days')

    const floorStart = dateFloor(startDate)
    const startMoment = ()=> moment(floorStart)
    // @ts-ignore
    return R.times(
        (n)=> startMoment().add(n, 'days'),
        diff
    )
}


export const dateRangeFromNow = nDays =>
    R.range(0, nDays)
        .map(n =>
            moment()
                .subtract(n, 'day')
                .toDate()
        )


/**
 * @func deltaTime :: d {Date} => n {Number}
 * Get the difference between `d` and Date.now() (in milliseconds)
 */
export const deltaTime = R.compose(
    R.invoker(2, 'toFixed')(1),
    Math.abs,
    (d)=> R.subtract(Date.now(), d)
)


export const deltaSeconds = R.compose(
    R.divide(R.__, 1000),
    deltaTime
)
