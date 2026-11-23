import http from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { gzip } from "node:zlib";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { pipeline } from "node:stream/promises";

const origin = new URL(process.env.CTFUNIL_ORIGIN || "http://127.0.0.1:3130");
const host = process.env.CTFUNIL_PUBLIC_HOST;
const slugs = (process.env.CTFUNIL_CACHE_SLUGS || "").split(",").map((slug) => slug.trim());
const port = Number(process.env.CTFUNIL_CACHE_PORT || 3131);
if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" ||
    !host || !slugs.every((slug) => /^[a-z0-9-]+$/.test(slug))) {
  throw new Error("Configure a origem local, o host público e os slugs de presell.");
}

const paths = new Set(slugs.map((slug) => "/" + slug));
const cache = new Map();
const pending = new Map();
const beacons = new Set(["/api/visit", "/api/step"]);
let burstStartedAt = 0;
let burstEntries = 0;
const agent = new http.Agent({ keepAlive: false, maxSockets: 128 });
const ignoredQuery = new Set(["src", "ctwa_clid", "source_id", "fbclid", "gclid"]);
const knownVary = new Set([
  "accept-encoding", "rsc", "next-router-state-tree",
  "next-router-prefetch", "next-router-segment-prefetch",
]);
const assetRoot = process.env.CTFUNIL_NEXT_STATIC_DIR && await realpath(process.env.CTFUNIL_NEXT_STATIC_DIR);
const assets = new Map();
const gzipAsync = promisify(gzip);
const assetTypes = {
  css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8",
  woff2: "font/woff2", woff: "font/woff",
};
const hopHeaders = ["connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade"];

function endToEndHeaders(headers) {
  const result = { ...headers };
  const extra = (headers.connection || "").split(",").map((name) => name.trim().toLowerCase());
  for (const name of [...hopHeaders, ...extra]) delete result[name];
  return result;
}

function cacheableRequest(request, url) {
  const headers = request.headers;
  const personalized = ["authorization", "cookie", "range", "rsc", "next-url",
    "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch",
    "if-match", "if-none-match", "if-modified-since", "if-unmodified-since",
    "content-length", "transfer-encoding"];
  return request.method === "GET" && headers.host === host && paths.has(url.pathname) &&
    !personalized.some((name) => name in headers) &&
    (!headers.accept || /text\/html|\*\/\*/i.test(headers.accept)) &&
    ![...url.searchParams.keys()].some((key) => !ignoredQuery.has(key) && !/^utm_[a-z_]+$/.test(key)) &&
    !/no-cache|no-store|max-age\s*=\s*0/i.test(headers["cache-control"] || "") &&
    !/no-cache/i.test(headers.pragma || "");
}

function upstream(request, canonicalPath) {
  const headers = canonicalPath
    ? { host, "accept-encoding": "identity", accept: "text/html" }
    : endToEndHeaders(request.headers);
  return new Promise((resolve, reject) => {
    const outgoing = http.request(origin, {
      method: request.method, path: canonicalPath || request.url, headers, agent,
    }, resolve);
    outgoing.on("error", reject);
    if (canonicalPath) outgoing.end();
    else request.pipe(outgoing);
  });
}

function cacheLifetime(response) {
  const headers = response.headers;
  const policy = headers["cache-control"] || "";
  const seconds = Number(policy.match(/\bs-maxage=(\d+)/i)?.[1] || 0);
  const vary = (headers.vary || "").split(",").map((name) => name.trim().toLowerCase()).filter(Boolean);
  const length = Number(headers["content-length"] || 0);
  if (response.statusCode !== 200 || !headers["content-type"]?.startsWith("text/html") ||
      headers["set-cookie"] || headers["content-encoding"] ||
      /\b(private|no-store|no-cache)\b/i.test(policy) ||
      vary.some((name) => !knownVary.has(name)) || !length || length > 256 * 1024) return 0;
  return Math.min(seconds, 15) * 1000;
}

