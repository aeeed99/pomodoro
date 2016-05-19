'use strict';
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var passport = require('passport');
var path = require('path');
var mongoose = require('mongoose');
var UserModel = mongoose.model('User');

var ENABLED_AUTH_STRATEGIES = [
    'local',
    //'twitter',
    //'facebook',
    'google'
];

module.exports = function (app) {

    // First, our session middleware will set/read sessions from the request.
    // Our sessions will get stored in Mongo using the same connection from
    // mongoose. Check out the sessions collection in your MongoCLI.
    app.use(session({
        secret: app.getValue('env').SESSION_SECRET,
        store: new MongoStore({mongooseConnection: mongoose.connection}),
        resave: false,
        saveUninitialized: false
    }));

    // Initialize passport and also allow it to read
    // the request session information.
    app.use(passport.initialize());
    app.use(passport.session());

    // When we give a cookie to the browser, it is just the userId (encrypted with our secret).
    passport.serializeUser(function (user, done) {
        done(null, user.id);
    });

    // When we receive a cookie from the browser, we use that id to set our req.user
    // to a user found in the database.
    passport.deserializeUser(function (id, done) {
        UserModel.findById(id, done);
    });

    // We provide a simple GET /session in order to get session information directly.
    // This is used by the browser application (Angular) to determine if a user is
    // logged in already.
    app.get('/session', function (req, res) {
        if (req.user) {
            res.send({ user: req.user.sanitize() });
        } else {
          return UserModel.findOne({_id: req.cookies.id})
            .then(user => {
              if(!user) return UserModel.create({
                  guest: true,
                  profile:  {
                    tomsEaten: {},
                    unlockedFeatures: [],
                    lastLoggedIn: new Date(),
                  },
              });

              return user;
            })
            .then(user => {
              if(!req.cookies.id) res.cookie('id', user._id.toString());

              let today = new Date();
              let last = user.profile.lastLoggedIn;
              let statusCode;
              if(today.getDate === last.getDate() && today.getMonth() === last.getMonth() && today.getYear() === last.getYear())
                statusCode = 202;
              else statusCode = 200;

              res.status(statusCode).send({user: user.sanitize()});
              console.log("returned user ", user, " with status code ", statusCode);
              user.profile = Object.assign({}, user.profile, {lastLoggedIn: new Date() });
              return user.save();
            })
            .then(user => {
              console.log("login time updated", user)
            })
            .catch(e => console.error("there was an error at authentication/index:65 ", e));

          // console.log("fond a uoeuheontuhoetnuhon", req.cookies);
          // if(!req.cookies.id)
          //   res.status(401).send('No authenticated user.');
        }
    });

    // Simple /logout route.
    app.get('/logout', function (req, res) {
        req.logout();
        res.status(200).end();
    });

    // Each strategy enabled gets registered.
    ENABLED_AUTH_STRATEGIES.forEach(function (strategyName) {
        require(path.join(__dirname, strategyName))(app);
    });

};
