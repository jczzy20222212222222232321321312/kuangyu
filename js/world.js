/* 矿域 矿域 — hex war map: rings, sanctums, cradle and flag columns */
(function () {
'use strict';
const ORE = (window.ORE = window.ORE || {});
const U = ORE.util, D = ORE.data;
const SQ3 = Math.sqrt(3);
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

/* ============================================================
   SPHERICAL VORONOI WORLD
   240 equal-ish cells on a full sphere. Three unattackable bases
   sit 120 degrees apart on the equator; each faction owns one
   120-degree lune, and yield rises with distance from its own base.
   ============================================================ */
const CELL_N = 240;
const BASE_DIRS = [
  [1, 0, 0],
  [-0.5, Math.sqrt(3) / 2, 0],
  [-0.5, -Math.sqrt(3) / 2, 0],
];
const BASE_CLANS = ['ember', 'tide', 'dune'];
const BASE_GARRISON = 12;

function vDot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function vCross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function vNorm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function vSlerp(a, b, t) {
  const d = U.clamp(vDot(a, b), -1, 1);
  const om = Math.acos(d);
  if (om < 1e-5) return a.slice();
  const so = Math.sin(om);
  const w1 = Math.sin((1 - t) * om) / so, w2 = Math.sin(t * om) / so;
  return [a[0] * w1 + b[0] * w2, a[1] * w1 + b[1] * w2, a[2] * w1 + b[2] * w2];
}
function vAngle(a, b) { return Math.acos(U.clamp(vDot(a, b), -1, 1)); }
function sectorForPoint(p) {
  let phi = Math.atan2(p[1], p[0]);
  if (phi < 0) phi += Math.PI * 2;
  if (phi < Math.PI / 3 || phi >= Math.PI * 5 / 3) return 'ember';
  if (phi < Math.PI) return 'tide';
  return 'dune';
}

function terrainNoise(v, seed) {
  const h = Math.sin(v[0] * 12.9898 + v[1] * 78.233 + v[2] * 37.719 + seed * 0.000013) * 43758.5453;
  return h - Math.floor(h);
}

function terrainByName(name) {
  if (/雪|冰|霜|寒/.test(name)) return 'snow';
  if (/沙|漠|戈壁|滩/.test(name)) return 'desert';
  if (/湖|潭|泽/.test(name)) return 'lake';
  if (/河|溪|泉|井|渡/.test(name)) return 'river';
  if (/林|森|树|雨林/.test(name)) return 'rainforest';
  if (/高原|盆地|台地|塬|丘陵/.test(name)) return 'plateau';
  if (/山|峰|岭|崖|峡|谷|关|隘/.test(name)) return 'mountain';
  if (/草原|平原|牧|野/.test(name)) return 'grass';
  return null;
}

function assignTerrain(cells, seed) {
  const set = (cell, key) => {
    if (!D.TERRAIN[key]) return;
    cell.terrain = key;
    cell.terrainName = D.TERRAIN[key].name;
  };
  for (const cell of cells) {
    if (cell.kind === 'base') { set(cell, 'plateau'); continue; }
    const lat = 90 - cell.sph.theta * 180 / Math.PI;
    const a = Math.abs(lat);
    const n = terrainNoise(cell.vCenter, seed);
    let key = 'grass';
    if (a > 64 || (a > 51 && n > 0.52)) key = 'snow';
    else if (a < 16 && n > 0.37) key = 'rainforest';
    else if (a < 27 && n < 0.11) key = 'lake';
    else if (a > 14 && a < 40 && n < 0.54 && n > 0.12) key = 'desert';
    else if (n > 0.82) key = 'mountain';
    else if (n > 0.67) key = 'plateau';
    else if (n < 0.13) key = 'river';
    const named = terrainByName(cell.name);
    if (named) key = named;
    set(cell, key);
  }
  // Guarantee every biome appears on every world seed, even at the edges.
  const seen = new Set(cells.map((c) => c.terrain));
  const pick = (key) => {
    if (seen.has(key)) return;
    const candidates = cells.filter((c) => c.kind !== 'base');
    const lat = (c) => 90 - c.sph.theta * 180 / Math.PI;
    const n = (c) => terrainNoise(c.vCenter, seed);
    candidates.sort((a, b) => {
      if (key === 'snow') return Math.abs(lat(b)) - Math.abs(lat(a));
      if (key === 'rainforest') return Math.abs(lat(a)) - Math.abs(lat(b));
      if (key === 'desert') return Math.abs(Math.abs(lat(a)) - 25) - Math.abs(Math.abs(lat(b)) - 25);
      return n(a) - n(b);
    });
    if (candidates[0]) { set(candidates[0], key); seen.add(key); }
  };
  ['grass', 'mountain', 'river', 'desert', 'snow', 'plateau', 'rainforest', 'lake'].forEach(pick);
}

function generateWorld(seed) {
  const rng = U.makeRng(seed);
  const n = CELL_N;
  const ga = Math.PI * (3 - Math.sqrt(5));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const z = 1 - 2 * (i + 0.5) / n;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const phi = ga * i;
    pts.push([r * Math.cos(phi), r * Math.sin(phi), z]);
  }

  // snap the three nearest sites exactly onto the 120-degree anchors
  const baseIdx = [];
  const used = new Set();
  for (const a of BASE_DIRS) {
    let bi = -1, bd = -2;
    for (let i = 0; i < n; i++) {
      if (used.has(i)) continue;
      const d = vDot(pts[i], a);
      if (d > bd) { bd = d; bi = i; }
    }
    used.add(bi);
    baseIdx.push(bi);
    pts[bi] = a.slice();
  }

  // Spherical Delaunay via empty circumcircle test. n=90, so brute force
  // over triples (117k * 90) is fast enough and avoids a hull dependency.
  const tris = [];
  const verts = Array.from({ length: n }, () => []);
  const neighbours = Array.from({ length: n }, () => new Set());
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const a = pts[i], b = pts[j], c = pts[k];
        let nn = vCross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]);
        const len = Math.hypot(nn[0], nn[1], nn[2]);
        if (len < 1e-7) continue;
        nn = [nn[0] / len, nn[1] / len, nn[2] / len];
        let h = vDot(a, nn);
        if (h < 0) { nn = [-nn[0], -nn[1], -nn[2]]; h = -h; }
        if (h < 1e-6) continue;
        let empty = true;
        for (let p = 0; p < n; p++) {
          if (p === i || p === j || p === k) continue;
          if (vDot(pts[p], nn) > h + 1e-8) { empty = false; break; }
        }
        if (!empty) continue;
        tris.push([i, j, k]);
        verts[i].push(nn); verts[j].push(nn); verts[k].push(nn);
        neighbours[i].add(j); neighbours[i].add(k);
        neighbours[j].add(i); neighbours[j].add(k);
        neighbours[k].add(i); neighbours[k].add(j);
      }
    }
  }

  // turn each site's circumcentres into a sorted spherical polygon
  const polys = [];
  for (let i = 0; i < n; i++) {
    const site = pts[i];
    const ref = Math.abs(site[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const u = vNorm(vCross(ref, site));
    const v = vCross(site, u);
    const uniq = [];
    const seen = new Set();
      for (const q of verts[i]) {
      const key = q.map((x) => x.toFixed(5)).join(',');
      if (seen.has(key)) continue;
      seen.add(key); uniq.push(q);
    }
    uniq.sort((a, b) => Math.atan2(vDot(a, u), vDot(a, v)) - Math.atan2(vDot(b, u), vDot(b, v)));
    if (uniq.length < 3) throw new Error('Voronoi cell has fewer than 3 vertices');
    polys.push(uniq);
  }

  const namePool = D.ZONE_INNER.concat(D.ZONE_MID, D.ZONE_OUTER);
  let poolIdx = 0;
  let frontierIdx = 0;
  const cells = [];
  const baseByClan = {};
  for (let i = 0; i < n; i++) {
    const site = pts[i];
    const clanKey = sectorForPoint(site);
    const baseAt = baseIdx.indexOf(i);
    const kind = baseAt >= 0 ? 'base' : 'mine';
    let name, en;
    if (kind === 'base') {
      const c = D.CLAN[BASE_CLANS[baseAt]];
      name = c.name + '基地';
      en = c.en + ' CITADEL';
    } else {
      const meta = namePool[poolIdx++];
      if (meta) { name = meta.name; en = meta.en; }
      else { name = '边地·' + String(++frontierIdx).padStart(2, '0'); en = 'FRONTIER ' + String(frontierIdx).padStart(2, '0'); }
    }
    const sph = { theta: Math.acos(U.clamp(site[2], -1, 1)), phi: Math.atan2(site[1], site[0]) };
    const cell = {
      id: i, q: 0, r: 0, ring: 0, ringNo: 0,
      x: site[0], y: site[1], c: site.slice(),
      vCenter: site, sph, poly: [], inset: [],
      sector: clanKey, kind, name, en,
      baseWeight: 0, weight: 0, borderBonus: 1,
      owner: clanKey, home: clanKey,
      fort: 0, garrison: 0, garrisonIds: [], militia: 0,
      capturedAt: 0, distBase: 0, relYield: 0,
      nb: [...neighbours[i]],
      vPoly: [],
    };
    wirePoly(cell, polys[i]);
    if (kind === 'mine') cell.garrison = D.ECON.aiGarrison;
    if (kind === 'base') {
      cell.garrison = BASE_GARRISON;
      baseByClan[clanKey] = cell;
    }
    cells.push(cell);
  }

  // base dirs and yield fields
  for (const cell of cells) {
    const b = baseByClan[cell.owner] || baseByClan.ember;
    cell.distBase = vAngle(cell.vCenter, b.vCenter);
    cell.relYield = U.clamp(cell.distBase / (Math.PI / 2), 0, 1);
    if (cell.kind === 'base') cell.weight = 0.22;
    else cell.weight = 0.35 + 6.2 * Math.pow(cell.relYield, 1.2);
    cell.baseWeight = cell.weight;
  }
  // re-evaluate yields of bases themselves: their owner base is itself; zero distance.
  for (const c of Object.keys(baseByClan)) {
    const b = baseByClan[c];
    b.distBase = 0; b.relYield = 0; b.weight = 0.22; b.baseWeight = 0.22;
  }
  assignTerrain(cells, seed);
  // Stable alphanumeric tile codes: A = Antarctic, B = Forest, C = Desert.
  const prefixes = { tide: 'A', ember: 'B', dune: 'C' };
  for (const sector of Object.keys(prefixes)) {
    const prefix = prefixes[sector];
    const group = cells.filter((c) => c.sector === sector);
    group.sort((a, b) => {
      if (a.kind === 'base' && b.kind !== 'base') return -1;
      if (b.kind === 'base' && a.kind !== 'base') return 1;
      const az = Math.acos(U.clamp(a.vCenter[2], -1, 1));
      const bz = Math.acos(U.clamp(b.vCenter[2], -1, 1));
      if (Math.abs(az - bz) > 0.01) return az - bz;
      return Math.atan2(a.vCenter[1], a.vCenter[0]) - Math.atan2(b.vCenter[1], b.vCenter[0]);
    });
    let n = 1;
    for (const c of group) {
      c.code = c.kind === 'base' ? prefix + '00' : prefix + String(n++).padStart(2, '0');
      c.name = c.code;
      c.en = c.code;
    }
  }
  const totalWeight = cells.reduce((a, z) => a + z.weight, 0);
  return {
    seed, cells, totalWeight, baseByClan, baseIdx,
    bases: BASE_CLANS.map((k) => baseByClan[k]),
    centerId: -1, size: 0, radius: 0, dust: [],
  };
}

function wirePoly(cell, verts) {
  const out = [];
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i], b = verts[(i + 1) % verts.length];
    for (let k = 0; k < 3; k++) out.push(vSlerp(a, b, k / 3));
  }
  cell.vPoly = out;
}
function sphVec(theta, phi) {
  const st = Math.sin(theta);
  return [st * Math.cos(phi), st * Math.sin(phi), Math.cos(theta)];
}

/* ============================================================
   GLOBAL TERRAIN
   Continuous planet-scale biomes: no per-cell icons.
   ============================================================ */
function terrainArc(a, b, bend, steps) {
  let n = vNorm(vCross(a, b));
  if (!isFinite(n[0]) || Math.hypot(n[0], n[1], n[2]) < 0.01) n = vNorm(vCross(a, [0, 1, 0]));
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const base = vSlerp(a, b, t);
    const perp = vNorm(vCross(n, base));
    const off = Math.sin(Math.PI * t) * bend;
    out.push(vNorm([
      base[0] * Math.cos(off) + perp[0] * Math.sin(off),
      base[1] * Math.cos(off) + perp[1] * Math.sin(off),
      base[2] * Math.cos(off) + perp[2] * Math.sin(off),
    ]));
  }
  return out;
}

