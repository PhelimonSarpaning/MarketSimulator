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

// Base url for making get requests to IEX API
const baseUrl = 'https://api.iextrading.com/1.0';

router.get('/', ensureAuthenticated, function(req, res) {
	res.render('stocks');
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
			availableCapital: req.body.capital,
			portfolio_id: mongoose.Types.ObjectId().toString(),
			sections: [] 
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
router.get('/view-portfolio/:id', ensureAuthenticated, function(req, res) {
	User.findOne({username: req.user.username},
		{portfolios: {$elemMatch: {portfolio_id: req.params.id}}, _id: 0},
		function(err, docs) {
			if(err || !docs || !docs.portfolios) {
				req.flash('warning', 'Sorry, we are unable to load this portfolio at the moment. Please try again later.');
				res.render('stocks');
			}

			const portfolio = docs.portfolios[0];

			// Get available stocks (will work on speeding this up later)
			const fullUrl = baseUrl + '/ref-data/symbols';

			request.get(fullUrl, function(err, response, body) {
				var json = JSON.parse(body);
				return res.render('single-portfolio', {
					portfolio: portfolio,
					availableStocks: json
				});
			});
		});
});

// Route for creating a new section within a portfolio, initiated from a modal form
router.post('/new-section/:id', ensureAuthenticated, function(req, res) {
	const portfolio_id = req.params.id;
	const sectionName = req.body.sectionName;
	var newSection = {
		name: sectionName,
		section_id: mongoose.Types.ObjectId().toString(),
		holdings: []
	};

	User.findOneAndUpdate({username: req.user.username, "portfolios.portfolio_id": portfolio_id}, {$push : {"portfolios.$.sections": newSection}}, 
		function(err, doc) {
			if(err) {
				req.flash('error', 'We were unable to create this section, please try again later.');
			}
			//Reload the page for changes to take place
			res.redirect('/stocks/view-portfolio/'+portfolio_id);
		}
	);
});

router.post('/purchase-stock/:portfolio_id/:ticker', ensureAuthenticated, function(req, res) {
	const ticker = req.params.ticker;
	const section_id = req.body.addSection;
	const shares = req.body.numShares;
	const id = req.params.portfolio_id;

	const fullUrl = baseUrl + '/stock/' + ticker + '/quote';
	request.get(fullUrl, function(err, response, body) {
		const quote = JSON.parse(body);
		const price = quote.latestPrice;

		User.findOne({username: req.user.username}, function(err, userDoc) {
			if(err || !userDoc) {
				req.flash('error', 'Yikes, we were unable to load your profile!');
				res.redirect('/stocks/view-portfolio/' + req.params.portfolio_id);
			} else if(userDoc.availableCapital < price) {
				req.flash('error', 'You do not have sufficient capital to purchase this stock.');
				res.redirect('/stocks/view-portfolio/' + req.params.portfolio_id);
			} else {
				const newPurchase = {
					ticker: ticker,
					shares: shares,
					purchasePrice: price,
					purchaseDate: new Date(),
					absoluteGain: 0.00,
					percentGain: 0.00
				}

				var portfolios = userDoc.portfolios;
				for(var i = 0; i < portfolios.length; i++) {
					if(portfolios[i].portfolio_id == id) {
						var portfolio = portfolios[i];
						var section = portfolio.sections[section_id];
						section.holdings.push(newPurchase);
						portfolios[i].availableCapital -= price * shares;

						userDoc.portfolios[i].sections[section_id] = section;
						console.log(userDoc.portfolios[i].sections[section_id] + "\n\n\n");
						// Mark the user as being modified before saving, otherwise saving will silently fail
						userDoc.markModified('portfolios.' + i);
						userDoc.save(function(err, doc) {
							if(err) {
								req.flash('error', 'Something went wrong in buying your stocks.');
							}

							res.redirect('/stocks/view-portfolio/' + req.params.portfolio_id);
						});

						return;
					}
				}

				req.flash('error', 'Something went wrong in buying your stocks.');
				res.redirect('/stocks/view-portfolio/' + req.params.portfolio_id);
			}
		})
	})
});

module.exports = router;