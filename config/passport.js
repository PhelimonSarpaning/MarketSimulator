// Import the Passport local strategy, bcrypt, adn db credentials for authentication
const LocalStrategy = require('passport-local');
const bcrypt = require('bcryptjs');
const config = require('./database');

// Bring in the User model
const User = require('../models/user');

module.exports = function(passport) {
	passport.use(new LocalStrategy( function(username, password, done) {
		User.findOne({username: username}, function(err, user) {
			if(err) {
				return done(err);
			} else if(!user) {
				return done(null, false, {message: 'Invalid username!'});
			} else {
				bcrypt.compare(password, user.password, function(err, result) {
					if(err || !result || result === false) {
						return done(null, false, {message: 'Invalid password!'});
					} else {
						return done(null, user);
					}
				});
			}
		})
	}));

	passport.serializeUser(function(user, done) {
	  done(null, user.id);
	});

	passport.deserializeUser(function(id, done) {
	  User.findById(id, function(err, user) {
	    done(err, user);
	  });
	});
};