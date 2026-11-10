#!/usr/bin/env node
/* Plain HTTP single-port proxy for a tunnel (Cloudflare quick tunnel / ngrok).
 * /world/* -> game API/SSE on 8091; everything else -> static server 8080.
 * Bind to loopback so the tunnel is the only public path.
 */
'use strict';
const http = require('http');
const PORT = Number(process.env.HTTP_PROXY_PORT || 8081);
const STATIC = process.env.STATIC_ORIGIN || 'http://127.0.0.1:8080';
const WORLD = process.env.WORLD_ORIGIN || 'http://127.0.0.1:8091';
function proxy(req, res, base, strip) {
  let p = req.url;
  if (strip && p.startsWith(strip)) p = p.slice(strip.length) || '/';
  const target = new URL(base);
  const up = http.request({
    hostname: target.hostname, port: target.port, path: p, method: req.method,
    headers: Object.assign({}, req.headers, { host: target.host }),
  }, (ur) => {
    res.writeHead(ur.statusCode || 502, ur.headers);
    ur.pipe(res);
  });
  up.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('proxy error'); });
  req.pipe(up);
}
http.createServer((req, res) => {
  if (req.url.startsWith('/world')) proxy(req, res, WORLD, '/world');
  else proxy(req, res, STATIC, '');
}).listen(PORT, '127.0.0.1', () => console.log('[http-proxy] http://127.0.0.1:' + PORT + ' -> static 8080 + /world 8091'));
