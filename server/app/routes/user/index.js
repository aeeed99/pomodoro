'use strict';

var router = require('express').Router();
var mongoose = require('mongoose');
var User = mongoose.model('User');
module.exports = router;
var _ = require('lodash');

router.put('/profile', function (req, res, next) {
  console.log("user is", req.body.user);
  return User.findOne({_id: req.body.user._id})
    .then(user => {
      user.profile = req.body.newProfile;
      console.log("found user", user);
      user.markModified('profile');
      console.log("about to save")
      return user.save();
    })
    .then(function good(user) {
        console.log("new user", user);
        return res.status(201).send(user)
      },
      function bad(err) {
        console.log(err)
        return res.status(500).send(err)
      }
    );
});
