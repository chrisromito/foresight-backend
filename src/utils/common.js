import * as R from 'ramda'


export const isString = R.is(String)

export const isBoolean = R.is(Boolean)

export const isArray = R.is(Array)

export const isFunction = R.is(Function)

export const isTrue = x => !!x

export const isFalse = x => !x

export const propIsFunction = (fn, prop)=> isFunction( R.prop(prop, fn) )


export const isNumber = R.allPass([
    R.complement(R.isNil),
    R.compose(
        R.complement(isNaN),
        Number
    )
])


export const isObject = R.complement(
    R.anyPass([
        isString,
        isBoolean,
        isArray,
        isFunction,
        isNumber
    ])
)


/**
 *  Object Utils
*============================*/
export const tryOrIdentity_ = fn => arg => R.tryCatch(fn, ()=> arg)(arg)


export const toPojo = tryOrIdentity_(
    R.compose(JSON.parse, JSON.stringify))


export const tryToJson = tryOrIdentity_(
    x => JSON.stringify(x, null, 4))


export const tryToParse = tryOrIdentity_(
    x => JSON.parse(x))


/**
 * String
 */
export const uuid = () => {
    let _uuid = ""
    let i = 0
    let random
    for (i = 0; i < 32; i++) {
        random = Math.random() * 16 | 0

        if (i === 8 || i === 12 || i === 16 || i === 20) {
            _uuid += "-"
        }
        _uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16)
    }
    return _uuid
}


/**
 * @func alphaOnly - Get alphanumeric characters from a String
 * @param {String} str
 * @returns {String}
 * @example
 * const myString = 'abc123!@#$%^'
 * alphaOnly(myString) // => 'abc123'
 */
export const alphaOnly = str =>
    str.match(/([a-zA-Z0-9]|\s)/gi).join('')


export const lettersOnly = str =>
    str.match(/([a-zA-Z]|\s)/gi).join('')


export const numbersOnly = str =>
    str.match(/([0-9]|\s)/gi).join('')


/**
 * @func kebabCase
 * @param {String} str
 * @returns {String}
 * @example
 * kebabCase(`hello world`) //=> hello-world
 * kebabCase('hiThere') // => hi-there
 */
export const kebabCase = str =>
    str.match(/[A-Z]{2,}(?=[A-Z][a-z0-9]*|\b)|[A-Z]?[a-z0-9]*|[A-Z]|[0-9]+/g)
        .filter(Boolean)
        .map(x => x.toLowerCase())
        .join('-')


/**
 * @func camelCase
 * @param {String} str
 * @returns {String}
 * @example
 * camelCase('Hello-world') // => 'HelloWorld'
 */
export const camelCase = str =>
    str.toLowerCase()
        .replace( /[-_]+/g, ' ')
        .replace( / (.)/g, sub => sub.toUpperCase())
        .split(' ')
        .join('')


/**
 * @func titleCase
 * @param {String} str
 * @returns {String}
 * @example
 * titleCase(`mY shIfT KeY IS BroKEn`) //=> 'My Shift Key Is Broken'
 */
export const titleCase = str =>
    str.replace(/\w\S*/g, txt => 
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    )


export const Str = {
    alphaOnly,
    lettersOnly,
    numbersOnly,
    camelCase,
    kebabCase,
    titleCase,
    uuid,
}


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
export const cyclicIndex = (arr, index) => {
    const len = arr.length
    return index < len ? arr[index] : arr[index % len]
}


export const tapLog = msg => x => {
    console.log(msg)
    console.log(tryToJson(x))
    return x
}
