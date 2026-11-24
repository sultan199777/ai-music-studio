/*
 * Designer di suoni (sintesi calcolata qui, nessun campione):
 *  - SYNTH wavetable: 4 forme d'onda (sinusoide → dente di sega → quadra → "vocale") e si scorre tra loro con
 *    "Posizione"; un LFO muove la posizione (movimento), unisono con più voci stonate (larghezza), filtro passa-basso
 *    con inviluppo, attacco e rilascio. Come Serum/Vital nel principio, scritto da zero.
 *  - 808 DESIGNER: decadimento, colpo iniziale (caduta di altezza), distorsione, tono (filtro), click.
 *  - EFFETTI di transizione: riser, downlifter, impact, reverse (crash al contrario).
 * Ogni synth salvato diventa uno strumento usabile nelle tracce (Instruments.registerCustom).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynthDesign = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var TS = 256;
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp(v, a, b) { v = +v; if (!isFinite(v)) v = a; return Math.max(a, Math.min(b, v)); }
  // 4 tavole d'onda a banda limitata (somma di armoniche)
  var TABLES = (function () {
    var defs = [function () { return 0; }, function (h) { return 1 / h; }, function (h) { return h % 2 ? 1 / h : 0; }, function (h) { var f = h * 110; return Math.exp(-Math.pow((f - 700) / 250, 2)) + 0.7 * Math.exp(-Math.pow((f - 1200) / 300, 2)) + 0.25 / h; }];
    return defs.map(function (amp, k) {
      var t = new Float32Array(TS), H = 24, mx = 0;
      for (var i = 0; i < TS; i++) { var v = k === 0 ? Math.sin(2 * Math.PI * i / TS) : 0; if (k) for (var h = 1; h <= H; h++) v += amp(h) * Math.sin(2 * Math.PI * h * i / TS); t[i] = v; if (Math.abs(v) > mx) mx = Math.abs(v); }
      for (i = 0; i < TS; i++) t[i] /= mx; return t;
    });
  })();
  var SYNTH_DEF = { pos: 0.35, lfo: 0.2, lfoHz: 0.5, voices: 3, detune: 12, cutoff: 0.6, res: 0.2, envAmt: 0.4, attack: 0.01, release: 0.25, decay: 0.6, sustain: 0.7 };
  var SYNTH_PRESETS = {
    'Pluck lucido': { pos: 0.4, voices: 3, detune: 10, cutoff: 0.35, envAmt: 0.7, attack: 0.002, decay: 0.25, sustain: 0.1, release: 0.2, lfo: 0 },
    'Pad largo': { pos: 0.55, voices: 7, detune: 22, cutoff: 0.45, envAmt: 0.2, attack: 0.5, decay: 1, sustain: 0.9, release: 1.2, lfo: 0.4, lfoHz: 0.25 },
    'Bell scura': { pos: 0.15, voices: 2, detune: 5, cutoff: 0.7, envAmt: 0.5, attack: 0.001, decay: 0.8, sustain: 0.2, release: 0.8, lfo: 0.1 },
    'Lead vocale': { pos: 0.95, voices: 3, detune: 9, cutoff: 0.65, res: 0.4, envAmt: 0.3, attack: 0.03, decay: 0.4, sustain: 0.8, release: 0.3, lfo: 0.3, lfoHz: 5 },
    'Supersaw trap': { pos: 0.33, voices: 7, detune: 28, cutoff: 0.55, envAmt: 0.35, attack: 0.005, decay: 0.5, sustain: 0.6, release: 0.35 }
  };
  function synthParams(o) { var p = {}; for (var k in SYNTH_DEF) p[k] = o && o[k] != null ? +o[k] : SYNTH_DEF[k]; p.pos = clamp(p.pos, 0, 1); p.voices = Math.round(clamp(p.voices, 1, 7)); p.cutoff = clamp(p.cutoff, 0.02, 1); p.res = clamp(p.res, 0, 0.95); return p; }
  function readTable(pos, ph) {
    var x = pos * 3, k = Math.min(2, Math.floor(x)), f = x - k, i = ph * TS, j = Math.floor(i), fr = i - j, a = TABLES[k], b = TABLES[k + 1], j2 = (j + 1) % TS;
    var va = a[j % TS] + (a[j2] - a[j % TS]) * fr, vb = b[j % TS] + (b[j2] - b[j % TS]) * fr; return va + (vb - va) * f;
  }
  /** Suona una nota del synth. Ritorna Float32Array. */
  function synth(params, midi, dur, sr) {
    var p = synthParams(params), rel = Math.max(0.01, p.release), n = Math.round((dur + rel) * sr), y = new Float32Array(n), f0 = mtof(midi);
    var ph = [], det = []; for (var v = 0; v < p.voices; v++) { ph.push(v / p.voices); det.push(p.voices === 1 ? 0 : (v / (p.voices - 1) - 0.5) * 2 * p.detune); }
    var lp1 = 0, lp2 = 0, att = Math.max(1, p.attack * sr), dec = Math.max(1, p.decay * sr), on = dur * sr;
    for (var i = 0; i < n; i++) {
      var t = i / sr, env = i < att ? i / att : (i < att + dec ? 1 - (1 - p.sustain) * (i - att) / dec : p.sustain); if (i > on) env *= Math.exp(-(i - on) / (rel * sr / 4));
      var pos = clamp(p.pos + p.lfo * 0.3 * Math.sin(2 * Math.PI * p.lfoHz * t), 0, 1), s = 0;
      for (v = 0; v < p.voices; v++) { ph[v] += f0 * Math.pow(2, det[v] / 1200) / sr; ph[v] -= Math.floor(ph[v]); s += readTable(pos, ph[v]); }
      s /= Math.sqrt(p.voices);
      var fc = Math.min(0.99, p.cutoff * p.cutoff + p.envAmt * env * 0.5), g = 1 - Math.exp(-2 * Math.PI * Math.min(16000, fc * 16000) / sr);
      lp1 += g * (s - lp1 - p.res * 2 * (lp2 - lp1)); lp2 += g * (lp1 - lp2);
      y[i] = lp2 * env * 0.5;
    }
    return y;
  }
  // ---------- 808 designer ----------
  var B808_DEF = { decay: 1.2, punch: 0.6, drive: 0.5, tone: 0.6, click: 0.3 };
  function b808Params(o) { var p = {}; for (var k in B808_DEF) p[k] = clamp(o && o[k] != null ? o[k] : B808_DEF[k], 0, k === 'decay' ? 4 : 1); return p; }
  function b808(params, midi, dur, sr, fromMidi, glide) {
    var p = b808Params(params), n = Math.round(dur * sr), y = new Float32Array(n), ph = 0, f1 = mtof(midi), f0 = fromMidi != null ? mtof(fromMidi) : f1, gl = glide || 0.08, drive = 1 + p.drive * 4, lp = 0;
    var cut = 1 - Math.exp(-2 * Math.PI * (120 + p.tone * 3000) / sr), rel = Math.min(n, Math.round(0.03 * sr));
    for (var i = 0; i < n; i++) {
      var t = i / sr, g = f0 === f1 ? 1 : 1 - Math.exp(-t / (gl / 3)), f = f0 * Math.pow(f1 / f0, g) * (1 + p.punch * 1.2 * Math.exp(-t * 40));
      ph += 2 * Math.PI * f / sr;
      var env = Math.exp(-t / Math.max(0.1, p.decay)), v = Math.tanh(Math.sin(ph) * drive) / Math.tanh(drive);
      v += p.click * Math.exp(-t * 300) * Math.sin(ph * 6);
      lp += cut * (v - lp);
      y[i] = lp * env * Math.min(1, i / 40) * Math.min(1, (n - i) / rel) * 0.9;
    }
    return y;
  }
  // ---------- effetti di transizione ----------
  function noise(seed) { var s = seed || 9; return function () { s = (s * 16807) % 2147483647; return s / 2147483647 * 2 - 1; }; }
  function riser(sec, sr) { var n = Math.round(sec * sr), y = new Float32Array(n), r = noise(3), lp = 0, ph = 0; for (var i = 0; i < n; i++) { var k = i / n, c = 1 - Math.exp(-2 * Math.PI * (300 + 9000 * k * k) / sr); lp += c * (r() - lp); ph += 2 * Math.PI * (200 + 1800 * k * k) / sr; y[i] = (lp * 0.8 + 0.2 * Math.sin(ph)) * k * k * 0.8; } return y; }
  function downlifter(sec, sr) { var y = riser(sec, sr); return y.reverse(); }
  function impact(sr) { var n = Math.round(2.5 * sr), y = new Float32Array(n), r = noise(5), ph = 0, lp = 0; for (var i = 0; i < n; i++) { var t = i / sr; ph += 2 * Math.PI * (45 + 80 * Math.exp(-t * 12)) / sr; lp += 0.08 * (r() - lp); y[i] = Math.sin(ph) * Math.exp(-t * 2.2) * 0.9 + lp * Math.exp(-t * 4) * 0.8 + r() * Math.exp(-t * 30) * 0.3; } return y; }
  function reverseCrash(sec, sr) { var n = Math.round(sec * sr), y = new Float32Array(n), r = noise(7), hp = 0, prev = 0; for (var i = 0; i < n; i++) { var x = r(); hp = 0.9 * (hp + x - prev); prev = x; y[i] = hp * Math.exp(-(i / sr) * 3) * 0.6; } return y.reverse(); }
  var FX = { riser: { nome: 'Riser (sale)', make: function (sr, bars, bs) { return riser(bs * (bars || 1), sr); }, end: true },
    downlifter: { nome: 'Downlifter (scende)', make: function (sr, bars, bs) { return downlifter(bs * (bars || 1), sr); } },
    impact: { nome: 'Impact (botta)', make: function (sr) { return impact(sr); } },
    reverse: { nome: 'Reverse (crash al contrario)', make: function (sr, bars, bs) { return reverseCrash(Math.min(2.5, bs), sr); }, end: true } };
  // ---------- 808 pronti ----------
  var B808_PRESETS = { 'Classico lungo': { decay: 2.2, punch: 0.5, drive: 0.35, tone: 0.45, click: 0.15 }, 'Distorto drill': { decay: 1.6, punch: 0.7, drive: 0.95, tone: 0.75, click: 0.3 }, 'Corto e secco': { decay: 0.45, punch: 0.9, drive: 0.5, tone: 0.6, click: 0.6 }, 'Sub pulito': { decay: 1.8, punch: 0.2, drive: 0, tone: 0.2, click: 0 }, 'Ruvido con click': { decay: 1.2, punch: 0.8, drive: 0.7, tone: 0.9, click: 0.9 } };
  // ---------- percussioni del mondo (sintetizzate: membrane e rumori filtrati) ----------
  function membrane(sr, f0, bend, dec, noiseAmt, seed) { var n = Math.round(sr * dec * 4), y = new Float32Array(n), r = noise(seed), ph = 0, lp = 0; for (var i = 0; i < n; i++) { var t = i / sr; ph += 2 * Math.PI * f0 * (1 + bend * Math.exp(-t * 60)) / sr; lp += 0.3 * (r() - lp); y[i] = (Math.sin(ph) + noiseAmt * lp * Math.exp(-t * 80)) * Math.exp(-t / dec) * 0.8; } return y; }
  function shaker(sr) { var n = Math.round(sr * 0.09), y = new Float32Array(n), r = noise(13), hp = 0, pv = 0; for (var i = 0; i < n; i++) { var x = r(); hp = 0.85 * (hp + x - pv); pv = x; var t = i / n; y[i] = hp * Math.sin(Math.PI * t) * 0.5; } return y; }
  var PERC = {
    conga: { nome: 'Conga', hit: function (sr, acc) { return membrane(sr, acc ? 330 : 220, 0.3, 0.12, 0.2, 21); }, steps: [3, 6, 10, 11, 14], acc: [6, 14] },
    bongo: { nome: 'Bongo', hit: function (sr, acc) { return membrane(sr, acc ? 520 : 400, 0.25, 0.07, 0.3, 22); }, steps: [2, 5, 7, 10, 13, 15], acc: [7, 15] },
    cajon: { nome: 'Cajón', hit: function (sr, acc) { return acc ? membrane(sr, 180, 0.2, 0.06, 1.2, 23) : membrane(sr, 75, 0.5, 0.1, 0.4, 24); }, steps: [0, 4, 7, 10, 12], acc: [4, 12] },
    shaker: { nome: 'Shaker', hit: function (sr) { return shaker(sr); }, steps: [0, 2, 4, 6, 8, 10, 12, 14], acc: [2, 6, 10, 14] },
    tabla: { nome: 'Tabla', hit: function (sr, acc) { return membrane(sr, acc ? 480 : 150, acc ? 0.05 : 0.8, acc ? 0.18 : 0.15, 0.1, 25); }, steps: [0, 3, 6, 8, 11, 14], acc: [3, 11] }
  };
  /** Colpi di percussione per la base: [{bar, step, buf, track:'hat'}] nelle sezioni indicate. */
  function percEvents(type, sections, sr, sectionsOn) {
    var P = PERC[type]; if (!P) return []; var hitA = P.hit(sr, true), hitN = P.hit(sr, false), out = [];
    sections.forEach(function (s) { if (sectionsOn.indexOf(s.name) < 0) return; for (var b = 0; b < s.bars; b++) P.steps.forEach(function (st) { var a = P.acc.indexOf(st) >= 0; out.push({ bar: s.startBar + b, step: st, buf: a ? hitA : hitN, track: 'hat', gain: a ? 0.5 : 0.35 }); }); });
    return out;
  }
  // ---------- strumento dalla voce (vocal chop): un pezzo di voce intonato diventa suonabile su ogni nota ----------
  function voiceInstrument(seg, sr, rootMidi) {
    return function (midi, dur, sro) {
      var ratio = Math.pow(2, (midi - rootMidi) / 12) * sr / sro, n = Math.round(dur * sro), y = new Float32Array(n), L = seg.length, xf = Math.round(0.03 * sr);
      for (var i = 0; i < n; i++) { var pos = i * ratio; if (pos >= L - 1) { var span = L - 2 * xf; pos = xf + ((pos - xf) % span); } var k = Math.floor(pos), f = pos - k; y[i] = seg[k] * (1 - f) + seg[Math.min(L - 1, k + 1)] * f; }
      var fo = Math.min(n, Math.round(0.04 * sro)), fi = Math.min(n, Math.round(0.005 * sro)); for (i = 0; i < fi; i++) y[i] *= i / fi; for (i = 0; i < fo; i++) y[n - 1 - i] *= i / fo;
      return y;
    };
  }
  return { B808_PRESETS: B808_PRESETS, PERC: PERC, percEvents: percEvents, voiceInstrument: voiceInstrument, TABLES: TABLES, SYNTH_DEF: SYNTH_DEF, SYNTH_PRESETS: SYNTH_PRESETS, synthParams: synthParams, synth: synth, B808_DEF: B808_DEF, b808Params: b808Params, b808: b808, FX: FX, riser: riser, impact: impact, reverseCrash: reverseCrash, downlifter: downlifter };
});