function terrainRegion(center, radius, salt) {
  const c = vNorm(center);
  const ref = Math.abs(c[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = vNorm(vCross(ref, c));
  const v = vCross(c, u);
  const pts = [];
  const N = 50;
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2;
    const wob = 0.82 + 0.22 * terrainNoise([Math.cos(ang), Math.sin(ang), salt], salt * 17);
    const rr = radius * wob;
    const co = Math.cos(rr), si = Math.sin(rr);
    pts.push(vNorm([
      c[0] * co + (u[0] * Math.cos(ang) + v[0] * Math.sin(ang)) * si,
      c[1] * co + (u[1] * Math.cos(ang) + v[1] * Math.sin(ang)) * si,
      c[2] * co + (u[2] * Math.cos(ang) + v[2] * Math.sin(ang)) * si,
    ]));
  }
  return { center: c, radius, pts };
}

function buildTerrainWorld(seed) {
  const ranges = [];
  const rangeDefs = [
    { a: sphVec(0.55, -1.05), b: sphVec(1.02, -0.05), bend: 0.2, snow: true },
    { a: sphVec(0.82, 1.35), b: sphVec(1.2, 2.35), bend: -0.2, snow: false },
    { a: sphVec(1.25, 2.9), b: sphVec(0.95, 3.85), bend: 0.17, snow: false },
    { a: sphVec(1.1, -2.5), b: sphVec(0.72, -1.6), bend: -0.16, snow: true },
  ];
  for (let ri = 0; ri < rangeDefs.length; ri++) {
    const def = rangeDefs[ri];
    const pts = terrainArc(def.a, def.b, def.bend, 74);
    const peaks = [];
    for (let i = 1; i < pts.length - 1; i++) {
      const lat = 90 - Math.acos(U.clamp(pts[i][2], -1, 1)) * 180 / Math.PI;
      const nz = terrainNoise(pts[i], seed + i * 13);
      peaks.push({
        v: pts[i],
        h: 0.34 + Math.pow(nz, 0.55) * 2.15,
        radius: 0.035 + terrainNoise(pts[i], seed + i * 29) * 0.06,
        snow: def.snow || Math.abs(lat) > 54,
        salt: i + ri * 17,
      });
    }
    ranges.push({ pts, peaks, snow: def.snow });
  }
  const deserts = [
    terrainRegion(sphVec(1.15, -0.42), 0.4, 11),
    terrainRegion(sphVec(1.08, 1.72), 0.34, 23),
    terrainRegion(sphVec(1.2, 3.55), 0.42, 37),
  ];
  const forests = [
    terrainRegion(sphVec(1.45, -1.45), 0.3, 51),
    terrainRegion(sphVec(1.5, 0.82), 0.34, 67),
    terrainRegion(sphVec(1.4, 2.7), 0.28, 79),
  ];
  const plateaus = [
    terrainRegion(sphVec(0.9, -0.2), 0.24, 91),
    terrainRegion(sphVec(0.78, 2.05), 0.25, 103),
  ];
  const lakes = [
    terrainRegion(sphVec(1.35, -2.15), 0.14, 117),
    terrainRegion(sphVec(1.1, 0.45), 0.11, 123),
  ];
  const oceans = [
    terrainRegion(sphVec(1.3, 2.3), 0.52, 151),
    terrainRegion(sphVec(1.52, -0.75), 0.4, 163),
  ];
  const capN = terrainRegion([0, 0, 1], 0.26, 131);
  const capS = terrainRegion([0, 0, -1], 0.25, 137);
  const dunes = [];
  for (const d of deserts) {
    for (let i = 0; i < 5; i++) {
      const v = d.pts[Math.floor((i / 5) * d.pts.length)];
      dunes.push({ v, s: 0.75 + terrainNoise(v, seed + i) * 0.4 });
    }
  }
  const trees = [];
  for (const f of forests) {
    for (let i = 0; i < 36; i++) {
      const v = f.pts[(i * 7 + 3) % f.pts.length];
      trees.push({ v, s: 0.28 + Math.pow(terrainNoise(v, seed + i * 3), 1.7) * 2.5 });
    }
  }
  const mesas = [];
  for (const pl of plateaus) {
    mesas.push({ v: pl.center, s: 1 });
    mesas.push({ v: pl.pts[8], s: 0.8 });
    mesas.push({ v: pl.pts[32], s: 0.75 });
  }
  const rivers = [
    terrainArc(sphVec(1.0, -0.75), sphVec(1.45, 0.2), 0.24, 70),
    terrainArc(sphVec(0.9, 1.55), sphVec(1.35, 2.1), -0.22, 64),
    terrainArc(sphVec(1.2, 3.0), sphVec(1.48, 3.7), 0.18, 62),
    terrainArc(sphVec(1.05, -1.95), sphVec(1.4, -2.5), -0.2, 58),
  ];
  return { seed, ranges, deserts, forests, plateaus, lakes, oceans, capN, capS, dunes, trees, mesas, rivers };
}

function terrainDistanceToPath(v, pts) {
  let best = Math.PI;
  for (let i = 0; i < pts.length; i += 3) best = Math.min(best, vAngle(v, pts[i]));
  return best;
}

function terrainAtPoint(v, tw) {
  const inReg = (r) => vAngle(v, r.center) <= r.radius * 1.02;
  if (vAngle(v, tw.capN.center) <= tw.capN.radius * 1.05 ||
      vAngle(v, tw.capS.center) <= tw.capS.radius * 1.05) return 'snow';
  for (const l of tw.lakes) if (inReg(l)) return 'lake';
  for (const r of tw.rivers) if (terrainDistanceToPath(v, r) < 0.035) return 'river';
  for (const d of tw.deserts) if (inReg(d)) return 'desert';
  for (const f of tw.forests) if (inReg(f)) return 'rainforest';
  for (const pl of tw.plateaus) if (inReg(pl)) return 'plateau';
  for (const range of tw.ranges) {
    for (let i = 0; i < range.peaks.length; i += 2) {
      if (vAngle(v, range.peaks[i].v) < 0.055) return 'mountain';
    }
  }
  return 'grass';
}

function labelTerrainWorld(world, tw) {
  for (const cell of world.cells) {
    const key = cell.kind === 'base' ? 'plateau' : terrainAtPoint(cell.vCenter, tw);
    cell.terrain = key;
    cell.terrainName = D.TERRAIN[key] ? D.TERRAIN[key].name : '草原';
  }
}

/* ============================================================
   SPINNING SPHERE MAP
   ============================================================ */
const LIGHT = [-0.45, 0.62, 0.66];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const AVATAR_CACHE = new Map();

const state = {
  cv: null, ctx: null, W: 0, H: 0, dpr: 1,
  world: null, cells: [], byId: [],
  cam: { spin: 0.38, tilt: -0.36, s: 200 },
  fitS: 1, insets: { l: 0, t: 0, r: 0, b: 0 },
  rows: [], rates: [], me: null,
  selected: -1, hover: -1, targets: null,
  marches: [], battles: [], rings: [], spawns: [], battleFx: [], resultFx: [],
  drag: null, pinch: null, ptrs: new Map(), moved: 0, userMoved: false,
  needs: true, raf: 0, last: 0, lastAuto: 0, pauseUntil: 0,
  stars: [], terrainWorld: null, terrainMode: '3d', onPick: null, onHover: null,
};

function init(canvas, world) {
  state.cv = canvas;
  state.ctx = canvas.getContext('2d');
  state.world = world;
  state.cells = world.cells;
  state.byId = new Array(world.cells.length);
  for (const z of world.cells) state.byId[z.id] = z;
  state.rows = new Array(world.cells.length).fill(null).map(() => ({ owner: null, garrison: 0, def: 0 }));
  state.rates = new Array(world.cells.length).fill(0);
  state.terrainWorld = buildTerrainWorld(world.seed);
  labelTerrainWorld(world, state.terrainWorld);
  resize();
  bindInput();
  requestAnimationFrame(frame);
}

function resize() {
  const cv = state.cv;
  if (!cv) return;
  state.W = window.innerWidth;
  state.H = window.innerHeight;
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(state.W * state.dpr);
  cv.height = Math.round(state.H * state.dpr);
  cv.style.width = state.W + 'px';
  cv.style.height = state.H + 'px';
  computeInsets();
  state.fitS = fitScale();
  if (!state.userMoved) state.cam.s = state.fitS;
  state.cam.s = U.clamp(state.cam.s, state.fitS * 0.65, state.fitS * 3.2);
  makeStars();
  state.needs = true;
}
function computeInsets() {
  const w = window.innerWidth, h = window.innerHeight;
  let l = 0, r = 0, t = 74, b = 0;
  if (w > 760) {
    const panel = document.getElementById('panel');
    if (panel) l = panel.getBoundingClientRect().right + 16;
    const feed = document.getElementById('feed');
    if (feed && w > 1120 && feed.offsetWidth > 0) r = w - feed.getBoundingClientRect().left + 16;
    b = 82;
  } else {
    const panel = document.getElementById('panel');
    if (panel) b = Math.max(120, h - panel.getBoundingClientRect().top + 18);
    t = 62;
  }
  state.insets = { l, r, t, b };
}
function clearRect() {
  const i = state.insets;
  return { x: i.l, y: i.t, w: Math.max(100, state.W - i.l - i.r), h: Math.max(100, state.H - i.t - i.b) };
}
function sphereCenter() { const c = clearRect(); return { x: c.x + c.w / 2, y: c.y + c.h / 2 }; }
function fitScale() { const c = clearRect(); return Math.min(c.w, c.h) * 0.490; }
function makeStars() {
  const rng = U.makeRng(90210);
  state.stars = [];
  for (let i = 0; i < 150; i++) state.stars.push([rng() * state.W, rng() * state.H, rng()]);
}

function fit() {
  state.userMoved = false;
  state.cam.s = fitScale();
  state.cam.spin = 0.38;
  state.cam.tilt = -0.36;
  state.fitS = state.cam.s;
  state.pauseUntil = performance.now() + 1200;
  state.needs = true;
}
function zoomTo(factor) {
  state.userMoved = true;
  state.cam.s = U.clamp(state.cam.s * factor, fitScale() * 0.65, fitScale() * 3.2);
  state.pauseUntil = performance.now() + 3000;
  state.needs = true;
}
function focus(id, zoom) {
  const z = state.byId[id];
  if (!z) return;
  state.userMoved = true;
  state.cam.spin = normAngle(-Math.PI / 2 - z.sph.phi);
  state.cam.tilt = U.clamp(-0.36 - z.sph.theta * 0.32, -0.95, -0.22);
  state.cam.s = Math.max(state.cam.s, fitScale() * (zoom || 1.1));
  state.cam.s = U.clamp(state.cam.s, fitScale() * 0.65, fitScale() * 1.65);
  state.pauseUntil = performance.now() + 12000;
  state.needs = true;
}
function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function rotV(v) {
  const spin = state.cam.spin, tilt = state.cam.tilt;
  const cp = Math.cos(spin), sp = Math.sin(spin);
  const x1 = v[0] * cp - v[1] * sp;
  const y1 = v[0] * sp + v[1] * cp;
  const z1 = v[2];
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  return [x1, y1 * ct - z1 * st, y1 * st + z1 * ct];
}
function projectV(v) {
  const p = rotV(v), c = sphereCenter(), s = state.cam.s;
  return { x: c.x + p[0] * s, y: c.y - p[1] * s, z: p[2], r: p };
}
function projectCell(z) { return projectV(z.vCenter); }
function screenPoly(z) { return z.vPoly.map(projectV); }
function polyPath(pts, radius) {
  const p = new Path2D();
  if (!pts.length) return p;
  const r = Math.max(0, radius == null ? 2.4 : radius);
  if (r <= 0.1) {
    p.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y);
    p.closePath();
    return p;
  }
  const n = pts.length;
  let started = false;
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n], cur = pts[i], next = pts[(i + 1) % n];
    const d1 = Math.hypot(prev.x - cur.x, prev.y - cur.y) || 1;
    const d2 = Math.hypot(next.x - cur.x, next.y - cur.y) || 1;
    const r1 = Math.min(r, d1 * 0.42), r2 = Math.min(r, d2 * 0.42);
    const inX = cur.x + (prev.x - cur.x) / d1 * r1;
    const inY = cur.y + (prev.y - cur.y) / d1 * r1;
    const outX = cur.x + (next.x - cur.x) / d2 * r2;
    const outY = cur.y + (next.y - cur.y) / d2 * r2;
    if (!started) { p.moveTo(inX, inY); started = true; }
    else p.lineTo(inX, inY);
    p.quadraticCurveTo(cur.x, cur.y, outX, outY);
  }
  p.closePath();
  return p;
}
function pointAt(theta, phi) { return [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)]; }

/* ---------- frame / auto spin ---------- */
function frame(t) {
  state.raf = requestAnimationFrame(frame);
  if (document.hidden || !state.ctx) return;
  if (ORE.globe3d) ORE.globe3d.render();
  const now = performance.now();
  const dt = Math.min(64, now - (state.lastAuto || now));
  state.lastAuto = now;
  if (!REDUCED && !state.ptrs.size && !state.drag && now > state.pauseUntil) {
    state.cam.spin = normAngle(state.cam.spin + dt * 0.000052);
    state.needs = true;
  }
  if (!state.needs && now - state.last < 33) return;
  state.last = now; state.needs = false;
  draw(now);
}

/* ---------- draw ---------- */
function tRand(z, salt) {
  const h = Math.sin((z.id + 1) * 12.9898 + salt * 78.233 + z.c[0] * 37.719) * 43758.5453;
  return h - Math.floor(h);
}

function drawPeak(ctx, x, baseY, w, h, light, dark, snow) {
  const peakY = baseY - h;
  const midX = x + w * 0.05;
  const centerY = baseY;
  // cast shadow on the ground
  ctx.fillStyle = 'rgba(3,8,6,.22)';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.34, baseY + 1, w * 0.95, h * 0.1, 0, 0, 7);
  ctx.fill();
  // dark back ridge, offset slightly to sell depth
  ctx.beginPath();
  ctx.moveTo(midX - w * 0.08, peakY + h * 0.04);
  ctx.lineTo(x - w * 0.78, centerY);
  ctx.lineTo(x + w * 0.86, centerY);
  ctx.closePath();
  ctx.fillStyle = snow ? '#6f8288' : '#34332e';
  ctx.fill();
  // lit left face
  ctx.beginPath();
  ctx.moveTo(x, peakY);
  ctx.lineTo(x - w, centerY);
  ctx.lineTo(midX, centerY);
  ctx.closePath();
  ctx.fillStyle = light;
  ctx.fill();
  // shadow right face
  ctx.beginPath();
  ctx.moveTo(x, peakY);
  ctx.lineTo(midX, centerY);
  ctx.lineTo(x + w, centerY);
  ctx.closePath();
  ctx.fillStyle = dark;
  ctx.fill();
  // ridge line and base edges
  ctx.strokeStyle = 'rgba(2,6,5,.44)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x - w, centerY); ctx.lineTo(x, peakY); ctx.lineTo(x + w, centerY);
  ctx.stroke();
  ctx.strokeStyle = snow ? 'rgba(230,245,246,.5)' : 'rgba(210,200,175,.25)';
  ctx.beginPath();
  ctx.moveTo(x, peakY); ctx.lineTo(midX, centerY);
  ctx.stroke();
  if (snow) {
    // jagged snow cap, rock still visible on the lower flanks
    ctx.beginPath();
    ctx.moveTo(x, peakY);
    ctx.lineTo(x + w * 0.18, peakY + h * 0.24);
    ctx.lineTo(x + w * 0.07, peakY + h * 0.19);
    ctx.lineTo(x - w * 0.03, peakY + h * 0.27);
    ctx.lineTo(x - w * 0.13, peakY + h * 0.19);
    ctx.lineTo(x - w * 0.24, peakY + h * 0.25);
    ctx.closePath();
    ctx.fillStyle = '#f1f7f6';
    ctx.fill();
    ctx.strokeStyle = 'rgba(130,160,166,.6)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  // rock striation on the lit face
  ctx.strokeStyle = snow ? 'rgba(230,240,240,.2)' : 'rgba(255,240,205,.18)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.18, peakY + h * 0.42);
  ctx.lineTo(x - w * 0.58, centerY - h * 0.12);
  ctx.stroke();
}

function drawTerrainMountains(ctx, z, p, r, snow, detail) {
  const n = detail > 0.65 ? 4 : 3;
  const baseY = p.y + r * 0.5;
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#050806';
  ctx.beginPath();
  ctx.ellipse(p.x + r * 0.12, baseY + r * 0.08, r * 0.88, r * 0.2, 0, 0, 7);
  ctx.fill();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = snow ? '#dce9ea' : '#b5a98f';
  ctx.beginPath();
  ctx.ellipse(p.x - r * 0.34, baseY + r * 0.05, r * 0.42, r * 0.1, 0, 0, 7);
  ctx.fill();
  ctx.restore();
  // distant back ridges
  ctx.fillStyle = snow ? 'rgba(100,122,128,.48)' : 'rgba(56,54,47,.5)';
  ctx.beginPath();
  ctx.moveTo(p.x - r * 0.82, baseY);
  ctx.lineTo(p.x - r * 0.4, baseY - r * 0.34);
  ctx.lineTo(p.x - r * 0.02, baseY - r * 0.12);
  ctx.lineTo(p.x + r * 0.3, baseY - r * 0.4);
  ctx.lineTo(p.x + r * 0.86, baseY);
  ctx.closePath();
  ctx.fill();
  const order = [];
  for (let i = 0; i < n; i++) order.push(i);
  order.sort((a, b) => tRand(z, a + 20) - tRand(z, b + 20));
  for (const i of order) {
    const spread = (i - (n - 1) / 2);
    const x = p.x + spread * r * 0.4 + (tRand(z, i + 3) - 0.5) * r * 0.14;
    const h = r * (0.52 + tRand(z, i + 5) * 0.36) * (i === 0 ? 1.1 : 1);
    const w = r * (0.26 + tRand(z, i + 7) * 0.1);
    drawPeak(ctx, x, baseY + (i === 0 ? 0 : r * 0.06), w, h,
      snow ? '#95a6aa' : '#8d8578',
      snow ? '#4e6166' : '#4a463f', snow);
  }
  // ridge line
  ctx.strokeStyle = snow ? 'rgba(255,255,255,.35)' : 'rgba(20,18,14,.4)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(p.x - r * 0.75, baseY);
  ctx.quadraticCurveTo(p.x, baseY - r * 0.18, p.x + r * 0.75, baseY);
  ctx.stroke();
}

function drawTerrainPlateau(ctx, z, p, r) {
  const halfW = r * 0.5;
  const midY = p.y - r * 0.18;
  const backY = p.y - r * 0.42;
  const frontY = p.y - r * 0.035;
  const botY = p.y + r * 0.24;
  // eroded talus skirt around the base
  ctx.beginPath();
  ctx.moveTo(p.x - r * 0.92, botY + r * 0.13);
  ctx.quadraticCurveTo(p.x - r * 0.55, botY - r * 0.03, p.x - halfW * 0.95, botY);
  ctx.lineTo(p.x + halfW * 0.95, botY);
  ctx.quadraticCurveTo(p.x + r * 0.6, botY - r * 0.02, p.x + r * 0.92, botY + r * 0.14);
  ctx.closePath();
  ctx.fillStyle = 'rgba(98,72,48,.85)';
  ctx.fill();
  // ground shadow
  ctx.fillStyle = 'rgba(3,7,5,.25)';
  ctx.beginPath();
  ctx.ellipse(p.x + r * 0.1, botY + r * 0.18, r * 0.92, r * 0.12, 0, 0, 7);
  ctx.fill();
  // vertical front cliff
  ctx.beginPath();
  ctx.moveTo(p.x - halfW, midY);
  ctx.lineTo(p.x - halfW * 0.96, botY);
  ctx.lineTo(p.x + halfW * 0.96, botY);
  ctx.lineTo(p.x + halfW, midY);
  ctx.lineTo(p.x, frontY + r * 0.02);
  ctx.closePath();
  ctx.fillStyle = '#4b3525';
  ctx.fill();
  // lit right cliff face
  ctx.beginPath();
  ctx.moveTo(p.x + halfW * 0.16, midY - r * 0.01);
  ctx.lineTo(p.x + halfW, midY);
  ctx.lineTo(p.x + halfW * 0.96, botY);
  ctx.lineTo(p.x + halfW * 0.1, botY - r * 0.01);
  ctx.closePath();
  ctx.fillStyle = '#75543a';
  ctx.fill();
  // broad isometric top face
  ctx.beginPath();
  ctx.moveTo(p.x - halfW, midY);
  ctx.lineTo(p.x, backY);
  ctx.lineTo(p.x + halfW, midY);
  ctx.lineTo(p.x, frontY);
  ctx.closePath();
  ctx.fillStyle = '#c09a73';
  ctx.fill();
  // grass cap inside the top
  ctx.beginPath();
  ctx.moveTo(p.x - halfW * 0.84, midY);
  ctx.lineTo(p.x, backY + r * 0.05);
  ctx.lineTo(p.x + halfW * 0.8, midY);
  ctx.lineTo(p.x, frontY - r * 0.02);
  ctx.closePath();
  ctx.fillStyle = 'rgba(80,116,61,.92)';
  ctx.fill();
  // top rim
  ctx.strokeStyle = 'rgba(240,220,180,.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.x - halfW, midY); ctx.lineTo(p.x, backY); ctx.lineTo(p.x + halfW, midY); ctx.lineTo(p.x, frontY);
  ctx.closePath();
  ctx.stroke();
  // strata and cracks
  ctx.strokeStyle = 'rgba(22,14,8,.45)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 3; i++) {
    const y = midY + r * (0.09 + i * 0.1);
    ctx.beginPath();
    ctx.moveTo(p.x - halfW * (0.97 - i * 0.02), y);
    ctx.quadraticCurveTo(p.x, y + r * 0.03, p.x + halfW * (0.95 - i * 0.02), y + r * 0.016);
    ctx.stroke();
  }
  for (let i = 0; i < 2; i++) {
    const x = p.x + (i ? halfW * 0.4 : -halfW * 0.3);
    ctx.beginPath();
    ctx.moveTo(x, midY + r * 0.06); ctx.lineTo(x + (i ? r * 0.03 : -r * 0.025), botY);
    ctx.stroke();
  }
  // talus rocks
  ctx.fillStyle = '#6d5339';
  for (let i = 0; i < 3; i++) {
    const x = p.x + (tRand(z, i + 500) - 0.5) * r * 1.4;
    const y = botY + r * (0.05 + tRand(z, i + 520) * 0.08);
    const s = r * (0.035 + tRand(z, i + 540) * 0.035);
    ctx.beginPath();
    ctx.moveTo(x - s, y + s * 0.5); ctx.lineTo(x, y - s); ctx.lineTo(x + s, y + s * 0.5);
    ctx.closePath(); ctx.fill();
  }
}

