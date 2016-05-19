'use strict';
var crypto = require('crypto');
var mongoose = require('mongoose');
var _ = require('lodash');

var schema = new mongoose.Schema({
  email: {
    type: String
  },
  name: String,
  // the `profile` also exists on the front-end. All changes on front end shoulde update this on the backend accordingly.
  profile: {
    tomsEaten: {
      today: {type: Number, default: 0 },
      tomatoMeter: [],
      archive: [],
    },
    unlockedFeatures: [],
    lastLoggedIn: Date,
  },
  guest: { type: Boolean, default: false},
  twitter: {
    id: String,
    username: String,
    token: String,
    tokenSecret: String,
  },
  facebook: {
    id: String
  },
  google: {
    id: String
  },
  creationDate: {type: Date, default: Date.now }
});

// method to remove sensitive information from user objects before sending them out
schema.methods.sanitize = function () {
  return _.omit(this.toJSON(), ['password', 'salt']);
};

// generateSalt, encryptPassword and the pre 'save' and 'correctPassword' operations
// are all used for local authentication security.
var generateSalt = function () {
  return crypto.randomBytes(16).toString('base64');
};

var encryptPassword = function (plainText, salt) {
  var hash = crypto.createHash('sha1');
  hash.update(plainText);
  hash.update(salt);
  return hash.digest('hex');
};

// schema.pre('save', function (next) {
//
//   if (this.isModified('password')) {
//     this.salt = this.constructor.generateSalt();
//     this.password = this.constructor.encryptPassword(this.password, this.salt);
//   }
//
//   next();
//
// });

schema.statics.generateSalt = generateSalt;
schema.statics.encryptPassword = encryptPassword;

schema.method('correctPassword', function (candidatePassword) {
  return encryptPassword(candidatePassword, this.salt) === this.password;
});

mongoose.model('User', schema);
