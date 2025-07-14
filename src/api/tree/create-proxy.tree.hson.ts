import { HsonNode } from "../../types-consts/base.types.hson.js";
import { STRING_TAG, PRIM_TAG, VSNContainerTags, OBJECT_TAG, ARRAY_TAG, INDEX_TAG, BLANK_META, NODE_ELEMENT_MAP } from "../../types-consts/constants.types.hson.js";
import { is_Node, is_BasicValue, is_Object } from "../../utils/is-helpers.utils.hson.js";
import { parse_json } from "../parsers/parse-json.transform.hson.js";
import { find_child_by_tag, find_index_of_tag, get_contentValue, update_content } from "../../utils/tree-utils/proxy-helpers.tree.hson.js";
import { create_live_tree } from "./create-live-tree.tree.hson.js";
import { getSemanticChildren } from "../../utils/tree-utils/semantic-child.tree.hson.js";
import { strip_VSNs } from "./strip-vsns.tree.hson.js";


/* debug log */
let VERBOSE = false;
const $log = VERBOSE
? console.log
: () => { };

const DEBUG_UPDATE_MAP = new WeakMap<HsonNode, number>();
/**
 * factory function that creates a live, interactive proxy for an hsonnode tree.
 *
 * this is the core of the live api. it takes a static hsonnode and wraps
 * it in a javascript proxy. the proxy's `get` and `set` handlers intercept
 * property access to provide an intuitive, dot-notation api for querying and
 * manipulating the data structure, which in turn triggers live dom updates.
 *
 * @param {HsonNode} targetNode - the root hsonnode of the data structure to make interactive.
 * @returns {hson_proxy} a new proxy object providing a stateful interface to the data.
 * @example
 * const data = hson.liveTree(myDomElement);
 * const mainTitle = data.header.h1; // gets content
 * data.header.h1 = 'a new title'; // sets content and updates the dom
 */

/* TODO create HsonProxy type */
export function create_proxy(targetNode: HsonNode): any {
    const handler: ProxyHandler<HsonNode> = {
        /**
         * GET 
         * query handler
         */
        get(targetNode, propertyKey, receiver) {
            if (propertyKey === '_withNodes') {
                return targetNode;
            }
            if (propertyKey === 'toJSON') {
                return () => strip_VSNs(targetNode)?.[0];
            }
            if (typeof propertyKey !== 'string') {
                return Reflect.get(targetNode, propertyKey, receiver);
            }
            if (targetNode.tag === STRING_TAG || targetNode.tag === PRIM_TAG) {
                return targetNode.content[0];
            }

            /*  try to access as an attribute */
            if (targetNode._meta?.attrs && propertyKey in targetNode._meta.attrs) {
                return targetNode._meta.attrs[propertyKey];
            }
            
            /* (...flags???) */

            /* lookup child nodes with that tag */
            const children = getSemanticChildren(targetNode);

            /* find direct child with a matching tag */
            const childNode = children.find(
                (c): c is HsonNode => is_Node(c) && c.tag === propertyKey
            );

            if (childNode) {
                const primitive = get_contentValue(childNode);
                return primitive !== null ? primitive : create_proxy(childNode);
            }

            return undefined;
        },

        /**
         * SET
         * data binding & DOM sync
         */
        set(targetNode, propertyKey, value) {
            if (typeof propertyKey !== 'string') return false;

            /*  HsonNode creation/replacement logic */
            if (is_Object(value)) {
                const jsonToParse = JSON.stringify({ [propertyKey]: value });
                const newTree = parse_json(jsonToParse);
                const newNode = find_child_by_tag(newTree, propertyKey);

                if (!newNode) {
                    console.error(`[proxy.set ERROR] failed to parse new node structure for <${propertyKey}>`);
                    return false;
                }

                const hsonContainer = targetNode.content.find((c): c is HsonNode => is_Node(c) && VSNContainerTags.includes(c.tag));
                if (!hsonContainer) return false;

                const priorIndex = find_index_of_tag(targetNode, propertyKey);
                const priorNode = priorIndex > -1 ? hsonContainer.content[priorIndex] : undefined;

                if (priorIndex > -1) {
                    hsonContainer.content.splice(priorIndex, 1, newNode);
                } else {
                    hsonContainer.content.push(newNode);
                }
                if (targetNode.tag === 'body') {
                    const timestamp = Date.now();
                    $log(`(SET tagged <body> with timestamp: ${timestamp})`);
                    DEBUG_UPDATE_MAP.set(targetNode, timestamp);
                }

                $log('hson after SET:');
                if (VERBOSE) console.dir(hsonContainer.content, { depth: 5 }); 
                const parentLiveElement = NODE_ELEMENT_MAP.get(targetNode);
                if (parentLiveElement) {
                    const newLiveElement = create_live_tree(newNode);
                    if (is_Node(priorNode)) {
                        const oldLiveElement = NODE_ELEMENT_MAP.get(priorNode);
                        if (oldLiveElement) {
                            oldLiveElement.replaceWith(newLiveElement);
                        }
                    } else {
                        parentLiveElement.appendChild(newLiveElement);
                    }
                }

                $log(`[OK] replaced/created child <${propertyKey}> in <${targetNode.tag}>`);
                return true;
            }

            /* primitive value logic (content or attribute) */
            if (is_BasicValue(value)) {
                const childNodeToUpdate = find_child_by_tag(targetNode, propertyKey);
                if (childNodeToUpdate) {
                    update_content(childNodeToUpdate, value);
                    $log(`[OK] successfully updated content of child <${propertyKey}> in <${targetNode.tag}>`);
                    return true;
                } else {
                    if (!targetNode._meta) targetNode._meta = BLANK_META;
                    if (!targetNode._meta.attrs) targetNode._meta.attrs = {};

                    targetNode._meta.attrs[propertyKey] = String(value);

                    const liveElement = NODE_ELEMENT_MAP.get(targetNode);
                    if (liveElement) {
                        liveElement.setAttribute(propertyKey, String(value));
                    }

                    $log(`[OK] successfully set attribute '${propertyKey}' on <${targetNode.tag}>`);
                    return true;
                }
            }

            console.error(`[proxy ERROR] unhandled set operation for key '${propertyKey}'`);
            return false;
        }
    };

    return new Proxy(targetNode, handler);
}