/*
 * Gusto: impara dai ♥ e ✕ che metti alle basi generate. Salva SOLO numeri (stile, tonalità, pesantezza, BPM), mai audio né testi.
 * newMem() → memoria vuota; vote(mem, plan, +1|-1) → nuova memoria; profile(mem) → profilo per SultanBrain (styleScore) o null;
 * avoidList(mem) → stili da evitare (✕ ripetuti); summary(mem) → frase in italiano. Tutto misurato sui tuoi voti (Misurato).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Taste = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var MAX = 200;
  function newMem() { return { n: 0, up: 0, down: 0, g: {}, mode: { minore: 0, maggiore: 0 }, heavy: 0, bpm: [], log: [] }; }
  function copy(m) { return JSON.parse(JSON.stringify(m || newMem())); }
  function vote(mem, plan, v) {
    var m = copy(mem); if (!plan || !plan.genre || !v) return m;
    v = v > 0 ? 1 : -1; m.n++; if (v > 0) m.up++; else m.down++;
    m.g[plan.genre] = (m.g[plan.genre] || 0) + v;
    if (v > 0) {
      if (plan.mode === 'maggiore') m.mode.maggiore++; else m.mode.minore++;
      if (plan.heavy) m.heavy++;
      if (plan.bpm) { m.bpm.push(Math.round(plan.bpm)); if (m.bpm.length > 40) m.bpm.shift(); }
    }
    m.log.push([plan.genre, v]); if (m.log.length > MAX) m.log.shift();
    return m;
  }
  /* peso per stile: da -1 a +1, solo se hai votato abbastanza */
  function weights(mem) {
    var out = {}; if (!mem || mem.n < 3) return out;
    Object.keys(mem.g).forEach(function (k) {
      var tot = mem.log.filter(function (x) { return x[0] === k; }).length || 1;
      out[k] = Math.max(-1, Math.min(1, mem.g[k] / Math.max(2, tot)));
    });
    return out;
  }
  function profile(mem) {
    var w = weights(mem), ks = Object.keys(w); if (!ks.length) return null;
    var sc = {}; ks.forEach(function (k) { sc[k] = w[k]; });
    return { styleScore: sc, names: 'il tuo gusto (' + mem.up + ' ♥, ' + mem.down + ' ✕)', mood: 'seguo i tuoi voti' };
  }
  function avoidList(mem) {
    var w = weights(mem); return Object.keys(w).filter(function (k) { return w[k] <= -0.5; });
  }
  function bpmRange(mem) {
    if (!mem || mem.bpm.length < 3) return null; var s = mem.bpm.slice().sort(function (a, b) { return a - b; });
    return [s[Math.floor(s.length * 0.2)], s[Math.floor(s.length * 0.8)]];
  }
  function summary(mem) {
    if (!mem || !mem.n) return 'Non ho ancora votato nulla. Metti ♥ alle basi che ti piacciono e ✕ a quelle che scarti: imparo.';
    if (mem.n < 3) return 'Ho ' + mem.n + ' voti: ancora troppo pochi per capire il tuo gusto.';
    var w = weights(mem), ks = Object.keys(w).sort(function (a, b) { return w[b] - w[a]; }), love = ks.filter(function (k) { return w[k] > 0.2; }).slice(0, 3), no = avoidList(mem).slice(0, 3), r = bpmRange(mem);
    return 'Misurato su ' + mem.n + ' voti: ' + (love.length ? 'ti piacciono ' + love.join(', ') : 'nessuno stile spicca ancora') + (no.length ? '; scarti spesso ' + no.join(', ') : '') + (r ? '; BPM che scegli: ' + r[0] + '–' + r[1] : '') + (mem.heavy > mem.up / 2 ? '; di solito pesanti' : '') + '.';
  }
  function reset() { return newMem(); }
  return { newMem: newMem, vote: vote, weights: weights, profile: profile, avoidList: avoidList, bpmRange: bpmRange, summary: summary, reset: reset };
});
