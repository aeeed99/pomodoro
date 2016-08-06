'use strict';
var router = require('express').Router();
var production = require('../../env').PRODUCTION;
module.exports = router;

router.get('/production', function (req, res) {
  console.log("PROD ? ", production);
  console.log("hit thisthosssss\n\n\n\n\n!!");
  if(production) res.status(200).send();
  else res.status(201).send();
})

router.use('/members', require('./members'));
router.use('/user', require('./user'));

// Make sure this is after all of
// the registered routes!
router.use(function (req, res) {
    res.status(404).end();
});
