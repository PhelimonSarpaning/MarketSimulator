$(document).ready( function() {
  console.log('#{portfolio.portfolio_id}');

  $.ajax({
    method: 'PUT',
    url: '/stocks/update-portfolio/' + '#{portfolio.portfolio_id}'
  }).done(function (response) {
    console.log(response);
  })
})
