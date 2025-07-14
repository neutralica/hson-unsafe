// make-string.utils.hson.ts

/* more concise stringifier */
export const make_string = (json: any) => {
    return JSON.stringify(json, null, 2);
}
