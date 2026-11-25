/*
 * Beat This! (CPJKU, ISMIR 2024, licenza MIT) nel browser: battiti e inizio battuta (downbeat) con una rete neurale.
 * Modello ONNX "small" (2,1 M parametri, circa 10 MB, MIT): huggingface.co/ashudesai/songbird-models (small0-v2.onnx: la prima conversione small0 trova pochi battiti, misurato).
 * Pre-elaborazione identica all'originale (beat_this/preprocessing.py, LogMelSpect):
 *   22050 Hz, n_fft 1024 (finestra di Hann), hop 441 (50 fotogrammi/s), centrata con riflessione, ampiezza (power 1),
 *   normalizzata per √n_fft (torch.stft normalized=True), 128 bande mel "slaney" senza normalizzazione tra 30 e 11000 Hz, log1p(1000·x).
 * Inferenza a pezzi di 1500 fotogrammi con 6 di bordo ("keep_first"), poi post-elaborazione "minimal":
 *   picchi = massimo locale su 7 fotogrammi con logit > 0, picchi vicini fusi, ogni downbeat spostato sul battito più vicino.
 * Si scarica SOLO a richiesta (una volta, poi resta nel telefono). Se non parte, l'app usa il metodo a regole di prima.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BeatThis = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var SR = 22050, NFFT = 1024, HOP = 441, NMEL = 128, FMIN = 30, FMAX = 11000, FPS = 50, CHUNK = 1500, BORDER = 6;
  var MODEL_URL = 'https://huggingface.co/ashudesai/songbird-models/resolve/813eff2f8a91c564783f6194b062ade2b46a3ed6/small0-v2.onnx', MODEL_MB = 10;

  /* ---------- mel come torchaudio (scala slaney, norm=None) ---------- */
  function hz2mel(f) { var fs = 200 / 3, m = f / fs, minLog = 1000, minLogMel = minLog / fs, step = Math.log(6.4) / 27; return f >= minLog ? minLogMel + Math.log(f / minLog) / step : m; }
  function mel2hz(m) { var fs = 200 / 3, minLog = 1000, minLogMel = minLog / fs, step = Math.log(6.4) / 27; return m >= minLogMel ? minLog * Math.exp(step * (m - minLogMel)) : fs * m; }
  var FB = null;
  function filterbank() {
    if (FB) return FB; var nf = NFFT / 2 + 1, mmin = hz2mel(FMIN), mmax = hz2mel(FMAX), pts = [], i, j;
    for (i = 0; i < NMEL + 2; i++) pts.push(mel2hz(mmin + (mmax - mmin) * i / (NMEL + 1)));
    FB = []; for (j = 0; j < NMEL; j++) {
      var lo = pts[j], c = pts[j + 1], hi = pts[j + 2], w = new Float32Array(nf), first = -1, last = -1;
      for (i = 0; i < nf; i++) { var f = i * (SR / 2) / (nf - 1), down = (f - lo) / (c - lo), up = (hi - f) / (hi - c), v = Math.max(0, Math.min(down, up)); w[i] = v; if (v > 0) { if (first < 0) first = i; last = i; } }
      FB.push({ w: w, a: first < 0 ? 0 : first, z: last < 0 ? -1 : last });
    }
    return FB;
  }
  /* FFT radice 2 in place */
  var TW = null;
  function fft(re, im) {
    var n = re.length, i, j, k, l;
    for (i = 1, j = 0; i < n; i++) { var bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { var t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    if (!TW) { TW = { c: new Float64Array(n / 2), s: new Float64Array(n / 2) }; for (i = 0; i < n / 2; i++) { TW.c[i] = Math.cos(2 * Math.PI * i / n); TW.s[i] = -Math.sin(2 * Math.PI * i / n); } }
    for (l = 2; l <= n; l <<= 1) { var h = l >> 1, st = n / l; for (i = 0; i < n; i += l) for (k = 0; k < h; k++) { var c = TW.c[k * st], s = TW.s[k * st], a = i + k, b = a + h, xr = re[b] * c - im[b] * s, xi = re[b] * s + im[b] * c; re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; } }
  }
  /** Ricampiona a 22050 Hz (filtro passa-basso a finestra + interpolazione). */
  function resample(x, sr) {
    if (sr === SR) return x; var ratio = sr / SR, n = Math.floor(x.length / ratio), out = new Float32Array(n), half = 8, fc = Math.min(1, 1 / ratio) * 0.95, i, k;
    for (i = 0; i < n; i++) {
      var p = i * ratio, c = Math.floor(p), s = 0, ws = 0;
      for (k = c - half + 1; k <= c + half; k++) { if (k < 0 || k >= x.length) continue; var d = p - k, sinc = d === 0 ? 1 : Math.sin(Math.PI * fc * d) / (Math.PI * fc * d), win = 0.5 + 0.5 * Math.cos(Math.PI * d / half); var w = sinc * win; s += x[k] * w; ws += w; }
      out[i] = ws ? s / ws : 0;
    }
    return out;
  }
  /** Spettrogramma log-mel (fotogrammi × 128) di un segnale mono a 22050 Hz. */
  function logMel(x) {
    var pad = NFFT / 2, n = x.length, T = 1 + Math.floor(n / HOP), out = new Float32Array(T * NMEL), win = new Float64Array(NFFT), wn = 0, i, t, j;
    for (i = 0; i < NFFT; i++) { win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / NFFT); wn += win[i] * win[i]; } // Hann periodica
    wn = Math.sqrt(NFFT); var fb = filterbank(), re = new Float64Array(NFFT), im = new Float64Array(NFFT), mag = new Float64Array(NFFT / 2 + 1);
    function at(k) { if (n === 1) return x[0]; while (k < 0 || k >= n) { if (k < 0) k = -k; if (k >= n) k = 2 * (n - 1) - k; } return x[k]; } // riflessione
    for (t = 0; t < T; t++) {
      var s0 = t * HOP - pad;
      for (i = 0; i < NFFT; i++) { re[i] = at(s0 + i) * win[i]; im[i] = 0; }
      fft(re, im);
      for (i = 0; i <= NFFT / 2; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / wn;
      for (j = 0; j < NMEL; j++) { var F = fb[j], v = 0; for (i = F.a; i <= F.z; i++) v += F.w[i] * mag[i]; out[t * NMEL + j] = Math.log1p(1000 * v); }
    }
    return { data: out, frames: T };
  }
  /* pezzi come split_piece (avoid_short_end) */
  function chunks(T) {
    var starts = [], s;
    for (s = -BORDER; s < T - BORDER; s += CHUNK - 2 * BORDER) starts.push(s);
    if (T > CHUNK - 2 * BORDER) starts[starts.length - 1] = T - (CHUNK - BORDER);
    return starts;
  }
  /** Picchi "minimal": massimo su 7 fotogrammi e logit > 0, picchi adiacenti fusi (media). */
  function peaks(logit) {
    var n = logit.length, p = [], i, k;
    for (i = 0; i < n; i++) { if (!(logit[i] > 0)) continue; var m = -Infinity; for (k = Math.max(0, i - 3); k <= Math.min(n - 1, i + 3); k++) if (logit[k] > m) m = logit[k]; if (logit[i] === m) p.push(i); }
    var out = [], grp = []; p.forEach(function (f) { if (grp.length && f - grp[grp.length - 1] > 1) { out.push(grp.reduce(function (a, b) { return a + b; }, 0) / grp.length); grp = []; } grp.push(f); });
    if (grp.length) out.push(grp.reduce(function (a, b) { return a + b; }, 0) / grp.length);
    return out;
  }
  function median(a) { if (!a.length) return 0; var s = a.slice().sort(function (x, y) { return x - y; }); return s[s.length >> 1]; }
  /** Dalle uscite della rete (logit per fotogramma) ai tempi in secondi + BPM e durata della battuta. */
  function post(beatL, downL) {
    var beats = peaks(beatL).map(function (f) { return f / FPS; }), downs = peaks(downL).map(function (f) { return f / FPS; });
    if (beats.length) downs = downs.map(function (d) { var b = beats[0], bd = Math.abs(b - d); beats.forEach(function (x) { if (Math.abs(x - d) < bd) { bd = Math.abs(x - d); b = x; } }); return b; });
    downs = downs.filter(function (d, i) { return downs.indexOf(d) === i; });
    var ib = []; for (var i = 1; i < beats.length; i++) ib.push(beats[i] - beats[i - 1]);
    var id = []; for (i = 1; i < downs.length; i++) id.push(downs[i] - downs[i - 1]);
    var bs = median(ib), bar = median(id), nb = bs && bar ? Math.round(bar / bs) : 4, bpb = nb >= 6 && nb % 2 === 0 ? nb / 2 : nb; if (!(nb >= 2 && nb <= 8)) nb = 4; if (!(bpb >= 2 && bpb <= 7)) bpb = 4; // nb: battiti tra due downbeat trovati (8 = un downbeat ogni 2 battute)
    // periodo preciso con una retta sui tempi (i fotogrammi sono di 20 ms: la mediana da sola sbaglia di qualche BPM)
    function fit(ts, per) { if (ts.length < 3 || !per) return per; var t0 = ts[0], n = 0, sk = 0, st = 0, skk = 0, skt = 0; ts.forEach(function (t) { var k = Math.round((t - t0) / per); n++; sk += k; st += t; skk += k * k; skt += k * t; }); var den = n * skk - sk * sk; return den > 0 ? (n * skt - sk * st) / den : per; }
    var barF = fit(downs, bar), beatF = fit(beats, bs), bpm = 0, conf = 0;
    if (downs.length >= 3 && barF > 0) bpm = 60 * nb / barF; else if (beatF > 0) bpm = 60 / beatF;
    // affidabilità: quanti battiti cadono sulla griglia stimata (0-1)
    if (bpm > 0 && beats.length) { var per = 60 / bpm, ref = downs.length ? downs[0] : beats[0], ok = 0; beats.forEach(function (t) { var q = (t - ref) / per; if (Math.abs(q - Math.round(q)) * per < 0.05) ok++; }); var span = beats[beats.length - 1] - beats[0]; conf = Math.min(1, ok / Math.max(1, span / per + 1)); }
    return { beats: beats, downbeats: downs, bpm: bpm, barSec: bpm ? 60 * bpb / bpm : 0, beatsPerBar: bpb, conf: Math.round(conf * 100) / 100 };
  }

  var S = { ort: null, sess: null, base: './' };
  function dir(sub) { return new URL(S.base + sub, location.href).href; }
  async function getModel(onDl) {
    var cache = null; try { cache = await caches.open('beatthis-v1'); var hit = await cache.match(MODEL_URL); if (hit) { if (onDl) onDl(1, 1, true); return new Uint8Array(await hit.arrayBuffer()); } } catch (e) {}
    var r = await fetch(MODEL_URL); if (!r.ok) throw new Error('Download del modello non riuscito (' + r.status + ')');
    var tot = +r.headers.get('content-length') || MODEL_MB * 1048576, got = 0, parts = [], rd = r.body && r.body.getReader ? r.body.getReader() : null;
    if (!rd) { var ab = new Uint8Array(await r.arrayBuffer()); parts = [ab]; got = ab.length; }
    else for (;;) { var c = await rd.read(); if (c.done) break; parts.push(c.value); got += c.value.length; if (onDl) onDl(got, tot, false); }
    var buf = new Uint8Array(got), o = 0; parts.forEach(function (p) { buf.set(p, o); o += p.length; });
    try { if (cache) await cache.put(MODEL_URL, new Response(buf, { headers: { 'Content-Type': 'application/octet-stream' } })); } catch (e) {}
    return buf;
  }
  /** Carica onnxruntime-web (già nel progetto, cartella ort126) e il modello. Una volta sola. */
  async function load(onDl, ortMod) {
    if (S.sess) return S.sess;
    var ort = ortMod || S.ort; if (!ort) { ort = await import(dir('ort126/ort.webgpu.min.mjs')); ort = ort.default || ort; ort.env.wasm.wasmPaths = dir('ort126/'); ort.env.wasm.numThreads = (typeof self !== 'undefined' && self.crossOriginIsolated) ? Math.min(4, navigator.hardwareConcurrency || 2) : 1; }
    S.ort = ort; var bytes = await getModel(onDl);
    S.sess = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
    return S.sess;
  }
  async function cached() { try { var c = await caches.open('beatthis-v1'); return !!(await c.match(MODEL_URL)); } catch (e) { return false; } }
  /**
   * Analizza un segnale mono. onProg(0-1). run(spec Float32Array T×128, T) → {beat, downbeat} (per i test si può passare un esecutore).
   * Ritorna {beats, downbeats, bpm, barSec, beatsPerBar, frames}.
   */
  async function track(x, sr, onProg, run) {
    var y = resample(x, sr), M = logMel(y), T = M.frames, beatL = new Float32Array(T), downL = new Float32Array(T), filled = new Uint8Array(T);
    run = run || async function (spec, n) {
      var ten = new S.ort.Tensor('float32', spec, [1, n, NMEL]), feed = {}; feed[S.sess.inputNames[0]] = ten; var out = await S.sess.run(feed), on = S.sess.outputNames;
      return { beat: (out.beat || out[on[0]]).data, downbeat: (out.downbeat || out[on[1]]).data };
    };
    var st = chunks(T);
    for (var c = 0; c < st.length; c++) {
      var s0 = st[c], a = Math.max(0, s0), z = Math.min(T, s0 + CHUNK), left = Math.max(0, -s0), right = Math.max(0, Math.min(BORDER, s0 + CHUNK - T)), n = left + (z - a) + right;
      var spec = new Float32Array(n * NMEL); spec.set(M.data.subarray(a * NMEL, z * NMEL), left * NMEL);
      var o = await run(spec, n);
      // tieni il centro (senza i bordi) e, dove i pezzi si sovrappongono, il primo arrivato (keep_first)
      for (var i = BORDER; i < n - BORDER; i++) { var f = s0 + i; if (f < 0 || f >= T || filled[f]) continue; beatL[f] = o.beat[i]; downL[f] = o.downbeat[i]; filled[f] = 1; }
      if (onProg) onProg((c + 1) / st.length);
    }
    var r = post(beatL, downL); r.frames = T; return r;
  }
  return { SR: SR, FPS: FPS, MODEL_URL: MODEL_URL, MODEL_MB: MODEL_MB, logMel: logMel, resample: resample, chunks: chunks, peaks: peaks, post: post, load: load, track: track, cached: cached, setBase: function (b) { S.base = b; }, _hz2mel: hz2mel };
});
