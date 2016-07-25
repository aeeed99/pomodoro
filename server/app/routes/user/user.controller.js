'use strict';

var User = require('mongoose').model('User');


/* SUB URL: api/user/
 */
exports.updateMe = function (req, res, next) {
  console.log("user is", req.body.user);
  return User.findOne({_id: req.body.user._id})
    .then(user => {
      Object.assign(user, req.body.newProps)
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
    )
      .then(null, next);
}

// SUB URL: PUT api/user/tomatoMeter

exports.pushTomatoMeter = function (req, res) {

    return User.findOne({_id: req.body.user})
        .then(user => {
            user.tomatoMeter.push(req.body.tomato);
            user.markModified('tomatoMeter');
            return user.save();
        })
        .then(result => {
            console.log("[user controller] updated tomato meter\n", result);
            res.status(200).send(result);
        })
}

exports.clearTomatoMeter = function (req, res) {
    // set tomato meter to empty array,
}
