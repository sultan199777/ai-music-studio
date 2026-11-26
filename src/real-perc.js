/*
 * Suoni VERI registrati (non sintetizzati): battiti di mani, hi-hat, rullanti, rimshot, shaker, tamburello, conga, bongo,
 * cajón, campanaccio, claves, tom, grancassa, piatto, piatto che sale, mare (ocean drum).
 * Fonte: VCSL e VSCO-2-CE di Versilian Studios, licenza CC0 (liberi anche per vendere). File: inst/realperc.json (~0,7 MB),
 * scaricato una volta. Finché non è carico, l'app usa i suoni sintetici di prima (nessun errore).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RealPerc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var STEP = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767];
  var IDX = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];
  function b64(s) { if (typeof atob === 'function') { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; } return new Uint8Array(Buffer.from(s, 'base64')); }
  /* ADPCM IMA a 4 bit → float (stesso formato di tools/build-instruments.py) */
  function ima(bytes, n) {
    var out = new Float32Array(n), pred = 0, idx = 0;
    for (var i = 0; i < n; i++) {
      var code = (bytes[i >> 1] >> ((i & 1) * 4)) & 15, step = STEP[idx], diff = step >> 3;
      if (code & 4) diff += step; if (code & 2) diff += step >> 1; if (code & 1) diff += step >> 2;
      pred += (code & 8) ? -diff : diff; if (pred > 32767) pred = 32767; else if (pred < -32768) pred = -32768;
      idx += IDX[code]; if (idx < 0) idx = 0; else if (idx > 88) idx = 88; out[i] = pred / 32768;
    }
    return out;
  }
  var S = { data: null, sr: 22050, loading: null, cache: {} };
  function fromJSON(j) { var d = {}; Object.keys(j.hits || {}).forEach(function (k) { d[k] = j.hits[k].map(function (h) { return ima(b64(h.d), h.n); }); }); S.data = d; S.sr = j.sr || 22050; return d; }
  function load(url) { if (S.data) return Promise.resolve(S.data); if (S.loading) return S.loading; S.loading = fetch(url || 'inst/realperc.json').then(function (r) { if (!r.ok) throw new Error('realperc ' + r.status); return r.json(); }).then(fromJSON).catch(function () { S.loading = null; return null; }); return S.loading; }
  function ready() { return !!S.data; }
  function has(id) { return !!(S.data && S.data[id] && S.data[id].length); }
  /** Un colpo vero (variante i) alla frequenza di campionamento sr, con guadagno g e intonazione (semitoni) facoltativa. */
  function hit(id, sr, i, g, semi) {
    if (!has(id)) return null; var L = S.data[id], x = L[((i || 0) % L.length + L.length) % L.length], key = id + '|' + i + '|' + sr + '|' + (semi || 0);
    if (!S.cache[key]) {
      var ratio = S.sr / sr * Math.pow(2, (semi || 0) / 12), n = Math.floor(x.length / ratio), y = new Float32Array(n);
      for (var k = 0; k < n; k++) { var p = k * ratio, j = Math.floor(p), f = p - j; y[k] = (x[j] || 0) * (1 - f) + (x[j + 1] || 0) * f; }
      var keys = Object.keys(S.cache); if (keys.length > 120) delete S.cache[keys[0]]; S.cache[key] = y;
    }
    var c = S.cache[key]; if (g == null || g === 1) return c; var o = new Float32Array(c.length); for (var q = 0; q < c.length; q++) o[q] = c[q] * g; return o;
  }
  /** Suono lungo (mare, piatto che sale): ripetuto con dissolvenza fino a «sec» secondi. */
  function bed(id, sr, sec, i) {
    var x = hit(id, sr, i || 0); if (!x) return null; var n = Math.round(sec * sr), y = new Float32Array(n), fade = Math.min(Math.round(0.5 * sr), x.length >> 2), pos = 0;
    while (pos < n) { for (var k = 0; k < x.length && pos + k < n; k++) { var w = 1; if (pos > 0 && k < fade) w = k / fade; if (k > x.length - fade) w = Math.min(w, (x.length - k) / fade); y[pos + k] += x[k] * w; } pos += x.length - fade; }
    return y;
  }
  return { load: load, fromJSON: fromJSON, ready: ready, has: has, hit: hit, bed: bed, ima: ima };
});