function drawTerrainDesert(ctx, z, p, r, detail) {
  const layers = detail > 0.55 ? 3 : 2;
  for (let i = 0; i < layers; i++) {
    const y = p.y + r * (-0.12 + i * 0.28);
    const amt = (tRand(z, i + 40) - 0.5) * r * 0.16;
    ctx.beginPath();
    ctx.moveTo(p.x - r, y + r * 0.14);
    ctx.bezierCurveTo(p.x - r * 0.5, y - r * 0.24 + amt, p.x + r * 0.2, y - r * 0.2 - amt, p.x + r, y + r * 0.18);
    ctx.lineTo(p.x + r, y + r * 0.55);
    ctx.lineTo(p.x - r, y + r * 0.55);
    ctx.closePath();
    ctx.fillStyle = i === 0 ? '#c7a568' : (i === 1 ? '#a8824d' : '#8b693e');
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,55,28,.32)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(p.x - r * 0.9, y + r * 0.15);
    ctx.bezierCurveTo(p.x - r * 0.4, y - r * 0.2 + amt, p.x + r * 0.2, y - r * 0.16 - amt, p.x + r * 0.9, y + r * 0.2);
    ctx.stroke();
    // crest highlight
    ctx.strokeStyle = 'rgba(255,225,160,.5)';
    ctx.beginPath();
    ctx.moveTo(p.x - r * 0.65, y + r * 0.04);
    ctx.quadraticCurveTo(p.x, y - r * 0.22 + amt, p.x + r * 0.55, y + r * 0.03);
    ctx.stroke();
  }
  // ripples
  ctx.strokeStyle = 'rgba(90,60,30,.22)';
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 4; i++) {
    const x = p.x + (tRand(z, i + 70) - 0.5) * r;
    const y = p.y + (tRand(z, i + 80) - 0.5) * r * 0.6;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.12, y);
    ctx.quadraticCurveTo(x, y - r * 0.04, x + r * 0.12, y);
    ctx.stroke();
  }
}

function drawTerrainGrass(ctx, z, p, r, detail) {
  // rounded hills with lit crests and shadow feet
  for (let i = 0; i < 2; i++) {
    const hx = p.x + (i ? r * 0.28 : -r * 0.18);
    const hy = p.y + (i ? r * 0.18 : r * 0.06);
    const hw = r * (i ? 0.58 : 0.7);
    const hh = r * (i ? 0.24 : 0.3);
    ctx.fillStyle = 'rgba(3,7,4,.18)';
    ctx.beginPath();
    ctx.ellipse(hx, hy + hh * 0.62, hw * 1.04, hh * 0.28, 0, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx - hw, hy + hh * 0.55);
    ctx.quadraticCurveTo(hx - hw * 0.45, hy - hh, hx, hy - hh * 0.82);
    ctx.quadraticCurveTo(hx + hw * 0.5, hy - hh * 0.6, hx + hw, hy + hh * 0.55);
    ctx.closePath();
    ctx.fillStyle = i ? 'rgba(68,98,48,.7)' : 'rgba(83,116,57,.72)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(205,230,155,.28)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(hx - hw * 0.65, hy + hh * 0.2);
    ctx.quadraticCurveTo(hx - hw * 0.2, hy - hh * 0.85, hx + hw * 0.32, hy - hh * 0.5);
    ctx.stroke();
  }
  const tufts = detail > 0.55 ? 9 : 5;
  for (let i = 0; i < tufts; i++) {
    const x = p.x + (tRand(z, i + 100) - 0.5) * r * 1.25;
    const y = p.y + (tRand(z, i + 120) - 0.5) * r * 0.72;
    const h = r * (0.1 + tRand(z, i + 140) * 0.1);
    ctx.strokeStyle = i % 2 ? 'rgba(190,220,135,.6)' : 'rgba(44,76,38,.72)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x - h * 0.45, y - h);
    ctx.moveTo(x, y); ctx.lineTo(x + h * 0.25, y - h * 0.9);
    ctx.stroke();
  }
}

function drawTerrainRainforest(ctx, z, p, r, detail) {
  ctx.fillStyle = 'rgba(8,24,14,.2)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + r * 0.35, r * 0.8, r * 0.2, 0, 0, 7);
  ctx.fill();
  const trees = detail > 0.6 ? 6 : 4;
  for (let i = 0; i < trees; i++) {
    const x = p.x + (tRand(z, i + 160) - 0.5) * r * 1.25;
    const y = p.y + (tRand(z, i + 180) - 0.5) * r * 0.55 + r * 0.12;
    const h = r * (0.28 + tRand(z, i + 200) * 0.28);
    ctx.strokeStyle = '#3c2a18';
    ctx.lineWidth = Math.max(1, r * 0.045);
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x, y - h * 0.6);
    ctx.stroke();
    const cx = x, cy = y - h * 0.72;
    ctx.fillStyle = '#173a26';
    ctx.beginPath(); ctx.arc(cx - h * 0.18, cy + h * 0.08, h * 0.34, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + h * 0.2, cy + h * 0.1, h * 0.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#2f6a43';
    ctx.beginPath(); ctx.arc(cx, cy, h * 0.44, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(130,190,110,.35)';
    ctx.beginPath(); ctx.arc(cx - h * 0.1, cy - h * 0.08, h * 0.2, 0, 7); ctx.fill();
  }
}

function drawTerrainRiver(ctx, z, p, r, lake) {
  if (lake) {
    ctx.fillStyle = 'rgba(15,42,48,.8)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + r * 0.08, r * 0.62, r * 0.3, -0.12, 0, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,220,190,.55)';
    ctx.lineWidth = Math.max(1, r * 0.035);
    ctx.stroke();
    ctx.fillStyle = 'rgba(95,166,181,.65)';
    ctx.beginPath();
    ctx.ellipse(p.x + r * 0.04, p.y + r * 0.04, r * 0.47, r * 0.2, -0.12, 0, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,245,240,.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(p.x - r * 0.12, p.y + r * 0.02, r * 0.28, Math.PI * 1.05, Math.PI * 1.55);
    ctx.stroke();
    return;
  }
  const ang = (tRand(z, 220) - 0.5) * 0.9;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(ang);
  const w = r * 0.95;
  // muddy banks
  ctx.strokeStyle = 'rgba(82,62,38,.55)';
  ctx.lineWidth = Math.max(3, r * 0.28);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-w, r * 0.05);
  ctx.bezierCurveTo(-w * 0.45, -r * 0.3, w * 0.15, -r * 0.22, w * 0.55, -r * 0.08);
  ctx.bezierCurveTo(w * 0.75, 0, w * 0.9, r * 0.08, w, r * 0.02);
  ctx.stroke();
  // water dark
  ctx.strokeStyle = '#1b4c58';
  ctx.lineWidth = Math.max(2, r * 0.2);
  ctx.beginPath();
  ctx.moveTo(-w, r * 0.05);
  ctx.bezierCurveTo(-w * 0.45, -r * 0.3, w * 0.15, -r * 0.22, w * 0.55, -r * 0.08);
  ctx.bezierCurveTo(w * 0.75, 0, w * 0.9, r * 0.08, w, r * 0.02);
  ctx.stroke();
  // water light
  ctx.strokeStyle = '#4b97a8';
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.beginPath();
  ctx.moveTo(-w * 0.95, -r * 0.01);
  ctx.bezierCurveTo(-w * 0.45, -r * 0.31, w * 0.15, -r * 0.23, w * 0.55, -r * 0.09);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(220,250,250,.55)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-w * 0.55, -r * 0.12);
  ctx.bezierCurveTo(-w * 0.2, -r * 0.27, w * 0.2, -r * 0.2, w * 0.45, -r * 0.1);
  ctx.stroke();
  ctx.restore();
}

function drawTerrain(ctx, z, p, pts, path, lum, r, t) {
  if (!z || !z.terrain || r < 7) return;
  const terr = D.TERRAIN[z.terrain];
  if (!terr) return;
  const detail = U.clamp((state.cam.s / fitScale() - 0.35) * 1.4, 0.18, 1);
  ctx.save();
  ctx.clip(path);
  // natural ground under the faction tint
  const g = ctx.createLinearGradient(p.x, p.y - r, p.x, p.y + r);
  const ground = terr.ground || terr.color;
  g.addColorStop(0, terr.ground ? '#6f8350' : terr.light);
  g.addColorStop(0.55, ground);
  g.addColorStop(1, terr.ground ? '#2f4027' : terr.dark);
  ctx.globalAlpha = 0.56;
  ctx.fillStyle = g;
  ctx.fillRect(p.x - r * 1.5, p.y - r * 1.5, r * 3, r * 3);
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = lum > 0.55 ? '#f4f1d2' : '#000';
  ctx.fillRect(p.x - r * 1.5, p.y - r * 1.5, r * 3, r * 3);
  ctx.globalAlpha = 1;
  switch (z.terrain) {
    case 'mountain': drawTerrainMountains(ctx, z, p, r, false, detail); break;
    case 'snow': drawTerrainMountains(ctx, z, p, r, true, detail); break;
    case 'plateau': drawTerrainPlateau(ctx, z, p, r); break;
    case 'desert': drawTerrainDesert(ctx, z, p, r, detail); break;
    case 'grass': drawTerrainGrass(ctx, z, p, r, detail); break;
    case 'rainforest': drawTerrainRainforest(ctx, z, p, r, detail); break;
    case 'river': drawTerrainRiver(ctx, z, p, r, false); break;
    case 'lake': drawTerrainRiver(ctx, z, p, r, true); break;
    default: break;
  }
  // warm light keeps the terrain integrated with the globe shading
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = lum > 0.5 ? '#ffe6a6' : '#09110d';
  ctx.fillRect(p.x - r * 1.5, p.y - r * 1.5, r * 3, r * 3);
  ctx.restore();
}

