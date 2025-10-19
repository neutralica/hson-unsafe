// 

/**
 * Wrap <style> and <script> contents in CDATA so XML parsers won't choke.
 * - Leaves them alone if already wrapped
 * - Escapes stray "]]>" inside
 */
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
