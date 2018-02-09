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
			capital: parseInt(req.body.capital),
			currentValue: parseInt(req.body.capital),
			availableCapital: parseInt(req.body.capital),
			portfolio_id: mongoose.Types.ObjectId().toString(),
			performance_points: [],
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

				//Preprocess the innerHTML for ticker selector to prevent UI freeze
				var currSymbol;
				var symbols = '';
				for(var i = 0; i < json.length; i++) {
					currSymbol = json[i].symbol;
					symbols += '<option value="' + currSymbol + '">' + currSymbol + '</option>';
				}

				return res.render('single-portfolio', {
					portfolio: portfolio,
					availableStocks: symbols
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
		usedCapital: 0,
		profits: 0,
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

// Route for editing the description of a portfolio, initiated from a modal form
router.post('/edit-description/:id', ensureAuthenticated, function(req, res) {
	const portfolio_id = req.params.id;
	const description = req.body.description;

	User.findOneAndUpdate({username: req.user.username, "portfolios.portfolio_id": portfolio_id}, {$set : {"portfolios.$.description": description}},
		function(err, doc) {
			if(err) {
				req.flash('error', 'We were unable to update the description, please try again later.');
			}
			//Reload the page for changes to take place
			req.flash('success', 'The description for this portfolio was successfully edited.')
			res.redirect('/stocks/view-portfolio/'+portfolio_id);
		}
	);
});

// Route for editing the name of a portfolio, initiated from a modal form
router.post('/edit-name/:id', ensureAuthenticated, function(req, res) {
	const portfolio_id = req.params.id;
	const name = req.body.name;

	User.findOne({username: req.user.username, "portfolios.portfolio_id": portfolio_id}, "portfolios.$",
		function(err, doc) {
			if(err) {
				req.flash('error', 'We were unable to update the name, please try again later.');
			}
			//Reload the page for changes to take place
			req.flash('success', 'The name for this portfolio was successfully edited.')
			res.redirect('/stocks/view-portfolio/'+portfolio_id);
		}
	);
});

// Deletes an entire portfolio
router.delete('/delete-portfolio/:id', ensureAuthenticated, function(req, res) {
	const portfolio_id = req.params.id;
	const portfolio_name = req.body.name;

	User.findOneAndUpdate({username: req.user.username}, {'$pull': { 'portfolios': {'portfolio_id' : portfolio_id }}},
		function(err, doc) {
			if(err) {
				console.log(err);
				req.flash('error', 'We were unable to delete the portfolio "' + portfolio_name + '". Please try again later.');
			} else {
				req.flash('success', 'The portfolio "' + portfolio_name + '" was removed successfully.');
			}

			return res.redirect('/stocks/');
		}
	);
});

// Resets a portfolio with the original available capital, erasing all progress
router.post('/restart-portfolio/:id', ensureAuthenticated, function(req, res) {
	const portfolio_id = req.params.id;
	const portfolio_name = req.body.name;
	const init_capital = req.body.initCapital;

	User.findOneAndUpdate({username: req.user.username, "portfolios.portfolio_id" : portfolio_id}, {'$set': { 'portfolios.$.availableCapital': init_capital, 'portfolios.$.sections': []}},
		function(err, doc) {
			if(err) {
				console.log(err);
				req.flash('error', 'We were unable to restart the portfolio "' + portfolio_name + '". Please try again later.');
			} else {
				req.flash('success', 'The portfolio "' + portfolio_name + '" was restarted successfully.');
			}

			return res.redirect('/stocks/view-portfolio/' + portfolio_id);
		}
	);
});

module.exports = router;
