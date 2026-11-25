/*
 * Remix: stravolge davvero la base. Da un seme (testo + numero di versione) costruisce ritmo di cassa, rullante,
 * hi-hat, giro di accordi, mix e seme melodico. Ogni versione è un'altra, ma resta nello stile.
 * make(seed, opt) → { groove:{kickPats,snare,rolls,swing}, prog:[4 gradi], tune:{hat,bass,lift,kickVar}, melSeed, label }
 *   opt: { half:true se il rullante è a mezzo tempo, heavy, mode:'minore'|'maggiore', wild:true per salti più grandi }
 * distance(a,b) → numero 0..1 di quanto due remix differiscono (usato nei test: Misurato).
 * Tutte le scelte sono schemi ritmici generici, non copie di nessuna canzone.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Remix = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var KICKS = [[0, 10], [0, 7, 10], [0, 3, 7, 10], [0, 6, 11], [0, 3, 10], [0, 4, 7, 12], [0, 2, 10, 14], [0, 7, 13], [0, 10, 13], [0, 3, 6, 10, 13], [0, 5, 10], [0, 8, 11], [0, 6, 10, 14], [0, 11], [0, 3, 8, 11], [0, 7, 10, 14], [0, 2, 7, 11], [0, 9, 12], [0, 4, 10, 15], [0, 6, 8, 13]];
  var SNARE_HALF = [[8], [8], [8, 14], [8, 11], [8, 15], [9]];
  var SNARE_FULL = [[4, 12], [4, 12], [4, 12, 15], [6, 14], [4, 10, 12], [5, 13]];
  var PROG_MIN = [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6], [5, 6, 0, 0], [0, 0, 5, 5], [0, 5, 3, 4], [0, 3, 0, 3], [0, 0, 3, 6], [0, 2, 5, 6], [0, 6, 3, 5], [0, 4, 5, 3], [0, 5, 6, 0], [5, 3, 0, 6], [0, 3, 6, 5], [0, 6, 0, 4], [0, 2, 3, 6], [5, 6, 2, 0], [0, 5, 0, 6], [0, 1, 5, 4], [0, 3, 4, 5], [0, 6, 5, 4], [0, 0, 6, 6], [0, 4, 3, 6], [0, 5, 4, 3]];
  var PROG_MAJ = [[0, 4, 5, 3], [5, 3, 0, 4], [0, 3, 4, 3], [3, 4, 0, 5], [0, 5, 3, 4], [0, 3, 5, 4], [5, 4, 3, 4], [0, 2, 3, 4]];
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

  function rng(seed) { var a = (seed >>> 0) || 1; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function round(v) { return Math.round(v * 100) / 100; }
  /* seconda battuta: lo stesso schema con un colpo spostato o aggiunto, così la base respira */
  function variation(r, k) {
    var b = k.slice(), i = 1 + Math.floor(r() * Math.max(1, b.length - 1));
    if (b.length > 1 && r() < 0.6) b[i] = Math.min(15, b[i] + (r() < 0.5 ? 1 : -1)); else { var add = 1 + Math.floor(r() * 15); if (b.indexOf(add) < 0) b.push(add); }
    b = b.filter(function (x, j) { return x >= 0 && x < 16 && b.indexOf(x) === j; }).sort(function (x, y) { return x - y; });
    if (b.indexOf(0) < 0) b.unshift(0);
    return b;
  }
  function progName(prog, mode) { var minor = mode !== 'maggiore', q = minor ? [1, 0, 0, 1, 1, 0, 0] : [0, 1, 1, 0, 0, 1, 0]; return prog.map(function (d) { return q[d] ? ROMAN[d].toLowerCase() : ROMAN[d]; }).join('–'); }

  function make(seed, opt) {
    opt = opt || {}; var r = rng(seed * 2654435761 + 97), minor = opt.mode !== 'maggiore';
    var k1 = pick(r, KICKS), k2 = pick(r, KICKS), pairs = [[k1, variation(r, k1)], [k2, variation(r, k2)]];
    var snare = pick(r, opt.half === false ? SNARE_FULL : SNARE_HALF);
    var rolls = round(opt.heavy ? 0.35 + r() * 0.6 : 0.05 + r() * 0.5), swing = round(opt.heavy ? r() * 0.06 : r() * 0.14);
    var prog = pick(r, minor ? PROG_MIN : PROG_MAJ).slice();
    var tune = { hat: round(0.6 + r() * 0.9), bass: round(0.8 + r() * 0.7), lift: round(0.8 + r() * 0.6), kickVar: round(0.7 + r() * 0.8) };
    var melSeed = 1 + Math.floor(r() * 9999);
    var label = 'cassa ' + pairs[0][0].map(function (x) { return x + 1; }).join('·') + ' · rullante ' + snare.map(function (x) { return x + 1; }).join('·') + ' · hi-hat ' + (rolls > 0.6 ? 'a raffica' : rolls > 0.3 ? 'con rullate' : 'sobri');
    return { groove: { kickPats: pairs, snare: snare, rolls: rolls, swing: swing }, prog: prog, tune: tune, melSeed: melSeed, label: label };
  }
  function setDist(a, b) { var u = {}, n = 0; a.concat(b).forEach(function (x) { u[x] = 1; }); Object.keys(u).forEach(function (x) { var i = a.indexOf(+x) >= 0, j = b.indexOf(+x) >= 0; if (i !== j) n++; }); return Object.keys(u).length ? n / Object.keys(u).length : 0; }
  function distance(a, b) {
    var d = 0;
    d += 0.3 * setDist(a.groove.kickPats[0][0], b.groove.kickPats[0][0]);
    d += 0.15 * setDist(a.groove.snare, b.groove.snare);
    d += 0.3 * (a.prog.join() === b.prog.join() ? 0 : (4 - a.prog.filter(function (x, i) { return x === b.prog[i]; }).length) / 4);
    d += 0.1 * Math.min(1, Math.abs(a.groove.rolls - b.groove.rolls) * 2);
    d += 0.15 * (a.melSeed === b.melSeed ? 0 : 1);
    return round(d);
  }
  return { make: make, distance: distance, progName: progName, KICKS: KICKS, PROG_MIN: PROG_MIN };
});
