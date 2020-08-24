import axios from 'axios'
import { isNil } from 'ramda'
import { Model } from '../base'
import { GetOrCreateRegion } from '../region/index'


const GEO_IP_API_URL = `https://www.geolocation-db.com/jsonp`


const checkDbForIp = model => ipv4 =>
    model.findOneWhere({ ipv4 })


const fetchAndCreate = model => ipv4 =>
    requestIpLocation(ipv4)
        .then(model.insert)


const requestIpLocation = ipv4 =>
    axios.get(`${GEO_IP_API_URL}/${ipv4}`)
        .then(serializeIpLocation(ipv4))
        .then(liftIpRequest)


const serializeIpLocation = ipv4 =>  json => ({
    ipv4,
    latitude: String(json.latitude),
    longitude: String(json.latitude)
})


const liftIpRequest = ({ city, state, country_code, country_name, postal, ...data })=>
    GetOrCreateRegion(
        [country_name, country_code],
        state,
        city,
        postal
    ).then(({ city, country, state, zipCode })=> ({
        ...data,
        city_id: city.id,
        country_id: country.id,
        state_id: state.id,
        zip_code_id: zipCode.id
    }))


const IpLocation_ = ()=> {
    const model = Model('ip_location')
    return {
        model,
        ...model,
        getOrCreate: ipv4 =>
            checkDbForIp(model)(ipv4)
                .then(resp =>
                    !isNil(resp)
                        ? resp
                        : fetchAndCreate(model)(ipv4)    
                )
    }
}

export const IpLocation = IpLocation_()
export default IpLocation