function drawSphericalRegion(ctx, reg, fill, alpha) {
  const cp = projectV(reg.center);
  if (cp.z < 0.08) return;
  const pts = reg.pts.map(projectV);
  if (pts.every((p) => p.z < 0.02)) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGlobalTree(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(4,10,6,.25)';
  ctx.beginPath(); ctx.ellipse(x + s * 0.2, y + s * 0.08, s * 0.55, s * 0.18, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#3a2816'; ctx.lineWidth = Math.max(1, s * 0.12);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - s * 0.65); ctx.stroke();
  ctx.fillStyle = '#183a25';
  ctx.beginPath(); ctx.arc(x - s * 0.22, y - s * 0.62, s * 0.42, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(x + s * 0.24, y - s * 0.66, s * 0.38, 0, 7); ctx.fill();
  ctx.fillStyle = '#2e6a43';
  ctx.beginPath(); ctx.arc(x, y - s * 0.88, s * 0.5, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(140,200,120,.35)';
  ctx.beginPath(); ctx.arc(x - s * 0.12, y - s * 0.98, s * 0.2, 0, 7); ctx.fill();
}

function drawGlobalMesa(ctx, x, y, s) {
  const w = s * 0.72, topY = y - s * 0.5, botY = y + s * 0.28;
  ctx.fillStyle = 'rgba(4,8,5,.25)';
  ctx.beginPath(); ctx.ellipse(x + s * 0.12, botY + s * 0.08, w * 1.05, s * 0.12, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#4b3524';
  ctx.beginPath();
  ctx.moveTo(x - w, topY); ctx.lineTo(x - w * 0.9, botY); ctx.lineTo(x + w * 0.9, botY); ctx.lineTo(x + w, topY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#74543a';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, topY); ctx.lineTo(x + w, topY); ctx.lineTo(x + w * 0.9, botY); ctx.lineTo(x + w * 0.18, botY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b59068';
  ctx.beginPath();
  ctx.moveTo(x - w, topY); ctx.lineTo(x, topY - s * 0.28); ctx.lineTo(x + w, topY); ctx.lineTo(x, topY + s * 0.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(80,116,61,.9)';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.82, topY); ctx.lineTo(x, topY - s * 0.23); ctx.lineTo(x + w * 0.8, topY); ctx.lineTo(x, topY + s * 0.04); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(235,215,175,.35)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(x - w, topY); ctx.lineTo(x, topY - s * 0.28); ctx.lineTo(x + w, topY); ctx.stroke();
  ctx.strokeStyle = 'rgba(25,15,8,.4)';
  for (let i = 0; i < 2; i++) {
    const yy = topY + s * (0.18 + i * 0.18);
    ctx.beginPath(); ctx.moveTo(x - w * 0.92, yy); ctx.lineTo(x + w * 0.9, yy + s * 0.02); ctx.stroke();
  }
}

function drawGlobalDune(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(70,45,20,.18)';
  ctx.beginPath(); ctx.ellipse(x, y + s * 0.25, s * 0.9, s * 0.18, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#c39b5f';
  ctx.beginPath();
  ctx.moveTo(x - s, y + s * 0.2);
  ctx.bezierCurveTo(x - s * 0.4, y - s * 0.45, x + s * 0.2, y - s * 0.3, x + s, y + s * 0.2);
  ctx.lineTo(x + s, y + s * 0.4); ctx.lineTo(x - s, y + s * 0.4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,225,160,.45)'; ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.75, y + s * 0.12);
  ctx.quadraticCurveTo(x - s * 0.1, y - s * 0.28, x + s * 0.6, y + s * 0.1);
  ctx.stroke();
}

function drawSphericalRiver(ctx, pts, width) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  let prev = null;
  for (const v of pts) {
    const p = projectV(v);
    if (p.z > 0.04) {
      if (prev) {
        ctx.strokeStyle = 'rgba(45,35,22,.42)';
        ctx.lineWidth = width * 2.4;
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.strokeStyle = '#245b6a';
        ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.strokeStyle = 'rgba(95,170,185,.55)';
        ctx.lineWidth = Math.max(0.8, width * 0.42);
        ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      }
      prev = p;
    } else prev = null;
  }
  ctx.restore();
}

function drawRangeBody(ctx, range, size) {
  const runs = [];
  let run = [];
  for (const v of range.pts) {
    const p = projectV(v);
    if (p.z > 0.05) run.push(p);
    else { if (run.length > 2) runs.push(run); run = []; }
  }
  if (run.length > 2) runs.push(run);
  for (const pts of runs) {
    // long cast shadow under the range
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#04100b';
    ctx.lineWidth = size * 1.25;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = pts[i].x + size * 0.42, y = pts[i].y + size * 0.48;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y + size * 0.32);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y + size * 0.32);
    for (let i = pts.length - 1; i >= 0; i--) {
      const h = size * (0.72 + 0.24 * Math.sin(i * 1.7 + range.peaks.length));
      ctx.lineTo(pts[i].x, pts[i].y - h);
    }
    ctx.closePath();
    ctx.fillStyle = range.snow ? 'rgba(102,124,131,.78)' : 'rgba(69,67,58,.78)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(15,17,15,.5)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
}

function drawIceCap(ctx, reg, seed) {
  const cp = projectV(reg.center);
  if (cp.z < 0.08) return;
  const pts = reg.pts.map(projectV);
  const path = new Path2D();
  path.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
  path.closePath();
  const s = state.cam.s;
  const g = ctx.createLinearGradient(cp.x - s * 0.2, cp.y - s * 0.35, cp.x + s * 0.25, cp.y + s * 0.4);
  g.addColorStop(0, '#f2f8f6');
  g.addColorStop(0.55, '#d9e7e4');
  g.addColorStop(1, '#b6cccd');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.clip(path);
  // blue ice fields
  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 4; i++) {
    const p = projectV(reg.pts[(i * 11 + 5) % reg.pts.length]);
    if (p.z < 0.05) continue;
    ctx.fillStyle = i % 2 ? '#9fc2c8' : '#c4dadd';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s * (0.08 + i * 0.018), s * 0.05, 0.4, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // crevasses
  ctx.strokeStyle = 'rgba(75,120,132,.62)';
  ctx.lineWidth = Math.max(1.2, s * 0.005);
  for (let i = 0; i < 6; i++) {
    const a = projectV(reg.pts[(i * 7 + 2) % reg.pts.length]);
    const b = projectV(reg.pts[(i * 7 + 5) % reg.pts.length]);
    if (a.z < 0.05 || b.z < 0.05) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo((a.x + b.x) / 2 + s * 0.018, (a.y + b.y) / 2, b.x, b.y);
    ctx.stroke();
  }
  // interior ice mountains
  for (let i = 0; i < 9; i++) {
    const p = projectV(reg.pts[(i * 5 + 1) % reg.pts.length]);
    if (p.z < 0.04) continue;
    const sz = Math.max(5, s * (0.035 + (i % 3) * 0.012));
    // pull toward center so the cap reads as a ridge, not a ring
    const x = p.x * 0.55 + cp.x * 0.45;
    const y = p.y * 0.55 + cp.y * 0.45;
    drawPeak(ctx, x, y + sz * 0.16, sz * 0.7, sz * 1.35, '#e6f1f0', '#849fa5', true);
  }
  // low ice ridges
  drawPeak(ctx, cp.x, cp.y + s * 0.02, s * 0.065, s * 0.12, '#e7f0ef', '#93afb4', true);
  for (let i = 0; i < 7; i++) {
    const p = i === 0 ? cp : projectV(reg.pts[(i * 9 + 4) % reg.pts.length]);
    if (p.z < 0.05) continue;
    const sz = Math.max(5, s * 0.052);
    drawPeak(ctx, p.x, p.y + sz * 0.2, sz * 0.55, sz * 0.95, '#e7f0ef', '#93afb4', true);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(230,245,244,.55)';
  ctx.lineWidth = Math.max(1, s * 0.004);
  ctx.stroke(path);
}

function drawDesertTexture(ctx, d, s, seed) {
  const pts = d.pts.map(projectV);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,228,165,.28)';
  ctx.lineWidth = Math.max(0.7, s * 0.002);
  for (let i = 0; i < 22; i++) {
    const p = pts[(i * 5 + 3) % pts.length];
    if (p.z < 0.05) continue;
    const w = Math.max(2, s * 0.035);
    ctx.beginPath();
    ctx.moveTo(p.x - w, p.y + w * 0.15);
    ctx.quadraticCurveTo(p.x, p.y - w * 0.35, p.x + w, p.y + w * 0.08);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOceanRegion(ctx, o, s, seed) {
  const cp = projectV(o.center);
  if (cp.z < 0.08) return;
  const pts = o.pts.map(projectV);
  const path = new Path2D();
  path.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
  path.closePath();
  const g = ctx.createLinearGradient(cp.x - s * 0.25, cp.y - s * 0.35, cp.x + s * 0.3, cp.y + s * 0.38);
  g.addColorStop(0, '#2c8294');
  g.addColorStop(0.55, '#14566b');
  g.addColorStop(1, '#0a3445');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fill(path);
  ctx.clip(path);
  // wave bands
  ctx.strokeStyle = 'rgba(155,225,225,.22)';
  ctx.lineWidth = Math.max(0.8, s * 0.003);
  for (let i = 0; i < 12; i++) {
    const p = projectV(o.pts[(i * 7 + 3) % o.pts.length]);
    if (p.z < 0.06) continue;
    const w = s * (0.02 + (i % 3) * 0.012);
    ctx.beginPath();
    ctx.moveTo(p.x - w, p.y);
    ctx.quadraticCurveTo(p.x, p.y - w * 0.35, p.x + w, p.y);
    ctx.stroke();
  }
  // sun glints
  ctx.fillStyle = 'rgba(225,255,245,.5)';
  for (let i = 0; i < 7; i++) {
    const p = projectV(o.pts[(i * 11 + 5) % o.pts.length]);
    if (p.z < 0.12) continue;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, s * 0.009, s * 0.0025, -0.2, 0, 7); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(205,245,235,.55)';
  ctx.lineWidth = Math.max(1, s * 0.005);
  ctx.stroke(path);
  // shallow shore
  ctx.save();
  ctx.strokeStyle = 'rgba(115,205,200,.32)';
  ctx.lineWidth = Math.max(2, s * 0.014);
  ctx.stroke(path);
  ctx.restore();
}

function drawTerrainWorld(ctx, t) {
  const tw = state.terrainWorld;
  if (!tw) return;
  const C = sphereCenter(), s = state.cam.s;
  const low = state.W < 760;
  // planetary grass/steppe base
  ctx.fillStyle = '#5b7449';
  ctx.fillRect(C.x - s, C.y - s, s * 2, s * 2);
  const base = ctx.createRadialGradient(C.x - s * 0.3, C.y - s * 0.35, s * 0.1, C.x, C.y, s * 1.02);
  base.addColorStop(0, 'rgba(255,240,190,.08)');
  base.addColorStop(0.6, 'rgba(0,0,0,0)');
  base.addColorStop(1, 'rgba(0,0,0,.18)');
  ctx.fillStyle = base;
  ctx.fillRect(C.x - s, C.y - s, s * 2, s * 2);

  // oceans (coastal water reads through the territory layer)
  for (const o of tw.oceans) drawOceanRegion(ctx, o, s, tw.seed);
  // polar ice caps
  drawIceCap(ctx, tw.capN, tw.seed + 1);
  drawIceCap(ctx, tw.capS, tw.seed + 2);
  // arid zones
  for (const d of tw.deserts) {
    drawSphericalRegion(ctx, d, '#b28a54', 0.9);
    ctx.save();
    drawDesertTexture(ctx, d, s, tw.seed);
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < tw.dunes.length; i++) {
      const du = tw.dunes[i];
      if (!d.pts.includes(du.v)) continue;
      const p = projectV(du.v);
      if (p.z > 0.04) drawGlobalDune(ctx, p.x, p.y, Math.max(4, s * 0.035 * du.s));
    }
    ctx.restore();
  }
  // tropical forests
  for (const f of tw.forests) drawSphericalRegion(ctx, f, '#2d5637', 0.88);
  // plateau grounds
  for (const pl of tw.plateaus) drawSphericalRegion(ctx, pl, '#8c6b4b', 0.9);
  // lakes
  for (const l of tw.lakes) drawSphericalRegion(ctx, l, '#245b6a', 0.9);

  // rivers: continuous planetary waterways
  for (const r of tw.rivers) drawSphericalRiver(ctx, r, Math.max(1.2, s * 0.011));

  // range footprints
  ctx.save();
  for (const range of tw.ranges) {
    ctx.strokeStyle = 'rgba(74,70,60,.38)';
    ctx.lineWidth = Math.max(5, s * 0.052);
    ctx.lineCap = 'round';
    let prev = null;
    for (const v of range.pts) {
      const p = projectV(v);
      if (p.z > 0.04) {
        if (prev) { ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke(); }
        prev = p;
      } else prev = null;
    }
  }
  ctx.restore();

  // continuous mountain-range bodies, then individual peaks
  for (const range of tw.ranges) drawRangeBody(ctx, range, Math.max(4, s * 0.055));

  // features sorted by depth
  const items = [];
  let peakIdx = 0;
  for (const range of tw.ranges) {
    for (const pk of range.peaks) {
      peakIdx++;
      if (low && peakIdx % 2) continue;
      const p = projectV(pk.v);
      if (p.z > 0.06) items.push({ kind: 'peak', p, s: Math.max(4, s * 0.047 * pk.h * (0.62 + 0.55 * Math.max(0, p.z))), snow: pk.snow });
    }
  }
  for (let ti = 0; ti < tw.trees.length; ti++) {
    if (low && ti % 3) continue;
    const tr = tw.trees[ti];
    const p = projectV(tr.v);
    if (p.z > 0.06) items.push({ kind: 'tree', p, s: Math.max(3, s * 0.032 * tr.s * (0.62 + 0.55 * Math.max(0, p.z))) });
  }
  for (const m of tw.mesas) {
    const p = projectV(m.v);
    if (p.z > 0.06) items.push({ kind: 'mesa', p, s: Math.max(4, s * 0.058 * m.s * (0.62 + 0.55 * Math.max(0, p.z))) });
  }
  items.sort((a, b) => a.p.z - b.p.z);
  for (const it of items) {
    if (it.kind === 'peak') {
      drawPeak(ctx, it.p.x, it.p.y + it.s * 0.35, it.s * 0.78, it.s * 1.65,
        it.snow ? '#95a6aa' : '#8d8578', it.snow ? '#4e6166' : '#4a463f', it.snow);
    } else if (it.kind === 'tree') {
      drawGlobalTree(ctx, it.p.x, it.p.y, it.s);
    } else if (it.kind === 'mesa') {
      drawGlobalMesa(ctx, it.p.x, it.p.y, it.s);
    }
  }
  // soft cloud shadows give the planet another layer of depth
  for (let i = 0; i < 5; i++) {
    const v = sphVec(1.0 + (terrainNoise([i, 2, 9], tw.seed) - 0.5) * 0.7,
      (i / 5) * Math.PI * 2 + terrainNoise([i, 5, 4], tw.seed) * 0.8);
    const p = projectV(v);
    if (p.z < 0.12) continue;
    ctx.save();
    ctx.globalAlpha = 0.055;
    ctx.fillStyle = '#06110f';
    ctx.beginPath();
    ctx.ellipse(p.x + s * 0.02, p.y + s * 0.01, s * (0.11 + i * 0.012), s * 0.035, -0.35, 0, 7);
    ctx.fill();
    ctx.restore();
  }
  // atmospheric rim
  const haze = ctx.createRadialGradient(C.x, C.y, s * 0.58, C.x, C.y, s * 1.02);
  haze.addColorStop(0, 'rgba(170,215,225,0)');
  haze.addColorStop(0.88, 'rgba(170,215,225,.035)');
  haze.addColorStop(1, 'rgba(210,240,240,.16)');
  ctx.fillStyle = haze;
  ctx.beginPath(); ctx.arc(C.x, C.y, s, 0, 7); ctx.fill();
  // sparse grass texture on the steppe base
  if (!low) {
    ctx.save();
    ctx.strokeStyle = 'rgba(160,190,110,.18)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 44; i++) {
      const v = sphVec(1.0 + (terrainNoise([i, 3, 7], tw.seed) - 0.5) * 0.8,
        (i / 44) * Math.PI * 2 + terrainNoise([i, 9, 2], tw.seed) * 0.5);
      const p = projectV(v);
      if (p.z < 0.05) continue;
      const h = Math.max(1.2, s * 0.008);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - h * 0.4, p.y - h); ctx.stroke();
    }
    ctx.restore();
  }
}


function battleResult(zoneId, info) {
  state.resultFx = (state.resultFx || []).filter((r) => r.zone !== zoneId);
  state.resultFx.push(Object.assign({ zone: zoneId, t0: performance.now() }, info || {}));
  if (state.resultFx.length > 12) state.resultFx.splice(0, state.resultFx.length - 12);
  state.needs = true;
}

function drawBattleResults(ctx, t) {
  if (!state.resultFx || !state.resultFx.length) return;
  const z = mapZoom();
  const keep = [];
  const cards = [];
  for (const r of state.resultFx) {
    const age = t - r.t0;
    if (age > 6200) continue;
    keep.push(r);
    const zone = state.byId[r.zone];
    if (!zone) continue;
    const p = projectV(zone.vCenter);
    if (p.z < 0.05) continue;
    const a = age > 5000 ? Math.max(0, 1 - (age - 5000) / 1200) : 1;
    const lines = [];
    if (r.attacker && r.attackerDead > 0) lines.push({ text: D.CLAN[r.attacker].name + ' 阵亡 ' + r.attackerDead, color: D.CLAN[r.attacker].color });
    if (r.defender && r.defenderDead > 0 && r.defender !== r.attacker) lines.push({ text: D.CLAN[r.defender].name + ' 阵亡 ' + r.defenderDead, color: D.CLAN[r.defender].color });
    if (r.loot > 0) lines.push({ text: D.CLAN[r.attacker].name + ' 掠夺 +' + U.fmt(r.loot, 0) + ' ORE', color: '#f2ce4b' });
    if (!lines.length) lines.push({ text: '战斗结束', color: '#f3ead7' });
    cards.push({ p, a, lines, z });
  }
  state.resultFx = keep;
  if (!cards.length) return;
  cards.sort((a, b) => a.p.y - b.p.y);
  const used = [];
  for (const card of cards) {
    const fs = 11 * z;
    ctx.font = '800 ' + fs.toFixed(1) + 'px "PingFang SC", "Noto Sans SC", sans-serif';
    let w = 0;
    for (const line of card.lines) w = Math.max(w, ctx.measureText(line.text).width);
    const pad = 7 * z;
    const lh = fs + 4 * z;
    const bw = w + pad * 2;
    const bh = card.lines.length * lh + pad * 2;
    let bx = card.p.x - bw / 2;
    let by = card.p.y - 30 * z - bh;
    bx = Math.max(state.insets.l + 4, Math.min(state.W - state.insets.r - bw - 4, bx));
    by = Math.max(state.insets.t + 4, Math.min(state.H - state.insets.b - bh - 4, by));
    // stack cards if they share roughly the same screen spot
    let guard = 0;
    while (used.some((r) => Math.abs(r.x - bx) < r.w && Math.abs(r.y - by) < r.h) && guard++ < 6) by -= bh + 4;
    used.push({ x: bx, y: by, w: bw, h: bh });
    ctx.save();
    ctx.globalAlpha = card.a;
    ctx.fillStyle = 'rgba(5,8,9,.94)';
    rr(ctx, bx, by, bw, bh, 4 * z); ctx.fill();
    ctx.strokeStyle = U.rgba(card.lines[0].color, 0.35); ctx.lineWidth = 0.9; ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    let ty = by + pad + lh / 2;
    for (const line of card.lines) {
      ctx.font = '700 ' + fs.toFixed(1) + 'px "PingFang SC", "Noto Sans SC", sans-serif';
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, bx + pad, ty);
      ty += lh;
    }
    ctx.restore();
  }
}

function draw(t) {
  const ctx = state.ctx, W = state.W, H = state.H, dpr = state.dpr;
  const c = clearRect(), C = sphereCenter(), s = state.cam.s;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const use3d = state.terrainMode === '3d' && ORE.globe3d && ORE.globe3d.ready();
  if (use3d) {
    ctx.clearRect(0, 0, W, H);
  } else {
    ctx.fillStyle = '#050809';
    ctx.fillRect(0, 0, W, H);
  }

  // stars
  for (const st of state.stars) {
    ctx.globalAlpha = 0.08 + st[2] * 0.18;
    ctx.fillStyle = '#e9dfc8';
    ctx.beginPath(); ctx.arc(st[0], st[1], 0.7 + st[2] * 1.1, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 2D sphere base only for the faction layer / WebGL fallback
  if (!use3d) {
    const base = ctx.createRadialGradient(C.x - s * 0.34, C.y - s * 0.38, s * 0.08, C.x, C.y, s * 1.02);
    base.addColorStop(0, '#17231f');
    base.addColorStop(0.58, '#0b1110');
    base.addColorStop(1, '#030605');
    ctx.beginPath(); ctx.arc(C.x, C.y, s, 0, 7); ctx.fillStyle = base; ctx.fill();
  }

  ctx.save();
  ctx.beginPath(); ctx.arc(C.x, C.y, s, 0, 7); ctx.clip();

  if (state.terrainMode === '3d' && !use3d) drawTerrainWorld(ctx, t);

  // depth sort only front cells
  const vis = [];
  for (const z of state.cells) {
    const p = projectCell(z);
    if (p.z > -0.06) vis.push({ z, p });
  }
  vis.sort((a, b) => a.p.z - b.p.z);

  const pulse = 0.5 + 0.5 * Math.sin(t / 480);
  for (const item of vis) {
    const z = item.z, row = state.rows[z.id] || {};
    const owner = row.owner || z.owner;
    const clan = owner ? D.CLAN[owner] : null;
    const pts = screenPoly(z);
    const path = polyPath(pts, 2.4);
    const normal = item.p.r;
    const lum = U.clamp(0.55 + 0.45 * Math.max(0, normal[0] * LIGHT[0] + normal[1] * LIGHT[1] + normal[2] * LIGHT[2]), 0, 1);
    const rel = z.relYield || 0;
    let cr = 0;
    for (const pp of pts) cr += Math.hypot(pp.x - item.p.x, pp.y - item.p.y);
    cr = Math.max(10, (cr / Math.max(1, pts.length)) * 1.02);
    const fill = U.shade(clan.color, -0.64 + rel * 0.26 + lum * 0.06);
    if (state.terrainMode === '3d') {
      ctx.save();
      ctx.fillStyle = fill;
      ctx.globalAlpha = 0.11;
      ctx.fill(path);
      ctx.restore();
      // One border, in the faction colour: ownership and edge are the same signal.
      if (clan) {
        ctx.strokeStyle = U.rgba(clan.color, 0.22);
        ctx.lineWidth = 0.52;
      } else {
        ctx.strokeStyle = 'rgba(3,6,6,.11)';
        ctx.lineWidth = 0.45;
      }
      ctx.stroke(path);
    } else {
      ctx.fillStyle = fill;
      ctx.fill(path);
      ctx.strokeStyle = '#030606';
      ctx.lineWidth = 1.5;
      ctx.stroke(path);
    }

    if (rel > 0.62) {
      ctx.strokeStyle = 'rgba(242,206,75,' + (0.12 + (rel - 0.62) * 0.8).toFixed(3) + ')';
      ctx.lineWidth = 1.1; ctx.stroke(path);
    }
    if (z.id === state.selected) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(path);
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.12 + pulse * 0.16) + ')';
      ctx.lineWidth = 9; ctx.stroke(path);
    }
    if (state.targets && state.targets.has(z.id) && z.id !== state.selected) {
      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -(t / 55) % 12;
      ctx.strokeStyle = 'rgba(255,255,255,.2)';
      ctx.lineWidth = 1.2; ctx.stroke(path);
      ctx.restore();
    }
  }

  if (!use3d) drawGraticule(ctx);

  // 3D light / terminator
  if (!use3d) {
    const sh = ctx.createRadialGradient(C.x - s * 0.38, C.y - s * 0.42, s * 0.05, C.x, C.y, s * 1.03);
    sh.addColorStop(0, 'rgba(255,242,210,.10)');
    sh.addColorStop(0.5, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(0,0,0,.44)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(C.x, C.y, s, 0, 7); ctx.fill();
  }
  ctx.restore();

  // rim
  if (!use3d) {
  ctx.strokeStyle = 'rgba(236,227,206,.14)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(C.x, C.y, s, 0, 7); ctx.stroke();
  ctx.strokeStyle = 'rgba(242,206,75,.05)';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(C.x, C.y, s + 3, 0, 7); ctx.stroke();
  }

  drawSectorNames(ctx);
  drawLabels(ctx);
  if (!use3d) drawBases(ctx, t);
  drawOwnerMarks(ctx, t);
  drawBaseLabels(ctx);
  drawMarches(ctx, t);
  drawSpawns(ctx, t);
  drawSieges(ctx, t);
  drawBattleMarks(ctx, t);
  drawSelection(ctx, t);

  for (let i = state.rings.length - 1; i >= 0; i--) {
    const r = state.rings[i], k = (t - r.t0) / r.dur;
    if (k >= 1) { state.rings.splice(i, 1); continue; }
    if (k < 0) continue;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = (r.w || 2) * (1 - k) + 0.6;
    ctx.beginPath(); ctx.arc(r.x, r.y, 8 + k * r.R, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (state.hover >= 0) drawTooltip(ctx, state.hover);
  // Result cards are above every map icon, avatar and label.
  drawBattleResults(ctx, t);
}

function drawGraticule(ctx) {
  drawSphereArc(Math.PI / 2, 'rgba(242,206,75,.16)', 1.2, [4, 7]);
  for (const deg of [0, 120, 240]) {
    drawMeridian(deg * Math.PI / 180, 'rgba(236,227,206,.075)', 0.9, [5, 7]);
  }
  for (const deg of [60, 180, 300]) {
    drawMeridian(deg * Math.PI / 180, 'rgba(242,206,75,.10)', 1.0, [2, 6]);
  }
}
function drawSphereArc(theta, color, width, dash) {
  const ctx = state.ctx;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
  let prev = null;
  for (let i = 0; i <= 120; i++) {
    const phi = (i / 120) * Math.PI * 2;
    const p = projectV(pointAt(theta, phi));
    if (prev && p.z > 0.01 && prev.z > 0.01) {
      ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    prev = p;
  }
  ctx.restore();
}
function drawMeridian(phi, color, width, dash) {
  const ctx = state.ctx;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
  let prev = null;
  for (let i = 0; i <= 60; i++) {
    const th = (i / 60) * Math.PI;
    const p = projectV(pointAt(th, phi));
    if (prev && p.z > 0.01 && prev.z > 0.01) {
      ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    prev = p;
  }
  ctx.restore();
}

function avatarEntry(id) {
  if (AVATAR_CACHE.has(id)) return AVATAR_CACHE.get(id);
  const so = ORE.game && ORE.game.soldier ? ORE.game.soldier(id) : null;
  if (!so || !ORE.avatar) return null;
  const e = { img: new Image(), ready: false };
  e.img.onload = () => { e.ready = true; state.needs = true; };
  e.img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ORE.avatar.portrait(so));
  AVATAR_CACHE.set(id, e);
  return e;
}
function mapZoom() {
  return Math.max(0.08, state.cam.s / Math.max(1, fitScale()));
}
function mapTextScale() {
  if (state.W < 760) return 0.58;
  if (state.W < 1050) return 0.82;
  return 1;
}
function avatarRadius() {
  const base = state.W < 760 ? state.cam.s * 0.045 : state.cam.s * 0.055;
  return base * 2;
}
function drawHoe(ctx, x, y, s, ang, col) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.lineCap = 'round';
  // handle
  ctx.strokeStyle = '#050809'; ctx.lineWidth = Math.max(3, s * 0.18);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * 1.35); ctx.stroke();
  ctx.strokeStyle = '#b9853c'; ctx.lineWidth = Math.max(1.5, s * 0.09);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * 1.35); ctx.stroke();
  // hoe blade
  ctx.beginPath();
  ctx.moveTo(0, s * 1.26);
  ctx.lineTo(s * 0.75, s * 1.12);
  ctx.lineTo(s * 0.62, s * 1.48);
  ctx.lineTo(0, s * 1.42);
  ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(s * 0.16, s * 1.24); ctx.lineTo(s * 0.58, s * 1.19); ctx.stroke();
  ctx.restore();
}
function drawPickaxe(ctx, x, y, s, ang, col) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.lineCap = 'round';
  // wooden handle
  ctx.strokeStyle = '#050809'; ctx.lineWidth = Math.max(3, s * 0.17);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * 1.38); ctx.stroke();
  ctx.strokeStyle = '#a87535'; ctx.lineWidth = Math.max(1.5, s * 0.09);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * 1.38); ctx.stroke();
  // pick head: curved double point
  ctx.beginPath();
  ctx.moveTo(-s * 0.72, s * 1.10);
  ctx.quadraticCurveTo(0, s * 0.90, s * 0.72, s * 1.10);
  ctx.quadraticCurveTo(s * 0.42, s * 1.17, s * 0.18, s * 1.28);
  ctx.quadraticCurveTo(0, s * 1.18, -s * 0.18, s * 1.28);
  ctx.quadraticCurveTo(-s * 0.42, s * 1.17, -s * 0.72, s * 1.10);
  ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 1.7; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 1.08); ctx.quadraticCurveTo(0, s * 0.98, s * 0.5, s * 1.08); ctx.stroke();
  ctx.restore();
}
function drawMiningFx(ctx, z, p, r, t) {
  const rate = state.rates[z.id] || 0;
  const perSec = rate / 60;
  const phase = (t / 1000 + (z.id % 17) * 0.061) % 1;
  const lift = phase < 0.45 ? phase / 0.45 : 1 - (phase - 0.45) / 0.55;
  const ang = -1.10 + lift * 1.70;
  const dir = z.kind === 'base' ? 1 : -1;
  // keep the pickaxe inside the tile, beside the miner avatar
  const hx = p.x + dir * r * 0.92;
  const hy = p.y + r * 0.16;
  const hs = r * 0.95;
  drawPickaxe(ctx, hx, hy, hs, dir * ang, '#f2ce4b');

  // impact sparks
  if (phase >= 0.44 && phase < 0.66) {
    const k = (phase - 0.44) / 0.22;
    ctx.fillStyle = 'rgba(255,220,120,' + (0.9 * (1 - k)).toFixed(3) + ')';
    for (let i = 0; i < 3; i++) {
      const a = -0.8 + i * 0.7;
      const d = 3 + k * 9;
      ctx.beginPath(); ctx.arc(hx + Math.cos(a) * d + dir * 3, hy + hs * 1.3 - Math.sin(a) * d, 1.2, 0, 7); ctx.fill();
    }
  }

  // once-per-second +ORE floating text
  if (phase >= 0.44) {
    const k = (phase - 0.44) / 0.56;
    const val = perSec >= 1 ? perSec.toFixed(1) : perSec >= 0.01 ? perSec.toFixed(2) : perSec.toFixed(3);
    const ty = hy - hs * 1.05 - k * r * 1.65;
    const tx = hx + dir * r * 0.15;
    ctx.globalAlpha = 1 - k;
    ctx.font = '800 ' + Math.max(5, r * 0.50).toFixed(1) + 'px "Space Grotesk", "PingFang SC", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(5,8,9,.92)'; ctx.lineWidth = 3.4;
    ctx.strokeText('+' + val, tx, ty);
    ctx.fillStyle = '#f2ce4b';
    ctx.fillText('+' + val, tx, ty);
    ctx.globalAlpha = 1;
  }
}
function drawTroopAvatar(ctx, so, z, row, p, t, r) {
  r = r || avatarRadius();
  const isBase = z.kind === 'base';
  const cx = isBase ? p.x - r * 2.85 : p.x;
  const cy = isBase ? p.y + r * 1.45 : p.y - r * 0.28;
  const col = D.CLAN[row.owner].color;
  const e = avatarEntry(row.avatar);

  // faction flag pin
  ctx.save();
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx + r * 0.58, cy - r * 0.42); ctx.lineTo(cx + r * 0.58, cy - r * 1.62); ctx.stroke();
  ctx.strokeStyle = '#d8d1c2'; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(cx + r * 0.58, cy - r * 0.42); ctx.lineTo(cx + r * 0.58, cy - r * 1.62); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.58, cy - r * 1.62);
  ctx.lineTo(cx + r * 1.62, cy - r * 1.38);
  ctx.lineTo(cx + r * 0.58, cy - r * 1.12);
  ctx.closePath();
  ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = '#050809'; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.restore();

  // avatar portrait clipped to a circle
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.closePath();
  ctx.fillStyle = U.shade(col, -0.72); ctx.fill();
  ctx.clip();
  if (e && e.ready) ctx.drawImage(e.img, cx - r, cy - r, r * 2, r * 2);
  else {
    ctx.fillStyle = U.shade(col, -0.38);
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(5,8,9,.55)';
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.2, r * 0.72, 0, 7); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(cx, cy, r - 1.4, 0, 7); ctx.stroke();

  // total ATK banner on the avatar
  const num = row.atk || 0;
  const label = 'ATK ' + (num >= 1000 ? (num / 1000).toFixed(1) + 'k' : Math.round(num));
  ctx.font = '800 ' + Math.max(7, r * 0.47).toFixed(1) + 'px "Space Grotesk", "PingFang SC", sans-serif';
  const w = ctx.measureText(label).width + 7;
  const bh = Math.max(10, r * 0.56);
  const bx = cx - w / 2;
  const by = cy + r - bh * 0.76;
  ctx.fillStyle = 'rgba(5,8,9,.92)';
  rr(ctx, bx, by, w, bh, 3); ctx.fill();
  ctx.strokeStyle = U.rgba(col, 0.9); ctx.lineWidth = 0.9; ctx.stroke();
  ctx.fillStyle = '#f7f0df'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, by + bh / 2 + 0.4);

  drawMiningFx(ctx, z, p, r, t);

  // hovering name for the selected/zoomed tile is handled by drawLabels
}

