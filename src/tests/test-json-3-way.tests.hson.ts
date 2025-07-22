import { Dir } from "fs";
import { parse_html } from "../api/parsers/parse-html.transform.hson";
import { parse_json } from "../api/parsers/parse-json.transform.hson.js";
import { parse_tokens } from "../api/parsers/parse-tokens.transform.hson";
import { tokenize_hson } from "../api/parsers/tokenize-hson.transform.hson";
import { serialize_hson } from "../api/serializers/serialize-hson.render.hson";
import { serialize_html } from "../api/serializers/serialize-html.render.hson";
import { serialize_json } from "../api/serializers/serialize-json.render.hson";
import { TestResult_3Way } from "../types-consts/types.tests.hson";
import { make_string } from "../utils/make-string.utils.hson";


export function test_json_3way($inputjson: string) {

    let currentJson: string = (typeof $inputjson === 'string') ? $inputjson : make_string($inputjson);




    /* writing these out step-by-ste to track them as transparently and visibly as possible 
        cuz I don't wanna be hurt no mo            */
    function loopA($inputA: string = currentJson): TestResult_3Way  {
        try {
            /* loopA:  $inputA json to nodes   */
            const nodesA_fromJson = parse_json($inputA)
            
            /* loopA:  nodes to hson  */
            const hson_fromNodeA = serialize_hson(nodesA_fromJson);
            
            /* loopA: hson  to tokens  */
            const tokens_fromHson = tokenize_hson(hson_fromNodeA);
            
            /* loopA: tokens  to nodes  */
            const nodesB_fromTokens = parse_tokens(tokens_fromHson);
            
            /* loopA: nodes  to html  */
            const html_fromNodesB = serialize_html(nodesB_fromTokens)
            
            /* loopA: html  to nodes  */
            const nodesC_fromHtml = parse_html(html_fromNodesB);
            
            /* loopA:  nodes to json  */
            const jsonB_fromNodesC = serialize_json(nodesC_fromHtml);
            
            /* loopA: output is jsonB   */
            const output = jsonB_fromNodesC;
            
            // if (!currentJson) throw new Error();
            // if (!nodesA_fromJson) throw new Error();
            // if (!hson_fromNodeA) throw new Error();
            // if (!tokens_fromHson) throw new Error();
            // if (!nodesB_fromTokens) throw new Error();
            // if (!html_fromNodesB) throw new Error();
            // if (!nodesC_fromHtml) throw new Error();
            // if (!jsonB_fromNodesC) throw new Error();

            return {
                input: $inputA,
                hsonString: hson_fromNodeA,
                htmlString: html_fromNodesB,
                jsonString: jsonB_fromNodesC,
                output,

                nodeFromJson: nodesA_fromJson,
                nodeFromHson: nodesB_fromTokens,
                nodeFromHtml: nodesC_fromHtml,

            }

        } catch (err) {
            console.error('error in transformer loop:\n ', err);
            throw new Error('error in transformer loop:');
        }
    }

    function loopB($inputB: string = currentJson): TestResult_3Way  {
        try {
            const nodesA_fromJson = parse_json($inputB)
            const html_fromNodesA = serialize_html(nodesA_fromJson)
            const nodesB_fromHtml = parse_html(html_fromNodesA);
            const hson_fromNodesB = serialize_hson(nodesB_fromHtml);
            const tokens_fromHson = tokenize_hson(hson_fromNodesB);
            const nodesC_fromTokens = parse_tokens(tokens_fromHson);
            const jsonB_fromNodesC = serialize_json(nodesC_fromTokens);
            const output = jsonB_fromNodesC;

            // currentJson = jsonB_fromNodesC;
            if (!currentJson) throw new Error();
            if (!nodesA_fromJson) throw new Error();
            if (!html_fromNodesA) throw new Error();
            if (!nodesB_fromHtml) throw new Error();
            if (!hson_fromNodesB) throw new Error();
            if (!tokens_fromHson) throw new Error();
            if (!nodesC_fromTokens) throw new Error();
            if (!jsonB_fromNodesC) throw new Error();

            return {
                input: $inputB,
                htmlString: html_fromNodesA,
                hsonString: hson_fromNodesB,
                jsonString: jsonB_fromNodesC,
                output,

                nodeFromJson: nodesA_fromJson,
                nodeFromHtml: nodesB_fromHtml,
                nodeFromHson: nodesC_fromTokens,

            }

        } catch (err) {
            console.error('error in transformer loop:\n ', err);
            throw new Error('error in transformer loop:');
        }
    }
}


export function postResults(result: TestResult_3Way) {


    
}