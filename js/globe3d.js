/* Ore Zone — optional WebGL planet. Real displaced sphere + 3D trees + lighting.
   It sits behind the 2D canvas; the 2D canvas keeps cells, avatars and labels. */
(function () {
  'use strict';
  const ORE = (window.ORE = window.ORE || {});
  const G3 = { ready: false, canvas: null, renderer: null, scene: null, camera: null, group: null, terrain: null, treeMesh: null, mode: '3d' };

  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function ang(a, b) { return Math.acos(Math.max(-1, Math.min(1, dot(a, b)))); }
  function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function noise(v) {
    const h = Math.sin(v[0] * 12.9898 + v[1] * 78.233 + v[2] * 37.719) * 43758.5453;
    return h - Math.floor(h);
  }
  function inReg(v, r) { return ang(v, r.center) <= r.radius; }

  function terrainAt(v, tw) {
    for (const o of tw.oceans) {
      const d = ang(v, o.center);
      if (d <= o.radius) return { kind: 'ocean', h: -0.008, color: 0x17566b, center: 0x031b2a, edge: 0x73c6c5, t: d / o.radius };
    }
    for (const o of tw.oceans) if (ang(v, o.center) < o.radius + 0.022) return { kind: 'shore', h: 0.002, color: 0xbfa96f };
    if (ang(v, tw.capN.center) < tw.capN.radius || ang(v, tw.capS.center) < tw.capS.radius) {
      const cap = ang(v, tw.capN.center) < tw.capN.radius ? tw.capN : tw.capS;
      const d = ang(v, cap.center);
      const edge = Math.max(0, 1 - d / cap.radius);
      return { kind: 'snow', h: 0.014 + edge * 0.018 + noise(v) * 0.012, color: 0xdfeae7, center: 0x88aeb9, edge: 0xffffff, t: d / cap.radius };
    }
    for (const d of tw.deserts) {
      if (inReg(v, d)) { const t = ang(v, d.center) / d.radius; return { kind: 'desert', h: 0.004 + noise(v) * 0.005, color: 0xb18a54, center: 0x4e3518, edge: 0xe6c58c, t }; }
    }
    for (const f of tw.forests) {
      if (inReg(v, f)) { const t = ang(v, f.center) / f.radius; return { kind: 'forest', h: 0.009 + noise(v) * 0.007, color: 0x265237, center: 0x082818, edge: 0x6a9650, t }; }
    }
    for (const p of tw.plateaus) {
      if (inReg(v, p)) { const t = ang(v, p.center) / p.radius; return { kind: 'plateau', h: 0.024 + noise(v) * 0.008, color: 0x8d6a48, center: 0x3f2a16, edge: 0xb89565, t }; }
    }
    const t = noise([v[0] * 2.3, v[1] * 2.3, v[2] * 2.3]);
    return { kind: 'grass', h: 0.003 + noise(v) * 0.006, color: 0x56743f, center: 0x26451f, edge: 0x9caf64, t };
  }

  function detailTexture() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const x = c.getContext('2d');
    const img = x.createImageData(c.width, c.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = 205 + Math.floor(Math.random() * 50);
      img.data[i] = n; img.data[i + 1] = n; img.data[i + 2] = n; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    // fine dark cracks / grain
    x.globalAlpha = 0.18;
    x.strokeStyle = '#56564f';
    for (let i = 0; i < 220; i++) {
      const px = Math.random() * c.width, py = Math.random() * c.height;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + (Math.random() - 0.5) * 26, py + (Math.random() - 0.5) * 16); x.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 2);
    tex.anisotropy = G3.renderer ? G3.renderer.capabilities.getMaxAnisotropy() : 1;
    return tex;
  }

  const THEMES = {
    tide: { center: 0x0a3552, edge: 0xc3e7ee, water: 0x0a5076, rock: 0x7f9ba3, snow: 0xe9f7f6 },
    ember: { center: 0x163b20, edge: 0x78a956, water: 0x2d6545, rock: 0x4f5c3e, snow: 0xdcebdd },
    dune: { center: 0x5e421c, edge: 0xe8c56c, water: 0x275e70, rock: 0xb88743, snow: 0xead7a5 },
  };

  function cellOwner(cell, st) {
    const row = st.rows && st.rows[cell.id];
    return (row && row.owner) || cell.owner;
  }

  function cellPeaksFor(cell) {
    const out = [];
    const n = 1 + Math.floor(noise([cell.id * 0.31, 7, 3]) * 3);
    for (let j = 0; j < n; j++) {
      const phi = noise([cell.id, j, 11]) * Math.PI * 2;
      const off = 0.045 + noise([cell.id, j, 17]) * 0.11;
      const c = cell.vCenter;
      const ref = Math.abs(c[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      const u = norm([c[1] * ref[2] - c[2] * ref[1], c[2] * ref[0] - c[0] * ref[2], c[0] * ref[1] - c[1] * ref[0]]);
      const v = norm([c[1] * u[2] - c[2] * u[1], c[2] * u[0] - c[0] * u[2], c[0] * u[1] - c[1] * u[0]]);
      const p = norm([c[0] + (u[0] * Math.cos(phi) + v[0] * Math.sin(phi)) * off,
        c[1] + (u[1] * Math.cos(phi) + v[1] * Math.sin(phi)) * off,
        c[2] + (u[2] * Math.cos(phi) + v[2] * Math.sin(phi)) * off]);
      out.push({ v: p, radius: 0.035 + noise([cell.id, j, 23]) * 0.075, h: 0.02 + noise([cell.id, j, 29]) * 0.09 });
    }
    return out;
  }

  function sampleSurface(v, cell, owner, peaks) {
    const th = THEMES[owner] || THEMES.ember;
    const d = ang(v, cell.vCenter);
    const t = Math.max(0, Math.min(1, d / 0.30));
    const n1 = noise([v[0] * 7, v[1] * 7, v[2] * 7]);
    let h = 0.004 + n1 * 0.013;
    let color = new THREE.Color(th.center).lerp(new THREE.Color(th.edge), t);
    if (owner === 'tide' && n1 < 0.27) {
      h = -0.010 + n1 * 0.01;
      color.copy(new THREE.Color(th.water)).lerp(new THREE.Color(0x2c93a5), t * 0.55);
    }
    if (owner === 'ember') h += 0.004 + n1 * 0.007;
    if (owner === 'dune') h += 0.003 + n1 * 0.008;
    let peak = 0;
    for (const pk of peaks) {
      const dd = ang(v, pk.v);
      if (dd > pk.radius) continue;
      const inf = 1 - dd / pk.radius;
      const hh = inf * inf * (owner === 'ember' ? pk.h * 0.55 : pk.h);
      if (hh > peak) peak = hh;
    }
    if (peak > 0.002) {
      h += peak;
      if (owner === 'tide') color.copy(peak > 0.028 ? new THREE.Color(th.snow) : new THREE.Color(th.rock));
      else if (owner === 'dune') color.copy(peak > 0.034 ? new THREE.Color(0xd9b46a) : new THREE.Color(th.rock));
      else color.lerp(new THREE.Color(0x365b32), Math.min(1, peak / 0.08));
    }
    color.offsetHSL(0, (noise([v[1] * 8, v[2] * 8, v[0] * 8]) - 0.5) * 0.035, (noise([v[2] * 6, v[0] * 6, v[1] * 6]) - 0.5) * 0.06);
    return { h, color };
  }

  function buildTerrain() {
    const st = ORE.world.map.state;
    const cells = st.cells;
    if (!cells || !cells.length) return;
    if (!G3.cellOf) {
      G3.cellOf = new Uint16Array(0);
      G3.cellOfLen = 0;
    }
    const geo = new THREE.SphereGeometry(1, 220, 144);
    const pos = geo.attributes.position;
    if (G3.cellOf.length !== pos.count) {
      G3.cellOf = new Uint16Array(pos.count);
      for (let i = 0; i < pos.count; i++) {
        const v = [pos.getX(i), pos.getY(i), pos.getZ(i)];
        let best = 0, bd = -2;
        for (let c = 0; c < cells.length; c++) {
          const d = v[0] * cells[c].vCenter[0] + v[1] * cells[c].vCenter[1] + v[2] * cells[c].vCenter[2];
          if (d > bd) { bd = d; best = c; }
        }
        G3.cellOf[i] = best;
      }
    }
    if (!G3.cellPeaks) G3.cellPeaks = cells.map(cellPeaksFor);
    const colors = new Float32Array(pos.count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      let v = norm([pos.getX(i), pos.getY(i), pos.getZ(i)]);
      const cell = cells[G3.cellOf[i]];
      const owner = cellOwner(cell, st);
      const sample = sampleSurface(v, cell, owner, G3.cellPeaks[cell.id]);
      const r = 1 + sample.h;
      pos.setXYZ(i, v[0] * r, v[1] * r, v[2] * r);
      color.copy(sample.color);
      colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    if (G3.terrainRoot) {
      while (G3.terrainRoot.children.length) {
        const obj = G3.terrainRoot.children.pop();
        G3.terrainRoot.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      }
    } else {
      G3.terrainRoot = new THREE.Group();
      G3.group.add(G3.terrainRoot);
    }
    const detail = G3.detailTex || (G3.detailTex = detailTexture());
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, bumpMap: detail, bumpScale: 0.0045, roughness: 0.9, metalness: 0.0, flatShading: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    G3.terrain = mesh;
    G3.terrainRoot.add(mesh);

    // trees only on forest-owned territories
    const treePos = [];
    for (const cell of cells) {
      if (cellOwner(cell, st) !== 'ember') continue;
      const peaks = G3.cellPeaks[cell.id];
      const count = 3 + Math.floor(noise([cell.id, 5, 2]) * 3);
      for (let j = 0; j < count; j++) {
        const phi = noise([cell.id, j, 31]) * Math.PI * 2;
        const off = 0.06 + noise([cell.id, j, 37]) * 0.14;
        const c = cell.vCenter;
        const ref = Math.abs(c[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
        const u = norm([c[1] * ref[2] - c[2] * ref[1], c[2] * ref[0] - c[0] * ref[2], c[0] * ref[1] - c[1] * ref[0]]);
        const v = norm([c[1] * u[2] - c[2] * u[1], c[2] * u[0] - c[0] * u[2], c[0] * u[1] - c[1] * u[0]]);
        const p = norm([c[0] + (u[0] * Math.cos(phi) + v[0] * Math.sin(phi)) * off,
          c[1] + (u[1] * Math.cos(phi) + v[1] * Math.sin(phi)) * off,
          c[2] + (u[2] * Math.cos(phi) + v[2] * Math.sin(phi)) * off]);
        const sample = sampleSurface(p, cell, 'ember', peaks);
        treePos.push({ p, r: 1 + sample.h + 0.003, s: 0.28 + Math.pow(noise([p[0] * 11, p[1] * 11, p[2] * 11]), 1.5) * 2.1 });
      }
    }
    const coniferPos = [], broadPos = [];
    for (const t of treePos) {
      const pick = noise([t.p[0] * 12, t.p[1] * 17, t.p[2] * 9]);
      (pick > 0.36 ? broadPos : coniferPos).push(t);
    }
    const instanced = (geometry, material, list) => {
      if (!list.length) return null;
      const meshTree = new THREE.InstancedMesh(geometry, material, list.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3();
      list.forEach((t, i) => {
        p.set(t.p[0] * t.r, t.p[1] * t.r, t.p[2] * t.r);
        q.setFromUnitVectors(up, new THREE.Vector3(t.p[0], t.p[1], t.p[2]));
        const sc = Math.max(0.16, Math.min(3.0, t.s));
        m.compose(p, q, new THREE.Vector3(sc, sc, sc));
        meshTree.setMatrixAt(i, m);
      });
      meshTree.instanceMatrix.needsUpdate = true;
      meshTree.castShadow = true;
      G3.terrainRoot.add(meshTree);
      return meshTree;
    };
    const coniferGeo = new THREE.ConeGeometry(0.022, 0.062, 5);
    coniferGeo.translate(0, 0.031, 0);
    const broadGeo = new THREE.IcosahedronGeometry(0.034, 0);
    broadGeo.translate(0, 0.038, 0);
    G3.treeMesh = [
      instanced(coniferGeo, new THREE.MeshStandardMaterial({ color: 0x1c4b2e, roughness: 1, flatShading: true }), coniferPos),
      instanced(broadGeo, new THREE.MeshStandardMaterial({ color: 0x356b39, roughness: 1, flatShading: true }), broadPos),
    ].filter(Boolean);
    G3.ownerSig = st.cells.map((c) => cellOwner(c, st)).join('|');
  }

  function buildCastles() {
    const D = ORE.data || {};
    const baseByClan = ORE.world.map.state.world.baseByClan;
    if (!baseByClan) return;
    const up = new THREE.Vector3(0, 1, 0);
    const stone = new THREE.MeshStandardMaterial({ color: 0xb4a588, roughness: 0.95 });
    const stoneDark = new THREE.MeshStandardMaterial({ color: 0x766b58, roughness: 1 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a3b2b, roughness: 0.85 });
    for (const key of Object.keys(baseByClan)) {
      const b = baseByClan[key];
      if (!b || !b.vCenter) continue;
      const v = norm(b.vCenter);
      const g = new THREE.Group();
      const add = (geo, mat, x, y, z, sx, sy, sz) => {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        if (sx != null) mesh.scale.set(sx, sy, sz);
        mesh.castShadow = true; mesh.receiveShadow = true;
        g.add(mesh); return mesh;
      };
      add(new THREE.CylinderGeometry(0.082, 0.092, 0.018, 18), stoneDark, 0, 0.009, 0);
      add(new THREE.BoxGeometry(0.075, 0.05, 0.075), stone, 0, 0.043, 0);
      // curtain walls
      add(new THREE.BoxGeometry(0.145, 0.028, 0.012), stone, 0, 0.024, 0.058);
      add(new THREE.BoxGeometry(0.145, 0.028, 0.012), stone, 0, 0.024, -0.058);
      add(new THREE.BoxGeometry(0.012, 0.028, 0.145), stone, 0.058, 0.024, 0);
      add(new THREE.BoxGeometry(0.012, 0.028, 0.145), stone, -0.058, 0.024, 0);
      // towers
      for (const [x, z] of [[0.066, 0.066], [-0.066, 0.066], [0.066, -0.066], [-0.066, -0.066]]) {
        add(new THREE.CylinderGeometry(0.018, 0.022, 0.085, 10), stone, x, 0.05, z);
        add(new THREE.ConeGeometry(0.024, 0.035, 8), roofMat, x, 0.108, z);
      }
      // keep roof
      add(new THREE.ConeGeometry(0.055, 0.055, 4), roofMat, 0, 0.095, 0, 1, 1, 1).rotation.y = Math.PI / 4;
      // faction flag
      const pole = add(new THREE.CylinderGeometry(0.003, 0.003, 0.10, 6), stoneDark, 0.0, 0.12, 0.0);
      const col = (D.CLAN && D.CLAN[key] && D.CLAN[key].color) || '#d94a3d';
      const flag = add(new THREE.PlaneGeometry(0.038, 0.022), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }), 0.02, 0.153, 0);
      flag.rotation.y = Math.PI / 2;
      g.position.set(v[0] * 1.008, v[1] * 1.008, v[2] * 1.008);
      g.scale.setScalar(1.35);
      g.quaternion.setFromUnitVectors(up, new THREE.Vector3(v[0], v[1], v[2]));
      G3.group.add(g);
    }
  }

  function init() {
    if (!window.THREE) return;
    const canvas = document.getElementById('globe3d');
    if (!canvas) return;
    try {
      G3.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
      G3.renderer.setClearColor(0x000000, 0);
      G3.renderer.shadowMap.enabled = true;
      G3.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      G3.renderer.outputColorSpace = THREE.SRGBColorSpace;
      G3.scene = new THREE.Scene();
      G3.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
      G3.camera.position.set(0, 0, 5);
      G3.camera.lookAt(0, 0, 0);
      G3.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const key = new THREE.DirectionalLight(0xffedc4, 1.75);
      key.position.set(-4, 4.5, 5.5);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -1.4; key.shadow.camera.right = 1.4;
      key.shadow.camera.top = 1.4; key.shadow.camera.bottom = -1.4;
      key.shadow.camera.near = 0.1; key.shadow.camera.far = 10;
      G3.scene.add(key);
      const fill = new THREE.DirectionalLight(0x5d94a4, 0.45);
      fill.position.set(4, -2, 2); G3.scene.add(fill);
      G3.group = new THREE.Group(); G3.scene.add(G3.group);
      buildTerrain();
      buildCastles();
      G3.canvas = canvas;
      G3.ready = true;
      resize();
      canvas.style.display = 'block';
    } catch (e) {
      console.warn('WebGL globe disabled', e);
      G3.ready = false;
      if (canvas) canvas.style.display = 'none';
    }
  }

  function resize() {
    if (!G3.ready) return;
    const W = window.innerWidth, H = window.innerHeight;
    const dpr = Math.min(2.5, Math.max(1, (window.devicePixelRatio || 1) * 1.5));
    G3.renderer.setPixelRatio(dpr);
    G3.renderer.setSize(W, H, false);
    G3.canvas.style.width = W + 'px';
    G3.canvas.style.height = H + 'px';
  }

  function render() {
    if (!G3.ready) return;
    const st = ORE.world.map.state;
    const on = st.terrainMode === '3d';
    if (on) {
      const sig = st.cells.map((c) => cellOwner(c, st)).join('|');
      if (G3.ownerSig !== sig) buildTerrain();
    }
    G3.canvas.style.display = on ? 'block' : 'none';
    if (!on) return;
    const W = window.innerWidth, H = window.innerHeight, s = st.cam.s;
    if (G3.canvas.width !== Math.round(W * G3.renderer.getPixelRatio()) || G3.canvas.height !== Math.round(H * G3.renderer.getPixelRatio())) resize();
    const cam = G3.camera;
    cam.left = -W / (2 * s); cam.right = W / (2 * s);
    cam.top = H / (2 * s); cam.bottom = -H / (2 * s);
    cam.updateProjectionMatrix();
    const ins = st.insets;
    const C = { x: ins.l + Math.max(100, W - ins.l - ins.r) / 2, y: ins.t + Math.max(100, H - ins.t - ins.b) / 2 };
    G3.group.position.set((C.x - W / 2) / s, (H / 2 - C.y) / s, 0);
    const spin = st.cam.spin, tilt = st.cam.tilt;
    const m = new THREE.Matrix4().makeRotationX(tilt).multiply(new THREE.Matrix4().makeRotationZ(spin));
    G3.group.quaternion.setFromRotationMatrix(m);
    G3.renderer.render(G3.scene, G3.camera);
  }

  ORE.globe3d = { init, render, resize, ready: () => G3.ready, state: G3 };
})();
