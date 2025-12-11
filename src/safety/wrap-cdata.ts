// wrap-cdata.ts

/***************************************************************
 * wrap_cdata
 *
 * Wrap `<style>` and `<script>` contents in CDATA sections so
 * XML/XHTML parsers can accept otherwise illegal text, while
 * leaving already-wrapped blocks alone.
 *
 * Transform, roughly:
 *   - `<style>body { color: red; }</style>`
 *       → `<style><![CDATA[body { color: red; }]]></style>`
 *
 *   - `<script>if (x]]>y) {...}</script>`
 *       → `<script><![CDATA[if (x]]]]><![CDATA[>y) {...}]]></script>`
 *         (embedded `]]>` is split so the outer CDATA stays valid)
 *
 * Behavior:
 *   - For each `<style ...>...</style>` and `<script ...>...</script>`
 *     match (case-insensitive):
 *       1. Extract `attrs` and inner `body`.
 *       2. Trim the body for inspection.
 *       3. If it already contains `<![CDATA[`, return it unchanged.
 *       4. Otherwise:
 *            - replace every `]]>` inside the body with
 *              `]]]]><![CDATA[>` to break nested closers.
 *            - wrap the result with `<![CDATA[ ... ]]>`.
 *
 * Notes:
 *   - This is designed for XML/XHTML serialization where the
 *     content of `<script>` and `<style>` is treated as normal
 *     parsed character data, not HTML raw-text.
 *   - In text/html mode, CDATA markers are ignored by browsers,
 *     so this is mostly about keeping XML tools happy without
 *     changing browser behavior.
 *
 * Limitations:
 *   - Uses regex-based matching for `<style>` / `<script>`; it
 *     assumes reasonably well-formed tags and does not handle
 *     extremely malformed markup.
 *   - Operates on the full string; call this after higher-level
 *     HTML generation rather than on random fragments.
 *
 * @param input  HTML or XHTML string containing style/script
 *               blocks.
 * @returns      A string where style/script bodies are wrapped
 *               in CDATA and any embedded `]]>` are safely split.
 ***************************************************************/
export function wrap_cdata(input: string): string {
  return input
    // handle <style> blocks
    .replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (full, attrs, body) => {
      const content = body.trim();
      if (/<!\[CDATA\[/.test(content)) return full; // already wrapped
      const safe = content.replace(/]]>/g, ']]]]><![CDATA[>'); // split embedded closers
      return `<style${attrs}><![CDATA[${safe}]]></style>`;
    })
    // handle <script> blocks
    .replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, body) => {
      const content = body.trim();
      if (/<!\[CDATA\[/.test(content)) return full;
      const safe = content.replace(/]]>/g, ']]]]><![CDATA[>');
      return `<script${attrs}><![CDATA[${safe}]]></script>`;
    });
}
