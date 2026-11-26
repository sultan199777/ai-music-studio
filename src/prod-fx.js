/*
 * Produzione: effetti cinematografici/ambientali + interventi vocali (eco, risposte, cori, voce scura, reverse, ad-lib)
 * scelti DAL TESTO e messi a tempo sulla base. Tutto sintetizzato da zero (nessun campione, nessun diritto di terzi).
 * - SOUNDS: libreria (temporale, pioggia, supercar V12/V8, passaggio, elicottero, sirena, spari, raffica, impatti,
 *   esplosione, whoosh, salita, reverse, città, vento, mare, folla, vinile, cuore, orologio, campana, vetro,
 *   accendino, fuoco, contasoldi, monete, telefono, clacson).
 * - plan(map, opt): legge ogni riga (parole, immagini, emozione, punti forti) e decide cosa, dove e quanto forte.
 * - renderSfx / renderVox: trasformano la lista (modificabile a mano) in audio a tempo.
 * Le scelte sono Ipotesi di gusto da produttore: tarare a orecchio. Nomi di marchi solo come parole del testo, mai nei suoni.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { var sg = null; try { sg = require('./sig-fx.js'); } catch (e) {} module.exports = factory(sg); }
  else root.ProdFx = factory(root.SigFx || null);
})(typeof self !== 'undefined' ? self : this, function (SigFx) {
  'use strict';
  function rng(seed) { var a = (seed >>> 0) || 1; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var TAU = 2 * Math.PI;
  function buf(sr, sec) { return new Float32Array(Math.max(1, Math.round(sr * sec))); }
  function lpK(fc, sr) { return 1 - Math.exp(-TAU * Math.min(fc, sr * 0.45) / sr); }
  /* biquad passa-banda (RBJ), stato in chiusura */
  function bp(sr) { var x1 = 0, x2 = 0, y1 = 0, y2 = 0; return function (x, fc, q) { var w = TAU * Math.min(fc, sr * 0.45) / sr, al = Math.sin(w) / (2 * q), c = Math.cos(w), a0 = 1 + al, y = (al * x - al * x2 + 2 * c * y1 - (1 - al) * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; }; }
  function norm(b, pk) { var m = 0, i; for (i = 0; i < b.length; i++) { var v = b[i] < 0 ? -b[i] : b[i]; if (v > m) m = v; } if (m > 0) { var k = (pk || 0.9) / m; for (i = 0; i < b.length; i++) b[i] *= k; } return b; }
  function fades(b, sr, a, z) { var na = Math.min(b.length >> 1, Math.round(a * sr)), nz = Math.min(b.length >> 1, Math.round(z * sr)), i; for (i = 0; i < na; i++) b[i] *= i / na; for (i = 0; i < nz; i++) b[b.length - 1 - i] *= i / nz; return b; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  /* ---------- motori: frequenza di scoppio = giri/60 × cilindri/2; armoniche + impulsi di scarico + saturazione ---------- */
  function engine(sr, seed, o) {
    o = o || {}; var r = rng(seed), dur = o.dur || 3.4, b = buf(sr, dur), cyl = o.cyl || 12, ph = 0, lp = 0, lp2 = 0, pop = 0, dop = o.passby;
    var keys = o.passby ? [[0, 6800], [dur, 6600]] : [[0, 1100], [0.35, 1200], [1.35, 8200], [1.62, 7900], [1.75, 8300], [2.05, 3200], [2.55, 3000], [3.05, 7400], [dur, 6000]];
    function rpm(t) { for (var k = 1; k < keys.length; k++) if (t <= keys[k][0]) { var u = (t - keys[k - 1][0]) / (keys[k][0] - keys[k - 1][0]); u = u * u * (3 - 2 * u); return keys[k - 1][1] + (keys[k][1] - keys[k - 1][1]) * u; } return keys[keys.length - 1][1]; }
    for (var i = 0; i < b.length; i++) {
      var t = i / sr, rp = rpm(t), tc = dur / 2, d = dop ? (t - tc) / 0.55 : 0, df = dop ? 1 - 0.13 * Math.tanh(d * 1.6) : 1;
      var f = rp / 60 * cyl / 2 * df; ph += TAU * f / sr;
      var x = 0; for (var h = 1; h <= 10; h++) x += Math.sin(ph * h + h * 0.7) / Math.pow(h, cyl > 8 ? 0.75 : 0.95);
      if (cyl <= 8) x += 0.9 * Math.sin(ph * 0.5); // V8: borbottio irregolare
      var pulse = Math.pow(0.5 + 0.5 * Math.sin(ph), 4), n = r() * 2 - 1;
      x = x * 0.32 + n * pulse * 0.5;
      // scoppiettii in rilascio (giri che scendono)
      if (!dop && rp < 5000 && rpm(t + 0.01) < rp - 2 && r() < 0.0009) pop = 1;
      x += pop * (r() * 2 - 1) * 2.2; pop *= 0.9965;
      lp += lpK(700 + rp * 0.55, sr) * (x - lp); lp2 += lpK(5200, sr) * (lp - lp2);
      var y = Math.tanh(lp2 * 2.4), amp = dop ? 1 / (1 + d * d * 2.2) : Math.min(1, t / 0.08) * (0.55 + 0.45 * rp / 8300);
      b[i] = y * amp;
    }
    return fades(norm(b), sr, 0.03, 0.35);
  }
  function helicopter(sr, seed, o) {
    var r = rng(seed), dur = (o && o.dur) || 6, b = buf(sr, dur), rate = 4.6 + r() * 0.6, ph = 0, lp = 0, rum = 0, thump = 0, tph = 0, slap = 0, wph = 0, f1 = bp(sr);
    for (var i = 0; i < b.length; i++) {
      var t = i / sr, u = t / dur, near = Math.sin(Math.PI * u), dop = 1 + 0.06 * Math.cos(Math.PI * u);
      ph += rate * dop / sr; if (ph >= 1) { ph -= 1; slap = 1; thump = 1; tph = 0; }
      var n = r() * 2 - 1; lp += lpK(900, sr) * (n - lp); rum += lpK(160, sr) * (n - rum);
      tph += TAU * 72 / sr; wph += TAU * (3100 + 40 * Math.sin(TAU * 0.7 * t)) / sr;
      var x = f1(n, 1400, 1.2) * slap * 1.6 + Math.sin(tph) * thump * 0.9 + rum * 1.4 + Math.sin(wph) * 0.025 * near;
      slap *= 0.9975; thump *= 0.9985;
      b[i] = x * (0.25 + 0.75 * near);
    }
    return fades(norm(b), sr, 0.8, 1.2);
  }
  function thunder(sr, seed, o) {
    var r = rng(seed), dur = (o && o.dur) || 5.5, b = buf(sr, dur), lp = 0, lp2 = 0, hp = 0, bursts = [], k;
    for (k = 0; k < 7; k++) bursts.push([0.05 + r() * dur * 0.55, 0.4 + r() * 1.2, 0.4 + r() * 0.6]);
    for (var i = 0; i < b.length; i++) {
      var t = i / sr, n = r() * 2 - 1, env = 0; lp += lpK(260, sr) * (n - lp); lp2 += lpK(90, sr) * (lp - lp2);
      for (k = 0; k < bursts.length; k++) { var dt = t - bursts[k][0]; if (dt > 0) env += bursts[k][2] * Math.exp(-dt / bursts[k][1]) * Math.min(1, dt / 0.04); }
      var crack = t < 0.25 ? (n - hp) * Math.exp(-t / 0.06) * 0.8 : 0; hp += lpK(1500, sr) * (n - hp);
      b[i] = (lp * 2 + lp2 * 3) * env * (0.7 + 0.3 * Math.sin(TAU * (3 + r() * 0.1) * t)) + crack;
    }
    return fades(norm(b), sr, 0.005, 0.8);
  }
  function rain(sr, seed, o) {
    var r = rng(seed), dur = (o && o.dur) || 8, b = buf(sr, dur), f1 = bp(sr), lp = 0, drops = [];
    for (var i = 0; i < b.length; i++) {
      var t = i / sr, n = r() * 2 - 1; lp += lpK(7000, sr) * (n - lp);
      var bed = f1(lp, 2600, 0.5) * (0.85 + 0.15 * Math.sin(TAU * 0.13 * t));
      if (r() < 70 / sr) drops.push({ f: 1800 + r() * 4200, a: 0.05 + r() * 0.25, ph: 0, e: 1 });
      var d = 0; for (var k = drops.length - 1; k >= 0; k--) { var q = drops[k]; q.ph += TAU * q.f / sr; d += Math.sin(q.ph) * q.a * q.e; q.e *= 0.993; if (q.e < 0.01) drops.splice(k, 1); }
      b[i] = bed * 0.9 + d * 0.5;
    }
    return fades(norm(b, 0.8), sr, 1.2, 1.5);
  }
  function city(sr, seed, o) {
    var r = rng(seed), dur = (o && o.dur) || 8, b = buf(sr, dur), lp = 0, f1 = bp(sr), f2 = bp(sr), ev = [], k;
    for (k = 0; k < Math.max(2, dur / 2.5); k++) ev.push({ t: r() * (dur - 1.5), kind: r() < 0.55 ? 'auto' : 'clacson', f: 380 + r() * 160 });
    for (var i = 0; i < b.length; i++) {
      var t = i / sr, n = r() * 2 - 1; lp += lpK(220, sr) * (n - lp);
      var x = lp * (1.6 + 0.5 * Math.sin(TAU * 0.07 * t + 1));
      for (k = 0; k < ev.length; k++) {
        var e = ev[k], dt = t - e.t;
        if (e.kind === 'auto' && dt > 0 && dt < 3) x += f1(n, 300 + 500 * Math.sin(Math.PI * dt / 3), 0.8) * Math.sin(Math.PI * dt / 3) * 0.7;
        if (e.kind === 'clacson' && dt > 0 && dt < 0.45) { var hx = ((t * e.f) % 1) * 2 - 1 + ((t * e.f * 1.26) % 1) * 2 - 1; x += f2(hx, 900, 1.1) * 0.12 * Math.min(1, dt / 0.02) * Math.min(1, (0.45 - dt) / 0.05); }
      }
      b[i] = x;
    }
    return fades(norm(b, 0.8), sr, 1.5, 1.5);
  }
  function wind(sr, seed, o) {
    var r = rng(seed), dur = (o && o.dur) || 8, b = buf(sr, dur), f1 = bp(sr), lp = 0, g1 = r() * 6, g2 = r() * 6;
    for (var i = 0; i < b.length; i++) {
      var t = i / sr, n = r() * 2 - 1, gust = 0.55 + 0.3 * Math.sin(TAU * 0.11 * t + g1) + 0.15 * Math.sin(TAU * 0.31 * t + g2);
      lp += lpK(2500, sr) * (n - lp); b[i] = f1(lp, 380 + 520 * gust, 3.5) * gust;
    }
    return fades(norm(b, 0.8), sr, 1.5, 1.5);
  }
  function sea(sr, seed, o) {
    var r = rng(seed), dur = (o && o.dur) || 8, b = buf(sr, dur), lp = 0, hp = 0, per = 5.5 + r() * 2;
    for (var i = 0; i < b.length; i++) {
      var t = i / sr, n = r() * 2 - 1, w = Math.pow(0.5 - 0.5 * Math.cos(TAU * t / per), 2);
      lp += lpK(500 + 1600 * w, sr) * (n - lp); hp += lpK(3000, sr) * (n - hp);
      b[i] = lp * (0.25 + w) + (n - hp) * w * w * 0.25;
    }
    return fades(norm(b, 0.8), sr, 1.5, 1.5);
  }
  function crowd(sr, seed, o) {
    var r = rng(seed), dur = (o && o.dur) || 6, b = buf(sr, dur), fs = [bp(sr), bp(sr), bp(sr)], ff = [550, 1250, 2600], mods = [r() * 6, r() * 6, r() * 6];
    for (var i = 0; i < b.length; i++) {
      var t = i / sr, n = r() * 2 - 1, x = 0, swell = Math.min(1, t / (dur * 0.4));
      for (var k = 0; k < 3; k++) x += fs[k](n, ff[k] * (1 + 0.1 * Math.sin(TAU * (0.9 + k) * t + mods[k])), 2.2) * (0.6 + 0.4 * Math.sin(TAU * (3.1 + k * 1.7) * t + mods[k]));
      b[i] = x * (0.4 + 0.6 * swell);
    }
    return fades(norm(b, 0.8), sr, 0.6, 1.5);
  }
  function vinyl(sr, seed, o) {
    var r = rng(seed), dur = (o && o.dur) || 8, b = buf(sr, dur), lp = 0, c = 0;
    for (var i = 0; i < b.length; i++) { var n = r() * 2 - 1; lp += lpK(1200, sr) * (n - lp); if (r() < 9 / sr) c = (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.5); b[i] = lp * 0.12 + c; c *= 0.6; }
    return fades(norm(b, 0.6), sr, 0.8, 0.8);
  }
  function fire(sr, seed, o) {
    var r = rng(seed), dur = (o && o.dur) || 6, b = buf(sr, dur), lp = 0, c = 0, cf = 0;
    for (var i = 0; i < b.length; i++) { var n = r() * 2 - 1; lp += lpK(400, sr) * (n - lp); if (r() < 14 / sr) { c = 0.4 + r() * 0.6; cf = r(); } c *= 0.985 - cf * 0.01; b[i] = lp * 0.9 + n * c * 0.6; }
    return fades(norm(b, 0.8), sr, 0.8, 1.2);
  }
  function heart(sr, seed, o) {
    var dur = (o && o.dur) || 6, b = buf(sr, dur), per = 60 / ((o && o.bpm) || 72), i, k;
    for (k = 0; k * per < dur - 0.3; k++) [[0, 1, 55], [0.17, 0.75, 48]].forEach(function (h) {
      var s0 = Math.round((k * per + h[0]) * sr), ph = 0;
      for (i = 0; i < 0.22 * sr && s0 + i < b.length; i++) { var t = i / sr; ph += TAU * h[2] * (1 + 0.6 * Math.exp(-t * 30)) / sr; b[s0 + i] += Math.sin(ph) * h[1] * Math.exp(-t * 16) * Math.min(1, t * 400); }
    });
    return norm(b);
  }
  function clock(sr, seed, o) {
    var r = rng(seed), dur = (o && o.dur) || 4, b = buf(sr, dur), per = 60 / ((o && o.bpm) || 60), f1 = bp(sr), i, k;
    for (k = 0; k * per < dur; k++) { var s0 = Math.round(k * per * sr), fc = k % 2 ? 2100 : 3200; for (i = 0; i < 0.03 * sr && s0 + i < b.length; i++) b[s0 + i] += (r() * 2 - 1) * Math.exp(-i / sr * 260); for (i = 0; i < 0.03 * sr && s0 + i < b.length; i++) b[s0 + i] = f1(b[s0 + i], fc, 6) * 4; }
    return norm(b);
  }
  function bell(sr, seed, o) {
    var dur = (o && o.dur) || 5, b = buf(sr, dur), f0 = mtof(((o && o.midi) != null ? o.midi : 57)), P = [[0.5, 1, 2.6], [1, 0.8, 1.9], [1.183, 0.6, 1.4], [1.506, 0.45, 1.1], [2, 0.5, 0.9], [2.514, 0.3, 0.6], [2.662, 0.25, 0.55], [3.011, 0.2, 0.45], [4.166, 0.12, 0.3]];
    P.forEach(function (p) { var w = TAU * f0 * p[0] / sr; for (var i = 0; i < b.length; i++) b[i] += Math.sin(w * i) * p[1] * Math.exp(-i / sr / p[2]) * Math.min(1, i / (0.002 * sr)); });
    return norm(b);
  }
  function glass(sr, seed) {
    var r = rng(seed), b = buf(sr, 1.6), hp = 0, i, k;
    for (i = 0; i < 0.12 * sr; i++) { var n = r() * 2 - 1; hp += lpK(2500, sr) * (n - hp); b[i] += (n - hp) * Math.exp(-i / sr * 30); }
    for (k = 0; k < 38; k++) { var s0 = Math.round(Math.pow(r(), 1.8) * 1.2 * sr), f = 2200 + r() * 7000, a = 0.15 + r() * 0.35, dk = 25 + r() * 60; for (i = 0; i < 0.25 * sr && s0 + i < b.length; i++) b[s0 + i] += Math.sin(TAU * f * i / sr) * a * Math.exp(-i / sr * dk); }
    return norm(b);
  }
  function lighter(sr, seed) {
    var r = rng(seed), b = buf(sr, 1.4), f1 = bp(sr), i;
    for (i = 0; i < b.length; i++) { var t = i / sr, n = r() * 2 - 1, click = t < 0.006 ? n : (t > 0.07 && t < 0.075 ? n * 0.7 : 0), flame = t > 0.1 ? f1(n, 700, 0.7) * Math.min(1, (t - 0.1) / 0.15) * Math.exp(-(t - 0.25) * 1.6) * 0.8 : 0; b[i] = click + flame; }
    return fades(norm(b), sr, 0, 0.2);
  }
  function cashCounter(sr, seed) {
    var r = rng(seed), b = buf(sr, 1.7), f1 = bp(sr), per = 1 / 32, i, k;
    for (i = 0; i < b.length; i++) b[i] = Math.sin(TAU * 118 * i / sr) * 0.05 * Math.min(1, i / (0.05 * sr));
    for (k = 0; k * per < 1.45; k++) { var s0 = Math.round((0.08 + k * per + (r() - 0.5) * 0.004) * sr); for (i = 0; i < 0.012 * sr && s0 + i < b.length; i++) b[s0 + i] += f1(r() * 2 - 1, 3200, 1.5) * Math.exp(-i / sr * 400) * 1.6; }
    return fades(norm(b), sr, 0.01, 0.12);
  }
  function coins(sr, seed) {
    var r = rng(seed), b = buf(sr, 1.3), i, k;
    for (k = 0; k < 14; k++) { var s0 = Math.round(r() * 0.7 * sr), f = 3800 + r() * 3500; for (i = 0; i < 0.4 * sr && s0 + i < b.length; i++) b[s0 + i] += (Math.sin(TAU * f * i / sr) + 0.5 * Math.sin(TAU * f * 1.48 * i / sr)) * Math.exp(-i / sr * 14) * (0.4 + r() * 0.5); }
    return norm(b);
  }
  function phone(sr, seed) {
    var r = rng(seed), b = buf(sr, 1.5), lp = 0, i;
    for (i = 0; i < b.length; i++) { var t = i / sr, on = (t < 0.42 || (t > 0.75 && t < 1.17)) ? 1 : 0, sq = Math.sin(TAU * 172 * t) > 0 ? 1 : -1; lp += lpK(900, sr) * ((sq + (r() - 0.5) * 0.6) * on - lp); b[i] = lp; }
    return fades(norm(b), sr, 0.005, 0.05);
  }
  function horn(sr, seed) {
    var b = buf(sr, 0.9), f1 = bp(sr), i;
    for (i = 0; i < b.length; i++) { var t = i / sr, x = ((t * 415) % 1) * 2 - 1 + ((t * 523) % 1) * 2 - 1; b[i] = Math.tanh(f1(x, 1000, 0.9) * 3) * Math.min(1, t / 0.02) * Math.min(1, (0.85 - t) / 0.05); }
    return fades(norm(b), sr, 0, 0.05);
  }
  function impact(sr, seed, o) {
    var r = rng(seed), big = o && o.big, dur = big ? 4.5 : 3, b = buf(sr, dur), ph = 0, lp = 0, rum = 0, i;
    for (i = 0; i < b.length; i++) {
      var t = i / sr, n = r() * 2 - 1, f = 34 + 70 * Math.exp(-t * 3.2); ph += TAU * f / sr; lp += lpK(big ? 2500 : 4500, sr) * (n - lp); rum += lpK(180, sr) * (n - rum);
      b[i] = Math.sin(ph) * Math.exp(-t / 1.2) * 1.2 + lp * Math.exp(-t * (big ? 5 : 14)) * 0.9 + (big ? rum * Math.exp(-t / 1.6) * 2.4 + (r() < 25 / sr * Math.exp(-t) ? (r() - 0.5) * 2 : 0) : 0)
        + (Math.sin(TAU * 151 * t) + Math.sin(TAU * 233 * t) * 0.7 + Math.sin(TAU * 371 * t) * 0.4) * Math.exp(-t * 3) * 0.15;
    }
    return fades(norm(b), sr, 0.002, 0.4);
  }
  /* transizioni (si allineano a FINE evento: finiscono sul punto) */
  function whoosh(sr, seed, o) {
    var r = rng(seed), dur = (o && o.dur) || 1.2, b = buf(sr, dur), f1 = bp(sr);
    for (var i = 0; i < b.length; i++) { var u = i / b.length, a = Math.pow(Math.sin(Math.PI * Math.pow(u, 1.6)), 2); b[i] = f1(r() * 2 - 1, 300 + 4200 * Math.sin(Math.PI * Math.pow(u, 1.3)), 1.4) * a; }
    return norm(b);
  }
  function riser(sr, seed, o) {
    var r = rng(seed), dur = (o && o.dur) || 3, b = buf(sr, dur), f1 = bp(sr), ph = 0, f0 = mtof(((o && o.midi) != null ? o.midi : 45));
    for (var i = 0; i < b.length; i++) { var u = i / b.length; ph += TAU * f0 * Math.pow(4, u) / sr; b[i] = (f1(r() * 2 - 1, 500 + 7000 * u * u, 1.2) * 0.8 + Math.sin(ph) * 0.25 + Math.sin(ph * 1.005) * 0.2) * Math.pow(u, 1.8); }
    return fades(norm(b), sr, 0, 0.01);
  }
  function revCym(sr, seed, o) {
    var r = rng(seed), dur = (o && o.dur) || 2, b = buf(sr, dur), hp = 0;
    for (var i = 0; i < b.length; i++) { var u = i / b.length, n = r() * 2 - 1; hp += lpK(5000, sr) * (n - hp); b[i] = (n - hp) * Math.pow(u, 3); }
    return fades(norm(b), sr, 0, 0.004);
  }
  /* suoni veri registrati (RealPerc, CC0) quando disponibili, altrimenti la versione sintetica */
  function RPx() { return (typeof self !== 'undefined' && self.RealPerc) || (typeof global !== 'undefined' && global.RealPerc) || null; }
  function realOr(fnReal, fnSynth) { return function (sr, seed, o) { var R = RPx(); if (R && R.ready()) { var y = fnReal(R, sr, seed, o || {}); if (y) return norm(y); } return fnSynth(sr, seed, o); }; }
  function sg(fn) { return function (sr, seed, o) { if (!SigFx) return buf(sr, 0.2); return norm(fn(sr, seed, o || {})); }; }

  /* tipo: 'letto' = sfondo lungo (dura una sezione), 'colpo' = suono singolo, 'fine' = transizione che finisce sul punto */
  var SOUNDS = {
    temporale: { nome: 'Temporale (tuono)', gruppo: 'Natura', tipo: 'colpo', g: 0.55, make: thunder },
    pioggia: { nome: 'Pioggia', gruppo: 'Natura', tipo: 'letto', g: 0.2, make: rain },
    vento: { nome: 'Vento', gruppo: 'Natura', tipo: 'letto', g: 0.2, make: wind },
    mare: { nome: 'Mare e onde', gruppo: 'Natura', tipo: 'letto', g: 0.22, make: realOr(function (R, sr, s, o) { return R.bed('ocean', sr, (o && o.dur) || 8, s); }, sea) },
    fuoco: { nome: 'Fuoco che crepita', gruppo: 'Natura', tipo: 'letto', g: 0.18, make: fire },
    supercar: { nome: 'Supercar V12 (sgasata)', gruppo: 'Motori', tipo: 'colpo', g: 0.45, make: function (sr, s, o) { return engine(sr, s, { cyl: 12 }); } },
    v8: { nome: 'Supercar V8 (borbottio)', gruppo: 'Motori', tipo: 'colpo', g: 0.45, make: function (sr, s, o) { return engine(sr, s, { cyl: 8 }); } },
    passaggio: { nome: 'Auto che sfreccia', gruppo: 'Motori', tipo: 'colpo', g: 0.45, make: function (sr, s) { return engine(sr, s, { cyl: 12, passby: true, dur: 2.6 }); } },
    elicottero: { nome: 'Elicottero', gruppo: 'Motori', tipo: 'colpo', g: 0.4, make: helicopter },
    sirena: { nome: 'Sirena', gruppo: 'Strada', tipo: 'colpo', g: 0.3, make: sg(function (sr, s, o) { return SigFx.siren(sr, (o && o.dur) || 3, s); }) },
    sparo: { nome: 'Spari', gruppo: 'Strada', tipo: 'colpo', g: 0.5, make: sg(function (sr, s) { var a = SigFx.gunshot(sr, s), out = buf(sr, 1.6); [0, 0.32, 0.5].forEach(function (t0, q) { var o0 = Math.round(t0 * sr); for (var i = 0; i < a.length && o0 + i < out.length; i++) out[o0 + i] += a[i] * (1 - q * 0.2); }); return out; }) },
    corolirico: { nome: 'Coro lirico (nella tonalità)', gruppo: 'Cinema', tipo: 'letto', g: 0.35, make: sg(function (sr, s, o) { var t = (o && o.midi != null ? o.midi : 57) + 12; return SigFx.choir(sr, [t, t + (o && o.minor === false ? 4 : 3), t + 7], Math.min(12, (o && o.dur) || 6), s); }) },
    raffica: { nome: 'Raffica', gruppo: 'Strada', tipo: 'colpo', g: 0.4, make: sg(function (sr, s) { return SigFx.machinegun(sr, 1.1, s); }) },
    citta: { nome: 'Città di notte', gruppo: 'Strada', tipo: 'letto', g: 0.2, make: city },
    clacson: { nome: 'Clacson', gruppo: 'Strada', tipo: 'colpo', g: 0.25, make: horn },
    vetro: { nome: 'Vetro rotto', gruppo: 'Strada', tipo: 'colpo', g: 0.35, make: glass },
    folla: { nome: 'Folla / stadio', gruppo: 'Strada', tipo: 'letto', g: 0.2, make: crowd },
    contasoldi: { nome: 'Contasoldi', gruppo: 'Oggetti', tipo: 'colpo', g: 0.4, make: cashCounter },
    monete: { nome: 'Monete', gruppo: 'Oggetti', tipo: 'colpo', g: 0.3, make: coins },
    accendino: { nome: 'Accendino', gruppo: 'Oggetti', tipo: 'colpo', g: 0.4, make: lighter },
    telefono: { nome: 'Telefono che vibra', gruppo: 'Oggetti', tipo: 'colpo', g: 0.35, make: phone },
    orologio: { nome: 'Orologio (a tempo)', gruppo: 'Oggetti', tipo: 'letto', g: 0.2, make: clock },
    cuore: { nome: 'Battito del cuore', gruppo: 'Oggetti', tipo: 'letto', g: 0.35, make: heart },
    campana: { nome: 'Campana (nella tonalità)', gruppo: 'Oggetti', tipo: 'colpo', g: 0.3, make: bell },
    vinile: { nome: 'Vinile (fruscio)', gruppo: 'Oggetti', tipo: 'letto', g: 0.25, make: vinyl },
    impatto: { nome: 'Impatto cinema', gruppo: 'Cinema', tipo: 'colpo', g: 0.55, make: realOr(function (R, sr, s) { var a = R.hit('bdrum', sr, s), c = R.hit('crash', sr, s, 0.6), sy = impact(sr, s), n = Math.max(a.length, c.length, sy.length), y = new Float32Array(n); for (var i = 0; i < n; i++) y[i] = (a[i] || 0) * 0.9 + (c[i] || 0) * 0.5 + (sy[i] || 0) * 0.45; return y; }, impact) },
    esplosione: { nome: 'Esplosione', gruppo: 'Cinema', tipo: 'colpo', g: 0.5, make: function (sr, s) { return impact(sr, s, { big: true }); } },
    whoosh: { nome: 'Whoosh', gruppo: 'Cinema', tipo: 'fine', g: 0.35, make: whoosh },
    salita: { nome: 'Salita (riser)', gruppo: 'Cinema', tipo: 'fine', g: 0.3, make: realOr(function (R, sr, s, o) { var w = R.hit('swell', sr, s), d = Math.round(((o && o.dur) || 3) * sr), y = new Float32Array(d), off = Math.max(0, w.length - d); for (var i = 0; i < d; i++) y[i] = w[off + i] || 0; var syn = riser(sr, s, o); for (i = 0; i < d; i++) y[i] = y[i] * 0.8 + (syn[i] || 0) * 0.35; return y; }, riser) },
    reverse: { nome: 'Piatto al contrario', gruppo: 'Cinema', tipo: 'fine', g: 0.3, make: realOr(function (R, sr, s, o) { var c = R.hit('crash', sr, s), d = Math.min(c.length, Math.round(((o && o.dur) || 2) * sr)), y = new Float32Array(d); for (var i = 0; i < d; i++) y[i] = c[d - 1 - i] * Math.pow(i / d, 1.5); return y; }, revCym) }
  };
  /* interventi sulla TUA voce registrata (servono le prove registrate; gli ad-lib usano la tua banca di ad-lib) */
  var VOX = {
    eco: { nome: 'Eco sull\'ultima parola', spiega: 'l\'ultima parola rimbalza a tempo (delay 3/16) e si spegne filtrata' },
    risposta: { nome: 'Risposta pitchata', spiega: 'l\'ultima parola torna un battito dopo, un\'ottava sotto (o sopra)' },
    coro: { nome: 'Coro / armonie', spiega: 'la riga raddoppiata in ottava e quinta, dietro la voce' },
    scura: { nome: 'Voce scura (ottava sotto)', spiega: 'doppia la riga un\'ottava sotto, piano, per dare peso' },
    reverse: { nome: 'Reverse sulla prima parola', spiega: 'riverbero al contrario che sale fino alla riga' },
    adlib: { nome: 'Ad-lib tuoi', spiega: 'i tuoi ad-lib registrati (yeah, ehi, skrt…) nei vuoti dopo le righe, con eco' }
  };

  /* ---------- lettura del testo: immagini → suoni ---------- */
  var LEX = [
    [/tempor|tuon|fulmin|tempest|uragan|lampi\b/, ['temporale', 'pioggia'], 'temporale'],
    [/piogg|piove|bagnat|lacrim|piang/, ['pioggia'], 'pioggia/lacrime'],
    [/lambo|lamborghini|urus|ferrari|motore|bolide|sgomm|cavalli|turbo|acceler|tachimetr|v12\b|v8\b|porsche|amg\b|supercar|marmitt/, ['supercar', 'v8', 'passaggio'], 'motori'],
    [/macchin|auto\b|corsa|sfrecc|correre|corro|velocit|all'ora|autostrad|benz|bmw|audi/, ['passaggio', 'v8'], 'auto in corsa'],
    [/elicott|jet\b|aereo|volo\b|volare|in volo|privato/, ['elicottero'], 'volo'],
    [/siren|polizi|sbirr|guardie|caramba|carabin|volant|\bpula\b|questur|manette|blitz|police|perquisiz|retata/, ['sirena'], 'polizia'],
    [/spar|pistol|\bferro\b|glock|grillett|proiettil|calibr|piombo|bang\b|mirino/, ['sparo'], 'spari'],
    [/mitra|kalash|raffic|\bak\b|\bak47\b/, ['raffica'], 'raffica'],
    [/strad|quartier|citt[aà]|blocco|palazz|periferi|piazz|traffic|marciapied|\bzona\b|\bhood\b|block|viale|incrocio|semafor/, ['citta'], 'strada'],
    [/soldi|cash|euro\b|money|banconot|contant|milion|mazzett|guadagn|ricc[oh]|bigliett|\bcassa\b|grana|paper/, ['contasoldi', 'monete'], 'soldi'],
    [/cuore|battit|\bpetto\b|ansia|respir|\bpanico\b|\banima\b|dolor/, ['cuore'], 'cuore'],
    [/orolog|lancett|\bminut|second[io]\b|\bore\b|rolex|aspett|tic tac|tempo che|sveglio|insonni/, ['orologio'], 'tempo'],
    [/\bmare\b|\bonde\b|spiaggi|\bporto\b|barca|ocean|\briva\b/, ['mare'], 'mare'],
    [/\bdio\b|preg[ao]|preghier|chiesa|madonna|santo|angel|paradis|croce|benedi|signore|rosario|cielo/, ['campana'], 'fede'],
    [/vetro|rott[oa]|spezz|frant|cocci|specchi|crollo|cristall/, ['vetro'], 'qualcosa che si rompe'],
    [/fuoco|fiamm|bruci|accend|\bfumo|cenere|canna|sigar|blunt|incendi|accendino/, ['accendino', 'fuoco'], 'fuoco/fumo'],
    [/vento|freddo|\bgelo|neve|invern|brivid/, ['vento'], 'freddo/vento'],
    [/telefon|ti chiamo|mi chiami|chiamata|chiamami|squill|messagg|iphone|\bcell|whatsapp|vibra|notifich|scrivimi/, ['telefono'], 'telefono'],
    [/folla|stadio|\bpalco|concert|\bfan\b|pubblico|applaus|\blive\b|sold out|tour\b/, ['folla'], 'palco'],
    [/ricord|passato|anni fa|da piccol|infanzi|nostalg|vecchi tempi|bambin/, ['vinile'], 'ricordi'],
    [/esplod|bomba|boom\b|crash|schiant|botta|pugno|colpo|impatto|cadut|precipit/, ['esplosione', 'impatto'], 'colpo forte']
  ];
  var EMO = { rabbia: /rabbia|odio|guerra|nemic|vendett|sangue|lama|uccid|fanculo|infame/, dolore: /dolor|male\b|ferit|lacrim|solo\b|sola\b|perso|mancan|morto|mort[ei]|addio|vuoto/, gloria: /vinc|re\b|regina|corona|trono|top\b|cima|sogno|leggend|gloria|campion|oro\b|diamant/, amore: /amore|baci|cuore|ti amo|lei\b|piccola|bella\b/ };
  function words(l) { return String(l || '').toLowerCase().replace(/[^a-zà-ú0-9' ]+/g, ' '); }
  /** Legge una riga: suoni evocati, emozioni, quanto è "forte" (punchline). */
  function readLine(text) {
    var w = ' ' + words(text) + ' ', hits = [], emo = [];
    LEX.forEach(function (e) { if (e[0].test(w)) hits.push({ snd: e[1], why: e[2] }); });
    for (var k in EMO) if (EMO[k].test(w)) emo.push(k);
    var strong = (/[!]/.test(text) ? 1 : 0) + (/\b[A-ZÀ-Ú]{3,}\b/.test(text) ? 1 : 0) + hits.length * 0.5 + (emo.indexOf('rabbia') >= 0 || emo.indexOf('gloria') >= 0 ? 0.5 : 0);
    return { hits: hits, emo: emo, strong: strong };
  }
  var HARD = { drill: 1, brooklyn: 1, trapdark: 1, rage: 1, phonk: 1, street: 1, trap: 1, jersey: 1, plugg: 1, detroit: 1, clubtrap: 1 };

  /**
   * Piano di produzione dal testo. map = SongMap (plan, lines con startBar/bars/section).
   * opt: {genre, seed, density 0-2 (poco/normale/tanto), bpm, tonic, mode, adlibs (quanti ad-lib nella banca)}.
   * Ritorna {events:[{id, tipo:'sfx'|'vox', snd, bar, dur, gain, line, why}], themes:[...]}.
   */
  function plan(map, opt) {
    opt = opt || {}; var r = rng((opt.seed || 1) * 131 + 7), dens = opt.density == null ? 1 : opt.density, ev = [], uid = 0, used = {}, hard = HARD[opt.genre] === 1;
    if (!map || !map.plan) return { events: [], themes: [] };
    var secs = [], bar = 0; map.plan.forEach(function (s) { secs.push({ name: s[0], start: bar, bars: s[1] }); bar += s[1]; });
    var total = bar, lines = map.lines || [], themes = {}, maxUse = [1, 2, 3][dens] || 2;
    function push(o) { o.id = 'e' + (++uid); o.gain = o.gain == null ? 1 : o.gain; ev.push(o); return o; }
    function pickSnd(list) { var c = list.filter(function (s) { return (used[s] || 0) < maxUse; }); if (!c.length) return null; var s = c[Math.floor(r() * c.length)]; used[s] = (used[s] || 0) + 1; return s; }
    var read = lines.map(function (l) { return readLine(l.text); });
    read.forEach(function (rd, i) { rd.hits.forEach(function (h) { themes[h.why] = (themes[h.why] || 0) + 1; }); });
    // 1) sfondi (letti) per sezione: il tema più presente nelle righe di quella sezione
    secs.forEach(function (s) {
      var cnt = {}; lines.forEach(function (l, i) { if (l.startBar >= s.start && l.startBar < s.start + s.bars) read[i].hits.forEach(function (h) { h.snd.forEach(function (x) { if (SOUNDS[x].tipo === 'letto') cnt[x] = (cnt[x] || 0) + 1; }); }); });
      var best = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0];
      if (!best && s.name === 'intro') best = hard ? (r() < 0.5 ? 'citta' : 'vento') : (r() < 0.5 ? 'vinile' : 'pioggia');
      if (best && (s.name !== 'ritornello' || dens >= 2)) push({ tipo: 'sfx', snd: best, bar: s.start, dur: s.bars, gain: s.name === 'intro' ? 1.1 : 0.75, why: s.name === 'intro' && !cnt[best] ? 'atmosfera d\'apertura' : 'sfondo dal testo' });
    });
    // 2) colpi legati alle parole: nel vuoto alla FINE della riga (non coprono le parole)
    var lastAt = -9;
    lines.forEach(function (l, i) {
      var rd = read[i], cands = []; rd.hits.forEach(function (h) { h.snd.forEach(function (x) { if (SOUNDS[x].tipo !== 'letto') cands.push(x); }); });
      if (!cands.length) return;
      if (l.startBar - lastAt < (dens >= 2 ? 1 : 2)) return; // non troppo fitti
      var s = pickSnd(cands); if (!s) return; lastAt = l.startBar;
      var why = rd.hits.filter(function (h) { return h.snd.indexOf(s) >= 0; })[0];
      push({ tipo: 'sfx', snd: s, bar: l.startBar + l.bars - 0.25, line: i, why: '«' + l.text.slice(0, 40) + '» → ' + (why ? why.why : s) });
    });
    // 3) struttura da produttore: salita/whoosh dentro il ritornello, impatto sul primo colpo, reverse prima delle strofe
    secs.forEach(function (s, k) {
      if (s.name === 'ritornello') { push({ tipo: 'sfx', snd: dens >= 1 && k % 2 ? 'salita' : 'whoosh', bar: s.start, dur: s.name === 'ritornello' && dens >= 1 ? 1 : 0.5, gain: 0.9, why: 'entrata nel ritornello' }); push({ tipo: 'sfx', snd: hard && r() < 0.4 ? 'esplosione' : 'impatto', bar: s.start, gain: 0.9, why: 'colpo sul ritornello' }); }
      else if (s.name === 'strofa' && k > 0 && dens >= 1) push({ tipo: 'sfx', snd: 'reverse', bar: s.start, dur: 0.5, gain: 0.8, why: 'passaggio alla strofa' });
    });
    // 4) emozioni: rabbia → impatti duri; dolore → pioggia/campana; gloria → folla
    var emoC = {}; read.forEach(function (rd) { rd.emo.forEach(function (e) { emoC[e] = (emoC[e] || 0) + 1; }); });
    if ((emoC.dolore || 0) >= 2 && !ev.some(function (e) { return e.snd === 'pioggia'; }) && dens >= 1) { var sd = secs.filter(function (s) { return s.name === 'bridge' || s.name === 'outro'; })[0]; if (sd) push({ tipo: 'sfx', snd: 'pioggia', bar: sd.start, dur: sd.bars, gain: 0.8, why: 'malinconia del testo' }); }
    // firme del Cervello (SigFx): le mette la Produzione, una volta sola, così si possono spostare o togliere
    var SG = opt.sig || [], has = function (snd) { return ev.some(function (e) { return e.snd === snd; }); };
    secs.forEach(function (s, k) {
      if (SG.indexOf('coro') >= 0 && s.name === 'intro' && !has('corolirico')) push({ tipo: 'sfx', snd: 'corolirico', bar: s.start, dur: s.bars, gain: 1, why: 'firma: coro lirico in apertura' });
      if (SG.indexOf('sirena') >= 0 && s.name === 'ritornello' && k > 0 && !ev.some(function (e) { return e.snd === 'sirena' && Math.abs(e.bar - (s.start - 1)) < 1; })) push({ tipo: 'sfx', snd: 'sirena', bar: s.start - 1, gain: 0.9, why: 'firma: sirena prima del ritornello' });
      if (SG.indexOf('spari') >= 0 && s.name === 'ritornello' && !ev.some(function (e) { return e.snd === 'sparo' && Math.abs(e.bar - s.start) < 0.5; })) push({ tipo: 'sfx', snd: 'sparo', bar: s.start, gain: 0.9, why: 'firma: spari sul ritornello' });
      if (SG.indexOf('mitra') >= 0 && s.name === 'pre') push({ tipo: 'sfx', snd: 'raffica', bar: s.start + s.bars - 0.5, gain: 0.8, why: 'firma: raffica prima del drop' });
    });
    // 5) voce: eco sulle chiusure, risposte sulle punchline, cori nel ritornello, scura nei generi duri, reverse sulla prima riga del ritornello
    var firstChorus = true, k2 = 0;
    lines.forEach(function (l, i) {
      var rd = read[i];
      if (l.section === 'ritornello') {
        if (dens >= 1) push({ tipo: 'vox', snd: 'coro', bar: l.startBar, dur: l.bars, line: i, gain: 1, why: 'cori sul ritornello' });
        if (hard && dens >= 1) push({ tipo: 'vox', snd: 'scura', bar: l.startBar, dur: l.bars, line: i, gain: 1, why: 'peso alla voce (genere duro)' });
        if (firstChorus) { push({ tipo: 'vox', snd: 'reverse', bar: l.startBar, line: i, gain: 1, why: 'reverse che apre il ritornello' }); firstChorus = false; }
        if (i % 2 === 1 || dens >= 2) push({ tipo: 'vox', snd: 'eco', bar: l.startBar + l.bars, line: i, gain: 1, why: 'eco di chiusura' });
      } else {
        k2++;
        if (rd.strong >= 1.5 && dens >= 1) push({ tipo: 'vox', snd: 'risposta', bar: l.startBar + l.bars, line: i, gain: 1, why: 'punchline: risposta' });
        else if (k2 % (dens >= 2 ? 2 : 4) === 0) push({ tipo: 'vox', snd: 'eco', bar: l.startBar + l.bars, line: i, gain: 1, why: 'eco a fine frase' });
        if (opt.adlibs && k2 % (dens >= 2 ? 2 : 3) === 1) push({ tipo: 'vox', snd: 'adlib', bar: l.startBar + l.bars, line: i, gain: 1, pick: Math.floor(r() * opt.adlibs), why: 'ad-lib nel vuoto' });
      }
    });
    ev = ev.filter(function (e) { return e.bar < total; }).sort(function (a, b) { return a.bar - b.bar; });
    return { events: ev, themes: Object.keys(themes).sort(function (a, b) { return themes[b] - themes[a]; }), total: total };
  }

  /* ---------- render degli effetti (mono, sr della base) ---------- */
  var CACHE = {};
  function sound(id, sr, seed, o) {
    var key = id + '|' + sr + '|' + seed + '|' + JSON.stringify(o || {});
    if (!CACHE[key]) { var ks = Object.keys(CACHE); if (ks.length > 60) delete CACHE[ks[0]]; CACHE[key] = SOUNDS[id].make(sr, seed, o || {}); }
    return CACHE[key];
  }
  function renderSfx(events, sr, bpm, N, opt) {
    opt = opt || {}; var out = new Float32Array(N), barS = 240 / bpm;
    (events || []).forEach(function (e, k) {
      if (e.tipo !== 'sfx' || !SOUNDS[e.snd] || e.off) return; var S = SOUNDS[e.snd], seed = (opt.seed || 1) * 31 + k * 7 + (e.var || 0) * 977;
      var o = { bpm: bpm, midi: opt.tonic != null ? 48 + opt.tonic : 57, minor: opt.mode !== 'maggiore' };
      if (S.tipo === 'letto') o.dur = Math.max(2, (e.dur || 4) * barS + 0.6);
      if (S.tipo === 'fine') o.dur = Math.max(0.4, (e.dur || 1) * barS);
      if (e.snd === 'orologio' || e.snd === 'cuore') o.bpm = e.snd === 'orologio' ? bpm : bpm * (bpm > 100 ? 0.5 : 1) * 0.75;
      var b = sound(e.snd, sr, seed, o), g = S.g * (e.gain == null ? 1 : e.gain), at = Math.round(e.bar * barS * sr) - (S.tipo === 'fine' ? b.length : 0);
      for (var i = Math.max(0, -at); i < b.length && at + i < N; i++) out[at + i] += b[i] * g;
    });
    return out;
  }

  /* ---------- voce: ultima parola, spostamento di altezza, eco, riverbero ---------- */
  function env(x, sr, a, z) { var hop = Math.round(sr * 0.01), n = Math.max(0, Math.floor((z - a) / hop)), e = new Float32Array(n); for (var k = 0; k < n; k++) { var s = 0; for (var j = 0; j < hop; j++) { var v = x[a + k * hop + j] || 0; s += v * v; } e[k] = Math.sqrt(s / hop); } return { e: e, hop: hop }; }
  /** Trova [inizio, fine] (campioni) dell'ultima parola cantata tra t0 e t1 (secondi). */
  function lastWord(x, sr, t0, t1) {
    var a = Math.max(0, Math.round(t0 * sr)), z = Math.min(x.length, Math.round(t1 * sr)); if (z - a < sr * 0.1) return null;
    var E = env(x, sr, a, z), e = E.e, mx = 0, k; for (k = 0; k < e.length; k++) if (e[k] > mx) mx = e[k]; if (mx < 1e-3) return null;
    var th = mx * 0.18, end = -1; for (k = e.length - 1; k >= 0; k--) if (e[k] > th) { end = k; break; } if (end < 0) return null;
    var st = end, gap = 0; for (k = end; k >= 0 && end - k < 70; k--) { if (e[k] > th) { st = k; gap = 0; } else if (++gap > 7) break; }
    if (end - st < 8) st = Math.max(0, end - 25);
    return [a + st * E.hop, Math.min(x.length, a + (end + 3) * E.hop)];
  }
  function firstWord(x, sr, t0, t1) {
    var a = Math.max(0, Math.round(t0 * sr)), z = Math.min(x.length, Math.round(t1 * sr)); if (z - a < sr * 0.1) return null;
    var E = env(x, sr, a, z), e = E.e, mx = 0, k; for (k = 0; k < e.length; k++) if (e[k] > mx) mx = e[k]; if (mx < 1e-3) return null;
    var th = mx * 0.18, st = -1; for (k = 0; k < e.length; k++) if (e[k] > th) { st = k; break; } if (st < 0) return null;
    return [a + st * E.hop, Math.min(z, a + (st + 40) * E.hop)];
  }
  /** Cambio di altezza a durata costante (grani sovrapposti, finestra di Hann). Buono per voci di sfondo. */
  function pitch(x, sr, semi) {
    var ratio = Math.pow(2, semi / 12), G = Math.round(sr * 0.05), H = G >> 2, n = x.length, out = new Float32Array(n), w = new Float32Array(G), ws = new Float32Array(n), i, k;
    for (i = 0; i < G; i++) w[i] = 0.5 - 0.5 * Math.cos(TAU * i / G);
    for (var s0 = 0; s0 < n; s0 += H) {
      for (i = 0; i < G && s0 + i < n; i++) { var p = s0 + i * ratio - (ratio > 1 ? 0 : 0), j = Math.floor(p), f = p - j; var v = j + 1 < n ? x[j] * (1 - f) + x[j + 1] * f : 0; out[s0 + i] += v * w[i]; ws[s0 + i] += w[i]; }
    }
    for (i = 0; i < n; i++) if (ws[i] > 1e-3) out[i] /= ws[i];
    return out;
  }
  function slice(x, a, z) { return x.subarray(Math.max(0, a), Math.min(x.length, z)); }
  function addAt(out, seg, at, g) { for (var i = 0; i < seg.length; i++) { var j = at + i; if (j >= 0 && j < out.length) out[j] += seg[i] * g; } }
  function hpLp(seg, sr, hp, lp) { var o = new Float32Array(seg.length), h = 0, l = 0, kh = lpK(hp, sr), kl = lpK(lp, sr); for (var i = 0; i < seg.length; i++) { h += kh * (seg[i] - h); var y = seg[i] - h; l += kl * (y - l); o[i] = l; } return o; }
  /* riverbero semplice (4 comb + 2 allpass, Schroeder) */
  function verb(seg, sr, tail) {
    var n = seg.length + Math.round(tail * sr), o = new Float32Array(n), C = [0.0297, 0.0371, 0.0411, 0.0437], k;
    C.forEach(function (d) { var L = Math.round(d * sr), b = new Float32Array(L), p = 0, g = Math.pow(0.001, d / tail); for (var i = 0; i < n; i++) { var y = b[p]; b[p] = (i < seg.length ? seg[i] : 0) + y * g; o[i] += y * 0.25; p = (p + 1) % L; } });
    [0.005, 0.0017].forEach(function (d) { var L = Math.round(d * sr), b = new Float32Array(L), p = 0; for (var i = 0; i < n; i++) { var y = b[p], x = o[i]; b[p] = x + y * 0.6; o[i] = y - x * 0.6; p = (p + 1) % L; } });
    return o;
  }
  /**
   * Interventi vocali sulla voce registrata. voice = {x, sr} allineata al tempo della base (0 = inizio).
   * map = SongMap, opt: {bank:[{x, sr}] ad-lib registrati, melodic: true → risposta un'ottava sopra}.
   */
  function renderVox(events, voice, map, bpm, opt) {
    opt = opt || {}; if (!voice || !voice.x) return null; var x = voice.x, sr = voice.sr, out = new Float32Array(x.length + Math.round(sr * 3)), beat = 60 / bpm, lines = (map && map.lines) || [], any = false;
    (events || []).forEach(function (e) {
      if (e.tipo !== 'vox' || e.off) return; var l = lines[e.line], g = e.gain == null ? 1 : e.gain; if (!l && e.snd !== 'adlib') return;
      var nx = lines[e.line + 1], lend = l ? Math.min(l.end + beat * 0.75, nx ? nx.start - 0.03 : 1e9) : 0; // non sconfinare nella riga dopo
      if (e.snd === 'eco' || e.snd === 'risposta') {
        var w = lastWord(x, sr, l.start, lend); if (!w) return; var seg = slice(x, w[0], w[1]);
        if (e.snd === 'eco') { var d = Math.round(beat * 0.75 * sr), s1 = hpLp(seg, sr, 350, 4500); for (var k = 1; k <= 4; k++) { addAt(out, s1, w[0] + d * k, 0.5 * Math.pow(0.55, k - 1) * g); s1 = hpLp(s1, sr, 500, 3000); } }
        else { var ps = pitch(seg, sr, opt.melodic ? 12 : -12), at = w[1] + Math.round(beat * 0.5 * sr); addAt(out, hpLp(ps, sr, 120, 6000), at, 0.65 * g); addAt(out, hpLp(ps, sr, 400, 3000), at + Math.round(beat * 0.75 * sr), 0.25 * g); }
        any = true;
      } else if (e.snd === 'coro' || e.snd === 'scura') {
        var a = Math.round(l.start * sr), z = Math.min(x.length, Math.round(lend * sr)); if (z - a < sr * 0.2) return; var ln = slice(x, a, z);
        if (e.snd === 'coro') { addAt(out, hpLp(pitch(ln, sr, 12), sr, 300, 9000), a + Math.round(0.012 * sr), 0.2 * g); addAt(out, hpLp(pitch(ln, sr, 7), sr, 250, 8000), a + Math.round(0.022 * sr), 0.18 * g); addAt(out, hpLp(ln, sr, 200, 7000), a + Math.round(0.031 * sr), 0.22 * g); }
        else addAt(out, hpLp(pitch(ln, sr, -12), sr, 70, 4000), a + Math.round(0.008 * sr), 0.32 * g);
        any = true;
      } else if (e.snd === 'reverse') {
        var fw = firstWord(x, sr, l.start - beat * 0.25, l.end); if (!fw) return; var rv = verb(slice(x, fw[0], fw[1]), sr, 1.8), rr = new Float32Array(rv.length);
        for (var i = 0; i < rv.length; i++) rr[i] = rv[rv.length - 1 - i] * Math.pow(i / rv.length, 1.5);
        addAt(out, rr, fw[0] - rr.length + Math.round(0.02 * sr), 0.8 * g); any = true;
      } else if (e.snd === 'adlib') {
        var bank = opt.bank || []; if (!bank.length) return; var B = bank[(e.pick || 0) % bank.length], bx = B.x; if (B.sr !== sr) { var rt = B.sr / sr, nb = Math.floor(bx.length / rt), y = new Float32Array(nb); for (var q = 0; q < nb; q++) y[q] = bx[Math.floor(q * rt)]; bx = y; }
        var t0 = l ? l.end + beat * 0.25 : e.bar * 4 * beat, w2 = l ? lastWord(x, sr, l.start, lend) : null; if (w2) t0 = Math.max(t0, w2[1] / sr + beat * 0.25);
        var a2 = Math.round(t0 * sr); addAt(out, bx, a2, 0.7 * g); addAt(out, hpLp(bx, sr, 400, 4000), a2 + Math.round(beat * 0.75 * sr), 0.3 * g); addAt(out, hpLp(bx, sr, 600, 3000), a2 + Math.round(beat * 1.5 * sr), 0.15 * g); any = true;
      }
    });
    return any ? out : null;
  }
  function names() { var o = {}; for (var k in SOUNDS) o[k] = SOUNDS[k].nome; for (k in VOX) o['v:' + k] = VOX[k].nome; return o; }
  return { SOUNDS: SOUNDS, VOX: VOX, LEX: LEX, readLine: readLine, plan: plan, renderSfx: renderSfx, renderVox: renderVox, lastWord: lastWord, pitch: pitch, sound: sound, names: names, rng: rng };
});
