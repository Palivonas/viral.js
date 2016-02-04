var express = require('express');
var cookieParser = require('cookie-parser');
var redis = require('redis');
var sharer = require('./sharer.js');

var app = express();
var db = redis.createClient();
sharer.setDb(db);

app.use(cookieParser());
app.use('/', express.static(__dirname + '/public'));
app.get('/api', function (req, res) {
    // allow handling cookies
    res.header('Access-Control-Allow-Credentials', 'true');
    sharer.go(req, res);
});
app.listen(3000, function() {
    console.log('App started');
});