'use strict';

var router = require('express').Router();
var mongoose = require('mongoose');
var User = mongoose.model('User');
module.exports = router;
var _ = require('lodash');
var controller = require('./user.controller');

router.put('/', controller.updateMe);

router.put('/user', function(req, res) {
  res.status(501).send("use PUT /api/user instead");
});

router.put('/tomatoMeter', controller.pushTomatoMeter);
