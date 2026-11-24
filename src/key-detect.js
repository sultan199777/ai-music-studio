/*
 * Riconoscimento della tonalità dalla voce (stima).
 * Metodo: istogramma delle 12 note (senza ottava) pesato sul tempo, confrontato
 * con i profili di Krumhansl-Kessler per le 12 tonalità maggiori e le 12 minori.
 * È una STIMA: tonalità maggiore e minore relativa (Do maggiore / La minore)
 * si confondono spesso, per questo restituisce anche la seconda scelta.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KeyDetect = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
  var MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  var MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

  function pearson(a, b) {
    var n = a.length, ma = 0, mb = 0, i;
    for (i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
    ma /= n; mb /= n;
    var num = 0, da = 0, db = 0;
    for (i = 0; i < n; i++) {
      num += (a[i] - ma) * (b[i] - mb);
      da += (a[i] - ma) * (a[i] - ma);
      db += (b[i] - mb) * (b[i] - mb);
    }
    return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
  }

  function fromHistogram(hist) {
    var total = hist.reduce(function (a, b) { return a + b; }, 0);
    if (total <= 0) return null;
    var scores = [];
    for (var tonic = 0; tonic < 12; tonic++) {
      var maj = [], min = [];
      for (var i = 0; i < 12; i++) { maj.push(MAJOR[(i - tonic + 12) % 12]); min.push(MINOR[(i - tonic + 12) % 12]); }
      scores.push({ tonic: tonic, mode: 'maggiore', r: pearson(hist, maj) });
      scores.push({ tonic: tonic, mode: 'minore', r: pearson(hist, min) });
    }
    scores.sort(function (a, b) { return b.r - a.r; });
    var best = scores[0], second = scores[1];
    var used = hist.filter(function (v) { return v / total > 0.03; }).length;
    var level = 'bassa';
    if (best.r >= 0.75 && best.r - second.r >= 0.05 && used >= 5) level = 'buona';
    else if (best.r >= 0.6 && used >= 4) level = 'media';
    var relTonic = best.mode === 'maggiore' ? (best.tonic + 9) % 12 : (best.tonic + 3) % 12, relMode = best.mode === 'maggiore' ? 'minore' : 'maggiore';
    return {
      relative: { tonic: relTonic, mode: relMode, name: NAMES[relTonic] + ' ' + relMode },
      tonic: best.tonic, mode: best.mode, name: NAMES[best.tonic] + ' ' + best.mode,
      correlation: best.r, confidence: level, notesUsed: used,
      alternative: { tonic: second.tonic, mode: second.mode, name: NAMES[second.tonic] + ' ' + second.mode, correlation: second.r }
    };
  }

  // frames: elenco di {voiced, f0}; restituisce null se la voce è troppo poca.
  function detect(frames) {
    var hist = new Array(12).fill(0), count = 0;
    frames.forEach(function (f) {
      if (!f.voiced || !(f.f0 > 0)) return;
      var midi = 69 + 12 * Math.log(f.f0 / 440) / Math.LN2;
      var pc = ((Math.round(midi) % 12) + 12) % 12;
      hist[pc] += 1; count++;
    });
    if (count < 20) return null;
    var r = fromHistogram(hist);
    if (r) r.histogram = hist;
    return r;
  }

  return { detect: detect, fromHistogram: fromHistogram, NAMES: NAMES };
});
