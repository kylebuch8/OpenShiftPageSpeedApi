var psi = require('psi');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var mongoUrl;

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

psi('http://access.redhat.com', {
    key: process.env.PS_API_KEY || '123456789abcdefghijkl',
    strategy: 'mobile'
}).then(function (data) {
    MongoClient.connect(mongoUrl, function (err, db) {
        assert.equal(null, err);
        insertDocument(data, db, function () {
            db.close();
        });
    });
});
