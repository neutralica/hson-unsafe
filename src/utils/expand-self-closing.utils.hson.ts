// expand self-closing.hson.util.ts

const voidTags = [
    'area','base','br','col','embed','hr',
    'img','input','link','meta','param',
    'source','track','wbr',
  ];
  
  /* should just check />, regardless of tag? */
 export  function expand_void_tags($input: string): string {
    const tagNames = voidTags.join('|');
    /* match <img ...> or <IMG ...> but not already <img .../> */
    const regex = new RegExp(
      `<(${tagNames})(\\b[^>]*?)(?<!/)>(?!</\\1>)`,
      'gi'
    );
    return $input.replace(
      regex,
      (_match, tag, attrs) => `<${tag}${attrs} />`
    );
  }
  