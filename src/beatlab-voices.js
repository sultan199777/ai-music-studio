/*
 * Beat Lab - suoni. Batteria e strumenti costruiti con Web Audio puro (oscillatori, rumore, filtri).
 * Funzionano sia in tempo reale (AudioContext) sia nell'esportazione (OfflineAudioContext), perche' usano
 * solo l'interfaccia comune. Nessun file esterno: se i campioni non ci sono, suona comunque.
 *
 * Ogni voce riceve (ctx, dest, o) con  o = { midi, vel (1-127), when (s), dur (s), glideFrom (midi), p (parametri) }
 * e restituisce { stop(t) } per poter tagliare la nota (monofonico, choke dell'hi-hat).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BeatVoices = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function velGain(v) { var x = Math.max(1, Math.min(127, v)) / 127; return Math.pow(x, 1.45); }

  var noiseCache = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
  function noiseBuf(ctx) {
    var c = noiseCache && noiseCache.get(ctx);
    if (c) return c;
    var n = Math.floor(ctx.sampleRate * 1.5), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), s = 22222;
    for (var i = 0; i < n; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
    if (noiseCache) noiseCache.set(ctx, b);
    return b;
  }
  function noiseSrc(ctx, when, dur) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx); s.loop = true;
    s.start(when, Math.random() * 0.5); s.stop(when + dur + 0.05);
    return s;
  }
  function osc(ctx, type, f, when, stopAt) {
    var o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, when); o.start(when); o.stop(stopAt); return o;
  }
  function env(g, when, a, peak, d) {
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + Math.max(0.001, a));
    g.gain.exponentialRampToValueAtTime(0.0001, when + a + d);
  }
  function curve(drive) {
    var n = 1024, c = new Float32Array(n);
    for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * drive) / Math.tanh(drive); }
    return c;
  }
  var curveCache = {};
  function sat(ctx, drive) {
    var w = ctx.createWaveShaper(); var k = String(drive);
    w.curve = curveCache[k] || (curveCache[k] = curve(drive)); w.oversample = '2x'; return w;
  }
  function done(nodes, stopAt) { return { stop: function (t) { nodes.forEach(function (g) { try { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.012); } catch (e) {} }); } }; }

  /* ---------------- batteria sintetica ---------------- */
  var DRUMS = {
    kick: function (ctx, dest, o) {
      var t = o.when, g = ctx.createGain(), v = velGain(o.vel), p = o.p || {};
      var tune = p.tune || 0, o1 = osc(ctx, 'sine', 160 * Math.pow(2, tune / 12), t, t + 0.6);
      o1.frequency.exponentialRampToValueAtTime(46 * Math.pow(2, tune / 12), t + 0.07);
      env(g, t, 0.002, 0.95 * v, 0.42);
      var c = ctx.createGain(); env(c, t, 0.0005, 0.35 * v, 0.012);
      var n = noiseSrc(ctx, t, 0.02), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
      n.connect(hp); hp.connect(c); c.connect(dest); o1.connect(g); g.connect(dest);
      return done([g]);
    },
    snare: function (ctx, dest, o) {
      var t = o.when, v = velGain(o.vel), g = ctx.createGain(), b = ctx.createGain();
      var o1 = osc(ctx, 'triangle', 190, t, t + 0.25); o1.frequency.exponentialRampToValueAtTime(130, t + 0.08);
      env(b, t, 0.001, 0.5 * v, 0.11); o1.connect(b); b.connect(dest);
      var n = noiseSrc(ctx, t, 0.3), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.7;
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      env(g, t, 0.001, 0.75 * v, 0.19); n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(dest);
      return done([g, b]);
    },
    clap: function (ctx, dest, o) {
      var t = o.when, v = velGain(o.vel), g = ctx.createGain(), bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.9;
      var n = noiseSrc(ctx, t, 0.4);
      var offs = [0, 0.011, 0.022, 0.034];
      g.gain.setValueAtTime(0.0001, t);
      offs.forEach(function (d, i) { g.gain.setValueAtTime(0.0001, t + d); g.gain.linearRampToValueAtTime((i < 3 ? 0.55 : 0.8) * v, t + d + 0.0015); if (i < 3) g.gain.exponentialRampToValueAtTime(0.1 * v, t + d + 0.009); });
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.034 + 0.2);
      n.connect(bp); bp.connect(g); g.connect(dest);
      return done([g]);
    },
    hat: function (ctx, dest, o) {
      var t = o.when, v = velGain(o.vel), g = ctx.createGain(), hp = ctx.createBiquadFilter(), hp2 = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 7000; hp2.type = 'bandpass'; hp2.frequency.value = 10000; hp2.Q.value = 0.6;
      var n = noiseSrc(ctx, t, 0.1);
      env(g, t, 0.0007, 0.55 * v, 0.045);
      n.connect(hp); hp.connect(hp2); hp2.connect(g); g.connect(dest);
      return done([g]);
    },
    ohat: function (ctx, dest, o) {
      var t = o.when, v = velGain(o.vel), g = ctx.createGain(), hp = ctx.createBiquadFilter(), bp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 6500; bp.type = 'bandpass'; bp.frequency.value = 9500; bp.Q.value = 0.5;
      var n = noiseSrc(ctx, t, 0.5);
      env(g, t, 0.001, 0.5 * v, 0.3);
      n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(dest);
      return done([g]);
    },
    perc: function (ctx, dest, o) { // tom/rim: suono tonale corto
      var t = o.when, v = velGain(o.vel), g = ctx.createGain(), f = 150 * Math.pow(2, ((o.p && o.p.tune) || 0) / 12);
      var o1 = osc(ctx, 'sine', f * 1.8, t, t + 0.4); o1.frequency.exponentialRampToValueAtTime(f, t + 0.06);
      env(g, t, 0.001, 0.8 * v, 0.2); o1.connect(g); g.connect(dest);
      var c = ctx.createGain(); env(c, t, 0.0005, 0.25 * v, 0.01);
      var n = noiseSrc(ctx, t, 0.02); n.connect(c); c.connect(dest);
      return done([g]);
    }
  };

  /* ---------------- strumenti ---------------- */
  // ADSR semplice su un GainNode; la nota finisce a when+dur con un rilascio.
  function adsr(g, when, dur, a, d, s, r, peak) {
    var end = when + Math.max(dur, 0.03);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * s), when + a + d);
    g.gain.setValueAtTime(Math.max(0.0002, peak * s), Math.max(end, when + a + d));
    g.gain.exponentialRampToValueAtTime(0.0001, Math.max(end, when + a + d) + r);
    return Math.max(end, when + a + d) + r;
  }

  var SYNTHS = {
    // 808: sinusoide intonata con "thump" iniziale, glide verso la nota, saturazione per le armoniche (si sente anche su casse piccole)
    sub808: function (ctx, dest, o) {
      var t = o.when, p = o.p || {}, f = mtof(o.midi), v = velGain(o.vel);
      var decay = p.decay || 1.1, glide = (p.glide == null ? 0.07 : p.glide), drive = p.drive || 2.2;
      var dur = Math.max(o.dur, 0.08), stopAt = t + dur + 0.2;
      var o1 = ctx.createOscillator(); o1.type = 'sine';
      var start = o.glideFrom != null ? mtof(o.glideFrom) : f * 1.9;
      o1.frequency.setValueAtTime(start, t);
      o1.frequency.exponentialRampToValueAtTime(f, t + (o.glideFrom != null ? glide : 0.018));
      o1.start(t); o1.stop(stopAt);
      var o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.setValueAtTime(start * 2, t); o2.frequency.exponentialRampToValueAtTime(f * 2, t + (o.glideFrom != null ? glide : 0.018)); o2.start(t); o2.stop(stopAt);
      var g2 = ctx.createGain(); g2.gain.value = 0.12;
      var w = sat(ctx, drive), g = ctx.createGain();
      var a = 0.003, end = t + dur;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9 * v, t + a);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.9 * v * Math.exp(-dur / decay * 2.2)), end);
      g.gain.exponentialRampToValueAtTime(0.0001, end + 0.06);
      o1.connect(w); o2.connect(g2); g2.connect(w); w.connect(g); g.connect(dest);
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; w.disconnect(); w.connect(lp); lp.connect(g);
      return done([g]);
    },
    sub: function (ctx, dest, o) {
      var t = o.when, v = velGain(o.vel), g = ctx.createGain(), o1 = ctx.createOscillator();
      o1.type = 'sine'; o1.frequency.setValueAtTime(mtof(o.midi), t);
      var stopAt = adsr(g, t, o.dur, 0.008, 0.1, 0.8, 0.08, 0.8 * v); o1.start(t); o1.stop(stopAt + 0.02);
      o1.connect(g); g.connect(dest); return done([g]);
    },
    lead: function (ctx, dest, o) {
      var t = o.when, v = velGain(o.vel), g = ctx.createGain(), f = mtof(o.midi), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(5200, t); lp.frequency.exponentialRampToValueAtTime(1800, t + 0.3);
      var stopAt = adsr(g, t, o.dur, 0.01, 0.18, 0.7, 0.12, 0.3 * v);
      [-9, 9].forEach(function (c) { var s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(f, t); s.detune.value = c; s.start(t); s.stop(stopAt + 0.02); s.connect(lp); });
      lp.connect(g); g.connect(dest); return done([g]);
    },
    pluck: function (ctx, dest, o) {
      var t = o.when, v = velGain(o.vel), g = ctx.createGain(), f = mtof(o.midi), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = 1.2; lp.frequency.setValueAtTime(Math.min(9000, f * 14), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.5), t + 0.35);
      env(g, t, 0.002, 0.5 * v, 0.55);
      [0, 6].forEach(function (c) { var s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(f, t); s.detune.value = c; s.start(t); s.stop(t + 0.7); s.connect(lp); });
      lp.connect(g); g.connect(dest); return done([g]);
    },
    pad: function (ctx, dest, o) {
      var t = o.when, v = velGain(o.vel), g = ctx.createGain(), f = mtof(o.midi), lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = 0.7; lp.frequency.setValueAtTime(700, t); lp.frequency.linearRampToValueAtTime(2200, t + Math.max(0.5, o.dur * 0.6));
      var stopAt = adsr(g, t, o.dur, 0.35, 0.3, 0.8, 0.7, 0.22 * v);
      [-12, 0, 12].forEach(function (c) { var s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(f, t); s.detune.value = c; s.start(t); s.stop(stopAt + 0.02); s.connect(lp); });
      lp.connect(g); g.connect(dest); return done([g]);
    },
    fm: function (ctx, dest, o) { // timbro tipo piano elettrico / campana: portante + modulatore con indice che scende
      var t = o.when, v = velGain(o.vel), g = ctx.createGain(), f = mtof(o.midi), p = o.p || {};
      var ratio = p.ratio || 2, idx = (p.index || 2.2) * f;
      var c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain();
      c.type = 'sine'; m.type = 'sine'; c.frequency.setValueAtTime(f, t); m.frequency.setValueAtTime(f * ratio, t);
      mg.gain.setValueAtTime(idx, t); mg.gain.exponentialRampToValueAtTime(Math.max(1, idx * 0.08), t + 0.5);
      var stopAt = adsr(g, t, o.dur, 0.004, 0.9, 0.12, 0.25, 0.45 * v);
      c.start(t); c.stop(stopAt + 0.02); m.start(t); m.stop(stopAt + 0.02);
      m.connect(mg); mg.connect(c.frequency); c.connect(g); g.connect(dest); return done([g]);
    }
  };

  var INSTRUMENTS = {
    sub808: { name: '808 (basso intonato)', mono: true, range: [24, 48], fn: SYNTHS.sub808 },
    sub: { name: 'Sub (basso pulito)', mono: true, range: [24, 52], fn: SYNTHS.sub },
    lead: { name: 'Lead (dente di sega)', mono: false, range: [55, 88], fn: SYNTHS.lead },
    pluck: { name: 'Pluck (corda sintetica)', mono: false, range: [48, 84], fn: SYNTHS.pluck },
    pad: { name: 'Pad (tappeto)', mono: false, range: [48, 79], fn: SYNTHS.pad },
    fm: { name: 'FM (piano elettrico/campana)', mono: false, range: [48, 88], fn: SYNTHS.fm }
  };

  /* ---- altri sintetizzatori (anche come ripiego quando i campioni non ci sono) ---- */
  var guitarCache = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
  // Corda pizzicata (Karplus-Strong calcolato in JS: la linea di ritardo di Web Audio e' troppo lunga per le note acute)
  function guitarBuf(ctx, midi) {
    var per = guitarCache && guitarCache.get(ctx); if (!per) { per = {}; if (guitarCache) guitarCache.set(ctx, per); }
    if (per[midi]) return per[midi];
    var sr = ctx.sampleRate, f = mtof(midi), N = Math.max(2, Math.round(sr / f)), len = Math.floor(sr * 2.2), b = ctx.createBuffer(1, len, sr), y = b.getChannelData(0), seed = 1234 + midi;
    var i, prev = 0;
    for (i = 0; i < N; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; var n = (seed / 4294967296) * 2 - 1; prev = 0.5 * prev + 0.5 * n; y[i] = prev; } // colpo di plettro leggermente filtrato
    var loss = Math.min(0.9998, Math.pow(0.5, 1 / (f * 1.6)) * 0.5 + 0.5 * 0.9996);   // piu' acute = si spengono prima
    var damp = 0.5;
    for (i = N; i < len; i++) y[i] = (damp * y[i - N] + (1 - damp) * y[i - N + 1]) * loss;
    var pk = 0; for (i = 0; i < len; i++) { var a = Math.abs(y[i]); if (a > pk) pk = a; } if (pk > 0) for (i = 0; i < len; i++) y[i] /= pk;
    per[midi] = b; return b;
  }
  SYNTHS.guitar = function (ctx, dest, o) {
    var t = o.when, v = velGain(o.vel), s = ctx.createBufferSource(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    s.buffer = guitarBuf(ctx, o.midi); lp.type = 'lowpass'; lp.frequency.value = 3800 + 3000 * v; lp.Q.value = 0.5;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.6 * v, t + 0.002);
    var end = t + Math.max(o.dur, 0.12); g.gain.setValueAtTime(0.6 * v, end); g.gain.setTargetAtTime(0, end, 0.05);
    s.start(t); s.stop(end + 0.4); s.connect(lp); lp.connect(g); g.connect(dest); return done([g]);
  };
  SYNTHS.brass = function (ctx, dest, o) {
    var t = o.when, v = velGain(o.vel), g = ctx.createGain(), f = mtof(o.midi), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 1.5; lp.frequency.setValueAtTime(500, t); lp.frequency.exponentialRampToValueAtTime(3200, t + 0.09); lp.frequency.exponentialRampToValueAtTime(1600, t + 0.4);
    var stopAt = adsr(g, t, o.dur, 0.05, 0.15, 0.75, 0.15, 0.3 * v);
    [-5, 5].forEach(function (c) { var s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(f, t); s.detune.value = c; s.start(t); s.stop(stopAt + 0.02); s.connect(lp); });
    lp.connect(g); g.connect(dest); return done([g]);
  };
  SYNTHS.strings = function (ctx, dest, o) {
    var t = o.when, v = velGain(o.vel), g = ctx.createGain(), f = mtof(o.midi), lp = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.5;
    var stopAt = adsr(g, t, o.dur, 0.18, 0.2, 0.85, 0.45, 0.2 * v);
    lfo.frequency.value = 5.2; lg.gain.value = 7; lfo.start(t); lfo.stop(stopAt + 0.02); lfo.connect(lg);
    [-14, -5, 5, 14].forEach(function (c) { var s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(f, t); s.detune.value = c; lg.connect(s.detune); s.start(t); s.stop(stopAt + 0.02); s.connect(lp); });
    lp.connect(g); g.connect(dest); return done([g]);
  };
  SYNTHS.choir = function (ctx, dest, o) { // "aah" sintetico: dente di sega con tre formanti e vibrato lento
    var t = o.when, v = velGain(o.vel), g = ctx.createGain(), f = mtof(o.midi), lfo = ctx.createOscillator(), lg = ctx.createGain();
    var stopAt = adsr(g, t, o.dur, 0.3, 0.3, 0.85, 0.6, 0.35 * v);
    lfo.frequency.value = 5; lg.gain.value = 9; lfo.start(t); lfo.stop(stopAt + 0.02); lfo.connect(lg);
    var mix = ctx.createGain(); mix.gain.value = 1;
    [[800, 5, 1], [1150, 6, 0.6], [2800, 8, 0.25]].forEach(function (fm) {
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fm[0]; bp.Q.value = fm[1]; var gg = ctx.createGain(); gg.gain.value = fm[2]; bp.connect(gg); gg.connect(mix);
      [-8, 8].forEach(function (c) { var s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(f, t); s.detune.value = c; lg.connect(s.detune); s.start(t); s.stop(stopAt + 0.02); s.connect(bp); });
    });
    mix.connect(g); g.connect(dest); return done([g]);
  };
  INSTRUMENTS.guitar = { name: 'Chitarra (corda sintetica)', mono: false, range: [40, 76], fn: SYNTHS.guitar };
  INSTRUMENTS.brass = { name: 'Ottoni (sintetici)', mono: false, range: [40, 77], fn: SYNTHS.brass };
  INSTRUMENTS.strings = { name: 'Archi (sintetici)', mono: false, range: [43, 88], fn: SYNTHS.strings };
  INSTRUMENTS.choir = { name: 'Coro (sintetico "aah")', mono: false, range: [48, 79], fn: SYNTHS.choir };

  return { mtof: mtof, velGain: velGain, DRUMS: DRUMS, SYNTHS: SYNTHS, INSTRUMENTS: INSTRUMENTS, noiseBuf: noiseBuf, sat: sat, env: env, adsr: adsr, done: done };
});
