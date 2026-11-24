/*
 * Catena di master: filtro sui bassi, correzione di tono leggera, compressione "colla",
 * saturazione morbida, regolazione del volume medio e limitatore sul picco.
 * Serve a far suonare la base (o il mix con la voce) più piena e a volume da ascolto reale.
 * Non cambia note né ritmo. Il risultato è misurato: picco e volume medio in dB.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./polish.js'));
  else root.Master = factory(root.Polish);
})(typeof self !== 'undefined' ? self : this, function (Polish) {
  'use strict';

  // rms = volume medio di arrivo (dBFS), ceil = picco massimo (dBFS), drive = saturazione
  var PRESETS = {
    morbido: { label: 'Morbido', rms: -17, ceil: -1.0, drive: 1.0, comp: { thresholdDb: -20, ratio: 1.8 } },
    standard: { label: 'Standard', rms: -14, ceil: -1.0, drive: 1.4, comp: { thresholdDb: -22, ratio: 2.4 } },
    forte: { label: 'Forte', rms: -11, ceil: -0.8, drive: 2.0, comp: { thresholdDb: -24, ratio: 3.2 } }
  };

  function rmsDb(x) {
    var s = 0, n = 0; for (var i = 0; i < x.length; i += 2) { s += x[i] * x[i]; n++; }
    return n ? 10 * Math.log(Math.max(s / n, 1e-12)) / Math.LN10 : -120;
  }
  function peakDb(x) {
    var p = 0; for (var i = 0; i < x.length; i++) { var a = x[i] < 0 ? -x[i] : x[i]; if (a > p) p = a; }
    return 20 * Math.log(Math.max(p, 1e-9)) / Math.LN10;
  }
  function limit(x, sr, ceilLin) {
    var look = Math.max(1, Math.round(0.005 * sr)), rel = Math.exp(-1 / (sr * 0.08)), n = x.length, y = new Float32Array(n), g = 1, maxRed = 0;
    // massimo mobile del picco sulla finestra di anticipo
    var need = new Float32Array(n);
    for (var i = 0; i < n; i++) { var a = x[i] < 0 ? -x[i] : x[i]; need[i] = a > ceilLin ? ceilLin / a : 1; }
    var dq = [], lo = new Float32Array(n);
    for (i = 0; i < n + look; i++) { // minimo di need su [i-look, i]
      if (i < n) { while (dq.length && need[dq[dq.length - 1]] >= need[i]) dq.pop(); dq.push(i); }
      while (dq.length && dq[0] < i - look) dq.shift();
      if (i - look >= 0 && i - look < n) lo[i - look] = need[dq[0]];
    }
    for (i = 0; i < n; i++) {
      var t = lo[i];
      g = t < g ? t : t + (g - t) * rel; // attacco immediato, rilascio dolce
      if (g > 1) g = 1;
      y[i] = x[i] * g; if (1 - g > maxRed) maxRed = 1 - g;
    }
    // sicurezza finale: nessun campione oltre il tetto
    for (i = 0; i < n; i++) { if (y[i] > ceilLin) y[i] = ceilLin; else if (y[i] < -ceilLin) y[i] = -ceilLin; }
    return { y: y, maxRedDb: maxRed > 0 ? -20 * Math.log(1 - maxRed) / Math.LN10 : 0 };
  }

  /** @returns {{samples:Float32Array, report:{preset:string,inPeakDb:number,inRmsDb:number,peakDb:number,rmsDb:number,gainDb:number,limiterDb:number}}} */
  function process(x, sr, presetName) {
    var P = PRESETS[presetName] || PRESETS.standard;
    var inPeak = peakDb(x), inRms = rmsDb(x);
    if (!x.length || inPeak < -80) return { samples: x, report: { preset: presetName, inPeakDb: inPeak, inRmsDb: inRms, peakDb: inPeak, rmsDb: inRms, gainDb: 0, limiterDb: 0 } };
    var y = Polish.highpass(x, sr, 28);
    y = Polish.peaking(y, sr, 60, 1.2, 0.9);
    y = Polish.peaking(y, sr, 320, -1.5, 0.9);
    y = Polish.highShelf(y, sr, 8000, 1.2);
    y = Polish.compress(y, sr, { thresholdDb: P.comp.thresholdDb, ratio: P.comp.ratio, attackMs: 22, releaseMs: 160, makeupDb: 2 });
    // saturazione morbida: normalizza prima per usare sempre la stessa curva
    var pk = Math.pow(10, peakDb(y) / 20), k = 0.9 / Math.max(pk, 1e-6), d = P.drive, i, norm = Math.tanh(d);
    for (i = 0; i < y.length; i++) y[i] = Math.tanh(y[i] * k * d) / norm;
    // volume medio verso il bersaglio (al massimo +18 dB e -18 dB)
    var gain = Math.max(-18, Math.min(18, P.rms - rmsDb(y)));
    var lin = Math.pow(10, gain / 20); for (i = 0; i < y.length; i++) y[i] *= lin;
    var L = limit(y, sr, Math.pow(10, P.ceil / 20));
    return { samples: L.y, report: { preset: presetName, inPeakDb: inPeak, inRmsDb: inRms, peakDb: peakDb(L.y), rmsDb: rmsDb(L.y), gainDb: gain, limiterDb: L.maxRedDb } };
  }

  return { process: process, PRESETS: PRESETS, rmsDb: rmsDb, peakDb: peakDb };
});
