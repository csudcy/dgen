$(document).ready(function() {
  'use strict';
  let DB;


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
    return new Promise(function(resolve, reject) {
      DB.then(function(db) {
        let tx = db.transaction(table, 'readonly');
        let store = tx.objectStore(table);
        let request = store.getAll();
        _add_promise_handlers_for_request(request, resolve, reject);
      });
    });
  }

  function db_insert(table, value) {
    return new Promise(function(resolve, reject) {
      DB.then(function(db) {
        let tx = db.transaction(table, 'readwrite');
        let store = tx.objectStore(table);
        let request = store.put(value);
        _add_promise_handlers_for_request(request, resolve, reject);
      });
    });
  }

  function db_update(table, value, key) {
    return new Promise(function(resolve, reject) {
      DB.then(function(db) {
        let tx = db.transaction(table, 'readwrite');
        let store = tx.objectStore(table);
        let request = store.put(value, key);
        _add_promise_handlers_for_request(request, resolve, reject);
      });
    });
  }

  function db_remove(table, key) {
    return new Promise(function(resolve, reject) {
      DB.then(function(db) {
        let tx = db.transaction(table, 'readwrite');
        let store = tx.objectStore(table);
        let request = store.delete(key);
        _add_promise_handlers_for_request(request, resolve, reject);
      });
    });
  }


  /////////////////////////////
  // Image Management
  /////////////////////////////

  function add_image(file) {
    let reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = function(){
      let data = this.result;
      db_insert('images', {
        zoom: 1.0,
        x: 0,
        y: 0,
        data: data,
      }).then(show_images);
    }
  }

  function show_images() {
    db_select('images').then(function(images) {
      $('#images')
        .empty()
        .append($.map(images, function(image) {
          let image_html = $(render_image(image));
          image_html.append($('<span class="remove">X</span>'));
          return image_html;
        }));

      $('#images .remove').on('click', function() {
        let image_id = $(this).parent().data('id');
        db_remove('images', image_id).then(show_images);
      })
    });
  }

  function render_image(image) {
    console.log(image);
    return `
      <span class="image_container" data-id="${image.id}">
        <span class="image">
          <span class="zoom" style="
            background-image: url(${image.data});
            transform: scale(${image.zoom});
          "></span>
        </span>
      </span>
    `;
  }

  function render_placeholder(index) {
    return `
      <span class="image_container">
        <span class="image">
          <span class="zoom">${index}</span>
        </span>
      </span>
    `;
  }


  /////////////////////////////
  // Generation Functions
  /////////////////////////////

  function generate() {
    db_select('images').then(function(images) {
      let order = parseInt($('#card_order').val());
      let settings = SETTINGS[order];
      console.log(settings);

      // Shuffle the images so the cards are more randomised
      shuffle_array(images);

      // Generate all the images
      let rendered_images = $.map(images, render_image);
      while (images.length < settings.items_required) {
        rendered_images.push(render_placeholder(images.length))
      }

      // Generate all the cards
      $('#cards').append(
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
    //
    console.log('settings', settings);
    console.log('rendered_images', rendered_images);
    console.log('combination', combination);

    let card_container = $('<span class="card_container"></span>');

    $.each(combination, function(index, image_index) {
      //
      console.log('index', index);
      console.log('image_index', image_index);

      let layout = settings.layout[index];
      console.log('layout', layout);
      card_container.append(
        $(rendered_images[image_index])
          .css({
            'top': `${layout[1]}%`,
            'left': `${layout[0]}%`,
            'width': `${settings.image_radius}%`,
            'height': `${settings.image_radius}%`,
            'position': 'absolute',
            // rotation()
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
      $.each(event.originalEvent.dataTransfer.files, function(index, file) {
        add_image(file);
      });
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
      console.log('Generate!');
      generate();
    });
  }


  /////////////////////////////
  // Init everything
  /////////////////////////////

  init_database();
  show_images();
  init_image_ui();
  init_generate_ui();
});
