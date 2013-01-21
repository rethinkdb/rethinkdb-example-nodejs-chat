// RethinkDB database settings
var dbConfig = {
  'host': '192.168.0.7',
  'port': 38015,
  'db'  : 'chat',
  'tables': {
    'messages': 'id',
    'cache': 'cid',
    'users': 'id'
  }
};

var r = require('rethinkdb')
  , util = require('util')
  , assert = require('assert');


/**
 * Connect to RethinkDB instance and perform basic setup:
 *
 * - create the `chat` database
 * - create tables `messages`, `cache`, `users` in the `chat` database (defined in `dbConfig`)
 */
module.exports.setup = function() {
  connect(function (err, connection) {
    assert.ok(err === null, err);

    console.log('[INFO ][%s] RethinkDB new database `%s` setup', connection['_id'], dbConfig['db']);
    
    // Create the db if we don't have it (will not overwrite).
    connection.run(r.dbCreate(dbConfig['db']), logConnectionResults(connection));

    // Set up all tables
    for (var i in dbConfig['tables']) {
      connection.run(r.db(dbConfig['db']).tableCreate({tableName: i, primaryKey: dbConfig['tables'][i]}), logConnectionResults(connection));
    }

    connection.close();
    console.log('[INFO ][%s] RethinkDB db `%s` setup completed.', connection['_id'], dbConfig['db']);
  });
};

/**
 * Find a user by email by using the `filter` function.
 *
 * @param mail string
 *    the email of the user that we search for
 */
module.exports.findUserByEmail = function (mail, callback) {
  connect(function (err, connection) {
    if (err) { return callback(err); }

    console.log("[DEBUG][%s][findUserByEmail] Login {user: %s, pwd: 'you really thought I'd log it?'}", connection['_id'], mail);

    connection.run(r.db(dbConfig['db']).table('users').filter({'mail': mail}).limit(1), {})
      .collect(function (results) {
        console.log("[DEBUG][%s][findUserByEmail][collect] %s", connection['_id'], util.inspect(results));
        if (results.length === 0) {
          return callback(null, null);
        }
        if(results[0].name === 'Runtime Error') {
          console.error("[ERROR][%s][findUserByEmail][collect] %s\n%s", connection['_id'], results[0].name, results[0].message);
          return callback(results[0], null);
        }
        else {
          return callback(null, results[0]);
        }
      });
  });
};

/**
 * Find a user by id using the `get` function.
 *
 * @param userId string
 *    The ID of the user to be retrieved.
 */
module.exports.findUserById = function (userId, callback) {
  connect(function (err, connection) {
    if (err) { return callback(err); }

    console.log("[DEBUG][%s][findUserById] User_id: %s", connection['_id'], userId);

    connection.run(r.db(dbConfig['db']).table('users').get(userId), {})
      .collect(function(results) {
        console.log("[DEBUG][%s][findUserById][collect] %s", connection['_id'], util.inspect(results));
        if (results.length > 0) {
          callback(null, results[0]);
        }
        else {
          callback(null, null);
        }
      });
  });
};

/**
 * Find the last `max_results` messages ordered by `timestamp`
 *
 * @param max_results int
 *    Maximum number of results to be retrieved from the db
 */
module.exports.findMessages = function (max_results, callback) {
  connect(function (err, connection) {
    if (err) { return callback(err); }

    connection.run(r.db(dbConfig['db']).table('messages').orderBy(r.desc('timestamp')).limit(max_results), {})
      .collect(function (results) {
        console.log('[DEBUG][%s][findMessages] %j', connection['_id'], results);
        if (results.length === 0) {
          return callback(null, []);
        }
        if(results[0].name === 'Runtime Error') {
          console.error("[ERROR][%s][findMessages] %s\n%s", connection['_id'], results[0].name, results[0].message);
          return callback(results[0], null);
        }
        else {
          return callback(null, results);
        }
      });
  });
};


/**
 * Save a new message
 *
 * @param msg JSON
 *    The message to be saved
 * @param callback function
 *    Callback function
 */
module.exports.saveMessage = function (msg, callback) {
  connect(function (err, connection) {
    if (err) { return callback(err); }

    console.log("[DEBUG][%s][saveMessage] %j", connection['_id'], msg);

    connection.run(r.db(dbConfig['db']).table('messages').insert(msg), 
      function(result) {
        console.log("[DEBUG][%s][saveMessage] result: %j", connection['_id'], result);
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
 * Adding a new user to database.
 *
 * @param user JSON
 *   The user JSON object to be saved.
 * @param callback function
 *   Callback function
 */
module.exports.saveUser = function (user, callback) {  
  connect(function (err, connection) {
    if(err) { return callback(err); }

    console.log('[DEBUG][%s][saveUser] %s', connection['_id'], user);

    connection.run(r.db(dbConfig['db']).table('users').insert(user), 
      function (result) {
        console.log('[DEBUG][%s][saveUser][insert] %s', connection['_id'], util.inspect(result));
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

  // r.branch(
  //     r.db('chat').table('users').filter({mail : 'abc@abc.com'}).count().eq(0),
  //     r.expr([null]),
  //     r.expr([]))
  //   .forEach(function(obj) { return r.db('chat').table('users').insert({mail: 'awesome'}); }).run()
};

function connect(callback) {
  r.connect({host: dbConfig['host'] || 'localhost', port: dbConfig['port'] || 28015 }, 
    function(connection){
      connection['_id'] = Math.floor(Math.random()*10001);
      return callback(null, connection);
    }, 
    function() {
      var errMsg = util.format("Failed connecting to RethinkDB instance on {host: %s, port: %s}", dbConfig['host'] || localhost, dbConfig['port'] || 28015);
      return callback(new Error(errMsg), null);
    });
}

/**
 * Just a generic callback logging results.
 */
var logConnectionResults = function (connection) {
  var fn = function (result) {
    // Just empty for now. Could be logging like the following:
    if(result === undefined) {
      console.warn("[WARN][%s][lcr] undefined parameter", connection['_id']);
      return true;
    }
    if(result && result['name'] === 'Runtime Error') {
      console.error("[ERROR][%s][lcr] %s: \n%s", connection['_id'], result['name'], result['message']);
      return false;
    }
    else {
      console.log("[DEBUG][%s][lcr] %s", connection['_id'], util.inspect(result));    
    }
    return true;
  }

  return fn;
}
