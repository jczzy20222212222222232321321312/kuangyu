/* 矿域 — spatial battle / march / mining audio.
   Uses licensed recordings (see audio/ATTRIBUTION.md) and stereo panning.
   Source volume follows the globe projection: front + centered = loudest,
   side/back = panned and attenuated. */
(function () {
  'use strict';
  const ORE = (window.ORE = window.ORE || {});
  const FILES = {
    sword: 'audio/sword-clash.mp3',
    march: 'audio/army-march.mp3',
    pick: 'audio/pickaxe.mp3',
    arrow: 'audio/arrow-whoosh.mp3',
    horn: 'audio/war-horn.mp3',
  };
  const A = {
    ctx: null, master: null, enabled: true, muted: false,
    buffers: {}, loadPromise: null, loops: new Map(),
    beats: new Map(), own: new Map(), lastHorn: new Map(),
  };

  function ensureCtx() {
    if (A.ctx) return A.ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try { A.ctx = new Ctor(); } catch (e) { return null; }
    A.master = A.ctx.createGain();
    A.master.gain.value = A.enabled ? 0.62 : 0;
    A.master.connect(A.ctx.destination);
    loadSamples();
    return A.ctx;
  }

  function loadSamples() {
    if (A.loadPromise || !A.ctx) return A.loadPromise;
    A.loadPromise = Promise.all(Object.keys(FILES).map(async (name) => {
      try {
        const res = await fetch(FILES[name], { cache: 'force-cache' });
        if (!res.ok) throw new Error('audio ' + res.status);
        const data = await res.arrayBuffer();
        A.buffers[name] = await A.ctx.decodeAudioData(data);
      } catch (e) { console.warn('audio missing', name, e.message); }
    }));
    return A.loadPromise;
  }

  function resume() {
    const ctx = ensureCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function panner(ctx, pan) {
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      return p;
    }
    return ctx.createGain();
  }

  // Screen-space spatialization from the actual globe projection.
  function spatial(zone) {
    const W = ORE.world && ORE.world.map && ORE.world.map.state;
    if (!zone || !zone.vCenter || !W) return { pan: 0, gain: 0 };
    try {
      const p = ORE.world.projectV(zone.vCenter);
      const ins = W.insets || { l: 0, r: 0, t: 0, b: 0 };
      const Wp = W.W || window.innerWidth;
      const cx = ins.l + Math.max(100, Wp - ins.l - ins.r) / 2;
      const R = Math.max(40, W.cam && W.cam.s ? W.cam.s : 200);
      const pan = Math.max(-1, Math.min(1, (p.x - cx) / R));
      const facing = Math.max(0, Math.min(1, (p.z + 0.12) / 0.75));
      const edge = Math.max(0, 1 - 0.78 * Math.abs(pan));
      const gain = 0.04 + 0.96 * Math.pow(facing, 1.35) * edge;
      return { pan, gain };
    } catch (e) { return { pan: 0, gain: 0.35 }; }
  }

  function playSample(name, pan, vol, opts) {
    const ctx = ensureCtx();
    if (!ctx || !A.buffers[name] || !A.enabled || A.muted) return;
    const b = A.buffers[name];
    const o = opts || {};
    const t0 = ctx.currentTime + 0.006;
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = o.rate || (0.94 + Math.random() * 0.12);
    const g = ctx.createGain();
    const v = Math.max(0.0001, vol);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack || 0.012));
    const dur = Math.min(o.duration || 0.7, Math.max(0.05, b.duration - (o.offset || 0)));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const p = panner(ctx, Math.max(-1, Math.min(1, pan)));
    src.connect(g); g.connect(p); p.connect(A.master);
    const off = o.offset != null ? Math.min(o.offset, Math.max(0, b.duration - 0.02)) : Math.random() * Math.max(0, b.duration - 0.3);
    src.start(t0, off);
    src.stop(t0 + dur + 0.02);
  }

  function loopFor(key, name, sp, baseVol) {
    const ctx = ensureCtx();
    if (!ctx || !A.buffers[name] || !A.enabled || A.muted) return null;
    let v = A.loops.get(key);
    if (!v) {
      const b = A.buffers[name];
      const src = ctx.createBufferSource();
      src.buffer = b; src.loop = true; src.loopStart = 0; src.loopEnd = b.duration; src.playbackRate.value = 0.94 + Math.random() * 0.12;
      const g = ctx.createGain(); g.gain.value = 0.0001;
      const p = panner(ctx, sp.pan);
      src.connect(g); g.connect(p); p.connect(A.master);
      src.start(0, Math.random() * Math.max(0.1, b.duration - 0.5));
      v = { src, gain: g, pan: p, kind: name, born: Date.now() };
      A.loops.set(key, v);
    }
    const target = Math.max(0.0001, baseVol * sp.gain);
    v.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.10);
    if (v.pan.pan) v.pan.pan.setTargetAtTime(sp.pan, ctx.currentTime, 0.08);
    return v;
  }

  function stopLoop(key) {
    const v = A.loops.get(key);
    if (!v) return;
    A.loops.delete(key);
    const ctx = A.ctx;
    try {
      v.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
      setTimeout(() => { try { v.src.stop(); } catch (e) {} try { v.gain.disconnect(); } catch (e) {} }, 350);
    } catch (e) {}
  }

  function now() { return performance.now(); }

  function tick() {
    if (!A.enabled || A.muted) return;
    const G = ORE.game, s = G && G.state;
    if (!s || !Array.isArray(s.zones)) return;
    const ctx = ensureCtx(); if (!ctx) return;
    if (ctx.state === 'suspended') return;
    const t = now();
    const zones = new Map(s.zones.map((z) => [z.id, z]));
    const active = new Set();

    // Battle: own attack + enemy attack on your land. A long sword-fight
    // recording loops per battle, so it sounds like a real melee, not clicks.
    for (const b of (s.battles || [])) {
      const z = zones.get(b.to); if (!z) continue;
      if (!b.mine && z.owner !== s.clan) continue;
      const sp = spatial(z); if (sp.gain < 0.035) continue;
      const key = 'b:' + b.id;
      active.add(key);
      loopFor(key, 'sword', sp, b.mine ? 0.52 : 0.40);
      if (!A.lastHorn.has(key)) {
        A.lastHorn.set(key, t);
        playSample('horn', sp.pan, 0.38 * sp.gain, { offset: 0.2, duration: 2.4, rate: 0.9 });
      }
      const last = A.beats.get(key) || 0;
      if (t - last > 520 + Math.random() * 850) {
        A.beats.set(key, t);
        playSample('sword', sp.pan, 0.20 * sp.gain, { duration: 0.42, offset: 0.2 + Math.random() * 2.0, rate: 0.86 + Math.random() * 0.28 });
        if (Math.random() < 0.28) playSample('arrow', sp.pan, 0.17 * sp.gain, { duration: 0.7 });
        if (Math.random() < 0.10) playSample('horn', sp.pan, 0.12 * sp.gain, { duration: 1.2, rate: 0.82 + Math.random() * 0.18 });
      }
    }

    // March: the actual marching recording, one footfall phrase at a time.
    for (const m of (s.marches || [])) {
      if (!m.mine) continue;
      const z = zones.get(m.to); if (!z) continue;
      const sp = spatial(z); if (sp.gain < 0.04) continue;
      const key = 'm:' + m.id;
      const last = A.beats.get(key) || 0;
      if (t - last > 315 + Math.random() * 90) {
        A.beats.set(key, t);
        playSample('march', sp.pan, 0.55 * sp.gain, { duration: 0.62, offset: 0.2 + Math.random() * 12, rate: 0.92 + Math.random() * 0.10 });
      }
    }

    // Mining: own garrisoned tiles. Keep at most 6 audible pits.
    const pits = [];
    for (const z of s.zones) {
      if (z.owner !== s.clan) continue;
      const g = (z.garrisonIds && z.garrisonIds.length) || z.garrison || 0;
      if (!g) continue;
      const sp = spatial(z);
      if (sp.gain > 0.05) pits.push({ z, sp });
    }
    pits.sort((a, b) => b.sp.gain - a.sp.gain);
    for (const pit of pits.slice(0, 6)) {
      const key = 'p:' + pit.z.id;
      const last = A.own.get(key) || 0;
      if (t - last > 680 + Math.random() * 620) {
        A.own.set(key, t);
        playSample('pick', pit.sp.pan, 0.42 * pit.sp.gain, { duration: 0.21, rate: 0.9 + Math.random() * 0.15 });
      }
    }

    for (const key of [...A.loops.keys()]) if (!active.has(key)) stopLoop(key);
    if (A.beats.size > 500) {
      const live = new Set([...active, ...[...A.beats.keys()].filter((k) => k.startsWith('m:') || k.startsWith('p:'))]);
      for (const k of [...A.beats.keys()]) if (!live.has(k)) A.beats.delete(k);
    }
  }

  function setEnabled(v) {
    A.enabled = !!v;
    if (A.master) A.master.gain.value = A.enabled ? 0.62 : 0;
    if (!A.enabled) for (const key of [...A.loops.keys()]) stopLoop(key);
    try { localStorage.setItem('ore.audio', A.enabled ? '1' : '0'); } catch (e) {}
    return A.enabled;
  }
  function toggle() { return setEnabled(!A.enabled); }

  function unlock() {
    resume();
    loadSamples();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  }

  try { const sv = localStorage.getItem('ore.audio'); if (sv === '0') A.enabled = false; } catch (e) {}
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  window.addEventListener('touchstart', unlock, { passive: true });

  function paintBtn() {
    const b = document.getElementById('btnSound');
    if (!b) return;
    b.classList.toggle('off', !A.enabled);
    b.style.opacity = A.enabled ? '' : '.45';
    b.setAttribute('aria-pressed', A.enabled ? 'true' : 'false');
  }
  function initBtn() {
    const b = document.getElementById('btnSound');
    if (!b) return;
    paintBtn();
    let first = true;
    b.addEventListener('click', () => {
      // First press must not turn an already-enabled (but still silent) engine off.
      if (first) { first = false; setEnabled(true); }
      else toggle();
      resume(); paintBtn();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBtn);
  else initBtn();

  ORE.audio = { tick, toggle, setEnabled, enabled: () => A.enabled, unlock, spatial, paintBtn, loadSamples, _A: A };
})();
