/*
 * Impara da una base: carichi una canzone (es. un pezzo che ti piace), l'app
 *  1) SEPARA voce e base (stima): STFT + maschere morbide.
 *     - voce = suono al CENTRO dello stereo (mid molto più forte del side), ARMONICO (non colpi),
 *       nella banda della voce (120-8000 Hz). La base = tutto il resto.
 *     - con un file mono non c'è informazione stereo: si usa solo armonico+banda (separazione più debole).
 *     Limite onesto: non è una rete neurale; pad e synth al centro finiscono un po' nella voce.
 *  2) RIPULISCE: toglie il fruscio costante (sottrazione spettrale dal rumore di fondo misurato),
 *     taglia i sub inutili, normalizza (amplifica fino a -1 dB di picco).
 *  3) IMPARA il groove come NUMERI: BPM, tonalità, cassa e rullante sui 16 passi, densità e terzine
 *     degli hi-hat, swing, peso dei bassi (808), brillantezza, energia.
 *     Si conservano SOLO questi numeri (il "profilo"), mai l'audio: la base nuova è originale,
 *     ispirata alle misure, non una copia.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./base-analysis.js'));
  else root.BeatLearn = factory(root.BaseAnalysis);
})(typeof self !== 'undefined' ? self : this, function (BaseAnalysis) {
  'use strict';

  var N = 2048, H = 512;

  function fft(re, im, inv) {
    var n = re.length, i, j, k, m, t;
    for (i = 1, j = 0; i < n; i++) { var bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (m = 2; m <= n; m <<= 1) {
      var ang = (inv ? 2 : -2) * Math.PI / m, wr = Math.cos(ang), wi = Math.sin(ang);
      for (i = 0; i < n; i += m) {
        var cr = 1, ci = 0;
        for (k = 0; k < m / 2; k++) {
          var a = i + k, b = a + m / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
    if (inv) for (i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
  var WIN = (function () { var w = new Float32Array(N); for (var i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N); return w; })();

  /** STFT: restituisce frames di {re, im} (metà spettro + 1). */
  function stft(x) {
    var F = Math.max(1, Math.ceil((x.length - N) / H) + 1), B = N / 2 + 1, out = [];
    for (var f = 0; f < F; f++) {
      var re = new Float32Array(N), im = new Float32Array(N), o = f * H;
      for (var i = 0; i < N; i++) re[i] = (x[o + i] || 0) * WIN[i];
      fft(re, im, false);
      out.push({ re: re.slice(0, B), im: im.slice(0, B) });
    }
    return out;
  }
  /** iSTFT con overlap-add (finestra di Hann, hop N/4: somma delle finestre² = 1.5). */
  function istft(frames, len) {
    var y = new Float32Array(len), norm = new Float32Array(len), B = N / 2 + 1;
    frames.forEach(function (fr, f) {
      var re = new Float32Array(N), im = new Float32Array(N), i;
      for (i = 0; i < B; i++) { re[i] = fr.re[i]; im[i] = fr.im[i]; }
      for (i = 1; i < N / 2; i++) { re[N - i] = fr.re[i]; im[N - i] = -fr.im[i]; }
      fft(re, im, true);
      var o = f * H;
      for (i = 0; i < N && o + i < len; i++) { y[o + i] += re[i] * WIN[i]; norm[o + i] += WIN[i] * WIN[i]; }
    });
    for (var i = 0; i < len; i++) if (norm[i] > 1e-3) y[i] /= norm[i];
    return y;
  }

  // mediana di un piccolo buffer (ordinamento per inserimento sul posto: niente memoria nuova, veloce sul telefono)
  function median(a) { for (var i = 1; i < a.length; i++) { var v = a[i], j = i - 1; while (j >= 0 && a[j] > v) { a[j + 1] = a[j]; j--; } a[j + 1] = v; } return a[a.length >> 1]; }

  /**
   * Separa voce e base. L, R: Float32Array (R può mancare = mono). Ritorna {voice, baseL, baseR, stereo, report}.
   * opt.strength 0-1 (quanto deciso è il taglio, default 0.7)
   */
  function separate(L, R, sr, opt) {
    opt = opt || {};
    var stereo = !!(R && R.length === L.length), len = L.length, i, f, k;
    var str = opt.strength == null ? 0.7 : Math.max(0, Math.min(1, opt.strength));
    var M = new Float32Array(len), S = new Float32Array(len);
    for (i = 0; i < len; i++) { var l = L[i], r = stereo ? R[i] : L[i]; M[i] = (l + r) / 2; S[i] = (l - r) / 2; }
    var FM = stft(M), FS = stereo ? stft(S) : null, F = FM.length, B = N / 2 + 1;
    var mag = FM.map(function (fr) { var m = new Float32Array(B); for (var b = 0; b < B; b++) m[b] = Math.hypot(fr.re[b], fr.im[b]); return m; });
    // HPSS: mediana nel tempo (armonico) e in frequenza (colpi)
    var TW = 6, FW = 6, lo = Math.floor(120 * N / sr), hi = Math.min(B - 1, Math.ceil(8000 * N / sr));
    var masks = [], vSum = 0, tSum = 0, buf = new Float32Array(2 * TW + 1), fb = new Float32Array(2 * FW + 1);
    for (f = 0; f < F; f++) {
      var mk = new Float32Array(B), sMag = FS ? FS[f] : null;
      for (k = 0; k < B; k++) {
        if (k < lo * 0.8 || k > hi * 1.2) { mk[k] = 0; continue; }
        var n = 0, t; for (t = -TW; t <= TW; t++) { var ff = Math.min(F - 1, Math.max(0, f + t)); buf[n++] = mag[ff][k]; }
        var harm = median(buf); n = 0;
        for (t = -FW; t <= FW; t++) { var kk = Math.min(B - 1, Math.max(0, k + t)); fb[n++] = mag[f][kk]; }
        var perc = median(fb), hm = harm * harm / (harm * harm + perc * perc + 1e-12);
        var cm = 1;
        if (sMag) { var ms = mag[f][k], ss = Math.hypot(sMag.re[k], sMag.im[k]); var ratio = ms * ms / (ms * ms + 4 * ss * ss + 1e-12); cm = Math.pow(ratio, 1 + 2 * str); }
        var band = k < lo ? k / lo : (k > hi ? Math.max(0, 1 - (k - hi) / (hi * 0.2)) : 1);
        var v = Math.pow(hm, 0.5 + str) * cm * band;
        mk[k] = v; vSum += v * mag[f][k] * mag[f][k]; tSum += mag[f][k] * mag[f][k];
      }
      masks.push(mk);
    }
    // lisciatura temporale delle maschere (meno "acqua" nel suono)
    for (f = 1; f < F; f++) for (k = 0; k < B; k++) masks[f][k] = 0.6 * masks[f][k] + 0.4 * masks[f - 1][k];
    var VF = FM.map(function (fr, f2) { var re = new Float32Array(B), im = new Float32Array(B); for (var b = 0; b < B; b++) { re[b] = fr.re[b] * masks[f2][b]; im[b] = fr.im[b] * masks[f2][b]; } return { re: re, im: im }; });
    var voice = istft(VF, len), baseL = new Float32Array(len), baseR = new Float32Array(len);
    for (i = 0; i < len; i++) { baseL[i] = L[i] - voice[i]; baseR[i] = (stereo ? R[i] : L[i]) - voice[i]; }
    return { voice: voice, baseL: baseL, baseR: baseR, stereo: stereo,
      report: { stereo: stereo, voiceShare: tSum > 0 ? vSum / tSum : 0, note: stereo ? 'Separazione da stereo (centro + armonico + banda voce).' : 'File mono: separazione più debole (solo armonico + banda voce).' } };
  }

  /**
   * Come separate, ma a blocchi di ~15 s (sfumati tra loro) cedendo il controllo: la pagina resta viva sul telefono.
   * onProgress(0-1). Ritorna la stessa forma di separate.
   */
  async function separateAsync(L, R, sr, opt, onProgress) {
    var len = L.length, blk = Math.round(sr * 15), ov = Math.round(sr * 0.5), stereo = !!(R && R.length === len);
    var voice = new Float32Array(len), wsum = new Float32Array(len), share = 0, nb = 0;
    for (var s0 = 0; s0 < len; s0 += blk) {
      var a = Math.max(0, s0 - ov), b = Math.min(len, s0 + blk + ov);
      var r = separate(L.subarray(a, b), stereo ? R.subarray(a, b) : null, sr, opt);
      for (var i = a; i < b; i++) {
        var w = 1; if (i < s0 + ov && s0 > 0) w = (i - a) / (2 * ov); if (i > s0 + blk - ov && b < len) w = Math.min(w, (b - i) / (2 * ov));
        voice[i] += r.voice[i - a] * w; wsum[i] += w;
      }
      share += r.report.voiceShare; nb++;
      if (onProgress) onProgress(Math.min(1, b / len));
      await new Promise(function (res) { setTimeout(res, 0); });
    }
    var baseL = new Float32Array(len), baseR = new Float32Array(len);
    for (i = 0; i < len; i++) { if (wsum[i] > 0) voice[i] /= wsum[i]; baseL[i] = L[i] - voice[i]; baseR[i] = (stereo ? R[i] : L[i]) - voice[i]; }
    return { voice: voice, baseL: baseL, baseR: baseR, stereo: stereo, report: { stereo: stereo, voiceShare: nb ? share / nb : 0, note: stereo ? 'Separazione da stereo (centro + armonico + banda voce).' : 'File mono: separazione più debole (solo armonico + banda voce).' } };
  }

  /** Ripulisce e amplifica: sottrazione spettrale del rumore costante, taglio sotto 30 Hz, normalizza a -1 dB. */
  function clean(x, sr, opt) {
    opt = opt || {};
    var amount = opt.denoise == null ? 0.6 : Math.max(0, Math.min(1, opt.denoise));
    var len = x.length, Fr = stft(x), B = N / 2 + 1, F = Fr.length, k, f;
    var floor = new Float32Array(B);
    if (amount > 0 && F > 4) {
      var col = new Float32Array(F);
      for (k = 0; k < B; k++) {
        for (f = 0; f < F; f++) col[f] = Math.hypot(Fr[f].re[k], Fr[f].im[k]);
        var s = Array.prototype.slice.call(col).sort(function (a, b) { return a - b; }); floor[k] = s[Math.floor(F * 0.2)];
      }
    }
    var cut = Math.ceil(30 * N / sr);
    Fr.forEach(function (fr) {
      for (var b = 0; b < B; b++) {
        var m = Math.hypot(fr.re[b], fr.im[b]), g = 1;
        if (b < cut) g = 0;
        else if (amount > 0 && m > 0) g = Math.max(0.05, 1 - (1 + amount * 4) * floor[b] / m);
        fr.re[b] *= g; fr.im[b] *= g;
      }
    });
    var y = istft(Fr, len), pk = 0, i;
    for (i = 0; i < len; i++) { var v = y[i] < 0 ? -y[i] : y[i]; if (v > pk) pk = v; }
    var gain = pk > 1e-6 ? 0.891 / pk : 1;
    for (i = 0; i < len; i++) y[i] *= gain;
    return { x: y, gainDb: 20 * Math.log10(gain), noiseRemoved: amount };
  }

  // ---------- il groove come numeri ----------
  function bandEnv(x, sr, f1, f2, hop) {
    // energia per finestra in una banda: due passa-alto e due passa-basso a un polo in cascata (12 dB/ottava),
    // così la cassa non "sporca" la banda del rullante
    var a1 = f1 > 0 ? Math.exp(-2 * Math.PI * f1 / sr) : 0, a2 = Math.exp(-2 * Math.PI * f2 / sr);
    var l1 = 0, l2 = 0, h1 = 0, h2 = 0, px = 0, p1 = 0, n = Math.floor(x.length / hop), env = new Float32Array(n), acc = 0, c = 0, j = 0;
    for (var i = 0; i < x.length; i++) {
      l1 = (1 - a2) * x[i] + a2 * l1; l2 = (1 - a2) * l1 + a2 * l2;
      var v = l2;
      if (f1 > 0) { var y1 = a1 * (h1 + v - px); px = v; h1 = y1; var y2 = a1 * (h2 + y1 - p1); p1 = y1; h2 = y2; v = y2; }
      acc += v * v; c++;
      if (c === hop) { if (j < n) env[j++] = Math.sqrt(acc / hop); acc = 0; c = 0; }
    }
    return env;
  }
  function onsets(env) {
    var o = new Float32Array(env.length);
    for (var i = 1; i < env.length; i++) { var d = env[i] - env[i - 1]; o[i] = d > 0 ? d : 0; }
    return o;
  }
  function grid(o, fps, bpm, steps, phase) {
    // somma degli attacchi su una griglia di "steps" per battuta (4/4), allineata alla fase
    var per = 240 / bpm / steps * fps, g = new Float64Array(steps), cnt = 0;
    for (var s = 0; ; s++) {
      var pos = phase + s * per, idx = Math.round(pos); if (idx >= o.length) break;
      var m = 0; for (var d = -1; d <= 1; d++) { var q = idx + d; if (q >= 0 && q < o.length && o[q] > m) m = o[q]; }
      g[s % steps] += m; cnt++;
    }
    var mx = 0; for (var i = 0; i < steps; i++) if (g[i] > mx) mx = g[i];
    return Array.prototype.map.call(g, function (v) { return mx > 0 ? v / mx : 0; });
  }
  // hi-hat: il rullante "sporca" la banda alta, quindi il riferimento è il 3° valore più forte, non il massimo
  function hatDensityOf(g) { var s = g.slice().sort(function (a, b) { return b - a; }), ref = s[2] || s[0] || 0; return ref > 0 ? g.filter(function (v) { return v > 0.35 * ref; }).length / g.length : 0; }
  function topSteps(g, thr, max) {
    var idx = g.map(function (v, i) { return [v, i]; }).filter(function (p) { return p[0] >= thr; }).sort(function (a, b) { return b[0] - a[0]; }).slice(0, max).map(function (p) { return p[1]; });
    return idx.sort(function (a, b) { return a - b; });
  }

  /**
   * Profilo misurato di una base (mono). Ritorna numeri e frasi in italiano.
   * @returns {{bpm, key, kick:number[], snare:number[], hatDensity, triplets, swing, sub, bright, energy, style, why:string[]}}
   */
  function learn(x, sr, opt) {
    opt = opt || {};
    var maxS = opt.maxSeconds || 90; if (x.length > maxS * sr) x = x.subarray(0, Math.floor(maxS * sr));
    var an = BaseAnalysis.analyze(x, sr, { maxSeconds: maxS }), bpm = an.bpm || 120;
    // le basi rap/trap stanno quasi sempre tra 60 e 160: riporta i doppi/metà nella zona giusta
    var bpmUse = bpm; while (bpmUse > 165) bpmUse /= 2; while (bpmUse < 70) bpmUse *= 2; // sotto 70 è quasi sempre metà tempo
    var hop = Math.round(sr / 200), fps = sr / hop;
    var kE = bandEnv(x, sr, 0, 120, hop), sE = bandEnv(x, sr, 180, 2500, hop), hE = bandEnv(x, sr, 6000, Math.min(sr / 2 - 100, 14000), hop), all = bandEnv(x, sr, 0, sr / 2 - 100, hop);
    var kO = onsets(kE), sO = onsets(sE), hO = onsets(hE);
    function measure(bp) {
      // fase: il punto della battuta dove la cassa colpisce di più
      var barF = 240 / bp * fps, bestP = 0, bestV = -1;
      // la cassa sull'1 e il rullante sul 3 (metà tempo) o sul 2 e 4: così la battuta parte dal punto giusto
      var at = function (o, p) { var i = Math.round(p), m = 0; for (var d = -1; d <= 1; d++) if ((o[i + d] || 0) > m) m = o[i + d]; return m; };
      // 1) i punti dove la cassa colpisce forte; 2) tra questi vince quello col rullante sul "3" (metà tempo) o sul "2 e 4"
      var cand = [], kmax = 0;
      for (var ph = 0; ph < barF; ph += 1) {
        var kv = 0, s8 = 0, s4 = 0;
        for (var pos = ph; pos < kO.length; pos += barF) { kv += at(kO, pos); s8 += at(sO, pos + barF / 2); s4 += (at(sO, pos + barF / 4) + at(sO, pos + barF * 3 / 4)) / 2; }
        cand.push([ph, kv, Math.max(s8, s4)]); if (kv > kmax) kmax = kv;
      }
      cand.forEach(function (c) { if (c[1] >= kmax * 0.7) { var sv = c[2] + 0.2 * c[1]; if (sv > bestV) { bestV = sv; bestP = c[0]; } } });
      var hg = grid(hO, fps, bp, 16, bestP);
      return { bp: bp, barF: barF, P: bestP, kg: grid(kO, fps, bp, 16, bestP), sg: grid(sO, fps, bp, 16, bestP), hg: hg, h3: grid(hO, fps, bp, 24, bestP), hd: hatDensityOf(hg) };
    }
    var G = measure(bpmUse);
    // metà o doppio? Se anche al doppio della velocità gli hi-hat cadono su (quasi) tutti i sedicesimi, la velocità vera è il doppio
    if (bpmUse * 2 <= 170) { var G2 = measure(bpmUse * 2); if (G2.hd >= 0.6) { G = G2; bpmUse *= 2; } }
    var bestP = G.P, barF = G.barF, kg = G.kg, sg = G.sg, hg = G.hg, h3 = G.h3;
    var kick = topSteps(kg, 0.45, 5); if (kick.indexOf(0) < 0) kick.unshift(0);
    // rullante: i due schemi comuni sono "metà tempo" (passo 9) o "2 e 4" (passi 5 e 13): vince il più forte
    var s8 = sg[8], s4 = (sg[4] + sg[12]) / 2;
    var snare = s8 >= s4 * 1.05 ? [8] : [4, 12];
    var hatDensity = G.hd;
    var onT = 0; h3.forEach(function (v, i) { if (i % 3 !== 0) onT += v; }); // i%3==0 coincide con un sedicesimo
    var triplets = Math.max(0, Math.min(1, onT / (h3.reduce(function (a, c) { return a + c; }, 0) + 1e-9)));
    // swing: il sedicesimo "in levare" arriva in ritardo?
    var sw = 0, cnt = 0, per = 240 / bpmUse / 16 * fps;
    for (var s = 1; s * per + bestP < hO.length; s += 2) {
      var c0 = Math.round(bestP + s * per), best = 0, bi = 0;
      for (var d = -Math.round(per * 0.4); d <= Math.round(per * 0.5); d++) { var v = hO[c0 + d] || 0; if (v > best) { best = v; bi = d; } }
      if (best > 0) { sw += bi / per; cnt++; }
    }
    var swing = cnt ? Math.max(0, Math.min(0.3, sw / cnt)) : 0;
    var mean = function (a) { var t = 0; for (var i = 0; i < a.length; i++) t += a[i]; return a.length ? t / a.length : 0; };
    var kM = mean(kE), aM = mean(all) + 1e-9, hM = mean(hE);
    var sub = Math.max(0, Math.min(1, kM / aM)), bright = Math.max(0, Math.min(1, hM / aM * 4));
    // energia per sezioni di 8 battute (curva della canzone)
    var curve = [], segF = Math.round(barF * 8); for (var q = 0; q + segF <= all.length; q += segF) curve.push(mean(all.subarray(q, q + segF)));
    var cmx = Math.max.apply(null, curve.concat([1e-9])); curve = curve.map(function (v) { return Math.round(v / cmx * 100) / 100; });
    var prof = { bpm: Math.round(bpmUse), bpmRaw: an.bpm, bpmStrength: an.bpmStrength, key: an.key ? { tonic: an.key.tonic, mode: an.key.mode, name: an.key.name, level: an.key.level || an.key.confidence } : null,
      kick: kick, snare: snare, hatDensity: Math.round(hatDensity * 100) / 100, triplets: Math.round(triplets * 100) / 100, swing: Math.round(swing * 100) / 100,
      sub: Math.round(sub * 100) / 100, bright: Math.round(bright * 100) / 100, curve: curve, seconds: Math.round(x.length / sr) };
    prof.style = closestStyle(prof);
    prof.why = describe(prof);
    return prof;
  }

  function closestStyle(p) {
    var snareHalf = p.snare.indexOf(8) >= 0 && p.snare.indexOf(4) < 0;
    var sc = {
      trap: (p.bpm >= 125 && p.bpm <= 160 ? 2 : 0) + (snareHalf ? 2 : 0) + p.hatDensity * 2 + p.sub * 2,
      drill: (p.bpm >= 135 && p.bpm <= 150 ? 2 : 0) + (snareHalf ? 1.5 : 0) + p.triplets * 4 + p.sub * 1.5 + (p.kick.length <= 3 ? 0.5 : 0),
      melodico: (p.bpm >= 80 && p.bpm <= 110 ? 2 : 0) + (p.snare.indexOf(4) >= 0 ? 2 : 0) + p.swing * 6 + (1 - p.hatDensity),
      estate: (p.bpm >= 90 && p.bpm <= 115 ? 1.5 : 0) + (p.kick.length >= 4 ? 2.5 : 0) + p.bright,
      epico: (p.bpm <= 90 ? 2 : 0) + (1 - p.hatDensity) * 1.5 + (p.curve.length > 1 ? Math.max.apply(null, p.curve) - Math.min.apply(null, p.curve) : 0) * 2
    };
    return Object.keys(sc).sort(function (a, b) { return sc[b] - sc[a]; })[0];
  }
  function describe(p) {
    var w = [];
    w.push('Velocità ' + p.bpm + ' BPM' + (p.bpmStrength < 0.3 ? ' (stima incerta)' : '') + '.');
    if (p.key) w.push('Tonalità stimata: ' + p.key.name + '.');
    w.push('Cassa sui passi ' + p.kick.map(function (s) { return s + 1; }).join(', ') + ' di 16; rullante sul ' + p.snare.map(function (s) { return s + 1; }).join(' e ') + (p.snare.indexOf(8) >= 0 && p.snare.indexOf(4) < 0 ? ' (metà tempo, tipico trap/drill).' : '.'));
    w.push(p.hatDensity > 0.7 ? 'Hi-hat fitti (quasi tutti i sedicesimi).' : (p.hatDensity > 0.35 ? 'Hi-hat a ottavi, medi.' : 'Hi-hat radi: c\'è spazio.'));
    if (p.triplets > 0.35) w.push('Molte terzine negli hi-hat (sensazione drill/rullata).');
    if (p.swing > 0.06) w.push('Groove con swing (' + Math.round(p.swing * 100) + '%): non è rigido.');
    w.push(p.sub > 0.55 ? 'Bassi molto pesanti (808 in primo piano).' : (p.sub > 0.3 ? 'Bassi presenti ma bilanciati.' : 'Bassi leggeri.'));
    w.push(p.bright > 0.5 ? 'Suono brillante, tanti alti.' : 'Suono più scuro/caldo.');
    return w;
  }

  /** Dai profili che ti piacciono (e da quelli che non ti piacciono) ricava le impostazioni della base nuova. */
  function blend(likes, dislikes) {
    likes = (likes || []).filter(Boolean); dislikes = (dislikes || []).filter(Boolean);
    if (!likes.length) return null;
    var avg = function (k) { var t = 0; likes.forEach(function (p) { t += p[k]; }); var v = t / likes.length; if (dislikes.length) { var d = 0; dislikes.forEach(function (p) { d += p[k]; }); d /= dislikes.length; v = v + (v - d) * 0.3; } return v; };
    var votes = {}; likes.forEach(function (p) { votes[p.style] = (votes[p.style] || 0) + 1; }); dislikes.forEach(function (p) { votes[p.style] = (votes[p.style] || 0) - 0.5; });
    var style = Object.keys(votes).sort(function (a, b) { return votes[b] - votes[a]; })[0];
    // cassa: passi presenti in più della metà dei profili che piacciono
    var cnt = {}; likes.forEach(function (p) { p.kick.forEach(function (s) { cnt[s] = (cnt[s] || 0) + 1; }); });
    var kickA = Object.keys(cnt).map(Number).filter(function (s) { return cnt[s] > likes.length / 2; }).sort(function (a, b) { return a - b; });
    if (kickA.indexOf(0) < 0) kickA.unshift(0);
    // variazione originale: la seconda battuta sposta un colpo di un sedicesimo (non copia nessuno)
    var kickB = kickA.slice(); if (kickB.length > 1) { var j = kickB.length - 1; kickB[j] = Math.min(15, kickB[j] + 1); } else kickB.push(10);
    var sn = {}; likes.forEach(function (p) { sn[p.snare.join(',')] = (sn[p.snare.join(',')] || 0) + 1; });
    var snare = Object.keys(sn).sort(function (a, b) { return sn[b] - sn[a]; })[0].split(',').map(Number);
    var hat = avg('hatDensity'), trip = avg('triplets'), swing = Math.max(0, Math.min(0.3, avg('swing'))), sub = avg('sub');
    var keys = likes.map(function (p) { return p.key; }).filter(Boolean);
    var bpmL = 0; likes.forEach(function (p) { bpmL += p.bpm; });
    return {
      genre: style, bpm: Math.round(bpmL / likes.length), mode: keys.length ? (keys.filter(function (k) { return k.mode === 'minore'; }).length >= keys.length / 2 ? 'minore' : 'maggiore') : 'minore',
      groove: { kickPats: [[kickA, kickB]], snare: snare, swing: swing, rolls: Math.max(0, Math.min(1, trip * 1.2 + (hat - 0.5) * 0.6)) },
      tune: { hat: Math.max(0.4, Math.min(1.6, 0.6 + hat)), bass: Math.max(0.5, Math.min(1.6, 0.6 + sub)) },
      from: likes.length, avoid: dislikes.length
    };
  }

  return { separate: separate, separateAsync: separateAsync, clean: clean, learn: learn, blend: blend, closestStyle: closestStyle, describe: describe, stft: stft, istft: istft };
});
