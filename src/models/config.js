import dotenv from 'dotenv'
import { PostgreSQL } from 'fxsql'

dotenv.config()

export const { CONNECT } = PostgreSQL
export const { DATABASE_URL } = process.env


const isDev = process.env.NODE_ENV !== 'production'


const tryToBuildDbUri = ()=> {
    try {
        return `postgresql://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`
    } catch(e) {
        return ''
    }
}

const DEV_DB_URI = tryToBuildDbUri()


export const DB_URI = isDev
    ? DEV_DB_URI
    : DATABASE_URL
        ? DATABASE_URL
        : DEV_DB_URI


export const POOL = CONNECT({ connectionString: DB_URI })


export const {
    VALUES,
    IN,
    NOT_IN,

    ASSOCIATE,
    ASSOCIATE_MODULE,
    CL,
    COLUMN,
    END,
    EQ,
    FxSQL_DEBUG,
    LJOIN,
    QUERY,
    SET,
    SQL,
    TABLE,
    TB,
    TRANSACTION
} = POOL


const _EXAMPLE = ()=> {
    const myId = 123
    const myName = 'Chris'
    const myPkColumn = 'id'
    const mySelectQuery = QUERY`
        SELECT *
            from ${TABLE('my_table_name')}
            WHERE ${EQ({ [myPkColumn]: myId })}
    `
    const myUpdateQuery = QUERY`
        UPDATE ${TABLE('my_table_name')}
            ${SET({ name: myName })}
            WHERE ${EQ({ id: myId })}
    `
    return myUpdateQuery.then(()=> mySelectQuery)
}
