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

function getQuote(ticker) {
	const fullUrl = baseUrl + '/stock/' + ticker + '/quote';
	request.get(fullUrl, function(err, response, body) {
		return JSON.parse(body);
	})
}

function getCompanyData(ticker) {
	const fullUrl = baseUrl + '/stock/' + ticker + '/company';
	request.get(fullUrl, function(err, response, body) {
		return JSON.parse(body);
	})
}

function getStats(ticker) {
	const fullUrl = baseUrl + '/stock/' + ticker + '/stats';
	request.get(fullUrl, function(err, response, body) {
		return JSON.parse(body);
	})
}

function getAllData(ticker) {
	var quote = getQuote(ticker);
	var company = getCompanyData(ticker);
	var stats = getStats(ticker);
}

router.get('/stock-card/:ticker', function(req, res) {
	const ticker = req.params.ticker;
	var quote, company, stats, chart;

	request.get(baseUrl + '/stock/' + ticker + '/quote', function(err, response, quoteBody) {
		quote = JSON.parse(quoteBody);

		request.get(baseUrl + '/stock/' + ticker + '/company', function(err, response, companyBody) {
			company = JSON.parse(companyBody);

			request.get(baseUrl + '/stock/' + ticker + '/stats', function(err, response, statsBody) {
				stats = JSON.parse(statsBody);

				request.get(baseUrl + '/stock/' + ticker + '/chart/3m', function(err, response, chartBody) {
					chart = JSON.parse(chartBody);

					var sanitizedChart = [];
					for(var i = 0; i < chart.length; i++) {
						sanitizedChart.push({
							date: chart[i].date,
							value: chart[i].close
						});
					}

					data = {
						quote: quote,
						company: company,
						stats: stats,
						chart: sanitizedChart
					};
					res.send(data);
				});
			});
		});
	});
});


module.exports = router;
