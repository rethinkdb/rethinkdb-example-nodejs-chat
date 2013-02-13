// A fork of the [node.js chat app](https://github.com/eiriksm/chat-test-2k) 
// by [@orkj](https://twitter.com/orkj) using socket.io, rethinkdb, passport and bcrypt on an express app.
//
// See the [GitHub README](https://github.com/rethinkdb/rethinkdb-example-nodejs-chat/blob/master/README.md)
// for details of the complete stack, installation, and running the app.

var r = require('rethinkdb')
  , pool = require('generic-pool')
  , util = require('util')
  , assert = require('assert')
  , logdebug = require('debug')('rdb:debug')
  , logerror = require('debug')('rdb:error');



// RethinkDB database settings. Defaults can be overridden using environment variables.
var dbConfig = {
  'host': process.env.RDB_HOST || 'localhost',
  'port': parseInt(process.env.RDB_PORT) || 28015,
  'db'  : process.env.RDB_DB || 'chat',
  'tables': {
    'messages': 'id',
    'cache': 'cid',
    'users': 'id'
  }
};

var connectionPool = pool.Pool({
  name: 'rethinkdb',
  max : 10,
  min : 2,
  log : true,
  idleTimeoutMillis : 1 * 60 * 1000,
  reapIntervalMillis: 30 * 1000, 

  create: function(callback) {
    r.connect({host: dbConfig['host'] || 'localhost', port: dbConfig['port'] || 28015 }, 
      function(connection){
        connection['_id'] = Math.floor(Math.random()*10001);
        logdebug('[DEBUG]: Connection created: %s', connection['_id']);
        return callback(null, connection);
      }, 
      function() {
        var errMsg = util.format("Failed connecting to RethinkDB instance on {host: %s, port: %s}", dbConfig['host'] || localhost, dbConfig['port'] || 28015);
        return callback(new Error(errMsg));
      }
    );
  },

  destroy: function(connection) {
    logdebug('[DEBUG]: Connection closed: %s', connection['_id']);

    connection.close();
  }
});
/**
 * Connect to RethinkDB instance and perform basic setup:
 *
 * - create the `RDB_DB` database (defaults to `chat`)
 * - create tables `messages`, `cache`, `users` in this database
 */
module.exports.setup = function() {
  connect(function (err, connection) {
    assert.ok(err === null, err);

    logdebug('[INFO ][%s] RethinkDB new database `%s` setup', connection['_id'], dbConfig['db']);
    
    // Create the db if we don't have it (will not overwrite):
    connection.run(r.dbCreate(dbConfig['db']), logConnectionResults(connection));

    // Set up all tables:
    for (var i in dbConfig['tables']) {
      connection.run(r.db(dbConfig['db']).tableCreate({tableName: i, primaryKey: dbConfig['tables'][i]}), logConnectionResults(connection));
    }

    connectionPool.release(connection);
    logdebug('[INFO ][%s] RethinkDB db `%s` setup completed.', connection['_id'], dbConfig['db']);
  });
};

/**
 * Find a user by email using the 
 * [`filter`](http://www.rethinkdb.com/api/#js:selecting_data-filter) function
 * and limiting the results to 1 using [`limit`](http://www.rethinkdb.com/api/#js:transformations-limit).
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
        logdebug("[INFO ][%s][findUserByEmail][collect] %s", connection['_id'], util.inspect(results));
        if (results.length === 0) {
          callback(null, null);
        }
        else if(results[0].name === 'Runtime Error') {
          logerror("[ERROR][%s][findUserByEmail][collect] %s\n%s", connection['_id'], results[0].name, results[0].message);
          callback(results[0]);
        }
        else {
          callback(null, results[0]);
        }
        connectionPool.release(connection);
      });
  });
};

/**
 * Find a user by id using the 
 * [`get`](http://www.rethinkdb.com/api/#js:selecting_data-get) function.
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

    logdebug("[INFO ][%s][findUserById] User_id: %s", connection['_id'], userId);

    connection.run(r.db(dbConfig['db']).table('users').get(userId), {})
      .collect(function(results) {
        logdebug("[INFO ][%s][findUserById][collect] %s", connection['_id'], util.inspect(results));
        if (results.length > 0) {
          callback(null, results[0]);
        }
        else {
          callback(null, null);
        }
        connectionPool.release(connection);
      });
  });
};

/**
 * Find the last `max_results` messages ordered by `timestamp`
 * using [`table`](http://www.rethinkdb.com/api/#js:selecting_data-table),
 * [`orderBy`](http://www.rethinkdb.com/api/#js:transformations-orderby) and
 * [`limit`](http://www.rethinkdb.com/api/#js:transformations-limit).
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
        logdebug('[INFO ][%s][findMessages] %j', connection['_id'], results);
        if (results.length === 0) {
          callback(null, []);
        }
        else if(results[0].name === 'Runtime Error') {
          logerror("[ERROR][%s][findMessages] %s\n%s", connection['_id'], results[0].name, results[0].message);
          callback(results[0]);
        }
        else {
          callback(null, results);
        }
        connectionPool.release(connection);
      });
  });
};


/**
 * Save a new chat message using [`insert`](http://www.rethinkdb.com/api/#js:writing_data-insert).
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

    logdebug("[INFO ][%s][saveMessage] %j", connection['_id'], msg);

    connection.run(r.db(dbConfig['db']).table('messages').insert(msg), 
      function(result) {
        logdebug("[INFO ][%s][saveMessage] result: %j", connection['_id'], result);
        if (result && result['inserted'] === 1) {
          callback(null, true);
        }
        else {
          callback(null, false);
        }

        connectionPool.release(connection);
        return false; // no need to be have this callback invoked again
      }
    );
  });
};

/**
 * Adding a new user to database using  [`insert`](http://www.rethinkdb.com/api/#js:writing_data-insert).
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

    logdebug('[INFO ][%s][saveUser] %s', connection['_id'], user);

    connection.run(r.db(dbConfig['db']).table('users').insert(user), 
      function (result) {
        logdebug('[INFO ][%s][saveUser][insert] %s', connection['_id'], util.inspect(result));
        if (result && result['inserted'] === 1) {
          callback(null, true);
        }
        else {
          callback(null, false);
        }

        connectionPool.release(connection);
        return false; // no need to be have this callback invoked again
      }
    );
  });

  // An alternative implementation that performs a check before inserting the new user.
  // 
  // r.branch(
  //     r.db('chat').table('users').filter({mail : 'abc@abc.com'}).count().eq(0),
  //     r.expr([null]),
  //     r.expr([]))
  //   .forEach(function(obj) { return r.db('chat').table('users').insert({mail: 'awesome'}); }).run()
};

/**
 * A wrapper function for the RethinkDB API that makes it follow a bit closer
 * the node.js conventions. 
 * (see [Issue #221](https://github.com/rethinkdb/rethinkdb/issues/221)). 
 */ 
function connect(callback) {
  connectionPool.acquire(function(err, connection) {
    if(err) { 
      return callback(err) 
    }
    else {
      callback(null, connection);
    }
  });
  // r.connect({host: dbConfig['host'] || 'localhost', port: dbConfig['port'] || 28015 }, 
  //   function(connection){
  //     connection['_id'] = Math.floor(Math.random()*10001);
  //     return callback(null, connection);
  //   }, 
  //   function() {
  //     var errMsg = util.format("Failed connecting to RethinkDB instance on {host: %s, port: %s}", dbConfig['host'] || localhost, dbConfig['port'] || 28015);
  //     return callback(new Error(errMsg));
  //   });
}

/**
 * Just a generic callback to log results.
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
