import { extendModel } from 'models/base'
import { assocStatValue } from '../shared'


/**
 * @typedef {Object} pageViewHourly - Hourly breakdowns for page stats
 * @property {Number} id
 * @property {Number} stat_value_id - FK -> stat_value table
 * @property {Number} stat_count - Total # of page views
 * @property {Number} entry_count - Total # of page views where
 * this page was FIRST in the page_view_path sequence
 * @property {Number} exit_count - Total # of page views where
 * this page was LAST in the page_view_path sequence
 */
export const PageViewHourly = extendModel('page_view_hourly',
    model => ({
        assocStatValue
    })
)
