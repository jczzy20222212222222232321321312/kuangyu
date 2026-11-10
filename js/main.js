/* 矿域 ORE.ZONE — boot */
(function () {
'use strict';
const ORE = window.ORE;

function boot() {
  const G = ORE.game;
  G.boot();
  if (G.syncServerTime) G.syncServerTime();
  const map = ORE.world.map;
  map.init(document.getElementById('map'), G.world);
  if (ORE.globe3d) ORE.globe3d.init();
  ORE.ui.init();
  G.syncMap();
  requestAnimationFrame(() => document.getElementById('map').classList.add('on'));

  setInterval(() => { try { G.tick(); } catch (e) { console.error(e); } }, 500);
  setInterval(() => { try { if (G.syncServerTime) G.syncServerTime(); } catch (e) {} }, 60000);
  // 空间音频：更细的节拍，保证刀剑/脚步的节奏感
  setInterval(() => { try { if (ORE.audio) ORE.audio.tick(); } catch (e) {} }, 160);
  // 按 M 静音/恢复
  window.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') {
      const on = ORE.audio ? ORE.audio.toggle() : false;
      if (ORE.ui && ORE.ui.toast) ORE.ui.toast(on ? '音效已开启' : '音效已静音', on ? 'good' : 'bad');
    }
  });
  setInterval(() => { try { G.save(); } catch (e) {} }, 6000);
  window.addEventListener('beforeunload', () => G.save());
  window.addEventListener('pagehide', () => G.save());
  window.__OREZONE__ = ORE;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
