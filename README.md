# OpenShift Page Speed API

[PageSpeed Insights](https://developers.google.com/speed/pagespeed/insights/) is a great tool provided by Google for you to see how fast your web page loads. This is very handy, but I found myself checking the page everyday and decided to automate the reporting.

This backend API uses the [psi node module](https://github.com/addyosmani/psi) to get the page speed data for an array of sites and then stores that data in a Mongo database. It also uses [hapi](http://hapijs.com/) to serve the json data via an API.

OpenShift is a big help for this project since it hosts my code and runs a daily cron to gather all of the data for the pages I configured in the config.js file.

## Getting Started
    npm install

 You'll need to get an [API key from Google](https://developers.google.com/speed/docs/insights/v1/getting_started?hl=en) and create a keys.js file at the root of your application.

    var keys = {
        ps_api_key: 'YOUR API KEY'
    };

    module.exports = keys;

Also you'll need to set up config.js to your liking. The id should be a unique number.

    var config = {
        pages: [
            {
                id: '1',
                url: 'https://access.redhat.com',
                strategies: ['desktop', 'mobile']
            },
            {
                id: '2',
                url: 'https://access.redhat.com/search',
                strategies: ['desktop', 'mobile']
            }
        ]
    };

    module.exports = config;

The strategies that are available for any site are "desktop" and "mobile".

## Getting Results
    node pagespeed.js

That should use the pages in your config.js file and grab the date from the PageSpeed API and store it in a Mongo collection.

## Running the API
    node index.js

That will serve your API at http://localhost:8000.

The endpoints that are available are:
* / - (returns all of the data)
* /currentscore - (returns current scores for all of your sites)
* /scores - (returns the scores for a single site)

/scores requires a site parameter in the query string that matches one of the sites listed in your config.js.

    http://localhost:8000/scores?site=https://access.redhat.com

## Adding a Front-End
I have a pre-built front-end that you can use with this backend at [pagespeed-frontend](https://github.com/kylebuch8/pagespeed-frontend).

![Page Speed Viewer](https://cloud.githubusercontent.com/assets/330256/11816907/90674ff4-a320-11e5-8668-25914f0320f2.png)

But you can also create any front-end that will satisfy your needs.
