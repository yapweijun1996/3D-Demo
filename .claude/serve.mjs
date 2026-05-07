import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import crypto from 'node:crypto';

const PORT = parseInt(process.env.PORT || '8765', 10);
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html;charset=utf-8',
  '.js':   'text/javascript;charset=utf-8',
  '.mjs':  'text/javascript;charset=utf-8',
  '.css':  'text/css;charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.glb':  'model/gltf-binary',
  '.wasm': 'application/wasm',
};

// Hard no-cache headers — every fetch revalidates. End users never need to clear cache.
// service-worker friendly: no-cache (revalidate via ETag), not no-store (allow disk for offline).
const NO_CACHE = {
  'cache-control': 'no-cache, must-revalidate',
  'pragma':        'no-cache',
  'expires':       '0',
};

function etagFor(stat) {
  return `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
}

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.stat(fp, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end('not found'); return; }
    const etag = etagFor(stat);
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ...NO_CACHE, etag });
      res.end();
      return;
    }
    fs.readFile(fp, (e2, data) => {
      if (e2) { res.writeHead(500); res.end('read error'); return; }
      res.writeHead(200, {
        'content-type': MIME[path.extname(fp)] || 'application/octet-stream',
        'last-modified': stat.mtime.toUTCString(),
        etag,
        ...NO_CACHE,
      });
      res.end(data);
    });
  });
});

srv.listen(PORT, '127.0.0.1', () => console.log(`serving ${ROOT} on http://127.0.0.1:${PORT}`));
