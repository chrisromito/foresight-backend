
const testDate = new Date()
const month = testDate.getMonth()
const dayOfMonth = testDate.getDate()
const testName = `${month}_${dayOfMonth}`
const testHost = `demo_client_${testName}.org`


export const testClientData = {
    name: `Foresight Test Client - ${testName}`
}

export const testDomainData = {
    host: testHost,
    hostname: testHost,
    href: `https://${testHost}`,
    origin: `https://${testHost}`,
    protocol: 'https:'
}


export const testSubDomainData = {
    ...testDomainData,
    host: `www.${testHost}`,
    hostname: `www.${testHost}`
}


export const testPageData = {
    title: 'Test Page Title',
    path: 'test_page_path/'
}


export const testPagePaths = [
    'home',
    'test_page_path/',
    'test_page_path/child/',
    'blog/test-blog-entry/',
    'blog'
].map(p => `${testDomainData.href}/${p}`)



export const testReferrerUrls = [
    'referrer',
    'some_wordpress_site',
    'google',
    'twitter',
    'facebook',
    'linkedin'
].map(p => `https://www.${p}.com/test_referrer_path/?referrer_param=referrer_param_value`)


export const validUrl = `${testDomainData.href}/test_page_path/`
export const invalidUrl = 'eiuhwfaeiofwoif'
export const invalidDomainUrl = 'https://google.com/test_page_path/'
