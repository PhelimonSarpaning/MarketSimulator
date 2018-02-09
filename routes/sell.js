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

// Route for selling all shares of a stock
router.post('/sell-all/', ensureAuthenticated, function(req, res) {
	const portfolio_id = req.body.portId;
	const section_id = req.body.sectionId;
	const ticker = req.body.stockTicker;

	User.findOne({username: req.user.username}, function(err, user) {
		if(err) {
			console.log(err);
			req.flash('We were unable to sell your shares in ' + ticker + '. Please try again later.')
		}
		else {
			var portfolios = user.portfolios;
			var sellPrice = 0;
			var modifiedMarker = '';
			for(var i = 0; i < portfolios.length; i++) {
				if(portfolios[i].portfolio_id === portfolio_id) {
					var portfolio = portfolios[i];

					var section = portfolio.sections[section_id];
					for(var j = 0; j < section.holdings.length; j++) {
						if(section.holdings[j].ticker === ticker) {
							var stock = section.holdings[j];
							sellPrice = stock.lastPrice * stock.shares;
							section.usedCapital -= stock.purchasePrice * stock.shares;
							section.holdings.splice(j, 1);

							modifiedMarker = 'portfolios.' + i + '.sections.' + section_id;
							break;
						}
					}
					portfolio.availableCapital += sellPrice;
					portfolio.sections[section_id] = section;
					portfolios[i] = portfolio;

					if(modifiedMarker !== '')
						user.markModified(modifiedMarker);
					user.markModified('portfolios.' + i + '.availableCapital');
					user.save(function(err, user) {
						if(err) {
							console.log(err);
							req.flash('error', 'Something went wrong in selling your stocks of' + ticker + '.');
						}

						res.redirect('/stocks/view-portfolio/' + portfolio_id);
					})

					return;
				}
			}
		}

		req.flash('error', 'Something went wrong in buying your stocks.');
		res.redirect('/stocks/view-portfolio/' + portfolio_id);
	});
});

module.exports = router;
