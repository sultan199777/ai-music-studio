/*
 * Mastering stereo (calcolo sul file):
 *  1. compressore multibanda a 3 bande (incroci 150 Hz e 3 kHz, filtri Linkwitz-Riley 4° ordine: le bande sommate ridanno il segnale);
 *  2. larghezza stereo (mid/side) con i bassi sotto 150 Hz sempre in mono (fase sicura);
 *  3. saturazione morbida (clipper "analogico");
 *  4. volume portato al bersaglio LUFS (misura BS.1770) e limitatore con anticipo al tetto di true peak.
 * Analisi: spettro a 10 bande (dB), correlazione di fase L/R (-1…+1), confronto con un brano di riferimento.
 * meter = funzione di misura {lufs, truePeakDb} (BeatMix.loudness): passata da fuori per non duplicare il codice.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MasterPro = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var TARGETS = { streaming: { nome: 'Streaming (Spotify, Apple)', lufs: -14, tp: -1 }, forte: { nome: 'Forte (trap/drill)', lufs: -9, tp: -1 }, club: { nome: 'Club / molto forte', lufs: -7.5, tp: -0.8 }, morbido: { nome: 'Morbido', lufs: -16, tp: -1 } };
  var DEF = { target: 'forte', low: { thr: -18, ratio: 2.5, gain: 0 }, mid: { thr: -20, ratio: 2, gain: 0 }, high: { thr: -22, ratio: 2, gain: 0 }, width: 1.1, sat: 0.25 };
  var BANDS = [40, 80, 160, 315, 630, 1250, 2500, 5000, 10000, 16000];

  function bq(type, f, sr, q) {
    var w = 2 * Math.PI * f / sr, c = Math.cos(w), al = Math.sin(w) / (2 * (q || Math.SQRT1_2)), a0 = 1 + al, b;
    if (type === 'lp') b = [(1 - c) / 2, 1 - c, (1 - c) / 2]; else if (type === 'hp') b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]; else b = [al, 0, -al];
    return { b0: b[0] / a0, b1: b[1] / a0, b2: b[2] / a0, a1: -2 * c / a0, a2: (1 - al) / a0 };
  }
  function filt(x, c) { var y = new Float32Array(x.length), x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (var i = 0; i < x.length; i++) { var v = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; }
  function lr4(x, type, f, sr) { var c = bq(type, f, sr); return filt(filt(x, c), c); }
  /** 3 bande Linkwitz-Riley: low, mid, high (la somma = passa-tutto, stesso livello del segnale). */
  function split3(x, sr, f1, f2) {
    var low = lr4(x, 'lp', f1, sr), hi1 = lr4(x, 'hp', f1, sr), mid = lr4(hi1, 'lp', f2, sr), high = lr4(hi1, 'hp', f2, sr);
    return { low: low, mid: mid, high: high };
  }
  function compBand(xs, sr, o) { // xs = [L, R] della banda; compressione con rilevatore RMS collegato tra i canali
    var thr = o.thr, ratio = Math.max(1, o.ratio), mk = Math.pow(10, (o.gain || 0) / 20), at = Math.exp(-1 / (sr * 0.01)), rl = Math.exp(-1 / (sr * 0.15)), e = 0, gr = 0;
    var L = xs[0], R = xs[1], n = L.length;
    for (var i = 0; i < n; i++) {
      var p = Math.max(L[i] * L[i], R[i] * R[i]); e = p > e ? at * e + (1 - at) * p : rl * e + (1 - rl) * p;
      var lev = 10 * Math.log10(e + 1e-12), over = lev - thr, g = over > 0 ? -over * (1 - 1 / ratio) : 0;
      var gl = Math.pow(10, g / 20) * mk; L[i] *= gl; R[i] *= gl; if (-g > gr) gr = -g;
    }
    return gr;
  }
  function limiter(L, R, sr, ceilDb) {
    var ceil = Math.pow(10, ceilDb / 20), la = Math.round(sr * 0.003), n = L.length, g = 1, rel = Math.exp(-1 / (sr * 0.08)), need = new Float32Array(n), outL = new Float32Array(n), outR = new Float32Array(n), maxRed = 0;
    for (var i = 0; i < n; i++) { var a = Math.max(Math.abs(L[i]), Math.abs(R[i])) * 1.12; need[i] = a > ceil ? ceil / a : 1; } // 1.12 ≈ margine per i picchi tra i campioni
    var minWin = new Float32Array(n); for (i = 0; i < n; i++) { var m = 1; for (var k = 0; k <= la && i + k < n; k += 4) if (need[i + k] < m) m = need[i + k]; minWin[i] = m; }
    for (i = 0; i < n; i++) { var t = minWin[i]; g = t < g ? t : rel * g + (1 - rel) * t; if (g > 1) g = 1; outL[i] = L[i] * g; outR[i] = R[i] * g; if (1 - g > maxRed) maxRed = 1 - g; }
    return { L: outL, R: outR, maxRedDb: maxRed > 0 ? -20 * Math.log10(1 - maxRed) : 0 };
  }
  function correlation(L, R) { var s = 0, a = 0, b = 0; for (var i = 0; i < L.length; i++) { s += L[i] * R[i]; a += L[i] * L[i]; b += R[i] * R[i]; } return a > 0 && b > 0 ? s / Math.sqrt(a * b) : 1; }
  /** Spettro in 10 bande (dB relativi al totale), mono. */
  function spectrum(x, sr) {
    var tot = 0, i; for (i = 0; i < x.length; i++) tot += x[i] * x[i]; tot = tot || 1e-12;
    return BANDS.map(function (f) { if (f >= sr / 2) return -60; var y = filt(x, bq('bp', f, sr, 1.4)), e = 0; for (var k = 0; k < y.length; k++) e += y[k] * y[k]; return Math.max(-60, 10 * Math.log10(e / tot + 1e-12)); });
  }
  function mono(L, R) { var m = new Float32Array(L.length); for (var i = 0; i < m.length; i++) m[i] = (L[i] + R[i]) / 2; return m; }
  /** Confronto con un riferimento: differenze per banda e consigli in italiano. */
  function compare(mineSpec, refSpec) {
    var names = ['sub 40', 'bassi 80', 'bassi 160', 'calore 315', 'medi 630', 'medi 1,2k', 'presenza 2,5k', 'presenza 5k', 'aria 10k', 'aria 16k'], tips = [];
    var d = mineSpec.map(function (v, i) { return Math.round((v - refSpec[i]) * 10) / 10; });
    d.forEach(function (v, i) { if (v > 3) tips.push(names[i] + ' Hz: +' + v + ' dB rispetto al riferimento (togli un po\').'); else if (v < -3) tips.push(names[i] + ' Hz: ' + v + ' dB rispetto al riferimento (alza un po\').'); });
    return { diff: d, tips: tips.length ? tips : ['Lo spettro è vicino al riferimento (entro 3 dB per banda).'] };
  }
  /**
   * Master completo. opts: {target, low/mid/high: {thr, ratio, gain}, width, sat, matchRef (spettro riferimento → EQ max ±3 dB)}.
   * Ritorna {L, R, report: {lufs, truePeakDb, corr, grLow, grMid, grHigh, limiterDb, gainDb}}.
   */
  function process(Lin, Rin, sr, opts, meter) {
    var o = Object.assign({}, DEF, opts || {}), T = TARGETS[o.target] || TARGETS.forte, n = Lin.length, i;
    var bL = split3(Lin, sr, 150, 3000), bR = split3(Rin, sr, 150, 3000);
    var grL = compBand([bL.low, bR.low], sr, Object.assign({}, DEF.low, o.low)), grM = compBand([bL.mid, bR.mid], sr, Object.assign({}, DEF.mid, o.mid)), grH = compBand([bL.high, bR.high], sr, Object.assign({}, DEF.high, o.high));
    var L = new Float32Array(n), R = new Float32Array(n), w = Math.max(0, Math.min(2, o.width));
    for (i = 0; i < n; i++) {
      var lo = (bL.low[i] + bR.low[i]) / 2; // bassi in mono
      var mL = bL.mid[i] + bL.high[i], mR = bR.mid[i] + bR.high[i], M = (mL + mR) / 2, S = (mL - mR) / 2 * w;
      L[i] = lo + M + S; R[i] = lo + M - S;
    }
    if (o.matchRef && o.mySpec) {
      var diff = compare(o.mySpec, o.matchRef).diff;
      BANDS.forEach(function (f, k) { if (f >= sr / 2) return; var g = Math.max(-3, Math.min(3, -diff[k] * 0.5)); if (Math.abs(g) < 0.5) return; var A = Math.pow(10, g / 40), w0 = 2 * Math.PI * f / sr, al = Math.sin(w0) / (2 * 1.4), c = Math.cos(w0), a0 = 1 + al / A;
        var cf = { b0: (1 + al * A) / a0, b1: -2 * c / a0, b2: (1 - al * A) / a0, a1: -2 * c / a0, a2: (1 - al / A) / a0 }; L = filt(L, cf); R = filt(R, cf); });
    }
    if (o.sat > 0) { var k2 = 1 + o.sat * 3, nk = Math.tanh(k2); for (i = 0; i < n; i++) { L[i] = Math.tanh(k2 * L[i]) / nk * (1 - o.sat * 0.3) + L[i] * o.sat * 0.3; R[i] = Math.tanh(k2 * R[i]) / nk * (1 - o.sat * 0.3) + R[i] * o.sat * 0.3; } }
    // volume al bersaglio: due giri (misura → guadagno → limitatore → misura → correzione)
    var gainDb = 0, lim = null;
    for (var pass = 0; pass < 2; pass++) {
      var m = meter([L, R], sr), now = isFinite(m.lufs) ? m.lufs : -40, gdb = Math.max(-20, Math.min(24, T.lufs - now)), g = Math.pow(10, gdb / 20);
      var gL = new Float32Array(n), gR = new Float32Array(n); for (i = 0; i < n; i++) { gL[i] = L[i] * g; gR[i] = R[i] * g; }
      lim = limiter(gL, gR, sr, T.tp); L = lim.L; R = lim.R; gainDb += gdb;
      if (Math.abs(meter([L, R], sr).lufs - T.lufs) < 0.5) break;
    }
    var fin = meter([L, R], sr);
    return { L: L, R: R, report: { target: T.nome, lufs: Math.round(fin.lufs * 10) / 10, truePeakDb: Math.round(fin.truePeakDb * 10) / 10, corr: Math.round(correlation(L, R) * 100) / 100, grLow: Math.round(grL * 10) / 10, grMid: Math.round(grM * 10) / 10, grHigh: Math.round(grH * 10) / 10, limiterDb: Math.round(lim.maxRedDb * 10) / 10, gainDb: Math.round(gainDb * 10) / 10 } };
  }
  return { TARGETS: TARGETS, DEF: DEF, BANDS: BANDS, split3: split3, limiter: limiter, correlation: correlation, spectrum: spectrum, compare: compare, mono: mono, process: process };
});
