/*
 * Autotune (correzione dell'intonazione) con la tecnica PSOLA.
 *
 * 1. Si misura l'altezza della voce nel tempo (AudioAnalysis).
 * 2. Per ogni istante si sceglie la nota "giusta" più vicina nella scala scelta.
 * 3. Si calcola di quanto spostare l'altezza (intensità e velocità regolabili).
 * 4. Si ricostruisce il suono ritagliando e risommando piccoli frammenti
 *    sincronizzati con il periodo della voce, così il timbro resta quasi uguale.
 *
 * Le parti senza nota chiara (consonanti, respiri, silenzi) non vengono toccate.
 * Qualità: adatta a una bozza e a un effetto autotune. Su voci con rumore,
 * musica sotto o molti armonici la stima dell'altezza può sbagliare.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(typeof require === 'function' ? require('./audio-analysis.js') : root.AudioAnalysis);
  else root.Autotune = factory(root.AudioAnalysis);
})(typeof self !== 'undefined' ? self : this, function (AudioAnalysis) {
  'use strict';

  var STEPS = { maggiore: [0, 2, 4, 5, 7, 9, 11], minore: [0, 2, 3, 5, 7, 8, 10] };

  function scaleMask(tonic, mode) {
    var mask = new Array(12).fill(false);
    if (mode === 'cromatica' || !STEPS[mode]) { return mask.fill(true); }
    STEPS[mode].forEach(function (s) { mask[(tonic + s) % 12] = true; });
    return mask;
  }

  // Nota ammessa più vicina (in semitoni, può essere decimale se la scala è cromatica).
  function quantizeMidi(m, mask) {
    var base = Math.round(m);
    var best = null, bestD = Infinity;
    for (var d = -3; d <= 3; d++) {
      var cand = base + d;
      if (!mask[((cand % 12) + 12) % 12]) continue;
      var dist = Math.abs(cand - m);
      if (dist < bestD) { bestD = dist; best = cand; }
    }
    return best === null ? m : best;
  }

  function medianN(a, n) {
    var h = (n - 1) >> 1;
    return a.map(function (v, i) {
      var w = a.slice(Math.max(0, i - h), Math.min(a.length, i + h + 1)).sort(function (p, q) { return p - q; });
      return w[w.length >> 1];
    });
  }

  // Sale di "gradini" della scala a partire da una nota ammessa.
  function stepUp(m, steps, mask) {
    var cur = m;
    for (var s = 0; s < steps; s++) {
      do { cur += 1; } while (!mask[((cur % 12) + 12) % 12]);
    }
    return cur;
  }

  function median3(a) {
    return a.map(function (v, i) {
      var x = [a[Math.max(0, i - 1)], v, a[Math.min(a.length - 1, i + 1)]].sort(function (p, q) { return p - q; });
      return x[1];
    });
  }

  function mixToMono(ch) {
    if (!Array.isArray(ch)) return ch;
    if (ch.length === 1) return ch[0];
    var out = new Float32Array(ch[0].length);
    for (var c = 0; c < ch.length; c++) for (var i = 0; i < out.length; i++) out[i] += ch[c][i] / ch.length;
    return out;
  }

  /**
   * @param {Float32Array|Float32Array[]} input
   * @param {number} sr
   * @param {{tonic?:number, mode?:string, strength?:number, retuneMs?:number, maxSeconds?:number, analysis?:object}} [opts]
   */
  function correct(input, sr, opts) {
    opts = opts || {};
    var strength = opts.strength == null ? 1 : Math.max(0, Math.min(1, opts.strength));
    var retuneMs = opts.retuneMs == null ? 30 : Math.max(0, opts.retuneMs);
    var mask = scaleMask(opts.tonic || 0, opts.mode || 'cromatica');
    var maxSeconds = opts.maxSeconds || 120;
    var keep = opts.vibrato == null ? 0 : Math.max(0, Math.min(1, opts.vibrato)); // quanto vibrato naturale conservare
    var degrees = opts.harmonyDegrees || 0;                                     // armonia: gradini della scala sopra la nota
    var shift = Math.max(-12, Math.min(12, opts.shiftSemitones || 0));          // spostamento creativo della voce
    var notes = Array.isArray(opts.notes) ? opts.notes : null;   // note modificate a mano: {t0,t1,target,amount}
    var notesOnly = notes ? opts.notesOnly !== false : false;    // fuori dalle note non si tocca nulla
    function noteAt(t) {
      if (!notes) return null;
      for (var q = 0; q < notes.length; q++) if (t >= notes[q].t0 && t < notes[q].t1) return notes[q];
      return null;
    }
    // Restituisce {target, amt}: nota voluta (in semitoni MIDI) e quanto applicarla (0-1)
    function targetOf(m, t) {
      var nt = noteAt(t);
      if (nt) return { target: nt.target + (degrees ? stepUp(Math.round(nt.target), degrees, mask) - Math.round(nt.target) : 0) + shift, amt: nt.amount == null ? 1 : Math.max(0, Math.min(1, nt.amount)) };
      if (notesOnly) return { target: m, amt: 0 };
      var q = quantizeMidi(m, mask);
      return { target: (degrees ? stepUp(q, degrees, mask) : q) + shift, amt: 1 };
    }

    var mono = mixToMono(input);
    if (mono.length > maxSeconds * sr) mono = mono.subarray(0, Math.floor(maxSeconds * sr));
    var x = mono;
    var out = new Float32Array(x.length);
    out.set(x);

    var stats = { runs: 0, correctedSeconds: 0, meanShiftCents: 0, maxShiftCents: 0 };
    if (strength === 0 || x.length < sr * 0.2) return { samples: out, stats: stats };

    var res = opts.analysis && opts.analysis.frames && opts.analysis.analyzedDuration >= x.length / sr - 0.05
      ? opts.analysis
      : AudioAnalysis.analyze(x, sr, { maxSeconds: maxSeconds });
    var frames = res.frames, half = res.frameSeconds / 2, hop = res.hopSeconds;

    // Gruppi di frame consecutivi con una nota chiara
    var runs = [], cur = null;
    frames.forEach(function (f, i) {
      if (f.voiced) { if (!cur) { cur = []; runs.push(cur); } cur.push(i); } else cur = null;
    });

    var shiftSum = 0, shiftN = 0;
    runs.forEach(function (idx) {
      if (idx.length < 3) return;
      var midi = median3(idx.map(function (i) { return 69 + 12 * Math.log(frames[i].f0 / 440) / Math.LN2; }));
      var slow = medianN(midi, 5);
      var times = idx.map(function (i) { return frames[i].t + half; });
      // Spostamento voluto in centesimi, con ammorbidimento (velocità di ritocco)
      var alpha = retuneMs <= 0 ? 1 : 1 - Math.exp(-hop / (retuneMs / 1000));
      var delta = [], prev = null;
      midi.forEach(function (m, k) {
        var fast = m - slow[k];
        var tg = targetOf(slow[k], times[k]);
        var want = ((tg.target - slow[k]) - (1 - keep) * fast) * 100 * strength * tg.amt;
        want = Math.max(-1200, Math.min(1200, want));
        prev = prev === null ? want : prev + alpha * (want - prev);
        delta.push(prev);
      });

      if (delta.every(function (d) { return Math.abs(d) < 0.5; })) return; // già a posto: non si tocca

      function interp(arr, t) {
        if (t <= times[0]) return arr[0];
        if (t >= times[times.length - 1]) return arr[arr.length - 1];
        var lo = 0, hi = times.length - 1;
        while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid; else hi = mid; }
        var u = (t - times[lo]) / (times[hi] - times[lo]);
        return arr[lo] + (arr[hi] - arr[lo]) * u;
      }
      function periodAt(sample) { var f0 = Math.pow(2, (interp(midi, sample / sr) - 69) / 12) * 440; return sr / f0; }
      function ratioAt(sample) { return Math.pow(2, interp(delta, sample / sr) / 1200); }

      var s0 = Math.max(0, Math.floor((times[0] - hop / 2) * sr));
      var s1 = Math.min(x.length - 1, Math.ceil((times[times.length - 1] + hop / 2) * sr));
      if (s1 - s0 < sr * 0.05) return;

      // Punti di riferimento sincronizzati con il periodo
      var marks = [];
      var T0 = periodAt(s0), best = s0, bv = -Infinity, n;
      for (n = s0; n < Math.min(s1, s0 + Math.ceil(T0)); n++) if (x[n] > bv) { bv = x[n]; best = n; }
      marks.push(best);
      while (true) {
        var last = marks[marks.length - 1], T = periodAt(last);
        var pred = last + T;
        if (pred >= s1) break;
        var w = Math.max(1, Math.floor(T * 0.2)), b2 = Math.round(pred), v2 = -Infinity;
        for (n = Math.max(last + 1, Math.round(pred) - w); n <= Math.min(s1, Math.round(pred) + w); n++) if (x[n] > v2) { v2 = x[n]; b2 = n; }
        marks.push(b2);
      }
      if (marks.length < 4) return;

      var len = s1 - s0 + 1;
      var acc = new Float32Array(len), wgt = new Float32Array(len);
      var j = 0, ts = marks[0];
      while (ts < s1) {
        while (j + 1 < marks.length && Math.abs(marks[j + 1] - ts) <= Math.abs(marks[j] - ts)) j++;
        var m = marks[j];
        var L = Math.max(8, Math.round(periodAt(m)));
        for (var k = -L; k <= L; k++) {
          var src = m + k, dst = Math.round(ts) + k;
          if (src < 0 || src >= x.length || dst < s0 || dst > s1) continue;
          var win = 0.5 * (1 + Math.cos(Math.PI * k / L));
          acc[dst - s0] += x[src] * win;
          wgt[dst - s0] += win;
        }
        var r = ratioAt(ts);
        ts += periodAt(ts) / r;
        shiftSum += Math.abs(interp(delta, ts / sr)); shiftN++;
        if (Math.abs(interp(delta, ts / sr)) > stats.maxShiftCents) stats.maxShiftCents = Math.abs(interp(delta, ts / sr));
      }

      // Rimescolamento con l'originale ai bordi per evitare scatti
      var fade = Math.round(sr * 0.012);
      for (n = 0; n < len; n++) {
        var wv = wgt[n];
        if (wv < 0.15) continue;
        var y = acc[n] / wv;
        var g = Math.min(1, n / fade, (len - 1 - n) / fade, wv / 0.5);
        out[s0 + n] = x[s0 + n] * (1 - g) + y * g;
      }
      stats.runs++;
      stats.correctedSeconds += len / sr;
    });
    stats.meanShiftCents = shiftN ? shiftSum / shiftN : 0;

    // Evita valori fuori scala
    var peak = 0, i2;
    for (i2 = 0; i2 < out.length; i2++) { var a = Math.abs(out[i2]); if (a > peak) peak = a; }
    if (peak > 0.99) { var gk = 0.99 / peak; for (i2 = 0; i2 < out.length; i2++) out[i2] *= gk; }
    return { samples: out, stats: stats };
  }

  return { correct: correct, scaleMask: scaleMask, quantizeMidi: quantizeMidi, stepUp: stepUp };
});
