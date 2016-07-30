var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var passport = require('passport');
var path = require('path');
var mongoose = require('mongoose');
var UserModel = mongoose.model('User');
var Sd = require('sundial-js');

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
    var statusCode = 202;
    var todaySunDail = Sd();
    console.log("user?? ", req.user)

    if (req.user) {
      if (todaySunDail === req.user.sunDial) {
        // same day, just send the users
        res.status(200).send({user: req.user.sanitize()});
      } else {
        // it's a new day. Archive the slast tomato meter and send a 202
        req.user.archiveTomatoMeter()
          .then(updatedUser => res.status(202).send(updatedUser))
      }
    } else {
      return res.status(299).send();
      // TODO: this here might be for v1
      return UserModel.findOne({_id: req.cookies.id})
        .then(user => {
          if (!user) {
            return UserModel.create({guest: true})
              .then(user => {
                return user
              })
          }
          else return user;
        })
        .then(user => {
          if (todaySunDail !== user.sunDial) {
            console.log("new day, archiving the tomato!!")
            statusCode = 202;
            return user.archiveTomatoMeter();
          }
          else return user;
        })
        .then(user => {
          console.log("THE USER", user);
          if (!req.cookies.id) res.cookie('id', user._id.toString());


          var today = new Date();
          var last = user.lastLoggedIn;

          console.log("GOING HERE")
          res.status(100).send({user: user.sanitize()});
          console.log("returned user ", user, " with status code ", statusCode);
          user.profile = Object.assign({}, user.profile, {lastLoggedIn: new Date()});
          return user.save();
        })
        .then(user => {
          console.log("login time updated", user)
        })
        .catch(e => console.error("there was an error at authentication/index:65 ", e));
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
