import City from './city'
import Country from './country'
import State from './state'
import ZipCode from './zip_code'

export * from './city'
export * from './country'
export * from './state'
export * from './zip_code'


const getOrCreateCountry = (name, code)=>
    Country.findByCode(code)
        .then(country =>
            country
                ? country
                : Country.insert({ name, code })    
        )


const getOrCreateState = (name, country_id)=>
    State.findByName(name)
        .then(state =>
            state
                ? state
                : State.insert({ name, country_id })    
        )


const getOrCreateCity = (name, state_id)=>
    City.findByName(name)
        .then(city =>
            city
                ? city
                : City.insert({ name, state_id })
        )


const getOrCreateZipCode = (code, city_id)=>
    ZipCode.findByCode(code)
        .then(zip =>
            zip
                ? zip
                : ZipCode.insert({ code, city_id })
        )


export const GetOrCreateRegion = (countryCodeName, stateName, cityName, zipCode)=>
    getOrCreateCountry(...countryCodeName)
        .then(country =>
            ({ country, city: null, state: null, zipCode: null })
        ).then(({ country, ...data }) => 
            getOrCreateState(stateName, country.id)
                .then(state => ({
                    ...data,
                    country,
                    state
                }))
                .catch(()=>
                    Promise.reject({ country, ...data })
                )
        ).then(({ country, state, ...data })=>
            getOrCreateCity(cityName, state.id)
                .then(city => ({
                    ...data,
                    city,
                    country,
                    state
                }))
                .catch(()=>
                    Promise.reject({ country, state, ...data })
                )
        ).then(({ city, country, state, ...data })=> 
            getOrCreateZipCode(zipCode, city.id)
                .then(zipCode => ({
                    city,
                    country,
                    state,
                    zipCode
                }))
                .catch(()=>
                    Promise.reject({ country, city, state, ...data })
                )
        ).catch(o =>
            Promise.resolve(o)
        )