function drawOwnerMarks(ctx, t) {
  const r = avatarRadius();
  const items = [];
  for (const z of state.cells) {
    const row = state.rows[z.id] || {};
    if (row.owner !== state.me || !(row.garrison > 0) || !row.avatar) continue;
    const p = projectCell(z);
    if (p.z < 0.12) continue;
    if ((state.battles || []).some((b) => { const bt = state.byId[b.to]; if (!bt) return false; const bp = projectCell(bt); return Math.hypot(bp.x - p.x, bp.y - p.y) < 140; })) continue;
    items.push({ z, row, p });
  }
  const cull = state.W < 760 && state.cam.s < fitScale() * 2.0;
  if (cull) items.sort((a, b) => (b.row.atk || 0) - (a.row.atk || 0));
  const used = [];
  for (const it of items) {
    if (cull && used.some((q) => Math.hypot(q[0] - it.p.x, q[1] - it.p.y) < Math.max(36, r * 3.6))) continue;
    if (cull) used.push([it.p.x, it.p.y]);
    drawTroopAvatar(ctx, null, it.z, it.row, it.p, t, it.z.kind === 'base' ? r * 0.62 : r * 0.70);
  }
}
function drawShield(ctx, x, y, color, s) {
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.9); ctx.lineTo(s * 0.8, -s * 0.45); ctx.lineTo(s * 0.65, s * 0.45); ctx.lineTo(0, s); ctx.lineTo(-s * 0.65, s * 0.45); ctx.lineTo(-s * 0.8, -s * 0.45); ctx.closePath();
  ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}
function drawMiniFlag(ctx, x, y, color, s, t, mine) {
  const wave = Math.sin(t / 150 + x * 0.03) * 1.2;
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2.8;
  ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, -s * 2.2); ctx.stroke();
  ctx.strokeStyle = '#d8d1c2'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, -s * 2.2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -s * 2.2);
  ctx.lineTo(s * 1.5 + wave, -s * 1.85 + wave * 0.4);
  ctx.lineTo(s * 1.2 + wave, -s * 1.1 + wave * 0.3);
  ctx.lineTo(0, -s * 1.35);
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.4; ctx.stroke();
  if (mine) { ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 0.8; ctx.stroke(); }
  ctx.restore();
}
function mixHex(a, b, t) {
  const pa = a.replace('#', ''), pb = b.replace('#', '');
  const n = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  const A = n(pa), B = n(pb);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return '#' + c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}
function citadelBox(ctx, x, y, w, h, d, face, side, top) {
  // isometric right side
  ctx.beginPath();
  ctx.moveTo(x + w, y); ctx.lineTo(x + w + d, y - d);
  ctx.lineTo(x + w + d, y + h - d); ctx.lineTo(x + w, y + h);
  ctx.closePath(); ctx.fillStyle = side; ctx.fill();
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 1.7; ctx.stroke();
  // top face
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + d, y - d);
  ctx.lineTo(x + w + d, y - d); ctx.lineTo(x + w, y);
  ctx.closePath(); ctx.fillStyle = top; ctx.fill();
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 1.7; ctx.stroke();
  // front face
  ctx.fillStyle = face;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
}
function drawCitadel(ctx, x, y, color, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const face = mixHex(color, '#cfc5b0', 0.64);
  const side = mixHex(color, '#5f584d', 0.60);
  const top = mixHex(color, '#e8dec8', 0.76);
  const dark = mixHex(color, '#2c211d', 0.68);

  // ground shadow
  const sh = ctx.createRadialGradient(0, 13, 2, 0, 13, 28);
  sh.addColorStop(0, 'rgba(0,0,0,.58)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.beginPath(); ctx.ellipse(0, 13, 27, 8, 0, 0, 7); ctx.fill();

  // deep rear keep (3D depth)
  citadelBox(ctx, -14, -19, 28, 31, 6, dark, U.shade(color, -0.78), U.shade(color, -0.45));

  // main curtain wall
  citadelBox(ctx, -12, -9, 24, 21, 5, face, side, top);

  // tall corner towers
  citadelBox(ctx, -19, -24, 9, 36, 5, face, side, top);
  citadelBox(ctx, 10, -26, 9, 38, 5, face, side, top);

  // wall crenellations
  const merlon = (mx, my, mw, mh) => citadelBox(ctx, mx, my, mw, mh, 3, U.shade(color, -0.30), U.shade(color, -0.58), U.shade(color, 0.12));
  for (let i = 0; i < 5; i++) merlon(-11 + i * 4.7, -12, 2.8, 4);
  merlon(-18, -27, 2.5, 4);
  merlon(-14.5, -27, 2.5, 4);
  merlon(11, -29, 2.5, 4);
  merlon(14.5, -29, 2.5, 4);

  // gate + portcullis
  ctx.beginPath();
  ctx.moveTo(-4.4, 12); ctx.lineTo(-4.4, 2.5);
  ctx.quadraticCurveTo(0, -1.5, 4.4, 2.5);
  ctx.lineTo(4.4, 12); ctx.closePath();
  ctx.fillStyle = '#080908'; ctx.fill();
  ctx.strokeStyle = '#d8d1c2'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.strokeStyle = 'rgba(216,209,194,.55)'; ctx.lineWidth = 0.8;
  for (let i = -3; i <= 3; i += 2) {
    ctx.beginPath(); ctx.moveTo(i, 12); ctx.lineTo(i, 2.4); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(-4.2, 5); ctx.lineTo(4.2, 5); ctx.stroke();

  // arrow slits
  ctx.fillStyle = 'rgba(0,0,0,.8)';
  for (const [wx, wy] of [[-15, -6], [-15, 3], [14, -8], [14, 1]]) {
    ctx.fillRect(wx, wy, 1.8, 7);
  }

  // banner pole and flag
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(0, -48); ctx.stroke();
  ctx.strokeStyle = '#d8d1c2'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(0, -48); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -48); ctx.lineTo(15, -42.5); ctx.lineTo(0, -36); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(2, -45.5); ctx.lineTo(10, -42.5); ctx.stroke();
  ctx.restore();
}

function drawBases(ctx, t) {
  const pulse = 0.5 + 0.5 * Math.sin(t / 460);
  for (const key of BASE_CLANS) {
    const b = state.world.baseByClan[key];
    if (!b) continue;
    const p = projectV(b.vCenter);
    if (p.z < 0.04) continue;
    const col = D.CLAN[key].color;
    ctx.strokeStyle = U.rgba(col, 0.35 + pulse * 0.2);
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 24 + pulse * 5, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(242,206,75,.35)';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(p.x, p.y, 34 + pulse * 4, 0, 7); ctx.stroke();
    const cs = U.clamp(state.cam.s * 0.038, 1.0, 1.58);
    drawCitadel(ctx, p.x, p.y + 2, col, cs);
  }
}
function drawBaseLabels(ctx) {
  const z = mapZoom();
  const ms = mapTextScale();
  for (const key of BASE_CLANS) {
    const b = state.world.baseByClan[key];
    if (!b) continue;
    const p = projectV(b.vCenter);
    if (p.z < 0.04) continue;
    const col = D.CLAN[key].color;
    const label = (b.code || '') + ' · ' + (ORE.i18n ? ORE.i18n.clan(key) : D.CLAN[key].name);
    ctx.font = '800 ' + (20 * z * ms).toFixed(1) + 'px "PingFang SC", "Noto Sans SC", sans-serif';
    const w = ctx.measureText(label).width + 28 * z * ms;
    let ly = p.y + 96 * z * ms;
    if (ly > state.H - state.insets.b - 10) ly = p.y - 84 * z * ms;
    ctx.fillStyle = 'rgba(5,8,9,.92)';
    rr(ctx, p.x - w / 2, ly - 14 * z * ms, w, 28 * z * ms, 8 * z * ms); ctx.fill();
    ctx.strokeStyle = U.rgba(col, 0.8); ctx.lineWidth = 1.8 * z * ms; ctx.stroke();
    ctx.fillStyle = '#f5e9c9'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x, ly);
  }
}
function drawSectorNames(ctx) {
  if (state.W < 760) return;
  const z = mapZoom();
  const ms = mapTextScale();
  const names = [
    ['ember', 0],
    ['tide', Math.PI * 2 / 3],
    ['dune', Math.PI * 4 / 3],
  ];
  for (const [key, phi] of names) {
    const p = projectV(pointAt(Math.PI * 0.30, phi));
    if (p.z < 0.08) continue;
    ctx.font = '800 ' + (22 * z * ms).toFixed(1) + 'px "PingFang SC", "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = U.rgba(D.CLAN[key].color, 0.50);
    ctx.fillText(ORE.i18n ? ORE.i18n.clan(key) : D.CLAN[key].name, p.x, p.y);
  }
}

