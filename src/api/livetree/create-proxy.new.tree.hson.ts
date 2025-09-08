// create-proxy.new.tree.hson.ts

import { is_Object, is_Primitive } from "../../core/utils/guards.core.utils.hson";
import { NODE_ELEMENT_MAP_NEW } from "../../new/types-consts/constants.new.hson";
import { HsonNode_NEW } from "../../new/types-consts/node.new.types.hson";
import { is_Node_NEW } from "../../new/utils/node-guards.new.utils.hson";
import { STR_TAG, VAL_TAG, VSN_TAGS } from "../../types-consts/constants.hson";
import { parse_json } from "../parsers/parse-json.transform.hson";
import { create_live_tree_NEW } from "./create-live-tree.new.tree.hson";
import { get_contentValue_NEW, find_child_by_tag_NEW, find_index_of_tag_NEW, update_content_NEW } from "./tree-utils/proxy-helpers.new.utils.hson";
import { get_semantic_child } from "./tree-utils/semantic-child.utils.hson";
import { strip_VSNs_NEW } from "./tree-utils/strip-vsns.new.utils.hson";




/* debug log */
let VERBOSE = false;
const $log = VERBOSE
? console.log
: () => { };

const DEBUG_UPDATE_MAP = new WeakMap<HsonNode_NEW, number>();
/**
 * factory function that creates a live, interactive proxy for an hsonnode tree.
 *
 * this is the core of the live api. it takes a static hsonnode and wraps
 * it in a javascript proxy. the proxy's `get` and `set` handlers intercept
 * property access to provide an intuitive, dot-notation api for querying and
 * manipulating the data structure, which in turn triggers live dom updates.
 *
 * @param {HsonNode_NEW} targetNode - the root hsonnode of the data structure to make interactive.
 * @returns {hson_proxy} a new proxy object providing a stateful interface to the data.
 * @example
 * const data = hson.liveTree(myDomElement);
 * const mainTitle = data.header.h1; // gets content
 * data.header.h1 = 'a new title'; // sets content and updates the dom
 */

/* TODO create HsonProxy type */
export function create_proxy_NEW(targetNode: HsonNode_NEW): any {
    const handler: ProxyHandler<HsonNode_NEW> = {
        /**
         * GET 
         * query handler
         */
        get(targetNode, propertyKey, receiver) {
            if (propertyKey === '_withNodes') {
                return targetNode;
            }
            if (propertyKey === 'toJSON') {
                return () => strip_VSNs_NEW(targetNode)?.[0];
            }
            if (typeof propertyKey !== 'string') {
                return Reflect.get(targetNode, propertyKey, receiver);
            }
            if (targetNode._tag === STR_TAG || targetNode._tag === VAL_TAG) {
                return targetNode._content[0];
            }

            /*  try to access as an attribute */
            if (targetNode._attrs && propertyKey in targetNode._attrs) {
                return targetNode._attrs[propertyKey];
            }
            

            /* lookup child nodes with that tag */
            const children = get_semantic_child(targetNode);

            /* find direct child with a matching tag */
            const childNode = children.find(
                (c): c is HsonNode_NEW => is_Node_NEW(c) && c._tag === propertyKey
            );

            if (childNode) {
                const primitive = get_contentValue_NEW(childNode);
                return primitive !== null ? primitive : create_proxy_NEW(childNode);
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
                const newNode = find_child_by_tag_NEW(newTree, propertyKey);

                if (!newNode) {
                    console.error(`[proxy.set ERROR] failed to parse new node structure for <${propertyKey}>`);
                    return false;
                }

                const hsonContainer = targetNode._content.find((c): c is HsonNode_NEW => is_Node_NEW(c) && VSN_TAGS.includes(c._tag));
                if (!hsonContainer) return false;

                const priorIndex = find_index_of_tag_NEW(targetNode, propertyKey);
                const priorNode = priorIndex > -1 ? hsonContainer._content[priorIndex] : undefined;

                if (priorIndex > -1) {
                    hsonContainer._content.splice(priorIndex, 1, newNode);
                } else {
                    hsonContainer._content.push(newNode);
                }
                if (targetNode._tag === 'body') {
                    const timestamp = Date.now();
                    $log(`(SET tagged <body> with timestamp: ${timestamp})`);
                    DEBUG_UPDATE_MAP.set(targetNode, timestamp);
                }

                $log('hson after SET:');
                if (VERBOSE) console.dir(hsonContainer._content, { depth: 5 }); 
                const parentLiveElement = NODE_ELEMENT_MAP_NEW.get(targetNode);
                if (parentLiveElement) {
                    const newLiveElement = create_live_tree_NEW(newNode);
                    if (is_Node_NEW(priorNode)) {
                        const oldLiveElement = NODE_ELEMENT_MAP_NEW.get(priorNode);
                        if (oldLiveElement) {
                            oldLiveElement.replaceWith(newLiveElement);
                        }
                    } else {
                        parentLiveElement.appendChild(newLiveElement);
                    }
                }

                $log(`[OK] replaced/created child <${propertyKey}> in <${targetNode._tag}>`);
                return true;
            }

            /* primitive value logic (content or attribute) */
            if (is_Primitive(value)) {
                const childNodeToUpdate = find_child_by_tag_NEW(targetNode, propertyKey);
                if (childNodeToUpdate) {
                    update_content_NEW(childNodeToUpdate, value);
                    $log(`[OK] successfully updated content of child <${propertyKey}> in <${targetNode._tag}>`);
                    return true;
                } else {
                    if (!targetNode._meta) targetNode._meta = {};
                    if (!targetNode._attrs) targetNode._attrs = {};

                    targetNode._attrs[propertyKey] = String(value);

                    const liveElement = NODE_ELEMENT_MAP_NEW.get(targetNode);
                    if (liveElement) {
                        liveElement.setAttribute(propertyKey, String(value));
                    }

                    $log(`[OK] successfully set attribute '${propertyKey}' on <${targetNode._tag}>`);
                    return true;
                }
            }

            console.error(`[proxy ERROR] unhandled set operation for key '${propertyKey}'`);
            return false;
        }
    };

    return new Proxy(targetNode, handler);
}