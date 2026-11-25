/*
 * Voce guida: una voce maschile SINTETICA che canta/rappa il tuo testo sulla base, a tempo con le parole e intonata
 * sulla scala della base (effetto autotune duro). Serve per sentire come potrebbe suonare il testo e capire dove entrare.
 * È una sintesi a formanti (vocali italiane + piccoli rumori per le consonanti): intellegibile ma ROBOTICA, non è un cantante vero
 * e non clona nessuna voce. Dalla tua voce impara solo l'ALTEZZA (misurata con measureF0), non il timbro.
 *  syllabify(parola) → [{onset, vowel, nucleus}]       render(lines, opt) → {audio, syllables}      measureF0(x, sr, detect) → {f0, lo, hi, n}
 *  lines: [{text, mode:'canta'|'parla', words:[{w,start,end}]}] (tempi in secondi dall'inizio della base, come SongMap)
 *  opt: { sr, length (campioni), tonic (0-11), mode:'minore'|'maggiore', f0 (Hz, centro voce, default 130), seed, tuneMs (glide, default 18), formant (scala, 1) }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GuideVoice = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var VOW = 'aeiouàèéìíòóùú', STRONG = 'aeoàèéòó', BASEV = { 'à': 'a', 'è': 'e', 'é': 'e', 'ì': 'i', 'í': 'i', 'ò': 'o', 'ó': 'o', 'ù': 'u', 'ú': 'u' };
  var FORM = { a: [730, 1090, 2440], e: [530, 1840, 2480], i: [270, 2290, 3010], o: [570, 840, 2410], u: [300, 870, 2240] }, BW = [70, 110, 160], FW = [1, 0.7, 0.35];
  var PENT = { minore: [0, 3, 5, 7, 10], maggiore: [0, 2, 4, 7, 9] };
  function isV(c) { return VOW.indexOf(c) >= 0; }
  function hash(s) { var h = 2166136261 >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rng(seed) { var a = (seed >>> 0) || 1; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---- sillabe italiane (approssimate: gruppi vocalici, consonanti doppie, nessi s+C e C+l/r) ---- */
  function tokens(w) {
    w = String(w || '').toLowerCase().replace(/[^a-zàèéìíòóùú]/g, '').replace(/qu(?=[aeiouàèéìòóù])/g, 'q').replace(/gu(?=[eiìéè])/g, 'g');
    var out = [], i = 0;
    while (i < w.length) {
      var d = w.substr(i, 2);
      if (/^(ch|gh|gn|gl)$/.test(d) || (d === 'sc' && /[eiéèì]/.test(w.charAt(i + 2)))) { out.push({ t: d, v: false }); i += 2; }
      else { out.push({ t: w.charAt(i), v: isV(w.charAt(i)) }); i++; }
    }
    return out;
  }
  function syllabify(word) {
    var tk = tokens(word), nuc = [], i, j;
    for (i = 0; i < tk.length;) {
      if (!tk[i].v) { i++; continue; }
      var cur = { from: i, to: i }, k = i + 1;
      while (k < tk.length && tk[k].v) {
        var prev = tk[k - 1].t, now = tk[k].t, hiatus = (STRONG.indexOf(prev) >= 0 && STRONG.indexOf(now) >= 0) || (BASEV[now] && now !== BASEV[now] && (prev === 'i' || prev === 'u' || STRONG.indexOf(prev) >= 0));
        if (hiatus) break; cur.to = k; k++;
      }
      nuc.push(cur); i = k;
    }
    if (!nuc.length) return [];
    var sy = nuc.map(function (n) { var vs = tk.slice(n.from, n.to + 1).map(function (x) { return x.t; }), main = vs[vs.length - 1]; for (j = 0; j < vs.length; j++) if (STRONG.indexOf(vs[j]) >= 0) { main = vs[j]; break; } return { onset: '', coda: '', vowel: BASEV[main] || main, nucleus: vs.join('') }; });
    sy[0].onset = tk.slice(0, nuc[0].from).map(function (x) { return x.t; }).join('');
    sy[sy.length - 1].coda = tk.slice(nuc[nuc.length - 1].to + 1).map(function (x) { return x.t; }).join('');
    for (i = 0; i + 1 < nuc.length; i++) {
      var cl = tk.slice(nuc[i].to + 1, nuc[i + 1].from).map(function (x) { return x.t; }), n = cl.length, toPrev = 0;
      if (n >= 2 && cl[0] !== 's' && !(/^[lr]$/.test(cl[1]) && /^[pbtdcgfv]$/.test(cl[0]))) toPrev = 1;
      sy[i].coda = cl.slice(0, toPrev).join(''); sy[i + 1].onset = cl.slice(toPrev).join('');
    }
    return sy;
  }

  /* ---- sintesi ---- */
  var TAB = (function () { var t = new Float32Array(2048), h, i, mx = 0; for (i = 0; i < 2048; i++) { var v = 0; for (h = 1; h <= 28; h++) v += Math.sin(2 * Math.PI * h * i / 2048) / Math.pow(h, 1.15); t[i] = v; if (Math.abs(v) > mx) mx = Math.abs(v); } for (i = 0; i < 2048; i++) t[i] /= mx; return t; })();
  function Res() { return { b0: 0, b2: 0, a1: 0, a2: 0, x1: 0, x2: 0, y1: 0, y2: 0 }; }
  function setRes(r, f, bw, sr) { var w0 = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, q = f / bw, al = Math.sin(w0) / (2 * q), a0 = 1 + al; r.b0 = al / a0; r.b2 = -al / a0; r.a1 = -2 * Math.cos(w0) / a0; r.a2 = (1 - al) / a0; }
  function runRes(r, x) { var y = r.b0 * x + r.b2 * r.x2 - r.a1 * r.y1 - r.a2 * r.y2; r.x2 = r.x1; r.x1 = x; r.y2 = r.y1; r.y1 = y; return y; }
  function midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function hzToMidi(f) { return 69 + 12 * Math.log(f / 440) / Math.LN2; }

  function notesFor(tonic, mode, centerMidi, lo, hi) {
    var pcs = (PENT[mode] || PENT.minore).map(function (d) { return (tonic + d) % 12; }), out = [];
    for (var m = Math.round(centerMidi) + lo; m <= Math.round(centerMidi) + hi; m++) if (pcs.indexOf(((m % 12) + 12) % 12) >= 0) out.push(m);
    return out;
  }
  /* una riga → sillabe con tempo e nota */
  function planLine(line, opt) {
    var out = [], canta = line.mode !== 'parla', center = hzToMidi(opt.f0 || 130), notes = notesFor(opt.tonic || 0, opt.mode, center, canta ? -5 : -3, canta ? 9 : 4);
    if (!notes.length) return out;
    var r = rng(hash(String(line.text || '')) + (opt.seed || 0) * 7919), root = notes.reduce(function (b, m) { return ((m % 12) === (opt.tonic || 0) % 12 && Math.abs(m - center) < Math.abs(b - center)) ? m : b; }, notes[Math.floor(notes.length / 2)]);
    var idx = Math.max(0, notes.indexOf(root)), all = [];
    (line.words || []).forEach(function (w) { var sy = syllabify(w.w); sy.forEach(function (s, i) { all.push({ s: s, w: w, i: i, n: sy.length }); }); });
    all.forEach(function (a, k) {
      var wt = a.w.end - a.w.start, ws = 0, before = 0, j;
      for (j = 0; j < a.n; j++) { var ww = (canta && a.w === (line.words || [])[(line.words || []).length - 1] && j === a.n - 1) ? 1.7 : 1; ws += ww; if (j < a.i) before += ww; }
      var wLast = (canta && a.w === (line.words || [])[(line.words || []).length - 1] && a.i === a.n - 1) ? 1.7 : 1;
      var t0 = a.w.start + wt * before / ws, t1 = t0 + wt * wLast / ws;
      var last = k === all.length - 1, step = canta ? (Math.floor(r() * 5) - 2) : (Math.floor(r() * 3) - 1);
      if (canta) { var arch = k < all.length * 0.5 ? 0.4 : -0.5; if (r() < Math.abs(arch)) step = arch > 0 ? Math.abs(step) : -Math.abs(step); }
      idx = Math.max(0, Math.min(notes.length - 1, idx + step));
      if (!canta) idx = Math.max(Math.max(0, notes.indexOf(root) - 1), Math.min(Math.min(notes.length - 1, notes.indexOf(root) + 1), idx));
      var midi = last ? root + (canta ? 0 : -0) : notes[idx];
      out.push({ t0: t0, t1: t1, midi: midi, s: a.s, canta: canta, last: last, w: a.w });
    });
    return out;
  }
  var FRIC = /^(s|f|z|sc|v|ch)/, STOP = /^(t|p|k|c|q|d|b|g)/;
  function render(lines, opt) {
    opt = opt || {}; var sr = opt.sr || 32000, N = opt.length || Math.round(sr * 10), out = new Float32Array(N), ev = [], count = 0;
    (lines || []).forEach(function (l) { planLine(l, opt).forEach(function (e) { ev.push(e); }); });
    ev.sort(function (a, b) { return a.t0 - b.t0; }); count = ev.length;
    if (!ev.length) return { audio: out, syllables: 0 };
    var res = [Res(), Res(), Res()], fs = FORM.a.slice(), fscale = opt.formant || 1, tau = Math.max(2, opt.tuneMs || 18) / 1000, pk = 1 - Math.exp(-1 / (sr * tau));
    var f = midiToHz(ev[0].midi), ph = 0, env = 0, up = 1 - Math.exp(-1 / (sr * 0.008)), dn = 1 - Math.exp(-1 / (sr * 0.03)), nz = rng((opt.seed || 1) * 31 + 7), k = 0, tgtF = FORM.a, noiseLeft = 0, noiseLvl = 0, hp = 0, i;
    for (i = 0; i < N; i++) {
      var t = i / sr;
      while (k + 1 < ev.length && t >= ev[k + 1].t0) k++;
      var e = ev[k], within = t >= e.t0 && t < e.t0 + (e.t1 - e.t0) * (e.canta ? 0.94 : 0.78);
      if (t >= e.t0 && t < e.t0 + 0.0006 && !e._on) { e._on = 1; var on = e.s.onset, nd = Math.min(0.06, (e.t1 - e.t0) * 0.35); if (on) { if (FRIC.test(on)) { noiseLeft = Math.round(nd * sr); noiseLvl = 0.5; } else if (STOP.test(on)) { noiseLeft = Math.round(0.012 * sr); noiseLvl = 0.8; } else { noiseLeft = Math.round(0.02 * sr); noiseLvl = 0.15; } } tgtF = FORM[e.s.vowel] || FORM.a; }
      var voicedOn = within && !(noiseLeft > 0 && FRIC.test(e.s.onset || '') && t < e.t0 + 0.05);
      var target = voicedOn ? 1 : 0; env += (target - env) * (target > env ? up : dn);
      var tf = midiToHz(e.midi) * (1 + (e.canta && t - e.t0 > 0.15 && e.t1 - e.t0 > 0.3 ? Math.sin(2 * Math.PI * 5.5 * t) * 0.009 : 0)); f += (tf - f) * pk;
      if ((i & 63) === 0) { for (var q = 0; q < 3; q++) { fs[q] += (tgtF[q] * fscale - fs[q]) * 0.18; setRes(res[q], fs[q], BW[q], sr); } }
      ph += f / sr; if (ph >= 1) ph -= 1;
      var src = TAB[(ph * 2048) | 0] * env + (nz() * 2 - 1) * 0.02 * env, y = 0;
      for (var m = 0; m < 3; m++) y += runRes(res[m], src) * FW[m];
      if (noiseLeft > 0) { var n0 = nz() * 2 - 1; y += (n0 - hp) * noiseLvl * 0.6; hp = n0; noiseLeft--; }
      out[i] = y;
    }
    var mx = 0; for (i = 0; i < N; i++) { var a = Math.abs(out[i]); if (a > mx) mx = a; }
    if (mx > 0) for (i = 0; i < N; i++) out[i] = out[i] / mx * 0.9;
    return { audio: out, syllables: count };
  }
  /* altezza della voce da una registrazione: mediana, 10° e 90° percentile delle frequenze chiare (solo numeri, nessun audio salvato) */
  function measureF0(x, sr, detect) {
    var size = 2048, hop = Math.round(sr * 0.05), vals = [];
    for (var s = 0; s + size < x.length; s += hop) { var e = 0, j; for (j = 0; j < size; j += 4) e += x[s + j] * x[s + j]; if (e / (size / 4) < 1e-5) continue; var p = detect(x, s, size, sr, 70, 420); if (p && p.f0 >= 70 && p.f0 <= 420 && p.clarity >= 0.85) vals.push(p.f0); }
    if (vals.length < 8) return null; vals.sort(function (a, b) { return a - b; });
    return { f0: Math.round(vals[Math.floor(vals.length / 2)] * 10) / 10, lo: Math.round(vals[Math.floor(vals.length * 0.1)]), hi: Math.round(vals[Math.floor(vals.length * 0.9)]), n: vals.length };
  }
  return { syllabify: syllabify, render: render, measureF0: measureF0, hzToMidi: hzToMidi, midiToHz: midiToHz };
});
