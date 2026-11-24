/*
 * Autotune LEGGERO in tempo reale (SPERIMENTALE) per il monitor in cuffia.
 *
 * Funziona così: misura l'altezza della voce con la stessa idea di McLeod (autocorrelazione normalizzata, finestra ~37 ms
 * su audio ridotto a ~12 kHz), sceglie la nota più vicina della scala, ammorbidisce la correzione con la "velocità"
 * e sposta l'altezza con un cambio di tono a granuli (due letture che si sfumano in una linea di ritardo).
 *
 * Limiti onesti (la ricerca B dice: in tempo reale solo monitoraggio leggero):
 *  - la qualità è MOLTO più bassa dell'elaborazione sul file registrato (suono un po' granuloso, i formanti si spostano insieme alla nota);
 *  - la misura dell'altezza arriva con ~20-35 ms di ritardo, quindi sui cambi di nota rapidi la correzione parte in ritardo;
 *  - aggiunge un ritardo proprio (misurato da latencySamples) che si somma a quello del telefono e delle cuffie;
 *  - serve una voce sola e pulita: con musica forte nel microfono (altoparlante) sbaglia e fischia.
 * Non serve per registrare: la registrazione resta quella "asciutta" del microfono, poi elaborata sul file.
 *
 * IMPORTANTE: createCore deve restare una funzione AUTONOMA (nessun riferimento a variabili esterne), perché il suo
 * testo viene copiato dentro l'AudioWorklet del browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RtTune = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function createCore(sr, opts) {
    var STEPS = { maggiore: [0, 2, 4, 5, 7, 9, 11], minore: [0, 2, 3, 5, 7, 8, 10] };
    var P = { enabled: true, strength: 0.8, retuneMs: 30, tonic: 0, mode: 'cromatica', grainMs: 28 };
    var mask = [], i;
    function setParams(q) {
      if (!q) return;
      for (var k in P) if (q[k] !== undefined) P[k] = q[k];
      P.strength = Math.max(0, Math.min(1, +P.strength || 0)); P.retuneMs = Math.max(0, +P.retuneMs || 0);
      mask = [];
      for (var n = 0; n < 12; n++) mask.push(P.mode === 'cromatica' || !STEPS[P.mode]);
      if (STEPS[P.mode]) STEPS[P.mode].forEach(function (s) { mask[(P.tonic + s) % 12] = true; });
    }
    setParams(opts);
    function quant(m) {
      var base = Math.round(m), best = base, bd = 1e9;
      for (var d = -3; d <= 3; d++) { var c = base + d; if (!mask[((c % 12) + 12) % 12]) continue; var dist = Math.abs(c - m); if (dist < bd) { bd = dist; best = c; } }
      return best;
    }

    var D = Math.max(1, Math.round(sr / 12000)), srD = sr / D, FMIN = 75, FMAX = 800;
    var W = Math.max(Math.ceil(2.4 * srD / FMIN), Math.round(srD * 0.036)), maxLag = Math.min(W - 2, Math.ceil(srD / FMIN)), minLag = Math.max(2, Math.floor(srD / FMAX));
    var RM = 16383, ring = new Float32Array(RM + 1), wpos = 0, tmp = new Float32Array(W), nsdf = new Float32Array(maxLag + 2);
    var detHop = Math.max(64, Math.round(sr * 0.006)), sinceDet = 0;
    var G = Math.round(sr * P.grainMs / 1000), base = 48, Dl = 0;           // linea di ritardo a granuli
    var latencySamples = base + G / 2;
    var cents = 0, want = 0, unv = 0, hist = [], curQ = null, stats = { f0: 0, cents: 0, voiced: false, clarity: 0, detections: 0 };

    function detect() {
      var e = 0, j, k;
      for (j = 0; j < W; j++) { var s = 0, b = wpos - (W - j) * D; for (k = 0; k < D; k++) s += ring[(b + k) & RM]; tmp[j] = s / D; e += tmp[j] * tmp[j]; }
      stats.detections++;
      if (e / W < 2.5e-5) return 0; // più silenzioso di circa -46 dB: niente nota
      var lag;
      for (lag = 0; lag <= maxLag + 1; lag++) {
        var acf = 0, m = 0;
        for (j = 0; j < W - lag; j++) { var a = tmp[j], c = tmp[j + lag]; acf += a * c; m += a * a + c * c; }
        nsdf[lag] = m > 0 ? 2 * acf / m : 0;
      }
      var pos = minLag; while (pos < maxLag && nsdf[pos] > 0) pos++;
      var best = -1, bv = 0, peaks = [];
      for (lag = pos; lag <= maxLag; lag++) if (nsdf[lag] > nsdf[lag - 1] && nsdf[lag] >= nsdf[lag + 1] && nsdf[lag] > 0) { peaks.push(lag); if (nsdf[lag] > bv) { bv = nsdf[lag]; best = lag; } }
      if (best < 0 || bv < 0.85) { stats.clarity = bv; return 0; }
      var ch = best; for (j = 0; j < peaks.length; j++) if (nsdf[peaks[j]] >= 0.9 * bv) { ch = peaks[j]; break; }
      var y0 = nsdf[ch - 1], y1 = nsdf[ch], y2 = nsdf[ch + 1], dn = y0 - 2 * y1 + y2, sh = dn !== 0 ? 0.5 * (y0 - y2) / dn : 0;
      stats.clarity = y1;
      return srD / (ch + sh);
    }
    function control() {
      var f0 = detect();
      if (f0 > 0) {
        unv = 0; var m = 69 + 12 * Math.log(f0 / 440) / Math.LN2;
        hist.push(m); if (hist.length > 5) hist.shift();
        var med = hist.slice().sort(function (p, q) { return p - q; })[hist.length >> 1];
        var q = quant(med);
        if (curQ !== null && q !== curQ && Math.abs(med - q) + 0.12 >= Math.abs(med - curQ)) q = curQ; // isteresi
        curQ = q; want = Math.max(-100, Math.min(100, (q - med) * 100)) * P.strength;
        stats.f0 = f0; stats.voiced = true;
      } else { unv++; if (unv > 6) { want = 0; hist.length = 0; curQ = null; stats.voiced = false; stats.f0 = 0; } }
    }
    function rd(pos) { // lettura con interpolazione lineare, pos = quanti campioni indietro (frazionario)
      var ip = Math.floor(pos), f = pos - ip, idx = wpos - 1 - ip;
      return ring[idx & RM] * (1 - f) + ring[(idx - 1) & RM] * f;
    }
    function process(inp, out) {
      var n = inp.length, alpha = P.retuneMs <= 0 ? 1 : 1 - Math.exp(-1 / (sr * P.retuneMs / 1000));
      G = Math.round(sr * P.grainMs / 1000); latencySamples = base + G / 2;
      for (var s = 0; s < n; s++) {
        ring[wpos & RM] = inp[s]; wpos++;
        if (++sinceDet >= detHop) { sinceDet = 0; control(); }
        var target = P.enabled ? want : 0;
        cents += alpha * (target - cents);
        var r = Math.pow(2, cents / 1200);
        var act = Math.min(1, Math.abs(cents) / 3); act = act * act * (3 - 2 * act);
        Dl += (1 - r); if (Dl >= G) Dl -= G; else if (Dl < 0) Dl += G;
        var d2 = Dl + G / 2; if (d2 >= G) d2 -= G;
        var w1 = Math.sin(Math.PI * Dl / G); w1 *= w1; var w2 = 1 - w1;
        var shifted = w1 * rd(base + Dl) + w2 * rd(base + d2);
        var clean = rd(base + G / 2);
        var o = clean * (1 - act) + shifted * act;
        out[s] = o === o ? o : 0; // niente NaN
      }
      stats.cents = cents;
    }
    return { process: process, setParams: setParams, stats: stats, getLatencySamples: function () { return latencySamples; }, getLatencyMs: function () { return latencySamples / sr * 1000; }, detectDelayMs: (W / 2 * D) / sr * 1000 };
  }

  /** Testo del processore da caricare nell'AudioWorklet (si usa con URL.createObjectURL(new Blob([...]))). */
  function workletSource() {
    return '"use strict";var createCore=' + createCore.toString() + ';' +
      'class VlRt extends AudioWorkletProcessor{constructor(o){super();this.c=createCore(sampleRate,o.processorOptions||{});this.n=0;var s=this;this.port.onmessage=function(e){s.c.setParams(e.data)};}' +
      'process(inputs,outputs){var i=inputs[0]&&inputs[0][0],o=outputs[0]&&outputs[0][0];if(!o)return true;if(!i){o.fill(0);return true}this.c.process(i,o);if(++this.n%40===0)this.port.postMessage({f0:this.c.stats.f0,cents:this.c.stats.cents,voiced:this.c.stats.voiced,lat:this.c.getLatencyMs()});return true}}' +
      'registerProcessor("vl-rt",VlRt);';
  }

  return { createCore: createCore, workletSource: workletSource };
});
