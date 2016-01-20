'use strict';

const Hapi = require('hapi');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const config = require('./config');

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

//get dates where score has been changed
var getMilestoneData = (db, callback) => {
    db.collection('results').aggregate([
        { $unwind : "$results" },
        { $match : {"results.id": "https://access.redhat.com/search/#/","results.strategy": "mobile"}   },
        { $limit : 10 }, { $sort : { "date" : -1 } },
        { $project: {
                        "date": 1,
                        "score": "$results.ruleGroups.SPEED.score"

                    }
        }
    ])
    .toArray(function(err, result) {

        for (var i = 1, max=result.length; i < max; i++) {

            if (result[i].score === result[i-1].score) {
                result[i-1].state = 0;
                result[i].state = 1;

            } else {
                result[i-1].state = 1;
                result[i].state = 1;
            }
        }

        var finalResult = result.filter(function(item) {
            return item.state === 1;
        });

        assert.equal(err, null);
        callback(finalResult);
   });
};

var getPageById = (id, db, callback) => {
    db.collection('results', (err, collection) => {
        collection.find({ _id: id }).toArray(function (err, items) {
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
    path: '/milestones',
    handler: (request, reply) => {
        MongoClient.connect(mongoUrl, (err, db) => {
            assert.equal(null, err);
            getMilestoneData(db, (data) => {
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

server.start((err) => {
    if (err) {
        throw err;
    }

    console.log('Hapi server running at: ', server.info.uri);
});
