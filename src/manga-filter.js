/*
 * Filtro "fumetto" per immagini: stile cartoon a colori, stile neon (nero, viola, fucsia) e manga a retino.
 * È un filtro grafico che gira sul tuo dispositivo, NON un'intelligenza artificiale:
 * non ridisegna il volto, non crea personaggi 3D e non anima nulla.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MangaFilter = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function luminance(d, w, h) {
    var g = new Float32Array(w * h);
    for (var i = 0; i < w * h; i++) g[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
    return g;
  }

  function blur3(g, w, h) {
    var o = new Float32Array(g.length);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var s = 0, c = 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        s += g[yy * w + xx]; c++;
      }
      o[y * w + x] = s / c;
    }
    return o;
  }

  function sobel(g, w, h) {
    var e = new Float32Array(g.length);
    for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) {
      var i = y * w + x;
      var gx = -g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1] + g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1];
      var gy = -g[i - w - 1] - 2 * g[i - w] - g[i - w + 1] + g[i + w - 1] + 2 * g[i + w] + g[i + w + 1];
      e[i] = Math.sqrt(gx * gx + gy * gy);
    }
    return e;
  }


  // Leviga i colori mantenendo i contorni (filtro bilaterale semplificato).
  function smoothColors(d, w, h, passes) {
    var cur = new Float32Array(w * h * 3), nxt = new Float32Array(w * h * 3), i, p;
    for (i = 0; i < w * h; i++) { cur[i * 3] = d[i * 4]; cur[i * 3 + 1] = d[i * 4 + 1]; cur[i * 3 + 2] = d[i * 4 + 2]; }
    var R = 2, sigmaC = 38;
    for (p = 0; p < passes; p++) {
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var i0 = (y * w + x) * 3, sr = 0, sg = 0, sb = 0, sw = 0;
        var r0 = cur[i0], g0 = cur[i0 + 1], b0 = cur[i0 + 2];
        for (var dy = -R; dy <= R; dy++) {
          var yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (var dx = -R; dx <= R; dx++) {
            var xx = x + dx; if (xx < 0 || xx >= w) continue;
            var j = (yy * w + xx) * 3;
            var dr = cur[j] - r0, dg = cur[j + 1] - g0, db = cur[j + 2] - b0;
            var dist = (dr * dr + dg * dg + db * db) / (sigmaC * sigmaC);
            var wt = 1 / (1 + dist) / (1 + 0.35 * (dx * dx + dy * dy));
            sr += cur[j] * wt; sg += cur[j + 1] * wt; sb += cur[j + 2] * wt; sw += wt;
          }
        }
        nxt[i0] = sr / sw; nxt[i0 + 1] = sg / sw; nxt[i0 + 2] = sb / sw;
      }
      var t = cur; cur = nxt; nxt = t;
    }
    return cur;
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), df = mx - mn, hh = 0;
    if (df > 0) {
      if (mx === r) hh = ((g - b) / df) % 6; else if (mx === g) hh = (b - r) / df + 2; else hh = (r - g) / df + 4;
      hh *= 60; if (hh < 0) hh += 360;
    }
    return [hh, mx === 0 ? 0 : df / mx, mx];
  }
  function hsvToRgb(h, s, v) {
    var c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }

  var NEON = [[0, [7, 3, 15]], [0.3, [58, 20, 120]], [0.6, [190, 38, 211]], [0.85, [255, 77, 184]], [1, [255, 232, 247]]];
  function neonColor(v) {
    for (var i = 1; i < NEON.length; i++) {
      if (v <= NEON[i][0]) {
        var a = NEON[i - 1], b = NEON[i], u = (v - a[0]) / (b[0] - a[0]);
        return [0, 1, 2].map(function (c) { return Math.round(a[1][c] + (b[1][c] - a[1][c]) * u); });
      }
    }
    return NEON[NEON.length - 1][1];
  }

  function cartoon(img, opts, neon) {
    var w = img.width, h = img.height, d = img.data;
    var detail = opts.detail == null ? 0.5 : Math.max(0, Math.min(1, opts.detail));
    var sm = smoothColors(d, w, h, 2);
    var lum = new Float32Array(w * h), i;
    for (i = 0; i < w * h; i++) lum[i] = (0.299 * sm[i * 3] + 0.587 * sm[i * 3 + 1] + 0.114 * sm[i * 3 + 2]) / 255;
    // Contorni sui tre canali colore (non solo sulla luminosità): due colori diversi ma ugualmente chiari hanno comunque un bordo.
    var edges = sobel(lum, w, h), ch = new Float32Array(w * h), c, e2;
    for (c = 0; c < 3; c++) {
      for (i = 0; i < w * h; i++) ch[i] = sm[i * 3 + c] / 255;
      e2 = sobel(ch, w, h);
      for (i = 0; i < w * h; i++) if (e2[i] > edges[i]) edges[i] = e2[i];
    }
    var thr = 0.5 - 0.4 * detail;
    var ink = new Uint8Array(w * h);
    for (i = 0; i < w * h; i++) ink[i] = edges[i] > thr ? 1 : 0;
    var thick = Math.max(w, h) > 500 ? 1 : 0, ink2 = ink;
    if (thick) {
      ink2 = new Uint8Array(w * h);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var on = 0;
        for (var dy = -1; dy <= 1 && !on; dy++) for (var dx = -1; dx <= 1; dx++) {
          var xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && ink[yy * w + xx]) { on = 1; break; }
        }
        ink2[y * w + x] = on;
      }
    }
    for (i = 0; i < w * h; i++) {
      var p = i * 4, rgb;
      if (ink2[i]) rgb = [16, 6, 28];
      else if (neon) {
        var q = Math.round(lum[i] * 6) / 6; // pochi livelli di luce, effetto "stampa"
        rgb = neonColor(Math.min(1, q));
      } else {
        var hsv = rgbToHsv(sm[i * 3], sm[i * 3 + 1], sm[i * 3 + 2]);
        var v = Math.round(hsv[2] * 4) / 4, sat = Math.min(1, Math.round(Math.min(1, hsv[1] * 1.3) * 5) / 5);
        rgb = hsvToRgb(hsv[0], sat, Math.max(0.12, v));
      }
      d[p] = rgb[0]; d[p + 1] = rgb[1]; d[p + 2] = rgb[2]; d[p + 3] = 255;
    }
    return img;
  }

  /**
   * Modifica i pixel sul posto.
   * @param {{data:Uint8ClampedArray|Uint8Array,width:number,height:number}} img
   * @param {{mode?:'cartoon'|'neon'|'bn', detail?:number, dot?:number}} [opts]  detail 0-1 (più alto = più linee), dot = passo del retino in pixel
   */
  function apply(img, opts) {
    opts = opts || {};
    var w = img.width, h = img.height, d = img.data;
    if (opts.mode === 'cartoon' || opts.mode === 'colore') return cartoon(img, opts, false);
    if (opts.mode === 'neon') return cartoon(img, opts, true);
    var mode = 'bn';
    var detail = opts.detail == null ? 0.5 : Math.max(0, Math.min(1, opts.detail));
    var dot = opts.dot || Math.max(4, Math.round(Math.min(w, h) / 120));
    var g = blur3(luminance(d, w, h), w, h);
    var edges = sobel(g, w, h);
    var edgeThr = 0.75 - 0.6 * detail;
    var orig = mode === 'colore' ? new Uint8ClampedArray(d) : null;

    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = y * w + x, p = i * 4;
      var tone = g[i];
      var ink = edges[i] > edgeThr;
      if (mode === 'bn') {
        // Retino a 45 gradi: più scuro il tono, più grande il punto
        var u = (x + y) * 0.7071, v = (x - y) * 0.7071;
        var fu = ((u % dot) + dot) % dot - dot / 2, fv = ((v % dot) + dot) % dot - dot / 2;
        var dist = Math.sqrt(fu * fu + fv * fv) / (dot / 2);
        var dark = 1 - tone;
        var black;
        if (tone > 0.82) black = false;
        else if (tone < 0.18) black = true;
        else black = dist < Math.sqrt(dark) * 1.05;
        var val = (ink || black) ? 0 : 255;
        d[p] = d[p + 1] = d[p + 2] = val;
      } else {
        // Colori ridotti a pochi livelli, linee nere
        var levels = 5;
        for (var c = 0; c < 3; c++) {
          var q = Math.round(orig[p + c] / 255 * (levels - 1)) / (levels - 1);
          d[p + c] = ink ? 15 : Math.round(q * 255);
        }
      }
      d[p + 3] = 255;
    }
    return img;
  }

  return { apply: apply };
});
