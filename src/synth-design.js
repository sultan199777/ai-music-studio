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
  // ---------- FM (come i synth digitali anni 80 usati per bell e piano elettrico) ----------
  function fm(o, midi, dur, sr) {
    var f = mtof(midi), rel = o.release || 0.4, n = Math.round((dur + rel) * sr), y = new Float32Array(n), pc = 0, pm = 0, on = dur * sr;
    for (var i = 0; i < n; i++) {
      var t = i / sr, env = Math.exp(-t / (o.decay || 1)) * Math.min(1, i / Math.max(1, (o.attack || 0.002) * sr)); if (i > on) env *= Math.exp(-(i - on) / (rel * sr / 4));
      var idx = (o.index || 3) * Math.exp(-t / (o.idxDecay || 0.3)) + (o.indexSus || 0.3);
      pm += 2 * Math.PI * f * (o.ratio || 2) / sr; pc += 2 * Math.PI * f / sr;
      var v = Math.sin(pc + idx * Math.sin(pm));
      if (o.ratio2) v += 0.25 * Math.exp(-t / 0.04) * Math.sin(pc * o.ratio2); // "tine": colpo metallico breve all'attacco
      y[i] = v * env * 0.45;
    }
    return y;
  }
  // ---------- banca SYNTH PRO: strumenti pronti da produzione (usabili come gli strumenti campionati) ----------
  var PRO = [
    { id: 'pro:bell', nome: 'Campana FM (trap)', ruoli: ['melodia', 'arpeggio'], tipo: 'percussivo', range: [55, 96], fn: function (m, d, sr) { return fm({ ratio: 3.5, index: 4, idxDecay: 0.4, indexSus: 0.2, decay: 1.4, release: 0.8 }, m, d, sr); }, come: 'Campana digitale cristallina: la melodia tipica della trap scura.' },
    { id: 'pro:epfm', nome: 'Piano elettrico FM', ruoli: ['accordi', 'melodia'], tipo: 'percussivo', range: [40, 90], fn: function (m, d, sr) { return fm({ ratio: 1, ratio2: 14, index: 1.8, idxDecay: 0.25, indexSus: 0.15, decay: 1.6, release: 0.5 }, m, d, sr); }, come: 'Piano elettrico morbido e lucido: accordi R&B e rap melodico.' },
    { id: 'pro:pluck', nome: 'Pluck lucido', ruoli: ['melodia', 'arpeggio', 'accordi'], tipo: 'percussivo', range: [48, 96], fn: function (m, d, sr) { return synth(SYNTH_PRESETS['Pluck lucido'], m, d, sr); }, come: 'Colpo corto e brillante: perfetto per arpeggi e giri trap.' },
    { id: 'pro:supersaw', nome: 'Supersaw trap', ruoli: ['accordi', 'pad', 'melodia'], tipo: 'sostenuto', range: [40, 90], fn: function (m, d, sr) { return synth(SYNTH_PRESETS['Supersaw trap'], m, d, sr); }, come: 'Muro di seghe stonate: accordi larghi da ritornello.' },
    { id: 'pro:pad', nome: 'Pad largo', ruoli: ['pad', 'accordi'], tipo: 'sostenuto', range: [36, 90], fn: function (m, d, sr) { return synth(SYNTH_PRESETS['Pad largo'], m, d, sr); }, come: 'Tappeto morbido che si muove: atmosfera sotto la voce.' },
    { id: 'pro:darkpad', nome: 'Pad scuro', ruoli: ['pad'], tipo: 'sostenuto', range: [36, 84], fn: function (m, d, sr) { return synth({ pos: 0.3, voices: 5, detune: 16, cutoff: 0.28, res: 0.3, envAmt: 0.1, attack: 0.8, decay: 1.5, sustain: 0.9, release: 1.5, lfo: 0.3, lfoHz: 0.15 }, m, d, sr); }, come: 'Pad cupo e filtrato: tensione per drill e trap scura.' },
    { id: 'pro:choir', nome: 'Coro synth', ruoli: ['pad', 'melodia'], tipo: 'sostenuto', range: [48, 84], fn: function (m, d, sr) { return synth({ pos: 1, voices: 5, detune: 14, cutoff: 0.55, res: 0.25, envAmt: 0.1, attack: 0.35, decay: 1, sustain: 0.85, release: 0.9, lfo: 0.25, lfoHz: 4.5 }, m, d, sr); }, come: 'Voci sintetiche "aaa": drammatico, cinematico.' },
    { id: 'pro:lead', nome: 'Lead vocale', ruoli: ['melodia'], tipo: 'sostenuto', range: [55, 90], fn: function (m, d, sr) { return synth(SYNTH_PRESETS['Lead vocale'], m, d, sr); }, come: 'Melodia che canta, con vibrato: ganci memorabili.' },
    { id: 'pro:keys', nome: 'Keys morbide', ruoli: ['accordi', 'melodia'], tipo: 'percussivo', range: [40, 90], fn: function (m, d, sr) { return fm({ ratio: 1, index: 0.9, idxDecay: 0.6, indexSus: 0.05, decay: 1.8, release: 0.6 }, m, d, sr); }, come: 'Tasti caldi e rotondi: accompagnamento discreto.' },
    { id: 'pro:stab', nome: 'Stab ottoni synth', ruoli: ['accordi'], tipo: 'percussivo', range: [45, 84], fn: function (m, d, sr) { return synth({ pos: 0.36, voices: 4, detune: 10, cutoff: 0.32, res: 0.2, envAmt: 0.75, attack: 0.01, decay: 0.22, sustain: 0.25, release: 0.15 }, m, Math.min(d, 0.4), sr); }, come: 'Colpo d\'ottoni sintetico: accenti aggressivi (street, drill).' },
    { id: 'pro:glassbell', nome: 'Vetro digitale', ruoli: ['melodia', 'arpeggio'], tipo: 'percussivo', range: [60, 100], fn: function (m, d, sr) { return fm({ ratio: 7, index: 2.5, idxDecay: 0.15, indexSus: 0.1, decay: 0.9, release: 0.6 }, m, d, sr); }, come: 'Note di vetro altissime: luccichio sopra il ritornello.' },
    { id: 'pro:mallet', nome: 'Mallet FM', ruoli: ['melodia', 'arpeggio'], tipo: 'percussivo', range: [48, 92], fn: function (m, d, sr) { return fm({ ratio: 4, index: 2, idxDecay: 0.05, indexSus: 0, decay: 0.45, release: 0.2 }, m, d, sr); }, come: 'Colpo di legno sintetico: ritmi club e afro.' },
    { id: 'pro:bell2', nome: 'Campana scura FM', ruoli: ['melodia', 'arpeggio'], tipo: 'percussivo', range: [48, 90], fn: function (m, d, sr) { return fm({ ratio: 2.76, index: 3, idxDecay: 0.5, indexSus: 0.15, decay: 1.8, release: 1 }, m, d, sr); }, come: 'Campana più grave e misteriosa: trap notturna.' },
    { id: 'pro:musicbox', nome: 'Carillon', ruoli: ['melodia', 'arpeggio'], tipo: 'percussivo', range: [64, 100], fn: function (m, d, sr) { return fm({ ratio: 5, index: 1.6, idxDecay: 0.08, indexSus: 0.05, decay: 0.9, release: 0.5 }, m, d, sr); }, come: 'Carillon fragile: intro malinconiche e trap emo.' },
    { id: 'pro:celesta', nome: 'Celesta digitale', ruoli: ['melodia', 'arpeggio'], tipo: 'percussivo', range: [60, 96], fn: function (m, d, sr) { return fm({ ratio: 4, index: 1.2, idxDecay: 0.2, indexSus: 0.1, decay: 1.2, release: 0.6 }, m, d, sr); }, come: 'Note dolci e luminose sopra il piano.' },
    { id: 'pro:sinelead', nome: 'Lead sinusoide', ruoli: ['melodia'], tipo: 'sostenuto', range: [55, 90], fn: function (m, d, sr) { return synth({ pos: 0, voices: 1, cutoff: 0.9, envAmt: 0, attack: 0.02, decay: 0.3, sustain: 0.85, release: 0.3, lfo: 0, lfoHz: 5 }, m, d, sr); }, come: 'Fischio puro e pulito: ganci plugg e cloud.' },
    { id: 'pro:sawlead', nome: 'Lead sega', ruoli: ['melodia'], tipo: 'sostenuto', range: [55, 90], fn: function (m, d, sr) { return synth({ pos: 0.33, voices: 3, detune: 12, cutoff: 0.5, res: 0.35, envAmt: 0.4, attack: 0.005, decay: 0.3, sustain: 0.6, release: 0.25 }, m, d, sr); }, come: 'Lead aggressivo e tagliente: rage e trap dura.' },
    { id: 'pro:squarelead', nome: 'Lead quadra 8-bit', ruoli: ['melodia', 'arpeggio'], tipo: 'sostenuto', range: [55, 92], fn: function (m, d, sr) { return synth({ pos: 0.66, voices: 1, cutoff: 0.6, envAmt: 0.2, attack: 0.002, decay: 0.2, sustain: 0.7, release: 0.1 }, m, d, sr); }, come: 'Suono da videogioco: digicore e plugg.' },
    { id: 'pro:dreamkeys', nome: 'Keys sognanti', ruoli: ['accordi', 'pad'], tipo: 'sostenuto', range: [40, 88], fn: function (m, d, sr) { return synth({ pos: 0.2, voices: 5, detune: 14, cutoff: 0.4, envAmt: 0.25, attack: 0.08, decay: 1.2, sustain: 0.6, release: 1, lfo: 0.2, lfoHz: 0.3 }, m, d, sr); }, come: 'Accordi morbidi che ondeggiano: trap melodica.' },
    { id: 'pro:arpsaw', nome: 'Arpeggio sega corto', ruoli: ['arpeggio', 'melodia'], tipo: 'percussivo', range: [48, 92], fn: function (m, d, sr) { return synth({ pos: 0.35, voices: 2, detune: 8, cutoff: 0.3, res: 0.45, envAmt: 0.8, attack: 0.001, decay: 0.12, sustain: 0.05, release: 0.1 }, m, Math.min(d, 0.25), sr); }, come: 'Note velocissime e secche: arpeggi trap.' },
    { id: 'pro:vox', nome: 'Vocal chop (ah)', ruoli: ['melodia', 'arpeggio'], tipo: 'sostenuto', range: [55, 84], fn: function (m, d, sr) { return synth({ pos: 1, voices: 3, detune: 8, cutoff: 0.6, res: 0.3, envAmt: 0.15, attack: 0.01, decay: 0.15, sustain: 0.6, release: 0.12, lfo: 0.15, lfoHz: 5.5 }, m, Math.min(d, 0.35), sr); }, come: 'Voce sintetica tagliata a tempo: ganci da ritornello.' },
    { id: 'pro:drillpiano', nome: 'Piano scuro drill', ruoli: ['melodia', 'accordi'], tipo: 'percussivo', range: [40, 84], fn: function (m, d, sr) { return fm({ ratio: 1, ratio2: 3, index: 0.7, idxDecay: 0.3, indexSus: 0.05, decay: 1.4, release: 0.5 }, m, d, sr); }, come: 'Piano cupo e freddo: drill UK e milanese.' },
    { id: 'pro:drillstr', nome: 'Archi drill', ruoli: ['pad', 'melodia'], tipo: 'sostenuto', range: [45, 88], fn: function (m, d, sr) { return synth({ pos: 0.36, voices: 6, detune: 18, cutoff: 0.38, res: 0.15, envAmt: 0.1, attack: 0.15, decay: 1, sustain: 0.85, release: 0.6, lfo: 0.15, lfoHz: 5 }, m, d, sr); }, come: 'Archi tesi e scuri: tensione sotto la strofa.' },
    { id: 'pro:darkchoir', nome: 'Coro scuro', ruoli: ['pad'], tipo: 'sostenuto', range: [45, 80], fn: function (m, d, sr) { return synth({ pos: 0.9, voices: 6, detune: 18, cutoff: 0.3, res: 0.3, envAmt: 0.05, attack: 0.6, decay: 1.5, sustain: 0.9, release: 1.4, lfo: 0.2, lfoHz: 4 }, m, d, sr); }, come: 'Coro lontano e cupo: drill di Brooklyn.' },
    { id: 'pro:slidepluck', nome: 'Pluck drill', ruoli: ['melodia', 'arpeggio'], tipo: 'percussivo', range: [48, 90], fn: function (m, d, sr) { return synth({ pos: 0.25, voices: 2, detune: 6, cutoff: 0.28, res: 0.3, envAmt: 0.6, attack: 0.002, decay: 0.3, sustain: 0.1, release: 0.25 }, m, d, sr); }, come: 'Colpo scuro e morbido: melodie drill.' },
    { id: 'pro:horror', nome: 'Pad horror', ruoli: ['pad'], tipo: 'sostenuto', range: [36, 80], fn: function (m, d, sr) { return synth({ pos: 0.5, voices: 7, detune: 40, cutoff: 0.25, res: 0.5, envAmt: 0.1, attack: 1.2, decay: 2, sustain: 0.9, release: 2, lfo: 0.5, lfoHz: 0.12 }, m, d, sr); }, come: 'Tappeto stonato e inquietante: drill e phonk.' },
    { id: 'pro:houseorgan', nome: 'Organo house', ruoli: ['accordi'], tipo: 'percussivo', range: [45, 84], fn: function (m, d, sr) { return fm({ ratio: 2, index: 1.4, idxDecay: 0.08, indexSus: 0.4, decay: 0.35, release: 0.15 }, m, Math.min(d, 0.4), sr); }, come: 'Colpi d\'organo anni 90: house e jersey.' },
    { id: 'pro:deepchord', nome: 'Accordo deep', ruoli: ['accordi'], tipo: 'percussivo', range: [45, 80], fn: function (m, d, sr) { return synth({ pos: 0.34, voices: 4, detune: 10, cutoff: 0.22, res: 0.25, envAmt: 0.45, attack: 0.003, decay: 0.6, sustain: 0.2, release: 0.6, lfo: 0 }, m, d, sr); }, come: 'Accordo filtrato con coda: deep house scura.' },
    { id: 'pro:acid', nome: 'Acid 303', ruoli: ['melodia', 'arpeggio'], tipo: 'percussivo', range: [36, 72], fn: function (m, d, sr) { return synth({ pos: 0.34, voices: 1, cutoff: 0.18, res: 0.85, envAmt: 0.9, attack: 0.001, decay: 0.18, sustain: 0.2, release: 0.1 }, m, Math.min(d, 0.3), sr); }, come: 'Linea acida che fischia: house dark e techno.' },
    { id: 'pro:reese', nome: 'Reese', ruoli: ['accordi', 'pad'], tipo: 'sostenuto', range: [28, 60], fn: function (m, d, sr) { return synth({ pos: 0.33, voices: 4, detune: 30, cutoff: 0.25, res: 0.2, envAmt: 0.1, attack: 0.01, decay: 0.5, sustain: 0.9, release: 0.3, lfo: 0.3, lfoHz: 0.5 }, m, d, sr); }, come: 'Basso largo che si muove: dark house, drum and bass.' },
    { id: 'pro:housepluck', nome: 'Pluck house', ruoli: ['arpeggio', 'melodia'], tipo: 'percussivo', range: [55, 92], fn: function (m, d, sr) { return synth({ pos: 0.45, voices: 3, detune: 9, cutoff: 0.42, envAmt: 0.6, attack: 0.001, decay: 0.15, sustain: 0.05, release: 0.15 }, m, Math.min(d, 0.3), sr); }, come: 'Pluck rimbalzante: ritmi club.' },
    { id: 'pro:stabdark', nome: 'Stab dark', ruoli: ['accordi'], tipo: 'percussivo', range: [45, 80], fn: function (m, d, sr) { return synth({ pos: 0.3, voices: 5, detune: 16, cutoff: 0.2, res: 0.35, envAmt: 0.7, attack: 0.001, decay: 0.25, sustain: 0.1, release: 0.3 }, m, Math.min(d, 0.4), sr); }, come: 'Colpo cupo e corto: house scura, club trap.' },
    { id: 'pro:brassfm', nome: 'Ottoni FM', ruoli: ['accordi', 'melodia'], tipo: 'sostenuto', range: [45, 82], fn: function (m, d, sr) { return fm({ ratio: 1, index: 2.5, idxDecay: 0.6, indexSus: 1.2, decay: 3, release: 0.3, attack: 0.04 }, m, d, sr); }, come: 'Fiati potenti: trap epica, intro da film.' },
    { id: 'pro:ghost', nome: 'Pad fantasma', ruoli: ['pad'], tipo: 'sostenuto', range: [48, 90], fn: function (m, d, sr) { return synth({ pos: 0.05, voices: 4, detune: 12, cutoff: 0.6, envAmt: 0, attack: 1.5, decay: 2, sustain: 1, release: 2, lfo: 0.6, lfoHz: 0.2 }, m, d, sr); }, come: 'Tappeto leggerissimo: cloud rap e emo.' },
    { id: 'pro:marimbafm', nome: 'Marimba FM', ruoli: ['melodia', 'arpeggio'], tipo: 'percussivo', range: [48, 90], fn: function (m, d, sr) { return fm({ ratio: 3.9, index: 1.3, idxDecay: 0.04, indexSus: 0, decay: 0.5, release: 0.2 }, m, d, sr); }, come: 'Legno caldo: afro, reggaeton, estate.' },
    { id: 'pro:steel', nome: 'Steel drum', ruoli: ['melodia', 'arpeggio'], tipo: 'percussivo', range: [55, 90], fn: function (m, d, sr) { return fm({ ratio: 2.4, index: 1.8, idxDecay: 0.15, indexSus: 0.1, decay: 0.8, release: 0.3 }, m, d, sr); }, come: 'Tamburo d\'acciaio: estate e afrobeats.' },
    { id: 'pro:guitarfm', nome: 'Chitarra pizzicata FM', ruoli: ['accordi', 'arpeggio', 'melodia'], tipo: 'percussivo', range: [40, 84], fn: function (m, d, sr) { return fm({ ratio: 1, ratio2: 2, index: 1.6, idxDecay: 0.05, indexSus: 0.1, decay: 0.9, release: 0.3 }, m, d, sr); }, come: 'Corda pizzicata sintetica: latin, afro, R&B.' },
    { id: 'pro:padwarm', nome: 'Pad caldo anni 80', ruoli: ['pad', 'accordi'], tipo: 'sostenuto', range: [40, 84], fn: function (m, d, sr) { return synth({ pos: 0.4, voices: 6, detune: 15, cutoff: 0.5, res: 0.2, envAmt: 0.15, attack: 0.3, decay: 1.2, sustain: 0.85, release: 1, lfo: 0.15, lfoHz: 0.4 }, m, d, sr); }, come: 'Tappeto da synth anni 80: stile The Weeknd.' },
    { id: 'pro:sweep', nome: 'Pad che si apre', ruoli: ['pad'], tipo: 'sostenuto', range: [36, 84], fn: function (m, d, sr) { return synth({ pos: 0.5, voices: 6, detune: 20, cutoff: 0.12, res: 0.5, envAmt: 0.6, attack: 2, decay: 2.5, sustain: 0.6, release: 1.5, lfo: 0.2, lfoHz: 0.1 }, m, d, sr); }, come: 'Il filtro si apre piano: pre-ritornello.' },
    { id: 'pro:bell3', nome: 'Campana lucida', ruoli: ["melodia", "arpeggio"], tipo: 'percussivo', range: [60, 96], fn: function (m, d, sr) { return fm({ ratio: 6.1, index: 2, idxDecay: 0.3, indexSus: 0.1, decay: 1.5, release: 0.8 }, m, d, sr); }, come: 'Campana alta e brillante: trap melodica, ritornelli.' },
    { id: 'pro:tinekeys', nome: 'Rhodes lontano', ruoli: ["accordi"], tipo: 'percussivo', range: [40, 86], fn: function (m, d, sr) { return fm({ ratio: 1, ratio2: 7, index: 1.1, idxDecay: 0.4, indexSus: 0.1, decay: 2, release: 0.8 }, m, d, sr); }, come: 'Piano elettrico morbido e lontano: lo-fi e R&B.' },
    { id: 'pro:organpad', nome: 'Organo morbido', ruoli: ["pad", "accordi"], tipo: 'sostenuto', range: [40, 84], fn: function (m, d, sr) { return fm({ ratio: 2, index: 0.8, idxDecay: 2, indexSus: 0.6, decay: 4, release: 0.6, attack: 0.05 }, m, d, sr); }, come: 'Tappeto d\'organo caldo: gospel e soul.' },
    { id: 'pro:sublead', nome: 'Lead basso profondo', ruoli: ["melodia"], tipo: 'sostenuto', range: [36, 70], fn: function (m, d, sr) { return synth({ pos: 0.1, voices: 2, detune: 5, cutoff: 0.35, envAmt: 0.2, attack: 0.01, decay: 0.4, sustain: 0.8, release: 0.3 }, m, d, sr); }, come: 'Melodia grave e rotonda: phonk e trap scura.' },
    { id: 'pro:choirhi', nome: 'Coro angelico', ruoli: ["pad", "melodia"], tipo: 'sostenuto', range: [60, 90], fn: function (m, d, sr) { return synth({ pos: 1, voices: 7, detune: 10, cutoff: 0.7, res: 0.2, envAmt: 0.05, attack: 0.5, decay: 1, sustain: 0.9, release: 1.2, lfo: 0.2, lfoHz: 5 }, m, d, sr); }, come: 'Voci alte e celesti: emo rap e ritornelli epici.' },
    { id: 'pro:pizzsyn', nome: 'Pizzicato synth', ruoli: ["arpeggio", "melodia"], tipo: 'percussivo', range: [55, 92], fn: function (m, d, sr) { return synth({ pos: 0.6, voices: 2, detune: 6, cutoff: 0.4, envAmt: 0.5, attack: 0.001, decay: 0.09, sustain: 0, release: 0.12 }, m, Math.min(d, 0.22), sr); }, come: 'Colpetto corto: arpeggi drill veloci.' },
    { id: 'pro:trance', nome: 'Supersaw arioso', ruoli: ["accordi", "pad"], tipo: 'sostenuto', range: [45, 88], fn: function (m, d, sr) { return synth({ pos: 0.33, voices: 7, detune: 35, cutoff: 0.65, envAmt: 0.2, attack: 0.02, decay: 0.8, sustain: 0.8, release: 0.6 }, m, d, sr); }, come: 'Accordi enormi e luminosi: rage e club.' },
    { id: 'pro:phonkbell', nome: 'Campanaccio phonk', ruoli: ["melodia"], tipo: 'percussivo', range: [60, 90], fn: function (m, d, sr) { return fm({ ratio: 1.48, index: 3, idxDecay: 0.08, indexSus: 0.2, decay: 0.5, release: 0.2 }, m, d, sr); }, come: 'Cowbell intonato: la firma del phonk.' },
    { id: 'pro:lofikeys', nome: 'Keys lo-fi', ruoli: ["accordi", "melodia"], tipo: 'percussivo', range: [40, 86], fn: function (m, d, sr) { return fm({ ratio: 1, index: 0.5, idxDecay: 0.8, indexSus: 0.05, decay: 1.6, release: 0.5 }, m, d, sr); }, come: 'Tasti caldi e un po\' spenti: lo-fi e boom bap.' },
    { id: 'pro:wobble', nome: 'Pad che pulsa', ruoli: ["pad"], tipo: 'sostenuto', range: [40, 80], fn: function (m, d, sr) { return synth({ pos: 0.4, voices: 5, detune: 14, cutoff: 0.3, res: 0.4, envAmt: 0.1, attack: 0.1, decay: 1, sustain: 0.9, release: 0.6, lfo: 0.8, lfoHz: 2 }, m, d, sr); }, come: 'Tappeto che respira a tempo: club e house.' },
    { id: 'pro:nightlead', nome: 'Lead notturno', ruoli: ["melodia"], tipo: 'sostenuto', range: [55, 90], fn: function (m, d, sr) { return synth({ pos: 0.8, voices: 3, detune: 7, cutoff: 0.45, res: 0.3, envAmt: 0.2, attack: 0.04, decay: 0.5, sustain: 0.7, release: 0.5, lfo: 0.25, lfoHz: 4.5 }, m, d, sr); }, come: 'Melodia morbida con vibrato: trap notturna.' },
    { id: 'pro:glitch', nome: 'Pluck digitale', ruoli: ["arpeggio"], tipo: 'percussivo', range: [60, 96], fn: function (m, d, sr) { return fm({ ratio: 11, index: 3, idxDecay: 0.03, indexSus: 0, decay: 0.25, release: 0.1 }, m, d, sr); }, come: 'Colpi digitali strani: digicore e hyperpop.' }
  ];
  // ---------- KIT di batteria (sintetizzati, caratteri diversi) ----------
  var KITS = {
    trap: { nome: 'Trap pesante', kick: { f0: 160, f1: 46, sweep: 38, decay: 0.32, click: 0.35, drive: 1.6 }, snare: { tone: 200, toneAmt: 0.35, noise: 0.7, decay: 0.16, bp: 2200 }, clap: { spread: 0.012, decay: 0.2, bp: 1400 }, hat: { decay: 0.045, hp: 7000 } },
    drill: { nome: 'Drill', kick: { f0: 140, f1: 50, sweep: 55, decay: 0.22, click: 0.5, drive: 2 }, snare: { tone: 330, toneAmt: 0.5, noise: 0.55, decay: 0.11, bp: 3000 }, clap: { spread: 0.009, decay: 0.14, bp: 1800 }, hat: { decay: 0.035, hp: 8000 } },
    boombap: { nome: 'Boom bap polveroso', kick: { f0: 120, f1: 52, sweep: 30, decay: 0.28, click: 0.2, drive: 1.3, lp: 2500 }, snare: { tone: 180, toneAmt: 0.45, noise: 0.6, decay: 0.2, bp: 1600, lp: 5000 }, clap: { spread: 0.014, decay: 0.18, bp: 1200, lp: 4000 }, hat: { decay: 0.06, hp: 5000, lp: 9000 } },
    club: { nome: 'Club duro', kick: { f0: 200, f1: 48, sweep: 50, decay: 0.26, click: 0.6, drive: 2.4 }, snare: { tone: 240, toneAmt: 0.3, noise: 0.8, decay: 0.13, bp: 2600 }, clap: { spread: 0.01, decay: 0.22, bp: 1600 }, hat: { decay: 0.03, hp: 9000 } },
    lofi: { nome: 'Lo-fi morbido', kick: { f0: 100, f1: 50, sweep: 25, decay: 0.3, click: 0.05, drive: 1.1, lp: 1500 }, snare: { tone: 170, toneAmt: 0.5, noise: 0.4, decay: 0.18, bp: 1200, lp: 3500 }, clap: { spread: 0.016, decay: 0.16, bp: 1000, lp: 3000 }, hat: { decay: 0.05, hp: 4000, lp: 7000 } }
  };
  function lp1(y, sr, f) { if (!f) return y; var a = 1 - Math.exp(-2 * Math.PI * f / sr), z = 0; for (var i = 0; i < y.length; i++) { z += a * (y[i] - z); y[i] = z; } return y; }
  function hp1(y, sr, f) { var a = Math.exp(-2 * Math.PI * f / sr), px = 0, py = 0; for (var i = 0; i < y.length; i++) { var v = a * (py + y[i] - px); px = y[i]; py = v; y[i] = v; } return y; }
  function kitRender(kitId, part, o, sr) {
    var K = KITS[kitId] || KITS.trap, r = noise(31 + part.length), i, n, y;
    if (part === 'kick') { var k = K.kick, ph = 0; n = Math.round(((o && o.big) ? k.decay * 1.6 : k.decay) * sr * 1.6); y = new Float32Array(n);
      for (i = 0; i < n; i++) { var t = i / sr; ph += 2 * Math.PI * (k.f1 + (k.f0 - k.f1) * Math.exp(-t * k.sweep)) / sr; y[i] = Math.tanh(k.drive * (Math.sin(ph) * Math.exp(-t / k.decay) + k.click * r() * Math.exp(-t * 400))) / Math.tanh(k.drive) * Math.min(1, i / 20); }
      return lp1(y, sr, k.lp); }
    if (part === 'snare') { var s = K.snare; n = Math.round(s.decay * 3 * sr); y = new Float32Array(n); var bp = 0, lpz = 0, a = 1 - Math.exp(-2 * Math.PI * s.bp / sr);
      for (i = 0; i < n; i++) { var t2 = i / sr, x = r(); lpz += a * (x - lpz); bp = x - lpz * 0.6; y[i] = (s.noise * bp * Math.exp(-t2 / s.decay) + s.toneAmt * Math.sin(2 * Math.PI * s.tone * t2) * Math.exp(-t2 / (s.decay * 0.5))) * 0.7; }
      return lp1(y, sr, s.lp); }
    if (part === 'clap') { var c = K.clap; n = Math.round((c.decay * 2.5 + c.spread * 3) * sr); y = new Float32Array(n); var offs = [0, c.spread, c.spread * 2, c.spread * 3];
      for (i = 0; i < n; i++) { var t3 = i / sr, v = 0; for (var q = 0; q < 4; q++) if (t3 >= offs[q]) v += Math.exp(-(t3 - offs[q]) * (q === 3 ? 1 / c.decay : 90)); y[i] = r() * v * 0.3; }
      return lp1(hp1(y, sr, c.bp * 0.5), sr, c.lp || c.bp * 3); }
    if (part === 'hat') { var h = K.hat, open = o && o.open; n = Math.round((open ? h.decay * 5 : h.decay) * sr * 1.5); y = new Float32Array(n);
      for (i = 0; i < n; i++) y[i] = r() * Math.exp(-(i / sr) / (open ? h.decay * 4 : h.decay * 0.6)) * 0.5;
      return lp1(hp1(y, sr, h.hp), sr, h.lp); }
    return new Float32Array(1);
  }
  // ---------- percussioni del mondo ----------
  return { fm: fm, PRO: PRO, KITS: KITS, kitRender: kitRender, B808_PRESETS: B808_PRESETS, PERC: PERC, percEvents: percEvents, voiceInstrument: voiceInstrument, TABLES: TABLES, SYNTH_DEF: SYNTH_DEF, SYNTH_PRESETS: SYNTH_PRESETS, synthParams: synthParams, synth: synth, B808_DEF: B808_DEF, b808Params: b808Params, b808: b808, FX: FX, riser: riser, impact: impact, reverseCrash: reverseCrash, downlifter: downlifter };
});
