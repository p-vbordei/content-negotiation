# content-negotiation

[![ci](https://github.com/p-vbordei/content-negotiation/actions/workflows/ci.yml/badge.svg)](https://github.com/p-vbordei/content-negotiation/actions/workflows/ci.yml)

[![npm](https://img.shields.io/npm/v/content-negotiation.svg)](https://www.npmjs.com/package/content-negotiation)
[![downloads](https://img.shields.io/npm/dm/content-negotiation.svg)](https://www.npmjs.com/package/content-negotiation)
[![bundle](https://img.shields.io/bundlejs/size/content-negotiation)](https://bundlejs.com/?q=content-negotiation)

> Parse `Accept`, `Accept-Language`, `Accept-Encoding` HTTP headers and pick the best representation you can serve. Zero dependencies.

```ts
import { pickMediaType, pickLanguage, pickEncoding } from "content-negotiation";

pickMediaType(req.headers.accept, ["text/html", "application/json"]);
pickLanguage(req.headers["accept-language"], ["en", "ro", "fr"]);
pickEncoding(req.headers["accept-encoding"], ["gzip", "br", "identity"]);
```

## Install

```sh
npm install content-negotiation
```

Works with Node 20+, browsers, Bun, Deno. ESM + CJS.

## Why

Every web framework has to handle "what format should I respond in?" The classic `negotiator` library is CJS-only, untyped, and has an awkward constructor-based API. `content-negotiation` is ~150 lines, ESM, fully typed, and the API is *"pass header + options, get the answer."*

The matching logic respects:

- `q=` quality factors
- Wildcards (`*/*`, `type/*`, `*`)
- Specificity preference (exact match wins over wildcard at equal `q`)
- Client preference order over server order
- `identity` encoding implicit acceptability per RFC 7231

## Recipes

### JSON-or-HTML API endpoint

```ts
import { pickMediaType } from "content-negotiation";

function respond(req, res, data) {
  const want = pickMediaType(req.headers.accept, ["application/json", "text/html"]);

  if (want === "application/json") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(renderHTML(data));
  }
}
```

### i18n routing

```ts
import { pickLanguage } from "content-negotiation";

const SUPPORTED = ["en", "ro", "fr", "de"];

function detectLocale(req): string {
  return pickLanguage(req.headers["accept-language"], SUPPORTED) ?? "en";
}
```

### Compression based on Accept-Encoding

```ts
import { pickEncoding } from "content-negotiation";
import { gzipSync, brotliCompressSync } from "node:zlib";

function compressBody(req, res, body: Buffer) {
  const enc = pickEncoding(req.headers["accept-encoding"], ["br", "gzip", "identity"]);

  if (enc === "br") {
    res.setHeader("Content-Encoding", "br");
    return brotliCompressSync(body);
  }
  if (enc === "gzip") {
    res.setHeader("Content-Encoding", "gzip");
    return gzipSync(body);
  }
  return body;
}
```

### Inspect what the client asked for

```ts
import { parseAccept } from "content-negotiation";

const entries = parseAccept(req.headers.accept);
// [
//   { value: "text/html", quality: 1, index: 0, params: {} },
//   { value: "application/json", quality: 0.8, index: 1, params: {} },
//   { value: "*/*", quality: 0.5, index: 2, params: {} },
// ]
```

### Server-preference for ties

```ts
import { pickMediaType } from "content-negotiation";

// Client sends `Accept: */*` (no preference)
// Server lists in priority order:
pickMediaType("*/*", ["application/json", "text/html"]);  // → "application/json"
pickMediaType("*/*", ["text/html", "application/json"]);  // → "text/html"
```

## API

### Picking

| Function | Description |
|---|---|
| `pickMediaType(header, available)` | Picks the best media type. Handles `*/*` and `type/*` wildcards. |
| `pickLanguage(header, available)` | Picks the best language tag. Prefix matching — `"en"` accepts `"en-US"`. |
| `pickEncoding(header, available)` | Picks the best encoding. `identity` implicit per RFC 7231 unless `identity; q=0`. |

All return `null` when nothing offered is acceptable. When the header is absent or empty, they return the first available option (server's preferred default).

### Parsing

| Function | Description |
|---|---|
| `parseAccept(header)` | Returns sorted `AcceptEntry[]` (quality desc, original-order tiebreak) |
| `parseAcceptLanguage(header)` | Same shape |
| `parseAcceptEncoding(header)` | Same shape |

```ts
type AcceptEntry = {
  value: string;
  quality: number;       // 0..1
  index: number;         // original order in the header
  params: Record<string, string>;  // any extra ;key=value parameters
};
```

## Matching algorithm

1. Iterate **client entries** in preference order (quality desc, then client-listed order)
2. For each client entry, find the first matching server offering with the highest specificity (exact > `type/*` > `*/*`)
3. Tiebreak by server-list order

Client preference always wins over server preference at equal quality.

## Caveats

- **No charset / `q` interaction with `text/*; charset=...`.** Charset is ignored — most clients no longer use it.
- **Quality `q=0` excludes a representation.** Per spec, but easy to miss when debugging.

## License

Apache-2.0 © Vlad Bordei
