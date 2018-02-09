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

// Route for purchasing new stocks
router.post('/purchase-stock/:portfolio_id/:ticker', ensureAuthenticated, function(req, res) {
	const ticker = req.params.ticker;
	const section_id = req.body.addSection;
	const shares = parseInt(req.body.numShares);
	const id = req.params.portfolio_id;

	const fullUrl = baseUrl + '/stock/' + ticker + '/quote';
	request.get(fullUrl, function(err, response, body) {
		const quote = JSON.parse(body);
		const price = quote.latestPrice;
		const total_shares_price = price * shares;

		User.findOne({username: req.user.username}, function(err, userDoc) {
			if(err || !userDoc) {
				req.flash('error', 'Yikes, we were unable to load your profile!');
				res.redirect('/stocks/view-portfolio/' + req.params.portfolio_id);
			} else if(userDoc.availableCapital < total_shares_price) {
				req.flash('error', 'You do not have sufficient capital to purchase these stocks.');
				res.redirect('/stocks/view-portfolio/' + req.params.portfolio_id);
			} else {
				const newPurchase = {
					ticker: ticker,
					shares: shares,
					purchasePrice: price,
					lastPrice: price,
					purchaseDate: new Date(),
					absoluteGain: 0.00,
					percentGain: 0.00
				}

        // Had to update portfolios this way (and not with the findOneAndUpdate
				// function) because nested arrays are difficult to manipulate otherwise.
        // Lesson learned!
				var portfolios = userDoc.portfolios;
				for(var i = 0; i < portfolios.length; i++) {
					if(portfolios[i].portfolio_id == id) {
						var portfolio = portfolios[i];
						var section = portfolio.sections[section_id];
						section.usedCapital += total_shares_price;
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

// Route for buying more shares of exisiting stocks
router.post('/buy-more/', ensureAuthenticated, function(req, res) {
	const portfolio_id = req.body.portId;
	const section_number = parseInt(req.body.selectSection);
	const ticker = req.body.selectTicker;
	const shares = parseInt(req.body.numShares);
	var setHeaders = false;

	User.findOne({username: req.user.username}, function(err, user) {
			if(err || !user || !user.portfolios) {
				console.log(err);
				req.flash('error','Sorry, we were unable to purchase your shares. Please try again later.');
			} else {
        // We only projected the portfolio necessary, so it should be the first one
				var portfolios = user.portfolios;

				for(var portfolioCount = 0; portfolioCount < portfolios.length; portfolioCount++) {
					if(portfolios[portfolioCount].portfolio_id === portfolio_id) {
						var portfolio = portfolios[portfolioCount];
						var holdings = portfolio.sections[section_number].holdings;

	        	// Find the stock holding an purchase more stocks
						for(var counter = 0; counter < holdings.length; counter++) {
							if(holdings[counter].ticker === ticker) {
								// Get the quote for the stock
								const fullUrl = baseUrl + '/stock/' + ticker + '/quote';
								request.get(fullUrl, function(err, response, body) {
									var quote = JSON.parse(body);

									// Caluculate the total price and whether or not the user can buy it
									const totalPrice = quote.latestPrice * shares;
									if(totalPrice > portfolio.availableCapital) {
										req.flash('You do not have enough capital to purchase these many shares. \
											Please try again with fewer shares.')
									} else {
										holdings[counter].shares += shares;
										portfolio.availableCapital -= totalPrice;

										var section = portfolio.sections[section_id];
										section.holdings = holdings;
										section.usedCapital += totalPrice;
										section.profits += totalPrice;
										portfolio.sections[section_id] = section;
										user.portfolios[portfolioCount] = portfolio;

										user.markModified('portfolios.' + portfolioCount
											+ '.availableCapital');
										user.markModified('portfolios.' + portfolioCount
											+ '.sections.' + section_number + '.holdings.'
											+ counter);

										user.save(function(err, doc) {
											if(err) {
												req.flash('error', 'There was an error in saving your transaction.')
											} else {
												req.flash('success', 'Your purchase was successful.');
											}

											if(!setHeaders) {
												return res.redirect('/stocks/view-portfolio/' + portfolio_id); //just to be safe
												setHeaders = true;
											}
										});
									}
								});

								// Return so that the loop does not continue and the headers of
								// res do not get reset after it is sent
								return;
							}
						}
					}
				}
			}
		}
	)
});


module.exports = router;
