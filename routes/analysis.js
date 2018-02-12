const express = require('express');
const router = express.Router();
const passport = require('passport');
const ensureAuthenticated = require('./authenticated');
//request module for making get requests to IEX
// const request = require('request');
const mongoose = require('mongoose');
const moment = require('moment');
// News API for getting company news (IEX news data isnt very useful
// since articles generally discuss multiple stocks)
const NewsAPI = require('newsapi');
const newsapi = new NewsAPI('d9ce160445b541d694a6bf31d748f502');
const sentiment = require('sentiment');

const from_date = moment().subtract(30, 'days').format('YYYY-MM-DD');
const source_list = `associated-press,
                  bbc-news,
                  bloomberg,
                  business-insider,
                  financial-post,
                  financial-times,
                  fortune,
                  new-york-magazine,
                  techcrunch,
                  the-economist,
                  the-new-york-times,
                  the-wall-street-journal,
                  the-washington-post,
                  time,
                  wired`;

//Express validator middleware
const { check, validationResult } = require('express-validator/check');

//Bring in the User model
let User = require('../models/user');

function precisionRound(number, precision) {
	var factor = Math.pow(10, precision);
	return Math.round(number * factor) / factor;
}

function sanitizeCompanyName(company) {
  // need to work on making this list more thorough
  var remove_list = ['.com']
  for(modifier of remove_list)
    company = company.replace(modifier, '');
  return company;
}

function getTopHeadlines(company) {
  return new Promise(function(resolve, reject) {
    console.log('Requesting headlines for ' + company)
    newsapi.v2.topHeadlines({
      q: company,
      language: 'en'
    }).then(function(headlines) {
      if(!headlines)
        reject()

      resolve(headlines.articles);
    });
  });
}

function getNewsAnalysis(company) {
  return new Promise(function(resolve, reject) {
    console.log('Requesting analysis for ' + company)
    newsapi.v2.everything({
      q: company,
      sources: source_list,
      from: from_date,
      language: 'en',
      sortBy: 'relevancy'
    }).then(function(response) {
      if(!response)
        reject()

      var num_positive = 0;
      var num_negative = 0;
      var total_analyzed = 0;
      var running_score = 0;

      for (article of response.articles) {
        var title_result = sentiment(article.title)
        var desc_result = sentiment(article.description)

        var composite_score = (title_result.score + desc_result.score) / 2;
        running_score = (running_score * total_analyzed + composite_score) / (total_analyzed + 1);
        total_analyzed++;

        var positive_length = title_result.positive.length + desc_result.positive.length;
        var negative_length = title_result.negative.length + desc_result.negative.length;
        var positive = (positive_length > negative_length) ? true : false;

        if(positive)
          num_positive++;
        else
          num_negative++;
      }

      getTopHeadlines(company)
        .then(function(headlines) {
          var ret_obj = {
            score: running_score,
            num_positive: num_positive,
            num_negative: num_negative,
            articles: headlines
          }

          resolve([company, ret_obj]);
        })
    });
  });
}


router.get('/update-news/:id', ensureAuthenticated, function(req, res) {
  const portfolio_id = req.params.id;
  User.findOne({username: req.user.username,
    'portfolios.portfolio_id': portfolio_id}, function(err, doc) {
      if(err || !doc) {
        return res.send(JSON.stringify({error: true, msg: err}));
      }

      var portfolio;
      var num_calculations = 0;
      for (port of doc.portfolios) {
        if(port.portfolio_id === portfolio_id) {
          portfolio = port;
          for(section of portfolio.sections)
            num_calculations += section.holdings.length;
          break;
        }
      }

			var company_names = [];
      var ret_data = {};
			for(var section_count = 0; section_count < portfolio.sections.length; section_count++) {
				let section_holdings = portfolio.sections[section_count].holdings;
				for(var holding_count = 0; holding_count < section_holdings.length; holding_count++) {
          var company = sanitizeCompanyName(section_holdings[holding_count].company);
					company_names.push(company);
          console.log(company)

          getNewsAnalysis(company)
            .then(function(scores) {
              var scores_company = scores[0];
              var scores = scores[1];
              ret_data[scores_company] = scores;

              num_calculations--;
              if(num_calculations === 0) {
                return res.send(ret_data);
              }
            });
			}
    }
  });
});

module.exports = router;
