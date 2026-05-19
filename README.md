# content-negotiation

[![ci](https://github.com/p-vbordei/content-negotiation/actions/workflows/ci.yml/badge.svg)](https://github.com/p-vbordei/content-negotiation/actions/workflows/ci.yml)

[![npm](https://img.shields.io/npm/v/content-negotiation.svg)](https://www.npmjs.com/package/content-negotiation)
[![downloads](https://img.shields.io/npm/dm/content-negotiation.svg)](https://www.npmjs.com/package/content-negotiation)
[![bundle](https://img.shields.io/bundlejs/size/content-negotiation)](https://bundlejs.com/?q=content-negotiation)

Parse `Accept`, `Accept-Language`, `Accept-Encoding` HTTP headers and pick the best representation you can serve. Zero dependencies, modern API, types included.

```ts
import {
  pickMediaType,
  pickLanguage,
  pickEncoding,
  parseAccept,
} from "content-negotiation";

pickMediaType(req.headers.accept, ["text/html", "application/json"]);
// → "text/html" or "application/json" or null

pickLanguage(req.headers["accept-language"], ["en", "ro", "fr"]);
// → "ro" if request prefers Romanian

pickEncoding(req.headers["accept-encoding"], ["gzip", "br", "identity"]);
// → "br" if client accepts and prefers it
```

## Install

```sh
npm install content-negotiation
```

## API

### Picking

| Function | Description |
|---|---|
| `pickMediaType(header, available)` | Picks the best media type. Handles `*/*` and `type/*` wildcards. Server-preference order breaks ties. |
| `pickLanguage(header, available)` | Picks the best language tag. Prefix matching — `"en"` accepts `"en-US"`. |
| `pickEncoding(header, available)` | Picks the best encoding. `identity` is implicitly acceptable per RFC 7231 unless explicitly disabled (`identity; q=0`). |

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

## Why not `negotiator`?

`negotiator` is CJS-only, has no types, and its constructor-based API is awkward in modern code. `content-negotiation` is ~150 LoC, ESM, fully typed, and the API is "pass header + options, get the answer."

## License

Apache-2.0 © Vlad Bordei
