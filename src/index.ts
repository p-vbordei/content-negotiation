export interface AcceptEntry {
  value: string;
  quality: number;
  /** Original 0-based position in the header — used for stable tie-break. */
  index: number;
  /** Extra `; key=value` parameters, normalized to lowercase keys. */
  params: Record<string, string>;
}

function parseEntries(header: string | undefined | null): AcceptEntry[] {
  if (!header) return [];
  const out: AcceptEntry[] = [];
  let i = 0;
  for (const raw of header.split(",")) {
    const piece = raw.trim();
    if (!piece) continue;
    const parts = piece.split(";").map((p) => p.trim()).filter(Boolean);
    const value = parts[0]!.toLowerCase();
    let q = 1;
    const params: Record<string, string> = {};
    for (let k = 1; k < parts.length; k++) {
      const eq = parts[k]!.indexOf("=");
      if (eq < 0) continue;
      const key = parts[k]!.slice(0, eq).trim().toLowerCase();
      const val = parts[k]!.slice(eq + 1).trim();
      if (key === "q") {
        const parsed = Number(val);
        if (Number.isFinite(parsed)) q = Math.max(0, Math.min(1, parsed));
      } else {
        params[key] = val.startsWith("\"") && val.endsWith("\"") ? val.slice(1, -1) : val;
      }
    }
    out.push({ value, quality: q, index: i++, params });
  }
  return out.filter((e) => e.quality > 0).sort(
    (a, b) => b.quality - a.quality || a.index - b.index,
  );
}

/** Parse an `Accept` header into entries sorted by quality (desc). */
export function parseAccept(header: string | undefined | null): AcceptEntry[] {
  return parseEntries(header);
}

/** Parse an `Accept-Language` header. */
export function parseAcceptLanguage(header: string | undefined | null): AcceptEntry[] {
  return parseEntries(header);
}

/** Parse an `Accept-Encoding` header. */
export function parseAcceptEncoding(header: string | undefined | null): AcceptEntry[] {
  return parseEntries(header);
}

function mediaTypeMatches(offered: string, accept: string): boolean {
  if (accept === "*/*") return true;
  if (accept === offered) return true;
  const [aType, aSub] = accept.split("/");
  const [oType, oSub] = offered.split("/");
  if (!aType || !aSub || !oType || !oSub) return false;
  if (aSub === "*") return aType === oType;
  return false;
}

/**
 * Pick the most preferred media type from `available` according to `acceptHeader`.
 * Returns `null` if no offered type is acceptable.
 *
 * `available` is in server-preference order — used as a tie-break when the
 * client expresses equal quality between multiple types.
 */
export function pickMediaType(acceptHeader: string | undefined | null, available: readonly string[]): string | null {
  if (!available.length) return null;
  const entries = parseEntries(acceptHeader);
  if (!entries.length) return available[0]!;
  // Walk client entries in preference order; first one with any offered match wins.
  for (const e of entries) {
    let best: { offered: string; serverIdx: number; specificity: number } | null = null;
    for (let s = 0; s < available.length; s++) {
      const offered = available[s]!.toLowerCase();
      if (!mediaTypeMatches(offered, e.value)) continue;
      const specificity = e.value === "*/*" ? 0 : e.value.endsWith("/*") ? 1 : 2;
      if (!best || specificity > best.specificity || (specificity === best.specificity && s < best.serverIdx)) {
        best = { offered: available[s]!, serverIdx: s, specificity };
      }
    }
    if (best) return best.offered;
  }
  return null;
}

function languageMatches(offered: string, accept: string): boolean {
  if (accept === "*") return true;
  if (accept === offered) return true;
  // Prefix match: "en" accepts "en-US"
  return offered.startsWith(`${accept}-`);
}

/**
 * Pick the most preferred language tag from `available` according to `Accept-Language`.
 * Returns `null` if no offered language is acceptable.
 */
export function pickLanguage(acceptHeader: string | undefined | null, available: readonly string[]): string | null {
  if (!available.length) return null;
  const entries = parseEntries(acceptHeader);
  if (!entries.length) return available[0]!;
  for (const e of entries) {
    let best: { offered: string; serverIdx: number; specificity: number } | null = null;
    for (let s = 0; s < available.length; s++) {
      const offered = available[s]!.toLowerCase();
      if (!languageMatches(offered, e.value)) continue;
      const specificity = e.value === "*" ? 0 : e.value === offered ? 2 : 1;
      if (!best || specificity > best.specificity || (specificity === best.specificity && s < best.serverIdx)) {
        best = { offered: available[s]!, serverIdx: s, specificity };
      }
    }
    if (best) return best.offered;
  }
  return null;
}

/**
 * Pick the most preferred encoding. `"identity"` is implicitly available at quality 1
 * unless explicitly disabled by the header (per RFC 7231 §5.3.4).
 */
/**
 * Pick the most preferred encoding. `"identity"` is implicitly available at quality 1
 * unless explicitly disabled by the header (per RFC 7231 §5.3.4).
 */
export function pickEncoding(acceptHeader: string | undefined | null, available: readonly string[]): string | null {
  if (!available.length) return null;
  if (!acceptHeader) {
    return available.find((e) => e.toLowerCase() === "identity") ?? available[0]!;
  }

  // Parse with q=0 entries preserved so we can detect explicit disabling.
  const rawEntries: Array<{ value: string; quality: number; index: number }> = [];
  let i = 0;
  for (const raw of acceptHeader.split(",")) {
    const piece = raw.trim();
    if (!piece) continue;
    const parts = piece.split(";").map((p) => p.trim()).filter(Boolean);
    const value = parts[0]!.toLowerCase();
    let q = 1;
    for (let k = 1; k < parts.length; k++) {
      const eq = parts[k]!.indexOf("=");
      if (eq < 0) continue;
      const key = parts[k]!.slice(0, eq).trim().toLowerCase();
      if (key === "q") {
        const parsed = Number(parts[k]!.slice(eq + 1).trim());
        if (Number.isFinite(parsed)) q = Math.max(0, Math.min(1, parsed));
      }
    }
    rawEntries.push({ value, quality: q, index: i++ });
  }

  const explicit = new Map<string, number>();
  let starQuality: number | undefined;
  for (const e of rawEntries) {
    if (e.value === "*") starQuality = e.quality;
    else if (!explicit.has(e.value)) explicit.set(e.value, e.quality);
  }

  const qualityFor = (enc: string): number => {
    const lower = enc.toLowerCase();
    if (explicit.has(lower)) return explicit.get(lower)!;
    if (starQuality !== undefined) return starQuality;
    // Identity is implicitly acceptable only when neither it nor `*` is mentioned.
    if (lower === "identity") return 1;
    return 0;
  };

  let best: { offered: string; quality: number; serverIdx: number } | null = null;
  for (let s = 0; s < available.length; s++) {
    const offered = available[s]!;
    const q = qualityFor(offered);
    if (q <= 0) continue;
    if (!best || q > best.quality || (q === best.quality && s < best.serverIdx)) {
      best = { offered, quality: q, serverIdx: s };
    }
  }
  return best?.offered ?? null;
}
