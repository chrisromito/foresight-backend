import * as moment from 'moment'
import { dateFloor, dateCeil } from 'utils/dates'
import { COLUMN, SQL } from '../base'


export const dateBetween = columnName => (min, max=null)=> {
    const minDate = dateFloor(min).toDate()
    const maxDate = max ? dateCeil(max).toDate() : dateCeil(moment().toDate())
    return SQL`WHERE ${COLUMN(columnName)} BETWEEN ${minDate} and ${maxDate}`
}



export const dateBefore = columnName => d => {
    const date = moment(d).toDate()
    return SQL`WHERE ${COLUMN(columnName)} <= ${date}`
}


export const dateAfter = columnName => d => {
    const date = moment(d).toDate()
    return SQL`WHERE ${COLUMN(columnName)} >= ${date}`
}


export const relativeDateGt = columnName => deltaHours =>
    SQL`WHERE ${COLUMN(columnName)} >= NOW() - interval '${deltaHours} hour`


export const dateEqInterval = columnName => (deltaDays=0) =>
    SQL`WHERE DATE_TRUNC('day', ${columnName}) = CURRENT_DATE - interval '${deltaDays} day'`


export const forToday = columnName =>
    SQL`WHERE DATE_TRUNC('day', ${columnName}) = CURRENT_DATE`

