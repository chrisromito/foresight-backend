
export const ActionTypes = {
    unCategorized: 1,
    system: 2,
    client: 3,
    campaign: 4,
    interaction: 5  // Ex. When a user clicks something, submits a form, etc.
}


export const DefaultTagTypes = {
    unCategorized: 0,
    system: 1,
    client: 2,
    campaign: 3,
    device: 4,
    browser: 5,
    pageType: 6
}


export const Scope = {
    system: 0,    // A tag that's available system-wide.  Only 
    client: 1,    // Default: A tag that's scoped to a client
    campaign: 2,  // A tag that's only used within a certain marketing campaign/goal
}


export const StatTypes = {
    hour: 1,
    month: 2,
    dayOfWeek: 3,
    date: 4
}
