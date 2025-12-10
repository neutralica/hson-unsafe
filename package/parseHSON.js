Lexer = require('lex');

var path, currentNode, modeObj, currMode, row, col, tempString, baseNode, nodesStack, lexer;

//First, detect the basename for the tags
var openTagRE = /<[^!\/]\s*?(.*?)\-.+?\s*?>/;
var tagNameRE = /<\/?\s*?.*?\-(.+?)\s*?>/;
var arrTagRE = /^arr-/;
var arrItemTagRE = /^item$/;

function setupLexer(base){

    lexer = new Lexer(function (char) {
        throw new Error("Unexpected character at row " + row + ", col " + col + ": " + char);
    });

    lexer.addRule(/\n/, function (it) {
        tempString.push(it);
        row++;
        col = 1;
    }, []);


    lexer.addRule(/\s/, function (it) {
        tempString.push(it);
        col++;
    }, []);

    lexer.addRule(/./, function (it) {

        tempString.push(it);

        if( currMode.mode != 'text' ){
            if( typeof currMode.mode == 'undefined' ){
                currMode.mode = "text";
            }else{
                throw "Invalid text inside a node type " + currMode.mode;
            }
        }
        
        col++;

    }, []);

    lexer.addRule(/<!--.*?-->/, function (commentContent) {
        col += commentContent.length;
    }, []);

    lexer.addRule(new RegExp("<\\s*?" + base + "-.+?\\s*?>"), function (token) {
        //opening a node
        
        col += token.length;

        var tokenName = token.match(tagNameRE)[1];

        path.push(tokenName);

        currentNode = tokenName;

        tempString = [];

        var newToken = { tokenName: tokenName };

        nodesStack[nodesStack.length-1].nodes = nodesStack[nodesStack.length-1].nodes || [];
        nodesStack[nodesStack.length-1].nodes.push(newToken);

        nodesStack.push(newToken);

        //Check parents mode if inside an array 
        if( currMode.mode == 'array' && !arrItemTagRE.test(tokenName) ){
            throw "Invalid token inside an array: " + tokenName;
        }

        //Check parents mode, if inside a text node
        if( currMode.mode == 'text' ){
            throw "Invlid token inside a text node: " + tokenName;
        }

        currMode = currMode['-' + tokenName] = { parent: currMode };

        if( arrTagRE.test(tokenName) ){
            // if this is an array, then set this mode to array
            currMode.mode = "array";
            newToken.type = "array";
        } 

    }, []);

    lexer.addRule(new RegExp("</\\s*?" + base + "-.+?\\s*?>") , function (token) {
        //closing a node
        
        var tokenName = token.match(tagNameRE)[1];

        if(currentNode != tokenName){
            throw "Invalid closing token: " + tokenName;
        }else{

            var last = nodesStack.pop();

            if(!last.nodes){ //No childs -> then it is a text node
                last.type = "text"; 
                last.text = tempString.join(''); 
            }

            path.pop();
            currentNode = path.length > 0 ? path[path.length-1] : null;
            currMode = currMode.parent;
            currMode.mode = currMode.mode || 'node';

        }

    }, []);


}


function parse(hsonStr){

    path = [];
    currentNode = null;

    //Mode can be text, node or array
    modeObj = {
        mode: 'node'
    }; 

    currMode = modeObj;

    row = 1;
    col = 1;

    tempString = [];

    baseNode = {};
    nodesStack = [];
    nodesStack.push(baseNode);


    var m = hsonStr.match(openTagRE);

    if(!m.length){
        throw "custom tag not found"
    }

    setupLexer("");

    lexer.input = hsonStr; 

    lexer.lex();

    // Build JSON structure;
    // console.log(nodesStack[0]);

    var jsObj = buildJSObject(nodesStack[0]);

    return jsObj;

}


function buildJSObject(node){

    var obj = {};

    function goDeepArr(node){
        var i, r = [];
        for(i=0;i<node.nodes.length;i++){
            r.push(goDeep(node.nodes[i]));
        }
        return r;
    }

    function goDeep(node){
        var i, ret, n, name;
        if(node.nodes){
            ret = {};
            for(i=0;i<node.nodes.length;i++){
                n=node.nodes[i];
                name = n.tokenName.length > 3 && n.tokenName.substr(0,4) == 'arr-' ? n.tokenName.substr(4) : n.tokenName;
                ret[ name ] = (n.type && n.type =="array") ? goDeepArr(n) : goDeep(n);
            }
        }else{
            //Text node
            ret = node.text;
        }
        return ret;
        
    }

    obj = goDeep(node);

    return obj;

}

module.exports = { parse: parse };
