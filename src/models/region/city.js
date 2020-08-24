
import { Model, TABLE, QUERY } from '../base'


const City_ = ()=> {
    const name = 'city'
    const model = Model(name)

    return {
        ...model,
        model,
        idForName: cityName =>
            (QUERY`
                SELECT * 
                    FROM ${TABLE(name)}
                    WHERE name ILIKE '%${cityName}%'
                    LIMIT(1)
            `).then(list => list.length ? list[0].id : null)
    }
}

export const City = City_()
export default City