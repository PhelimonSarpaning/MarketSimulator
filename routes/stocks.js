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

					user.markModified(modifiedMarker);
					user.markModified('portfolios.' + i + '.availableCapital');
					user.save(function(err, user) {
						if(err) {
							console.log(err);
							req.flash('error', 'Something went wrong in selling your stocks.');
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


function precisionRound(number, precision) {
	var factor = Math.pow(10, precision);
	return Math.round(number * factor) / factor;
}

function updatePrices(section, index) {
	return new Promise(function(resolve, reject) {
    // reset the profits when calculating them
		section.profits = 0;
		var holdings = section.holdings;
		var holdings_updated = 0;
		var ticker_to_price = {};

		for (var holdings_count = 0; holdings_count < holdings.length; holdings_count++) {
			let ticker = holdings[holdings_count].ticker;

			updateSingleHolding(ticker, holdings, holdings_count)
				.then(function(result) {
					var price = result[0];
					let index = result[1];
					let ticker_of_price = result[2];
					let buy_price = holdings[index].purchasePrice;

					var singleStock = holdings[index];
					price = Math.random() * 100;
					// singleStock.lastPrice = rand_num;
					singleStock.lastPrice = price;
					singleStock.percentGain = precisionRound((price - buy_price) / buy_price * 100, 2);
					singleStock.absoluteGain = precisionRound(price - buy_price, 2);

					let total_absolute_gain = singleStock.absoluteGain * singleStock.shares;
					section.profits += total_absolute_gain;

					holdings[index] = singleStock;
					holdings_updated++;

					ticker_to_price[ticker_of_price] = price;
					// ticker_to_price[ticker_of_price] = rand_num;

					if(holdings_updated === holdings.length) {
						section.holdings = holdings;
						resolve([section, index, ticker_to_price, total_absolute_gain]);
					}
				}, function(reason) {
					reject(reason);
				})
		}
	});
}

function updateSingleHolding(ticker, holdings, holdings_count) {
	return new Promise(function(resolve, reject) {
		const fullUrl = baseUrl + '/stock/' + ticker + '/quote';;
		request.get(fullUrl, function(err, response, body) {
			if(err)
				reject()
			var quote = JSON.parse(body);
			resolve([quote.latestPrice, holdings_count, ticker]);
		});
	});
}

// Route for updating the prices of all stocks in a portfolio
router.put('/update-portfolio/:id', ensureAuthenticated, function(req, res) {
	const portfolio_id = req.params.id;
	var new_sections = [];
	var ticker_prices = {};

	User.findOne({username: req.user.username,
			'portfolios.portfolio_id': portfolio_id},
		function(err, doc) {
			var portfolios = doc.portfolios;

			for (var count = 0; count < portfolios.length; count++) {
				if(portfolios[count].portfolio_id === portfolio_id) {
					var portfolio = doc.portfolios[count];
					var current_portfolio_value = portfolio.availableCapital;
					var sections = portfolio.sections;

					for (var i = 0; i < sections.length; i++) {
						updatePrices(sections[i], i)
							.then(function(result) {
								let updated_section = result[0];
								let index = result[1];
								let price_set = result[2];

								let total_absolute_gain = result[3];
								current_portfolio_value += total_absolute_gain;

								sections[index] = updated_section;
								new_sections.push(updated_section);

								Object.assign(ticker_prices, price_set);

								if(new_sections.length === sections.length) {
									portfolio.currentValue = current_portfolio_value;
									portfolio.sections = new_sections;
									doc.portfolios[count] = portfolio;

									doc.markModified('portfolios.' + count + '.currentValue');
									doc.markModified('portfolios.' + count + '.sections');

									doc.save(function(err) {
										return res.send(JSON.stringify(ticker_prices));
									});
								}
							}, function(reason) {
								req.flash('We were unable to update your stocks.');
								return res.send(reason);
							});
					}

          // Prevent the loop from continuing to run after a match is found
					return;
				}
			}
		}
	);
});

module.exports = router;
