// parse-external-html.utils.ts

import { sanitize_external } from "../../safety/sanitize-html.utils";
import { HsonNode } from "../../types-consts/node.types";
import { _throw_transform_err } from "../../utils/sys-utils/throw-transform-err.utils";
import { parse_html } from "./parse-html.new.transform";

/**
 * Parse untrusted HTML into a sanitized HsonNode tree.
 * - Uses DOMPurify via sanitize_external
 * - Then uses the normal parse_html to build nodes
 */
export function parse_external_html(raw: string): HsonNode {
  const safeHtml = sanitize_external(raw);

  //  if sanitizer nuked everything, fail with a clearer reason
  if (!safeHtml.trim()) {
    _throw_transform_err(
      "parse_external_html(): all content removed by sanitizer (forbidden tags/attrs only).",
      "parse_external_html",
      raw.slice(0, 200)
    );
  }

  return parse_html(safeHtml);
}
