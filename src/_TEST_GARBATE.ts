import { make_tree_selector } from "./api/livetree/make-tree-selx"
import { LiveTree } from "./types-consts"
import { CREATE_NODE } from "./types-consts/factories"

// THIS IS TEST GARBAGE DELETE IT
const tree = new LiveTree(CREATE_NODE({ _tag: 'hi' }))
const treeSelx = make_tree_selector([tree])
tree.create