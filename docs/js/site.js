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
          return render_image(image);
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
          ">
          </span>
        </span>
        <span class="remove">X</span>
      </span>
    `;
  }


  /////////////////////////////
  // Init functions
  /////////////////////////////

  function bind_drag_handlers() {
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


  /////////////////////////////
  // Init everything
  /////////////////////////////

  init_database();
  show_images();
  bind_drag_handlers();
});
