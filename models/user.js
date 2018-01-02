const mongoose = require('mongoose')

let userSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true
	},
	username: {
		type: String,
		required: true
	},
	password: {
		type: String,
		required: true
	},
	email: {
		type: String,
		required: true
	}
});

//make sure that users get saved to the 'users' collection
let UserModel = module.exports = mongoose.model('User', userSchema, 'users');