var Hashids = require('hashids'),
    hashids = new Hashids("-02rj%^gjq", 7);
var urlParser = require('url');
var db;
var cookieName = "userid";

var onlyUniqueIp = true;
var initialPoints = 172;

module.exports = {
    setDb: function (_db) {
        db = _db;
    },
    go: function (req, res) {

        // check if we're using CloudFlare
        // TODO: check if client is a legitimate CF server
        if (req.headers['cf-connecting-ip'] && req.headers['cf-connecting-ip'].length != 0)
            req.ip = req.headers['cf-connecting-ip'];

        if (req.headers['referer']) {
            // can't use "*" because we need cookies to work
            var url = urlParser.parse(req.headers['referer']);
            res.header('Access-Control-Allow-Origin', url.protocol + '//' + url.hostname);
        }

        var userCookie = req.cookies[cookieName];
        var isNew = false;
        if (typeof userCookie == 'undefined')
            isNew = true;
        else {
            var decoded = hashids.decode(userCookie);
            if (req.query.setId)
                decoded = [parseInt(req.query.setId)];
            // hash in the cookie wasn't valid
            if (decoded.length == 0)
                isNew = true;
        }
        if (!isNew) {
            // update user cookie if exists, create new if not
            userExists(decoded[0], function (exists, points) {
                if (!exists)
                    createUser(res, req);
                else {
                    setCookie(decoded[0], res);
                    res.send({user: hashids.encode(decoded[0]), points: points});
                }
            });
        }
        else {
            createUser(res, req);
        }
    }
};

function createUser (res, req) {
    db.incr('lastUser', function(err, reply){
        var resData;
        if (err)
            resData = {user: 0, points: 0};
        else {
            resData = {user: hashids.encode(reply), points: initialPoints};
            db.set('user:' + reply, 1, function (err, rep) {
                if (err)
                    console.log('Failed to create user' + reply);
                else {
                    //console.log("Created user:" + reply);
                    if (req.query.ref)
                        tryAddPoints(req.query.ref, reply, req.ip);
                    else {
                        // make sure the same IP can earn points only once
                        db.incr("ips:" + req.ip, function (err, rep) {
                            //console.log(req.ip + " = " + rep);
                        });
                    }
                }
            });
        }
        setCookie(reply, res);
        res.send(resData);
    });
}


function setCookie (id, res) {
    res.cookie(cookieName, hashids.encode(id), {
        expires: new Date(Date.now() + 10000 * 60 * 24 * 365),
        httpOnly: false
    });
}

// call param callback with boolean "exists"
function userExists (id, callback) {
    db.get('user:' + id, function (err, reply) {
        if (err) {
            console.log("Failed to check if exists: " + id);
        } else {
            callback(reply != null, reply);
        }
    });
}

//
function tryAddPoints (refHash, userID, ip) {
    var refID = hashids.decode(refHash);
    // exit if invalid hash
    if (refID.length != 1)
        return;
    else
        refID = refID[0];
    // check if ip is unique if set so
    if (onlyUniqueIp) {
        console.log("ips:" + ip);
        db.incr("ips:" + ip, function(err, rep){
            // if after incrementing this ip's count it's 1, it means it's new
            if (rep == 1)
                addPoints(refID);
            db.set("ref:" + userID, refID)
        });
    } else {
        addPoints(refID);
    }
}

function addPoints (refID) {
    db.incr("user:" + refID, function (err, rep){
        //console.log(refID + " added points = " + rep);
    });
}
