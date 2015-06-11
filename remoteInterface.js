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
  rpc.on('data', function (data) {
    console.log('remote rpc: '+data.toString())
  })
  trie.sem.take(noop)
  rpc.on('remote', function (remote) {
    trie.sem.leave()
    console.log('CONNECTED!:', Object.keys(remote))
    trie._remote = remote
  })

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
  //   console.log('remote: '+data.toString())
  // })
  return rpc
}

// gets from remote db
function get(_super, key, cb){
  this.sem.take(function(){
    this.sem.leave()
    var remote = this._remote
    remote.get(key, cb)
  }.bind(this))
}

// puts from remote db
function put(_super, key, value, cb){
  this.sem.take(function(){
    this.sem.leave()
    var remote = this._remote
    console.log('PUT:', key.toString())
    remote.put(key, value, function(err, root){
      this.root = root
    }.bind(this))
  }.bind(this))
}

function del(_super, key, cb){
  this.sem.take(function(){
    this.sem.leave()
    var remote = this._remote
    remote.del(key, cb)
  }.bind(this))
}

function batch(_super, ops, cb){
  this.sem.take(function(){
    this.sem.leave()
    var remote = this._remote
    remote.batch(key, cb)
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