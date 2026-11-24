/*
 * Beat Lab - mix (Tappa 4): valori di partenza degli effetti per stile/strumento ("punto di partenza", dalla ricerca C),
 * misura del volume (LUFS, BS.1770 con pesatura K e gate) e stima del picco reale (true peak, interpolazione 4x).
 * Nessun valore e' una regola: sono punti di partenza da regolare a orecchio.
 */
(function (root, factory) {
  var E = (typeof module === 'object' && module.exports) ? require('./beatlab-engine.js') : root.BeatEngine;
  if (typeof module === 'object' && module.exports) module.exports = factory(E);
  else root.BeatMix = factory(E);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';
  var BASSY = { sub808: 1, sub: 1, bass: 1, basso: 1, bassoelettrico: 1, contrabbasso: 1 };

  // valori di partenza per traccia (eq in dB, il resto 0..1)
  function presetFor(t) {
    var f = E.defaultFx();
    if (t.kind === 'drum') {
      if (t.lane === 'kick') { f.eq.low = 2; f.comp = 0.3; }
      else if (t.lane === 'snare') { f.eq.high = 1.5; f.comp = 0.25; f.rev = 0.08; f.sat = 0.15; }
      else if (t.lane === 'clap') { f.rev = 0.2; f.eq.low = -4; }
      else if (t.lane === 'hat' || t.lane === 'ohat') { f.eq.low = -6; f.sc = 0; f.dly = 0.04; }
      else { f.eq.low = -3; f.rev = 0.1; }
      return f;
    }
    var inst = String(t.inst || '');
    if (inst.indexOf('808') >= 0 || BASSY[inst] || /bass/i.test(inst)) { f.eq.low = 2; f.eq.mid = -2; f.sat = 0.3; f.comp = 0.35; f.sc = 0.55; return f; }
    if (/lead|pluck|fm|synth/i.test(inst)) { f.dly = 0.22; f.rev = 0.12; f.eq.low = -4; return f; }
    if (/pad|strings|archi|choir|coro|organ/i.test(inst)) { f.rev = 0.3; f.eq.low = -3; f.sc = 0.3; return f; }
    f.rev = 0.15; f.eq.low = -3; f.sc = 0.2; // tastiere, chitarre, ecc.
    return f;
  }
  function applyPresets(p) { p.tracks.forEach(function (t) { t.fx = presetFor(t); }); var m = E.masterOf(p); m.ceil = -1; m.glue = 0.3; m.revSize = 1.8; m.dlyFb = 0.35; m.dlyDiv = 0; return p; }
  function resetFx(p) { p.tracks.forEach(function (t) { t.fx = E.defaultFx(); }); var m = E.masterOf(p); m.glue = 0; return p; }

  // --- filtri biquad (coefficienti RBJ) ---
  function shelf(type, f0, gainDb, sr, Q) { var A = Math.pow(10, gainDb / 40), w = 2 * Math.PI * f0 / sr, c = Math.cos(w), s = Math.sin(w), al = s / 2 * Math.sqrt((A + 1 / A) * (1 / Q - 1) + 2), r = 2 * Math.sqrt(A) * al, a0, b0, b1, b2, a1, a2;
    if (type === 'high') { b0 = A * ((A + 1) + (A - 1) * c + r); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - r); a0 = (A + 1) - (A - 1) * c + r; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - r; }
    return { b: [b0 / a0, b1 / a0, b2 / a0], a: [1, a1 / a0, a2 / a0] }; }
  function highpass(f0, sr, Q) { var w = 2 * Math.PI * f0 / sr, c = Math.cos(w), al = Math.sin(w) / (2 * Q), a0 = 1 + al; return { b: [(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0], a: [1, -2 * c / a0, (1 - al) / a0] }; }
  function run(f, x) { var y = new Float64Array(x.length), x1 = 0, x2 = 0, y1 = 0, y2 = 0, b = f.b, a = f.a;
    for (var i = 0; i < x.length; i++) { var v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; }
  function kWeight(x, sr) { return run(highpass(38.13547, sr, 0.5003), run(shelf('high', 1681.97, 3.99984, sr, 0.7071), x)); }

  // LUFS integrato (gate assoluto -70, relativo -10) di piu' canali (array di Float32Array)
  function lufs(chans, sr) {
    var K = chans.map(function (c) { return kWeight(c, sr); }), N = K[0].length, blk = Math.round(0.4 * sr), hop = Math.round(0.1 * sr), ms = [];
    if (N < blk) return -Infinity;
    for (var s = 0; s + blk <= N; s += hop) { var z = 0; K.forEach(function (k) { var e = 0; for (var i = s; i < s + blk; i++) e += k[i] * k[i]; z += e / blk; }); ms.push(z); }
    var L = function (z) { return -0.691 + 10 * Math.log10(z); };
    var abs = ms.filter(function (z) { return z > 0 && L(z) > -70; }); if (!abs.length) return -Infinity;
    var mean = abs.reduce(function (a, b) { return a + b; }, 0) / abs.length, rel = L(mean) - 10;
    var g = abs.filter(function (z) { return L(z) > rel; }); if (!g.length) return -Infinity;
    return L(g.reduce(function (a, b) { return a + b; }, 0) / g.length);
  }
  // picco campionato e picco reale stimato (interpolazione cubica 4x), in dBFS
  function peaks(chans) {
    var pk = 0, tp = 0;
    chans.forEach(function (c) { for (var i = 0; i < c.length; i++) { var a = Math.abs(c[i]); if (a > pk) pk = a; if (a > tp) tp = a;
      if (i >= 1 && i < c.length - 2 && (a > 0.5 || Math.abs(c[i + 1]) > 0.5)) { var y0 = c[i - 1], y1 = c[i], y2 = c[i + 1], y3 = c[i + 2];
        for (var q = 1; q < 4; q++) { var t = q / 4, v = y1 + 0.5 * t * (y2 - y0 + t * (2 * y0 - 5 * y1 + 4 * y2 - y3 + t * (3 * (y1 - y2) + y3 - y0))); if (Math.abs(v) > tp) tp = Math.abs(v); } } } });
    var db = function (x) { return x > 0 ? 20 * Math.log10(x) : -Infinity; };
    return { peakDb: db(pk), truePeakDb: db(tp) };
  }
  function loudness(chans, sr) { var p = peaks(chans); return { lufs: lufs(chans, sr), peakDb: p.peakDb, truePeakDb: p.truePeakDb }; }
  // consiglio in parole semplici (obiettivi indicativi della ricerca C: circa -14 LUFS, picco reale <= -1 dB)
  function advice(m) {
    if (!isFinite(m.lufs)) return 'Troppo silenzioso per misurare.';
    var out = [];
    if (m.lufs > -9) out.push('Molto forte (' + m.lufs.toFixed(1) + ' LUFS): rischi distorsione. Abbassa il volume master o la saturazione.');
    else if (m.lufs > -12.5) out.push('Forte (' + m.lufs.toFixed(1) + ' LUFS): in linea con un beat compresso, un po\' sopra i -14 delle piattaforme (che lo abbassano da sole).');
    else if (m.lufs > -16) out.push('Volume vicino ai -14 LUFS usati dalle piattaforme (' + m.lufs.toFixed(1) + ').');
    else out.push('Piano (' + m.lufs.toFixed(1) + ' LUFS): puoi alzare il volume master.');
    if (m.truePeakDb > -1) out.push('Il picco reale supera -1 dB: abbassa il tetto del limiter o il master.');
    return out.join(' ');
  }
  return { presetFor: presetFor, applyPresets: applyPresets, resetFx: resetFx, lufs: lufs, peaks: peaks, loudness: loudness, advice: advice, kWeight: kWeight };
});
