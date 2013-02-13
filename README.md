# What is it #

A fork of the [node.js chat app](https://github.com/eiriksm/chat-test-2k) by [@orkj](https://twitter.com/orkj) 
using socket.io, rethinkdb, passport and bcrypt on an express app.

_Note_: this branch uses [node-pool](https://github.com/coopernurse/node-pool) for connection pooling.

# Complete stack #

* [node.js](http://nodejs.org)
* [socket.io](http://socket.io)
* [express](http://expressjs.com) and [jade](http://jade-lang.com)
* [Passport](http://passportjs.org) and [bcrypt](https://github.com/ncb000gt/node.bcrypt.js/)
* [debug](https://github.com/visionmedia/debug)
* [RethinkDB](http://www.rethinkdb.com/)
* [node-pool](https://github.com/coopernurse/node-pool)

# Installation #

```
git clone git@github.com:rethinkdb/rethinkdb-example-nodejs-chat.git
npm install
```

_Note_: If you don't have RethinkDB installed, you can follow [these instructions to get it up and running](http://www.rethinkdb.com/docs/install/). 


# Running the application #

Running the app is as simple as:

```
node app
```

Then open a browser: <http://localhost:8000>.

_Note_: If you want to override the default RethinkDB connection details, you can
specify them as environment variables:

* `RDB_HOST`: the RethinkDB host (default: `localhost`)
* `RDB_PORT`: the port (default `28015`)
* `RDB_DB`: the app database (default: `chat`)

If you want to enable logging for the database queries (see [debug docs](https://github.com/visionmedia/debug)
for more configuration options:

```
DEBUG=rdb:* node app
```

# Annotated Source Code #

After checking out the code, you can also read the annotated source [here](http://www.rethinkdb.com/docs/examples/node-socket-chat/).

# License #

This demo application is licensed under the MIT license: <http://opensource.org/licenses/mit-license.php>
