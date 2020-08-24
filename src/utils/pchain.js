/**
 * @module pchain - Promise chain utility function
 * Execute an Array of Promises in a sequential order (unlike Promise.all() and Promise.race())
 * 
 * @example
 * >>> const randomIntBetween = (min, max)=> Math.floor(
 *    Math.random() * (max - min)
 * ) + min
 * 
 * >>> const logThunk = (index)=> ()=> new Promise((resolve)=> setTimeout(()=> {
 *    console.log(`Function index: ${index}`)
 *    resolve(index)
 * }, randomIntBetween(10, 1000))) 
 *
 * >>> const thunks = [
 *    logThunk(0),
 *    logThunk(1),
 *    logThunk(2),
 *    logThunk(3)
 * ]
 * 
 * >>> pChain(thunks) // => [0, 1, 2, 3]
 * // Function index: 0
 * // Function index: 1
 * // Function index: 2
 * // Function index: 3
 * 
 * >>> Promise.all(thunks.map((fn)=> fn())) // => [0, 1, 2, 3]
 * // Function index: 3
 * // Function index: 0
 * // Function index: 1
 * // Function index: 2
 */



export const pChain = async fnList => {
    let results = []
    for (let i = 0; i < fnList.length; i++) {
        const fn = fnList[i]
        const result = await fn()
        results = results.concat(result)
    }
    return results
}

export default pChain
