
const randomIntBetween = (min, max)=> Math.floor(
    Math.random() * (max - min)
) + min


const randomQueryString = (str)=> str.slice(0,
    randomIntBetween(2, str.length)
)

const randomItemFrom = (arr)=> arr[randomIntBetween(0, arr.length)]


module.exports = {
    randomIntBetween,
    randomQueryString,
    randomItemFrom
}