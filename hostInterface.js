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
    get: trie.get.bind(trie),
    put: put.bind(trie),
    del: del.bind(trie),
    batch: batch.bind(trie),
    checkpoint: trie.checkpoint.bind(trie),
    commit: trie.commit.bind(trie),
    revert: trie.revert.bind(trie),
    createReadStream: trie.createReadStream.bind(trie),
  })

  rpc.on('data', function (data) {
    console.log('host rpc: '+data.toString())
  })

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

// sets the value and returns the new root
function put(key, value, cb){
  this.put(key, value, function(){
    cb(null, this.root)
  }.bind(this))
}

// removes the value and returns the new root
function del(key, value, cb){
  this.del(key, value, function(){
    cb(null, this.root)
  }.bind(this))
}

// performs the batch operations, then return the new root
function batch(ops, cb){
  this.batch(ops, function(){
    cb(null, this.root)
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