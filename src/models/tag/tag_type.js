import { Model } from '../base'
import {
    DefaultTagTypes,
    Scope
} from '../constants'


const TagType_ = ()=> {
    const name = 'tag_type'
    const model = Model(name)

    return {
        ...model,
        model,
        name,
        scopes: Scope,
        tagTypes: DefaultTagTypes
    }
}

export const TagType = TagType_()

export default TagType