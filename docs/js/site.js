$(document).ready(function() {
  'use strict';
  let DB;

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
        var tx = db.transaction(table, 'readonly');
        var store = tx.objectStore(table);
        var request = store.getAll();
        _add_promise_handlers_for_request(request, resolve, reject);
      });
    });
  }

  function db_insert(table, value) {
    return new Promise(function(resolve, reject) {
      DB.then(function(db) {
        var tx = db.transaction(table, 'readwrite');
        var store = tx.objectStore(table);
        var request = store.put(value);
        _add_promise_handlers_for_request(request, resolve, reject);
      });
    });
  }

  function db_update(table, value, key) {
    return new Promise(function(resolve, reject) {
      DB.then(function(db) {
        var tx = db.transaction(table, 'readwrite');
        var store = tx.objectStore(table);
        var request = store.put(value, key);
        _add_promise_handlers_for_request(request, resolve, reject);
      });
    });
  }

  /////////////////////////////
  // Image Management
  /////////////////////////////

  function add_image(file) {
    console.log(file);
    db_insert('images', file);
    // $('<img>').
  }

  function load_images() {
    db_select('images').then(function(images) {
      console.log(images);
    });
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
  load_images();
  bind_drag_handlers();
});
