const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const expressValidator = require('express-validator');
const passport = require('passport');

const dbconfig = require('./config/database');
const mongoose = require('mongoose');
mongoose.connect(dbconfig.database);
let db = mongoose.connection;

db.once('open', function() {
	console.log('Connected to MongoDB');
	// console.log(db);
});

db.on('error', function(err) {
	console.log(err);
});

const app = express();

//Body-parser middleware
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

// CONFIGURING THE EXPRESS APPLICATION
//Set the static folder to public
app.use(express.static(path.join(__dirname, 'public')));

//Express session middleware
app.set('trust proxy', 1) // trust first proxy
app.use(session({
	secret: 'appsecret123',
	resave: true,
	saveUninitialized: true //saves a cookie if it is new, regardless of whether it has been modified
	//cookie: { secure: true } -- causes messages to not show up for some reason
}));

app.use(require('connect-flash')());
//This function will effectively set a
//global variable to access the express-messages package
app.use(function (req, res, next) {
  res.locals.messages = require('express-messages')(req, res);
  next();
});

//Load the views and set view engine to pug
app.set('views', path.join(__dirname, 'templates'));
app.set('view engine', 'pug');

//Set up authentication with passport
require('./config/passport')(passport);
//Set up passport middleware
app.use(passport.initialize());
app.use(passport.session());

//We want to create a global variable which lets us know whether a user is logged in
app.get('*', function(req, res, next) {
	//Only set res.locals if there is a user
	res.locals.user = req.user || null;
	//Setting a res.locals variable makes it available in templates when
	//we call res.render();

	//Call the next function in callbacks
	next();
});


//HOME VIEW
app.get('/', function(req, res){
	res.render('home');
});

// Bring the routers for all available paths
let users = require('./routes/users');
app.use('/users', users);
let stocks = require('./routes/stocks');
app.use('/stocks', stocks);
let indivStocks = require('./routes/indivStocks');
app.use('/indiv-stock', indivStocks);

//START SERVER
app.listen(3000, function() {
	console.log("Server started on port 3000");
});