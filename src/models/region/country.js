import { Model, TABLE, QUERY } from '../base'


const Country_ = ()=> {
    const name = 'country'
    const model = Model(name)

    return {
        ...model,
        model,
        findByCode: countryCode =>
            (QUERY`
                SELECT * FROM ${TABLE(name)}
                    WHERE code LIKE ${countryCode}
                    LIMIT(1)
            `).then(list => list.length ? list[0] : null)
    }
}

export const Country = Country_()
export default Country