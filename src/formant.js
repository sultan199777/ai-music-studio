/*
 * Formant shift (cambio del TIMBRO senza cambiare la nota) con il metodo del CEPSTRUM.
 *
 * Idea: lo spettro della voce = "inviluppo" (la forma della gola e della bocca: i formanti)
 * x "armoniche" (la nota). Si stima l'inviluppo con il cepstrum (filtro sulle quefrenze
 * basse), lo si sposta in frequenza di N semitoni e si moltiplica lo spettro originale per
 * il rapporto (inviluppo spostato / inviluppo originale). Le armoniche NON si muovono,
 * quindi l'altezza resta la stessa; cambia solo il colore della voce
 * (positivo = voce più "piccola/chiara", negativo = più "grande/scura").
 *
 * Limiti onesti: oltre circa +-4 semitoni il suono diventa artificiale (stima pratica,
 * non verificata); con note molto acute (sopra ~400 Hz) l'inviluppo segue le armoniche e
 * l'effetto è meno preciso. Elaborazione offline su file (FFT 1024/2048, 75% di sovrapposizione).
 * Codice scritto da zero (nessuna libreria, nessuna licenza da rispettare).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Formant = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function fft(re, im, inverse) {
    var n = re.length, i, j, k, m, t;
    for (i = 1, j = 0; i < n; i++) {
      var bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (var len = 2; len <= n; len <<= 1) {
      var ang = 2 * Math.PI / len * (inverse ? 1 : -1), wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (k = 0; k < half; k++) {
          var a = i + k, b = a + half;
          var xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          m = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = m;
        }
      }
    }
    if (inverse) for (i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }

  /**
   * @param {Float32Array} x  mono
   * @param {number} sr
   * @param {number} semitones  spostamento dei formanti (-8..+8)
   * @param {{maxGainDb?:number, lifterMs?:number}} [o]
   * @returns {Float32Array} stessa lunghezza
   */
  function shift(x, sr, semitones, o) {
    o = o || {};
    var st = Math.max(-8, Math.min(8, +semitones || 0));
    var out = new Float32Array(x.length);
    if (Math.abs(st) < 0.01 || x.length < 512) { out.set(x); return out; }
    var alpha = Math.pow(2, st / 12);
    var N = sr > 30000 ? 2048 : 1024, hop = N >> 2, half = N >> 1;
    var maxLn = (o.maxGainDb == null ? 18 : o.maxGainDb) / 8.685889638; // dB -> logaritmo naturale
    var L = Math.max(8, Math.min(half - 1, Math.round(sr * (o.lifterMs || 2.5) / 1000)));
    var win = new Float64Array(N), i, k;
    for (i = 0; i < N; i++) win[i] = Math.sqrt(0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); // radice di Hann
    var re = new Float64Array(N), im = new Float64Array(N), cr = new Float64Array(N), ci = new Float64Array(N);
    var env = new Float64Array(half + 1), g = new Float64Array(half + 1);
    var acc = new Float64Array(x.length + N), norm = 1 / 2; // somma di win^2 con hop N/4 = 2
    for (var s = -N + hop; s < x.length; s += hop) {
      var e = 0;
      for (i = 0; i < N; i++) { var idx = s + i, v = idx >= 0 && idx < x.length ? x[idx] : 0; re[i] = v * win[i]; im[i] = 0; e += v * v; }
      if (e / N < 1e-9) { // silenzio: si copia senza filtrare
        for (i = 0; i < N; i++) { var d = s + i; if (d >= 0 && d < x.length) acc[d] += (x[d] * win[i]) * win[i] * norm; }
        continue;
      }
      fft(re, im, false);
      var mag = new Float64Array(N);
      for (k = 0; k <= half; k++) { mag[k] = Math.log(Math.sqrt(re[k] * re[k] + im[k] * im[k]) + 1e-7); if (k > 0 && k < half) mag[N - k] = mag[k]; }
      for (i = 0; i < N; i++) { cr[i] = mag[i]; ci[i] = 0; }
      fft(cr, ci, true); // cepstrum reale
      for (i = 0; i < N; i++) { var q = i <= N - i ? i : N - i; if (q > L) { cr[i] = 0; } else if (q === L) cr[i] *= 0.5; ci[i] = 0; }
      fft(cr, ci, false); // inviluppo logaritmico liscio
      for (k = 0; k <= half; k++) env[k] = cr[k];
      for (k = 0; k <= half; k++) {
        var src = k / alpha, k0 = Math.floor(src), fr = src - k0;
        var e0 = env[Math.min(half, k0)], e1 = env[Math.min(half, k0 + 1)];
        var warped = e0 + (e1 - e0) * fr, d2 = warped - env[k];
        g[k] = Math.exp(Math.max(-maxLn, Math.min(maxLn, d2)));
      }
      for (k = 0; k <= half; k++) { re[k] *= g[k]; im[k] *= g[k]; if (k > 0 && k < half) { re[N - k] = re[k]; im[N - k] = -im[k]; } }
      im[0] = 0; im[half] = 0;
      fft(re, im, true);
      for (i = 0; i < N; i++) { var dd = s + i; if (dd >= 0 && dd < x.length) acc[dd] += re[i] * win[i] * norm; }
    }
    for (i = 0; i < x.length; i++) out[i] = Number.isFinite(acc[i]) ? acc[i] : 0;
    return out;
  }

  return { shift: shift, fft: fft };
});
