/*
 * Effetti "firma" delle basi trap/drill moderne, tutti SINTETIZZATI da zero (nessun campione, nessun diritto di terzi):
 *  sirena (ambulanza/polizia), sparo, mitraglia (raffica), coro lirico (intro stile opera), filtro "focus" (intro ovattata che si apre sul drop).
 * Ogni funzione è deterministica col seme. I buffer sono Float32Array mono alla sample rate indicata.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SigFx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function rng(seed) { var a = (seed >>> 0) || 1; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var SIG = ['coro', 'sirena', 'spari', 'mitra', 'focus'];

  /* due toni che si alternano (ambulanza) o salita/discesa continua (sirena americana) */
  function siren(sr, dur, seed) {
    var r = rng(seed), len = Math.round(dur * sr), b = new Float32Array(len), ph = 0, lp = 0, wail = r() < 0.5, base = 620 + r() * 120, hi = base * 1.4;
    for (var i = 0; i < len; i++) {
      var t = i / sr, f = wail ? base + (hi - base) * (0.5 - 0.5 * Math.cos(2 * Math.PI * t / 1.6)) : (Math.floor(t / 0.42) % 2 ? hi : base);
      ph += 2 * Math.PI * f / sr; var x = Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.15 * Math.sin(3 * ph);
      lp += 0.35 * (x - lp); b[i] = lp * 0.5 * Math.min(1, t / 0.15) * Math.min(1, (len - i) / (0.25 * sr));
    }
    return b;
  }
  /* colpo secco + coda d'eco (riverbero finto) */
  function gunshot(sr, seed) {
    var r = rng(seed), len = Math.round(0.9 * sr), b = new Float32Array(len), lp = 0, ph = 0;
    for (var i = 0; i < len; i++) {
      var t = i / sr, n = r() * 2 - 1; lp += (0.55 - 0.4 * Math.min(1, t * 6)) * (n - lp);
      ph += 2 * Math.PI * (70 + 120 * Math.exp(-t * 40)) / sr;
      b[i] = lp * Math.exp(-t * 14) * 1.1 + Math.sin(ph) * Math.exp(-t * 18) * 0.6 + (r() * 2 - 1) * Math.exp(-t * 4.5) * 0.06 * Math.min(1, t * 30);
    }
    return b;
  }
  /* raffica: n colpi ravvicinati con ritmo leggermente irregolare */
  function machinegun(sr, dur, seed) {
    var r = rng(seed), len = Math.round(dur * sr), b = new Float32Array(len), gap = Math.round(0.065 * sr), shot = gunshot(sr, seed + 1), t0 = 0, k = 0;
    while (t0 < len - gap) { var g = 1 - 0.04 * k, off = t0 + Math.round((r() - 0.5) * 0.008 * sr); for (var i = 0; i < Math.round(0.12 * sr) && off + i < len; i++) if (off + i >= 0) b[off + i] += shot[i] * 0.8 * Math.max(0.5, g); t0 += gap; k++; }
    return b;
  }
  /* coro lirico: voci "aaah" con formanti, vibrato lento, attacco morbido; accordi dalla lista midi */
  function choir(sr, midis, dur, seed) {
    var r = rng(seed), len = Math.round(dur * sr), b = new Float32Array(len), F = [[800, 1], [1150, 0.6], [2900, 0.3]];
    midis.forEach(function (m, vi) {
      var f0 = 440 * Math.pow(2, (m - 69) / 12), ph = 0, vph = r() * 6.28, det = 1 + (vi - midis.length / 2) * 0.0012;
      for (var i = 0; i < len; i++) {
        var t = i / sr, vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.4 * t + vph), f = f0 * det * vib; ph += 2 * Math.PI * f / sr;
        var v = 0, h; for (h = 1; h <= 14; h++) { var fh = f * h, w = 0, q; for (q = 0; q < F.length; q++) w += F[q][1] * Math.exp(-Math.pow((fh - F[q][0]) / 320, 2)); v += Math.sin(ph * h) * w / h; }
        b[i] += v * 0.16 * Math.min(1, t / 0.9) * Math.min(1, (len - i) / (0.5 * sr));
      }
    });
    return b;
  }
  /* "focus": passa-basso che si apre da fromHz a toHz sulla finestra [i0,i1) di arr (modifica arr) */
  function focus(arr, sr, i0, i1, fromHz, toHz) {
    var y = 0, n = Math.min(i1, arr.length);
    for (var i = i0; i < n; i++) { var t = (i - i0) / Math.max(1, i1 - i0), fc = fromHz * Math.pow(toHz / fromHz, t * t), a = 1 - Math.exp(-2 * Math.PI * fc / sr); y += a * (arr[i] - y); arr[i] = y; }
    return arr;
  }
  /* quali firme usare: dal testo/stile (parole) e dal genere; deterministico col seme (Ipotesi di gusto, tarare a orecchio) */
  function pick(opt) {
    opt = opt || {}; var t = String(opt.styleText || '').toLowerCase(), r = rng(opt.seed || 1), out = [], sc = opt.scenes || {}, g = opt.genre || '';
    var forced = { coro: /coro|lirica|opera|chiesa|gospel/.test(t), sirena: /sirena|ambulanza|polizia|volante/.test(t), spari: /spari|sparo|pistola|colpi/.test(t), mitra: /mitra|raffica/.test(t), focus: /focus|tunnel|ovattat|filtro/.test(t) };
    var hard = { drill: 1, brooklyn: 1, trapdark: 1, rage: 1, phonk: 1, street: 1 }[g], soft = { emorap: 1, cloud: 1, epico: 1, rnb: 1, melodico: 1, boombap: 1, lofi: 1 }[g];
    var p = { coro: soft ? 0.45 : 0.2, sirena: hard ? 0.45 : 0.12, spari: hard ? 0.3 : 0.06, mitra: hard ? 0.25 : 0.05, focus: soft ? 0.35 : 0.3 };
    if (sc.strada > 0 || sc.rabbia > 0) { p.sirena += 0.15; p.spari += 0.1; }
    if (sc.epico > 0 || sc.dolore > 0) { p.coro += 0.2; p.focus += 0.15; }
    SIG.forEach(function (k) { if (forced[k] || r() < p[k]) out.push(k); });
    if (opt.none) return [];
    return out;
  }
  return { SIG: SIG, siren: siren, gunshot: gunshot, machinegun: machinegun, choir: choir, focus: focus, pick: pick, rng: rng };
});
