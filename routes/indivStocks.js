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

async function getStats(ticker) {
	const fullUrl = baseUrl + '/stock/' + ticker + '/stats';
	request.get(fullUrl, function(err, response, body) {
		return JSON.parse(body);
	})
}

async function getAllData(ticker) {
	var quote = getQuote(ticker);
	var company = getCompanyData(ticker);
	var stats = await(getStats(ticker));
	console.log(quote);
	console.log(company);
	console.log(stats);
}

router.get('/stock-card/:ticker', function(req, res) {
	const ticker = req.params.ticker;
	var quote, company, stats;

	request.get(baseUrl + '/stock/' + ticker + '/quote', function(err, response, body) {
		quote = JSON.parse(body);

		request.get(baseUrl + '/stock/' + ticker + '/company', function(err, response, body2) {
			company = JSON.parse(body2);

			request.get(baseUrl + '/stock/' + ticker + '/stats', function(err, response, body3) {
				stats = JSON.parse(body3);

				data = {
					quote: quote,
					company: company,
					stats: stats
				};

				console.log(quote);
				console.log(company);
				console.log(stats);

				res.send(data);
			});
		});
	});
});


module.exports = router;
