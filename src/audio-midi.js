/* Audio → MIDI per linee a una voce sola (basso, melodia, voce): tracciatore YIN + segmentazione in note + file .mid standard.
   Funziona bene su basso e su melodie pulite (traccia separata); su un mix intero con più strumenti la melodia è approssimata (Ipotesi). Non fa accordi (polifonico): serve un modello dedicato. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.AudioMidi = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function decimate(x, f) { if (f <= 1) return x; var n = Math.floor(x.length / f), o = new Float32Array(n); for (var i = 0; i < n; i++) { var s = 0, b = i * f; for (var k = 0; k < f; k++) s += x[b + k]; o[i] = s / f; } return o; }
  /* un frame: ritorna {f0, conf} oppure null */
  function yin(x, a, half, tauMax, sr, thr) {
    var d = new Float32Array(tauMax + 1), t, j, sum = 0;
    for (t = 1; t <= tauMax; t++) { var s = 0; for (j = 0; j < half; j++) { var q = x[a + j] - x[a + j + t]; s += q * q; } d[t] = s; }
    var run = 0, c = new Float32Array(tauMax + 1); c[0] = 1;
    for (t = 1; t <= tauMax; t++) { run += d[t]; c[t] = run > 0 ? d[t] * t / run : 1; }
    var best = -1;
    for (t = 2; t < tauMax; t++) { if (c[t] < thr) { while (t + 1 < tauMax && c[t + 1] < c[t]) t++; best = t; break; } }
    if (best < 0) return null;
    var y0 = c[best - 1], y1 = c[best], y2 = c[best + 1], den = y0 - 2 * y1 + y2, tt = den !== 0 ? best + 0.5 * (y0 - y2) / den : best;
    return { f0: sr / tt, conf: 1 - c[best] };
  }
  function transcribe(input, sr, o) {
    o = o || {}; var fmin = o.fmin || 35, fmax = o.fmax || 300, thr = o.thr || 0.15, minDur = o.minDur || 0.08;
    var f = Math.max(1, Math.floor(sr / (fmax * 4))), x = decimate(input, f), s2 = sr / f;
    var tauMax = Math.ceil(s2 / fmin), half = tauMax * 2, hop = Math.max(1, Math.round(s2 * 0.01)), nf = Math.floor((x.length - half - tauMax - 1) / hop);
    if (nf < 5) return { notes: [], frames: 0 };
    var rms = new Float32Array(nf), mx = 0, i, j;
    for (i = 0; i < nf; i++) { var e = 0, a = i * hop; for (j = 0; j < half; j++) e += x[a + j] * x[a + j]; rms[i] = Math.sqrt(e / half); if (rms[i] > mx) mx = rms[i]; }
    var midi = new Int16Array(nf).fill(-1);
    for (i = 0; i < nf; i++) {
      if (rms[i] < mx * 0.04) continue; var r = yin(x, i * hop, half, tauMax, s2, thr); if (!r || r.f0 < fmin || r.f0 > fmax) continue;
      midi[i] = Math.round(69 + 12 * Math.log(r.f0 / 440) / Math.LN2);
    }
    /* mediana su 5 frame: toglie i singoli salti d'ottava */
    var sm = new Int16Array(nf).fill(-1);
    for (i = 0; i < nf; i++) { var w = []; for (j = Math.max(0, i - 2); j <= Math.min(nf - 1, i + 2); j++) if (midi[j] >= 0) w.push(midi[j]); if (w.length >= 3) { w.sort(function (p, q) { return p - q; }); sm[i] = w[w.length >> 1]; } }
    var dt = hop / s2, notes = [], cur = null;
    for (i = 0; i <= nf; i++) {
      var m = i < nf ? sm[i] : -1;
      if (cur && m !== cur.m) { cur.end = i; notes.push(cur); cur = null; }
      if (!cur && m >= 0 && i < nf) cur = { m: m, start: i, end: i, r: 0, n: 0 };
      if (cur && i < nf) { cur.r += rms[i]; cur.n++; }
    }
    var out = [];
    notes.forEach(function (n) { out.push({ midi: n.m, t: n.start * dt, d: (n.end - n.start) * dt, v: Math.max(30, Math.min(120, Math.round(40 + 80 * (n.r / n.n) / mx))) }); });
    var merged = []; out.forEach(function (n) { var l = merged[merged.length - 1]; if (l && l.midi === n.midi && n.t - (l.t + l.d) <= 0.05) l.d = n.t + n.d - l.t; else merged.push(n); });
    merged = merged.filter(function (n) { return n.d >= minDur; });
    merged.forEach(function (n) { n.t = Math.round(n.t * 1000) / 1000; n.d = Math.round(n.d * 1000) / 1000; });
    return { notes: merged, frames: nf };
  }
  function bass(x, sr) { return transcribe(x, sr, { fmin: 35, fmax: 300 }); }
  function melody(x, sr) { return transcribe(x, sr, { fmin: 100, fmax: 1000, minDur: 0.1 }); }
  var NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
  function noteName(m) { return NAMES[m % 12] + (Math.floor(m / 12) - 1); }
  function vlq(n) { var b = [n & 127]; n >>= 7; while (n > 0) { b.unshift((n & 127) | 128); n >>= 7; } return b; }
  /* file MIDI formato 0, 480 ticks per quarto */
  function toSMF(notes, bpm, name, prog) {
    var PPQ = 480, tick = function (s) { return Math.round(s * bpm / 60 * PPQ); }, ev = [];
    notes.forEach(function (n) { var a = tick(n.t), b = Math.max(a + 1, tick(n.t + n.d)); ev.push({ t: a, o: 1, b: [0x90, n.midi & 127, n.v & 127] }); ev.push({ t: b, o: 0, b: [0x80, n.midi & 127, 0] }); });
    ev.sort(function (p, q) { return p.t - q.t || p.o - q.o; });
    var tempo = Math.round(60000000 / bpm), nm = String(name || 'Sultan Sound').slice(0, 30).split('').map(function (c) { return c.charCodeAt(0) & 127; });
    var d = [0, 0xFF, 3, nm.length].concat(nm, [0, 0xFF, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255, 0, 0xC0, prog | 0]), last = 0;
    ev.forEach(function (e) { d = d.concat(vlq(e.t - last), e.b); last = e.t; });
    d = d.concat([0, 0xFF, 0x2F, 0]);
    var u32 = function (n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; };
    return new Uint8Array([0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, PPQ >> 8, PPQ & 255, 0x4D, 0x54, 0x72, 0x6B].concat(u32(d.length), d));
  }
  return { transcribe: transcribe, bass: bass, melody: melody, toSMF: toSMF, noteName: noteName };
});