async function fill(request, path) {
  const response = await upstream(request, path);
  const lifetime = cacheLifetime(response);
  if (!lifetime) {
    response.resume();
    return null;
  }
  const chunks = [];
  for await (const chunk of response) chunks.push(chunk);
  const entry = {
    headers: endToEndHeaders(response.headers), body: Buffer.concat(chunks),
    expiresAt: Date.now() + lifetime,
  };
  cache.set(path, entry);
  return entry;
}

async function readAsset(pathname, type) {
  try {
    const file = await realpath(resolve(assetRoot, pathname));
    if (!file.startsWith(assetRoot + sep)) return null;
    const body = await readFile(file);
    const compressed = type === "css" || type === "js" ? await gzipAsync(body) : null;
    return { body, compressed };
  } catch {
    return null;
  }
}

async function serveAsset(request, response, url) {
  const prefix = "/_next/static/";
  if (!assetRoot || !["GET", "HEAD"].includes(request.method) ||
      request.headers.host !== host || !url.pathname.startsWith(prefix) ||
      request.headers.range) return false;
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname.slice(prefix.length));
  } catch {
    return false;
  }
  if (!/^(?:[\w.\-\[\]]+\/)*[\w.\-\[\]]+\.(?:css|js|woff2?)$/.test(pathname)) return false;
  const type = pathname.split(".").at(-1);
  if (pathname.split("/").some((segment) => segment === "." || segment === "..")) return false;
  if (!assets.has(pathname)) {
    if (assets.size >= 64) assets.delete(assets.keys().next().value);
    assets.set(pathname, readAsset(pathname, type));
  }
  const asset = await assets.get(pathname);
  if (!asset) {
    assets.delete(pathname);
    return false;
  }
  const acceptsGzip = /(?:^|,)\s*gzip\s*(?:,|$)/i.test(request.headers["accept-encoding"] || "");
  const body = acceptsGzip && asset.compressed ? asset.compressed : asset.body;
  response.writeHead(200, {
    "content-type": assetTypes[type], "content-length": body.length,
    "cache-control": "public, max-age=31536000, immutable",
    vary: "Accept-Encoding",
    ...(body === asset.compressed ? { "content-encoding": "gzip" } : {}),
  });
  response.end(request.method === "HEAD" ? undefined : body);
  return true;
}

const server = http.createServer(async (request, response) => {
  try {
    if (!request.url?.startsWith("/") || request.url.startsWith("//")) {
      response.writeHead(400).end();
      return;
    }
    const url = new URL(request.url, origin);
    if (await serveAsset(request, response, url)) return;
    if (cacheableRequest(request, url)) {
      const now = Date.now();
      if (now - burstStartedAt > 1000) {
        burstStartedAt = now;
        burstEntries = 0;
      }
      burstEntries++;
      let entry = cache.get(url.pathname);
      if (!entry || entry.expiresAt <= Date.now()) {
        cache.delete(url.pathname);
        if (!pending.has(url.pathname)) {
          pending.set(url.pathname, fill(request, url.pathname).finally(() => pending.delete(url.pathname)));
        }
        entry = await pending.get(url.pathname);
      }
      if (entry) {
        response.writeHead(200, { ...entry.headers, "x-ctfunil-presell-cache": "HIT" }).end(entry.body);
        return;
      }
    }
    // Beacons são assíncronos no cliente. Durante uma rajada, damos precedência ao HTML.
    if (request.method === "POST" && beacons.has(url.pathname) && burstEntries >= 25) {
      const remaining = 850 - (Date.now() - burstStartedAt);
      if (remaining > 0) await delay(remaining);
    }
    const forwarded = await upstream(request);
    response.writeHead(forwarded.statusCode, endToEndHeaders(forwarded.headers));
    await pipeline(forwarded, response);
  } catch {
    if (!response.headersSent) response.writeHead(502);
    response.end();
  }
});

server.listen(port, "127.0.0.1", 4096);