function drawLabels(ctx) {
  const cam = state.cam, fs = fitScale(), ins = state.insets;
  const z = mapZoom();
  const ms = mapTextScale();
  const showNames = cam.s > fs * 1.04;
  const showRate = cam.s > fs * 1.16;
  if (!showNames) return;
  const used = [];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const z of state.cells) {
    if (z.kind !== 'mine') continue;
    const p = projectCell(z);
    if (p.z < 0.12) continue;
    if (p.x < ins.l + 30 || p.x > state.W - ins.r - 30 || p.y < ins.t + 8 || p.y > state.H - ins.b - 12) continue;
    if ((state.battles || []).some((b) => { const bt = state.byId[b.to]; if (!bt) return false; const bp = projectCell(bt); return Math.hypot(bp.x - p.x, bp.y - p.y) < 135; })) continue;
    if (used.some((q) => Math.hypot(q[0] - p.x, q[1] - p.y) < (showRate ? 152 : 132) * z * ms)) continue;
    used.push([p.x, p.y]);
    const row = state.rows[z.id] || {};
    ctx.font = '700 ' + (22 * z * ms).toFixed(1) + 'px "PingFang SC", "Noto Sans SC", sans-serif';
    ctx.fillStyle = row.owner === state.me ? '#fff' : 'rgba(236,227,206,.68)';
    ctx.fillText(z.name, p.x, p.y + 54 * z * ms);
    if (showRate) {
      ctx.font = '600 ' + (19 * z * ms).toFixed(1) + 'px "Space Grotesk", "PingFang SC", monospace';
      ctx.fillStyle = 'rgba(242,206,75,.82)';
      const rate = state.rates[z.id] || 0;
      ctx.fillText(rate.toFixed(1) + '/m', p.x, p.y + 76 * z * ms);
    }
  }
}
function drawSelection(ctx, t) {
  if (state.selected < 0) return;
  const z = state.byId[state.selected];
  if (!z) return;
  const p = projectCell(z);
  if (p.z < 0.02) return;
  const pulse = 0.5 + 0.5 * Math.sin(t / 460);
  ctx.strokeStyle = 'rgba(255,255,255,' + (0.05 + pulse * 0.08) + ')';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(p.x, p.y, 28 + pulse * 12, 0, 7); ctx.stroke();
}

/* ---------- marches + knights ---------- */
function slerpV(a, b, k) {
  let dot = U.clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1);
  const om = Math.acos(dot);
  if (om < 1e-4) return a.slice();
  const so = Math.sin(om);
  const w1 = Math.sin((1 - k) * om) / so, w2 = Math.sin(k * om) / so;
  return [a[0] * w1 + b[0] * w2, a[1] * w1 + b[1] * w2, a[2] * w1 + b[2] * w2];
}
function marchPoint(m, k) {
  const a = state.byId[m.from], b = state.byId[m.to];
  if (!a || !b) return null;
  return projectV(slerpV(a.vCenter, b.vCenter, U.clamp(k, 0, 1)));
}
function drawMarchPath(ctx, m, fromK, toK, color, alpha, width, dash, t) {
  let prev = null;
  ctx.save();
  ctx.strokeStyle = U.rgba(color, alpha);
  ctx.lineWidth = width;
  ctx.setLineDash(dash || []);
  ctx.lineDashOffset = -(t / 45) % 20;
  ctx.lineCap = 'round';
  for (let i = 0; i <= 64; i++) {
    const k = fromK + (toK - fromK) * (i / 64);
    const p = marchPoint(m, k);
    if (prev && p && p.z > 0.015 && prev.z > 0.015) {
      ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    prev = p;
  }
  ctx.restore();
}
function drawArrowHead(ctx, p0, p1, color, size) {
  if (!p0 || !p1 || p0.z < 0.02 || p1.z < 0.02) return;
  const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  ctx.save(); ctx.translate(p1.x, p1.y); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(-size * 0.7, -size * 0.55); ctx.lineTo(-size * 0.35, 0); ctx.lineTo(-size * 0.7, size * 0.55); ctx.closePath();
  ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#050809'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}
function drawRouteArc(ctx, m, color) {
  const p0 = marchPoint(m, 0), p1 = marchPoint(m, 1);
  if (!p0 || !p1 || p0.z < 0.02 || p1.z < 0.02) return;
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  if (ny > 0) { nx = -nx; ny = -ny; }
  const lift = 18 + Math.min(52, len * 0.16);
  const cx = (p0.x + p1.x) / 2 + nx * lift;
  const cy = (p0.y + p1.y) / 2 + ny * lift;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(cx, cy, p1.x, p1.y);
  ctx.strokeStyle = 'rgba(5,8,9,.55)'; ctx.lineWidth = 5.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.quadraticCurveTo(cx, cy, p1.x, p1.y);
  ctx.strokeStyle = 'rgba(243,234,215,.92)'; ctx.lineWidth = 2.2; ctx.setLineDash([3, 6]); ctx.lineDashOffset = -(Date.now() / 40) % 9; ctx.stroke();
  ctx.setLineDash([]);
  const t = 0.40;
  const bx = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * cx + t * t * p1.x;
  const by = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * cy + t * t * p1.y;
  const tx = 2 * (1 - t) * (cx - p0.x) + 2 * t * (p1.x - cx);
  const ty = 2 * (1 - t) * (cy - p0.y) + 2 * t * (p1.y - cy);
  ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.atan2(ty, tx));
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-1.5, 0); ctx.lineTo(-4, 4); ctx.closePath();
  ctx.fillStyle = '#f3ead7'; ctx.fill(); ctx.strokeStyle = '#050809'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawMarches(ctx, t) {
  const wall = Date.now();
  for (const m of state.marches) {
    const a = state.byId[m.from], b = state.byId[m.to];
    if (!a || !b) continue;
    const dur = Math.max(1, m.arriveAt - m.departAt);
    const k = U.clamp((wall - m.departAt) / dur, 0, 1);
    const clan = D.CLAN[m.clan] || D.CLANS[0];
    const col = clan.color;
    drawRouteArc(ctx, m, col);
    const ang = Math.acos(U.clamp(a.vCenter[0] * b.vCenter[0] + a.vCenter[1] * b.vCenter[1] + a.vCenter[2] * b.vCenter[2], -1, 1));
    const deg = ang * 180 / Math.PI;
    const speed = deg / Math.max(0.6, dur / 1000);
    const remain = Math.max(0, (m.arriveAt - wall) / 1000);

    // full route is always visible; the traveled part is brighter
    drawMarchPath(ctx, m, 0, 1, '#050809', 0.32, 7.0, [2, 8], t);
    drawMarchPath(ctx, m, 0, 1, col, 0.30, 4.2, [2, 8], t);
    drawMarchPath(ctx, m, 0, 1, '#f3ead7', 0.52, 2.0, [3, 7], t);
    if (k > 0.002) {
      drawMarchPath(ctx, m, 0, k, '#050809', 0.70, 6.4, [7, 5], t);
      drawMarchPath(ctx, m, 0, k, '#fff', 1.0, 3.0, [7, 5], t);
    }
    const start = marchPoint(m, 0);
    if (start && start.z > 0.02) {
      ctx.fillStyle = '#050809'; ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(start.x, start.y, 4.5, 0, 7); ctx.fill(); ctx.stroke();
    }
    for (const kk of [0.28, 0.52, 0.76]) {
      const arrow = marchPoint(m, kk + 0.018);
      const arrowPrev = marchPoint(m, kk - 0.018);
      drawArrowHead(ctx, arrowPrev, arrow, '#f3ead7', 5.5);
    }

    const p = marchPoint(m, k);
    if (!p || p.z < 0.02) continue;
    const p2 = marchPoint(m, Math.min(1, k + 0.01));
    const flip = p2 && p2.x < p.x;
    const count = m.n || 1;
    const hScale = 1.02 * U.clamp(state.cam.s / 390, 0.9, 1.35);
    const nH = count > 60 ? 2 : 1;
    for (let i = nH - 1; i >= 0; i--) {
      const q = marchPoint(m, Math.max(0, k - i * 0.012));
      if (!q || q.z < 0.02) continue;
      drawKnight(ctx, q.x + i * 20, q.y + i * 5, col, hScale - i * 0.22, flip, t + i * 80, m.mine);
    }

    const line1 = (m.mine ? '你' : clan.name) + ' ×' + count;
    const line2 = remain > 0.2 ? '移动速度 ' + speed.toFixed(1) + '°/秒 · ' + Math.round(k * 100) + '% · ' + remain.toFixed(1) + 's' : '即将抵达';
    ctx.font = '700 10px "Space Grotesk", "PingFang SC", sans-serif';
    const w = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + 16;
    const ly = Math.min(state.H - state.insets.b - 28, p.y + 40);
    const lx = U.clamp(p.x, state.insets.l + w / 2 + 6, state.W - state.insets.r - w / 2 - 6);
    ctx.fillStyle = 'rgba(5,8,9,.93)';
    rr(ctx, lx - w / 2, ly - 10, w, 30, 7); ctx.fill();
    ctx.strokeStyle = U.rgba(col, 0.9); ctx.lineWidth = 1.1; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff'; ctx.font = '700 10px "Space Grotesk", "PingFang SC", sans-serif';
    ctx.fillText(line1, lx, ly - 1);
    ctx.fillStyle = 'rgba(242,206,75,.92)'; ctx.font = '600 8.5px "Space Grotesk", "PingFang SC", monospace';
    ctx.fillText(line2, lx, ly + 10);
  }
}

function drawKnight(ctx, x, y, color, scale, flip, t, mine) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -scale : scale, scale);
  const bob = Math.sin(t / 75) * 0.6;
  ctx.translate(0, bob);
  const steel = '#d8d1c2', steelDark = '#8f8a7e', dark = '#141815', gold = '#f2ce4b';

  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,.34)';
  ctx.beginPath(); ctx.ellipse(0, 21, 25, 5, 0, 0, 7); ctx.fill();
  // dust
  ctx.fillStyle = U.rgba(color, 0.28);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.arc(-24 - i * 5, 15 + Math.sin(t / 90 + i) * 2, 2.2 + i, 0, 7); ctx.fill();
  }

  // lance behind the rider
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 5.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(7, 17); ctx.lineTo(31, -43); ctx.stroke();
  ctx.strokeStyle = steel; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(7, 17); ctx.lineTo(31, -43); ctx.stroke();
  ctx.fillStyle = steel;
  ctx.beginPath(); ctx.moveTo(31, -43); ctx.lineTo(26, -38); ctx.lineTo(35, -37); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 1; ctx.stroke();
  // lance pennant
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(27, -36); ctx.lineTo(40, -32); ctx.lineTo(31, -27); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 1.2; ctx.stroke();

  // kite shield
  ctx.beginPath();
  ctx.moveTo(-23, -8); ctx.lineTo(-6, -16); ctx.lineTo(3, -5); ctx.lineTo(0, 12); ctx.lineTo(-11, 20); ctx.lineTo(-23, 10); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.strokeStyle = gold; ctx.lineWidth = 1.1; ctx.stroke();
  ctx.fillStyle = 'rgba(5,8,9,.75)';
  ctx.beginPath(); ctx.moveTo(-15, -4); ctx.lineTo(-9, -8); ctx.lineTo(-5, -2); ctx.lineTo(-9, 8); ctx.lineTo(-14, 3); ctx.closePath(); ctx.fill();

  // pauldrons
  ctx.fillStyle = steelDark;
  ctx.beginPath(); ctx.ellipse(-13, -10, 9, 6, -0.2, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(12, -10, 9, 6, 0.2, 0, 7); ctx.fill();
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 2; ctx.stroke();

  // tabard / breastplate
  ctx.beginPath();
  ctx.moveTo(-12, -12); ctx.lineTo(12, -12); ctx.lineTo(10, 16); ctx.lineTo(0, 20); ctx.lineTo(-10, 16); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 2.2; ctx.stroke();
  ctx.strokeStyle = gold; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-8, 8); ctx.lineTo(8, 8); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.beginPath(); ctx.moveTo(-9, -8); ctx.lineTo(0, -3); ctx.lineTo(9, -8); ctx.lineTo(7, 1); ctx.lineTo(0, 5); ctx.lineTo(-7, 1); ctx.closePath(); ctx.fill();

  // arms / gauntlets
  ctx.fillStyle = steelDark;
  ctx.beginPath(); ctx.ellipse(-16, -2, 4.5, 7, -0.4, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(16, -2, 4.5, 7, 0.4, 0, 7); ctx.fill();
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 1.5; ctx.stroke();

  // great helm
  ctx.beginPath();
  ctx.moveTo(-10, -33); ctx.quadraticCurveTo(-10, -40, 0, -40); ctx.quadraticCurveTo(10, -40, 10, -33);
  ctx.lineTo(11, -20); ctx.quadraticCurveTo(8, -15, 0, -15); ctx.quadraticCurveTo(-8, -15, -11, -20); ctx.closePath();
  ctx.fillStyle = steel; ctx.fill();
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 2.3; ctx.stroke();
  // visor slit
  ctx.fillStyle = '#050809';
  ctx.fillRect(-8, -28, 16, 3.2);
  // breath holes
  ctx.fillStyle = '#4d4a42';
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-5 + i * 5, -20, 1.1, 0, 7); ctx.fill(); }
  // brow ridge
  ctx.strokeStyle = gold; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(-9, -31); ctx.lineTo(9, -31); ctx.stroke();
  // plume
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, -40); ctx.quadraticCurveTo(2, -49, -12, -53); ctx.quadraticCurveTo(-4, -48, -6, -41); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 1.2; ctx.stroke();

  // white rim for the player's own march
  if (mine) {
    ctx.strokeStyle = 'rgba(255,255,255,.68)';
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(-10, -33); ctx.quadraticCurveTo(-10, -40, 0, -40); ctx.quadraticCurveTo(10, -40, 10, -33); ctx.lineTo(11, -20); ctx.stroke();
  }
  ctx.restore();
}

function drawSpawns(ctx, t) {
  for (let i = state.spawns.length - 1; i >= 0; i--) {
    const s = state.spawns[i], k = (t - s.t0) / 1800;
    if (k >= 1) { state.spawns.splice(i, 1); continue; }
    const b = state.world.baseByClan[s.clan];
    if (!b) continue;
    const p = projectV(b.vCenter);
    if (p.z < 0.05) continue;
    const col = D.CLAN[s.clan].color;
    ctx.globalAlpha = (1 - k) * 0.9;
    ctx.strokeStyle = col; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 16 + k * 58, 0, 7); ctx.stroke();
    ctx.globalAlpha = (1 - k) * 0.5;
    ctx.strokeStyle = '#f2ce4b'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, 8 + k * 34, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1;
    drawMiniFlag(ctx, p.x + (k - 0.5) * 34, p.y - 12 - k * 20, col, 5, t, false);
  }
}

function drawCrossedSwords(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineCap = 'round';
  for (const dir of [1, -1]) {
    ctx.strokeStyle = '#050809'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-9 * dir, 9); ctx.lineTo(9 * dir, -9); ctx.stroke();
    ctx.strokeStyle = '#f3ead7'; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(-9 * dir, 9); ctx.lineTo(9 * dir, -9); ctx.stroke();
    ctx.strokeStyle = '#c98f32'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-9 * dir, 9); ctx.lineTo(-4 * dir, 4); ctx.stroke();
  }
  ctx.strokeStyle = '#c98f32'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(2, 5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-2, -5); ctx.lineTo(5, 2); ctx.stroke();
  ctx.fillStyle = '#f2ce4b';
  ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, 7); ctx.fill();
  ctx.restore();
}
function drawBomb(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#f3ead7';
  ctx.beginPath(); ctx.arc(0, 2, 6.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#10100e';
  ctx.beginPath(); ctx.arc(0, 2, 4.9, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath(); ctx.arc(-1.7, 0, 1.6, 0, 7); ctx.fill();
  ctx.strokeStyle = '#c98f32'; ctx.lineWidth = 1.9;
  ctx.beginPath(); ctx.moveTo(3, -3); ctx.quadraticCurveTo(8, -7, 7, -12); ctx.stroke();
  ctx.fillStyle = '#ff7b3a';
  ctx.beginPath(); ctx.arc(7, -13, 2.1, 0, 7); ctx.fill();
  ctx.strokeStyle = '#f2ce4b'; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(5, -14); ctx.lineTo(3, -17); ctx.moveTo(8, -15); ctx.lineTo(9, -18); ctx.stroke();
  ctx.restore();
}
function drawArcher(ctx, x, y, s, color, aim, phase) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = '#050809'; ctx.lineWidth = s * 0.28; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-s * 1.1, s * 0.7); ctx.lineTo(-s * 0.4, -s * 0.1); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = s * 0.17;
  ctx.beginPath(); ctx.moveTo(-s * 1.1, s * 0.7); ctx.lineTo(-s * 0.4, -s * 0.1); ctx.stroke();
  ctx.fillStyle = '#d8d1c2';
  ctx.beginPath(); ctx.arc(-s * 0.25, -s * 0.5, s * 0.32, 0, 7); ctx.fill();
  ctx.strokeStyle = '#050809'; ctx.lineWidth = s * 0.14;
  ctx.beginPath(); ctx.arc(-s * 0.25, -s * 0.5, s * 0.32, 0, 7); ctx.stroke();
  // bow
  ctx.save(); ctx.rotate(aim);
  ctx.strokeStyle = color; ctx.lineWidth = s * 0.22;
  ctx.beginPath(); ctx.arc(0, 0, s * 0.9, -1.0, 1.0); ctx.stroke();
  ctx.strokeStyle = '#f3ead7'; ctx.lineWidth = s * 0.07;
  ctx.beginPath(); ctx.moveTo(0, -s * 0.9); ctx.lineTo(0, s * 0.9); ctx.stroke();
  ctx.restore();
  ctx.restore();
  // arrow
  if (phase < 0.65) {
    const d = s * (1.5 + phase * 7);
    ctx.strokeStyle = '#f3ead7'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(aim) * s * 1.2, y + Math.sin(aim) * s * 1.2);
    ctx.lineTo(x + Math.cos(aim) * d, y + Math.sin(aim) * d); ctx.stroke();
    ctx.fillStyle = '#f2ce4b';
    ctx.beginPath(); ctx.arc(x + Math.cos(aim) * d, y + Math.sin(aim) * d, 1.5, 0, 7); ctx.fill();
  }
}
function drawCatapult(ctx, x, y, s, color, phase, aim) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(aim);
  ctx.strokeStyle = '#050809'; ctx.lineWidth = s * 0.28; ctx.lineCap = 'round';
  // wheels
  ctx.fillStyle = '#17130d';
  ctx.beginPath(); ctx.arc(-s * 0.7, s * 0.55, s * 0.4, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.55, s * 0.55, s * 0.4, 0, 7); ctx.fill();
  ctx.strokeStyle = '#9b7a43'; ctx.lineWidth = s * 0.12;
  ctx.beginPath(); ctx.arc(-s * 0.7, s * 0.55, s * 0.4, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(s * 0.55, s * 0.55, s * 0.4, 0, 7); ctx.stroke();
  // frame
  ctx.strokeStyle = '#050809'; ctx.lineWidth = s * 0.26;
  ctx.beginPath(); ctx.moveTo(-s * 0.9, s * 0.3); ctx.lineTo(0, -s * 0.4); ctx.lineTo(s * 0.9, s * 0.3); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = s * 0.16;
  ctx.beginPath(); ctx.moveTo(-s * 0.9, s * 0.3); ctx.lineTo(0, -s * 0.4); ctx.lineTo(s * 0.9, s * 0.3); ctx.stroke();
  // throwing arm
  const arm = -1.0 + Math.sin(phase * Math.PI * 2) * 0.55;
  ctx.save(); ctx.translate(0, -s * 0.2); ctx.rotate(arm);
  ctx.strokeStyle = '#050809'; ctx.lineWidth = s * 0.24;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 1.35, 0); ctx.stroke();
  ctx.strokeStyle = '#c49a58'; ctx.lineWidth = s * 0.14;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 1.35, 0); ctx.stroke();
  ctx.fillStyle = '#2a2620'; ctx.beginPath(); ctx.arc(s * 1.35, 0, s * 0.28, 0, 7); ctx.fill();
  ctx.restore();
  // small attacker pennant
  ctx.strokeStyle = '#f3ead7'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-s * 0.7, s * 0.3); ctx.lineTo(-s * 0.7, -s * 1.2); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-s * 0.7, -s * 1.2); ctx.lineTo(-s * 0.05, -s * 0.95); ctx.lineTo(-s * 0.7, -s * 0.72); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

