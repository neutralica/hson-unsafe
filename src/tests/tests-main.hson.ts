// tests-main.hson.ts

import { hson } from "../api/hson.js";
import { sampleHtml } from "./sample-data.tests.hson.js";

const _html = sampleHtml.articleCard;


runXtimes(_html, 5);

export function runXtimes(content: string, times: number = 3) {
    let temp = content;
    console.log('BEFORE temp')
    console.log(temp)
    for (let ix = 0; ix < times; ix++){
        console.log('1');
        temp = runHtmlLoop(temp);
    }
    console.log('AFTER temp')
    console.log(temp)

}

export function runHtmlLoop(html: string): string {
    const js = hson.transform
        .fromHTML(html)
        .toJSON()
        .serialize();
    const hs = hson.transform
        .fromJSON(js)
        .toHSON()
        .serialize();
    const ht = hson.transform
        .fromHSON(hs)
        .toHTML()
        .serialize();
    return ht;

}