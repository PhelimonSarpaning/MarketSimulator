const express = require('express');
const router = express.Router();
const passport = require('passport');
const ensureAuthenticated = require('./authenticated');
//request module for making get requests to IEX
const request = require('request');
const mongoose = require('mongoose');
const moment = require('moment');

//Express validator middleware
const { check, validationResult } = require('express-validator/check');

//Bring in the User model
let User = require('../models/user');

// Base url for making get requests to IEX API
const baseUrl = 'https://api.iextrading.com/1.0';

function precisionRound(number, precision) {
	var factor = Math.pow(10, precision);
	return Math.round(number * factor) / factor;
}

function updatePrices(section, index) {
	return new Promise(function(resolve, reject) {
		if(section.holdings.length === 0) {
			resolve([section, index, null, section.profits]);
		} else {

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
						// price = Math.random() * 100;
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
  console.log(req.body);
	const portfolio_id = req.params.id;
	var new_sections = [];
	var ticker_prices = {};

	User.findOne({username: req.user.username,
			'portfolios.portfolio_id': portfolio_id},
		function(err, doc) {
			var portfolios = doc.portfolios;

			for (var count = 0; count < portfolios.length; count++) {
				if(portfolios[count].portfolio_id === portfolio_id) {
					// console.log('running')
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
                  if(req.body.add_performance_pt) {
                    portfolio.performance_points.push({
                      time: moment().format('YYYY:MM:DD hh:mm:ss'),
                      value: precisionRound(portfolio.currentValue, 2)
                    })
                  }

                  doc.portfolios[count] = portfolio;
									doc.markModified('portfolios.' + count + '.currentValue');
                  doc.markModified('portfolios.' + count + '.performance_points');
									doc.markModified('portfolios.' + count + '.sections');

									doc.save(function(err) {
                    let ret = JSON.stringify([ticker_prices, new_sections,
                      portfolio.performance_points]);
                    return res.send(ret);
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
