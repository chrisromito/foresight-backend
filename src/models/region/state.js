
import { Model, TABLE, QUERY } from '../base'


const State_ = ()=> {
    const name = 'state'
    const model = Model(name)

    return {
        ...model,
        model,
        idForName: stateName =>
            (QUERY`
                SELECT * FROM ${TABLE(name)}
                    WHERE name ILIKE '%${stateName}%'
                    LIMIT(1)
            `).then(list => list.length ? list[0].id : null)
    }
}

export const State = State_()
export default State