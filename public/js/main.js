$(document).ready(function() {
	var portName = $('#delete-game-button').attr('port-name');
	console.log(portName);

	$('#delete-game-button').on('click', function(e) {
		e.preventDefault();

		const target = $(e.target);
		const id = $(target).attr('port-id');
		const name = $(target).attr('port-name');

		const inputtedName = $('#delete-game-input-name').val();

		
		console.log(id);
		console.log(name);
		console.log(inputtedName);

		if(inputtedName === name) {
			$.ajax({
				type: 'delete',
				url: '/stocks/delete-portfolio/'+id,
				data: {
					name: name
				},
				success: function(response) {
					console.log('success');
					window.location.href = '/stocks/';
				},
				error: function(err) {
					console.log(err);
					window.location.href = '/stocks/';
				}
			});
		}
	});

	$('.delete-game-form').validate({
		rules: {
			name: {
				required: true,
				equalTo: '#portName'
			}
		},
		messages: {
			name: {
				required: "Please input the porfolio's name.",
				equalTo: "The inputted name must match the portfolio name."
			}
		},
		errorElement: "em",
		errorPlacement: function ( error, element ) {
			// Add the `help-block` class to the error element
			error.addClass( "alert alert-danger mt-3" );
			$('.input-parent').append(error);
		},
		highlight: function ( element, errorClass, validClass ) {
			$( element ).parents( ".col-sm-5" ).addClass( "has-error" ).removeClass( "has-success" );
		},
		unhighlight: function (element, errorClass, validClass) {
			$( element ).parents( ".col-sm-5" ).addClass( "has-success" ).removeClass( "has-error" );
		}
	})
})