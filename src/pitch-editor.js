/*
 * Editor delle note (stile "piano roll"): divide la voce misurata in note singole
 * e prepara le note da passare all'autotune. Ogni nota ha:
 *   midi    nota cantata (misurata, mediana dei frame, può essere decimale)
 *   target  nota voluta (modificabile)
 *   amount  quanto correggere questa nota (0 = lasciala com'è, 1 = tutta)
 * La divisione in note è una stima: scivolate e vibrati larghi possono essere
 * spezzati o uniti nel modo sbagliato. Le note si possono sempre correggere a mano.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(typeof require === 'function' ? require('./autotune.js') : root.Autotune);
  else root.PitchEditor = factory(root.Autotune);
})(typeof self !== 'undefined' ? self : this, function (Autotune) {
  'use strict';

  function median(a) { var b = a.slice().sort(function (x, y) { return x - y; }); return b[b.length >> 1]; }
  function toMidi(f) { return 69 + 12 * Math.log(f / 440) / Math.LN2; }

  // Nota ammessa più vicina nella scala (cromatica = intero più vicino)
  function snap(midi, tonic, mode) {
    var mask = Autotune.scaleMask(tonic || 0, mode || 'cromatica');
    if (mode === 'cromatica' || !mode) return Math.round(midi);
    return Autotune.quantizeMidi(midi, mask);
  }

  /**
   * @param {object} analysis  risultato di AudioAnalysis.analyze
   * @param {{tonic?:number, mode?:string, minSeconds?:number, jump?:number}} [opts]
   */
  function segment(analysis, opts) {
    opts = opts || {};
    var frames = analysis.frames, fs = analysis.frameSeconds, hop = analysis.hopSeconds;
    var minLen = opts.minSeconds == null ? 0.07 : opts.minSeconds, jump = opts.jump || 0.75;
    var notes = [], i = 0;
    while (i < frames.length) {
      if (!frames[i].voiced) { i++; continue; }
      var j = i; while (j + 1 < frames.length && frames[j + 1].voiced) j++;
      // dentro la sequenza continua: nuova nota quando l'altezza si sposta e resta spostata
      var cur = { s: i, vals: [toMidi(frames[i].f0)] }, pending = [];
      for (var k = i + 1; k <= j; k++) {
        var m = toMidi(frames[k].f0), ref = median(cur.vals);
        if (Math.abs(m - ref) > jump) {
          pending.push(k);
          if (pending.length >= 3) {
            var cut = pending[0];
            notes.push({ a: cur.s, b: cut - 1, vals: cur.vals.slice(0, cut - cur.s) });
            cur = { s: cut, vals: pending.map(function (p) { return toMidi(frames[p].f0); }) }; pending = [];
          }
        } else {
          if (pending.length) { pending.forEach(function (p) { cur.vals.push(toMidi(frames[p].f0)); }); pending = []; }
          cur.vals.push(m);
        }
      }
      pending.forEach(function (p) { cur.vals.push(toMidi(frames[p].f0)); });
      notes.push({ a: cur.s, b: j, vals: cur.vals });
      i = j + 1;
    }
    var out = [];
    notes.forEach(function (n) {
      var t0 = frames[n.a].t, t1 = frames[n.b].t + hop;
      if (t1 - t0 < minLen || !n.vals.length) return;
      var mid = median(n.vals);
      out.push({ id: 'n' + out.length, t0: t0, t1: t1, midi: mid, target: snap(mid, opts.tonic, opts.mode), amount: 1, edited: false });
    });
    return out;
  }

  // Ricalcola le note non modificate a mano dopo un cambio di scala
  function resnap(notes, tonic, mode) {
    notes.forEach(function (n) { if (!n.edited) n.target = snap(n.midi, tonic, mode); });
    return notes;
  }

  // Di quanto è fuori nota (in centesimi, con segno) ogni nota rispetto al suo target
  function offsetCents(n) { return (n.midi - n.target) * 100; }

  return { segment: segment, snap: snap, resnap: resnap, offsetCents: offsetCents };
});
