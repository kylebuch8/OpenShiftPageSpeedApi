var psi = require('psi');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
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
    db.collection('results').insertOne(data, function (err, result) {
        assert.equal(err, null);
        console.log('Inserted a document into the results collection.');
        callback(result);
    });
};

var getPageSpeedResult = function (url, strategy) {
    psi(url, {
        key: process.env.PS_API_KEY || apiKeys.ps_api_key,
        strategy: strategy
    }).then(function (data) {
        data.date = new Date();
        data.strategy = strategy;

        MongoClient.connect(mongoUrl, function (err, db) {
            assert.equal(null, err);
            insertDocument(data, db, function () {
                db.close();
            });
        });
    });
};

config.pages.forEach(function (page) {
    page.strategies.forEach(function (strategy) {
        getPageSpeedResult(page.url, strategy);
    });
});
