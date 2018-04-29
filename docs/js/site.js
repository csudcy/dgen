$(document).ready(function() {
  'use strict';
  let DB = null;

  // Current image being edited
  let EDIT_IMAGE = null;


  /////////////////////////////
  // Database functions
  /////////////////////////////

  function _add_promise_handlers_for_request(request, resolve, reject) {
    request.onsuccess = function() {
      resolve(request.result);
    };

    request.onerror = function() {
      console.log('Error!');
      console.log(request);
      console.log(this);
      console.log(err);
      reject(request);
    };
  }

  function _db_request(table, lock, get_request) {
    return new Promise(function(resolve, reject) {
      DB.then(function(db) {
        let tx = db.transaction(table, lock);
        let store = tx.objectStore(table);
        let request = get_request(store);
        _add_promise_handlers_for_request(request, resolve, reject);
      });
    });
  }

  function init_database() {
    DB = new Promise(function(resolve, reject) {
      let open = indexedDB.open('dgen', 1);

      // Create the schema
      open.onupgradeneeded = function() {
        let upgradeDb = open.result;
        if (!upgradeDb.objectStoreNames.contains('images')) {
          upgradeDb.createObjectStore('images', {keyPath: 'id', autoIncrement: true});
        }
      };

      _add_promise_handlers_for_request(open, resolve, reject);
    });
  }

  function db_select(table) {
    return _db_request(table, 'readonly', function(store) {
      return store.getAll();
    });
  }

  function db_get(table, key) {
    return _db_request(table, 'readonly', function(store) {
      return store.get(key);
    });
  }

  function db_put(table, value) {
    return _db_request(table, 'readwrite', function(store) {
      return store.put(value);
    });
  }

  function db_remove(table, key) {
    return _db_request(table, 'readwrite', function(store) {
      return store.delete(key);
    });
  }


  /////////////////////////////
  // Image Management
  /////////////////////////////

  function add_image(file) {
    return new Promise(function(resolve, reject) {
      let reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = function(){
        db_put('images', {
          zoom: 1.0,
          x: 0,
          y: 0,
          background_color: '#ffffff',
          data: this.result,
        }).then(resolve);
      };
    });
  }

  function show_images() {
    db_select('images').then(function(images) {
      $('#images')
        .empty()
        .append($.map(images, function(image) {
          let image_html = render_image(image);
          return `
            <span class="image_container" data-id="${image.id}">
              ${image_html}
              <span class="button remove">X</span>
              <span class="button edit">E</span>
            </span>
          `;
        }));

      $('#images .remove').on('click', function() {
        let image_id = $(this).parent().data('id');
        db_remove('images', image_id).then(show_images);
      })

      $('#images .edit').on('click', function() {
        let image_id = $(this).parent().data('id');
        db_get('images', image_id).then(function(image) {
          edit_image(image);
        });
      })
    });
  }

  function render_image(image) {
    return `
      <span class="image" style="
        background-color: ${image.background_color};
      ">
        <span class="zoom" style="
          background-image: url(${image.data});

          transform: scale(${image.zoom});
        "></span>
      </span>
    `;
  }

  function render_placeholder(index) {
    return `
      <span class="image">
        <span class="zoom">${index}</span>
      </span>
    `;
  }


  /////////////////////////////
  // Image Editing
  /////////////////////////////

  function edit_image(image) {
    EDIT_IMAGE = image;
    show_edit_image();
    $('#edit_overlay .zoom').val(image.zoom);
    $('#edit_overlay .background_color').val(image.background_color);
    $('#edit_overlay').show();
  }

  function show_edit_image() {
    $('#edit_overlay .edit_image')
      .empty()
      .append(render_image(EDIT_IMAGE));
  }


  /////////////////////////////
  // Card Generation
  /////////////////////////////

  function generate() {
    db_select('images').then(function(images) {
      let order = parseInt($('#card_order').val());
      let settings = SETTINGS[order];

      // Shuffle the images so the cards are more randomised
      shuffle_array(images);

      // Generate all the images/placeholders
      let rendered_images = $.map(images, render_image);
      while (rendered_images.length < settings.items_required) {
        rendered_images.push(render_placeholder(rendered_images.length))
      }

      // Generate all the cards
      $('#cards')
        .empty()
        .append(
          $.map(settings.combinations, function(combination) {
            return generate_card(settings, rendered_images, combination);
          }));
    });
  }

  // https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
  function shuffle_array(array) {
    for (var i = array.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
  }

  function generate_card(settings, rendered_images, combination) {
    let card_container = $('<span class="card_container"></span>');

    $.each(combination, function(index, image_index) {
      let layout = settings.layout[index];
      let rotation = Math.floor(Math.random() * 360.0);
      card_container.append(
        $(rendered_images[image_index])
          .css({
            'top': `${layout[1]}%`,
            'left': `${layout[0]}%`,
            'width': `${settings.image_radius*2}%`,
            'height': `${settings.image_radius*2}%`,
            'position': 'absolute',
            'transform': `rotate(${rotation}deg)`,
          }));
    });

    return card_container;
  }

  /////////////////////////////
  // Init functions
  /////////////////////////////

  function init_image_ui() {
    // Add drag/drop handling
    $('html').on('dragover', function(event) {
      event.preventDefault();
      event.stopPropagation();
      $('#drag_overlay').show();
    });

    $('#drag_overlay').on('dragleave', function(event) {
      event.preventDefault();
      event.stopPropagation();
      $('#drag_overlay').hide();
    });

    $('#drag_overlay').on('drop', function(event) {
      event.preventDefault();
      event.stopPropagation();
      $('#drag_overlay').hide();

      Promise.all(
        $.map(event.originalEvent.dataTransfer.files, add_image)
      ).then(show_images);
    });
  }

  function init_generate_ui() {
    let counts = Object.keys(SETTINGS);
    counts.sort();
    $('#card_order').append(
      $.map(counts, function(count) {
        return `<option>${count}</option>`;
      }));

    $('#generate').on('click', function() {
      generate();
    });
  }

  function init_edit_ui() {
    $('#edit_overlay .apply').on('click', function() {
      db_put('images', EDIT_IMAGE).then(function() {
        edit_image = null;
        $('#edit_overlay').hide();
        show_images();
      });
    });

    $('#edit_overlay .cancel').on('click', function() {
      edit_image = null;
      $('#edit_overlay').hide();
    });

    $('#edit_overlay .zoom').on('change, input', function() {
      EDIT_IMAGE.zoom = $(this).val();
      show_edit_image();
    });

    $('#edit_overlay .background_color').on('change', function() {
      EDIT_IMAGE.background_color = $(this).val();
      console.log(EDIT_IMAGE.background_color);
      show_edit_image();
    });
  }


  /////////////////////////////
  // Init everything
  /////////////////////////////

  init_database();
  show_images();
  init_image_ui();
  init_generate_ui();
  init_edit_ui();
});
