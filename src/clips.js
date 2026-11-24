/*
 * Clip della voce: montaggio non distruttivo come nei DAW (Pro Tools, Logic).
 * Una clip = un pezzo di una prova (take) messo in un punto della canzone:
 *   {take, start (s nella canzone), offset (s dentro la prova), len (s), gain (lineare), fadeIn, fadeOut (s)}
 * Le prove non si toccano mai: render() costruisce l'audio della traccia voce leggendo i pezzi.
 * Dove due clip si toccano si fa una dissolvenza incrociata (niente click).
 * Comping per righe: per ogni riga del testo scegli la prova migliore; le clip nascono già tagliate sulle battute della riga.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Clips = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var XF = 0.015; // 15 ms di dissolvenza minima ai bordi (anti-click)

  function clip(o) {
    return { id: o.id || ('c' + Math.random().toString(36).slice(2, 8)), take: o.take, start: Math.max(0, +o.start || 0), offset: Math.max(0, +o.offset || 0),
      len: Math.max(0.02, +o.len || 0.02), gain: o.gain == null ? 1 : Math.max(0, Math.min(4, +o.gain)), fadeIn: Math.max(0, +o.fadeIn || 0), fadeOut: Math.max(0, +o.fadeOut || 0) };
  }
  /** Una clip che copre tutta la prova (come si comporta oggi lo Studio). lat = ritardo misurato della registrazione. */
  function whole(take, lat) {
    var dur = take.mono.length / take.sr, off = Math.max(0, lat || 0);
    return clip({ take: take.id, start: Math.max(0, -(lat || 0)), offset: off, len: Math.max(0.02, dur - off) });
  }
  /** Divide una clip al tempo t (canzone). Ritorna [sinistra, destra] o null se t è fuori. */
  function split(c, t) {
    if (t <= c.start + 0.02 || t >= c.start + c.len - 0.02) return null;
    var a = clip(Object.assign({}, c, { id: null, len: t - c.start, fadeOut: XF })), d = t - c.start;
    var b = clip(Object.assign({}, c, { id: null, start: t, offset: c.offset + d, len: c.len - d, fadeIn: XF }));
    return [a, b];
  }
  /** Comping: lines = [{start, end}] (s), choice[i] = id della prova per la riga i (o null = nessuna). */
  function compByLines(lines, choice, takes, lat) {
    var out = [];
    lines.forEach(function (ln, i) {
      var id = choice[i]; if (!id) return;
      var t = takes.filter(function (x) { return x.id === id; })[0]; if (!t) return;
      var l = (lat && lat[id]) || 0, pre = 0.12; // un respiro prima della riga
      var st = Math.max(0, ln.start - pre), en = ln.end;
      out.push(clip({ take: id, start: st, offset: Math.max(0, st + l), len: en - st, fadeIn: 0.03, fadeOut: 0.06 }));
    });
    return out;
  }
  /** Costruisce l'audio della traccia (sr di uscita, durata in s). takes: {id: {x (Float32Array), sr}}. */
  function render(clips, takes, sr, dur) {
    var n = Math.ceil(dur * sr), y = new Float32Array(n);
    clips.forEach(function (c) {
      var t = takes[c.take]; if (!t) return;
      var s0 = Math.round(c.start * sr), m = Math.round(c.len * sr), ratio = t.sr / sr;
      var fi = Math.max(Math.round(XF * sr), Math.round(c.fadeIn * sr)), fo = Math.max(Math.round(XF * sr), Math.round(c.fadeOut * sr));
      for (var i = 0; i < m; i++) {
        var o = s0 + i; if (o < 0 || o >= n) continue;
        var pos = (c.offset * sr + i) * ratio, k = Math.floor(pos), f = pos - k; if (k + 1 >= t.x.length) break;
        var v = t.x[k] * (1 - f) + t.x[k + 1] * f, g = c.gain;
        if (i < fi) g *= i / fi; if (m - i < fo) g *= (m - i) / fo;
        y[o] += v * g;
      }
    });
    return y;
  }
  function end(clips) { return clips.reduce(function (a, c) { return Math.max(a, c.start + c.len); }, 0); }
  return { XF: XF, clip: clip, whole: whole, split: split, compByLines: compByLines, render: render, end: end };
});
