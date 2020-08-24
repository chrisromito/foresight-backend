import { curry } from 'ramda'


export const pMap = curry((fn, list)=>
    list.reduce((pList, item, index)=>
        pList.then(accum =>
            accum.concat(
                fn(item, index, accum)
            )
        ),
        Promise.resolve([])
    ))

export default pMap