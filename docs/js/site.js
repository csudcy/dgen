$(document).ready(function() {
  let IMAGES = [];

  function add_image() {
    // TODO
  }

  function image_drag_start() {
    $('#drag_overlay').show();
  }

  function image_drag_end() {
    $('#drag_overlay').hide();
  }

  function bind_drag_handlers() {
    // Add drag/drop handling
    $('html').on('dragover', function(event) {
      event.preventDefault();
      event.stopPropagation();
      image_drag_start();
    });

    $('#drag_overlay').on('dragleave', function(event) {
      event.preventDefault();
      event.stopPropagation();
      image_drag_end();
    });

    $('#drag_overlay').on('drop', function(event) {
      event.preventDefault();
      event.stopPropagation();
      image_drag_end();
      $.each(event.originalEvent.dataTransfer.files, function(index, file) {
        console.log(file);
      });
    });
  }

  // Init
  bind_drag_handlers();
});
