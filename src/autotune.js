/*
 * Autotune (correzione dell'intonazione) con la tecnica PSOLA.
 *
 * 1. Si misura l'altezza della voce nel tempo (AudioAnalysis).
 * 2. Per ogni istante si sceglie la nota "giusta" più vicina nella scala scelta.
 * 3. Si calcola di quanto spostare l'altezza (intensità e velocità regolabili).
 * 4. Si ricostruisce il suono ritagliando e risommando piccoli frammenti
 *    sincronizzati con il periodo della voce, così il timbro resta quasi uguale.
 *
 * Controlli (tutti opzionali, i valori di base riproducono il comportamento di prima):
 *   retuneMs     velocità di correzione in ms: 0-5 = robotico, 10-50 = naturale, di più = lascia passare di più
 *   humanize     0-1: rallenta la correzione nella parte TENUTA delle note lunghe (le note brevi restano precise)
 *   flexCents    zona morta in cent attorno alla nota (0 = spento): dentro la zona non si corregge,
 *                e le scivolate veloci tra due note vengono lasciate passare (la quantità cresce con flexCents)
 *   classic      true = passaggio a gradino netto (nessun ammorbidimento, niente humanize/flex)
 *   vibrato      0-2: quanto dell'oscillazione veloce NATURALE (vibrato) si conserva
 *   drift        0-1: quanto della deriva lenta dentro la nota si conserva
 *   vibratoDepth cent (picco) di vibrato ARTIFICIALE aggiunto sulle note lunghe; vibratoRate Hz; vibratoDelay s
 *   formantSemitones  -8..+8 cambia il timbro senza cambiare nota (cepstrum, vedi formant.js)
 *   key: 'auto'  stima la tonalità con KeyDetect; se è incerta usa "tutte le note" e lo segnala in stats.key
 * La curva di intonazione è separata in: CENTRO NOTA (+ bersaglio), DERIVA LENTA e OSCILLAZIONE VELOCE
 * (idea di "Pitch Drift" e "Pitch Modulation" di Melodyne).
 *
 * Le parti senza nota chiara (consonanti, respiri, silenzi) non vengono toccate.
 * Qualità: adatta a una bozza e a un effetto autotune. Su voci con rumore,
 * musica sotto o molti armonici la stima dell'altezza può sbagliare.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./audio-analysis.js'), require('./key-detect.js'), require('./formant.js'));
  else root.Autotune = factory(root.AudioAnalysis, root.KeyDetect, root.Formant);
})(typeof self !== 'undefined' ? self : this, function (AudioAnalysis, KeyDetect, Formant) {
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
    var cur = m, dir = steps < 0 ? -1 : 1; // gradini negativi = verso il basso (armonie sotto la voce)
    for (var s = 0; s < Math.abs(steps); s++) {
      do { cur += dir; } while (!mask[((cur % 12) + 12) % 12]);
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

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function toMidiF(f) { return 69 + 12 * Math.log(f / 440) / Math.LN2; }
  function fromMidiF(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function smooth01(v, a, b) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function boxcar(a, n) {
    if (n <= 1) return a.slice();
    var h = n >> 1, out = new Array(a.length);
    for (var i = 0; i < a.length; i++) { var s = 0, c = 0; for (var j = Math.max(0, i - h); j <= Math.min(a.length - 1, i + h); j++) { s += a[j]; c++; } out[i] = s / c; }
    return out;
  }
  function medianOf(a) { var b = a.slice().sort(function (p, q) { return p - q; }); return b.length ? b[b.length >> 1] : 0; }

  function decimateBox(x, f) {
    if (f <= 1) return x;
    var n = Math.floor(x.length / f), out = new Float32Array(n);
    for (var i = 0; i < n; i++) { var s = 0; for (var k = 0; k < f; k++) s += x[i * f + k]; out[i] = s / f; }
    return out;
  }

  /**
   * Tracciatore dell'altezza FINE (un punto ogni ~6 ms, finestra ~40 ms): serve a far funzionare
   * davvero velocità di ritocco brevi (5-50 ms) e a separare il vibrato. Stessa forma di
   * AudioAnalysis.analyze (frames, frameSeconds, hopSeconds), più la correzione degli errori di ottava.
   * @param {Float32Array|Float32Array[]} input
   * @param {number} sr
   * @param {{hopMs?:number, fmin?:number, fmax?:number, maxSeconds?:number, minClarity?:number}} [o]
   */
  function track(input, sr, o) {
    o = o || {};
    var mono = mixToMono(input), maxSeconds = o.maxSeconds || 120;
    if (mono.length > maxSeconds * sr) mono = mono.subarray(0, Math.floor(maxSeconds * sr));
    var fmin = o.fmin || 70, fmax = o.fmax || 900, minClar = o.minClarity || 0.8;
    var factor = Math.max(1, Math.floor(sr / 12000)), x = decimateBox(mono, factor), s2 = sr / factor;
    var size = Math.max(Math.round(s2 * 0.04), Math.ceil(2.4 * s2 / fmin)), hopS = Math.max(1, Math.round(s2 * (o.hopMs || 6) / 1000));
    var peak = 0, i;
    for (i = 0; i < mono.length; i += 3) { var a = mono[i] < 0 ? -mono[i] : mono[i]; if (a > peak) peak = a; }
    var silenceDb = Math.max(-50, 20 * Math.log(Math.max(peak, 1e-9)) / Math.LN10 - 35);
    var frames = [];
    for (var s = 0; s + size <= x.length; s += hopS) {
      var e = 0; for (i = 0; i < size; i += 2) e += x[s + i] * x[s + i];
      var db = 10 * Math.log(Math.max(e / (size / 2), 1e-18)) / Math.LN10, f0 = 0, clar = 0;
      if (db > silenceDb) { var p = AudioAnalysis.detectPitch(x, s, size, s2, fmin, fmax); f0 = p.f0; clar = p.clarity; }
      var v = f0 >= fmin && f0 <= fmax && clar >= minClar;
      frames.push({ t: s / s2, db: db, f0: v ? f0 : 0, clarity: clar, voiced: v });
    }
    // correzione errori di ottava: confronto con la mediana dei vicini
    var N = frames.length, k;
    var m = frames.map(function (f) { return f.voiced ? toMidiF(f.f0) : NaN; });
    for (k = 0; k < N; k++) {
      if (!frames[k].voiced) continue;
      var nb = []; for (var j = Math.max(0, k - 6); j <= Math.min(N - 1, k + 6); j++) if (frames[j].voiced) nb.push(m[j]);
      if (nb.length < 4) continue;
      var med = medianOf(nb), d = m[k] - med;
      if (Math.abs(d) > 5.5) {
        var alt = d > 0 ? m[k] - 12 : m[k] + 12;
        if (Math.abs(alt - med) < 2.5) { m[k] = alt; frames[k].f0 = fromMidiF(alt); } else { frames[k].voiced = false; frames[k].f0 = 0; }
      }
    }
    // elimina i brevi tratti isolati (< 4 frame) e riempie i buchi di 1-3 frame
    k = 0;
    while (k < N) {
      if (!frames[k].voiced) { k++; continue; }
      var e2 = k; while (e2 + 1 < N && frames[e2 + 1].voiced) e2++;
      if (e2 - k + 1 < 4) for (var q = k; q <= e2; q++) { frames[q].voiced = false; frames[q].f0 = 0; }
      k = e2 + 1;
    }
    k = 0;
    while (k < N) {
      if (frames[k].voiced || k === 0 || !frames[k - 1].voiced) { k++; continue; }
      var g = k; while (g < N && !frames[g].voiced) g++;
      if (g < N && g - k <= 3) {
        var ma = toMidiF(frames[k - 1].f0), mb = toMidiF(frames[g].f0);
        if (Math.abs(ma - mb) < 1.5) for (var r = k; r < g; r++) { frames[r].f0 = fromMidiF(ma + (mb - ma) * (r - k + 1) / (g - k + 1)); frames[r].voiced = true; frames[r].filled = true; }
      }
      k = g;
    }
    var vc = 0; frames.forEach(function (f) { if (f.voiced) vc++; });
    return { frames: frames, frameSeconds: size / s2, hopSeconds: hopS / s2, analyzedDuration: mono.length / sr, duration: mono.length / sr, sampleRate: sr, voicedShare: N ? vc / N : 0, fine: true };
  }

  // frame con altezza lisciata (mediana ~0.2 s): per stimare la tonalità senza farsi ingannare dal vibrato
  function smoothedFrames(res) {
    var frames = res.frames, hop = res.hopSeconds, out = frames.map(function (f) { return { voiced: f.voiced, f0: f.f0, t: f.t }; });
    var nm = Math.max(3, Math.round(0.2 / hop) | 1), i = 0;
    while (i < frames.length) {
      if (!frames[i].voiced) { i++; continue; }
      var j = i; while (j + 1 < frames.length && frames[j + 1].voiced) j++;
      var idx = []; for (var q = i; q <= j; q++) idx.push(q);
      var sl = medianN(idx.map(function (q) { return toMidiF(frames[q].f0); }), nm);
      idx.forEach(function (q, n) { out[q].f0 = fromMidiF(sl[n]); });
      i = j + 1;
    }
    return out;
  }

  /** Stima la tonalità dalla voce (usa KeyDetect). Restituisce null se le note sono troppo poche. */
  function detectKey(input, sr, trk) {
    var res = trk || track(input, sr);
    return KeyDetect.detect(smoothedFrames(res));
  }

  /**
   * Misura l'intonazione: errore medio (in cent) rispetto alla nota ammessa più vicina.
   *  centerCents = sul CENTRO delle note (vibrato escluso), rawCents = su ogni frame (vibrato incluso).
   * @returns {{centerCents:number, rawCents:number, voicedFrames:number, curve:{t:number[],midi:(number|null)[]}, track:object}}
   */
  function measure(input, sr, o) {
    o = o || {};
    var res = o.track || track(input, sr, o), mask = o.mask || scaleMask(o.tonic || 0, o.mode || 'cromatica');
    var frames = res.frames, half = res.frameSeconds / 2, nm = Math.max(3, Math.round(0.2 / res.hopSeconds) | 1);
    var curve = { t: [], midi: [] }, sumC = 0, sumR = 0, n = 0, i = 0;
    frames.forEach(function (f) { curve.t.push(f.t + half); curve.midi.push(f.voiced && f.f0 > 0 ? toMidiF(f.f0) : null); });
    while (i < frames.length) {
      if (!frames[i].voiced) { i++; continue; }
      var j = i; while (j + 1 < frames.length && frames[j + 1].voiced) j++;
      var raw = []; for (var q = i; q <= j; q++) raw.push(toMidiF(frames[q].f0));
      var slow = medianN(raw, nm);
      for (var k = 0; k < raw.length; k++) {
        sumR += Math.abs(raw[k] - quantizeMidi(raw[k], mask)); sumC += Math.abs(slow[k] - quantizeMidi(slow[k], mask)); n++;
      }
      i = j + 1;
    }
    return { centerCents: n ? sumC / n * 100 : NaN, rawCents: n ? sumR / n * 100 : NaN, voicedFrames: n, curve: curve, track: res };
  }

  /**
   * @param {Float32Array|Float32Array[]} input
   * @param {number} sr
   * @param {object} [opts]  vedi l'elenco di controlli in cima al file
   * @returns {{samples:Float32Array, stats:object}}
   */
  function correct(input, sr, opts) {
    opts = opts || {};
    var strength = opts.strength == null ? 1 : clamp(opts.strength, 0, 1);
    var classic = !!opts.classic;
    var retuneMs = classic ? 0 : (opts.retuneMs == null ? 30 : Math.max(0, opts.retuneMs));
    var humanize = classic ? 0 : clamp(opts.humanize || 0, 0, 1);
    var flexZone = classic ? 0 : clamp(opts.flexCents || 0, 0, 100) / 100;     // in semitoni
    var maxSeconds = opts.maxSeconds || 120;
    var keep = opts.vibrato == null ? 0 : clamp(opts.vibrato, 0, 2);            // oscillazione veloce naturale conservata
    var driftKeep = clamp(opts.drift || 0, 0, 1);                               // deriva lenta conservata
    var vibDepth = Math.max(0, opts.vibratoDepth || 0) / 100, vibRate = opts.vibratoRate || 5.6, vibDelay = opts.vibratoDelay == null ? 0.3 : opts.vibratoDelay;
    var degrees = opts.harmonyDegrees || 0;                                     // armonia: gradini della scala sopra la nota
    var shift = clamp(opts.shiftSemitones || 0, -12, 12);                       // spostamento creativo della voce
    var formant = clamp(opts.formantSemitones || 0, -8, 8);
    var refSt = clamp(opts.refCents || 0, -50, 50) / 100;                       // accordatura della base (cent rispetto al LA 440)
    var notes = Array.isArray(opts.notes) ? opts.notes : null;   // note modificate a mano: {t0,t1,target,amount}
    var notesOnly = notes ? opts.notesOnly !== false : false;    // fuori dalle note non si tocca nulla

    var mono = mixToMono(input);
    if (mono.length > maxSeconds * sr) mono = mono.subarray(0, Math.floor(maxSeconds * sr));
    var x = mono;
    var out = new Float32Array(x.length);
    out.set(x);

    var stats = { runs: 0, correctedSeconds: 0, meanShiftCents: 0, maxShiftCents: 0, key: null, mode: null, tonic: null, formantSemitones: formant };
    function finish() {
      if (formant) out = Formant.shift(out, sr, formant);
      var peak = 0, i2;
      for (i2 = 0; i2 < out.length; i2++) { var a = Math.abs(out[i2]); if (a > peak) peak = a; }
      if (peak > 0.99) { var gk = 0.99 / peak; for (i2 = 0; i2 < out.length; i2++) out[i2] *= gk; }
      return { samples: out, stats: stats };
    }
    var needTrack = !(strength === 0 && !degrees && !shift) || opts.key === 'auto';
    if (x.length < sr * 0.2 || !needTrack) return finish();

    var res = opts.analysis && opts.analysis.frames && opts.analysis.analyzedDuration >= x.length / sr - 0.05
      ? opts.analysis
      : (opts.track && opts.track.frames && opts.track.analyzedDuration >= x.length / sr - 0.05 ? opts.track : track(x, sr, { maxSeconds: maxSeconds }));
    var frames = res.frames, half = res.frameSeconds / 2, hop = res.hopSeconds;

    // tonalità e scala
    var tonic = opts.tonic || 0, mode = opts.mode || 'cromatica';
    if (opts.key === 'auto') {
      var kd = KeyDetect.detect(smoothedFrames(res));
      if (kd && kd.confidence !== 'bassa') { tonic = kd.tonic; mode = kd.mode; stats.key = { name: kd.name, confidence: kd.confidence, alternative: kd.alternative.name, certain: true }; }
      else { mode = 'cromatica'; stats.key = { name: kd ? kd.name : null, confidence: kd ? kd.confidence : 'nessuna', alternative: kd ? kd.alternative.name : null, certain: false }; }
    }
    stats.tonic = tonic; stats.mode = mode;
    var mask = opts.mask && opts.mask.length === 12 ? opts.mask : scaleMask(tonic, mode);
    if (strength === 0 && !degrees && !shift) return finish();

    function noteAt(t) {
      if (!notes) return null;
      for (var q = 0; q < notes.length; q++) if (t >= notes[q].t0 && t < notes[q].t1) return notes[q];
      return null;
    }
    // Restituisce {target, amt}: nota voluta (in semitoni MIDI) e quanto applicarla (0-1). curQ = nota base precedente (isteresi).
    function targetOf(m, t, curQ) {
      var nt = noteAt(t);
      if (nt) return { target: nt.target + (degrees ? stepUp(Math.round(nt.target), degrees, mask) - Math.round(nt.target) : 0) + shift, amt: nt.amount == null ? 1 : clamp(nt.amount, 0, 1), q: nt.target };
      if (notesOnly) return { target: m, amt: 0, q: null };
      var q = quantizeMidi(m, mask);
      if (curQ != null && q !== curQ && Math.abs(m - q) + 0.12 >= Math.abs(m - curQ)) q = curQ; // isteresi: niente rimbalzi tra due note vicine
      return { target: (degrees ? stepUp(q, degrees, mask) : q) + shift, amt: 1, q: q };
    }

    // Gruppi di frame consecutivi con una nota chiara
    var runs = [], cur = null;
    frames.forEach(function (f, i) {
      if (f.voiced) { if (!cur) { cur = []; runs.push(cur); } cur.push(i); } else cur = null;
    });
    var minRun = Math.max(3, Math.ceil(0.045 / hop));
    var nmWin = Math.max(3, Math.round(0.2 / hop) | 1), smallWin = Math.max(1, Math.round(0.03 / hop) | 1);

    var shiftSum = 0, shiftN = 0, errSum = 0, errN = 0;
    runs.forEach(function (idx) {
      if (idx.length < minRun) return;
      var K = idx.length;
      var midi = median3(idx.map(function (i) { return toMidiF(frames[i].f0) - refSt; }));
      var slow = boxcar(medianN(midi, nmWin), smallWin);
      var times = idx.map(function (i) { return frames[i].t + half; });
      var k, curQ = null, tg = [], seg = [], segN = -1, segStart = [], segEnd = [], lastT = null;
      for (k = 0; k < K; k++) {
        var o1 = targetOf(slow[k], times[k], curQ); curQ = o1.q; tg.push(o1);
        if (lastT === null || Math.abs(o1.target - lastT) > 1e-6) { segN++; segStart.push(k); }
        segEnd[segN] = k; seg.push(segN); lastT = o1.target;
      }
      var centers = segStart.map(function (s0, n) { return medianOf(slow.slice(s0, segEnd[n] + 1)); });
      var alpha0 = retuneMs <= 0 ? 1 : 1 - Math.exp(-hop / (retuneMs / 1000));
      var delta = [], prev = null;
      for (k = 0; k < K; k++) {
        var n = seg[k], fast = midi[k] - slow[k], drift = slow[k] - centers[n];
        var held = times[k] - times[segStart[n]], segDur = times[segEnd[n]] - times[segStart[n]];
        var out1 = tg[k].target + keep * fast + driftKeep * drift;
        if (vibDepth > 0 && segDur >= vibDelay + 0.2 && held > vibDelay) {
          var tau = held - vibDelay, env = smooth01(tau, 0, 0.25), env2 = smooth01(segDur - held, 0, 0.12);
          out1 += vibDepth * env * env2 * Math.sin(2 * Math.PI * vibRate * tau + 0.5 * Math.sin(2 * Math.PI * 0.37 * tau));
        }
        var want = out1 - midi[k];
        var gate = 1;
        if (flexZone > 0) {
          var e = Math.abs(slow[k] - tg[k].target);
          gate = clamp((e - flexZone) / (0.5 * flexZone + 0.01), 0, 1);
          var rate = Math.abs(slow[Math.min(K - 1, k + 1)] - slow[Math.max(0, k - 1)]) / Math.max(1e-3, times[Math.min(K - 1, k + 1)] - times[Math.max(0, k - 1)]);
          gate = gate * (1 - clamp(flexZone * 2, 0, 1) * smooth01(rate, 3, 8));
        }
        want = clamp(want * 100 * strength * tg[k].amt * gate, -1200, 1200);
        var alpha = alpha0;
        if (!classic && humanize > 0) {
          var ramp = smooth01(held, 0.25, 0.55), tauMs = retuneMs + humanize * 600 * ramp;
          alpha = 1 - Math.exp(-hop / (Math.max(tauMs, 1e-3) / 1000));
        }
        prev = (prev === null ? 0 : prev) + alpha * (want - (prev === null ? 0 : prev)); // a inizio frase si parte dall'altezza cantata: la velocità vale anche sull'attacco
        delta.push(prev);
        errSum += Math.abs(slow[k] - quantizeMidi(slow[k], mask)); errN++;
      }

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
      var T0 = periodAt(s0), best = s0, bv = -Infinity, n2;
      for (n2 = s0; n2 < Math.min(s1, s0 + Math.ceil(T0)); n2++) if (x[n2] > bv) { bv = x[n2]; best = n2; }
      marks.push(best);
      while (true) {
        var last = marks[marks.length - 1], T = periodAt(last);
        var pred = last + T;
        if (pred >= s1) break;
        var w = Math.max(1, Math.floor(T * 0.2)), b2 = Math.round(pred), v2 = -Infinity;
        for (n2 = Math.max(last + 1, Math.round(pred) - w); n2 <= Math.min(s1, Math.round(pred) + w); n2++) if (x[n2] > v2) { v2 = x[n2]; b2 = n2; }
        marks.push(b2);
      }
      if (marks.length < 4) return;

      var len = s1 - s0 + 1;
      var acc = new Float32Array(len), wgt = new Float32Array(len);
      var j = 0, ts = marks[0];
      while (ts < s1) {
        while (j + 1 < marks.length && Math.abs(marks[j + 1] - ts) <= Math.abs(marks[j] - ts)) j++;
        var mk = marks[j];
        var L = Math.max(8, Math.round(periodAt(mk)));
        for (var kk = -L; kk <= L; kk++) {
          var src = mk + kk, dst = Math.round(ts) + kk;
          if (src < 0 || src >= x.length || dst < s0 || dst > s1) continue;
          var win = 0.5 * (1 + Math.cos(Math.PI * kk / L));
          acc[dst - s0] += x[src] * win;
          wgt[dst - s0] += win;
        }
        var r = ratioAt(ts);
        ts += periodAt(ts) / r;
        var dsh = Math.abs(interp(delta, ts / sr));
        shiftSum += dsh; shiftN++;
        if (dsh > stats.maxShiftCents) stats.maxShiftCents = dsh;
      }

      // Rimescolamento con l'originale ai bordi per evitare scatti
      var fade = Math.round(sr * 0.012);
      for (n2 = 0; n2 < len; n2++) {
        var wv = wgt[n2];
        if (wv < 0.15) continue;
        var y = acc[n2] / wv;
        var g = Math.min(1, n2 / fade, (len - 1 - n2) / fade, wv / 0.5);
        out[s0 + n2] = x[s0 + n2] * (1 - g) + y * g;
      }
      stats.runs++;
      stats.correctedSeconds += len / sr;
    });
    stats.meanShiftCents = shiftN ? shiftSum / shiftN : 0;
    stats.meanErrBeforeCents = errN ? errSum / errN * 100 : 0; // centro delle note rispetto alla scala, prima
    return finish();
  }

  return { correct: correct, scaleMask: scaleMask, quantizeMidi: quantizeMidi, stepUp: stepUp, track: track, measure: measure, detectKey: detectKey };
});
