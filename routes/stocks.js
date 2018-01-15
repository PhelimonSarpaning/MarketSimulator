const express = require('express');
const router = express.Router();
const passport = require('passport');
const ensureAuthenticated = require('./authenticated');
//request module for making get requests to IEX
const request = require('request');
const mongoose = require('mongoose'); 

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

// GET Route for creating a new portfolio
router.get('/new-portfolio', ensureAuthenticated, function(res, res) {
	res.render('new-portfolio');
});

// POST route for creating a new portfolio
router.post('/new-portfolio', ensureAuthenticated, [
		// Check that all values were inputted
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

		//create a unique portfolio id for access later
		var request = {
			name: req.body.name,
			description: req.body.description,
			capital: req.body.capital,
			portfolio_id: mongoose.Types.ObjectId().toString() 
		}

		// reload with the errors if there are any, pre-inputting values for convenience
		if(!errors.isEmpty()) {
			request.errors = errors.mapped();
			return res.render('new-portfolio', request);
		}

		// Otherwise, update the user with the new portfolio
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

// GET route to view a single portfolio
router.get('/view-portfolio/:id', function(req, res) {
	console.log(req.params.id);
	User.findOne({username: req.user.username},
		{portfolios: {$elemMatch: {portfolio_id: req.params.id}}, _id: 0},
		function(err, docs) {
			if(err || !docs || !docs.portfolios) {
				req.flash('warning', 'Sorry, we are unable to load this portfolio at the moment. Please try again later.');
				res.render('stocks');
			}

			const portfolio = docs.portfolios[0];
			console.log(portfolio);
			return res.render('single-portfolio', {
				portfolio: portfolio
			});
		});
});


module.exports = router;