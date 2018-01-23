$(document).ready(function() {
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


})