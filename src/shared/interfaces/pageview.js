const R = require('ramda')
const { Container } = require('../functional_types/base')


class PageView extends Container {
    getChildren(page_views) {
        return page_views.filter(R.propEq('parent'), this.data.id || this.data.id)
    }
}


module.exports = {
    PageViewInterface: PageView
}