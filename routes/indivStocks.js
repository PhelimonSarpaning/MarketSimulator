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

let getQuote = function(ticker) {
	return new Promise(function(resolve, reject) {
		const fullUrl = baseUrl + '/stock/' + ticker + '/quote';
		request.get(fullUrl, function(err, response, body) {
			if(err)
				reject()
			else
				resolve(JSON.parse(body));
		});
	});
}

let getCompany = function(ticker) {
	return new Promise(function(resolve, reject) {
		const fullUrl = baseUrl + '/stock/' + ticker + '/company';
		request.get(fullUrl, function(err, response, body) {
			if(err)
				reject()
			else
				resolve(JSON.parse(body));
		});
	});
}

let getStats = function(ticker) {
	return new Promise(function(resolve, reject) {
		const fullUrl = baseUrl + '/stock/' + ticker + '/stats';
		request.get(fullUrl, function(err, response, body) {
			if(err)
				reject()
			else
				resolve(JSON.parse(body));
		});
	});
}

let getChart = function(ticker, duration) {
	return new Promise(function(resolve, reject) {
		const fullUrl = baseUrl + '/stock/' + ticker + '/chart/' + duration;
		request.get(fullUrl, function(err, response, body) {
			if(err)
				reject()
			else
				resolve(JSON.parse(body));
		});
	});
}

router.get('/stock-card/:ticker', function(req, res) {
	const ticker = req.params.ticker;
	const duration = '3m';
	var quote, company, stats, chart;

	getQuote(ticker).then(function(fetched_quote) {
			quote = fetched_quote;
			return getCompany(ticker);
	}).then(function(fetched_company) {
		company = fetched_company;
		return getStats(ticker);
	}).then(function(fetched_stats) {
		stats = fetched_stats;
		return getChart(ticker, duration);
	}).then(function(fetched_chart) {
		chart = fetched_chart;

		var simpleChart = [];
		for(var i = 0; i < chart.length; i++) {
			simpleChart.push({
				date: chart[i].date,
				value: chart[i].close
			});
		}

		data = {
			quote: quote,
			company: company,
			stats: stats,
			chart: simpleChart
		};
		res.send(data);
	});
});


module.exports = router;
