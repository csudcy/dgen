/*
TODO:
  BUG: Images clipped to zoom box :/
  BUG: Print doesn't do background images
  BUG: Drag & drop when editing doesn't work
  Layout editor
  Printing
  Export/import
  Images sets?
  Card sets?
*/

$(document).ready(function() {
  'use strict';

  // Database variables
  const TABLE_IMAGES = 'images';
  const TABLE_CARD_SETTINGS = 'card_settings';
  let DB = null;

  // Settings
  let CARD_SETTINGS = null;

  // Image editing/dragging info
  let EDIT_IMAGE = null;
  let EDIT_DRAGGING = false;
  let EDIT_PAGE_X, EDIT_PAGE_Y;
  let EDIT_IMAGE_X, EDIT_IMAGE_Y;


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
      let open = indexedDB.open('dgen', 2);

      // Create the schema
      open.onupgradeneeded = function() {
        let upgradeDb = open.result;

        if (!upgradeDb.objectStoreNames.contains(TABLE_IMAGES)) {
          upgradeDb.createObjectStore(TABLE_IMAGES, {keyPath: 'id', autoIncrement: true});
        }

        if (!upgradeDb.objectStoreNames.contains(TABLE_CARD_SETTINGS)) {
          upgradeDb.createObjectStore(TABLE_CARD_SETTINGS, {keyPath: 'id', autoIncrement: true});
        }
      };

      _add_promise_handlers_for_request(open, resolve, reject);
    });
  }

  function db_fetch(table) {
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
        db_put(TABLE_IMAGES, {
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
    db_fetch(TABLE_IMAGES).then(function(images) {
      if (images.length) {
        $('#no_images').hide();
        $('#images')
          .empty()
          .append(
            $.map(images, function(image) {
              let image_html = render_image(image);
              return `
                <span class="image_container" data-id="${image.id}">
                  ${image_html}
                  <span class="button remove">X</span>
                </span>
              `;
            })).show();

        $('#images .remove').on('click', function() {
          let image_id = $(this).parent().data('id');
          db_remove(TABLE_IMAGES, image_id).then(show_images);
        })

        $('#images .image').on('click', function() {
          let image_id = $(this).parent().data('id');
          db_get(TABLE_IMAGES, image_id).then(function(image) {
            edit_image(image);
          });
        })
      } else {
        $('#images').hide();
        $('#no_images').show();
      }

      generate();
    });
  }

  function render_image(image) {
    return `
      <span class="image" style="
        background-color: ${image.background_color};
      ">
        <span class="zoom" style="
          background-image: url(${image.data});
          transform:
            scale(${image.zoom})
            translate(${image.x}%, ${image.y}%);
        "></span>
      </span>
    `;
  }

  function render_placeholder(index) {
    return `
      <span class="image placeholder">
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
    $('#edit_overlay #zoom').val(image.zoom);
    $('#edit_overlay .background_color').val(image.background_color);
    $('#edit_overlay').show();
  }

  function show_edit_image() {
    $('#edit_overlay .edit_image')
      .empty()
      .append(render_image(EDIT_IMAGE));

    $('#zoom_caption').text(EDIT_IMAGE.zoom);

    let pc_mult = 100.0 / $('#edit_overlay .edit_image').width();

    $('#edit_overlay .edit_image .zoom').on('mousedown', function(event) {
      EDIT_DRAGGING = true;
      EDIT_IMAGE_X = EDIT_IMAGE.x;
      EDIT_IMAGE_Y = EDIT_IMAGE.y;
      EDIT_PAGE_X = event.pageX;
      EDIT_PAGE_Y = event.pageY;
    });

    $('#edit_overlay .edit_image .zoom').on('mousemove', function(event) {
      if (!EDIT_DRAGGING) return;

      let new_x = EDIT_IMAGE.x + (event.pageX - EDIT_PAGE_X) * pc_mult;
      let new_y = EDIT_IMAGE.y + (event.pageY - EDIT_PAGE_Y) * pc_mult;
      $('#edit_overlay .edit_image .zoom').css({
        'transform': `scale(${EDIT_IMAGE.zoom}) translate(${new_x}%, ${new_y}%)`,
      });
    });

    $('#edit_overlay .edit_image .zoom').on('mouseup', function(event) {
      if (!EDIT_DRAGGING) return;

      EDIT_DRAGGING = false;

      EDIT_IMAGE.x += (event.pageX - EDIT_PAGE_X) * pc_mult;
      EDIT_IMAGE.y += (event.pageY - EDIT_PAGE_Y) * pc_mult;
    });
  }


  /////////////////////////////
  // Card Generation
  /////////////////////////////

  function generate() {
    db_fetch(TABLE_IMAGES).then(function(images) {
      let settings = SETTINGS[CARD_SETTINGS.order];

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
    let card_container = $('<span class="card_container"></span>').css({
      'height': `${2*CARD_SETTINGS.radius}px`,
      'width': `${2*CARD_SETTINGS.radius}px`,
      'border': `${CARD_SETTINGS.border_thickness}px solid ${CARD_SETTINGS.border_color}`,
      'background-color': `${CARD_SETTINGS.background_color}`,
    });

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
  // Card settings
  /////////////////////////////

  function load_card_settings() {
    db_fetch(TABLE_CARD_SETTINGS).then(function(card_settings) {
      if (card_settings[0]) {
        // Use the settings from the DB
        CARD_SETTINGS = card_settings[0];
      } else {
        // Make default settings
        CARD_SETTINGS = {
          background_color: '#ffffff',
          border_color: '#00ff00',
          border_thickness: 6,
          order: 3,
          radius: 200,
        };
      }

      $('#card_background_color').val(CARD_SETTINGS.background_color);
      $('#card_border_color').val(CARD_SETTINGS.border_color);
      $('#card_border_thickness').val(CARD_SETTINGS.border_thickness);
      $('#card_order').val(CARD_SETTINGS.order);
      $('#card_radius').val(CARD_SETTINGS.radius);
    });
  }

  function save_card_settings() {
    CARD_SETTINGS.background_color = $('#card_background_color').val();
    CARD_SETTINGS.border_color = $('#card_border_color').val();
    CARD_SETTINGS.border_thickness = $('#card_border_thickness').val();
    CARD_SETTINGS.order = $('#card_order').val();
    CARD_SETTINGS.radius = $('#card_radius').val();
    db_put(TABLE_CARD_SETTINGS, CARD_SETTINGS);
    generate();
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

    $('#generate_settings input, #generate_settings select').on('change, input', save_card_settings);
  }

  function init_edit_ui() {
    $('#edit_overlay .apply').on('click', function() {
      db_put(TABLE_IMAGES, EDIT_IMAGE).then(function() {
        EDIT_IMAGE = null;
        $('#edit_overlay').hide();
        show_images();
      });
    });

    $('#edit_overlay .cancel').on('click', function() {
      EDIT_IMAGE = null;
      $('#edit_overlay').hide();
    });

    $('#edit_overlay #zoom').on('change, input', function() {
      EDIT_IMAGE.zoom = $(this).val();
      show_edit_image();
    });

    $('#edit_overlay .background_color').on('change', function() {
      EDIT_IMAGE.background_color = $(this).val();
      show_edit_image();
    });
  }


  /////////////////////////////
  // Init everything
  /////////////////////////////

  init_database();
  load_card_settings();
  show_images();
  init_image_ui();
  init_generate_ui();
  init_edit_ui();
});
