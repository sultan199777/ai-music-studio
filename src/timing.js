/*
 * Correzione del tempo: misura di quanto la voce è in anticipo o in ritardo rispetto alla griglia della base
 * (semicrome al BPM del progetto) e sposta la voce. Si assume che la registrazione parta insieme alla base.
 * Misurato: inizi delle sillabe (onset) e loro distanza dalla semicroma più vicina. Ipotesi: la griglia è quella giusta.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Timing = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function onsets(x, sr) {
    var hop = Math.round(sr * 0.005), n = Math.floor(x.length / hop), env = new Float32Array(n), i, j, s;
    for (i = 0; i < n; i++) { s = 0; for (j = 0; j < hop; j++) { var v = x[i * hop + j] || 0; s += v * v; } env[i] = Math.sqrt(s / hop); }
    var mx = 0; for (i = 0; i < n; i++) if (env[i] > mx) mx = env[i];
    if (mx < 1e-4) return [];
    var out = [], last = -1e9, thr = mx * 0.12;
    for (i = 4; i < n; i++) {
      var prev = 0; for (j = 1; j <= 4; j++) prev += env[i - j] / 4;
      if (env[i] > thr && env[i] > prev * 2.2 && (i - last) * 0.005 > 0.09) { out.push(i * 0.005); last = i; }
    }
    return out;
  }
  /* -> {n, offsetMs (+ = voce in ritardo), spreadMs, reliable, grid} */
  function measure(x, sr, bpm, o) {
    o = o || {};
    var grid = 60 / (bpm || 140) / 4, on = onsets(x, sr), res = [], i;
    if (o.startAt) on = on.filter(function (t) { return t >= o.startAt; });
    for (i = 0; i < on.length; i++) { var k = Math.round(on[i] / grid); res.push(on[i] - k * grid); }
    if (res.length < 6) return { n: res.length, offsetMs: 0, spreadMs: 0, reliable: false, grid: grid };
    var s = res.slice().sort(function (a, b) { return a - b; }), med = s[s.length >> 1];
    var dev = res.map(function (r) { return Math.abs(r - med); }).sort(function (a, b) { return a - b; });
    var spread = dev[dev.length >> 1];
    return { n: res.length, offsetMs: Math.round(med * 1000), spreadMs: Math.round(spread * 1000), reliable: spread < grid * 0.25, grid: grid };
  }
  /* sposta la voce di -offsetMs (positivo = ritardo da togliere); restituisce una copia */
  function shift(x, sr, offsetMs) {
    var d = Math.round(-offsetMs / 1000 * sr), out = new Float32Array(x.length), i;
    for (i = 0; i < x.length; i++) { var j = i - d; out[i] = j >= 0 && j < x.length ? x[j] : 0; }
    return out;
  }
  return { onsets: onsets, measure: measure, shift: shift };
});