/* ---------- cartoon class units (siege) ---------- */
function drawUnit(ctx, key, x, y, s, color, facing, phase) {
  const f = facing >= 0 ? 1 : -1;
  const w = Math.sin(phase * Math.PI * 2);
  const bob = w * 0.35;
  const metal = '#cfc6b4', dark = '#171512', leather = '#6e5237', skin = '#d8b087';
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.38)';
  ctx.beginPath(); ctx.ellipse(x, y + 0.5, 7.2 * s, 2.1 * s, 0, 0, 7); ctx.fill();
  ctx.translate(x, y); ctx.scale(f * s, s);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  if (key === 'raider') {
    // galloping horse
    const gait = Math.sin(phase * Math.PI * 2) * 1.8;
    ctx.strokeStyle = '#050809'; ctx.lineWidth = 3.2;
    for (const [lx, ph] of [[-4.5, gait], [-2.2, -gait], [2.2, gait], [4.3, -gait]]) {
      ctx.beginPath(); ctx.moveTo(lx, -7); ctx.lineTo(lx + ph * 0.55, -0.5); ctx.stroke();
      ctx.strokeStyle = leather; ctx.lineWidth = 1.7;
      ctx.beginPath(); ctx.moveTo(lx, -7); ctx.lineTo(lx + ph * 0.55, -0.5); ctx.stroke();
      ctx.strokeStyle = '#050809'; ctx.lineWidth = 3.2;
    }
    ctx.fillStyle = '#7c5b3e'; ctx.strokeStyle = '#050809'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(-1, -9, 7, 4, -0.08, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9a744f'; ctx.beginPath(); ctx.ellipse(-1, -10.2, 4.8, 1.5, -0.08, 0, 7); ctx.fill();
    // neck + head
    ctx.beginPath(); ctx.moveTo(4, -11); ctx.lineTo(8, -16); ctx.lineTo(11, -14.5); ctx.lineTo(7, -9); ctx.closePath();
    ctx.fillStyle = '#8c6847'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(9.5, -17, 3.2, 2.3, 0.2, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1b1410'; ctx.beginPath(); ctx.arc(10.5, -18, 0.7, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8dcc2'; ctx.beginPath(); ctx.ellipse(9.4, -18.8, 0.9, 0.45, 0.2, 0, 7); ctx.fill();
    // tail
    ctx.strokeStyle = '#2a1d14'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-8, -11); ctx.quadraticCurveTo(-11, -8, -9, -5); ctx.stroke();
    // saddle + rider
    ctx.fillStyle = color; ctx.strokeStyle = '#050809'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.ellipse(-0.5, -12.2, 4.4, 2.1, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#050809'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(-2.2, -13); ctx.lineTo(-2.5, -5.5); ctx.stroke();
    ctx.fillStyle = U.shade(color, -0.18);
    ctx.beginPath(); ctx.moveTo(-3.5, -17.5); ctx.lineTo(2.5, -17.5); ctx.lineTo(3.2, -12); ctx.lineTo(-4.2, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(-0.5, -19.5, 2.8, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a2119'; ctx.beginPath(); ctx.arc(-0.5, -21, 2.9, Math.PI, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#050809'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-3.2, -19.5); ctx.lineTo(2.2, -19.5); ctx.stroke();
    // rider bow
    ctx.strokeStyle = '#c49a58'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(3.8, -16, 3.8, -1.25, 1.25); ctx.stroke();
    ctx.strokeStyle = '#f3ead7'; ctx.lineWidth = 0.55;
    ctx.beginPath(); ctx.moveTo(3.8, -19.6); ctx.lineTo(3.8, -12.4); ctx.stroke();
    ctx.restore(); return;
  }

  // legs
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 2.8;
  ctx.beginPath(); ctx.moveTo(-1.8, -8); ctx.lineTo(-2.8 + w * 0.8, -0.7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1.8, -8); ctx.lineTo(2.8 - w * 0.8, -0.7); ctx.stroke();
  ctx.strokeStyle = leather; ctx.lineWidth = 1.7;
  ctx.beginPath(); ctx.moveTo(-1.8, -8); ctx.lineTo(-2.8 + w * 0.8, -0.7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1.8, -8); ctx.lineTo(2.8 - w * 0.8, -0.7); ctx.stroke();
  // boots
  ctx.fillStyle = '#211b15';
  ctx.beginPath(); ctx.ellipse(-3 + w * 0.8, -0.4, 1.9, 1.1, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(3 - w * 0.8, -0.4, 1.9, 1.1, 0, 0, 7); ctx.fill();

  // torso
  const robe = key === 'warlock';
  ctx.fillStyle = robe ? U.shade(color, -0.45) : U.shade(color, -0.22);
  ctx.strokeStyle = '#050809'; ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (robe) {
    ctx.moveTo(-3.6, -14.5 + bob); ctx.lineTo(3.6, -14.5 + bob);
    ctx.lineTo(5.2, -1.5); ctx.lineTo(-5.2, -1.5); ctx.closePath();
  } else {
    ctx.moveTo(-3.4, -14.5 + bob); ctx.lineTo(3.4, -14.5 + bob);
    ctx.lineTo(3.9, -6.5); ctx.lineTo(-3.9, -6.5); ctx.closePath();
  }
  ctx.fill(); ctx.stroke();
  if (!robe) {
    ctx.fillStyle = metal;
    ctx.beginPath(); ctx.moveTo(-3.2, -13 + bob); ctx.lineTo(-1.2, -13 + bob); ctx.lineTo(-1.2, -7); ctx.lineTo(-3.2, -7); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(1.2, -13 + bob); ctx.lineTo(3.2, -13 + bob); ctx.lineTo(3.2, -7); ctx.lineTo(1.2, -7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5c5548'; ctx.lineWidth = 0.8; ctx.stroke();
  }
  // belt
  ctx.strokeStyle = '#c49a58'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-3.6, -7.2); ctx.lineTo(3.6, -7.2); ctx.stroke();

  // head
  ctx.fillStyle = skin; ctx.strokeStyle = '#050809'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, -17 + bob, 3.4, 0, 7); ctx.fill(); ctx.stroke();
  // face
  ctx.fillStyle = '#1b1410';
  ctx.beginPath(); ctx.arc(1.2, -17.5 + bob, 0.38, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(2.4, -17.5 + bob, 0.38, 0, 7); ctx.fill();

  if (key === 'guard') {
    // crested helm
    ctx.fillStyle = metal; ctx.beginPath(); ctx.arc(0, -18 + bob, 3.9, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-0.8, -21 + bob); ctx.lineTo(0.4, -24 + bob); ctx.lineTo(1.2, -20.8 + bob); ctx.closePath(); ctx.fill();
    // big shield
    const sx = 4.3 + Math.sin(phase * Math.PI * 2) * 0.25;
    ctx.fillStyle = U.shade(color, -0.3); ctx.strokeStyle = '#050809'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(sx, -15.5); ctx.lineTo(sx + 3.5, -14); ctx.lineTo(sx + 3.1, -5.5); ctx.lineTo(sx, -4); ctx.lineTo(sx - 0.2, -9.5); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = metal; ctx.beginPath(); ctx.arc(sx + 1.4, -10, 1.5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#f2ce4b'; ctx.lineWidth = 0.8; ctx.stroke();
    // sword back
    ctx.strokeStyle = '#050809'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-4, -10); ctx.lineTo(-6.5, -19); ctx.stroke();
    ctx.strokeStyle = metal; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-4, -10); ctx.lineTo(-6.5, -19); ctx.stroke();
  } else if (key === 'vanguard') {
    // tall crest
    ctx.fillStyle = metal; ctx.beginPath(); ctx.arc(0, -18 + bob, 3.8, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-1, -21 + bob); ctx.quadraticCurveTo(-1.5, -27 + bob, 2.5, -25 + bob); ctx.lineTo(1.5, -20 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
    // spear
    const thrust = Math.sin(phase * Math.PI * 2) * 1.2;
    ctx.strokeStyle = '#050809'; ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.moveTo(-4.5, -8); ctx.lineTo(9 + thrust, -20); ctx.stroke();
    ctx.strokeStyle = '#c49a58'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-4.5, -8); ctx.lineTo(9 + thrust, -20); ctx.stroke();
    ctx.fillStyle = metal; ctx.beginPath(); ctx.moveTo(9 + thrust, -20); ctx.lineTo(12 + thrust, -22); ctx.lineTo(9.6 + thrust, -18.7); ctx.closePath(); ctx.fill(); ctx.stroke();
    // small round shield
    ctx.fillStyle = U.shade(color, -0.25); ctx.beginPath(); ctx.arc(-3.7, -12, 2.6, 0, 7); ctx.fill(); ctx.stroke();
  } else if (key === 'archer') {
    // hood
    ctx.fillStyle = U.shade(color, -0.5); ctx.beginPath(); ctx.arc(0, -18 + bob, 4.1, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3.8, -18 + bob); ctx.lineTo(-5, -13 + bob); ctx.lineTo(-2.2, -15 + bob); ctx.closePath(); ctx.fill();
    // bow
    const draw = 0.55 + 0.45 * Math.sin(phase * Math.PI * 2);
    ctx.strokeStyle = '#050809'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(5.2, -11, 4.3, -1.35, 1.35); ctx.stroke();
    ctx.strokeStyle = '#c49a58'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(5.2, -11, 4.3, -1.35, 1.35); ctx.stroke();
    ctx.strokeStyle = '#f3ead7'; ctx.lineWidth = 0.65;
    const tipX = 5.2 + Math.cos(1.35) * 4.3, tipY = -11 + Math.sin(1.35) * 4.3;
    ctx.beginPath(); ctx.moveTo(tipX, -11 - 4.15); ctx.lineTo(3.0 - draw * 1.8, -11); ctx.lineTo(tipX, -11 + 4.15); ctx.stroke();
    ctx.strokeStyle = '#f3ead7'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(2.6, -11); ctx.lineTo(7.8, -11); ctx.stroke();
    ctx.fillStyle = '#f2ce4b'; ctx.beginPath(); ctx.arc(7.8, -11, 0.8, 0, 7); ctx.fill();
    // quiver
    ctx.strokeStyle = '#050809'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-4.2, -12); ctx.lineTo(-6.5, -19); ctx.stroke();
    ctx.strokeStyle = '#c49a58'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-4.2, -12); ctx.lineTo(-6.5, -19); ctx.stroke();
  } else if (key === 'warlock') {
    // hood
    ctx.fillStyle = U.shade(color, -0.64); ctx.beginPath(); ctx.arc(0, -18 + bob, 4.4, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4.1, -18 + bob); ctx.lineTo(-5.4, -13); ctx.lineTo(-1.6, -15.5); ctx.closePath(); ctx.fill();
    // glowing eyes
    ctx.fillStyle = '#7fe8ff'; ctx.beginPath(); ctx.arc(1.2, -17.5 + bob, 0.55, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(2.3, -17.5 + bob, 0.55, 0, 7); ctx.fill();
    // staff
    ctx.strokeStyle = '#050809'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(4.9, -1); ctx.lineTo(4.2, -21); ctx.stroke();
    ctx.strokeStyle = '#a77a43'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(4.9, -1); ctx.lineTo(4.2, -21); ctx.stroke();
    const pulse = 0.8 + 0.2 * Math.sin(phase * Math.PI * 4);
    ctx.fillStyle = 'rgba(127,232,255,' + (0.28 * pulse).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(4.2, -22, 3.6 * pulse, 0, 7); ctx.fill();
    ctx.fillStyle = '#a9f4ff'; ctx.beginPath(); ctx.arc(4.2, -22, 1.7, 0, 7); ctx.fill();
    ctx.strokeStyle = '#e8ffff'; ctx.lineWidth = 0.6; ctx.stroke();
    // casting hand
    ctx.strokeStyle = skin; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(2.6, -12); ctx.lineTo(5.8, -14); ctx.stroke();
  }

  // shoulder cape
  ctx.fillStyle = U.shade(color, -0.35);
  ctx.beginPath(); ctx.moveTo(-3.4, -14.5 + bob); ctx.lineTo(-5.4, -10); ctx.lineTo(-2.8, -11); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function siegeEdgePoint(pts, cx, cy, dx, dy) {
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ex = b.x - a.x, ey = b.y - a.y;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-6) continue;
    const qx = a.x - cx, qy = a.y - cy;
    const t = (qx * ey - qy * ex) / den;
    const u = (qx * dy - qy * dx) / den;
    if (t > 0 && u >= -0.001 && u <= 1.001 && (!best || t < best.t)) best = { t, x: cx + dx * t, y: cy + dy * t };
  }
  return best ? { x: best.x, y: best.y } : { x: cx + dx * 28, y: cy + dy * 28 };
}

