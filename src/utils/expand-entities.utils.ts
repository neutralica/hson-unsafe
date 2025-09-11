// expand-entities.hson.util.ts

const htmlNamedToNumeric: Record<string, string> = {
    copy: '&#169;',
    nbsp: '&#160;',
    eacute: '&#233;',
    /* add more if needed */
};

export function expand_entities(input: string): string {
    return input.replace(/&([a-zA-Z0-9]+);/g, (full, entity) => {
        /* leave amp, lt, gt, quot, apos alone */
        if (['amp', 'lt', 'gt', 'quot', 'apos'].includes(entity)) {
            return full;
        }
        if (entity in htmlNamedToNumeric) {
            return htmlNamedToNumeric[entity];
        }
        return full; /* unknown entity — leave unchanged (parser will error if needed) */
    });
}
