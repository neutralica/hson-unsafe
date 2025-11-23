// // create-proxy.new.tree.hson.ts

// import { is_Object, is_Primitive } from "../../core/utils/guards.core.utils";
// import { set_attrs_safe } from "../../safety/safe-mount.safe";
// import { HsonNode } from "../../types-consts";
// import { STR_TAG, VAL_TAG, VSN_TAGS } from "../../types-consts/constants";
// import { NODE_ELEMENT_MAP } from "../../types-consts/constants";
// import { is_Node } from "../../utils/node-utils/node-guards.new.utils";
// import { getElementForNode } from "../../utils/tree-utils/node-map-helpers.utils";
// import { get_contentValue_NEW, find_child_by_tag_NEW, find_index_of_tag_NEW, update_content_NEW } from "../../utils/tree-utils/proxy-helpers.new.utils";
// import { get_semantic_child } from "../../utils/tree-utils/semantic-child.utils";
// import { strip_VSNs_NEW } from "../../utils/tree-utils/strip-vsns.new.utils";
// import { parse_json } from "../parsers/parse-json.new.transform";
// import { create_live_tree } from "./create-live-tree.tree";


// const DEBUG_UPDATE_MAP = new WeakMap<HsonNode, number>();
// /**
//  * factory function that creates a live, interactive proxy for an hsonnode tree.
//  *
//  * this is the core of the live api. it takes a static hsonnode and wraps
//  * it in a javascript proxy. the proxy's `get` and `set` handlers intercept
//  * property access to provide an intuitive, dot-notation api for querying and
//  * manipulating the data structure, which in turn triggers live dom updates.
//  *
//  * @param {HsonNode} targetNode - the root hsonnode of the data structure to make interactive.
//  * @returns {hson_proxy} a new proxy object providing a stateful interface to the data.
//  * @example
//  * const data = hson.liveTree(myDomElement);
//  * const mainTitle = data.header.h1; // gets content
//  * data.header.h1 = 'a new title'; // sets content and updates the dom
//  */

// /* TODO create HsonProxy type */
// export function create_proxy(targetNode: HsonNode): any {
//     const handler: ProxyHandler<HsonNode> = {
//         /**
//          * GET 
//          * query handler
//          */
//         get(targetNode, propertyKey, receiver) {
//             if (propertyKey === '_withNodes') {
//                 return targetNode;
//             }
//             if (propertyKey === 'toJSON') {
//                 return () => strip_VSNs_NEW(targetNode);

//             }
//             if (typeof propertyKey !== 'string') {
//                 return Reflect.get(targetNode, propertyKey, receiver);
//             }
//             if (targetNode._tag === STR_TAG || targetNode._tag === VAL_TAG) {
//                 return targetNode._content[0];
//             }

//             /*  try to access as an attribute */
//             if (targetNode._attrs && propertyKey in targetNode._attrs) {
//                 return targetNode._attrs[propertyKey];
//             }


//             /* lookup child nodes with that tag */
//             const children = get_semantic_child(targetNode);

//             /* find direct child with a matching tag */
//             const childNode = children.find(
//                 (c): c is HsonNode => is_Node(c) && c._tag === propertyKey
//             );

//             if (childNode) {
//                 const primitive = get_contentValue_NEW(childNode);
//                 return primitive !== null ? primitive : create_proxy(childNode);
//             }

//             return undefined;
//         },

//         /**
//          * SET
//          * data binding & DOM sync
//          */
//         set(targetNode, propertyKey, value) {
//             if (typeof propertyKey !== 'string') return false;

//             /*  HsonNode creation/replacement logic */
//             if (is_Object(value)) {
//                 const jsonToParse = JSON.stringify({ [propertyKey]: value });
//                 const newTree = parse_json(jsonToParse);
//                 const newNode = find_child_by_tag_NEW(newTree, propertyKey);

//                 if (!newNode) {
//                     console.error(`[proxy.set ERROR] failed to parse new node structure for <${propertyKey}>`);
//                     return false;
//                 }

//                 const hsonContainer =
//                     (targetNode._content ?? [])
//                         .filter(is_Node)                  // CHANGED: now HsonNode_NEW[]
//                         .find((n: unknown) => is_Node(n) && VSN_TAGS.includes(n._tag));
//                 if (!hsonContainer) return false;

//                 const priorIndex = find_index_of_tag_NEW(targetNode, propertyKey);
//                 const priorNode = priorIndex > -1 ? hsonContainer._content[priorIndex] : undefined;

//                 if (priorIndex > -1) {
//                     hsonContainer._content.splice(priorIndex, 1, newNode);
//                 } else {
//                     hsonContainer._content.push(newNode);
//                 }
//                 if (targetNode._tag === 'body') {
//                     const timestamp = Date.now();
//                     DEBUG_UPDATE_MAP.set(targetNode, timestamp);
//                 }

//                 const parentLiveElement = getElementForNode(targetNode);
//                 if (parentLiveElement) {
//                     const newLiveElement = create_live_tree(newNode);
//                     if (is_Node(priorNode)) {
//                         const oldLiveElement = getElementForNode(priorNode);
//                         if (oldLiveElement) {
//                             oldLiveElement.replaceWith(newLiveElement);
//                         }
//                     } else {
//                         parentLiveElement.appendChild(newLiveElement);
//                     }
//                 }

//                 return true;
//             }

//             /* primitive value logic (content or attribute) */
//             if (is_Primitive(value)) {
//                 const childNodeToUpdate = find_child_by_tag_NEW(targetNode, propertyKey);
//                 if (childNodeToUpdate) {
//                     update_content_NEW(childNodeToUpdate, value);
//                     return true;
//                 } else {
//                     if (!targetNode._meta) targetNode._meta = {};
//                     if (!targetNode._attrs) targetNode._attrs = {};

//                     targetNode._attrs[propertyKey] = String(value);

//                     const liveElement = getElementForNode(targetNode);
//                     if (liveElement) {
//                         set_attrs_safe(liveElement, propertyKey, String(value));
//                     }

//                     return true;
//                 }
//             }

//             console.error(`[proxy ERROR] unhandled set operation for key '${propertyKey}'`);
//             return false;
//         }
//     };

//     return new Proxy(targetNode, handler);
// }