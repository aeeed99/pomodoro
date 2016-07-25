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
    );
}
