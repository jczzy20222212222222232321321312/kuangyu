/* 矿域 ORE.ZONE — small utilities, deterministic RNG, geometry */
(function () {
'use strict';
const ORE = (window.ORE = window.ORE || {});

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function sum(arr, f) { let s = 0; for (const x of arr) s += f ? f(x) : x; return s; }
function uid(prefix) { return (prefix || 'x') + Math.random().toString(36).slice(2, 9); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

function hashStr(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function makeRng(seed) {
  let s = (typeof seed === 'string' ? hashStr(seed) : (seed >>> 0)) || 1;
  function r() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  r.range = (a, b) => a + r() * (b - a);
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  r.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  return r;
}
function weightedPick(rng, items, weightFn) {
  const total = items.reduce((s, x) => s + weightFn(x), 0);
  let roll = rng() * total;
  for (const it of items) { roll -= weightFn(it); if (roll <= 0) return it; }
  return items[items.length - 1];
}

function fmt(n, d) {
  if (n == null || !isFinite(n)) return '0';
  const dec = d == null ? (Math.abs(n) < 10 && n % 1 ? 1 : 0) : d;
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtCompact(n) {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  return fmt(n, a < 100 ? 1 : 0);
}
function fmtEth(n) {
  if (!isFinite(n)) return '0.0000';
  if (n !== 0 && Math.abs(n) < 0.001) return n.toFixed(8);
  return (Math.round(n * 10000) / 10000).toFixed(4);
}
function fmtPct(n, d) { return (n * 100).toFixed(d == null ? 1 : d) + '%'; }
function clock(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h > 0 ? h + ':' + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0') : m + ':' + String(ss).padStart(2, '0');
}
function mmss(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function ago(ts, now) {
  const d = Math.max(0, (now || Date.now()) - ts);
  if (d < 60000) return Math.floor(d / 1000) + '秒前';
  if (d < 3600000) return Math.floor(d / 60000) + '分钟前';
  return Math.floor(d / 3600000) + '小时前';
}
function shade(hex, amt) {
  const c = hex.replace('#', '');
  const n = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}
function rgba(hex, a) {
  const c = hex.replace('#', '');
  const n = parseInt(c, 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function polyArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}
function polyCentroid(poly) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const f = p[0] * q[1] - q[0] * p[1];
    a += f; cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-6) return [poly[0][0], poly[0][1]];
  return [cx / (6 * a), cy / (6 * a)];
}
function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segDist(a, b, c, d) {
  function dist(p, q) { return Math.hypot(p[0] - q[0], p[1] - q[1]); }
  function ptSeg(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    if (!l2) return dist(p, a);
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
    t = clamp(t, 0, 1);
    return dist(p, [a[0] + dx * t, a[1] + dy * t]);
  }
  return Math.min(ptSeg(a, c, d), ptSeg(b, c, d), ptSeg(c, a, b), ptSeg(d, a, b));
}
function convexHull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}
function clipHalfPlane(poly, a, b) {
  // keep points closer to a than to b
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const c = (b[0] * b[0] + b[1] * b[1] - a[0] * a[0] - a[1] * a[1]) / 2;
  const f = (p) => p[0] * dx + p[1] * dy - c;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const fp = f(p), fq = f(q);
    if (fp <= 1e-7) out.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}
function storageGet(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
}
function download(name, text) {
  const a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(text);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

ORE.util = {
  clamp, lerp, sum, uid, esc, $, $$, hashStr, makeRng, weightedPick,
  fmt, fmtCompact, fmtEth, fmtPct, clock, mmss, ago,
  shade, rgba, polyArea, polyCentroid, pointInPoly, segDist, convexHull, clipHalfPlane,
  storageGet, storageSet, download,
};
})();
