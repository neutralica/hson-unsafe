// append.tree.ts


import { is_Node } from "../../../utils/node-utils/node-guards.new.utils";
import { unwrap_root_elem } from "../../../utils/html-utils/unwrap-root-elem.new.utils";
import { STR_TAG, ELEM_TAG } from "../../../types-consts/constants";
import { HsonNode } from "../../../types-consts/node.new.types";
import { create_live_tree } from "../create-live-tree.tree";
import { LiveTree } from "../live-tree-class.new.tree";
import { CREATE_NODE } from "../../../types-consts/factories";
import { make_string } from "../../../utils/primitive-utils/make-string.nodes.utils";
import { _throw_transform_err } from "../../../utils/sys-utils/throw-transform-err.utils";
import { getElementForNode } from "../../../utils/tree-utils/node-map-helpers.utils";

/**
 * Parses content and appends it as a child to each node in the current selection.
 * This method ADDS to the end of the existing content, it does not replace it.
 *
 * @param $content The content to append.
 * @returns The current LiveTree instance for chaining.
 */
export function append(this: LiveTree, $content: Partial<HsonNode> | string | LiveTree): LiveTree {
  const selectedNodes = (this as any).selectedNodes as HsonNode[];

  let nodesToAppend: HsonNode[];
  if (typeof $content === 'string') {
    nodesToAppend = [CREATE_NODE({ _tag: STR_TAG, _content: [$content] })];
  } else if ($content instanceof LiveTree) {
    const sourceNodes = $content.sourceNode(true) as HsonNode[];
    nodesToAppend = unwrap_root_elem(sourceNodes);
  } else if (is_Node($content)) {
    nodesToAppend = unwrap_root_elem($content);
  } else {
    _throw_transform_err('[ERR] invalid content provided', 'append', make_string($content));
  }

  for (const targetNode of selectedNodes) {
    if (!targetNode._content) targetNode._content = [];

    // [CHANGED] find existing _elem container; if none, create an EMPTY one
    //           (do not lift/migrate existing siblings into it)
    let containerNode: HsonNode | undefined = undefined;
    const firstChild = targetNode._content[0];
    if (is_Node(firstChild) && firstChild._tag === ELEM_TAG) {
      containerNode = firstChild;
    } else {
      containerNode = CREATE_NODE({ _tag: ELEM_TAG, _content: [] }); // empty
      // prepend container once; leave existing content as-is after it
      targetNode._content = [containerNode, ...targetNode._content];
    }

    // push into data model
    containerNode._content!.push(...nodesToAppend);

    // DOM sync: simply append whatever the factory returns
    const liveElement = getElementForNode(targetNode);
    if (liveElement) {
      for (const newNode of nodesToAppend) {
        const dom = create_live_tree(newNode); // Node (Element or Fragment)
        // NOTE: create_live_tree_NEW now calls mapSet internally per Element it creates
        liveElement.appendChild(dom);
      }
    }
  }
  return this;
}

export function nextFrame(): Promise<void> {
  // resolves right before the next paint
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

export async function after_paint(): Promise<void> {
  // ensures at least one paint between awaits
  await nextFrame();
  await nextFrame();
}