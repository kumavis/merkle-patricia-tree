const levelup = require('levelup')
const memdown = require('memdown')
const async = require('async')
const inherits = require('util').inherits
const Readable = require('stream').Readable
const callTogether = require('./util').callTogether
const TrieNode = require('./trieNode')
const TrieReadStream = require('./readStream')
const RPC = require('multiplex-rpc')
const PassThrough = require('stream').PassThrough
const through2 = require('through2')

module.exports = RemoteInterface


function RemoteInterface (trie) {
  
  // detach from put db
  trie._putDBs = []
  
  var rpc = trie._rpc = RPC()

  // rpc.on('data', function(data){
  //   console.log('remote:', data)
  // })

  trie._remote = rpc.wrap([
    'get',
    'put',
    'del',
    'batch',
    'checkpoint',
    'commit',
    'revert',
    'createReadStream:s',
  ])

  Object.defineProperty(trie, 'isConnected', {
    get: function(){
      return !!trie._remote
    }
  })

  // new methods
  trie.createNetworkStream = createNetworkStream
  
  // overwrites
  superify(trie, 'get', get)
  superify(trie, 'put', put)
  superify(trie, 'del', del)
  superify(trie, 'batch', batch)
  superify(trie, 'checkpoint', checkpoint)
  superify(trie, 'commit', commit)
  superify(trie, 'revert', revert)
  superify(trie, 'createReadStream', createReadStream)
  superify(trie, 'copy', copy)

}

// creates a duplex stream for networking
function createNetworkStream(){
  var rpc = this._rpc
  // var dup = through2()
  // dup.pipe(rpc).pipe(dup)
  // dup.on('data', function(){
  // })
  return rpc
}

// gets from remote db
function get(_super, key, cb){
  this.sem.take(function(){
    this.sem.leave()
    var remote = this._remote
    key = encode(key)
    remote.get(key, function(err, value){
      if (err) return cb(err)
      value = value && new Buffer(value, 'binary')
      cb(null, value)
    })
  }.bind(this))
}

// puts to remote db
function put(_super, key, value, cb){
  if (!value) return this.del(key, cb)
  this.sem.take(function(){
    this.sem.leave()
    var remote = this._remote
    // encode key and value
    key = encode(key)
    value = encode(value)
    remote.put(key, value, function(err, root){
      if (err) return cb(err)
      this.root = decode(root)
      cb()
    }.bind(this))
  }.bind(this))
}

function del(_super, key, cb){
  this.sem.take(function(){
    this.sem.leave()
    var remote = this._remote
    key = encode(key)
    remote.del(key, function(err, root){
      if (err) return cb(err)
      this.root = decode(root)
      cb()
    }.bind(this))
  }.bind(this))
}

function batch(_super, ops, cb){
  // serialize ops
  ops = encodeOps(ops)
  this.sem.take(function(){
    this.sem.leave()
    var remote = this._remote
    remote.batch(ops, cb)
  }.bind(this))
}

function createReadStream(){
  var passthrough = new PassThrough()
  this.sem.take(function(){
    this.sem.leave()
    var remote = this._remote
    remote.createReadStream(function(readStream){
      readStream.pipe(passthrough)
    })
  }.bind(this))
  return passthrough
}

function checkpoint(_super){
  this.sem.take(function(){
    this.sem.leave()
    var remote = this._remote
    remote.checkpoint()
    _super()
  }.bind(this))
}

function commit(_super, cb){
  this.sem.take(function(){
    this.sem.leave()
    var remote = this._remote
    async.parallel([
      remote.commit.bind(remote),
      _super.bind(this),
    ], cb)
  }.bind(this))
}

function revert(_super, cb){
  this.sem.take(function(){
    this.sem.leave()
    var remote = this._remote
    async.parallel([
      remote.revert.bind(remote),
      _super.bind(this),
    ], cb)
  }.bind(this))
}

// adds the interface when copying the trie
// consumer must setup the remote connection
function copy(_super) {
  var trie = _super()
  RemoteInterface(trie)
  return trie
}

// util

function superify(trie, key, fn){
  var _super = trie[key].bind(trie)
  trie[key] = fn.bind(trie, _super)
}

function noop(){}

function encode(value){
  if (value && !Buffer.isBuffer(value)) {
    value = (new Buffer(value, 'utf8'))
  }
  return value && value.toString('binary')
}

function decode(value){
  return value && new Buffer(value, 'binary')
}

function encodeOps(ops) {
  return ops.map(function(op){
    return {
      type: op.type,
      key: encode(op.key),
      value: encode(op.value),
    }
  })
}