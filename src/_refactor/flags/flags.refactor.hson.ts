// flags.refactor.hson.ts

export const USE_NEW_JSON = false;
export const USE_NEW_HTML = false;
export const USE_NEW_HSON = false;

export const SHADOW_JSON: boolean = Boolean((globalThis as any).test_new); 