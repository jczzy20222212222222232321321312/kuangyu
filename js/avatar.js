/* 矿域 矿域 — deterministic flat-shard warrior portraits */
(function () {
'use strict';
const ORE = (window.ORE = window.ORE || {});
const U = ORE.util;
const D = ORE.data;
const BONE = '#ece9e1', IRON = '#2b2b2b', IRON2 = '#1b1b1b', DARK = '#111';

function portrait(s, opts) {
  opts = opts || {};
  const rng = U.makeRng((s && s.seed) || 7);
  const clan = D.CLAN[s && s.clan] || D.CLANS[0];
  const accent = opts.mono ? '#8f8b82' : clan.color;
  const tier = D.TIERS[s && s.tier] || D.TIERS[0];
  const trim = tier.color;
  const skin = ['#ded7c8', '#cdc1ac', '#b9a88f', '#9a8068', '#e7e0d1'][rng.int(0, 4)];
  const dark = U.shade(skin, -0.35);
  const fem = s && s.gender === 'f';
  const helm = rng.int(0, 4);
  const visor = rng.int(0, 2);
  const cape = rng.chance(0.42);
  const crest = rng.chance(0.55);
  const scar = rng.chance(0.18);
  const id = 'avg' + ((s && s.seed) || 7);
  const shoulderY = 73;
  const headTop = fem ? 27 : 26;
  const jaw = fem ? 65 : 66;
  let o = '';
  o += '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">';
  o += '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">'
    + '<stop offset="0" stop-color="' + U.shade(accent, -0.55) + '"/>'
    + '<stop offset="1" stop-color="' + U.shade(accent, -0.82) + '"/></linearGradient></defs>';
  o += '<rect width="100" height="100" fill="#0b0b0b"/>';
  o += '<polygon points="0,0 100,0 100,100" fill="' + U.rgba(accent, 0.055) + '"/>';
  o += '<polygon points="0,100 0,58 26,100" fill="' + U.rgba(accent, 0.035) + '"/>';
  if (cape) {
    o += '<polygon points="6,100 15,69 34,60 50,68 66,60 85,69 94,100" fill="url(#' + id + ')"/>';
    o += '<polygon points="12,100 20,72 36,64 50,71 64,64 80,72 88,100" fill="' + U.rgba(accent, 0.16) + '"/>';
  }
  // shoulders
  o += '<polygon points="9,100 15,80 33,71 50,77 67,71 85,80 91,100" fill="' + IRON + '" stroke="#000" stroke-width="2.4"/>';
  o += '<polygon points="17,100 21,83 35,76 47,81 47,100" fill="#242424"/>';
  o += '<polygon points="83,100 79,83 65,76 53,81 53,100" fill="#242424"/>';
  // pauldron accents
  o += '<polygon points="13,83 33,74 37,80 19,91" fill="' + U.shade(accent, -0.25) + '" stroke="#000" stroke-width="1.8"/>';
  o += '<polygon points="87,83 67,74 63,80 81,91" fill="' + U.shade(accent, -0.25) + '" stroke="#000" stroke-width="1.8"/>';
  // neck
  o += '<polygon points="43,62 57,62 58,78 42,78" fill="' + dark + '" stroke="#000" stroke-width="1.8"/>';
  // female hair mass behind head
  if (fem) {
    o += '<polygon points="32,34 40,22 60,22 68,34 71,58 64,70 62,50 38,50 36,70 29,58" fill="#191919" stroke="#000" stroke-width="2"/>';
    o += '<polygon points="29,58 36,70 33,84 25,76" fill="#191919"/>';
    o += '<polygon points="71,58 64,70 67,84 75,76" fill="#191919"/>';
  }
  // head
  if (fem) {
    o += '<polygon points="37,34 45,27 55,27 63,34 61,53 55,65 45,65 39,53" fill="' + skin + '" stroke="#000" stroke-width="2.2"/>';
  } else {
    o += '<polygon points="35,34 44,' + headTop + ' 56,' + headTop + ' 65,34 64,53 57,' + jaw + ' 43,' + jaw + ' 36,53" fill="' + skin + '" stroke="#000" stroke-width="2.2"/>';
  }
  // face shading half
  o += '<polygon points="50,28 63,34 61,53 55,64 50,65" fill="' + U.rgba('#000', 0.1) + '"/>';
  if (scar) {
    o += '<path d="M42 40 L46 52 L43 55" fill="none" stroke="' + U.shade(skin, -0.45) + '" stroke-width="1.2"/>';
  }
  // helmet
  if (helm === 0) {
    o += '<polygon points="33,40 35,27 43,22 57,22 65,27 67,40 59,40 57,30 43,30 41,40" fill="' + IRON2 + '" stroke="#000" stroke-width="2"/>';
    o += '<polygon points="31,39 69,39 69,45 31,45" fill="' + IRON + '" stroke="#000" stroke-width="2"/>';
  } else if (helm === 1) {
    o += '<polygon points="33,44 33,32 41,24 59,24 67,32 67,44 61,44 59,30 41,30 39,44" fill="' + IRON + '" stroke="#000" stroke-width="2"/>';
    o += '<polygon points="33,44 40,42 41,58 34,51" fill="' + IRON + '" stroke="#000" stroke-width="2"/>';
    o += '<polygon points="67,44 60,42 59,58 66,51" fill="' + IRON + '" stroke="#000" stroke-width="2"/>';
  } else if (helm === 2) {
    o += '<polygon points="34,44 34,32 42,24 58,24 66,32 66,44 60,44 58,30 42,30 40,44" fill="' + IRON2 + '" stroke="#000" stroke-width="2"/>';
    o += '<polygon points="33,33 22,14 38,24" fill="' + BONE + '" stroke="#000" stroke-width="2"/>';
    o += '<polygon points="67,33 78,14 62,24" fill="' + BONE + '" stroke="#000" stroke-width="2"/>';
    o += '<polygon points="31,40 69,40 69,45 31,45" fill="' + IRON + '" stroke="#000" stroke-width="2"/>';
  } else if (helm === 3) {
    o += '<polygon points="34,44 34,31 43,23 57,23 66,31 66,44 60,44 58,30 42,30 40,44" fill="' + IRON + '" stroke="#000" stroke-width="2"/>';
    o += '<polygon points="45,22 50,4 55,22" fill="' + trim + '" stroke="#000" stroke-width="2"/>';
    o += '<polygon points="43,40 57,40 57,44 43,44" fill="' + accent + '"/>';
  } else {
    o += '<polygon points="32,52 33,30 41,21 59,21 67,30 68,52 62,45 60,29 40,29 38,45" fill="' + U.shade(accent, -0.72) + '" stroke="#000" stroke-width="2"/>';
    o += '<polygon points="35,48 65,48 65,52 35,52" fill="' + U.rgba('#000', 0.35) + '"/>';
  }
  // visor
  if (visor === 0) {
    o += '<rect x="37" y="45" width="26" height="4.6" fill="#000"/>';
    o += '<rect x="39" y="46" width="22" height="2.2" fill="' + accent + '"/>';
  } else if (visor === 1) {
    o += '<polygon points="38,46 46,46 44,50 38,50" fill="#000"/><polygon points="54,46 62,46 62,50 56,50" fill="#000"/>';
    o += '<polygon points="39,47 45,47 44,49 39,49" fill="' + accent + '"/><polygon points="55,47 61,47 61,49 56,49" fill="' + accent + '"/>';
  } else {
    o += '<polygon points="36,44 64,44 64,49 56,54 44,54 36,49" fill="#000"/>';
    o += '<polygon points="39,46 61,46 61,48 39,48" fill="' + accent + '"/>';
  }
  // nose guard
  o += '<rect x="47.6" y="43" width="4.8" height="15" fill="' + IRON + '" stroke="#000" stroke-width="1.4"/>';
  // crest ridge
  if (crest && helm !== 3) {
    o += '<polygon points="46,22 50,10 54,22 52,28 48,28" fill="' + trim + '" stroke="#000" stroke-width="1.8"/>';
  }
  // clan marks on cheeks / brow
  o += '<polygon points="40,56 44,56 42,60" fill="' + U.rgba(accent, 0.9) + '"/>';
  o += '<polygon points="60,56 56,56 58,60" fill="' + U.rgba(accent, 0.9) + '"/>';
  // tier pips on chest
  for (let i = 0; i <= (s ? s.tier : 0); i++) {
    const x = 42 + i * 4.2;
    o += '<rect x="' + x + '" y="86" width="2.6" height="2.6" transform="rotate(45 ' + x + ' 87)" fill="' + trim + '"/>';
  }
  // frame
  o += '<rect x="1.2" y="1.2" width="97.6" height="97.6" fill="none" stroke="' + U.rgba('#fff', 0.06) + '" stroke-width="1"/>';
  o += '</svg>';
  return o;
}

ORE.avatar = { portrait };
})();
