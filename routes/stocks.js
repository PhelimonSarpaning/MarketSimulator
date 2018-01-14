const express = require('express');
const router = express.Router();
const passport = require('passport');
const ensureAuthenticated = require('./authenticated');
//request module for making get requests to IEX
const request = require('request'); 

//Express validator middleware
const { check, validationResult } = require('express-validator/check');

//Bring in the User model
let User = require('../models/user');

router.get('/', ensureAuthenticated, function(req, res) {
	res.render('stocks');

	const baseUrl = 'https://api.iextrading.com/1.0';
	const endpoint = '/stock';
	const ticker = '/aapl';
	const fetch = '/chart/1d';
	const fullUrl = baseUrl + endpoint + ticker + fetch

	// request.get(fullUrl, function(err, response, body) {
	// 	json = JSON.parse(body);
	// 	console.log(json);
	// });
});

router.get('/new-portfolio', ensureAuthenticated, function(res, res) {
	res.render('new-portfolio');
});

router.post('/new-portfolio', ensureAuthenticated, [

		check('name', 'Portfolio name must be at least 5 characters long.')
			.trim()
			.isLength({min: 5}),
		check('description', 'Description must be included.')
			.trim()
			.isLength({min: 1}),
		check('capital', 'Initial investment capital must be included.')
			.trim()
			.isLength({min: 1})

	], 

	function(req, res) {
		// First check for any validation errors
		const errors = validationResult(req);
		var request = {
			name: req.body.name,
			description: req.body.description,
			capital: req.body.capital
		}

		if(!errors.isEmpty()) {
			request.errors = errors.mapped(); //errors.mapped() returns a JSON object
			return res.render('new-portfolio', request);
		}

		User.findOneAndUpdate({username: req.user.username},
		{$push: {portfolios: request }}, function(err, doc) {
			if(err) {
				req.flash('error', 'Your request was unable to be processed. Perhaps you already have a portfolio with the same name.')
				return res.render('new-portfolio', request);
			}

			req.flash('success', 'Your new portfolio was successfully created!')
			res.redirect('/stocks/')
		})
})


module.exports = router;