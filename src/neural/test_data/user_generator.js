const R = require('ramda')
const moment = require('./moment')
const { Action, actionTypes, User, Account } = require('../../models/index')
const { randomIntBetween, randomItemFrom, randomQueryString } = require('./utils')
const RandomUserData = require('./test_accounts').data
const pChain = require('../../utils/pchain')
const { getClientTestData } = require('./clients')



const MS_PER_MINUTE = 1000 * 60
const MS_PER_HOUR = MS_PER_MINUTE * 60
const MS_PER_DAY = MS_PER_HOUR * 24
const DAYS_PER_HALF_YEAR = 365 / 2
const MS_PER_HALF_YEAR = MS_PER_DAY * DAYS_PER_HALF_YEAR

const randomTimeFrom = (ms_threshold=MS_PER_HALF_YEAR)=> randomIntBetween(
    now - ms_threshold,
    now
)



/**
 * Account/User CRUD
 * 
 *=========================================*/

const getAge = ()=> randomIntBetween(18, 100)

const now = Date.now()

const mostRecentNewYears = moment(now).month(0).day(0).second(0)


const getDob = ()=>
    moment(mostRecentNewYears)
        .year( mostRecentNewYears().year() - getAge() )
        .add( randomIntBetween(0, 365), 'days' )
        .toDate()


const createTestAccount = (client)=> (created, { first_name, last_name })=>
    new Account({
        client,
        created,
        first_name,
        last_name,
        date_of_birth: getDob(),
        is_male: Boolean(randomIntBetween(0, 100) % 2),
        password: 'TestAccountPassword',
        username: `${first_name}${last_name}${randomIntBetween(1, 999999999999)}@actiontracker.test.com`
    }).save()


const generateRandomAccountThunks = (client, day_threshold, accountData)=>
    accountData
        .map((data)=> ()=>
            createTestAccount(client)(
                randomTimeFrom(day_threshold * MS_PER_DAY),
                data
            )
        )


const generateRandomAccounts = (numberOfAccounts=1000, day_threshold=500)=>
    getClientTestData()
        .then(({ client })=> {
            const userNames = RandomUserData.reduce((obj, { first_name, last_name })=> ({
                first_name: obj.first_name.concat(first_name),
                last_name: obj.last_name.concat(last_name)
            }), {
                first_name: [],
                last_name: []
            })

            const accountData = R.repeat(0, numberOfAccounts)
                .map(()=> ({
                    first_name: randomItemFrom(userNames.first_name),
                    last_name: randomItemFrom(userNames.last_name)
                }))
            return {
                accountData,
                client: client._id
            }
        })
        .then(({ client, accountData })=>
            pChain(
                generateRandomAccountThunks(client, day_threshold, accountData)
            )
        )



const getTestAccounts = ()=> Account.find({
    username: /.*actiontracker.test.com/i
}).exec()



const _deleteRandomUsers = (accounts)=> User.deleteMany({
    account: {
        $in: accounts.map(R.prop('_id'))
    }
}).exec()

const _deleteUserAccounts = (accounts)=> Account.deleteMany({
    _id: {
        $in: accounts.map(R.prop('_id'))
    }
}).exec()


const deleteRandomAccounts = ()=> {
    const testAccounts = Account.find({})
        .where('username', /@actiontracker.test.com/gi)
        .exec()

    return testAccounts.then((accounts)=> Promise.all([
        _deleteRandomUsers(accounts),
        _deleteUserAccounts(accounts)
    ]))
}



/**
 * @func generateRandomSearchActions - Generate Search Actions based on
 * Our existing Users & their respective accounts
 * 
 */

/**
 * @func cyclicIndex - Get `index` from array.  If `index` > `arr`.length,
 * it will get the index from the array as if the array repeated until
 * we were able to get the index.
 * 
 * @example
 * var myArr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
 * myArr.length //=> 11
 * cyclicIndex(myArr, 12) //=> 1
 * cyclicIndex(myArr, 13) //=> 2
 * cyclicIndex(myArr, 14) //=> 3
 */
const cyclicIndex = (arr, index)=> {
    const len = arr.length
    return index < len ? arr[index] : arr[index % len]
}




module.exports = {
    getTestAccounts,
    generateRandomAccounts,
    deleteRandomAccounts,

    randomTimeFrom,
    cyclicIndex
}
