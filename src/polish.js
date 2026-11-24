/*
 * Rifinitura della voce: filtro dei bassi, equalizzatore, compressore, eco e riverbero.
 * Tutto calcolato dal programma con filtri standard (biquad) e un riverbero a
 * linee di ritardo. Non è un plugin da studio professionale, ma migliora una
 * registrazione grezza in modo misurabile.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Polish = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function coeffs(type, fc, sr, Q, gainDb) {
    var w0 = 2 * Math.PI * fc / sr, cs = Math.cos(w0), sn = Math.sin(w0);
    var alpha = sn / (2 * (Q || 0.707)), A = Math.pow(10, (gainDb || 0) / 40);
    var b0, b1, b2, a0, a1, a2;
    if (type === 'hp') {
      b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha;
    } else if (type === 'peak') {
      b0 = 1 + alpha * A; b1 = -2 * cs; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cs; a2 = 1 - alpha / A;
    } else { // high shelf
      var sq = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) + (A - 1) * cs + sq); b1 = -2 * A * ((A - 1) + (A + 1) * cs); b2 = A * ((A + 1) + (A - 1) * cs - sq);
      a0 = (A + 1) - (A - 1) * cs + sq; a1 = 2 * ((A - 1) - (A + 1) * cs); a2 = (A + 1) - (A - 1) * cs - sq;
    }
    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
  }

  function runBiquad(x, c) {
    var y = new Float32Array(x.length), x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (var i = 0; i < x.length; i++) {
      var v = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  }

  function highpass(x, sr, fc) { return runBiquad(x, coeffs('hp', fc, sr, 0.707)); }
  function peaking(x, sr, fc, gainDb, Q) { return runBiquad(x, coeffs('peak', fc, sr, Q || 1, gainDb)); }
  function highShelf(x, sr, fc, gainDb) { return runBiquad(x, coeffs('hs', fc, sr, 0.707, gainDb)); }

  function compress(x, sr, o) {
    o = o || {};
    var thr = o.thresholdDb == null ? -20 : o.thresholdDb, ratio = o.ratio || 3, makeup = o.makeupDb || 0;
    var aA = Math.exp(-1 / (sr * (o.attackMs || 8) / 1000)), aR = Math.exp(-1 / (sr * (o.releaseMs || 120) / 1000));
    var y = new Float32Array(x.length), env = 0;
    for (var i = 0; i < x.length; i++) {
      var a = Math.abs(x[i]);
      env = a > env ? aA * env + (1 - aA) * a : aR * env + (1 - aR) * a;
      var db = 20 * Math.log(Math.max(env, 1e-9)) / Math.LN10;
      var over = db - thr, red = over > 0 ? over * (1 - 1 / ratio) : 0;
      y[i] = x[i] * Math.pow(10, (makeup - red) / 20);
    }
    return y;
  }

  function echo(x, sr, o) {
    var d = Math.round(sr * (o.timeMs || 300) / 1000), fb = o.feedback == null ? 0.35 : o.feedback, mix = o.mix == null ? 0.2 : o.mix;
    var y = new Float32Array(x.length), buf = new Float32Array(x.length);
    for (var i = 0; i < x.length; i++) {
      var delayed = i >= d ? buf[i - d] : 0;
      buf[i] = x[i] + delayed * fb;
      y[i] = x[i] + delayed * mix;
    }
    return y;
  }

  // Riverbero a linee di ritardo (comb + allpass). roomSize 0.5-1.5 allunga la coda.
  function reverb(x, sr, o) {
    o = o || {};
    var mix = o.mix == null ? 0.15 : o.mix, room = o.roomSize || 1, fb = o.decay == null ? 0.8 : o.decay, damp = 0.3;
    var combMs = [29.7, 37.1, 41.1, 43.7], apMs = [5.0, 1.7];
    var tail = Math.round(sr * 1.2);
    var n = x.length + (mix > 0 ? tail : 0), wet = new Float32Array(n);
    var pre = Math.round(sr * (o.preDelayMs == null ? 15 : o.preDelayMs) / 1000);
    combMs.forEach(function (ms) {
      var d = Math.max(1, Math.round(sr * ms * room / 1000)), buf = new Float32Array(d), p = 0, lp = 0;
      for (var i = 0; i < n; i++) {
        var inp = (i - pre >= 0 && i - pre < x.length) ? x[i - pre] : 0;
        var out = buf[p];
        lp = out * (1 - damp) + lp * damp;
        buf[p] = inp + lp * fb;
        p = (p + 1) % d;
        wet[i] += out / 4;
      }
    });
    apMs.forEach(function (ms) {
      var d = Math.max(1, Math.round(sr * ms / 1000)), buf = new Float32Array(d), p = 0, g = 0.5;
      for (var i = 0; i < n; i++) {
        var bo = buf[p], inp = wet[i];
        buf[p] = inp + bo * g;
        wet[i] = bo - inp * g;
        p = (p + 1) % d;
      }
    });
    var y = new Float32Array(n);
    for (var i = 0; i < n; i++) y[i] = (i < x.length ? x[i] : 0) + wet[i] * mix * 3;
    return y;
  }

  // Riduzione del rumore con porta (gate) morbida: stima il rumore di fondo dai momenti più silenziosi
  // e abbassa i passaggi che stanno vicino a quel livello. Non toglie rumore sotto la voce che canta.
  function denoise(x, sr, o) {
    o = o || {};
    var reduceDb = o.reduceDb == null ? 18 : o.reduceDb, marginDb = o.marginDb == null ? 8 : o.marginDb;
    var win = Math.max(64, Math.round(sr * 0.02)), nf = Math.floor(x.length / win);
    if (nf < 10) return Float32Array.from(x);
    var dbs = [], i, j;
    for (i = 0; i < nf; i++) {
      var e = 0; for (j = 0; j < win; j++) { var v = x[i * win + j]; e += v * v; }
      dbs.push(10 * Math.log(Math.max(e / win, 1e-12)) / Math.LN10);
    }
    var sorted = dbs.slice().sort(function (a, b) { return a - b; });
    var floor = sorted[Math.floor(sorted.length * 0.1)], thr = floor + marginDb;
    var target = Math.pow(10, -reduceDb / 20), g = 1, y = new Float32Array(x.length);
    var aUp = 1 - Math.exp(-1 / (sr * 0.005)), aDn = 1 - Math.exp(-1 / (sr * 0.08));
    for (i = 0; i < nf + 1; i++) {
      var open = i < nf ? dbs[Math.min(nf - 1, i)] > thr || (i > 0 && dbs[i - 1] > thr + 3) : false;
      var goal = open ? 1 : target;
      for (j = 0; j < win; j++) {
        var idx = i * win + j; if (idx >= x.length) break;
        g += (goal - g) * (goal > g ? aUp : aDn);
        y[idx] = x[idx] * g;
      }
    }
    return y;
  }

  var PRESETS = {
    nessuna: null,
    pulita: { hp: 90, presence: 2.5, air: 2, comp: { thresholdDb: -22, ratio: 2.5, makeupDb: 3 }, reverb: { mix: 0.08, roomSize: 0.8 } },
    pop: { hp: 100, presence: 3.5, air: 3, comp: { thresholdDb: -24, ratio: 3.5, makeupDb: 4 }, reverb: { mix: 0.16, roomSize: 1 } },
    eco: { hp: 100, presence: 3.5, air: 3, comp: { thresholdDb: -24, ratio: 3.5, makeupDb: 4 }, reverb: { mix: 0.2, roomSize: 1.2 }, echo: { timeMs: 330, feedback: 0.35, mix: 0.2 } }
  };

  function process(x, sr, preset) {
    var p = typeof preset === 'string' ? PRESETS[preset] : preset;
    if (!p) return Float32Array.from(x);
    var y = p.denoise ? denoise(x, sr, p.denoise === true ? {} : p.denoise) : x;
    y = highpass(y, sr, p.hp || 90);
    if (p.presence) y = peaking(y, sr, 3200, p.presence, 0.9);
    if (p.air) y = highShelf(y, sr, 9000, p.air);
    if (p.comp) y = compress(y, sr, p.comp);
    if (p.echo) y = echo(y, sr, p.echo);
    if (p.reverb) y = reverb(y, sr, p.reverb);
    var peak = 0, i;
    for (i = 0; i < y.length; i++) { var a = Math.abs(y[i]); if (a > peak) peak = a; }
    if (peak > 0.95) { var k = 0.95 / peak; for (i = 0; i < y.length; i++) y[i] *= k; }
    return y;
  }

  return { process: process, denoise: denoise, highpass: highpass, peaking: peaking, highShelf: highShelf, compress: compress, reverb: reverb, echo: echo, PRESETS: PRESETS };
});
