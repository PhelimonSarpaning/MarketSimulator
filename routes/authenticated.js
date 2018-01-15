//Use Passport's isAuthenticated() method to ensure that a user is logged in 
function ensureAuthenticated(req, res, next) {
	if(req.isAuthenticated()) {
		//If user is logged in, access does not need to be restricted
		next();
	} else {
		req.flash('warning', 'Please log in first!');
		//Allow the user to login first
		res.redirect('/users/login');
	}
}

module.exports = ensureAuthenticated;