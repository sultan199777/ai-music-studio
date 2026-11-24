/*
 * Catena vocale modulare (Voice Lab, tappa 2). Codice PURO (nessun DOM, nessun Web Audio): gira in Node e nel browser,
 * quindi si può misurare con test numerici. Lavora su una registrazione già fatta (qualità massima, non tempo reale).
 *
 * Ordine delle fasi (ricerca B, punto 3; le due fonti citate NON concordano sul posto dell'autotune: qui la correzione
 * dell'intonazione sta DOPO la pulizia e PRIMA di EQ/compressore, come raccomandato nella ricerca):
 *   pulizia (taglio bassi + riduzione rumore) -> intonazione (Autotune: velocità, humanize, flex, vibrato, formanti)
 *   -> EQ sottrattivo -> de-esser -> compressore (2 stadi) -> saturazione / distorsione -> EQ di colore -> filtro creativo
 *   -> armonie (copie nella scala, formanti mantenuti, ritardo casuale 10-30 ms) -> doppie voci (ADT) -> delay -> riverbero
 *   -> livello finale + limitatore sul picco.
 *
 * I VALORI DI PARTENZA vengono dalla ricerca B: compressore 4:1 soglia ~-20 dB, de-esser ~6-7 kHz, taglio sotto ~100 Hz,
 * presenza 2-7 kHz, aria da ~10 kHz, ADT 13-25 ms, armonie 10-30 ms [fonti: Sound On Sound, iZotope, Craig Anderton].
 * I valori dei "caratteri vocali" NON hanno una fonte con numeri: sono PUNTI DI PARTENZA NON VERIFICATI, da regolare con
 * l'orecchio. Qui si misurano solo picchi, spettro, livelli e intonazione: il suono lo giudica chi ascolta.
 *
 * Limiti: l'uscita è MONO (niente allargamento stereo); riverbero e delay sono semplici (comb/allpass, linee di ritardo);
 * il de-esser lavora su una banda sola; la saturazione usa un sovracampionamento x2 molto semplice.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./autotune.js'), require('./polish.js'));
  else root.VoiceChain = factory(root.Autotune, root.Polish);
})(typeof self !== 'undefined' ? self : this, function (Autotune, Polish) {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function db2lin(d) { return Math.pow(10, d / 20); }
  function lin2db(v) { return 20 * Math.log(Math.max(v, 1e-9)) / Math.LN10; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ====================== filtri (biquad RBJ) ====================== */
  function coef(type, fc, sr, Q, gainDb) {
    fc = clamp(fc, 10, sr * 0.45);
    var w0 = 2 * Math.PI * fc / sr, cs = Math.cos(w0), sn = Math.sin(w0), q = Q || 0.7071, alpha = sn / (2 * q), A = Math.pow(10, (gainDb || 0) / 40);
    var b0, b1, b2, a0, a1, a2, sq;
    switch (type) {
      case 'lp': b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; break;
      case 'hp': b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; break;
      case 'bp': b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; break;
      case 'peak': b0 = 1 + alpha * A; b1 = -2 * cs; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cs; a2 = 1 - alpha / A; break;
      case 'ls': sq = 2 * Math.sqrt(A) * alpha;
        b0 = A * ((A + 1) - (A - 1) * cs + sq); b1 = 2 * A * ((A - 1) - (A + 1) * cs); b2 = A * ((A + 1) - (A - 1) * cs - sq);
        a0 = (A + 1) + (A - 1) * cs + sq; a1 = -2 * ((A - 1) + (A + 1) * cs); a2 = (A + 1) + (A - 1) * cs - sq; break;
      default: sq = 2 * Math.sqrt(A) * alpha; // hs
        b0 = A * ((A + 1) + (A - 1) * cs + sq); b1 = -2 * A * ((A - 1) + (A + 1) * cs); b2 = A * ((A + 1) + (A - 1) * cs - sq);
        a0 = (A + 1) - (A - 1) * cs + sq; a1 = 2 * ((A - 1) - (A + 1) * cs); a2 = (A + 1) - (A - 1) * cs - sq;
    }
    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
  }
  function bq(x, c) {
    var y = new Float32Array(x.length), x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (var i = 0; i < x.length; i++) {
      var v = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  }
  function filt(x, sr, type, fc, Q, gainDb) { return bq(x, coef(type, fc, sr, Q, gainDb)); }

  /* ====================== misure ====================== */
  function peakOf(x) { var p = 0; for (var i = 0; i < x.length; i++) { var a = x[i] < 0 ? -x[i] : x[i]; if (a > p) p = a; } return p; }
  function peakDb(x) { return lin2db(peakOf(x)); }
  /** Livello medio "da parlato": RMS sulle sole parti sopra una soglia (no silenzi). NON è LUFS (approssimazione). */
  function gatedRmsDb(x, sr) {
    var win = Math.max(64, Math.round(sr * 0.05)), n = Math.floor(x.length / win), e = [], i, j, mx = -200;
    for (i = 0; i < n; i++) { var s = 0; for (j = 0; j < win; j++) { var v = x[i * win + j]; s += v * v; } var d = 10 * Math.log(Math.max(s / win, 1e-14)) / Math.LN10; e.push(d); if (d > mx) mx = d; }
    var sum = 0, c = 0; e.forEach(function (d, k) { if (d > mx - 30 && d > -65) { sum += Math.pow(10, d / 10); c++; } });
    return c ? 10 * Math.log(sum / c) / Math.LN10 : -120;
  }
  /** Energia (dB) sopra una frequenza, relativa all'energia totale: serve a misurare sibilanti e luminosità. */
  function bandEnergyDb(x, sr, f1, f2) {
    var y = x; if (f1 > 0) { y = filt(y, sr, 'hp', f1); y = filt(y, sr, 'hp', f1); }
    if (f2 > 0) { y = filt(y, sr, 'lp', f2); y = filt(y, sr, 'lp', f2); }
    var s = 0; for (var i = 0; i < y.length; i++) s += y[i] * y[i];
    return 10 * Math.log(Math.max(s / Math.max(1, y.length), 1e-16)) / Math.LN10;
  }
  /** Guadagni (lineari) per ascoltare prima/dopo allo STESSO volume (gated RMS), senza mai superare lo 0,98 di picco. */
  function matchGains(a, b, sr) {
    var ra = gatedRmsDb(a, sr), rb = gatedRmsDb(b, sr), target = Math.min(ra, rb);
    var ga = db2lin(target - ra), gb = db2lin(target - rb);
    var pa = peakOf(a) * ga, pb = peakOf(b) * gb, top = Math.max(pa, pb);
    if (top > 0.98) { var k = 0.98 / top; ga *= k; gb *= k; }
    return { a: ga, b: gb, rmsDb: target };
  }

  /* ====================== pulizia ====================== */
  function stageClean(x, sr, p, rep) {
    var y = x;
    if (p.hp > 0) y = filt(filt(y, sr, 'hp', p.hp), sr, 'hp', p.hp); // 24 dB per ottava
    if (p.denoiseDb > 0.5) y = Polish.denoise(y, sr, { reduceDb: p.denoiseDb, marginDb: 8 });
    return y;
  }

  /* ====================== de-esser (banda unica, a rapporto) ====================== */
  function stageDeess(x, sr, p, rep) {
    // Il rilevatore misura quanto della forza del segnale sta sopra la frequenza scelta (il rapporto banda/totale è alto solo sulle "S").
    // Quando supera la soglia, un filtro "ripiano alto" che si muove nel tempo abbassa le alte frequenze (nessuna sottrazione di fase).
    var f = p.freq, det = filt(filt(x, sr, 'hp', f * 0.85, 0.8), sr, 'hp', f * 0.85, 0.8);
    var n = x.length, y = new Float32Array(n), maxRedDb = 0;
    var aE = Math.exp(-1 / (sr * 0.006)), eb = 1e-9, et = 1e-9, g = 1, ga = Math.exp(-1 / (sr * 0.0015)), gr = Math.exp(-1 / (sr * 0.05));
    var limitDb = 4 + 14 * clamp(p.amount, 0, 1), minG = db2lin(-limitDb), thr = p.ratioThreshold == null ? 0.42 : p.ratioThreshold;
    var blk = 16, c = coef('hs', f * 0.8, sr, 0.7, 0), x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (var i = 0; i < n; i++) {
      var b = det[i] * det[i], t = x[i] * x[i];
      eb = aE * eb + (1 - aE) * b; et = aE * et + (1 - aE) * t; // stessa media (6 ms) per banda e totale: il rapporto è stabile
      var idx = Math.sqrt(eb / (et + 1e-12)), want = 1;
      if (et > 1e-7 && idx > thr) want = Math.max(minG, Math.pow(thr / idx, 1.5));
      g = want < g ? ga * g + (1 - ga) * want : gr * g + (1 - gr) * want;
      if (i % blk === 0) { var rd = -lin2db(g); if (rd > maxRedDb) maxRedDb = rd; c = rd > 0.2 ? coef('hs', f * 0.8, sr, 0.7, -rd) : null; }
      if (c) {
        var v = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
      } else { x2 = x1; x1 = x[i]; y2 = y1; y1 = x[i]; y[i] = x[i]; }
    }
    rep.deessMaxReductionDb = maxRedDb;
    return y;
  }

  /* ====================== compressore (dB, ginocchio morbido) ====================== */
  function compressor(x, sr, o) {
    var thr = o.thresholdDb, ratio = Math.max(1, o.ratio), knee = o.kneeDb == null ? 6 : o.kneeDb;
    var aA = Math.exp(-1 / (sr * Math.max(0.2, o.attackMs) / 1000)), aR = Math.exp(-1 / (sr * Math.max(5, o.releaseMs) / 1000));
    var n = x.length, y = new Float32Array(n), red = 0, maxRed = 0, sumRed = 0, cnt = 0, lvl = 1e-6, relPk = Math.exp(-1 / (sr * 0.02));
    var gains = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var a = x[i] < 0 ? -x[i] : x[i];
      lvl = a > lvl ? a : lvl * relPk + a * (1 - relPk);
      var d = lin2db(lvl), over = d - thr, r;
      if (2 * over < -knee) r = 0;
      else if (2 * Math.abs(over) <= knee) r = (1 - 1 / ratio) * (over + knee / 2) * (over + knee / 2) / (2 * knee);
      else r = over * (1 - 1 / ratio);
      red = r > red ? aA * red + (1 - aA) * r : aR * red + (1 - aR) * r;
      gains[i] = -red; if (red > maxRed) maxRed = red;
      if (red > 0.1) { sumRed += red; cnt++; }
    }
    var make = o.makeupDb == null ? 0 : o.makeupDb;
    for (i = 0; i < n; i++) y[i] = x[i] * db2lin(gains[i] + make);
    return { y: y, maxReductionDb: maxRed, meanReductionDb: cnt ? sumRed / cnt : 0 };
  }
  function stageComp(x, sr, p, rep) {
    var c1 = compressor(x, sr, { thresholdDb: p.thresholdDb, ratio: p.ratio, attackMs: p.attackMs, releaseMs: p.releaseMs, kneeDb: 6, makeupDb: 0 });
    var y = c1.y, mx = c1.maxReductionDb;
    if (p.peakDb != null && p.peakDb < 0) { // secondo stadio 8:1 solo sui picchi
      var c2 = compressor(y, sr, { thresholdDb: p.peakDb, ratio: 8, attackMs: 1, releaseMs: 80, kneeDb: 3, makeupDb: 0 });
      y = c2.y; mx = Math.max(mx, c2.maxReductionDb);
    }
    // recupero del volume: riporta il livello "da parlato" a quello di prima, più il makeup scelto
    var before = gatedRmsDb(x, sr), after = gatedRmsDb(y, sr), mk = clamp(before - after + (p.makeupDb || 0), -6, 18), k = db2lin(mk);
    for (var i = 0; i < y.length; i++) y[i] *= k;
    rep.compMaxReductionDb = mx; rep.compMeanReductionDb = c1.meanReductionDb; rep.compMakeupDb = mk;
    return y;
  }

  /* ====================== saturazione e distorsione ====================== */
  function shaper(x, fn) { // sovracampionamento x2 semplice (interpolazione lineare + media) per ridurre l'aliasing
    var n = x.length, y = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var nx = i + 1 < n ? x[i + 1] : x[i], m = 0.5 * (x[i] + nx);
      y[i] = 0.5 * (fn(x[i]) + fn(m));
    }
    return y;
  }
  function stageSat(x, sr, p, rep) {
    var pk = Math.max(peakOf(x), 1e-4), k = 1 + 8 * clamp(p.drive, 0, 1), norm = Math.tanh(k), y = shaper(x, function (v) { return Math.tanh(k * v / pk) / norm * pk; });
    return mixDry(x, y, p.mix);
  }
  function stageDist(x, sr, p, rep) {
    var pk = Math.max(peakOf(x), 1e-4), k = 2 + 22 * clamp(p.amount, 0, 1), bias = 0.12 * clamp(p.amount, 0, 1), tb = Math.tanh(k * bias), norm = Math.tanh(k * (1 + bias)) - tb;
    var y = shaper(x, function (v) { return (Math.tanh(k * (v / pk + bias)) - tb) / norm * pk; });
    y = filt(filt(y, sr, 'lp', p.toneHz || 6000), sr, 'hp', 80);
    // compensa il volume
    var g = db2lin(gatedRmsDb(x, sr) - gatedRmsDb(y, sr)); for (var i = 0; i < y.length; i++) y[i] *= g;
    return mixDry(x, y, p.mix);
  }
  function mixDry(x, y, mix) {
    var m = clamp(mix, 0, 1), o = new Float32Array(x.length);
    for (var i = 0; i < x.length; i++) o[i] = x[i] * (1 - m) + y[i] * m;
    return o;
  }

  /* ====================== EQ ====================== */
  function stageEq1(x, sr, p) {
    var y = x;
    if (p.boxyDb) y = filt(y, sr, 'peak', 350, 0.9, p.boxyDb);      // contro il suono "scatolato" (ricerca B: 200 Hz-1,5 kHz)
    return y;
  }
  function stageEq2(x, sr, p) {
    var y = x;
    if (p.lowDb) y = filt(y, sr, 'ls', 160, 0.7, p.lowDb);
    if (p.presenceDb) y = filt(y, sr, 'peak', 3500, 0.9, p.presenceDb);
    if (p.airDb) y = filt(y, sr, 'hs', 10000, 0.7, p.airDb);
    if (p.darkHz > 0) y = filt(y, sr, 'lp', p.darkHz, 0.7);
    return y;
  }
  function stageFilter(x, sr, p) {
    if (p.type === 'telefono') return filt(filt(filt(x, sr, 'hp', 420), sr, 'lp', 3300), sr, 'peak', 1500, 1, 3);
    if (p.type === 'lowpass') return filt(filt(x, sr, 'lp', p.freq), sr, 'lp', p.freq);
    if (p.type === 'highpass') return filt(filt(x, sr, 'hp', p.freq), sr, 'hp', p.freq);
    if (p.type === 'band') return filt(filt(x, sr, 'hp', p.freq * 0.6), sr, 'lp', p.freq * 1.8);
    return x;
  }

  /* ====================== effetti spaziali ====================== */
  function rng(seed) { var s = (seed || 1) >>> 0; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function readFrac(buf, pos) { // lettura con interpolazione lineare
    var i = Math.floor(pos), f = pos - i;
    var a = i >= 0 && i < buf.length ? buf[i] : 0, b = i + 1 >= 0 && i + 1 < buf.length ? buf[i + 1] : 0;
    return a + (b - a) * f;
  }
  function stageDoubles(x, sr, p, rep) {
    var r = rng(p.seed || 7), out = Float32Array.from(x), n = Math.max(0, Math.min(4, Math.round(p.count)));
    for (var c = 0; c < n; c++) {
      var d0 = (p.delayMs || 19) * (0.75 + 0.5 * r()) + c * 2.2, rate = 0.25 + 0.55 * r(), ph = r() * 6.283, depth = (p.modMs == null ? 0.8 : p.modMs);
      var lp = filt(filt(x, sr, 'hp', 160), sr, 'lp', 9500), g = db2lin(p.gainDb - c * 1.2);
      for (var i = 0; i < x.length; i++) {
        var d = (d0 + depth * Math.sin(2 * Math.PI * rate * i / sr + ph)) * sr / 1000;
        out[i] += g * readFrac(lp, i - d);
      }
    }
    return out;
  }
  var HARM_DEGREES = [2, 4, -3, 7]; // terza sopra, quinta sopra, quarta sotto, ottava sopra (gradini di scala)
  function stageHarmony(x, sr, p, ctx, rep) {
    if (!ctx.scaleKnown) { rep.warnings.push('Armonie non applicate: la tonalità è incerta (scegli tu nota e scala).'); return x; }
    var r = rng(p.seed || 11), out = Float32Array.from(x), delays = [], v = Math.max(0, Math.min(HARM_DEGREES.length, Math.round(p.voices)));
    for (var c = 0; c < v; c++) {
      var h = Autotune.correct(x, sr, { tonic: ctx.tonic, mode: ctx.mode, strength: 1, retuneMs: 12, vibrato: 1, harmonyDegrees: HARM_DEGREES[c], track: ctx.track, maxSeconds: 600 });
      var dly = Math.round(sr * (10 + 20 * r()) / 1000), g = db2lin(p.gainDb - c * 1.5), hs = filt(filt(h.samples, sr, 'hp', 180), sr, 'lp', 9000);
      delays.push(dly * 1000 / sr);
      for (var i = 0; i + dly < out.length && i < hs.length; i++) out[i + dly] += g * hs[i];
    }
    rep.harmonyVoices = v; rep.harmonyDelaysMs = delays;
    return out;
  }
  function stageDelay(x, sr, p, ctx) {
    var tMs = p.sync && ctx.bpm ? (60000 / ctx.bpm) * 0.75 : p.timeMs, d = Math.max(1, Math.round(sr * tMs / 1000)), fb = clamp(p.feedback, 0, 0.85);
    var tail = Math.min(Math.round(sr * 2.5), d * 6), n = x.length + tail, y = new Float32Array(n), buf = new Float32Array(n);
    var hpA = Math.exp(-2 * Math.PI * 300 / sr), lpA = 1 - Math.exp(-2 * Math.PI * (p.lowPassHz || 4500) / sr), hpS = 0, lpS = 0, hpIn = 0;
    for (var i = 0; i < n; i++) {
      var xin = i < x.length ? x[i] : 0, del = i >= d ? buf[i - d] : 0;
      // filtri nel ciclo di feedback (passa-alto e passa-basso a un polo): le ripetizioni si scuriscono e non rimbombano
      lpS += lpA * (del - lpS); var hpOut = hpA * (hpS + lpS - hpIn); hpIn = lpS; hpS = hpOut;
      buf[i] = xin + hpOut * fb; y[i] = xin + hpOut * clamp(p.mix, 0, 1) * 1.6;
    }
    return y;
  }
  /** Riverbero tipo "Freeverb" (8 comb + 4 allpass, dominio pubblico) con tempo di decadimento RT60, pre-delay e filtri sul segnale riverberato. */
  function stageReverb(x, sr, p) {
    var scale = sr / 44100, combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], aps = [556, 441, 341, 225];
    var rt = clamp(p.decaySec, 0.2, 6), tail = Math.round(sr * Math.min(rt * 1.1, 5)), n = x.length + tail, wet = new Float32Array(n);
    var pre = Math.round(sr * (p.preDelayMs || 0) / 1000), damp = 0.35, ci, i;
    for (ci = 0; ci < combs.length; ci++) {
      var d = Math.max(8, Math.round(combs[ci] * scale)), buf = new Float32Array(d), pos = 0, lp = 0, fb = Math.pow(10, -3 * d / (rt * sr));
      for (i = 0; i < n; i++) {
        var inp = (i - pre >= 0 && i - pre < x.length) ? x[i - pre] : 0, o = buf[pos];
        lp = o * (1 - damp) + lp * damp; buf[pos] = inp * 0.015 + lp * fb; if (++pos >= d) pos = 0; wet[i] += o;
      }
    }
    for (ci = 0; ci < aps.length; ci++) {
      var da = Math.max(4, Math.round(aps[ci] * scale)), ab = new Float32Array(da), ap = 0;
      for (i = 0; i < n; i++) { var bo = ab[ap], iv = wet[i]; ab[ap] = iv + bo * 0.5; wet[i] = bo - iv; if (++ap >= da) ap = 0; }
    }
    var w = filt(filt(wet, sr, 'hp', p.lowCutHz || 250), sr, 'lp', p.highCutHz || 6000), y = new Float32Array(n), m = clamp(p.mix, 0, 1) * 4.5;
    for (i = 0; i < n; i++) y[i] = (i < x.length ? x[i] : 0) + w[i] * m;
    return y;
  }

  /* ====================== livello finale e limitatore ====================== */
  function limiter(x, sr, ceilLin) {
    var n = x.length, look = Math.max(1, Math.round(0.004 * sr)), rel = Math.exp(-1 / (sr * 0.06)), need = new Float32Array(n), lo = new Float32Array(n), y = new Float32Array(n), i;
    for (i = 0; i < n; i++) { var a = x[i] < 0 ? -x[i] : x[i]; need[i] = a > ceilLin ? ceilLin / a : 1; }
    var dq = new Int32Array(n + 1), head = 0, tail = 0; // coda a doppia estremità (minimo mobile)
    for (i = 0; i < n + look; i++) {
      if (i < n) { while (tail > head && need[dq[tail - 1]] >= need[i]) tail--; dq[tail++] = i; }
      while (tail > head && dq[head] < i - look) head++;
      if (i - look >= 0 && i - look < n) lo[i - look] = need[dq[head]];
    }
    var g = 1, maxRed = 0;
    for (i = 0; i < n; i++) { var t = lo[i]; g = t < g ? t : t + (g - t) * rel; if (g > 1) g = 1; y[i] = x[i] * g; if (1 - g > maxRed) maxRed = 1 - g; }
    for (i = 0; i < n; i++) { if (y[i] > ceilLin) y[i] = ceilLin; else if (y[i] < -ceilLin) y[i] = -ceilLin; }
    return { y: y, maxReductionDb: maxRed > 0 ? -lin2db(1 - maxRed) : 0 };
  }
  function stageOut(x, sr, p, rep) {
    var ceil = db2lin(p.ceilingDb == null ? -1 : p.ceilingDb), y = x;
    if (p.targetRmsDb != null) {
      var cur = gatedRmsDb(y, sr), gdb = clamp(p.targetRmsDb - cur, -24, 24), k = db2lin(gdb); y = new Float32Array(x.length);
      for (var i = 0; i < x.length; i++) y[i] = x[i] * k;
      rep.outGainDb = gdb;
    }
    var L = limiter(y, sr, ceil); rep.limiterDb = L.maxReductionDb;
    return L.y;
  }

  /* ====================== parametri ====================== */
  var DEFAULTS = {
    clean: { on: true, hp: 90, denoiseDb: 0 },
    tune: { on: true, key: 'auto', tonic: 0, mode: 'maggiore', strength: 0.8, retuneMs: 25, humanize: 0.3, flexCents: 0, classic: false, vibrato: 0.7, drift: 0.3, vibratoDepth: 0, vibratoRate: 5.6, formantSemitones: 0 },
    eq: { on: true, boxyDb: -2, presenceDb: 2.5, airDb: 2, lowDb: 0, darkHz: 0 },
    deess: { on: true, freq: 6500, amount: 0.5 },
    comp: { on: true, thresholdDb: -20, ratio: 4, attackMs: 5, releaseMs: 250, peakDb: -8, makeupDb: 0 },
    sat: { on: true, drive: 0.15, mix: 0.25 },
    dist: { on: false, amount: 0.4, mix: 0.3, toneHz: 6000 },
    filter: { on: false, type: 'telefono', freq: 2500 },
    harmony: { on: false, voices: 2, gainDb: -10 },
    doubles: { on: false, count: 2, gainDb: -9, delayMs: 19, modMs: 0.8 },
    delay: { on: false, timeMs: 280, sync: false, feedback: 0.3, mix: 0.15 },
    reverb: { on: true, mix: 0.1, decaySec: 1.4, preDelayMs: 18, lowCutHz: 250, highCutHz: 6000 },
    out: { ceilingDb: -1, targetRmsDb: -19 }
  };

  /** Elenco dei parametri (percorso, tipo, limiti, etichetta italiana, spiegazione): serve ai test, alla validazione e al pannello "Avanzato". */
  var SPEC = [
    ['clean.on', 'bool', 0, 1, 'Pulizia', 'Taglia i rumori bassi e (se vuoi) il fruscio.'],
    ['clean.hp', 'num', 20, 200, 'Taglio bassi (Hz)', 'Toglie rimbombi e botti di microfono sotto questa frequenza.'],
    ['clean.denoiseDb', 'num', 0, 30, 'Riduzione rumore (dB)', 'Abbassa il fruscio di fondo nei momenti in cui non canti. 0 = spento.'],
    ['tune.on', 'bool', 0, 1, 'Autotune', 'Corregge l\'intonazione sulla scala.'],
    ['tune.strength', 'num', 0, 1, 'Quanto correggere', '0 = niente, 1 = tutta la correzione.'],
    ['tune.retuneMs', 'num', 0, 200, 'Velocità (ms)', '0-5 = effetto robot, 10-50 = naturale, più alto = lascia passare di più.'],
    ['tune.humanize', 'num', 0, 1, 'Humanize', 'Rallenta la correzione nelle note lunghe così non suonano statiche.'],
    ['tune.flexCents', 'num', 0, 60, 'Flex-Tune (cent)', 'Zona attorno alla nota dove non si corregge; le scivolate passano.'],
    ['tune.classic', 'bool', 0, 1, 'Modo Classico', 'Passaggio a gradino netto tra le note (effetto duro).'],
    ['tune.vibrato', 'num', 0, 1.5, 'Vibrato naturale', 'Quanto del tuo vibrato resta (0 = piatto, 1 = come l\'hai fatto).'],
    ['tune.drift', 'num', 0, 1, 'Deriva lenta', 'Quanto delle lente oscillazioni dentro la nota resta.'],
    ['tune.vibratoDepth', 'num', 0, 80, 'Vibrato aggiunto (cent)', 'Aggiunge un vibrato finto sulle note lunghe. 0 = nessuno.'],
    ['tune.vibratoRate', 'num', 3, 9, 'Velocità vibrato (Hz)', 'Quante oscillazioni al secondo ha il vibrato aggiunto.'],
    ['tune.formantSemitones', 'num', -6, 6, 'Timbro (semitoni)', 'Voce più scura (-) o più chiara (+) senza cambiare nota.'],
    ['eq.on', 'bool', 0, 1, 'Equalizzatore', 'Dà forma al suono.'],
    ['eq.boxyDb', 'num', -8, 3, 'Meno "scatola" (dB)', 'Taglio sui medio-bassi contro il suono chiuso.'],
    ['eq.presenceDb', 'num', -4, 9, 'Presenza (dB)', 'Più voce davanti alla base (circa 3,5 kHz).'],
    ['eq.airDb', 'num', -6, 8, 'Aria (dB)', 'Più brillantezza sopra i 10 kHz.'],
    ['eq.lowDb', 'num', -6, 8, 'Corpo (dB)', 'Più o meno bassi sotto i 160 Hz.'],
    ['eq.darkHz', 'num', 0, 16000, 'Taglio acuti (Hz)', 'Scurisce il suono. 0 = spento.'],
    ['deess.on', 'bool', 0, 1, 'De-esser', 'Ammorbidisce le "S" troppo taglienti.'],
    ['deess.freq', 'num', 4000, 9000, 'Frequenza de-esser (Hz)', 'Voce maschile circa 6000, femminile circa 7000.'],
    ['deess.amount', 'num', 0, 1, 'Forza de-esser', 'Quanto abbassa le S.'],
    ['comp.on', 'bool', 0, 1, 'Compressore', 'Rende il volume più uniforme.'],
    ['comp.thresholdDb', 'num', -45, 0, 'Soglia (dB)', 'Sopra questo livello il compressore lavora.'],
    ['comp.ratio', 'num', 1, 12, 'Rapporto', '4 = morbido, 8 e oltre = deciso.'],
    ['comp.attackMs', 'num', 1, 50, 'Attacco (ms)', 'Quanto in fretta interviene.'],
    ['comp.releaseMs', 'num', 40, 600, 'Rilascio (ms)', 'Quanto in fretta lascia andare.'],
    ['comp.peakDb', 'num', -30, 0, 'Soglia picchi (dB)', 'Secondo compressore solo sui picchi. 0 = spento.'],
    ['sat.on', 'bool', 0, 1, 'Saturazione', 'Calore e grinta leggeri.'],
    ['sat.drive', 'num', 0, 1, 'Intensità saturazione', ''],
    ['sat.mix', 'num', 0, 1, 'Mix saturazione', 'Quanta saturazione si sente.'],
    ['dist.on', 'bool', 0, 1, 'Distorsione', 'Voce sporca, ruvida.'],
    ['dist.amount', 'num', 0, 1, 'Quantità distorsione', ''],
    ['dist.mix', 'num', 0, 1, 'Mix distorsione', ''],
    ['dist.toneHz', 'num', 1500, 12000, 'Tono distorsione (Hz)', 'Taglia gli acuti ruvidi.'],
    ['filter.on', 'bool', 0, 1, 'Filtro creativo', 'Effetto telefono o voce chiusa.'],
    ['filter.type', 'enum', ['telefono', 'lowpass', 'highpass', 'band'], 0, 'Tipo di filtro', ''],
    ['filter.freq', 'num', 200, 8000, 'Frequenza filtro (Hz)', ''],
    ['harmony.on', 'bool', 0, 1, 'Armonie', 'Aggiunge voci sopra e sotto nella scala (serve la tonalità).'],
    ['harmony.voices', 'num', 1, 4, 'Quante voci', 'Terza, quinta, quarta sotto, ottava.'],
    ['harmony.gainDb', 'num', -24, -3, 'Volume armonie (dB)', ''],
    ['doubles.on', 'bool', 0, 1, 'Doppie voci', 'Raddoppia la voce con ritardi diversi.'],
    ['doubles.count', 'num', 1, 4, 'Quante doppie', ''],
    ['doubles.gainDb', 'num', -20, -3, 'Volume doppie (dB)', ''],
    ['doubles.delayMs', 'num', 8, 40, 'Ritardo doppie (ms)', 'Circa 13-25 ms.'],
    ['doubles.modMs', 'num', 0, 3, 'Ondeggio doppie (ms)', 'Un po\' di movimento: sembrano un altro take.'],
    ['delay.on', 'bool', 0, 1, 'Eco (delay)', ''],
    ['delay.timeMs', 'num', 60, 900, 'Tempo eco (ms)', ''],
    ['delay.sync', 'bool', 0, 1, 'Eco a tempo', 'Usa il tempo della base (croma puntata).'],
    ['delay.feedback', 'num', 0, 0.85, 'Ripetizioni', ''],
    ['delay.mix', 'num', 0, 0.6, 'Volume eco', ''],
    ['reverb.on', 'bool', 0, 1, 'Riverbero', 'Spazio attorno alla voce.'],
    ['reverb.mix', 'num', 0, 0.6, 'Volume riverbero', ''],
    ['reverb.decaySec', 'num', 0.3, 5, 'Durata riverbero (s)', ''],
    ['reverb.preDelayMs', 'num', 0, 80, 'Pre-delay (ms)', 'Distanza prima del riverbero.'],
    ['reverb.lowCutHz', 'num', 80, 800, 'Riverbero: taglio bassi (Hz)', ''],
    ['reverb.highCutHz', 'num', 2000, 12000, 'Riverbero: taglio acuti (Hz)', ''],
    ['out.ceilingDb', 'num', -6, 0, 'Picco massimo (dB)', 'Il limitatore non lo supera.'],
    ['out.targetRmsDb', 'num', -30, -10, 'Volume finale (dB)', 'Volume medio della voce in uscita.']
  ];
  function getPath(o, path) { var k = path.split('.'); return o[k[0]] ? o[k[0]][k[1]] : undefined; }
  function setPath(o, path, v) { var k = path.split('.'); if (!o[k[0]]) o[k[0]] = {}; o[k[0]][k[1]] = v; }
  /** Rimette nei limiti ogni parametro e scarta quelli sconosciuti: usato per i preset salvati e per il pannello Avanzato. */
  function sanitize(params) {
    var out = clone(DEFAULTS);
    SPEC.forEach(function (s) {
      var v = params ? getPath(params, s[0]) : undefined;
      if (v === undefined || v === null) return;
      if (s[1] === 'bool') setPath(out, s[0], !!v);
      else if (s[1] === 'enum') { if (s[2].indexOf(v) !== -1) setPath(out, s[0], v); }
      else if (typeof v === 'number' && Number.isFinite(v)) setPath(out, s[0], clamp(v, s[2], s[3]));
    });
    ['key'].forEach(function (k) { if (params && params.tune && (params.tune.key === 'auto' || params.tune.key === 'manual')) out.tune.key = params.tune.key; });
    if (params && params.tune) { if (Number.isInteger(params.tune.tonic)) out.tune.tonic = ((params.tune.tonic % 12) + 12) % 12; if (['maggiore', 'minore', 'cromatica'].indexOf(params.tune.mode) !== -1) out.tune.mode = params.tune.mode; }
    if (params && params.doubles && Number.isFinite(params.doubles.seed)) out.doubles.seed = params.doubles.seed;
    if (params && params.harmony && Number.isFinite(params.harmony.seed)) out.harmony.seed = params.harmony.seed;
    return out;
  }

  /* ====================== cursori semplici ("macro") ====================== */
  var MACROS = [
    { id: 'intensity', label: 'Intensità', hint: 'Quanto forte è l\'effetto sulla voce.' },
    { id: 'robotic', label: 'Velocità robotica', hint: 'Poco = voce naturale, molto = effetto robot da trap.' },
    { id: 'natural', label: 'Naturalezza', hint: 'Quanto restano vibrato e sfumature tue.' },
    { id: 'timbre', label: 'Timbro', hint: 'A sinistra voce più scura e grande, a destra più chiara.' },
    { id: 'space', label: 'Spazio', hint: 'Quanto riverbero ed eco attorno alla voce.' }
  ];
  /** Trasforma i 5 cursori (0-100) in parametri veri. Cambia più cose insieme (ricerca B: scala Retune Speed 0-5 ms robotico, 10-50 naturale). */
  function applyMacros(params, m) {
    var p = params, I = clamp(m.intensity, 0, 100) / 100, R = clamp(m.robotic, 0, 100) / 100, N = clamp(m.natural, 0, 100) / 100, T = clamp(m.timbre, 0, 100), S = clamp(m.space, 0, 100) / 100;
    p.tune.strength = I;
    p.tune.retuneMs = Math.round(80 * Math.pow(1 - R, 2.2) * 10) / 10;
    p.tune.classic = R >= 0.92;
    p.tune.humanize = Math.round(N * 0.8 * Math.pow(1 - R, 0.7) * 100) / 100;
    p.tune.vibrato = Math.round((N * 1.0) * 100) / 100;
    p.tune.drift = Math.round(N * 0.5 * 100) / 100;
    p.tune.flexCents = Math.round(N * 30 * (1 - R));
    var tm = (T - 50) / 50; // -1..+1
    p.tune.formantSemitones = Math.round(tm * 4 * 10) / 10;
    p.eq.airDb += tm * 2.5; p.eq.lowDb += -tm * 2;
    var sp = S;
    p.reverb.on = sp > 0.03; p.reverb.mix = Math.round((0.02 + sp * 0.28) * 1000) / 1000; p.reverb.decaySec = Math.round((0.8 + sp * 2.0) * 100) / 100;
    p.delay.on = p.delay.on || sp > 0.4; if (sp > 0.4) { p.delay.mix = Math.max(p.delay.mix, Math.round((sp - 0.3) * 0.28 * 1000) / 1000); p.delay.sync = true; }
    var fx = 0.4 + 0.6 * I; // quantità degli effetti creativi
    ['harmony.gainDb', 'doubles.gainDb'].forEach(function (k) { setPath(p, k, getPath(p, k) - (1 - fx) * 8); });
    p.sat.mix *= fx; p.dist.mix *= fx;
    return p;
  }

  /* ====================== caratteri vocali ====================== */
  // PUNTI DI PARTENZA NON VERIFICATI (ricerca B, sezione "Caratteri vocali"): vanno regolati con l'orecchio.
  var CHARACTERS = [
    { id: 'naturale', label: 'Naturale', desc: 'Voce tua, solo ripulita e intonata piano.', macros: { intensity: 55, robotic: 15, natural: 85, timbre: 50, space: 20 }, p: { comp: { ratio: 3, peakDb: 0 } } },
    { id: 'melodico', label: 'Melodico', desc: 'Intonata e cantabile, con un po\' di spazio.', macros: { intensity: 75, robotic: 40, natural: 70, timbre: 52, space: 40 }, p: { doubles: { on: true, count: 1, gainDb: -12 } } },
    { id: 'robotico', label: 'Trap duro (robot)', desc: 'Intonazione a gradino, voce da robot.', macros: { intensity: 100, robotic: 100, natural: 0, timbre: 50, space: 25 }, p: { tune: { vibrato: 0, vibratoDepth: 0 }, sat: { drive: 0.35 }, comp: { ratio: 6 } } },
    { id: 'scuro', label: 'Scuro e profondo', desc: 'Voce più grande, calda e cupa.', macros: { intensity: 70, robotic: 45, natural: 55, timbre: 20, space: 30 }, p: { eq: { lowDb: 3, airDb: -2, darkHz: 9500 }, deess: { amount: 0.3 } } },
    { id: 'ruvido', label: 'Ruvido e distorto', desc: 'Voce sporca, aggressiva.', macros: { intensity: 70, robotic: 55, natural: 40, timbre: 45, space: 15 }, p: { dist: { on: true, amount: 0.45, mix: 0.35 }, sat: { drive: 0.6 }, comp: { ratio: 6 } } },
    { id: 'brillante', label: 'Brillante', desc: 'Voce chiara, avanti, con aria.', macros: { intensity: 75, robotic: 45, natural: 65, timbre: 75, space: 30 }, p: { eq: { presenceDb: 4.5, airDb: 3.5 }, deess: { amount: 0.75 } } },
    { id: 'morbido', label: 'Morbido e atmosferico', desc: 'Voce dolce in una nuvola di spazio.', macros: { intensity: 60, robotic: 25, natural: 80, timbre: 50, space: 82 }, p: { comp: { ratio: 2.5, peakDb: 0 }, eq: { darkHz: 9000, presenceDb: 1 }, reverb: { decaySec: 2.6, mix: 0.3 }, doubles: { on: true, count: 2, gainDb: -13 } } },
    { id: 'potente', label: 'Potente', desc: 'Voce grossa e davanti, ben compressa.', macros: { intensity: 85, robotic: 55, natural: 50, timbre: 48, space: 25 }, p: { comp: { ratio: 6, thresholdDb: -24, peakDb: -10 }, sat: { drive: 0.4, mix: 0.35 }, eq: { presenceDb: 4 }, doubles: { on: true, count: 1, gainDb: -10 } } },
    { id: 'formanti', label: 'Formanti modificati', desc: 'Cambia il timbro: voce più piccola e chiara.', macros: { intensity: 75, robotic: 50, natural: 60, timbre: 92, space: 30 }, p: {} },
    { id: 'vibrato', label: 'Vibrato controllato', desc: 'Il tuo vibrato ridotto e uno pulito aggiunto.', macros: { intensity: 70, robotic: 40, natural: 30, timbre: 50, space: 30 }, p: { tune: { vibrato: 0.2, vibratoDepth: 35, vibratoRate: 5.6 } } },
    { id: 'armonie', label: 'Con armonie', desc: 'Voci sopra e sotto nella scala.', macros: { intensity: 75, robotic: 45, natural: 65, timbre: 50, space: 40 }, p: { harmony: { on: true, voices: 2, gainDb: -10 } } },
    { id: 'doppie', label: 'Con doppie', desc: 'La voce raddoppiata, più larga e piena.', macros: { intensity: 70, robotic: 45, natural: 65, timbre: 50, space: 30 }, p: { doubles: { on: true, count: 2, gainDb: -8 } } },
    { id: 'sperimentale', label: 'Sperimentale', desc: 'Effetti strani: timbro cambiato, eco lunghi.', macros: { intensity: 100, robotic: 90, natural: 10, timbre: 12, space: 65 }, p: { dist: { on: true, amount: 0.25, mix: 0.2 }, doubles: { on: true, count: 2, gainDb: -9, modMs: 2.5 }, delay: { on: true, feedback: 0.45, mix: 0.3, sync: true } } }
  ];
  function charById(id) { return CHARACTERS.filter(function (c) { return c.id === id; })[0] || null; }
  // regole di combinazione dei numeri quando si scelgono più caratteri insieme
  var ADD_KEYS = { boxyDb: 1, presenceDb: 1, airDb: 1, lowDb: 1, formantSemitones: 1 };
  var MAX_KEYS = { mix: 1, drive: 1, amount: 1, count: 1, voices: 1, feedback: 1, ratio: 1, modMs: 1, vibratoDepth: 1, decaySec: 1, darkHz: 0 };
  function mergeInto(dst, src, plain) { // plain = true: il valore nuovo sostituisce sempre (usato sui valori di base e sul pannello Avanzato)
    Object.keys(src).forEach(function (grp) {
      if (!dst[grp]) dst[grp] = {};
      Object.keys(src[grp]).forEach(function (k) {
        var v = src[grp][k], o = dst[grp][k];
        if (plain) dst[grp][k] = v;
        else if (typeof v === 'number' && typeof o === 'number') dst[grp][k] = ADD_KEYS[k] ? o + v : (MAX_KEYS[k] ? Math.max(o, v) : v);
        else if (typeof v === 'boolean' && typeof o === 'boolean' && k === 'on') dst[grp][k] = o || v;
        else dst[grp][k] = v;
      });
    });
  }
  /** Unisce i cursori di più caratteri: intensità e spazio = il più alto; robotica = la più alta; naturalezza = media; timbro = somma degli scostamenti da 50. */
  function combineMacros(ids) {
    var cs = ids.map(charById).filter(Boolean);
    if (!cs.length) return { intensity: 70, robotic: 45, natural: 65, timbre: 50, space: 30 };
    var m = { intensity: 0, robotic: 0, natural: 0, timbre: 50, space: 0 };
    cs.forEach(function (c) { m.intensity = Math.max(m.intensity, c.macros.intensity); m.robotic = Math.max(m.robotic, c.macros.robotic); m.natural += c.macros.natural / cs.length; m.timbre += c.macros.timbre - 50; m.space = Math.max(m.space, c.macros.space); });
    if (m.robotic >= 80) m.natural = Math.min(m.natural, 30);
    m.timbre = clamp(m.timbre, 0, 100);
    return m;
  }
  /**
   * Costruisce i parametri completi.
   * @param {{ids?:string[], macros?:object, advanced?:object, auto?:object}} state  ids = caratteri scelti; macros = cursori (sovrascrivono quelli dei caratteri);
   *   advanced = parametri puntuali (percorso -> valore, o oggetto a gruppi) che sovrascrivono tutto; auto = esito di autoSettings()
   */
  function buildParams(state) {
    state = state || {};
    var ids = (state.ids || ['melodico']).filter(charById);
    var p = clone(DEFAULTS), extras = {};
    ids.forEach(function (id) { mergeInto(extras, clone(charById(id).p)); });
    mergeInto(p, extras, true);
    var macros = combineMacros(ids), ov = state.macros || {};
    MACROS.forEach(function (mm) { if (typeof ov[mm.id] === 'number') macros[mm.id] = clamp(ov[mm.id], 0, 100); });
    applyMacros(p, macros);
    // i parametri "fissi" del carattere (vibrato aggiunto, ecc.) vincono sui cursori dove sono dichiarati
    ['vibrato', 'vibratoDepth', 'vibratoRate'].forEach(function (k) { if (extras.tune && extras.tune[k] !== undefined) p.tune[k] = extras.tune[k]; });
    if (state.auto && state.auto.advanced) mergeInto(p, state.auto.advanced, true);
    if (state.advanced) mergeInto(p, state.advanced, true);
    var out = sanitize(p);
    out.tune.key = (state.advanced && state.advanced.tune && state.advanced.tune.key) || 'auto';
    if (state.keyOverride) { out.tune.key = 'manual'; out.tune.tonic = state.keyOverride.tonic; out.tune.mode = state.keyOverride.mode; }
    if (out.tune.strength >= 0.999 && out.tune.retuneMs < 1) out.tune.strength = 1;
    return { params: out, macros: macros, ids: ids };
  }

  /* ====================== analisi automatica (pulsante "Auto") ====================== */
  function percentile(a, q) { if (!a.length) return NaN; var b = a.slice().sort(function (x, y) { return x - y; }); return b[Math.min(b.length - 1, Math.floor(q * (b.length - 1)))]; }
  /** Misura la registrazione: rumore di fondo, sibilanti, dinamica, altezza media, tonalità, errore di intonazione. */
  function analyzeVoice(x, sr, trk) {
    var res = trk || Autotune.track(x, sr), win = Math.round(sr * 0.02), n = Math.floor(x.length / win), dbs = [], i, j;
    for (i = 0; i < n; i++) { var s = 0; for (j = 0; j < win; j++) { var v = x[i * win + j]; s += v * v; } dbs.push(10 * Math.log(Math.max(s / win, 1e-14)) / Math.LN10); }
    var floor = percentile(dbs, 0.1), top = percentile(dbs, 0.9), lo = percentile(dbs, 0.25);
    var pitched = res.frames.filter(function (f) { return f.voiced && f.f0 > 0; }).map(function (f) { return f.f0; });
    var med = pitched.length ? percentile(pitched, 0.5) : 0;
    var sib = bandEnergyDb(x, sr, 5000, 0) - bandEnergyDb(x, sr, 0, 0);
    var key = null, m = null;
    try { key = Autotune.detectKey(x, sr, res); m = Autotune.measure(x, sr, { tonic: 0, mode: 'cromatica', track: res }); } catch (e) { key = null; }
    var cl = 0, tot = x.length; for (i = 0; i < tot; i += 2) if (x[i] >= 0.999 || x[i] <= -0.999) cl++;
    return { noiseFloorDb: floor, voiceLevelDb: top, snrDb: top - floor, dynamicsDb: top - lo, sibilanceDb: sib, medianHz: med, voicedShare: res.voicedShare, key: key, chromaticErrCents: m ? m.centerCents : NaN, clippedShare: cl / Math.max(1, tot / 2), peakDb: peakDb(x), trackRes: res, durationS: x.length / sr };
  }
  /** Decide da sola le regolazioni utili (e le spiega in italiano). Non cambia il carattere scelto: lo adatta alla registrazione. */
  function autoSettings(info) {
    var adv = {}, notes = [];
    function set(g, k, v) { if (!adv[g]) adv[g] = {}; adv[g][k] = v; }
    if (info.snrDb < 22 && info.voicedShare > 0.05) { var red = clamp(Math.round((26 - info.snrDb) * 0.9), 6, 18); set('clean', 'denoiseDb', red); notes.push('C\'è fruscio di fondo (' + Math.round(info.snrDb) + ' dB di distanza dalla voce): riduco il rumore di ' + red + ' dB.'); }
    if (info.medianHz > 0) {
      set('deess', 'freq', info.medianHz < 180 ? 6000 : 7000); set('clean', 'hp', info.medianHz < 140 ? 75 : 100);
    }
    if (info.sibilanceDb > -14) { set('deess', 'amount', 0.8); notes.push('Le "S" sono forti: de-esser più deciso.'); }
    else if (info.sibilanceDb < -22) set('deess', 'amount', 0.3);
    if (info.dynamicsDb > 26) { set('comp', 'ratio', 5); set('comp', 'thresholdDb', -24); notes.push('Il volume salta molto: compressione più decisa.'); }
    else if (info.dynamicsDb < 12) { set('comp', 'ratio', 2.5); }
    var intensityScale = 1;
    if (isFinite(info.chromaticErrCents) && info.chromaticErrCents < 10) { intensityScale = 0.75; notes.push('La voce è già abbastanza intonata (circa ' + Math.round(info.chromaticErrCents) + ' cent di errore): uso meno ritocco.'); }
    if (info.clippedShare > 0.001) notes.push('Attenzione: la registrazione satura (distorce). Meglio ripetere più lontano o più piano dal microfono.');
    if (info.peakDb < -30) notes.push('La registrazione è molto bassa: la alzo.');
    if (!info.key) notes.push('Non ho abbastanza note chiare per riconoscere la tonalità.');
    else if (info.key.confidence === 'bassa') notes.push('Tonalità incerta (' + info.key.name + ' o ' + info.key.alternative.name + '): non blocco la scala; se la conosci, sceglila tu.');
    return { advanced: adv, notes: notes, intensityScale: intensityScale };
  }

  /* ====================== esecuzione ====================== */
  function fixFinite(x, rep, name) {
    var bad = 0; for (var i = 0; i < x.length; i++) if (!Number.isFinite(x[i])) { x[i] = 0; bad++; }
    if (bad) { rep.nanFixed = (rep.nanFixed || 0) + bad; rep.warnings.push('Corretti ' + bad + ' campioni non validi in "' + name + '".'); }
    return x;
  }
  function buildStages(p) {
    var st = [];
    function add(name, label, fn) { st.push({ name: name, label: label, fn: fn }); }
    if (p.clean.on) add('clean', 'Pulizia', function (S) { S.x = stageClean(S.x, S.sr, p.clean, S.rep); });
    if (p.tune.on) add('tune', 'Intonazione', function (S) {
      var t = p.tune, o = { strength: t.strength, retuneMs: t.retuneMs, humanize: t.humanize, flexCents: t.flexCents, classic: t.classic, vibrato: t.vibrato, drift: t.drift, vibratoDepth: t.vibratoDepth, vibratoRate: t.vibratoRate, formantSemitones: t.formantSemitones, maxSeconds: 600, track: S.track };
      if (t.key === 'auto') o.key = 'auto'; else { o.tonic = t.tonic; o.mode = t.mode; }
      var r = Autotune.correct(S.x, S.sr, o); S.x = r.samples; S.rep.tune = r.stats;
      S.ctx.tonic = r.stats.tonic; S.ctx.mode = r.stats.mode; S.ctx.scaleKnown = r.stats.mode !== 'cromatica';
      if (t.key === 'auto' && r.stats.key && !r.stats.key.certain) S.rep.keyUncertain = r.stats.key;
      S.track = Autotune.track(S.x, S.sr, { maxSeconds: 600 }); // altezza dopo la correzione (serve alle armonie e alla misura)
    });
    else add('track', 'Analisi', function (S) { S.track = Autotune.track(S.x, S.sr, { maxSeconds: 600 }); S.ctx.scaleKnown = p.tune.mode !== 'cromatica'; S.ctx.tonic = p.tune.tonic; S.ctx.mode = p.tune.mode; });
    if (p.eq.on) add('eq1', 'EQ', function (S) { S.x = stageEq1(S.x, S.sr, p.eq); });
    if (p.deess.on) add('deess', 'De-esser', function (S) { S.x = stageDeess(S.x, S.sr, p.deess, S.rep); });
    if (p.comp.on) add('comp', 'Compressore', function (S) { S.x = stageComp(S.x, S.sr, p.comp, S.rep); });
    if (p.sat.on && p.sat.mix > 0.001) add('sat', 'Saturazione', function (S) { S.x = stageSat(S.x, S.sr, p.sat, S.rep); });
    if (p.dist.on && p.dist.mix > 0.001) add('dist', 'Distorsione', function (S) { S.x = stageDist(S.x, S.sr, p.dist, S.rep); });
    if (p.eq.on) add('eq2', 'EQ colore', function (S) { S.x = stageEq2(S.x, S.sr, p.eq); });
    if (p.filter.on) add('filter', 'Filtro', function (S) { S.x = stageFilter(S.x, S.sr, p.filter); });
    if (p.harmony.on) add('harmony', 'Armonie', function (S) { S.ctx.track = S.track; S.x = stageHarmony(S.x, S.sr, p.harmony, S.ctx, S.rep); });
    if (p.doubles.on) add('doubles', 'Doppie', function (S) { S.x = stageDoubles(S.x, S.sr, p.doubles, S.rep); });
    if (p.delay.on && p.delay.mix > 0.001) add('delay', 'Eco', function (S) { S.x = stageDelay(S.x, S.sr, p.delay, S.ctx); });
    if (p.reverb.on && p.reverb.mix > 0.001) add('reverb', 'Riverbero', function (S) { S.x = stageReverb(S.x, S.sr, p.reverb); });
    add('out', 'Livello finale', function (S) { S.x = stageOut(S.x, S.sr, p.out, S.rep); });
    return st;
  }
  function newState(x, sr, params, ctx) {
    var p = sanitize(params);
    return { p: p, S: { x: Float32Array.from(x), sr: sr, track: null, ctx: { bpm: ctx && ctx.bpm, scaleKnown: p.tune.mode !== 'cromatica', tonic: p.tune.tonic, mode: p.tune.mode }, rep: { warnings: [], stageMs: {}, peaks: {} } } };
  }
  function finishReport(S, input) {
    var rep = S.rep; rep.inputPeakDb = peakDb(input); rep.outputPeakDb = peakDb(S.x); rep.inputRmsDb = gatedRmsDb(input, S.sr); rep.outputRmsDb = gatedRmsDb(S.x, S.sr); rep.sampleRate = S.sr;
    return { samples: S.x, sr: S.sr, report: rep, params: null };
  }
  function runStage(st, S) {
    var t0 = Date.now(); st.fn(S); fixFinite(S.x, S.rep, st.name); S.rep.stageMs[st.name] = Date.now() - t0; S.rep.peaks[st.name] = peakDb(S.x);
  }
  /** Elabora in modo sincrono. @returns {{samples:Float32Array, report:object}} */
  function render(x, sr, params, ctx) {
    var ns = newState(x, sr, params, ctx), stages = buildStages(ns.p);
    stages.forEach(function (st) { runStage(st, ns.S); });
    var r = finishReport(ns.S, x); r.params = ns.p; return r;
  }
  /** Come render, ma cede il controllo tra una fase e l'altra (per non bloccare la pagina). onProgress(fase, 0-1). */
  async function renderAsync(x, sr, params, ctx, onProgress, yieldFn) {
    var ns = newState(x, sr, params, ctx), stages = buildStages(ns.p), y = yieldFn || function () { return new Promise(function (r) { setTimeout(r, 0); }); };
    for (var i = 0; i < stages.length; i++) {
      if (onProgress) onProgress(stages[i].label, i / stages.length);
      await y(); runStage(stages[i], ns.S);
    }
    if (onProgress) onProgress('Fatto', 1);
    var r = finishReport(ns.S, x); r.params = ns.p; return r;
  }

  /* ====================== preset salvabili ====================== */
  /** Stato salvabile (testo JSON): caratteri scelti, cursori e parametri avanzati modificati. */
  function serializeState(state) {
    return JSON.stringify({ v: 1, ids: (state.ids || []).filter(charById), macros: state.macros || {}, advanced: state.advanced || {}, name: String(state.name || '').slice(0, 40) });
  }
  function parseState(text) {
    var o; try { o = JSON.parse(text); } catch (e) { return null; }
    if (!o || o.v !== 1) return null;
    var macros = {}; MACROS.forEach(function (m) { if (o.macros && typeof o.macros[m.id] === 'number') macros[m.id] = clamp(o.macros[m.id], 0, 100); });
    var adv = {}; SPEC.forEach(function (s) { var v = o.advanced ? getPath(o.advanced, s[0]) : undefined; if (v !== undefined) setPath(adv, s[0], v); });
    var clean = sanitize(adv), advClean = {};
    SPEC.forEach(function (s) { if (getPath(adv, s[0]) !== undefined) setPath(advClean, s[0], getPath(clean, s[0])); });
    return { ids: (o.ids || []).filter(charById), macros: macros, advanced: advClean, name: String(o.name || '').slice(0, 40) };
  }

  return {
    DEFAULTS: DEFAULTS, SPEC: SPEC, MACROS: MACROS, CHARACTERS: CHARACTERS,
    buildParams: buildParams, applyMacros: applyMacros, combineMacros: combineMacros, sanitize: sanitize,
    analyzeVoice: analyzeVoice, autoSettings: autoSettings,
    render: render, renderAsync: renderAsync,
    serializeState: serializeState, parseState: parseState,
    matchGains: matchGains, gatedRmsDb: gatedRmsDb, peakDb: peakDb, bandEnergyDb: bandEnergyDb,
    // fasi singole (per i test e per usi futuri)
    stages: { deess: stageDeess, compressor: compressor, comp: stageComp, sat: stageSat, dist: stageDist, doubles: stageDoubles, harmony: stageHarmony, delay: stageDelay, reverb: stageReverb, limiter: limiter, filter: stageFilter, eq2: stageEq2, eq1: stageEq1, clean: stageClean }
  };
});
