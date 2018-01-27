$(document).ready(function() {

  $('.performance-checker').on('click', function(e) {
      e.preventDefault();

      var target = $(e.target);
      var ticker = $(target).attr('ticker');

      // Show the marketplace tab instead of portfolio overview
      $('.nav-tabs a[href="#marketplace"]').tab('show');

      // Preselect the ticker in the select dropdown
      $('#marketplace .nav-pills a[href="#basic-search"]').tab('show');

      var stockSelector = $('.select-stock');
      stockSelector.val(ticker);
      stockSelector.trigger('change');
  });

});
