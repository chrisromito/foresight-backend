
export const randomIntBetween = (min, max) => Math.floor(
    Math.random() * (max - min)
) + min


export const randomItemFrom = (arr) => arr[randomIntBetween(0, arr.length)]


export const sample = (list, sampleSize=null) => {
    const len = sampleSize || randomIntBetween(0, list.length)
    let accum = []
    let i = 0
    for (i; i < len; i++) {
        accum.push(randomItemFrom(list))
    }
    return accum
}
