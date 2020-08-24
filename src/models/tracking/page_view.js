/**
 * @module page_view - Models for PageViews & PageViewPaths
 * @see PageView & @see PageViewPath
 * Please refer to their respective typedefs below as well
 */
import * as R from 'ramda'
import  { extendModel, ASSOCIATE_MODULE } from '../base'
import { getPath } from './utils'
import { PageViewPathService } from './service'


/**
 * @typedef {Object} pageView Instance of a user viewing a page
 * @property {Number} id
 * @property {Number} page_id
 * @property {Number} user_id
 * @property {Boolean} active - Is the user currently viewing this page?
 * @property {String} path - Path in the 'graph' sense, not URL path
 * This lets us quickly sort, search, filter etc. page views
 * in aggregates/queries, and arrange graph nodes starting from any point
 * @property {(Object|null)} meta_data 
 */
export const PageView = extendModel(
    'page_view',
    ()=> ({
        separator: '-',
        getPath: getPath('-')
    })
)



/**
 * @typedef {Object} pageViewPath Connector for <= 1 pageView
 * pageViewPaths connect page views.  This allows us to treat pageViews
 * as nodes in a graph, 
 * 
 * @property {Number} id
 * @property {(Number|null)} parent_id
 * @property {(Number|null)} from_page_view_id - Null for the first page view in a sequence
 * @property {Number} to_page_view_id - The target page view in a sequence
 * @property {String} path - @see pageView
 * PageViewPath paths are structured as `page_id.depth`.  Children extend the parent path
 * Ie. If a page view hits a page w/ an ID = 25, and a depth of 0 (the first page in a sequence of a user's journey)
 *   it would have a path === '25.0'
 * @property {Number} index
 * @property {Number} depth
 * @property {Number} referrer_id - Used to denote the page that brought the user
 * into this sequence of page views.  Lets us store referrers separately, while
 * being able to query them from any starting point.
 * NOTE: Child PageViewPaths inherit their parent's referrer_id
 * @property {(Number|null)} ip_location_id - IP address associated w/ the user's page view(s)
 * NOTE: Child PageViewPaths inherit their parent's ip_location_id
 * @property {Date} created
 * @property {Date} updated
 * @property {(Object|null)} meta_data 
 */

export const PageViewPath = extendModel('page_view_path',
    model => ({
        getPath: getPath(','),
        /**
         * @method assocPageViews - Use as a partial argument
         * to an ASSOCIATE() instance
         * @example
         * > // Get page view paths + page views for user_id 123
         * > const myPageViewsWithPages = await PageViewPath.meta.ASSOCIATE`
         *      - page_view_path ${SQL`WHERE user_id = 123`}
         *         ${PageViewPath.assocPageViews}
         * `
         * > const firstPvp = myPageViewsWithPages[0]
         * > const fromPageView = firstPvp._.from_page_view
         * > const toPageView = firstPvp._.to_page_view
         * > assert fromPageView.id === firstPvp.from_page_view_id
         * > assert toPageView.id === firstPvp.to_page_view_id
         */
        assocPageViews: ()=>
            ASSOCIATE_MODULE`
                - to_page_view ${{
                    left_key: 'to_page_view_id',
                    key: 'id',
                    table: 'page_view'
                }}
                - from_page_view ${{
                    left_key: 'from_page_view_id',
                    key: 'id',
                    table: 'page_view'
                }}
            `,

        assocUser: ()=>
            ASSOCIATE_MODULE`
                - user ${{
                    left_key: 'user_id',
                    key: 'id',
                    table: 'app_user'
                }}
            `,
        /**
         * @method insert - Insert a PageViewPath record
         * If parent_id is included, we attempt to pull in the parent's
         * data as outlined above
         * The `...data` spread operator allows you to override this
         * logic at any point w/ minimal consequences
         * @param {{
         *      parent_id: (Number|null),
         *      to_page_view_id: Number,
         *      ...data: *
         * }} fields - Fields for the PageViewPath record
         * @returns {Promise<pageViewPath>}
         */
        insert: ({ parent_id, to_page_view_id, ...data })=>
            // Get the parent (if possible) && the target page view
            Promise.all([
                model.getById(parent_id),
                PageView.getById(to_page_view_id)
            ])
            .then(([parent, toPageView]) => {
                if (R.isNil(toPageView) && R.isNil(to_page_view_id)) {
                    throw new TypeError(`
                        page_view_path.to_page_view_id cannot be null.
                        Did you mix up "to_page_view_id" and "from_page_view_id"?
                    `)
                }
                // Build out fields that extend the parent
                const parentPropOrNull = prop => parent ? R.prop(prop, parent) : null
                const index = parent ? parent.index + 1 : 0
                const ip_location_id = parentPropOrNull('ip_location_id')
                const referrer_id = parentPropOrNull('referrer_id')
                    || data.referrer_id
                    || null
                const from_page_view_id = parentPropOrNull('to_page_view_id')
                const parentPath = parentPropOrNull('path')
                const path = model.getPath([`p${toPageView.page_id}`, `i${index}`])(parentPath)
                const user_id = parentPropOrNull('user_id') || data.user_id

                return model.base.insert(
                    R.mergeDeepRight({ ...data }, {
                        user_id,
                        parent_id,
                        from_page_view_id,
                        to_page_view_id,
                        path,
                        index,
                        ip_location_id,
                        referrer_id,
                        depth: index
                    })
                )
            })
    })
)


const liftPageViewPath = args => PageViewPathService(PageViewPath).liftPageViewPath(args)

PageViewPath.lift = liftPageViewPath

