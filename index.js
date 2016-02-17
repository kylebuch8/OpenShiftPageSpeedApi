'use strict';

const Hapi = require('hapi');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const config = require('./config');
const _ = require('lodash');
const ObjectId = require('mongodb').ObjectID;

var mongoUrl;

if (process.env.OPENSHIFT_MONGODB_DB_URL) {
    mongoUrl = process.env.OPENSHIFT_MONGODB_DB_URL + 'pagespeed';
} else {
    mongoUrl = 'mongodb://localhost:27017/pagespeed';
}

const server = new Hapi.Server({
    connections: {
        routes: {
            cors: true
        }
    }
});

var getResults = (db, callback) => {
    var collection = db.collection('results');
    collection.find().toArray((err, items) => {
        assert.equal(err, null);

        if (items !== null) {
            callback(items);
        }
    });
};

var getCurrentScore = (db, callback) => {
    var collection = db.collection('currentScores');
    collection.find().toArray((err, item) => {
        if (item !== null) {
            callback(item);
        }
    });
};

var getSiteScores = (page, db, callback) => {
    db.collection('results', (err, collection) => {
        collection.find({ page: page }).toArray(function (err, items) {
            assert.equal(err, null);

            if (items !== null) {
                callback(items);
            }
        });
    });
};

//gets two object and returns difference object
var difference = function(a, b) {
    var r = {};
    _.each(a, function(v, k) {
        // If it's equal, return now
        if(b && (b[k] === v || _.isEqual(v, b[k]))) return;

        // If it's an array, the whole thing should be replaced
        if(Array.isArray(v)){
            return r[k] = v;
        }

        // Using a temp variable for the object diff recursion means we can omit empty objects
        var t = _.isObject(v) ? _.difference(v, b[k]) : v;

        if((_.isObject(t) && !_.isEmpty(t)) || !_.isObject(t)) {
            r[k] = t;
        }
      });

    return r;
};

//gets list of the urls that their speed are monitored
var getUrlList = (db, callback) => {
    db.collection('results').aggregate([
        { $unwind : '$results' },
        { $project: {
            'url': '$results.id',
            'strategy': '$results.strategy'
            }
        }
    ])
    .toArray(function(err, result) {
        var finalResult =_.uniqBy(result, 'url');
        assert.equal(err, null);
        callback(finalResult);
    });
};

//gets dates where score has been changed
var getMilestoneData = (url, strategy, db, callback) => {
    db.collection('results').aggregate([
        { $unwind : '$results' },
        { $match : { 'results.id': decodeURIComponent(url), 'results.strategy': strategy}   },
        { $sort : { 'date' : -1 } },
        { $project: {
                        'date': 1,
                        'score': '$results.ruleGroups.SPEED.score',
                        'results': '$results'
                    }
        }
    ])
    .toArray(function(err, result) {
        for (var i = 1, max=result.length; i < max; i++) {

            result[i-1].results.rulePoints = _.map(_.keys(result[i-1].results.formattedResults.ruleResults), function(rule) {
                var value1,
                    value2,
                    diff;

                value1 = result[i-1].results.formattedResults.ruleResults[rule].ruleImpact;
                value2 = result[i].results.formattedResults.ruleResults[rule].ruleImpact;
                diff = parseFloat(value1) - parseFloat(value2);

                return {
                    key: rule,
                    value: value1,
                    ruleDiff: diff
                };
            });

            result[i-1].results.rulePoints = result[i-1].results.rulePoints.filter(function(item) {
                return item.value !== 0;
            });
        }

        for (var i = 1, max=result.length; i < max; i++) {

            if (result[i].score === result[i-1].score) {
                result[i-1].state = 0;
                result[i].state = 1;

            } else {
                result[i-1].state = 1;
                result[i].state = 1;
            }

            result[i-1].ruleDiff = {};
            _.forIn(_.keys(result[i-1].results.formattedResults.ruleResults), function(rule) {

                var value1 =  result[i-1].results.formattedResults.ruleResults[rule].ruleImpact;
                var value2 =  result[i].results.formattedResults.ruleResults[rule].ruleImpact;

                result[i-1].ruleDiff[rule] = parseFloat(value1) - parseFloat(value1);
            });

            result[i-1].scoreDiff = result[i-1].score - result[i].score;
            result[i-1].pageDiff = difference(result[i].results.pageStats, result[i-1].results.pageStats);
        }

        var finalResult = result.filter(function(item) {
            return item.state == 1;
        });

        assert.equal(err, null);
        callback(finalResult);
   });
};

var getPageById = (id, db, callback) => {
    db.collection('results', (err, collection) => {
        collection.find({ _id: ObjectId(id) }).toArray(function (err, items) {
            assert.equal(err, null);

            if (items !== null) {
                callback(items);
            }
        });
    });
};

server.connection({
    host: process.env.OPENSHIFT_NODEJS_IP || 'localhost',
    port: process.env.OPENSHIFT_NODEJS_PORT || 8000
});

server.route({
    method: 'GET',
    path: '/',
    handler: (request, reply) => {
        MongoClient.connect(mongoUrl, (err, db) => {
            assert.equal(null, err);
            getResults(db, (items) => {
                db.close();
                return reply(items);
            });
        });
    }
});

server.route({
    method: 'GET',
    path: '/pages',
    handler: (request, reply) => {
        return reply(config.pages);
    }
});

server.route({
    method: 'GET',
    path: '/currentscore',
    handler: (request, reply) => {
        MongoClient.connect(mongoUrl, (err, db) => {
            assert.equal(null, err);
            getCurrentScore(db, (data) => {
                db.close();
                return reply(data);
            });
        });
    }
});

server.route({
    method: 'GET',
    path: '/scores',
    handler: (request, reply) => {
        MongoClient.connect(mongoUrl, (err, db) => {
            assert.equal(null, err);
            getSiteScores(request.query.site, db, (items) => {
                db.close();
                return reply(items);
            });
        });
    }
});

server.route({
    method: 'GET',
    path: '/milestones/{url}/{strategy}',
    handler: (request, reply) => {
        MongoClient.connect(mongoUrl, (err, db) => {
            assert.equal(null, err);
            var url = encodeURIComponent(request.params.url);
            var strategy = encodeURIComponent(request.params.strategy);
            getMilestoneData(url, strategy, db, function (data) {
                db.close();
                return reply(data);
            });
        });
    }
});

server.route({
    method: 'GET',
    path: '/page/{id}',
    handler: (request, reply) => {
        MongoClient.connect(mongoUrl, (err, db) => {
            assert.equal(null, err);
            var id = encodeURIComponent(request.params.id);
            getPageById(id, db, (item) => {
                db.close();
                return reply(item);
            });
        });
    }
});

server.route({
    method: 'GET',
    path: '/siteslist',
    handler: (request, reply) => {
        MongoClient.connect(mongoUrl, (err, db) => {
            assert.equal(null, err);
            getUrlList(db, (item) => {
                db.close();
                return reply(item);
            });
        });
    }
});

server.start((err) => {
    if (err) {
        throw err;
    }

    console.log('Hapi server running at: ', server.info.uri);
});
