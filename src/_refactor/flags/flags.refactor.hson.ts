// flags.refactor.hson.ts

export const USE_NEW_JSON = false;
export const USE_NEW_HTML = false;
export const USE_NEW_HSON = false;

export const SHADOW_TEST: boolean = Boolean((globalThis as any).test_new); 

export function SHADOW_ENABLED(): boolean {
  const g = globalThis as any;
  // supports either key you’ve used and a conventional __HSON_SHADOW__
  if (g && (g._test_ON || g.test_new || g.__HSON_SHADOW__)) return true;

  // optional Node support
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (process as any)?.env?.HSON_SHADOW;
    if (v === '1' || v === 'true') return true;
  } catch { /* ignore */ }

  return false;
}