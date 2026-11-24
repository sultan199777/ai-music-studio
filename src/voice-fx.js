/*
 * Effetti di trasformazione della voce (calcolo sul file, nessun plugin esterno):
 *  - vocoder: la voce "suona" un sintetizzatore che fa gli ACCORDI DELLA BASE (16 bande, come i vocoder classici):
 *             la voce dà le parole e il ritmo, il synth dà le note.
 *  - metallico: modulazione ad anello + risonanza a pettine (voce da robot/metallo).
 *  - radio: banda stretta 400-3500 Hz + leggera distorsione (voce da telefono/vecchia radio).
 * mix 0-1 = quanto effetto rispetto alla voce originale.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VoiceFx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function biquad(type, f, q, sr) {
    var w = 2 * Math.PI * f / sr, cs = Math.cos(w), sn = Math.sin(w), a = sn / (2 * q), b0, b1, b2, a0 = 1 + a, a1 = -2 * cs, a2 = 1 - a;
    if (type === 'bp') { b0 = a; b1 = 0; b2 = -a; } else if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; } else { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
  }
  function run(x, c) { var y = new Float32Array(x.length), x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (var i = 0; i < x.length; i++) { var v = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; }
  function peak(x) { var p = 0; for (var i = 0; i < x.length; i++) { var a = x[i] < 0 ? -x[i] : x[i]; if (a > p) p = a; } return p; }
  function blend(dry, wet, mix) { var pd = peak(dry), pw = peak(wet), g = pw > 0 ? pd / pw : 0, y = new Float32Array(dry.length); for (var i = 0; i < y.length; i++) y[i] = dry[i] * (1 - mix) + wet[i] * g * mix; return y; }

  /** Portante del vocoder: onde a dente di sega sulle note dell'accordo di ogni momento (chords: [{t0,t1,pcs}]). */
  function carrier(n, sr, chords, base) {
    var y = new Float32Array(n), ph = [0, 0, 0, 0];
    for (var i = 0; i < n; i++) {
      var t = i / sr, c = null; for (var k = 0; k < chords.length; k++) if (t >= chords[k].t0 && t < chords[k].t1) { c = chords[k]; break; }
      var pcs = c ? c.pcs : [base % 12, (base + 3) % 12, (base + 7) % 12], v = 0;
      for (var j = 0; j < Math.min(4, pcs.length); j++) { var f = 440 * Math.pow(2, (48 + pcs[j] - 69) / 12) * (j === 3 ? 2 : 1); ph[j] += f / sr; if (ph[j] > 1) ph[j] -= 1; v += 2 * ph[j] - 1; }
      y[i] = v / 3;
    }
    return y;
  }
  function vocoder(x, sr, opt) {
    opt = opt || {};
    var bands = opt.bands || 16, lo = 120, hi = Math.min(7000, sr / 2 - 500), car = carrier(x.length, sr, opt.chords || [], opt.tonic || 0), out = new Float32Array(x.length);
    var att = Math.exp(-1 / (sr * 0.004)), rel = Math.exp(-1 / (sr * 0.03));
    for (var b = 0; b < bands; b++) {
      var f = lo * Math.pow(hi / lo, (b + 0.5) / bands), q = 6, c = biquad('bp', f, q, sr);
      var mod = run(x, c), cb = run(car, c), e = 0;
      for (var i = 0; i < x.length; i++) { var a = mod[i] < 0 ? -mod[i] : mod[i]; e = a > e ? att * e + (1 - att) * a : rel * e + (1 - rel) * a; out[i] += cb[i] * e; }
    }
    // un po' di consonanti originali sopra (si capiscono le parole)
    var sib = run(x, biquad('hp', 5000, 0.7, sr)); for (var i2 = 0; i2 < out.length; i2++) out[i2] += sib[i2] * 0.04;
    return blend(x, out, opt.mix == null ? 0.8 : opt.mix);
  }
  function metallic(x, sr, opt) {
    opt = opt || {};
    var fr = opt.freq || 95, d = Math.round(sr / (opt.comb || 210)), y = new Float32Array(x.length);
    for (var i = 0; i < x.length; i++) { var r = x[i] * Math.sin(2 * Math.PI * fr * i / sr); y[i] = 0.6 * r + 0.4 * x[i] + (i >= d ? 0.55 * y[i - d] : 0); }
    return blend(x, y, opt.mix == null ? 0.7 : opt.mix);
  }
  function radio(x, sr, opt) {
    opt = opt || {};
    var y = run(run(x, biquad('hp', 400, 0.8, sr)), biquad('lp', 3500, 0.8, sr)), p = peak(y) || 1;
    for (var i = 0; i < y.length; i++) y[i] = Math.tanh(2.5 * y[i] / p) * p;
    return blend(x, y, opt.mix == null ? 0.9 : opt.mix);
  }
  var FX = { vocoder: { nome: 'Vocoder sugli accordi', fn: vocoder }, metallico: { nome: 'Metallico / robot', fn: metallic }, radio: { nome: 'Radio / telefono', fn: radio } };
  function apply(id, x, sr, opt) { return FX[id] ? FX[id].fn(x, sr, opt) : x; }
  return { FX: FX, apply: apply, vocoder: vocoder, metallic: metallic, radio: radio, carrier: carrier };
});
