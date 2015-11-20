'use strict';

const Hapi = require('hapi');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

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

        if (items != null) {
            callback(items);
        }
    });
};

var getCurrentScore = (db, callback) => {
    var collection = db.collection('results');
    collection.find({}, {
        sort: { $natural: -1 },
        limit: 2
    }).toArray((err, items) => {
        if (items != null) {
            if (items.length === 2) {
                if (items[0].strategy === 'desktop' && items[1].strategy === 'desktop') {
                    callback(items[0]);
                    return;
                }
            }

            callback(items);
        }
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

server.start((err) => {
    if (err) {
        throw err;
    }

    console.log('Hapi server running at: ', server.info.uri);
});
