const BaseTrie = require('./baseTrie');
const CheckpointInterface = require('./checkpointInterface');
const inherits = require('util').inherits;

module.exports = FancyTrie;


inherits(FancyTrie, BaseTrie);

function FancyTrie() {
  BaseTrie.apply(this, arguments);
  CheckpointInterface(this);
}