function drawSieges(ctx, t) {
  const now = Date.now();
  const drawn = new Set();
  for (const b of (state.battles || [])) {
    if (drawn.has(b.to)) continue;
    drawn.add(b.to);
    const z = state.byId[b.to];
    if (!z) continue;
    const p = projectCell(z);
    if (p.z < 0.08) continue;
    const row = state.rows[z.id] || {};
    const defender = row.owner ? D.CLAN[row.owner] : D.CLANS[0];
    const attacker = D.CLAN[b.clan] || D.CLANS[0];
    const pts = screenPoly(z);
    const path = polyPath(pts, 2.4);
    let cr = 0;
    for (let i = 0; i < 4; i++) cr += Math.hypot(pts[i].x - p.x, pts[i].y - p.y);
    cr = cr / 4 || 24;

    // dark siege vignette
    ctx.fillStyle = 'rgba(5,8,9,.38)';
    ctx.beginPath(); ctx.arc(p.x, p.y, cr + 42, 0, 7); ctx.fill();

    // city wall
    ctx.save();
    ctx.strokeStyle = '#050809'; ctx.lineWidth = 12; ctx.stroke(path);
    ctx.strokeStyle = '#b9ae96'; ctx.lineWidth = 7; ctx.stroke(path);
    ctx.strokeStyle = U.rgba(defender.color, 0.8); ctx.lineWidth = 1.8; ctx.stroke(path);
    ctx.fillStyle = '#d8d1c2';
    for (let i = 0; i < pts.length; i += 3) {
      const a = pts[i], bb = pts[(i + 1) % pts.length];
      const mx = (a.x + bb.x) / 2, my = (a.y + bb.y) / 2;
      let nx = mx - p.x, ny = my - p.y;
      const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      ctx.save(); ctx.translate(mx + nx * 3, my + ny * 3); ctx.rotate(Math.atan2(bb.y - a.y, bb.x - a.x));
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
    }
    ctx.restore();

    // actual class composition from the battle snapshot
    const UNIT_ORDER = ['guard', 'vanguard', 'archer', 'warlock', 'raider'];
    const UNIT_NAMES = { guard: ORE.i18n ? ORE.i18n.unit('guard') : '盾卫', vanguard: ORE.i18n ? ORE.i18n.unit('vanguard') : '先锋', archer: ORE.i18n ? ORE.i18n.unit('archer') : '弓手', warlock: ORE.i18n ? ORE.i18n.unit('warlock') : '术士', raider: ORE.i18n ? ORE.i18n.unit('raider') : '游骑' };
    const activeClasses = (obj) => UNIT_ORDER.filter((k) => obj && obj[k] > 0);
    let atkKeys = activeClasses(b.atkClasses);
    let defKeys = activeClasses(b.defClasses);
    if (!atkKeys.length) atkKeys = ['vanguard'];
    if (!defKeys.length && b.defClasses == null) defKeys = ['archer'];

    const a = state.byId[b.from];
    const op = a ? projectCell(a) : null;
    let dx = op ? op.x - p.x : 0, dy = op ? op.y - p.y : -1;
    if (!op || (dx === 0 && dy === 0)) { dx = 0; dy = -1; }
    const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const aim = Math.atan2(dy, dx);
    // attacker cartoon models are 30% smaller than before
    const u = cr * 0.022;
    const faceDef = dx >= 0 ? 1 : -1;

    // defenders: exactly the classes stationed in this city
    const defUnits = [];
    const dn = defKeys.length;
    const du = u;
    for (let i = 0; i < dn; i++) {
      const key = defKeys[i];
      const x = p.x + (i - (dn - 1) / 2) * Math.max(3, du * 26);
      const y = p.y + cr * 0.22 + (i % 2 ? 4 : -3);
      drawUnit(ctx, key, x, y, du, defender.color, faceDef, (t / 820 + i * 0.19) % 1);
      defUnits.push({ key, x, y });
      ctx.font = '700 ' + (6.5 * mapZoom()).toFixed(1) + 'px "PingFang SC", "Noto Sans SC", sans-serif';
      const tw = ctx.measureText(UNIT_NAMES[key]).width + 5;
      ctx.fillStyle = 'rgba(5,8,9,.9)';
      rr(ctx, x - tw / 2, y + 1, tw, 8.5, 2.5); ctx.fill();
      ctx.strokeStyle = U.rgba(defender.color, .7); ctx.lineWidth = .5; ctx.stroke();
      ctx.fillStyle = '#f3ead7'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(UNIT_NAMES[key], x, y + 5.2);
    }

    // attackers: exactly the classes in this assault party, standing on the cell edge
    const band = [];
    const edge = siegeEdgePoint(pts, p.x, p.y, dx, dy);
    const tx = -dy, ty = dx;
    const an = atkKeys.length;
    const gap = Math.max(5, u * 30);
    const slots = [];
    for (let i = 0; i < an; i++) {
      const off = (i - (an - 1) / 2) * gap;
      slots.push({ key: atkKeys[i], i, x: edge.x + tx * off + dx * 10, y: edge.y + ty * off + dy * 10 });
    }
    slots.sort((a, b) => a.y - b.y);
    for (const slot of slots) {
      const ux = U.clamp(slot.x, state.insets.l + 24, state.W - state.insets.r - 24);
      const uy = U.clamp(slot.y, state.insets.t + 48, state.H - state.insets.b - 48);
      const face = ux >= p.x ? -1 : 1;
      band.push({ key: slot.key, x: ux, y: uy });
      drawUnit(ctx, slot.key, ux, uy, u, attacker.color, face, (t / 760 + slot.i * 0.17) % 1);
      // label sits just outside the wall, not over the model
      const lx = ux + dx * 13, ly = uy + dy * 13;
      ctx.font = '700 ' + (7 * mapZoom()).toFixed(1) + 'px "PingFang SC", "Noto Sans SC", sans-serif';
      const tw = ctx.measureText(UNIT_NAMES[slot.key]).width + 7;
      ctx.fillStyle = 'rgba(5,8,9,.9)';
      rr(ctx, lx - tw / 2, ly - 4, tw, 9, 3); ctx.fill();
      ctx.strokeStyle = U.rgba(attacker.color, .7); ctx.lineWidth = .6; ctx.stroke();
      ctx.fillStyle = '#f3ead7'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(UNIT_NAMES[slot.key], lx, ly);
    }

    // defender archer arrows, only if the city actually has archers
    const defArcher = defUnits.find((x) => x.key === 'archer');
    if (defArcher) {
      for (let i = 0; i < 3; i++) {
        const ap = (t / 780 + i * 0.31) % 1;
        if (ap > 0.72) continue;
        const q = ap / 0.72;
        const sx = defArcher.x + (i - 1) * 4;
        const sy = defArcher.y - 10;
        const ex = sx + dx * (28 + q * 44) + (i - 1) * 4;
        const ey = sy + dy * (28 + q * 44) + (i - 1) * 3;
        ctx.strokeStyle = 'rgba(243,234,215,' + (1 - q * 0.5).toFixed(2) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.fillStyle = '#f2ce4b';
        ctx.beginPath(); ctx.arc(ex, ey, 1.8, 0, 7); ctx.fill();
      }
    }
    // defender warlock bolt, only if present
    const defLock = defUnits.find((x) => x.key === 'warlock');
    if (defLock) {
      const q = (t / 1150 + 0.2) % 1;
      if (q < 0.7) {
        const k = q / 0.7;
        const sx = defLock.x, sy = defLock.y - 10;
        const ex = sx + dx * (20 + k * 40);
        const ey = sy + dy * (20 + k * 40) - Math.sin(k * Math.PI) * 8;
        ctx.strokeStyle = 'rgba(127,232,255,.5)';
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.fillStyle = '#bff8ff';
        ctx.beginPath(); ctx.arc(ex, ey, 1.7, 0, 7); ctx.fill();
      }
    }
    // attacker archer arrow
    const archer = band.find((u) => u.key === 'archer');
    const aq = (t / 900 + 0.18) % 1;
    if (archer && aq < 0.73) {
      const q = aq / 0.73;
      const sx = archer.x, sy = archer.y - u * 10;
      const ex = sx + (p.x - sx) * q;
      const ey = sy + (p.y - sy) * q - Math.sin(q * Math.PI) * 9;
      ctx.strokeStyle = 'rgba(243,234,215,' + (0.95 - q * 0.35).toFixed(2) + ')';
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = '#f2ce4b'; ctx.beginPath(); ctx.arc(ex, ey, 1.6, 0, 7); ctx.fill();
    }
    // warlock bolt
    const lock = band.find((u) => u.key === 'warlock');
    const wq = (t / 1050 + 0.3) % 1;
    if (lock && wq < 0.78) {
      const q = wq / 0.78;
      const sx = lock.x, sy = lock.y - u * 18;
      const ex = sx + (p.x - sx) * q;
      const ey = sy + (p.y - sy) * q - Math.sin(q * Math.PI) * 18;
      ctx.strokeStyle = 'rgba(127,232,255,.55)';
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = 'rgba(127,232,255,.22)';
      ctx.beginPath(); ctx.arc(ex, ey, 5.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#c8fbff';
      ctx.beginPath(); ctx.arc(ex, ey, 2.1, 0, 7); ctx.fill();
    }

    // timer
    const remain = Math.max(0, Math.ceil((b.endAt - now) / 1000));
    const label = '攻城 ' + remain + 's';
    ctx.font = '800 10px "Space Grotesk", "PingFang SC", sans-serif';
    const w = ctx.measureText(label).width + 16;
    const ly = p.y - cr - 34;
    ctx.fillStyle = 'rgba(5,8,9,.92)';
    rr(ctx, p.x - w / 2, ly - 8, w, 16, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(255,138,128,.9)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#ff8a80'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x, ly + 0.5);
  }
}

function drawBattleMarks(ctx, t) {
  const now = performance.now();
  const targets = new Map();
  // Only mark a tile as a battle after the army has arrived. Marching armies
  // must not paint siege/battle icons on the destination tile.
  for (const b of (state.battles || [])) {
    if (b == null) continue;
    const cur = targets.get(b.to) || { n: 0, fx: 0 };
    cur.n += b.troops || 1; targets.set(b.to, cur);
  }
  for (const fx of state.battleFx) {
    if (now - fx.t0 > 3200) continue;
    const cur = targets.get(fx.id) || { n: 0, fx: 0 };
    cur.fx = Math.max(cur.fx, 1 - (now - fx.t0) / 3200);
    targets.set(fx.id, cur);
  }
  state.battleFx = state.battleFx.filter((x) => now - x.t0 <= 3200);
  for (const [id, info] of targets) {
    const z = state.byId[id];
    if (!z) continue;
    const p = projectCell(z);
    if (p.z < 0.06) continue;
    const pulse = 0.5 + 0.5 * Math.sin(t / 220 + id);
    const s = U.clamp(state.cam.s / 420, 0.80, 1.25);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,90,79,' + (0.30 + pulse * 0.28) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 19 + pulse * 5, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,90,79,.12)';
    ctx.beginPath(); ctx.arc(p.x, p.y, 19 + pulse * 5, 0, 7); ctx.fill();
    drawCrossedSwords(ctx, p.x - 12, p.y - 22, s);
    drawBomb(ctx, p.x + 13, p.y - 22, s);
    const label = '交战';
    ctx.font = '800 8.5px "PingFang SC", "Noto Sans SC", sans-serif';
    const w = ctx.measureText(label).width + 10;
    ctx.fillStyle = 'rgba(5,8,9,.92)';
    rr(ctx, p.x - w / 2, p.y - 4, w, 13, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(255,90,79,.8)'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = '#ff8a80'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, p.x, p.y + 2.5);
    ctx.restore();
  }
}

/* ---------- tooltip ---------- */
function drawTooltip(ctx, id) {
  const z = state.byId[id];
  if (!z) return;
  const p = projectCell(z);
  if (p.z < 0.05) return;
  const row = state.rows[id] || {};
  const clan = row.owner ? D.CLAN[row.owner] : null;
  const T = (window.ORE && ORE.i18n) ? ORE.i18n.tr : (x) => x;
  const clanName = (window.ORE && ORE.i18n && row.owner) ? ORE.i18n.clan(row.owner) : (clan ? clan.name : '');
  const deg = Math.round((z.distBase || 0) * 180 / Math.PI);
  let l1, l2, l3;
  if (z.kind === 'base') {
    l1 = z.name + ' · ' + T('不可攻击');
    l2 = clanName + ' · ' + T('基地产矿最低') + ' · ' + T('驻军') + ' ' + (row.garrison || 0);
    l3 = T('三座基地在球面上互相等距');
  } else {
    l1 = z.name + ' · ' + clanName + ' · ' + T('距基地') + ' ' + deg + '°';
    l2 = T('当前') + ' ' + (state.rates[id] || 0).toFixed(1) + ' ' + T('ORE/分') + ' · ' + T('驻军') + ' ' + (row.garrison || 0) + ' · ' + T('防御') + ' ' + Math.round(row.def || 0);
    l3 = T('驻军') + ' ATK ' + (row.atk || 0) + ' · ' + T('地块金库') + ' ' + (row.vault || 0).toFixed(1);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const zoom = mapZoom();
  const ms = mapTextScale();
  const f1 = 22 * 0.70 * zoom * ms;       // first line: 30% smaller
  const f2 = 9.5 * 2.00 * zoom * ms;      // current ORE / garrison / defense: 2x
  const padX = 11, padY = 8, gap = 4 * zoom * ms;
  ctx.font = '700 ' + f1.toFixed(1) + 'px "PingFang SC", "Noto Sans SC", sans-serif';
  const w1 = ctx.measureText(l1).width;
  ctx.font = '600 ' + f2.toFixed(1) + 'px "Space Grotesk", "PingFang SC", sans-serif';
  const w2 = ctx.measureText(l2).width;
  const w3 = ctx.measureText(l3).width;
  const w = Math.max(w1, w2, w3) + padX * 2;
  const h = padY * 2 + f1 + gap * 2 + f2 * 2;
  let x = U.clamp(p.x - w / 2, 8, state.W - w - 8);
  let y = U.clamp(p.y - h - 10, 8, state.H - h - 8);
  ctx.fillStyle = 'rgba(5,8,9,.95)';
  rr(ctx, x, y, w, h, 6); ctx.fill();
  ctx.strokeStyle = z.kind === 'base' ? '#f2ce4b' : clan ? clan.color : '#4a4a44'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#ece6d7';
  ctx.font = '700 ' + f1.toFixed(1) + 'px "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.fillText(l1, x + padX, y + padY + f1 / 2);
  ctx.fillStyle = '#9a958a';
  ctx.font = '600 ' + f2.toFixed(1) + 'px "Space Grotesk", "PingFang SC", sans-serif';
  ctx.fillText(l2, x + padX, y + padY + f1 + gap + f2 / 2);
  ctx.fillStyle = deg > 55 ? '#f2ce4b' : '#6f6b62';
  ctx.fillText(l3, x + padX, y + padY + f1 + gap * 2 + f2 * 1.5);
}
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- input ---------- */
function bindInput() {
  const cv = state.cv;
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);
  cv.addEventListener('pointerleave', () => { if (state.hover !== -1) { state.hover = -1; state.needs = true; } });
  cv.addEventListener('wheel', onWheel, { passive: false });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('resize', () => { computeInsets(); resize(); });
  window.addEventListener('orientationchange', () => setTimeout(() => { computeInsets(); resize(); }, 120));
  cv.style.cursor = 'grab';
}
function pickAt(px, py) {
  let best = -1, bz = -1;
  for (const z of state.cells) {
    const c = projectCell(z);
    if (c.z < -0.02) continue;
    const pts = screenPoly(z);
    if (U.pointInPoly([px, py], pts.map((p) => [p.x, p.y]))) {
      if (c.z > bz) { bz = c.z; best = z.id; }
    }
  }
  return best;
}
function onDown(e) {
  try { state.cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  state.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (state.ptrs.size === 1) {
    state.drag = { x: e.clientX, y: e.clientY, spin: state.cam.spin, tilt: state.cam.tilt };
    state.moved = 0;
  } else if (state.ptrs.size === 2) {
    const [a, b] = [...state.ptrs.values()];
    state.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: state.cam.s };
    state.drag = null; state.moved = 99;
  }
  state.pauseUntil = performance.now() + 4000;
}
function onMove(e) {
  if (!state.ptrs.has(e.pointerId)) {
    const id = pickAt(e.clientX, e.clientY);
    if (id !== state.hover) { state.hover = id; state.needs = true; if (state.onHover) state.onHover(id); }
    state.cv.style.cursor = id >= 0 ? 'pointer' : 'grab';
    return;
  }
  state.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (state.pinch && state.ptrs.size >= 2) {
    const [a, b] = [...state.ptrs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    state.cam.s = U.clamp(state.pinch.s * (d / Math.max(1, state.pinch.d)), fitScale() * 0.65, fitScale() * 3.2);
    state.needs = true;
    return;
  }
  if (state.drag) {
    const dx = e.clientX - state.drag.x, dy = e.clientY - state.drag.y;
    state.moved = Math.max(state.moved, Math.hypot(dx, dy));
    if (state.moved > 4) {
      state.cam.spin = state.drag.spin + dx * 0.007;
      state.cam.tilt = U.clamp(state.drag.tilt + dy * 0.005, -Math.PI, Math.PI);
      state.userMoved = true;
      state.pauseUntil = performance.now() + 5000;
      state.needs = true;
      state.cv.style.cursor = 'grabbing';
    }
  }
}
function onUp(e) {
  const had = state.ptrs.has(e.pointerId);
  state.ptrs.delete(e.pointerId);
  if (state.pinch && state.ptrs.size === 1) {
    const [p] = [...state.ptrs.values()];
    state.drag = { x: p.x, y: p.y, spin: state.cam.spin, tilt: state.cam.tilt };
    state.moved = 99;
  }
  if (state.ptrs.size < 2) state.pinch = null;
  const slop = e.pointerType === 'touch' ? 12 : 6;
  if (had && state.drag && state.moved <= slop && e.type === 'pointerup') {
    const id = pickAt(e.clientX, e.clientY);
    if (state.onPick) state.onPick(id);
  }
  if (!state.ptrs.size) { state.drag = null; state.cv.style.cursor = 'grab'; }
}
function onWheel(e) {
  e.preventDefault();
  const f = Math.exp(-U.clamp(e.deltaY, -80, 80) * 0.002);
  zoomTo(f);
}

/* ---------- API ---------- */
const api = {
  init, resize, fit, focus, zoomTo,
  setZones(rows) { state.rows = rows; state.needs = true; },
  setRates(rates) { state.rates = rates; state.needs = true; },
  setMarches(list) { state.marches = list || []; state.needs = true; },
  setBattles(list) { state.battles = list || []; state.needs = true; },
  battleResult(zoneId, info) { battleResult(zoneId, info); },
  setSelected(id) { state.selected = id == null ? -1 : id; state.needs = true; },
  setTerrainMode(mode) { state.terrainMode = mode === 'faction' ? 'faction' : '3d'; state.needs = true; },
  setTargets(set) { state.targets = set && set.size ? set : null; state.needs = true; },
  setMe(clan) { state.me = clan; state.needs = true; },
  battle(id, color) {
    const z = state.byId[id]; if (!z) return;
    const p = projectCell(z); if (p.z < 0.05) return;
    state.battleFx.push({ id, t0: performance.now() });
    state.rings.push({ x: p.x, y: p.y, color: color || '#fff', t0: performance.now(), dur: 1000, R: 70, w: 3 });
    state.rings.push({ x: p.x, y: p.y, color: '#fff', t0: performance.now() + 120, dur: 760, R: 38, w: 2 });
    state.needs = true;
  },
  ping(id, color) {
    const z = state.byId[id]; if (!z) return;
    const p = projectCell(z); if (p.z < 0.05) return;
    state.rings.push({ x: p.x, y: p.y, color: color || '#f2ce4b', t0: performance.now(), dur: 1100, R: 90, w: 2.2 });
    state.needs = true;
  },
  birthPulse(clan) { state.spawns.push({ clan, t0: performance.now() }); state.needs = true; },
  screenOf(id) { const z = state.byId[id]; if (!z) return null; const p = projectCell(z); return { x: p.x, y: p.y, z: p.z }; },
  get state() { return state; },
  set onPick(fn) { state.onPick = fn; },
  set onHover(fn) { state.onHover = fn; },
  refreshInsets: computeInsets,
};

ORE.world = { generate: generateWorld, map: api, drawUnit, projectV, projectCell, battleResult };
})();
