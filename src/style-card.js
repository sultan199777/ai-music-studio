/*
 * Scheda di stile: misura caratteristiche GENERICHE di una canzone di riferimento
 * (tempo, peso del basso, luminosità, densità ritmica, crescita di energia)
 * e le trasforma in parametri per l'arrangiatore. Si possono mescolare più schede.
 *
 * Non copia melodie, testi, voci o suoni: legge solo numeri dall'audio che l'utente
 * carica. Sono stime da una traccia già mixata, non una trascrizione.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./base-analysis.js'));
  else root.StyleCard = factory(root.BaseAnalysis);
})(typeof self !== 'undefined' ? self : this, function (BaseAnalysis) {
  'use strict';

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function toMono(input) {
    if (!Array.isArray(input)) return input;
    var n = input[0].length, out = new Float32Array(n);
    for (var c = 0; c < input.length; c++) for (var i = 0; i < n; i++) out[i] += input[c][i] / input.length;
    return out;
  }

  /** @param {Float32Array|Float32Array[]} input @param {number} sr @param {{maxSeconds?:number,name?:string}} [opts] */
  function measure(input, sr, opts) {
    opts = opts || {};
    var mono = toMono(input), maxS = opts.maxSeconds || 90;
    if (mono.length > maxS * sr) mono = mono.subarray(0, Math.floor(maxS * sr));
    var seconds = mono.length / sr;
    var base = BaseAnalysis.analyze(mono, sr, { maxSeconds: maxS });
    var f = Math.max(1, Math.floor(sr / 11025)), n = Math.floor(mono.length / f), x = new Float32Array(n), i, j;
    for (i = 0; i < n; i++) { var s = 0; for (j = 0; j < f; j++) s += mono[i * f + j]; x[i] = s / f; }
    var r = sr / f, frame = 512, hop = 256, nf = Math.max(0, Math.floor((n - frame) / hop));
    var a = Math.exp(-2 * Math.PI * 150 / r), lp = 0, low = 0, all = 0, hi = 0, prev = 0;
    var env = new Float32Array(nf);
    for (var k = 0; k < nf; k++) {
      var e = 0;
      for (i = 0; i < frame; i++) {
        var v = x[k * hop + i]; lp = a * lp + (1 - a) * v;
        low += lp * lp; all += v * v; e += v * v; var d = v - prev; prev = v; hi += d * d;
      }
      env[k] = e / frame;
    }
    var bassShare = all > 0 ? clamp(Math.sqrt(low / all), 0, 1) : 0;
    var bright = all > 0 ? clamp(Math.sqrt(hi / all) / 1.5, 0, 1) : 0;
    // colpi: crescite improvvise dell'energia tra frame vicini
    var onsets = 0, last = -10, fps = r / hop, mean = 0;
    for (k = 0; k < nf; k++) mean += env[k]; mean = nf ? mean / nf : 0;
    for (k = 2; k < nf; k++) {
      var r0 = Math.log(env[k] + 1e-9) - Math.log(env[k - 2] + 1e-9);
      if (r0 > 1.2 && env[k] > mean * 0.3 && k - last > fps * 0.06) { onsets++; last = k; }
    }
    var bpm = base.bpm, beats = bpm ? seconds * bpm / 60 : null;
    var onsetsPerBeat = beats ? onsets / beats : null;
    // contorno di energia a finestre di 2 s: quanto "sale" nel pezzo e quanto varia
    var win = Math.max(1, Math.round(2 * fps)), rms = [];
    for (k = 0; k + win <= nf; k += win) { var sum = 0; for (j = 0; j < win; j++) sum += env[k + j]; rms.push(Math.sqrt(sum / win)); }
    var lift = 1, dyn = 0;
    if (rms.length >= 4) {
      var sorted = rms.slice().sort(function (p, q) { return p - q; });
      var q30 = sorted[Math.floor(sorted.length * 0.3)], q90 = sorted[Math.floor(sorted.length * 0.9)];
      lift = q30 > 1e-6 ? clamp(q90 / q30, 1, 4) : 1;
      var m = rms.reduce(function (p, c) { return p + c; }, 0) / rms.length;
      dyn = m > 0 ? Math.sqrt(rms.reduce(function (p, c) { return p + (c - m) * (c - m); }, 0) / rms.length) / m : 0;
    }
    return {
      kind: 'misurato', name: opts.name || '', seconds: Math.round(seconds), bpm: bpm, bpmStrength: base.bpmStrength,
      mode: base.key ? base.key.mode : null, tonic: base.key ? base.key.tonic : null,
      bassShare: bassShare, bright: bright, onsetsPerBeat: onsetsPerBeat, lift: lift, dynamics: dyn
    };
  }

  function normBpm(b) { if (!b) return null; while (b > 170) b /= 2; while (b < 70) b *= 2; return Math.round(b); }

  /** Mescola più schede con dei pesi (es. 70% una, 30% un'altra). Ignora i valori mancanti. */
  function blend(cards, weights) {
    var out = { kind: 'misto', parts: cards.map(function (c) { return c.name || 'riferimento'; }) };
    var keys = ['bpm', 'bassShare', 'bright', 'onsetsPerBeat', 'lift', 'dynamics'];
    keys.forEach(function (k) {
      var s = 0, w = 0;
      cards.forEach(function (c, i) {
        var v = k === 'bpm' ? normBpm(c.bpm) : c[k], wi = weights && weights[i] != null ? weights[i] : 1;
        if (v != null && isFinite(v)) { s += v * wi; w += wi; }
      });
      out[k] = w ? s / w : null;
    });
    var modes = { maggiore: 0, minore: 0 };
    cards.forEach(function (c, i) { if (c.mode) modes[c.mode] += weights && weights[i] != null ? weights[i] : 1; });
    out.mode = modes.minore === 0 && modes.maggiore === 0 ? null : (modes.minore >= modes.maggiore ? 'minore' : 'maggiore');
    return out;
  }

  /** Dalla scheda ai parametri dell'arrangiatore. `why` spiega ogni scelta (ipotesi, non certezza). */
  function toParams(card) {
    var bpm = normBpm(card.bpm), why = [];
    var opb = card.onsetsPerBeat, bright = card.bright == null ? 0.3 : card.bright, lift = card.lift || 1.5;
    var genre = 'trap';
    if (bpm && bpm <= 92) { genre = lift > 1.7 ? 'epico' : 'melodico'; }
    else if (bpm && bpm <= 112) { genre = bright > 0.45 ? 'estate' : 'melodico'; }
    else if (opb != null && opb > 3) genre = 'drill';
    why.push('Stile più vicino: ' + genre + (bpm ? ' (tempo ' + bpm + ' BPM)' : ' (tempo non riconosciuto)') + '.');
    var tune = {
      hat: clamp(opb == null ? 0.8 : opb / 3, 0.3, 1),
      bass: clamp(0.6 + (card.bassShare == null ? 0.4 : card.bassShare) * 1.1, 0.6, 1.3),
      lift: clamp(lift / 1.6, 0.8, 1.4),
      kickVar: clamp(opb == null ? 1 : opb / 2.5, 0.5, 1.6)
    };
    why.push('Hi-hat e colpi ' + (tune.hat > 0.8 ? 'fitti' : 'più radi') + ', basso ' + (tune.bass > 1 ? 'pesante' : 'contenuto') + ', ritornello ' + (tune.lift > 1.1 ? 'molto più forte' : 'poco più forte') + ' della strofa.');
    return { genre: genre, bpm: bpm, mode: card.mode || null, tune: tune, why: why };
  }

  return { measure: measure, blend: blend, toParams: toParams, normBpm: normBpm };
});
