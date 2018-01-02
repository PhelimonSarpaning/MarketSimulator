const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');

// Bring in the User model
let User = require('../models/user');

//Express validator middleware
const { check, validationResult } = require('express-validator/check');
const { matchedData, sanitize } = require('express-validator/filter');


router.get('/register', function(req, res) {
	res.render('register');
});

router.post('/register', 
	[
		check('name', 'Name must be at least 5 characters long.')
			.trim()
			.isLength({min: 5}),

		check('username', 'Username must be at least 5 characters long.')
			.trim()
			.isLength({min: 5}),

		check('email', 'Must be a valid email address')
			.isEmail()
			.trim()
			.normalizeEmail(),

		check('password', 'Password must be between 5 and 18 characters long.')
			.isLength({min: 5, max:18}),

		//use a cutom validator to check that the password values match
		check('confirmPassword', 'Passwords must match').custom(function(value, {req}) {
			return value === req.body.password
		})
	], 

	function(req, res) {
		//Fetch any errors that occured during validation and re-render the page with
		//the error. For convenience, pre-fill name, email, and username (but not password)
		const errors = validationResult(req);
		var request = {
				name: req.body.name,
				email: req.body.email,
				username: req.body.username
			};

		if (!errors.isEmpty()) {
			request.errors = errors.mapped(); //errors.mapped() returns a JSON object
			return res.render('register', request);
		}

		//Check to make sure that the username is unique
		User.findOne({ username: req.body.username }, function(err, user) {
			console.log('User: ');
			console.log(user);
			if(user) {
				req.flash('warning', 'Sorry, this username is already in use.')
				return res.render('register', request);
			}
			//Create a newUser object to create an instance of the User model later
			var newUser = {
				name: req.body.name,
				email: req.body.email,
				username: req.body.username,
			}

			//Generate a salt with 10 rounds and hash the password before storing in db
			bcrypt.hash(req.body.password, 10, function(err, hash) {
				if(err){
					req.flash('danger', 'Sorry, there was an error in creating your account. Please try again.');
					return res.render('register', newUser);
				}

				//Instatiate the User model and save it
				newUser.password = hash;
				var user = new User(newUser);

				user.save(function (err) {
					if(err) {
						req.flash('danger', 'Sorry, there was an error in creating your account. Please try again later.');
						//Don't pass the hashed password back through the response!
						delete newUser.password;
						return res.render('register', newUser);
					}

					//User was successfully saved to the db
					req.flash('success', 'You have been registered! You may log in now.');
					res.redirect('/users/login');
				});
			});
		
		});
	}
);

router.get('/login', function(req, res) {
	res.render('login');
});

router.post('/login', 
	[
		check('username', 'Must provide username.').exists().isLength({min: 1}),
		check('password', 'Must provide password.').exists().isLength({min: 1})
	],

	function(req, res, next) {
		passport.authenticate('local', { 
			successRedirect: '/',
	        failureRedirect: '/stocks/',
	        failureFlash: true,
	        successFlash: true })(req, res, next);
});

//Logging out
router.get('/logout', function(req, res) {
	req.logout(); //just use the logout function of passport, which can be accessed from request
	req.flash('success', 'Logged out succesfully');
	res.redirect('/');
});

module.exports = router;