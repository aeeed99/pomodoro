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

    let tomato = req.body.tomato,
        error = null;

    //safety check: tomato is an object with a class and text prop
    if(!tomato || typeof tomato !== 'object' || !(tomato.hasOwnProperty('class') && tomato.hasOwnProperty('text') ))
        return res.status(400).send("Cannot update. Request must have a body with object `tomato` containing a `text` and a `key` property");

    return User.findOne({_id: req.body.user})
        .then(user => {
            user.tomatoMeter.push(tomato);
            if(tomato.class === 'complete'){
                user.tomsToday++;
                user.markModified('tomsToday');
            }
            user.markModified('tomatoMeter');
            return user.save();
        })
        .then(result => {
            console.log("[user controller] updated tomato meter\n", result);
            res.status(200).send(result);
        })
}

//POST api/user/tomatoMeter/archive

exports.archiveTomatoMeter = function (req, res) {
    if(req.user){
        return req.user.archiveTomatoMeter()
            .then(user => res.status(202).send(user))
    }
}

//////// ADMIN ROUTES ////////

exports.deleteTomatoMeter = function (req, res) {
    // set tomato meter to empty array,

    //safety check: is there a user?
    let userId = req.query.user;
    if(!userId) return res.status(400).send("Cannot delete. Request needs param with `user` = to user._id");

    return User.findOne({_id: userId })
        .then(user => {
            user.tomatoMeter = [];
            user.tomsToday = 0;
            user.markModified('tomatoMeter');
            user.markModified('tomsToday');
            return user.save();
        })
        .then(result => res.status(200).send(result))
        .then(null, error => res.status(500).send(error));
}
