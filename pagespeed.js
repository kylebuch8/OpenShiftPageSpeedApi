var psi = require('psi');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var q = require('q');
var config = require('./config');
var mongoUrl;
var apiKeys;

if (!process.env.PS_API_KEY) {
    apiKeys = require('./keys');
}

if (process.env.OPENSHIFT_MONGODB_DB_URL) {
    mongoUrl = process.env.OPENSHIFT_MONGODB_DB_URL + 'pagespeed';
} else {
    mongoUrl = 'mongodb://localhost:27017/pagespeed';
}

var insertDocument = function (data, db, callback) {
    var deferred = q.defer();

    db.collection('results3').insertOne(data, function (err, result) {
        assert.equal(err, null);
        console.log('Inserted a document into the results collection.');
        deferred.resolve(result);
    });

    return deferred.promise;
};

var updateCurrentScore = function (page, db) {
    var deferred = q.defer();

    db.collection('currentScores').update({
        page: page.page
    }, page, { upsert: true }, function (err, result) {
        assert.equal(err, null);
        console.log('Updated current score');
        deferred.resolve(result);
    });

    return deferred.promise;
};

var getPageSpeedResult = function (url, strategy) {
    console.log('getPageSpeedResult');
    return psi(url, {
        key: process.env.PS_API_KEY || apiKeys.ps_api_key,
        strategy: strategy
    }).then(function (data) {
        data.date = new Date();
        data.strategy = strategy;

        return data;
    });
};

var storePageSpeedResults = function (page) {
    var deferred = q.defer();
    var getPageSpeedResultFunctions = [];

    page.strategies.forEach(function (strategy) {
        getPageSpeedResultFunctions.push(getPageSpeedResult(page.url, strategy));
    });

    q.all(getPageSpeedResultFunctions).then(function (data) {
        var result = {
            page: page.url,
            title: data[0].title,
            date: data[0].date,
            results: data
        };

        MongoClient.connect(mongoUrl, function (err, db) {
            assert.equal(null, err);
            insertDocument(result, db).then(function () {
                db.close();
                deferred.resolve(result);
            });
        });
    });

    return deferred.promise;
};

var getPageSpeedResults = function () {
    var pageResultFunctions = [];

    config.pages.forEach(function (page) {
        pageResultFunctions.push(storePageSpeedResults(page));
    });

    return q.all(pageResultFunctions);
};

var setCurrentScores = function (pages) {
    var deferred = q.defer();
    var pagesData = [];
    var updateCurrentScoreFunctions = [];

    updateCurrentScoreFunctions.push(pages.forEach(function (page) {
        var pageDeferred = q.defer();
        var pageData = {
            page: page.page,
            title: page.title,
            date: page.date
        };

        page.results.forEach(function (result) {
            pageData[result.strategy] = result.ruleGroups.SPEED.score;
        });

        MongoClient.connect(mongoUrl, function (err, db) {
            assert.equal(null, err);
            updateCurrentScore(pageData, db).then(function () {
                db.close();
                pageDeferred.resolve();
            });
        });
    }));

    q.all(updateCurrentScoreFunctions).then(function () {
        deferred.resolve(pages);
    });

    return deferred.promise;
};

getPageSpeedResults()
.then(function (pages) {
    return setCurrentScores(pages);
}).then(function () {
    console.log('all done!');
});
