/*
 * Analisi audio della voce (Modulo 1, solo parte MISURABILE con calcolo diretto).
 *
 * Misura: livello, picco, clipping, dinamica, altezza delle note (pitch),
 * estensione e scostamento dall'intonazione "temperata" (La = 440 Hz).
 *
 * NON misura: timbro, pronuncia, accento. Servono modelli di intelligenza
 * artificiale dedicati e non sono inclusi in questa versione.
 *
 * Il pitch si stima con la funzione di autocorrelazione normalizzata. Può
 * sbagliare di un'ottava su suoni molto ricchi di armoniche o rumorosi.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AudioAnalysis = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NOTE_NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

  function freqToMidi(f) { return 69 + 12 * Math.log(f / 440) / Math.LN2; }
  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function midiToName(m) {
    var r = Math.round(m);
    return NOTE_NAMES[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1);
  }

  function toDb(x) { return 20 * Math.log(Math.max(x, 1e-9)) / Math.LN10; }

  function percentile(sorted, p) {
    if (!sorted.length) return NaN;
    var idx = (sorted.length - 1) * p;
    var lo = Math.floor(idx), hi = Math.ceil(idx);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  function mixToMono(channels) {
    if (channels.length === 1) return channels[0];
    var n = channels[0].length, out = new Float32Array(n);
    for (var c = 0; c < channels.length; c++) {
      var ch = channels[c];
      for (var i = 0; i < n; i++) out[i] += ch[i] / channels.length;
    }
    return out;
  }

  function decimate(x, factor) {
    if (factor <= 1) return x;
    var n = Math.floor(x.length / factor), out = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var s = 0;
      for (var k = 0; k < factor; k++) s += x[i * factor + k];
      out[i] = s / factor;
    }
    return out;
  }

  // Stima l'altezza di un frame con autocorrelazione normalizzata (stile McLeod).
  function detectPitch(x, start, size, sr, fmin, fmax) {
    var minLag = Math.max(2, Math.floor(sr / fmax));
    var maxLag = Math.min(size - 2, Math.ceil(sr / fmin));
    var nsdf = new Float32Array(maxLag + 2);
    for (var lag = 0; lag <= maxLag + 1 && lag < size; lag++) {
      var acf = 0, m = 0;
      for (var i = 0; i < size - lag; i++) {
        var a = x[start + i], b = x[start + i + lag];
        acf += a * b;
        m += a * a + b * b;
      }
      nsdf[lag] = m > 0 ? 2 * acf / m : 0;
    }
    // Massimi locali dopo il primo attraversamento sotto zero
    var peaks = [];
    var pos = minLag;
    while (pos < maxLag && nsdf[pos] > 0) pos++;
    var best = -1, bestVal = 0;
    for (var l = pos; l <= maxLag; l++) {
      if (nsdf[l] > nsdf[l - 1] && nsdf[l] >= nsdf[l + 1] && nsdf[l] > 0) {
        peaks.push(l);
        if (nsdf[l] > bestVal) { bestVal = nsdf[l]; best = l; }
      }
    }
    if (best === -1) return { f0: 0, clarity: 0 };
    var chosen = best;
    for (var p = 0; p < peaks.length; p++) {
      if (nsdf[peaks[p]] >= 0.9 * bestVal) { chosen = peaks[p]; break; }
    }
    var y0 = nsdf[chosen - 1], y1 = nsdf[chosen], y2 = nsdf[chosen + 1];
    var denom = y0 - 2 * y1 + y2;
    var shift = denom !== 0 ? 0.5 * (y0 - y2) / denom : 0;
    var period = chosen + shift;
    return { f0: sr / period, clarity: Math.min(1, nsdf[chosen]) };
  }

  /**
   * @param {Float32Array|Float32Array[]} input  campioni mono o lista di canali
   * @param {number} sampleRate
   * @param {{maxSeconds?:number, fmin?:number, fmax?:number}} [opts]
   */
  function analyze(input, sampleRate, opts) {
    opts = opts || {};
    var fmin = opts.fmin || 70, fmax = opts.fmax || 1000;
    var maxSeconds = opts.maxSeconds || 120;

    var mono = Array.isArray(input) ? mixToMono(input) : input;
    var totalDuration = mono.length / sampleRate;
    var limit = Math.min(mono.length, Math.floor(maxSeconds * sampleRate));
    if (limit < mono.length) mono = mono.subarray(0, limit);
    var duration = mono.length / sampleRate;

    // Livello, picco, clipping sul segnale completo
    var peak = 0, sumSq = 0, clipped = 0;
    for (var i = 0; i < mono.length; i++) {
      var v = Math.abs(mono[i]);
      if (v > peak) peak = v;
      sumSq += v * v;
      if (v >= 0.999) clipped++;
    }
    var rms = mono.length ? Math.sqrt(sumSq / mono.length) : 0;

    // Decimazione per velocizzare il calcolo del pitch
    var factor = Math.max(1, Math.floor(sampleRate / 12000));
    var x = decimate(mono, factor);
    var sr = sampleRate / factor;
    var frameSize = Math.pow(2, Math.round(Math.log(sr * 0.09) / Math.LN2));
    var hop = Math.floor(frameSize / 2);

    var silenceDb = Math.max(-50, toDb(peak) - 35);
    var frames = [];
    for (var s = 0; s + frameSize <= x.length; s += hop) {
      var e = 0;
      for (var j = 0; j < frameSize; j++) e += x[s + j] * x[s + j];
      var frameDb = toDb(Math.sqrt(e / frameSize));
      var f0 = 0, clarity = 0;
      if (frameDb > silenceDb) {
        var p = detectPitch(x, s, frameSize, sr, fmin, fmax);
        f0 = p.f0; clarity = p.clarity;
      }
      var voiced = f0 >= fmin && f0 <= fmax && clarity >= 0.85;
      frames.push({ t: s / sr, db: frameDb, f0: voiced ? f0 : 0, clarity: clarity, voiced: voiced });
    }

    var voicedFrames = frames.filter(function (f) { return f.voiced; });
    var result = {
      duration: duration,
      analyzedDuration: duration,
      truncated: limit < totalDuration * sampleRate,
      totalDuration: totalDuration,
      sampleRate: sampleRate,
      frameSeconds: frameSize / sr,
      hopSeconds: hop / sr,
      levels: { peakDb: toDb(peak), rmsDb: toDb(rms), clippedSamples: clipped, clippingShare: mono.length ? clipped / mono.length : 0 },
      voicedShare: frames.length ? voicedFrames.length / frames.length : 0,
      frames: frames,
      pitch: null,
      dynamics: null
    };

    // Dinamica: differenza tra frame forti e frame deboli tra quelli con voce
    var activeDb = frames.filter(function (f) { return f.db > silenceDb; }).map(function (f) { return f.db; }).sort(function (a, b) { return a - b; });
    if (activeDb.length >= 5) {
      result.dynamics = {
        lowDb: percentile(activeDb, 0.1),
        highDb: percentile(activeDb, 0.95),
        rangeDb: percentile(activeDb, 0.95) - percentile(activeDb, 0.1)
      };
    }

    if (voicedFrames.length >= 5) {
      var midis = voicedFrames.map(function (f) { return freqToMidi(f.f0); });
      var sorted = midis.slice().sort(function (a, b) { return a - b; });
      var med = percentile(sorted, 0.5), lo = percentile(sorted, 0.05), hi = percentile(sorted, 0.95);
      var devs = midis.map(function (m) { return Math.abs(m - Math.round(m)) * 100; });
      var signed = midis.map(function (m) { return (m - Math.round(m)) * 100; });
      var meanDev = devs.reduce(function (a, b) { return a + b; }, 0) / devs.length;
      var meanSigned = signed.reduce(function (a, b) { return a + b; }, 0) / signed.length;
      result.pitch = {
        medianHz: midiToFreq(med), medianNote: midiToName(med),
        lowHz: midiToFreq(lo), lowNote: midiToName(lo),
        highHz: midiToFreq(hi), highNote: midiToName(hi),
        lowMidi: lo, highMidi: hi, medianMidi: med,
        spanSemitones: hi - lo,
        meanAbsCentsFromNote: meanDev,
        meanSignedCents: meanSigned,
        voicedFrames: voicedFrames.length
      };
    }
    return result;
  }

  // Segnale di prova sintetico: quattro note con vibrato e una nota calante.
  // Serve solo per mostrare l'analisi: NON è una voce reale.
  function synthExample(sampleRate) {
    sampleRate = sampleRate || 22050;
    var notes = [60, 64, 67, 64]; // Do4 Mi4 Sol4 Mi4
    var detune = [0, 0.35, 0, 0];  // la seconda nota è calante di 35 centesimi? (mezzo tono = 1.0)
    var perNote = 1.0;
    var n = Math.floor(sampleRate * perNote * notes.length);
    var out = new Float32Array(n);
    var phase = 0;
    for (var i = 0; i < n; i++) {
      var t = i / sampleRate;
      var idx = Math.min(notes.length - 1, Math.floor(t / perNote));
      var local = t - idx * perNote;
      var vibrato = 0.2 * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, local * 2); // ±20 centesimi
      var f = midiToFreq(notes[idx] + detune[idx] + vibrato);
      phase += 2 * Math.PI * f / sampleRate;
      var env = Math.min(1, local * 20) * Math.min(1, (perNote - local) * 20);
      out[i] = 0.4 * env * (Math.sin(phase) + 0.4 * Math.sin(2 * phase) + 0.2 * Math.sin(3 * phase)) / 1.6;
    }
    return out;
  }

  return {
    analyze: analyze,
    detectPitch: detectPitch,
    synthExample: synthExample,
    freqToMidi: freqToMidi,
    midiToFreq: midiToFreq,
    midiToName: midiToName
  };
});
