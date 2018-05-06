/*
TODO:
  Layout editor
  Export/import
  Image edit reset
  Images sets?
*/

$(document).ready(function() {
  'use strict';

  // Database variables
  const TABLE_IMAGES = 'images';
  const TABLE_CARD_SETTINGS = 'card_settings';
  const TABLE_LAYOUTS = 'layouts';
  let DB = null;

  // Settings
  let CARD_SETTINGS = null;

  // Image editing/dragging info
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
      let open = indexedDB.open('dgen', 3);

      // Create the schema
      open.onupgradeneeded = function() {
        let upgradeDb = open.result;

        if (!upgradeDb.objectStoreNames.contains(TABLE_IMAGES)) {
          upgradeDb.createObjectStore(TABLE_IMAGES, {keyPath: 'id', autoIncrement: true});
        }

        if (!upgradeDb.objectStoreNames.contains(TABLE_CARD_SETTINGS)) {
          upgradeDb.createObjectStore(TABLE_CARD_SETTINGS, {keyPath: 'id', autoIncrement: true});
        }

        if (!upgradeDb.objectStoreNames.contains(TABLE_LAYOUTS)) {
          upgradeDb.createObjectStore(TABLE_LAYOUTS, {keyPath: 'id', autoIncrement: true});
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
  // Image Rendering
  /////////////////////////////

  function get_image_css(image) {
    let image_size = Math.min(image.width, image.height);
    let zoom_mult = (image.zoom * 100) / image_size;
    let offset = 50 - image.zoom * 50;

    return {
      top: ((image_size - image.height) / 2 + image.y) * zoom_mult + offset + '%',
      left: ((image_size - image.width) / 2 + image.x) * zoom_mult + offset + '%',
      width: image.width * zoom_mult + '%',
      height: image.height * zoom_mult + '%',
    };
  }

  function render_image(image) {
    let tlwh = get_image_css(image);
    return `
      <span class="image" style="
        background-color: ${image.background_color};
      ">
        <img class="zoom" src="${image.data}" style="
          top: ${tlwh.top};
          left: ${tlwh.left};
          width: ${tlwh.width};
          height: ${tlwh.height};
        "
        draggable="false"/>
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
  // Card Rendering
  /////////////////////////////

  function render_card(layout, rendered_images, combination, maximum_rotation) {
    let card = $('<span class="card"></span>');

    $.each(combination, function(index, image_index) {
      let position = layout[index];
      let rotation = Math.floor(Math.random() * maximum_rotation);
      card.append(
        $(rendered_images[image_index])
          .css({
            'top': `${position[1]}%`,
            'left': `${position[0]}%`,
            'width': `${position[2]*2}%`,
            'height': `${position[2]*2}%`,
            'position': 'absolute',
            'transform': `rotate(${rotation}deg)`,
          }));
    });

    return card;
  }


  /////////////////////////////
  // Image Management
  /////////////////////////////

  function add_image(file) {
    return new Promise(function(resolve, reject) {
      // Read the file as a data URL
      let reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = function(){
        // Put the data URL into an image to get the dimensions
        let img = new Image();
        img.src = reader.result;
        img.onload = function() {
          db_put(TABLE_IMAGES, {
            zoom: 1.0,
            x: 0,
            y: 0,
            width: img.width,
            height: img.height,
            background_color: '#ffffff',
            data: reader.result,
          }).then(resolve);
        };
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
                  <span class="buttons button remove">
                    <i class="fas fa-trash-alt"></i>
                  </span>
                </span>
              `;
            })).show();

        $('#images .remove').on('click', function() {
          let image_id = $(this).parent().data('id');
          db_remove(TABLE_IMAGES, image_id).then(show_images);
        });

        $('#images .image').on('click', function() {
          let image_id = $(this).parent().data('id');
          db_get(TABLE_IMAGES, image_id).then(function(image) {
            edit_image(image);
          });
        });
      } else {
        $('#images').hide();
        $('#no_images').show();
      }

      generate();
    });
  }

  function edit_image(image) {
    EDIT_IMAGE = image;
    show_edit_image();
    $('#edit_image_overlay #zoom').val(image.zoom);
    $('#edit_image_overlay .background_color').val(image.background_color);
    $('#edit_image_overlay').show();
  }

  function show_edit_image() {
    $('#edit_image_overlay .edit_image')
      .empty()
      .append(render_image(EDIT_IMAGE));

    $('#zoom_caption').text(EDIT_IMAGE.zoom);


    $('#edit_image_overlay .edit_image .image').on('mousemove', function(event) {
      if (event.buttons != 1) return;

      let pc_mult = 100.0 / EDIT_IMAGE.width / EDIT_IMAGE.zoom;
      EDIT_IMAGE.x += event.originalEvent.movementX * pc_mult;
      EDIT_IMAGE.y += event.originalEvent.movementY * pc_mult;
      $('#edit_image_overlay .edit_image .zoom').css(get_image_css(EDIT_IMAGE));
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
            return render_card(settings.layout, rendered_images, combination, 360).css({
              'height': `${2*CARD_SETTINGS.radius}px`,
              'width': `${2*CARD_SETTINGS.radius}px`,
              'border': `${CARD_SETTINGS.border_thickness}px solid ${CARD_SETTINGS.border_color}`,
              'background-color': `${CARD_SETTINGS.background_color}`,
            });
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
          radius: 150,
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
  // Layout Editing
  /////////////////////////////

  function get_layouts() {
    return new Promise(function(resolve, reject) {
      db_fetch(TABLE_LAYOUTS).then(function(db_layouts) {
        resolve($.map(SETTINGS, function(settings, key) {
          return {
            'type': 'default',
            'id': key,
            'name': `Default ${key}`,
            'layout': settings.layout,
          };
        }).concat(db_layouts));
      });
    });
  }

  function render_layout(settings) {
    // Generate all the images/placeholders
    let placeholder_images = [];
    let combination = [];
    for (let i=0; i<settings.layout.length; i++) {
      placeholder_images.push(render_placeholder(i+1));
      combination.push(i);
    }

    // Generate the layout
    let card_element = render_card(settings.layout, placeholder_images, combination, 0);
    return $(`
      <span class="card_container" data-type="${settings.type}" data-id="${settings.id}">
        <span class="buttons">
          <span class="button edit">
            <i class="fas fa-pencil-alt"></i>
          </span>
          <span class="button duplicate">
            <i class="fas fa-copy"></i>
          </span>
          <span class="button remove">
            <i class="fas fa-trash-alt"></i>
          </span>
        </span>
      </span>
    `).prepend(card_element);
  }

  function show_layouts() {
    get_layouts().then(function(layouts) {
      $('#layouts')
        .empty()
        .append($.map(layouts, render_layout));

      $('#layouts .edit').on('click', function() {
        get_layout_from_button(this).then(function(layout) {
          if (layout.type == 'default') {
            alert('You cannot edit default layouts! Try duplicating it first.');
          } else {
            console.log('TODO: Edit DB layout');
            // db_get(TABLE_LAYOUTS, layout_id).then(function(layout) {
            //   edit_layout(layout);
            // });
          }
        })
      });

      $('#layouts .duplicate').on('click', function() {
        get_layout_from_button(this).then(function(layout) {
          // Create a new layout
          let new_layout = {
            'name': `Copy of ${layout.name}`,
            'type': 'database',
            'layout': layout.layout,
          };

          db_put(TABLE_LAYOUTS, new_layout).then(function() {
            show_layouts();
            alert(`Duplicated to "${new_layout.name}"!`);
          });
        });
      });

      $('#layouts .remove').on('click', function() {
        get_layout_from_button(this).then(function(layout) {
          if (layout.type == 'default') {
            alert('You cannot remove default layouts!');
          } else {
            db_remove(TABLE_LAYOUTS, layout.id).then(show_layouts);
          }
        });
      });
    });
  }

  function get_layout_from_button(button) {
    return new Promise(function(resolve, reject) {
      get_layouts().then(function(layouts) {
        let layout_element = $(button).parent().parent();
        let layout_type = layout_element.data('type');
        let layout_id = layout_element.data('id');
        let filtered_layouts = $.grep(layouts, function(layout) {
          return (layout.type == layout_type) && (layout.id == layout_id);
        });

        if (!filtered_layouts) {
          throw new Error(`Could not find layout "${layout_id}" of type "${layout_type}"!`);
        }

        resolve(filtered_layouts[0]);
      });
    });
  }

  /////////////////////////////
  // Init functions
  /////////////////////////////

  function init_general_ui() {
    $('.close_overlay').on('click', function() {
      $(this).parent().hide();
    });


    $('#edit_images').on('click', function() {
      $('#images_overlay').show();
    });

    $('#edit_layouts').on('click', function() {
      $('#layouts_overlay').show();
      show_layouts();
    });

    $('#edit_settings').on('click', function() {
      $('#settings_overlay').show();
    });
  }

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

    $('#settings_overlay input, #card_order').on('change, input', save_card_settings);
  }

  function init_edit_image_ui() {
    $('#edit_image_overlay .apply').on('click', function() {
      db_put(TABLE_IMAGES, EDIT_IMAGE).then(function() {
        EDIT_IMAGE = null;
        $('#edit_image_overlay').hide();
        show_images();
      });
    });

    $('#edit_image_overlay .cancel').on('click', function() {
      EDIT_IMAGE = null;
      $('#edit_image_overlay').hide();
    });

    $('#edit_image_overlay #zoom').on('change, input', function() {
      EDIT_IMAGE.zoom = $(this).val();
      show_edit_image();
    });

    $('#edit_image_overlay .background_color').on('change', function() {
      EDIT_IMAGE.background_color = $(this).val();
      show_edit_image();
    });
  }

  function init_edit_layout_ui() {
  }

  /////////////////////////////
  // Init everything
  /////////////////////////////

  // Database
  init_database();
  load_card_settings();
  show_images();

  // UI
  init_general_ui();
  init_image_ui();
  init_generate_ui();
  init_edit_image_ui();
  init_edit_layout_ui();
});
