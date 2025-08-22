// bucket-diffs.hson.ts

// minimal path bucketer: strips indices and groups by stable tail
export function bucket_diffs(diffs: string[], topN = 5): Array<[string, number]> {
  const counts = new Map<string, number>();

  for (const d of diffs) {
    // take path before the first colon
    const path = d.split(":")[0];

    // remove array indices like [12]
    const noIx = path.replace(/\[\d+\]/g, "");

    // prefer tail under _attrs.* or _meta.* if present
    const mAttrs = noIx.match(/(\._attrs\.[^]+)$/);
    const mMeta  = noIx.match(/(\._meta\.[^]+)$/);

    let key = mAttrs?.[1] ?? mMeta?.[1];

    if (!key) {
      // otherwise, take the last two segments
      const parts = noIx.split(".").filter(Boolean);
      key = parts.slice(-2).join(".");
    }

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, topN);
}