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

module.exports = HostInterface


function HostInterface (trie) {
  
  var rpc = trie._rpc = RPC({
    get: get.bind(trie),
    put: put.bind(trie),
    del: del.bind(trie),
    batch: batch.bind(trie),
    checkpoint: trie.checkpoint.bind(trie),
    commit: trie.commit.bind(trie),
    revert: trie.revert.bind(trie),
    createReadStream: trie.createReadStream.bind(trie),
  })

  // rpc.on('data', function(data){
  //   console.log('host:', data)
  // })

  Object.defineProperty(trie, 'isConnected', {
    get: function(){
      return !!trie._remote
    }
  })
  
  // new methods
  trie.createNetworkStream = createNetworkStream

  // overwrites
  superify(trie, 'copy', copy)

}

// gets the value and returns it
function get(key, cb){
  key = decode(key)
  this.get(key, function(err, value){
    if (err) return cb(err)
    cb(null, encode(value))
  }.bind(this))
}

// sets the value and returns the new root
function put(key, value, cb){
  key = decode(key)
  value = decode(value)
  this.put(key, value, function(){
    cb(null, encode(this.root))
  }.bind(this))
}

// removes the value and returns the new root
function del(key, cb){
  key = decode(key)
  this.del(key, function(){
    cb(null, encode(this.root))
  }.bind(this))
}

// performs the batch operations, then return the new root
function batch(ops, cb){
  ops = decodeOps(ops)
  this.batch(ops, function(){
    cb(null, encode(this.root))
  }.bind(this))
}

// creates a duplex stream for networking
function createNetworkStream(){
  var rpc = this._rpc
  // var dup = through2()
  // dup.pipe(rpc).pipe(dup)
  // dup.on('data', function(){
  //   console.log('host: '+data.toString())
  // })
  return rpc
}

// adds the interface when copying the trie
function copy(_super) {
  var trie = _super()
  HostInterface(trie)
  return trie
}

// util

function superify(trie, key, fn){
  var _super = trie[key].bind(trie)
  trie[key] = fn.bind(trie, _super)
}

function noop(){}

function encode(value){
  return value && value.toString('binary')
}

function decode(value){
  return new Buffer(value, 'binary')
}

function decodeOps(ops) {
  return ops.map(function(op){
    return {
      type: op.type,
      key: decode(op.key),
      value: decode(op.value),
    }
  })
}