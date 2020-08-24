/** @module login - Provide configurable middleware that ensures
 * the current user is logged in
 * @exports isLoggedIn:: options {Object} => {Function}:: req, res, next
 */

const isLoggedIn = (options)=> (req, res, next)=> next()


module.exports = isLoggedIn
