// A fork of the [node.js chat app](https://github.com/eiriksm/chat-test-2k) 
// by [@orkj](https://twitter.com/orkj) using socket.io, rethinkdb, passport and bcrypt on an express app.
//
// See the [GitHub README](https://github.com/rethinkdb/rethinkdb-example-nodejs-chat/blob/master/README.md)
// for details of the complete stack, installation, and running the app.

var r = require('rethinkdb')
  , util = require('util')
  , assert = require('assert')
  , logdebug = require('debug')('rdb:debug')
  , logerror = require('debug')('rdb:error');


// #### Connection details

// RethinkDB database settings. Defaults can be overridden using environment variables.
var dbConfig = {
  host: process.env.RDB_HOST || 'localhost',
  port: parseInt(process.env.RDB_PORT) || 28015,
  db  : process.env.RDB_DB || 'chat',
  tables: {
    'messages': 'id',
    'cache': 'cid',
    'users': 'id'
  }
};

/**
 * Connect to RethinkDB instance and perform a basic database setup:
 *
 * - create the `RDB_DB` database (defaults to `chat`)
 * - create tables `messages`, `cache`, `users` in this database
 */
module.exports.setup = function() {
  connect(function (err, connection) {
    assert.ok(err === null, err);

    // Create the db if we don't have it (will not overwrite):
    connection.run(r.dbCreate(dbConfig.db), function(result) {
      // Once the database is available, create all the tables:
      for (var i in dbConfig['tables']) {
        connection.run(r.db(dbConfig['db']).tableCreate({tableName: i, primaryKey: dbConfig['tables'][i]}), logConnectionResults(connection));
      }
    });

    logdebug('[INFO ][%s] RethinkDB db `%s` setup completed.', connection['_id'], dbConfig['db']);
  });
};

// #### Filtering results

/**
 * Find a user by email using the 
 * [`filter`](http://www.rethinkdb.com/api/#js:selecting_data-filter) function. 
 * We are using the simple form of `filter` accepting an object as an argument which
 * is used to perform the matching (in this case the attribute `mail` must be equal to
 * the value provided). 
 *
 * We only need one result back so we use [`limit`](http://www.rethinkdb.com/api/#js:transformations-limit)
 * to return it (if found). Results are [`collect`](http://www.rethinkdb.com/api/#js:accessing_rql-collect)ed
 * and passed as an array to the callback function. 
 *
 * @param {String} mail
 *    the email of the user that we search for
 *
 * @param {Function} callback
 *    callback invoked after collecting all the results 
 * 
 * @returns {Object} the user if found, `null` otherwise 
 */
module.exports.findUserByEmail = function (mail, callback) {
  connect(function (err, connection) {
    if (err) { return callback(err); }

    logdebug("[INFO ][%s][findUserByEmail] Login {user: %s, pwd: 'you really thought I'd log it?'}", connection['_id'], mail);

    connection.run(r.db(dbConfig['db']).table('users').filter({'mail': mail}).limit(1), {})
      .collect(function (results) {
        if (results.length === 0) {
          return callback(null, null);
        }
        if(results[0].name === 'Runtime Error') {
          logerror("[ERROR][%s][findUserByEmail][collect] %s\n%s", connection['_id'], results[0].name, results[0].message);
          return callback(results[0]);
        }
        else {
          return callback(null, results[0]);
        }
      });
  });
};

/**
 * Every user document is assigned a unique id when created. Retrieving
 * a document by its id can be done using the
 * [`get`](http://www.rethinkdb.com/api/#js:selecting_data-get) function.
 *
 * RethinkDB will use the primary key index to fetch the result.
 *
 * @param {String} userId 
 *    The ID of the user to be retrieved.
 *
 * @param {Function} callback
 *    callback invoked after collecting all the results 
 * 
 * @returns {Object} the user if found, `null` otherwise
 */
module.exports.findUserById = function (userId, callback) {
  connect(function (err, connection) {
    if (err) { return callback(err); }


    connection.run(r.db(dbConfig['db']).table('users').get(userId), {})
      .collect(function(results) {
        if (results.length > 0) {
          callback(null, results[0]);
        }
        else {
          callback(null, null);
        }
      });
  });
};

// #### Retrieving chat messages

