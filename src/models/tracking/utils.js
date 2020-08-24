import { both, complement, isNil } from 'ramda'


const hasLength = a => String(a).trim().length


const argFilter = both(
    complement(isNil),
    hasLength
)


/**
 * @func getPath
 * @sig a -> b[] -> c -> String
 * @param {String} separator
 * @returns {function((String|Number)[]):
*              function((String|Number|null)): String}
*/
export const getPath = separator => args => parentPath => {
    const argList = argFilter(parentPath)
        ? [parentPath, ...args]
        : [...args]
    return argList.flat(5)
        .filter(argFilter)
        .join(separator)
}

