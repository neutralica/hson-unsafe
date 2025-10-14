// split-top-level.hson.util.ts

/**
 * splits a string by a separator, respecting nested delimiters '[]' and '«»'
 * ignores separators found within these nested structures
 *
 * @param {string} $str - the string to split
 * @param {string} $separator - the separator character (e.g., ',')
 * @returns {string} - an array of strings, trimmed, representing the top-level segments
*/

export function split_top_level($str: string, $separator: string): string[] {
    if (!$str) return [];
    const results: string[] = [];
    let buffer = '';
    let D = { square: 0, angle: 0, hsonTag: 0, hsonList: 0 }; // Depths
    let inString: '"' | "'" | null = null;
    let escapeNextChar = false;

    for (let i = 0; i < $str.length; i++) {
        const char = $str[i];
        buffer += char;

        if (escapeNextChar) { escapeNextChar = false; continue; }
        if (char === '\\') { escapeNextChar = true; continue; }

        if (inString) {
            if (char === inString) inString = null;
            continue;
        }
        if (char === '"' || char === "'") { inString = char; continue; }

        if (char === '[') D.square++;
        else if (char === ']') D.square = Math.max(0, D.square - 1);
        else if (char === '«') D.angle++;
        else if (char === '»') D.angle = Math.max(0, D.angle - 1);
        else if (char === '<') D.hsonTag++;
        else if (char === '>') D.hsonTag = Math.max(0, D.hsonTag - 1);
        else if (char === '#') {
            /* obsolete; remove when you feel like it */
            if (!(i > 0 && $str[i - 1] === '/')) { 
                D.hsonList++;
            }
        } else if (char === '/') {
            if (i + 1 < $str.length && $str[i + 1] === '#') { 
                D.hsonList = Math.max(0, D.hsonList - 1);
            }
        }

        if (char === $separator &&
            D.square === 0 && D.angle === 0 &&
            D.hsonTag === 0 && D.hsonList === 0 &&
            !inString) {
            results.push(buffer.slice(0, -1).trim());
            buffer = '';
        }
    }
    if (buffer || (results.length === 0 && $str.length > 0)) results.push(buffer.trim());

    /* filter to keep intentional empty strings if needed, otherwise should filter all */
    if ($str === "") return [];
    return results.filter(item => item !== "");
}