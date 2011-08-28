/**
 * deploy check-in
 */
require('nko')('UJuIrlX5JM5B0V/g');

/**
 * Params
 */
var parameters = {
    twitter: {
        consumerKey:       'DROXwWEJw3tXjU4YJpZLw'
      , consumerSecret:    'pwv1Nvlvi3PcQ9fwkojiUd933prElu60Iu8FNAonwcI'
      , accessToken:       '9881092-BZ6uQiCxPvq4qKhsNu4ptEl2jDXbH9O2HKfVnFDCkA'
      , accessTokenSecret: '6LNRCRMdg6LE2egHAZLFLcVUWxBDIvgaafG6LKCtec4'
    },
    mongodb: {
        user:     'user'
      , password: '111111'
      , server:   'staff.mongohq.com:10090'
      , database: 'twalks'
    }
};

/**
 * Module dependencies.
 */
var express   = require('express')
  , everyauth = require('everyauth')
  , users     = require('./lib/users')
  , schema    = require('./lib/schema')
  , poller    = require('./lib/poller')
  , mongoose  = require('mongoose')
  , sys       = require('sys')
  , Twitter   = require('twitter')
  , links     = require('./lib/links_parser').Parser
;

everyauth.twitter
    .consumerKey(parameters.twitter.consumerKey)
    .consumerSecret(parameters.twitter.consumerSecret)
    .findOrCreateUser(function(session, accessToken, accessTokenSecret, userData) {
        return users.createUserFromTwitterData(userData);
    })
    .redirectPath('/')
;

mongoose
    .connect('mongodb://'+parameters.mongodb.user+':'+parameters.mongodb.password+'@'+parameters.mongodb.server+'/'+parameters.mongodb.database)
;


var app  = module.exports = express.createServer()
  , twit = new Twitter({
        consumer_key: parameters.twitter.consumerKey,
        consumer_secret: parameters.twitter.consumerSecret,
        access_token_key: parameters.twitter.accessToken,
        access_token_secret: parameters.twitter.accessTokenSecret
    });

// queue polling jobs for the poller script
schema.Event.find({}, function (err, events) {
    events.forEach(function(event) {
        schema.Job.count({status: 'run', id: event.id}, function(err, count) {
            if (0 === count) {
                new schema.Job({
                    id:        event.id
                  , createdAt: new Date()
                  , status:    'new'
                }).save();
            }
        })
    });
});

// Configuration
app.configure(function(){
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({secret: "dbe811f8f1b8ea"}));
  app.use(everyauth.middleware());
  app.use(express.methodOverride());
  app.use(app.router);
  app.set('view engine', 'ejs');
  app.use(express.static(__dirname + '/public'));
  app.set('views', __dirname + '/views');
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

app.get('/', function(req, res){
    res.render('welcome', {
        flash: req.flash()
    });
});

app.get('/events.json', function(req, res){
    schema.Event.find({}, function (err, events) {
        res.contentType('json');
        if (err) {
            console.log(err);
        }
        res.end(JSON.stringify(events));
    });
});

app.get('/events/:id.json', function(req, res) {
    schema.Event.findOne({_id: req.params.id}, function(err, event) {
        res.contentType('json');
        if (err) {
            console.log(err);
        }
        res.end(JSON.stringify(event));
    })
});

app.get('/currentEvents.json', function(req, res){
    schema.Event.getCurrent(function (err, events) {
        res.contentType('json');
        if (err) {
            console.log(err);
        }
        res.end(JSON.stringify(events));
    });
});

app.get('/upcomingEvents.json', function(req, res){
    schema.Event.getUpcoming(function (err, events) {
        res.contentType('json');
        if (err) {
            console.log(err);
        }
        res.end(JSON.stringify(events));
    });
});

function andRequireUser(req, res, next) {
    req.loggedIn ? next() : next(new Error('Unauthorized'));
}

app.post('/event/new', andRequireUser, function(req, res){
    console.log(req.user);
    // TODO: Add model validation and handle validation/unique errors
    var event = new schema.Event({
        hash:        req.body.hash
      , name:        req.body.name
      // TODO: frontend needs to combine date fields into a single string
      , startsAt:    new Date(req.body.startsAt)
      , endsAt:      new Date(req.body.endsAt)
      , imageUrl:    req.body.imageUrl
      , description: req.body.description
      , author:      req.body.createdAt
    });
    event.save(function(err){
        console.log(err);
    });

    // TODO: Event has no id when returned, perhaps it needs to be a promise
    res.contentType('json');
    res.end(JSON.stringify(event));
});

app.put('/event/:id', andRequireUser, function(req, res){
    schema.Event.findOne({_id: req.params.id}, function(err, event) {
        if (err) {
            console.log(err);
        } else {
            // TODO: save edited fields
        }
    })
});

everyauth.helpExpress(app);
app.listen(process.env.PORT || 3000);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
