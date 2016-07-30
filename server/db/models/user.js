'use strict';
var crypto = require('crypto');
var mongoose = require('mongoose');
var _ = require('lodash');
var Sd = require('sundial-js')
var userSchema = new mongoose.Schema({
    email: {
        type: String
    },
    tomsToday: {type: Number, default: 0}, // just the amount complete
    tomatoMeter: {type: Array, default: []}, // for the tomato meter UI. Also has info about the nature of the tomato (complete/failed/etc)
    sunDial: { type: Number, default: Sd },
    archive: {type: Array, default: []},
    unlockedFeatures: {type: Array, default: []},
    lastLoggedIn: {type: Date, default: Date.now},
    name: String,
    // the `profile` also exists on the front-end. All changes on front end shoulde update this on the backend accordingly.
    guest: {type: Boolean, default: false},
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
    creationDate: {type: Date, default: Date.now}
});

// method to remove sensitive information from user objects before sending them out
userSchema.methods.sanitize = function () {
    return _.omit(this.toJSON(), ['password', 'salt']);
};

userSchema.methods.archiveTomatoMeter = function() {
    this.archive.push({
        date: Sd.convertSd(this.sunDial),
        tomatoMeter: this.tomatoMeter
    });
    this.tomatoMeter = [];
    this.tomsToday = 0;
    this.sunDial = Sd();
    return this.save();
};

userSchema.methods.mergeLocalProfile = function(localProfile){

  for(var k in localProfile) {
    if(localProfile.hasOwnProperty(k)) this[k] = localProfile[k];
  }
  return this.save();

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

// userSchema.pre('save', function (next) {
//
//   if (this.isModified('password')) {
//     this.salt = this.constructor.generateSalt();
//     this.password = this.constructor.encryptPassword(this.password, this.salt);
//   }
//
//   next();
//
// });


userSchema.statics.generateSalt = generateSalt;
userSchema.statics.encryptPassword = encryptPassword;

userSchema.method('correctPassword', function (candidatePassword) {
    return encryptPassword(candidatePassword, this.salt) === this.password;
});

mongoose.model('User', userSchema);
