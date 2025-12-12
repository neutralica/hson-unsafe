// // prettify.hson.util.ts
// /* not sure I'm using this? or even want to? */

// export function prettify(raw: string): string {
//     let indent = 0;
//     const lines: string[] = [];
  
//     /* regex matches both open <tag> and close </tag> at start */
//     const tagPattern = /(<\/?[^>]+>)/g;
  
//     raw
//       .replace(/\n/g, '') /* remove existing newlines */
//       .replace(/\s+</g, '<') /*  trim leading spaces before tags */
//       .replace(/>\s+/g, '>') /* trim trailing spaces after tags */
//       .split(tagPattern)
//       .filter(Boolean)
//       .forEach(part => {
//         if (part.startsWith('</')) {
//           indent--;
//         }
//         lines.push('  '.repeat(indent) + part);
//         if (part.startsWith('<') && !part.startsWith('</') && !part.endsWith('/>') && !/^<\w+[^>]*\/>$/.test(part)) {
//           indent++;
//         }
//       });
  
//     return lines.join('\n');
//   }
  