/*
 * Analisi di una base musicale importata (audio con più strumenti insieme):
 * velocità (BPM) e tonalità STIMATE.
 *
 * BPM: si misura quanto spesso l'energia sale di colpo (colpi di batteria, accordi)
 * e si cerca la ripetizione più regolare. Può sbagliare di un fattore 2 (il doppio o la metà).
 * Tonalità: si sommano le 12 note (senza ottava) presenti nel suono con il metodo
 * Goertzel e si confronta con i profili maggiore/minore. Con basi molto distorte,
 * senza armonia o con modulazioni la stima è debole: l'affidabilità lo dice.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(typeof require === 'function' ? require('./key-detect.js') : root.KeyDetect);
  else root.BaseAnalysis = factory(root.KeyDetect);
})(typeof self !== 'undefined' ? self : this, function (KeyDetect) {
  'use strict';

  function toMono(input) {
    if (!Array.isArray(input)) return input;
    if (input.length === 1) return input[0];
    var out = new Float32Array(input[0].length);
    for (var c = 0; c < input.length; c++) for (var i = 0; i < out.length; i++) out[i] += input[c][i] / input.length;
    return out;
  }

  function decimate(x, f) {
    if (f <= 1) return x;
    var n = Math.floor(x.length / f), y = new Float32Array(n);
    for (var i = 0; i < n; i++) { var s = 0; for (var k = 0; k < f; k++) s += x[i * f + k]; y[i] = s / f; }
    return y;
  }

  function estimateBpm(x, sr) {
    var hop = Math.max(32, Math.round(sr / 90)), n = Math.floor(x.length / hop);
    if (n < 60) return null;
    var env = new Float32Array(n), i, j;
    for (i = 0; i < n; i++) { var e = 0; for (j = 0; j < hop; j++) { var v = x[i * hop + j]; e += v * v; } env[i] = Math.sqrt(e / hop); }
    var flux = new Float32Array(n);
    for (i = 1; i < n; i++) flux[i] = Math.max(0, env[i] - env[i - 1]);
    var mean = 0; for (i = 0; i < n; i++) mean += flux[i]; mean /= n;
    for (i = 0; i < n; i++) flux[i] -= mean;
    var fps = sr / hop, minLag = Math.floor(fps * 60 / 190), maxLag = Math.ceil(fps * 60 / 55);
    var top = Math.min(n - 2, maxLag * 4 + 2), ac = new Float32Array(top + 2), zero = 0;
    for (i = 0; i < n; i++) zero += flux[i] * flux[i];
    if (zero <= 0) return null;
    for (var lag = minLag - 1; lag <= top + 1; lag++) {
      var s2 = 0; for (i = lag; i < n; i++) s2 += flux[i] * flux[i - lag];
      ac[lag] = s2 / zero;
    }
    // Un tempo vero si ripete anche a 2 e 4 battiti (misura): si sommano i tre punteggi.
    var best = -1, bestScore = -Infinity;
    for (lag = minLag; lag <= maxLag; lag++) {
      if (!(ac[lag] > ac[lag - 1] && ac[lag] >= ac[lag + 1])) continue;
      var bpm = 60 * fps / lag, w = bpm >= 75 && bpm <= 150 ? 1 : 0.85;
      var score = ac[lag] + (lag * 2 <= top ? Math.max(0, ac[lag * 2]) : 0) + (lag * 4 <= top ? Math.max(0, ac[lag * 4]) : 0);
      score *= w;
      if (score > bestScore) { bestScore = score; best = lag; }
    }
    if (best < 0) return null;
    // Correzione di ottava e di ritmo puntato: se a 1/2 o 2/3 del ritardo c'è un picco quasi altrettanto forte, è quello il battito.
    [0.5, 2 / 3].forEach(function (ratio) {
      var l2 = Math.round(best * ratio), pk = -1, pv = -Infinity, q;
      if (l2 < minLag) return;
      for (q = l2 - 1; q <= l2 + 1; q++) if (ac[q] > pv) { pv = ac[q]; pk = q; }
      if (pk >= minLag && pv >= 0.6 * ac[best] && 60 * fps / pk <= 165) best = pk;
    });
    var y0 = ac[best - 1], y1 = ac[best], y2 = ac[best + 1], d = y0 - 2 * y1 + y2;
    var shift = d !== 0 ? 0.5 * (y0 - y2) / d : 0;
    return { bpm: 60 * fps / (best + shift), strength: Math.max(0, Math.min(1, ac[best])) };
  }

  function chromaHistogram(x, sr) {
    var N = 4096, hop = 4096, lo = 36, hi = 84, hist = new Array(12).fill(0);
    var notes = [], coeffs = [], win = new Float32Array(N), i, m;
    for (i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
    for (m = lo; m <= hi; m++) { var f = 440 * Math.pow(2, (m - 69) / 12); if (f < sr / 2.2) { notes.push(m); coeffs.push(2 * Math.cos(2 * Math.PI * f / sr)); } }
    var frames = 0, buf = new Float32Array(N);
    for (var s = 0; s + N <= x.length; s += hop) {
      var energy = 0;
      for (i = 0; i < N; i++) { buf[i] = x[s + i] * win[i]; energy += buf[i] * buf[i]; }
      if (energy < 1e-6) continue;
      frames++;
      var mags = new Float32Array(notes.length), tot = 0;
      for (var k = 0; k < notes.length; k++) {
        var c = coeffs[k], s1 = 0, s2 = 0;
        for (i = 0; i < N; i++) { var s0 = buf[i] + c * s1 - s2; s2 = s1; s1 = s0; }
        var mag = Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2));
        mags[k] = mag; tot += mag;
      }
      if (tot <= 0) continue;
      for (k = 0; k < notes.length; k++) hist[notes[k] % 12] += mags[k] / tot;
    }
    return { hist: hist, frames: frames };
  }

  /**
   * @param {Float32Array|Float32Array[]} input
   * @param {number} sampleRate
   * @param {{maxSeconds?:number}} [opts]
   */
  function analyze(input, sampleRate, opts) {
    opts = opts || {};
    var mono = toMono(input), maxSec = opts.maxSeconds || 60;
    var duration = mono.length / sampleRate;
    if (mono.length > maxSec * sampleRate) mono = mono.subarray(0, Math.floor(maxSec * sampleRate));
    var f = Math.max(1, Math.floor(sampleRate / 11025)), x = decimate(mono, f), sr = sampleRate / f;
    var res = { duration: duration, analyzedSeconds: x.length / sr, bpm: null, bpmStrength: 0, key: null };
    var b = estimateBpm(x, sr);
    if (b) { res.bpm = Math.round(b.bpm * 10) / 10; res.bpmStrength = b.strength; }
    var ch = chromaHistogram(x, sr);
    if (ch.frames >= 4) {
      var k = KeyDetect.fromHistogram(ch.hist);
      if (k) { k.histogram = ch.hist; res.key = k; }
    }
    return res;
  }

  return { analyze: analyze, estimateBpm: estimateBpm };
});
