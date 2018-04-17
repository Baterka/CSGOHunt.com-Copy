const express = require('express'),
    models = require('../models');
const router = express.Router();

/* GET home page. */
router.get('/', models.Passport.isAuthenticated, function(req, res) {
  res.render('edit-profile', {});
});

module.exports = router;
