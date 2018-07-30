/*
TODO:
  BUG: Print in Windows doesn't work well
  Improve layout editor dragging
  Export/import
  Images sets
*/

$(document).ready(function() {
  'use strict';

  // Database variables
  const TABLE_IMAGES = 'images';
  const TABLE_CARD_SETTINGS = 'card_settings';
  const TABLE_LAYOUTS = 'layouts';
  let DB = null;

  // Layout types
  const LAYOUT_DEFAULT = 'default';
  const LAYOUT_DATABASE = 'database';

  // Image being edited
  let EDIT_IMAGE = null;

  // Layout being edited
  let EDIT_LAYOUT = null;


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
      <span class="image placeholder" data-index="${index}">
        <span class="zoom">${index+1}</span>
      </span>
    `;
  }


  /////////////////////////////
  // Card/Layout Rendering
  /////////////////////////////

  function get_position_css(position) {
    return {
      'top': `${position.y - position.zoom*50}%`,
      'left': `${position.x - position.zoom*50}%`,
      'width': `${position.zoom*100}%`,
      'height': `${position.zoom*100}%`,
    };
  }

  function render_card(positions, rendered_images, combination, maximum_rotation) {
    let card = $('<span class="card"></span>');

    shuffle_array(combination);

    $.each(combination, function(index, image_index) {
      let rotation = Math.floor(Math.random() * maximum_rotation);
      card.append(
        $(rendered_images[image_index])
          .css(get_position_css(positions[index]))
          .css({
            position: 'absolute',
            transform: `rotate(${rotation}deg)`,
          }));
    });

    return card;
  }


  /////////////////////////////
  // Image Management
  /////////////////////////////

  function add_images(filelist) {
    if (!filelist.length) return;

    Promise.all(
      $.map(filelist, add_image)
    ).then(show_images);
  }

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
    $('#edit_image_overlay .zoom_input').val(image.zoom);
    $('#edit_image_overlay .background_color').val(image.background_color);
    $('#edit_image_overlay').show();
  }

  function show_edit_image() {
    $('#edit_image_overlay .edit_image')
      .empty()
      .append(render_image(EDIT_IMAGE));

    $('#edit_image_overlay .zoom_caption').text(EDIT_IMAGE.zoom);


    $('#edit_image_overlay .edit_image .image').on('mousemove', function(event) {
      if (event.buttons != 1) return;

      EDIT_IMAGE.x += event.originalEvent.movementX * 2;
      EDIT_IMAGE.y += event.originalEvent.movementY * 2;
      $('#edit_image_overlay .edit_image .zoom').css(get_image_css(EDIT_IMAGE));
    });
  }


  /////////////////////////////
  // Card Generation
  /////////////////////////////

  function generate() {
    get_card_settings().then(function(card_settings) {
      Promise.all([
        db_fetch(TABLE_IMAGES),
        get_layout(card_settings.layout_key),
      ]).then(function(results) {
        let images = results[0];
        let layout = results[1];

        let settings = SETTINGS[layout.positions.length];

        // Show card counts
        $('#image_count .added').text(images.length);
        $('#image_count .required').text(settings.items_required);

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
              return render_card(layout.positions, rendered_images, combination, 360).css({
                'height': `${2*card_settings.radius}px`,
                'width': `${2*card_settings.radius}px`,
                'border': `${card_settings.border_thickness}px solid ${card_settings.border_color}`,
                'background-color': `${card_settings.background_color}`,
              });
            }));
      });
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

  function get_card_settings() {
    return new Promise(function(resolve, reject) {
      db_fetch(TABLE_CARD_SETTINGS).then(function(card_objects) {
        // Get the card settings
        let card_settings;
        if (card_objects.length) {
          // Use the settings from the DB
          card_settings = card_objects[0];
        } else {
          // Make default settings
          card_settings = {
            background_color: '#ffffff',
            border_color: '#00ff00',
            border_thickness: 6,
            layout_key: `${LAYOUT_DEFAULT}__3`,
            radius: 150,
          };
        }

        // Check the layout still exists
        get_layout(card_settings.layout_key).then(function(layout) {
          if (!layout) {
            card_settings.layout_key = `${LAYOUT_DEFAULT}__3`;
          }


          resolve(card_settings);
        });
      });
    });
  }

  function load_card_settings() {
    get_card_settings().then(function(card_settings) {
      $('#card_background_color').val(card_settings.background_color);
      $('#card_border_color').val(card_settings.border_color);
      $('#card_border_thickness').val(card_settings.border_thickness);
      $('#layout_input').val(card_settings.layout_key);
      $('#card_radius').val(card_settings.radius);
    })
  }

  function save_card_settings() {
    get_card_settings().then(function(card_settings) {
      card_settings.background_color = $('#card_background_color').val();
      card_settings.border_color = $('#card_border_color').val();
      card_settings.border_thickness = $('#card_border_thickness').val();
      card_settings.layout_key = $('#layout_input').val();
      card_settings.radius = $('#card_radius').val();

      db_put(TABLE_CARD_SETTINGS, card_settings);
      generate();
    });
  }


  /////////////////////////////
  // Layout Editing
  /////////////////////////////

  function get_layouts() {
    return new Promise(function(resolve, reject) {
      db_fetch(TABLE_LAYOUTS).then(function(db_layouts) {
        resolve($.map(SETTINGS, function(settings, key) {
          return {
            'type': LAYOUT_DEFAULT,
            'id': key,
            'name': `Default ${key}`,
            'positions': $.map(settings.layout, function(position, index) {
              return {
                'x': position[0] + position[2],
                'y': position[1] + position[2],
                'zoom': Math.floor(position[2] * 2) / 100,
              };
            }),
          };
        }).concat(db_layouts));
      });
    });
  }

  function get_layout(layout_key) {
    return new Promise(function(resolve, reject) {
      get_layouts().then(function(layouts) {
        resolve($.grep(layouts, function(layout) {
          return `${layout.type}__${layout.id}` == layout_key;
        })[0]);
      });
    });
  }

  function render_layout(positions) {
    // Generate all the images/placeholders
    let placeholder_images = $.map(positions, function(position, index) {
      return render_placeholder(index);
    });
    let combination = $.map(positions, function(position, index) {
      return index;
    });

    // Generate the layout
    return render_card(positions, placeholder_images, combination, 0);
  }

  function show_layouts() {
    get_layouts().then(function(layouts) {
      // Save the currently selected layout
      let layout_input = $('#layout_input');
      let selected_layout = layout_input.val();

      // Populate the list of layouts
      layout_input
        .empty()
        .append(
          $.map(layouts, function(layout) {
            return `
              <option value="${layout.type}__${layout.id}">${layout.name}</option>`;
          }));

      // Use the previously selected layout
      layout_input.val(selected_layout);

      // Check the selected layout still exists
      if (layout_input.val() != selected_layout) {
        // Choose the right layout
        load_card_settings();
        generate();
      }

      $('#layouts')
        .empty()
        .append($.map(layouts, function(layout) {
          let card_element = render_layout(layout.positions);
          return $(`
            <span class="card_container" data-key="${layout.type}__${layout.id}">
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
              <span class="name">${layout.name}</span>
            </span>
          `).prepend(card_element);
        }));

      $('#layouts .edit').on('click', function() {
        get_layout_from_button(this).then(function(layout) {
          if (layout.type == LAYOUT_DEFAULT) {
            alert('You cannot edit default layouts! Try duplicating it first.');
          } else {
            edit_layout(layout);
          }
        })
      });

      $('#layouts .duplicate').on('click', function() {
        get_layout_from_button(this).then(function(layout) {
          // Create a new layout
          let new_layout = {
            'name': `Copy of ${layout.name}`,
            'type': LAYOUT_DATABASE,
            'positions': layout.positions,
          };

          db_put(TABLE_LAYOUTS, new_layout).then(function() {
            show_layouts();
          });
        });
      });

      $('#layouts .remove').on('click', function() {
        get_layout_from_button(this).then(function(layout) {
          if (layout.type == LAYOUT_DEFAULT) {
            alert('You cannot remove default layouts!');
          } else {
            db_remove(TABLE_LAYOUTS, layout.id).then(function() {
              show_layouts();
            });
          }
        });
      });
    });
  }

  function get_layout_from_button(button) {
    let layout_key = $(button).parent().parent().data('key');
    return get_layout(layout_key);
  }

  function edit_layout(layout) {
    EDIT_LAYOUT = layout;
    show_edit_layout();
    $('#edit_layout_overlay').show();
  }

  function show_edit_layout() {
    // Show & bind all the zoom controls
    $('#edit_layout_overlay .settings_container .zoom_container')
      .empty()
      .append(
        $.map(EDIT_LAYOUT.positions, function(position, index) {
          return `
            <span class="layout_zoom" data-index=${index}>
              ${index+1}:
              <input type="range" min="0.01" max="1" step="0.01" class="zoom_input" value="${position.zoom}"/>
              <span class="zoom_caption">?</span>x
            </span>
          `;
        }));

    $('#edit_layout_overlay .zoom_input').on('change, input', function() {
      let index = $(this).parent().data('index');

      EDIT_LAYOUT.positions[index].zoom = parseFloat($(this).val());
      update_edit_layout();
    });


    update_edit_layout();
  }

  function update_edit_layout() {
    $('#edit_layout_overlay .edit_layout')
      .empty()
      .append(render_layout(EDIT_LAYOUT.positions));

    $.each(EDIT_LAYOUT.positions, function(index, position) {
      $(`.layout_zoom[data-index=${index}] .zoom_caption`).text(position.zoom);
    });

    $('#edit_layout_overlay .name').val(EDIT_LAYOUT.name);

    $('#edit_layout_overlay .edit_layout .card .image').on('mousemove', function(event) {
      if (event.buttons != 1) return;

      let index = $(this).data('index');
      let position = EDIT_LAYOUT.positions[index];

      let pc_mult = position.zoom / 2; //100.0 / EDIT_LAYOUT.width / EDIT_LAYOUT.zoom;
      position.x += event.originalEvent.movementX * pc_mult;
      position.y += event.originalEvent.movementY * pc_mult;
      $(this).css(get_position_css(position));
    });
  }

  /////////////////////////////
  // Init functions
  /////////////////////////////

  function init_general_ui() {
    $('.close_overlay').on('click', function() {
      $(this).parent().hide();
    });

    $('#add_images').on('click', function(event) {
      $('#image_input').trigger('click');
    });
    $('#image_input').on('change', function(event) {
      add_images(event.target.files);
    });

    $('#edit_images').on('click', function() {
      $('#images_overlay').show();
    });

    $('#edit_layouts').on('click', function() {
      $('#layouts_overlay').show();
    });

    $('#edit_card_settings').on('click', function() {
      $('#card_settings_overlay').show();
    });

    $('#import_export').on('click', function() {
      $('#import_export_overlay').show();
    });

    $('#show_print').on('click', function() {
      $('#print_overlay').show();
    });
  }

  function init_drag_ui() {
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

      add_images(event.originalEvent.dataTransfer.files);
    });
  }

  function init_generate_ui() {
    $('#card_settings_overlay input, #layout_input').on('change, input', save_card_settings);
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

    $('#edit_image_overlay .zoom_input').on('change, input', function() {
      EDIT_IMAGE.zoom = $(this).val();
      show_edit_image();
    });

    $('#edit_image_overlay .background_color').on('change', function() {
      EDIT_IMAGE.background_color = $(this).val();
      show_edit_image();
    });
  }

  function init_edit_layout_ui() {
    $('#edit_layout_overlay .apply').on('click', function() {
      // Save the name
      EDIT_LAYOUT.name = $('#edit_layout_overlay .name').val();

      db_put(TABLE_LAYOUTS, EDIT_LAYOUT).then(function() {
        EDIT_LAYOUT = null;
        $('#edit_layout_overlay').hide();
        show_layouts();
        generate();
      });
    });

    $('#edit_layout_overlay .cancel').on('click', function() {
      EDIT_LAYOUT = null;
      $('#edit_layout_overlay').hide();
    });
  }

  function init_print_ui() {
    $('#print').on('click', function() {
      window.print()
    });
  }

  /////////////////////////////
  // Init everything
  /////////////////////////////

  // Database
  init_database();
  load_card_settings();
  show_images();
  show_layouts();

  // UI
  init_general_ui();
  init_drag_ui();
  init_generate_ui();
  init_edit_image_ui();
  init_edit_layout_ui();
  init_print_ui();
});
