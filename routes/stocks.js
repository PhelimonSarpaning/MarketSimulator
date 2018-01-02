const express = require('express');
const router = express.Router();
const passport = require('passport');
const ensureAuthenticated = require('./authenticated');

//Bring in the User model
let User = require('../models/user');

router.get('/', ensureAuthenticated, function(req, res) {
	res.render('stocks');
});


module.exports = router;