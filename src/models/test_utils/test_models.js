import { Client, Page, Domain } from '../client/index'
import { User } from '../user'
import {
    testClientData,
    testDomainData,
    testSubDomainData,
    testPageData,
    testPagePaths
} from './constants'


export const getTestClient = ()=> Client.getOrCreate(testClientData, testClientData)


export const getTestDomain = client_id =>
    Domain.getOrCreate({...testDomainData, client_id}, {...testDomainData, client_id})
        .then(first =>
            Domain.getOrCreate({
                ...testSubDomainData, client_id },
                { ...testSubDomainData, client_id }
            ).then(()=> first)
        )


export const createTestPages = client_id =>
    getTestDomain(client_id)
        .then(domain =>
            Promise.all(
                testPagePaths.map(url =>
                    Page.getOrCreate({
                        client_id,
                        url,
                        domain_id: domain.id,
                        title: testPageData.title
                    })
                )
            )    
        )


export const getTestPages = ()=>
    getTestClient()
        .then(client => 
            Page.selectWhere({ client_id: client.id })
                .then(pages =>
                    pages.length === testPagePaths.length
                        ? pages
                        : createTestPages(client.id)
                )
        )


export const testUserData = {
    active: true,
    // session_id: 3
}


export const getTestUser = ()=>
    getTestClient()
        .then(client => client.id)
        .then(client_id =>
            User.getOrCreate(
                { client_id, ...testUserData },
                { client_id, ...testUserData }
            )
        )
