
import { Model, EQ, TABLE, QUERY } from '../base'


const ZipCode_ = ()=> {
    const name = 'zip_code'
    const model = Model(name)

    return {
        ...model,
        model,
        idForCode: code =>
            (QUERY`
                SELECT * FROM ${TABLE(name)}
                    WHERE ${EQ({ code })}
                    LIMIT(1)
            `).then(list => list.length ? list[0].id : null)
    }
}


export const ZipCode = ZipCode_()
export default ZipCode
