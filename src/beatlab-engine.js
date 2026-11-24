/*
 * Beat Lab - motore (Tappa 1).
 * SCELTA: Web Audio puro, senza Tone.js. Motivi: (1) non serve scaricare nulla (la pagina resta un file solo e funziona
 * offline come PWA); (2) lo stesso identico codice suona in tempo reale e viene reso con OfflineAudioContext per il WAV;
 * (3) la tempistica (swing, rullate, loop) e' scritta qui e si puo' testare con Node senza audio; (4) licenza: nessuna
 * dipendenza. Tone.js (MIT) avrebbe dato Transport e sintetizzatori pronti, ma non copre il mixer a mandate e il
 * sidechain che servono dopo, e peserebbe ~250 KB in piu'.
 *
 * Contenuto: modello del progetto, tempo (tick), swing, rullate, scheduler con lookahead, grafo audio (tracce, volume,
 * pan, mute/solo, misuratori), Player in tempo reale, esportazione WAV, codifica WAV.
 */
(function (root, factory) {
  var V = (typeof module === 'object' && module.exports) ? require('./beatlab-voices.js') : root.BeatVoices;
  var S = (typeof module === 'object' && module.exports) ? require('./samples-data.js') : (root.SampleData || null);
  if (typeof module === 'object' && module.exports) module.exports = factory(V, S, root);
  else root.BeatEngine = factory(V, S, root);
})(typeof self !== 'undefined' ? self : this, function (Voices, SampleData, root) {
  'use strict';

  var PPQ = 96;               // tick per quarto
  var BAR = PPQ * 4;          // 384 tick per battuta (4/4)
  var LANES = [
    { id: 'kick', name: 'Cassa', short: 'CS' }, { id: 'snare', name: 'Rullante', short: 'RU' }, { id: 'clap', name: 'Clap', short: 'CL' },
    { id: 'hat', name: 'Hi-hat', short: 'HH' }, { id: 'ohat', name: 'Hi-hat aperto', short: 'OH' }, { id: 'perc', name: 'Tom / perc', short: 'PC' }
  ];
  var LANE_IDS = LANES.map(function (l) { return l.id; });
  var ROLLS = [0, 2, 3, 4]; // 0 niente, 2 = due colpi nel passo (1/32), 3 = terzina, 4 = quattro colpi

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  var uidn = 0; function uid(p) { uidn++; return (p || 't') + uidn.toString(36) + Math.floor(Math.random() * 1296).toString(36); }

  /* ---------------- progetto ---------------- */
  function newDrumTrack(lane, len) {
    var l = LANES.filter(function (x) { return x.id === lane; })[0] || LANES[0];
    var z = []; for (var i = 0; i < len; i++) z.push(0);
    return { id: 'd-' + l.id, kind: 'drum', lane: l.id, name: l.name, steps: z.slice(), roll: z.slice(), rollShape: 'down', tune: 0, vol: lane === "kick" ? 0.8 : 0.7, pan: 0, mute: false, solo: false };
  }
  function newInstTrack(inst, name) {
    var I = Voices.INSTRUMENTS[inst] || Voices.INSTRUMENTS.sub808;
    return { id: uid('i-'), kind: 'inst', inst: inst, name: name || I.name, notes: [], vol: inst === "sub808" ? 0.7 : 0.7, pan: 0, mute: false, solo: false, params: {} };
  }
  function newProject(o) {
    o = o || {};
    var bars = o.bars || 2, res = o.res || 16, len = bars * res;
    var p = { v: 1, name: o.name || 'Il mio beat', bpm: o.bpm || 140, swing: o.swing == null ? 50 : o.swing, bars: bars, res: res, kit: o.kit || 'sintetico',
      key: { root: 0, scale: 'minor' }, style: o.style || 'trap', tracks: [], master: { vol: 0.75 } };
    LANE_IDS.forEach(function (l) { p.tracks.push(newDrumTrack(l, len)); });
    return p;
  }
  function drumTracks(p) { return p.tracks.filter(function (t) { return t.kind === 'drum'; }); }
  function trackById(p, id) { for (var i = 0; i < p.tracks.length; i++) if (p.tracks[i].id === id) return p.tracks[i]; return null; }

  // Cambia numero di battute e/o risoluzione (16 o 32 passi per battuta) conservando il disegno.
  function resize(p, bars, res) {
    bars = clamp(Math.round(bars || p.bars), 1, 8); res = res === 32 ? 32 : 16;
    var oldRes = p.res, oldLen = p.bars * p.res, len = bars * res;
    drumTracks(p).forEach(function (t) {
      var s = [], r = [];
      for (var i = 0; i < len; i++) {
        var bar = Math.floor(i / res), pos = i % res, srcBar = bar % p.bars, srcPos;
        if (res === oldRes) srcPos = pos; else if (res > oldRes) srcPos = (pos % 2 === 0) ? pos / 2 : -1; else srcPos = pos * 2;
        var k = srcPos < 0 ? -1 : srcBar * oldRes + srcPos;
        s.push(k >= 0 && k < oldLen ? t.steps[k] : 0); r.push(k >= 0 && k < oldLen ? t.roll[k] : 0);
        if (res < oldRes) { // 32 -> 16: se il passo "in mezzo" c'era, diventa una rullata da 2
          var mid = srcBar * oldRes + pos * 2 + 1;
          if (mid < oldLen && t.steps[mid] > 0 && t.steps[k] > 0 && !r[r.length - 1]) r[r.length - 1] = 2;
          else if (mid < oldLen && t.steps[mid] > 0 && !(t.steps[k] > 0)) { s[s.length - 1] = t.steps[mid]; }
        }
      }
      t.steps = s; t.roll = r;
    });
    var loopOld = p.bars;
    p.bars = bars; p.res = res;
    p.tracks.forEach(function (t) { if (t.kind === 'inst') { // note: se si allunga il loop si ripete il disegno
      if (bars > loopOld) { var add = []; for (var b = loopOld; b < bars; b++) t.notes.forEach(function (n) { if (n.t < loopOld * BAR) add.push({ t: n.t + b * BAR, d: n.d, n: n.n, v: n.v, s: n.s }); }); t.notes = t.notes.concat(add); }
      else t.notes = t.notes.filter(function (n) { return n.t < bars * BAR; });
    } });
    return p;
  }

  /* ---------------- tempo ---------------- */
  function secPerTick(bpm) { return 60 / (bpm * PPQ); }
  function loopTicks(p) { return p.bars * BAR; }
  // Swing: le note sulla "e" dei sedicesimi (tick 24 dentro ogni ottavo) cadono a swing% dell'ottavo invece che al 50%.
  // 50 = dritto, 66 = terzina (shuffle), 75 = quasi puntato. Ritardo in tick.
  function swingDelay(tick, swing) {
    var inEighth = ((tick % 48) + 48) % 48;
    if (Math.abs(inEighth - 24) > 0.001) return 0;
    return Math.max(0, (clamp(swing, 50, 75) / 100) * 48 - 24);
  }
  function rollVel(v, k, n, shape) {
    var f;
    if (shape === 'up') f = 0.55 + 0.45 * (k / Math.max(1, n - 1));
    else if (shape === 'flat') f = 1;
    else if (shape === 'dip') f = k === 0 || k === n - 1 ? 1 : 0.62; // piu' bassa al centro
    else f = 1 - 0.38 * (k / Math.max(1, n - 1));
    return clamp(Math.round(v * f), 1, 127);
  }

  // Eventi del progetto con tick nominale in [t0,t1) (tick assoluti, il loop si ripete). Il ritardo dello swing e' a parte.
  function eventsInRange(p, t0, t1) {
    var L = loopTicks(p), out = [], k0 = Math.floor(t0 / L), k1 = Math.floor((t1 - 1e-9) / L);
    var anySolo = p.tracks.some(function (t) { return t.solo; });
    var stepT = BAR / p.res;
    for (var k = k0; k <= k1; k++) {
      var a = Math.max(t0, k * L) - k * L, b = Math.min(t1, (k + 1) * L) - k * L, base = k * L;
      if (b <= a) continue;
      p.tracks.forEach(function (tr) {
        var audible = !tr.mute && (!anySolo || tr.solo);
        if (tr.kind === 'drum') {
          var i0 = Math.max(0, Math.floor(a / stepT)), i1 = Math.min(tr.steps.length - 1, Math.floor((b - 1e-9) / stepT));
          for (var i = i0; i <= i1; i++) {
            var vel = tr.steps[i]; if (!(vel > 0)) continue;
            var n = tr.roll[i] >= 2 ? tr.roll[i] : 1;
            for (var j = 0; j < n; j++) {
              var tk = i * stepT + j * stepT / n;
              if (tk < a - 1e-9 || tk >= b - 1e-9) continue;
              out.push({ tick: base + tk, delay: swingDelay(tk, p.swing), track: tr.id, type: 'drum', lane: tr.lane, vel: j === 0 && n === 1 ? vel : rollVel(vel, j, n, tr.rollShape), audible: audible, tune: tr.tune || 0 });
            }
          }
        } else if (tr.kind === 'inst') {
          var notes = tr.notes, mono = !!(Voices.INSTRUMENTS[tr.inst] && Voices.INSTRUMENTS[tr.inst].mono);
          var sorted = mono ? notes.slice().sort(function (x, y) { return x.t - y.t; }) : null;
          notes.forEach(function (nt) {
            if (nt.t < a - 1e-9 || nt.t >= b - 1e-9) return;
            var ev = { tick: base + nt.t, delay: swingDelay(nt.t, p.swing), track: tr.id, type: 'note', midi: nt.n, vel: nt.v || 100, durTicks: nt.d, audible: audible, mono: mono };
            if (mono && nt.s) { // glide: parte dalla nota precedente (a catena)
              var prev = null; for (var q = 0; q < sorted.length; q++) { if (sorted[q] === nt) break; if (sorted[q].t < nt.t) prev = sorted[q]; }
              if (!prev && sorted.length) prev = sorted[sorted.length - 1]; // a inizio loop collega con l'ultima
              if (prev) ev.glideFrom = prev.n;
            }
            out.push(ev);
          });
        }
      });
    }
    out.sort(function (x, y) { return x.tick - y.tick; });
    return out;
  }

  /* ---------------- scheduler con lookahead ---------------- */
  // Non usa l'audio: chiede l'ora con now() e consegna gli eventi con onEvent(ev, quandoInSecondi). Si prova con un orologio finto.
  function Scheduler(o) {
    this.getProject = o.getProject; this.now = o.now; this.onEvent = o.onEvent;
    this.lookahead = o.lookahead || 0.12; this.chunk = o.chunk || 12; this.running = false; this.hist = [];
  }
  Scheduler.prototype.start = function (at, fromTick) {
    this.running = true; this.nextTick = fromTick || 0; this.nextTime = at == null ? this.now() + 0.06 : at; this.hist = [{ time: this.nextTime, tick: this.nextTick }];
  };
  Scheduler.prototype.stop = function () { this.running = false; this.hist = []; };
  Scheduler.prototype.pump = function () {
    if (!this.running) return 0;
    var p = this.getProject(), horizon = this.now() + this.lookahead, count = 0, guard = 0;
    while (this.nextTime < horizon && guard++ < 2000) {
      var spt = secPerTick(p.bpm), evs = eventsInRange(p, this.nextTick, this.nextTick + this.chunk);
      for (var i = 0; i < evs.length; i++) {
        var e = evs[i], when = this.nextTime + (e.tick - this.nextTick + e.delay) * spt;
        this.onEvent(e, when, spt); count++;
      }
      this.nextTime += this.chunk * spt; this.nextTick += this.chunk;
      this.hist.push({ time: this.nextTime, tick: this.nextTick });
    }
    var n = this.now(), cut = 0; while (cut < this.hist.length - 2 && this.hist[cut + 1].time <= n) cut++;
    if (cut > 0) this.hist.splice(0, cut);
    return count;
  };
  // Posizione (tick dentro il loop) all'istante t: per far muovere il cursore.
  Scheduler.prototype.positionAt = function (t) {
    var h = this.hist; if (!h.length) return 0;
    var cur = h[0]; for (var i = 0; i < h.length; i++) if (h[i].time <= t) cur = h[i];
    var p = this.getProject(), tick = cur.tick + Math.max(0, (t - cur.time) / secPerTick(p.bpm));
    return ((tick % loopTicks(p)) + loopTicks(p)) % loopTicks(p);
  };

  /* ---------------- campioni batteria (samples-data.js) ---------------- */
  var KITS = {
    sintetico: { name: 'Sintetico (sempre disponibile)', pick: null },
    kitA: { name: 'Campioni A', pick: { kick: 0, snare: 0, clap: 0 } },
    kitB: { name: 'Campioni B', pick: { kick: 1, snare: 1, clap: 1 } },
    kitC: { name: 'Campioni C', pick: { kick: 2, snare: 2, clap: 2 } }
  };
  function b64bytes(s) { if (typeof atob === 'function') { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; } return new Uint8Array(Buffer.from(s, 'base64')); }
  function decodeSample(s) { // base64 int16 little endian -> Float32Array
    var u = b64bytes(s), n = u.length >> 1, f = new Float32Array(n);
    for (var i = 0; i < n; i++) { var v = u[2 * i] | (u[2 * i + 1] << 8); if (v > 32767) v -= 65536; f[i] = v / 32768; }
    return f;
  }
  function fitSample(f, maxSec, fadeSec, sr) {
    var n = Math.min(f.length, Math.round(maxSec * sr)), o = f.slice(0, n), fd = Math.min(n, Math.round(fadeSec * sr));
    for (var i = 0; i < fd; i++) o[n - 1 - i] *= i / fd;
    return o;
  }
  var kitCache = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
  function kitBuffers(ctx, kit) {
    var K = KITS[kit]; if (!K || !K.pick || !SampleData) return null;
    var perCtx = kitCache.get(ctx); if (!perCtx) { perCtx = {}; kitCache.set(ctx, perCtx); }
    if (perCtx[kit]) return perCtx[kit];
    var sr = SampleData.sr, out = {};
    function mk(arr, maxSec, fade) { var f = fitSample(decodeSample(arr), maxSec, fade, sr), b = ctx.createBuffer(1, f.length, sr); b.getChannelData(0).set(f); return b; }
    out.kick = mk(SampleData.data.kick[K.pick.kick % SampleData.data.kick.length], 0.6, 0.05);
    out.snare = mk(SampleData.data.snare[K.pick.snare % SampleData.data.snare.length], 0.45, 0.05);
    out.clap = mk(SampleData.data.clap[K.pick.clap % SampleData.data.clap.length], 0.4, 0.05);
    out.hat = mk(SampleData.data.hat[0], 0.07, 0.03);
    out.ohat = mk(SampleData.data.hat[1], 0.25, 0.08);
    perCtx[kit] = out; return out;
  }
  function playBuffer(ctx, dest, buf, vel, when, rate) {
    var s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; s.playbackRate.value = rate || 1; g.gain.value = Voices.velGain(vel) * 0.9;
    s.connect(g); g.connect(dest); s.start(when);
    return { stop: function (t) { try { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.006); } catch (e) {} } };
  }

  /* ---------------- grafo audio ---------------- */
  function audibleOf(p, t) {
    var anySolo = p.tracks.some(function (x) { return x.solo; });
    return !t.mute && (!anySolo || t.solo);
  }
  /* ---- effetti per traccia (Tappa 4) ----
   * ingresso -> EQ 3 bande -> saturazione (parallela) -> compressore -> sidechain (abbassamento a tempo di cassa) -> pan -> volume
   * dal volume partono due mandate (riverbero, delay) verso i bus; tutto va al master: [glue] -> limiter -> tetto -> misuratore.
   * NOTA ONESTA: Web Audio non ha un vero ingresso "sidechain" per il compressore; l'abbassamento segue gli eventi della cassa
   * (stessi istanti, curva a rilascio), e funziona uguale in tempo reale e nell'esportazione.
   */
  function defaultFx() { return { eq: { low: 0, mid: 0, high: 0 }, sat: 0, comp: 0, sc: 0, rev: 0, dly: 0 }; }
  function fxOf(t) { if (!t.fx) t.fx = defaultFx(); if (!t.fx.eq) t.fx.eq = { low: 0, mid: 0, high: 0 }; return t.fx; }
  function masterOf(p) { var m = p.master; if (m.ceil == null) m.ceil = -1; if (m.revSize == null) m.revSize = 1.8; if (m.dlyFb == null) m.dlyFb = 0.35; if (m.dlyDiv == null) m.dlyDiv = 0; if (m.glue == null) m.glue = 0; return m; }
  function satCurve(drive) { var n = 1024, c = new Float32Array(n), k = 1 + drive * 14; for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; }
  function reverbIR(ctx, sec) {
    var sr = ctx.sampleRate, len = Math.max(1, Math.floor(sr * sec)), b = ctx.createBuffer(2, len, sr), seed = 7;
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c), lp = 0; for (var i = 0; i < len; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; var n = (seed / 4294967296) * 2 - 1, t = i / len; lp += (n - lp) * (0.9 - 0.75 * t); d[i] = lp * Math.pow(1 - t, 3) * (i < sr * 0.004 ? i / (sr * 0.004) : 1); } }
    return b;
  }
  function limiterCurve(ceilLin) { var n = 4096, c = new Float32Array(n); for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1, a = Math.abs(x), th = ceilLin * 0.9; var y = a <= th ? a : th + (ceilLin - th) * Math.tanh((a - th) / (ceilLin - th)); c[i] = (x < 0 ? -1 : 1) * y; } return c; }
  function createGraph(ctx, p) {
    var M = masterOf(p), G = { ctx: ctx, tracks: {}, voices: {}, ohat: null };
    var master = ctx.createGain(); master.gain.value = M.vol;
    var glue = ctx.createDynamicsCompressor(); glue.threshold.value = -14; glue.knee.value = 12; glue.ratio.value = 2; glue.attack.value = 0.03; glue.release.value = 0.2;
    var glueMix = ctx.createGain(), dry = ctx.createGain(), sum = ctx.createGain(); glueMix.gain.value = 0; dry.gain.value = 1;
    var lim = ctx.createDynamicsCompressor(); lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.06;
    var clip = ctx.createWaveShaper(); clip.oversample = '4x'; clip.curve = limiterCurve(Math.pow(10, (M.ceil - 0.5) / 20)); lim.threshold.value = M.ceil - 1.5;
    var an = ctx.createAnalyser(); an.fftSize = 1024;
    master.connect(dry); dry.connect(sum); master.connect(glue); glue.connect(glueMix); glueMix.connect(sum);
    sum.connect(lim); lim.connect(clip); clip.connect(an); an.connect(ctx.destination);
    // bus effetti
    var conv = ctx.createConvolver(); conv.buffer = reverbIR(ctx, M.revSize); var revIn = ctx.createGain(), revOut = ctx.createGain(); revOut.gain.value = 0.8; revIn.connect(conv); conv.connect(revOut); revOut.connect(master);
    var dly = ctx.createDelay(2); var dIn = ctx.createGain(), dFb = ctx.createGain(), dLp = ctx.createBiquadFilter(), dOut = ctx.createGain(); dLp.type = 'lowpass'; dLp.frequency.value = 3200; dOut.gain.value = 0.7;
    dIn.connect(dly); dly.connect(dLp); dLp.connect(dFb); dFb.connect(dly); dLp.connect(dOut); dOut.connect(master);
    G.master = master; G.masterAnalyser = an; G.safety = lim; G.limiter = lim; G.clip = clip; G.glue = glue; G.glueMix = glueMix; G.dry = dry; G.out = an;
    G.revIn = revIn; G.conv = conv; G.revSize = M.revSize; G.dly = dly; G.dIn = dIn; G.dFb = dFb; G.ceil = M.ceil;
    p.tracks.forEach(function (t) { addTrack(G, t); });
    applyMix(G, p);
    return G;
  }
  function addTrack(G, t) {
    var ctx = G.ctx, input = ctx.createGain(), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null, vol = ctx.createGain(), an = ctx.createAnalyser();
    an.fftSize = 512;
    var lo = ctx.createBiquadFilter(), mid = ctx.createBiquadFilter(), hi = ctx.createBiquadFilter();
    lo.type = 'lowshelf'; lo.frequency.value = 120; mid.type = 'peaking'; mid.frequency.value = 1000; mid.Q.value = 0.9; hi.type = 'highshelf'; hi.frequency.value = 6000;
    var sdry = ctx.createGain(), swet = ctx.createGain(), shaper = ctx.createWaveShaper(), ssum = ctx.createGain(); shaper.oversample = '2x'; shaper.curve = satCurve(0.5); swet.gain.value = 0;
    var comp = ctx.createDynamicsCompressor(), makeup = ctx.createGain(), duck = ctx.createGain();
    input.connect(lo); lo.connect(mid); mid.connect(hi); hi.connect(sdry); hi.connect(shaper); shaper.connect(swet); sdry.connect(ssum); swet.connect(ssum); ssum.connect(comp); comp.connect(makeup); makeup.connect(duck);
    var node = duck; if (pan) { duck.connect(pan); node = pan; }
    node.connect(vol); vol.connect(an); an.connect(G.master);
    var sr = ctx.createGain(), sd = ctx.createGain(); sr.gain.value = 0; sd.gain.value = 0; vol.connect(sr); sr.connect(G.revIn); vol.connect(sd); sd.connect(G.dIn);
    G.tracks[t.id] = { input: input, pan: pan, vol: vol, analyser: an, buf: new Float32Array(an.fftSize), lo: lo, mid: mid, hi: hi, sdry: sdry, swet: swet, shaper: shaper, comp: comp, makeup: makeup, duck: duck, sendRev: sr, sendDly: sd, satK: -1 };
  }
  function applyFx(G, p, t, now) {
    var n = G.tracks[t.id], f = fxOf(t), T = 0.015;
    n.lo.gain.setTargetAtTime(clamp(f.eq.low, -15, 15), now, T); n.mid.gain.setTargetAtTime(clamp(f.eq.mid, -15, 15), now, T); n.hi.gain.setTargetAtTime(clamp(f.eq.high, -15, 15), now, T);
    var k = Math.round(clamp(f.sat, 0, 1) * 20); if (k !== n.satK) { n.shaper.curve = satCurve(k / 20); n.satK = k; }
    var sa = clamp(f.sat, 0, 1); n.sdry.gain.setTargetAtTime(1 - 0.5 * sa, now, T); n.swet.gain.setTargetAtTime(0.7 * sa, now, T);
    var c = clamp(f.comp, 0, 1); n.comp.threshold.setTargetAtTime(c > 0 ? -8 - 28 * c : 0, now, T); n.comp.ratio.setTargetAtTime(c > 0 ? 2 + 10 * c : 1, now, T); n.comp.knee.value = 6; n.comp.attack.value = 0.01; n.comp.release.value = 0.16; n.makeup.gain.setTargetAtTime(1 + 0.5 * c, now, T);
    n.sendRev.gain.setTargetAtTime(clamp(f.rev, 0, 1) * 0.8, now, T); n.sendDly.gain.setTargetAtTime(clamp(f.dly, 0, 1) * 0.8, now, T);
  }
  // abbassamento a tempo di cassa: chiamare per OGNI colpo di cassa (anche se la cassa e' muta)
  function duckAt(G, p, when) {
    p.tracks.forEach(function (t) { var f = t.fx, n = G.tracks[t.id]; if (!f || !n || !(f.sc > 0) || t.lane === 'kick') return;
      var d = clamp(f.sc, 0, 1) * 0.85, g = n.duck.gain; g.cancelScheduledValues(when); g.setValueAtTime(1 - d, when); g.linearRampToValueAtTime(1, when + 0.04 + 0.18 * (1 - 0.3 * d)); });
  }
  function applyMix(G, p) {
    var now = G.ctx.currentTime, M = masterOf(p);
    G.master.gain.setTargetAtTime(M.vol, now, 0.01);
    if (M.ceil !== G.ceil) { G.clip.curve = limiterCurve(Math.pow(10, (M.ceil - 0.5) / 20)); G.limiter.threshold.setTargetAtTime(M.ceil - 1.5, now, 0.02); G.ceil = M.ceil; }
    if (M.revSize !== G.revSize) { G.conv.buffer = reverbIR(G.ctx, clamp(M.revSize, 0.3, 4)); G.revSize = M.revSize; }
    G.glueMix.gain.setTargetAtTime(clamp(M.glue, 0, 1), now, 0.02); G.dry.gain.setTargetAtTime(1 - 0.5 * clamp(M.glue, 0, 1), now, 0.02);
    G.dly.delayTime.setTargetAtTime(clamp(60 / p.bpm * [1, 0.75, 0.5][M.dlyDiv | 0 || 0] * 1, 0.02, 1.9), now, 0.02); G.dFb.gain.setTargetAtTime(clamp(M.dlyFb, 0, 0.85), now, 0.02);
    p.tracks.forEach(function (t) {
      if (!G.tracks[t.id]) addTrack(G, t);
      var n = G.tracks[t.id];
      n.vol.gain.setTargetAtTime(audibleOf(p, t) ? clamp(t.vol, 0, 1.5) : 0, now, 0.01);
      if (n.pan) n.pan.pan.setTargetAtTime(clamp(t.pan, -1, 1), now, 0.01);
      applyFx(G, p, t, now);
    });
  }
  function peakOfBuffer(buf) { var m = 0; for (var i = 0; i < buf.length; i++) { var a = Math.abs(buf[i]); if (a > m) m = a; } return m; }
  function readMeters(G) {
    var out = {};
    Object.keys(G.tracks).forEach(function (id) { var n = G.tracks[id]; n.analyser.getFloatTimeDomainData(n.buf); out[id] = peakOfBuffer(n.buf); });
    if (!G.mbuf) G.mbuf = new Float32Array(G.masterAnalyser.fftSize);
    G.masterAnalyser.getFloatTimeDomainData(G.mbuf); out.master = peakOfBuffer(G.mbuf);
    return out;
  }

  // Suona un evento. Ritorna true se ha prodotto qualcosa.
  function playEvent(G, p, ev, when, spt) {
    var tr = trackById(p, ev.track); if (!tr) return false;
    var node = G.tracks[ev.track]; if (!node) { addTrack(G, tr); node = G.tracks[ev.track]; }
    var ctx = G.ctx;
    if (ev.type === 'drum') {
      var bufs = (G.sampler && G.sampler.kitBuffers && G.sampler.kitBuffers(p.kit)) || kitBuffers(ctx, p.kit), v;
      if (ev.lane === 'hat' && G.ohat) { G.ohat.stop(when); G.ohat = null; } // il hi-hat chiuso taglia quello aperto
      if (bufs && bufs[ev.lane]) {
        var rate = Math.pow(2, (ev.tune || 0) / 12);
        v = playBuffer(ctx, node.input, bufs[ev.lane], ev.vel, when, rate);
      } else v = Voices.DRUMS[ev.lane](ctx, node.input, { when: when, vel: ev.vel, p: { tune: ev.tune } });
      if (ev.lane === 'ohat') G.ohat = v;
      return true;
    }
    var inst = Voices.INSTRUMENTS[tr.inst]; if (!inst) return false;
    var dur = Math.max(0.03, ev.durTicks * spt);
    if (inst.mono) { var prev = G.voices[ev.track]; if (prev) prev.stop(when); }
    var voice = (G.sampler && G.sampler.has(tr.inst)) ? G.sampler.play(ctx, node.input, tr.inst, { midi: ev.midi, vel: ev.vel, when: when, dur: dur, glideFrom: ev.glideFrom, p: tr.params }) : inst.fn(ctx, node.input, { midi: ev.midi, vel: ev.vel, when: when, dur: dur, glideFrom: ev.glideFrom, p: tr.params });
    if (inst.mono) G.voices[ev.track] = voice;
    return true;
  }

  /* ---------------- Player in tempo reale ---------------- */
  function Player(project, opts) {
    opts = opts || {};
    this.project = project; this.ctx = null; this.G = null; this.playing = false; this.timer = null; this.sched = null; this.onTick = opts.onTick || null;
    this.sampler = opts.sampler || null; this.AC = opts.AudioContext || (root && (root.AudioContext || root.webkitAudioContext));
  }
  Player.prototype.ensure = function () {
    if (this.ctx) return this.ctx;
    var AC = this.AC; if (!AC) throw new Error('Questo browser non ha Web Audio.');
    try { if (root.navigator && root.navigator.audioSession) root.navigator.audioSession.type = 'playback'; } catch (e) {} // iPhone: suona anche con il tasto silenzioso
    this.ctx = new AC({ latencyHint: 'interactive' });
    this.G = createGraph(this.ctx, this.project); this.G.sampler = this.sampler;
    var self = this;
    this.sched = new Scheduler({ getProject: function () { return self.project; }, now: function () { return self.ctx.currentTime; },
      onEvent: function (ev, when, spt) { if (ev.type === 'drum' && ev.lane === 'kick') duckAt(self.G, self.project, when); if (ev.audible) { try { playEvent(self.G, self.project, ev, when, spt); } catch (e) { if (root.console) console.error('beatlab', e); } } } });
    if (root.document) root.document.addEventListener('visibilitychange', function () { if (!root.document.hidden && self.ctx && self.ctx.state !== 'running' && self.ctx.state !== 'closed') self.ctx.resume(); });
    return this.ctx;
  };
  Player.prototype.setProject = function (p) { this.project = p; if (this.G) applyMix(this.G, p); };
  Player.prototype.play = function () {
    var self = this; this.ensure();
    var go = function () {
      if (self.playing) return; self.playing = true;
      self.sched.start(self.ctx.currentTime + 0.06, 0); self.sched.pump();
      self.timer = setInterval(function () { self.sched.pump(); if (self.onTick) self.onTick(self.sched.positionAt(self.ctx.currentTime)); }, 25);
    };
    if (this.ctx.state === 'suspended') return this.ctx.resume().then(go, go);
    go(); return Promise.resolve();
  };
  Player.prototype.stop = function () {
    if (!this.playing) return; this.playing = false; clearInterval(this.timer); this.timer = null; this.sched.stop();
    // taglia le voci ancora in corso
    var G = this.G, t = this.ctx.currentTime;
    Object.keys(G.voices).forEach(function (k) { try { G.voices[k].stop(t); } catch (e) {} }); G.voices = {};
    if (G.ohat) { G.ohat.stop(t); G.ohat = null; }
    if (this.onTick) this.onTick(null);
  };
  Player.prototype.position = function () { return this.playing ? this.sched.positionAt(this.ctx.currentTime) : null; };
  Player.prototype.meters = function () { return this.G ? readMeters(this.G) : {}; };
  Player.prototype.mixChanged = function () { if (this.G) applyMix(this.G, this.project); };
  // Un colpo singolo per provare un suono (tocco sulla tastiera o sul pad)
  Player.prototype.audition = function (trackId, midiOrLane, vel) {
    this.ensure(); var self = this, tr = trackById(this.project, trackId); if (!tr) return;
    var go = function () {
      var spt = secPerTick(self.project.bpm), when = self.ctx.currentTime + 0.01;
      if (tr.kind === 'drum') playEvent(self.G, self.project, { type: 'drum', track: tr.id, lane: tr.lane, vel: vel || 100, tune: tr.tune }, when, spt);
      else playEvent(self.G, self.project, { type: 'note', track: tr.id, midi: midiOrLane, vel: vel || 100, durTicks: PPQ / 2 }, when, spt);
    };
    if (this.ctx.state === 'suspended') this.ctx.resume().then(go, go); else go();
  };

  // Suona una frase di prova con uno strumento (senza toccare il progetto). Ritorna la durata in secondi.
  Player.prototype.preview = function (instId, notes, bpm) {
    this.ensure(); var self = this, spt = secPerTick(bpm || this.project.bpm), end = 0;
    var tmp = { id: '__prev', kind: 'inst', inst: instId, params: {}, vol: 0.8, pan: 0, mute: false, solo: false };
    var tp = { tracks: [tmp], bpm: bpm || this.project.bpm, swing: 50, bars: 2, res: 16, kit: this.project.kit, master: { vol: 1 } };
    notes.forEach(function (n) { end = Math.max(end, (n.t + n.d) * spt); });
    var go = function () {
      if (!self.G.tracks.__prev) addTrack(self.G, tmp); self.G.tracks.__prev.vol.gain.value = 0.8;
      var t0 = self.ctx.currentTime + 0.05;
      if (self.G.voices.__prev) { try { self.G.voices.__prev.stop(t0); } catch (e) {} delete self.G.voices.__prev; }
      notes.forEach(function (n) { try { playEvent(self.G, tp, { type: 'note', track: '__prev', midi: n.n, vel: n.v || 96, durTicks: n.d, mono: false }, t0 + n.t * spt, spt); } catch (e) { if (root.console) console.error('beatlab', e); } });
    };
    if (this.ctx.state === 'suspended') this.ctx.resume().then(go, go); else go();
    return end + 0.5;
  };

  /* ---------------- esportazione ---------------- */
  function encodeWav(chans, sr, bits) {
    bits = bits || 16;
    var nch = chans.length, n = chans[0].length, bytes = bits / 8, dataLen = n * nch * bytes, buf = new ArrayBuffer(44 + dataLen), v = new DataView(buf);
    function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nch, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * nch * bytes, true); v.setUint16(32, nch * bytes, true); v.setUint16(34, bits, true); str(36, 'data'); v.setUint32(40, dataLen, true);
    var o = 44;
    for (var i = 0; i < n; i++) for (var c = 0; c < nch; c++) {
      var x = clamp(chans[c][i], -1, 1); if (!(x === x)) x = 0;
      if (bits === 16) { v.setInt16(o, Math.round(x < 0 ? x * 32768 : x * 32767), true); o += 2; }
      else { var q = Math.round(x < 0 ? x * 8388608 : x * 8388607); v.setUint8(o, q & 255); v.setUint8(o + 1, (q >> 8) & 255); v.setUint8(o + 2, (q >> 16) & 255); o += 3; }
    }
    return new Uint8Array(buf);
  }
  function parseWav(u8) { // lettura minima per i test
    var v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), tag = function (o) { return String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3)); };
    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || tag(12) !== 'fmt ' || tag(36) !== 'data') return null;
    var o = { fmt: v.getUint16(20, true), ch: v.getUint16(22, true), sr: v.getUint32(24, true), bits: v.getUint16(34, true), dataLen: v.getUint32(40, true), riffLen: v.getUint32(4, true) };
    o.frames = o.dataLen / (o.ch * o.bits / 8); o.size = u8.byteLength; return o;
  }
  function analyzeChannels(chans) {
    var peak = 0, sum = 0, n = 0, finite = true, first = -1, silent = 0, len = chans[0].length;
    for (var c = 0; c < chans.length; c++) for (var i = 0; i < len; i++) {
      var x = chans[c][i]; if (!isFinite(x)) { finite = false; continue; } var a = Math.abs(x); if (a > peak) peak = a; sum += x * x; n++;
      if (c === 0) { if (a > 0.001 && first < 0) first = i; if (a < 0.0005) silent++; }
    }
    return { peak: peak, peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity, rms: Math.sqrt(sum / Math.max(1, n)), finite: finite, firstSound: first, silentRatio: silent / len, frames: len };
  }
  // Rende il progetto (loops = quante volte il loop) con la STESSA catena del tempo reale.
  function renderOffline(p, o) {
    o = o || {};
    var OAC = o.OfflineAudioContext || (root && (root.OfflineAudioContext || root.webkitOfflineAudioContext));
    if (!OAC) return Promise.reject(new Error('Questo browser non sa esportare in WAV.'));
    var sr = o.sampleRate || 44100, loops = o.loops || 1, tail = o.tail == null ? 1.5 : o.tail;
    var spt = secPerTick(p.bpm), totalTicks = loopTicks(p) * loops, dur = totalTicks * spt + tail, len = Math.ceil(dur * sr);
    var ctx = new OAC(2, len, sr), G = createGraph(ctx, p);
    if (o.sampler) G.sampler = o.sampler;
    var evs = eventsInRange(p, 0, totalTicks);
    evs.forEach(function (e) { if (e.type === 'drum' && e.lane === 'kick') duckAt(G, p, (e.tick + e.delay) * spt); if (e.audible) playEvent(G, p, e, (e.tick + e.delay) * spt, spt); });
    var done = ctx.startRendering();
    return done.then(function (buf) { return { buffer: buf, chans: [buf.getChannelData(0), buf.getChannelData(1)], sr: sr }; });
  }
  function exportWav(p, o) {
    return renderOffline(p, o).then(function (r) {
      var an = analyzeChannels(r.chans); return { wav: encodeWav(r.chans, r.sr, (o && o.bits) || 16), report: an, sr: r.sr };
    });
  }

  return {
    PPQ: PPQ, BAR: BAR, LANES: LANES, LANE_IDS: LANE_IDS, ROLLS: ROLLS, KITS: KITS, Voices: Voices, clamp: clamp,
    newProject: newProject, newDrumTrack: newDrumTrack, newInstTrack: newInstTrack, resize: resize, drumTracks: drumTracks, trackById: trackById,
    secPerTick: secPerTick, loopTicks: loopTicks, swingDelay: swingDelay, rollVel: rollVel, eventsInRange: eventsInRange, Scheduler: Scheduler,
    createGraph: createGraph, applyMix: applyMix, defaultFx: defaultFx, fxOf: fxOf, masterOf: masterOf, duckAt: duckAt, addTrack: addTrack, readMeters: readMeters, playEvent: playEvent, kitBuffers: kitBuffers, decodeSample: decodeSample, audibleOf: audibleOf,
    Player: Player, encodeWav: encodeWav, parseWav: parseWav, analyzeChannels: analyzeChannels, renderOffline: renderOffline, exportWav: exportWav, uid: uid
  };
});