/**
 * To find the last `max_results` messages ordered by `timestamp`,
 * we are using [`table`](http://www.rethinkdb.com/api/#js:selecting_data-table) to access
 * messages in the table, then we 
 * [`orderBy`](http://www.rethinkdb.com/api/#js:transformations-orderby) `timestamp` 
 * and instruct the server to return only `max_results` using 
 * [`limit`](http://www.rethinkdb.com/api/#js:transformations-limit).
 *
 * These operations are chained together and executed on the database. Results
 * are [`collect`](http://www.rethinkdb.com/api/#js:accessing_rql-collect)ed
 * and passed as an array to the callback function. 
 *
 *
 * @param {Number} max_results
 *    Maximum number of results to be retrieved from the db
 *
 * @param {Function} callback
 *    callback invoked after collecting all the results
 *
 * @returns {Array} an array of messages
 */
module.exports.findMessages = function (max_results, callback) {
  connect(function (err, connection) {
    if (err) { return callback(err); }

    connection.run(r.db(dbConfig['db']).table('messages').orderBy(r.desc('timestamp')).limit(max_results), {})
      .collect(function (results) {
        if (results.length === 0) {
          return callback(null, []);
        }
        if(results[0].name === 'Runtime Error') {
          logerror("[ERROR][%s][findMessages] %s\n%s", connection['_id'], results[0].name, results[0].message);
          return callback(results[0]);
        }
        else {
          return callback(null, results);
        }
      });
  });
};


/**
 * To save a new chat message using we are using 
 * [`insert`](http://www.rethinkdb.com/api/#js:writing_data-insert). 
 *
 * An `insert` op returns an object specifying the number
 * of successfully created objects and their corresponding IDs:
 * `{ "inserted": 1, "errors": 0, "generated_keys": ["b3426201-9992-ab84-4a21-576719746036"] }`
 *
 * @param {Object} msg
 *    The message to be saved
 *
 * @param {Function} callback
 *    callback invoked once after the first result returned
 *
 * @returns {Boolean} `true` if the user was created, `false` otherwise 
 */
module.exports.saveMessage = function (msg, callback) {
  connect(function (err, connection) {
    if (err) { return callback(err); }

    connection.run(r.db(dbConfig['db']).table('messages').insert(msg), 
      function(result) {
        if (result && result['inserted'] === 1) {
          callback(null, true);
        }
        else {
          callback(null, false);
        }

        return false; // no need to be have this callback invoked again
      }
    );
  });
};

/**
 * Adding a new user to database using  [`insert`](http://www.rethinkdb.com/api/#js:writing_data-insert).
 *
 * If the document to be saved doesn't have an `id` field, RethinkDB automatically
 * generates an unique `id`. This is returned in the result object.
 *
 * @param {Object} user
 *   The user JSON object to be saved.
 *
 * @param {Function} callback
 *    callback invoked once after the first result returned
 *
 * @returns {Boolean} `true` if the user was created, `false` otherwise
 */
module.exports.saveUser = function (user, callback) {  
  connect(function (err, connection) {
    if(err) { return callback(err); }

    connection.run(r.db(dbConfig['db']).table('users').insert(user), 
      function (result) {
        if (result && result['inserted'] === 1) {
          callback(null, true);
        }
        else {
          callback(null, false);
        }

        return false; // callback won't be invoked again
      }
    );
  });
};

// #### Helper functions

/**
 * A wrapper function for the RethinkDB API that makes it follow a bit closer
 * the node.js conventions. 
 * (see [Issue #221](https://github.com/rethinkdb/rethinkdb/issues/221)). 
 */ 
function connect(callback) {
  r.connect({host: dbConfig.host, port: dbConfig.port }, 
    function(connection){
      connection['_id'] = Math.floor(Math.random()*10001);
      return callback(null, connection);
    }, 
    function() {
      var errMsg = util.format("Failed connecting to RethinkDB instance on {host: %s, port: %s}", dbConfig.host, dbConfig.port);
      return callback(new Error(errMsg));
    });
}

/**
 * A generic callback function that can be used for logging purposes
 * and passed to database API calls that are
 * not using the results.
 */
var logConnectionResults = function (connection) {
  var fn = function (result) {
    if(result === undefined) {
      logdebug("[WARN ][%s][lcr] undefined parameter", connection['_id']);
      return true;
    }
    if(result && result['name'] === 'Runtime Error') {
      logerror("[ERROR][%s][lcr] %s: \n%s", connection['_id'], result['name'], result['message']);
      return false;
    }
    else {
      logdebug("[INFO ][%s][lcr] %s", connection['_id'], util.inspect(result));    
    }
    return true;
  }

  return fn;
}

// #### Connection management
//
// This application uses a new connection for each query needed to serve
// a user request. In case generating the response would require multiple
// queries, the same connection should be used for all queries.
//
// Example:
//
//     connect(function (err, connection)) {
//         if(err) { return callback(err); }
//
//         connection.run(query1, callback);
//         connection.run(query2, callback);
//     }
