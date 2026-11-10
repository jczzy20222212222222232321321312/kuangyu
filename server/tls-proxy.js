#!/usr/bin/env node
/* Optional local TLS reverse proxy:
 *   https://localhost:8443/          -> static :8080
 *   https://localhost:8443/world/*   -> game server :8091/*
 * Self-signed certificate: for LAN development only.
 */
'use strict';
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = Number(process.env.TLS_PORT || 8443);
const STATIC = process.env.STATIC_ORIGIN || 'http://127.0.0.1:8080';
const WORLD = process.env.WORLD_ORIGIN || 'http://127.0.0.1:8091';
const key = fs.readFileSync(path.join(__dirname, 'certs/dev-key.pem'));
const cert = fs.readFileSync(path.join(__dirname, 'certs/dev-cert.pem'));
function proxy(req, res, base, strip) {
  let p = req.url;
  if (strip && p.startsWith(strip)) p = p.slice(strip.length) || '/';
  const target = new URL(base);
  const opts = { hostname: target.hostname, port: target.port, path: p, method: req.method, headers: Object.assign({}, req.headers, { host: target.host }) };
  const up = http.request(opts, (ur) => {
    res.writeHead(ur.statusCode || 502, ur.headers);
    ur.pipe(res);
  });
  up.on('error', () => { res.writeHead(502); res.end('proxy error'); });
  req.pipe(up);
}
https.createServer({ key, cert }, (req, res) => {
  if (req.url.startsWith('/world')) proxy(req, res, WORLD, '/world');
  else proxy(req, res, STATIC, '');
}).listen(PORT, '0.0.0.0', () => console.log('[tls] https://localhost:' + PORT + ' (self-signed)'));
