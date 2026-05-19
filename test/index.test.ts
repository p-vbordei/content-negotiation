import { describe, it, expect } from "vitest";
import {
  parseAccept,
  parseAcceptLanguage,
  parseAcceptEncoding,
  pickMediaType,
  pickLanguage,
  pickEncoding,
} from "../src/index.js";

describe("parseAccept", () => {
  it("sorts by quality desc", () => {
    const entries = parseAccept("text/plain; q=0.5, text/html, application/json; q=0.8");
    expect(entries.map((e) => e.value)).toEqual(["text/html", "application/json", "text/plain"]);
  });
  it("filters out q=0", () => {
    const entries = parseAccept("text/plain; q=0, text/html");
    expect(entries.map((e) => e.value)).toEqual(["text/html"]);
  });
  it("parses extra parameters", () => {
    const entries = parseAccept("text/html; level=1; charset=utf-8");
    expect(entries[0]!.params).toEqual({ level: "1", charset: "utf-8" });
  });
  it("empty header → empty list", () => {
    expect(parseAccept("")).toEqual([]);
    expect(parseAccept(undefined)).toEqual([]);
  });
});

describe("pickMediaType", () => {
  it("picks highest-quality match", () => {
    const r = pickMediaType("text/plain; q=0.5, text/html", ["text/plain", "text/html"]);
    expect(r).toBe("text/html");
  });
  it("respects wildcards", () => {
    expect(pickMediaType("text/*", ["text/plain", "application/json"])).toBe("text/plain");
    expect(pickMediaType("*/*", ["application/json", "text/html"])).toBe("application/json");
  });
  it("prefers more specific over wildcard at same quality", () => {
    const r = pickMediaType("text/html, text/*", ["text/plain", "text/html"]);
    expect(r).toBe("text/html");
  });
  it("returns null when nothing matches", () => {
    expect(pickMediaType("application/xml", ["text/plain", "text/html"])).toBeNull();
  });
  it("no header → first available", () => {
    expect(pickMediaType(undefined, ["text/html", "application/json"])).toBe("text/html");
  });
  it("respects server preference for ties", () => {
    // Both match at q=1 via */*; server preference order wins.
    expect(pickMediaType("*/*", ["application/json", "text/html"])).toBe("application/json");
    expect(pickMediaType("*/*", ["text/html", "application/json"])).toBe("text/html");
  });
});

describe("pickLanguage", () => {
  it("exact match preferred over prefix", () => {
    expect(pickLanguage("en-US, en", ["en", "en-US"])).toBe("en-US");
  });
  it("prefix match: 'en' accepts 'en-US'", () => {
    expect(pickLanguage("en", ["en-US"])).toBe("en-US");
  });
  it("wildcard matches anything", () => {
    expect(pickLanguage("*", ["ro", "en"])).toBe("ro");
  });
  it("returns null when nothing matches", () => {
    expect(pickLanguage("fr", ["ro", "en"])).toBeNull();
  });
  it("respects quality ordering", () => {
    expect(pickLanguage("fr; q=0.5, en; q=0.9", ["fr", "en"])).toBe("en");
  });
  it("no header → first available", () => {
    expect(pickLanguage(undefined, ["ro", "en"])).toBe("ro");
  });
});

describe("pickEncoding", () => {
  it("picks highest-quality offered encoding", () => {
    expect(pickEncoding("gzip, br; q=0.9", ["gzip", "br", "identity"])).toBe("gzip");
  });
  it("identity is implicitly acceptable when no header", () => {
    expect(pickEncoding(undefined, ["gzip", "identity"])).toBe("identity");
  });
  it("respects q=0 disabling identity", () => {
    expect(pickEncoding("gzip, identity; q=0", ["gzip", "identity"])).toBe("gzip");
    expect(pickEncoding("gzip, identity; q=0", ["identity"])).toBeNull();
  });
  it("wildcard applies to unmentioned encodings", () => {
    expect(pickEncoding("gzip; q=0.5, *", ["br", "gzip"])).toBe("br");
  });
});

describe("parseAcceptLanguage / parseAcceptEncoding share parser", () => {
  it("parseAcceptLanguage works", () => {
    expect(parseAcceptLanguage("en, ro; q=0.5")[0]!.value).toBe("en");
  });
  it("parseAcceptEncoding works", () => {
    expect(parseAcceptEncoding("gzip")[0]!.value).toBe("gzip");
  });
});
