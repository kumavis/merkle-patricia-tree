StateTrie = require('./index')
TrieNode = require('./trieNode')
async = require('async')
Springy = require('springy')
global.jQuery = require('jquery')
springui = require('springy/springyui')

var init = [
  { type: 'put', key: 'color', value: 'purple' },
  { type: 'put', key: 'food', value: 'sushi' },
  { type: 'put', key: 'fight', value: 'fire' },
  { type: 'put', key: 'colo', value: 'trolo' },
  { type: 'put', key: 'color', value: 'blue' },
  { type: 'put', key: 'color', value: 'pink' },
];

trie = new StateTrie()
trie.checkpoint()
trie.batch(init, function(){
  trieToJson(trie, function(err, data){
    console.log('root:', trie.root.toString('hex'))
    renderGraph(data)
    trie.commit()
  })
})

function renderGraph(data) {

  var graph = new Springy.Graph()
  var nodeMap = {}

  var edges = []
  // create nodes

  Object.keys(data).forEach(function(hash){
    var node = data[hash]
    var parentId = hash.slice(0, 12)
    
    // console.log('+', parentId)
    var nodeLabel = ''
    nodeLabel += parentId+'\n'
    nodeLabel += node.key+'\n'
    nodeLabel += '('+node.type+')'
    if (node.isRaw) nodeLabel += '(RAW)'
    if (node.value && (node.type === 'leaf' || node.type === 'branch')) {
      nodeLabel += ': '+node.value
    }
    var newNode = new Springy.Node(parentId, {label: nodeLabel})
    nodeMap[parentId] = newNode
    graph.addNode(newNode)

    edges = edges.concat(node.children.map(function(childHash){
      var childId = childHash.slice(0, 12)
      // console.log(parentId, '->', childId)
      return [parentId, childId]
    }))
  })
  // add edges
  edges.forEach(function(edge){
    graph.newEdge(nodeMap[edge[0]], nodeMap[edge[1]] || nodeMap['missing'])
  })

  jQuery('body').html('<canvas id="my_canvas" width="1000" height="900"  />')
  jQuery('#my_canvas').springy({ graph: graph })

}


// util

function trieToJson(trie, cb) {
  var data = {}
  trie._walkTrie(trie.root, function (root, node, key, walkController) {
    var hash = node.hash().toString('hex')
    var nodeData = {
      hash: hash,
      type: node.type,
      key: TrieNode.nibblesToBuffer(key.concat(node.key)).toString(),
      value: node.value && node.value.toString(),
      isRaw: TrieNode.isRawNode(root),
    }
    // add children
    async.map(node.getChildren(), function(childData, cb){
      var childRoot = childData[1]
      trie._lookupNode(childRoot, function(childNode){
        cb(null, childNode.hash().toString('hex'))
      })
    }, function(err, children){
      nodeData.children = children
      data[hash] = nodeData
      walkController.next()
    })
  }, function () {
    cb(null, data)
  })
}