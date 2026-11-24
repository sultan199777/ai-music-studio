/*
 * Orecchio di Sultan: "ascolto" con strumenti di misura, come fa un fonico con gli analizzatori.
 *
 * Io non ho orecchie, ma posso MISURARE il suono: livello, dinamica, quanta energia c'è in basso (sub, 808),
 * al centro e in alto, dove sta il "centro di gravità" del suono, quante casse/808 ci sono per battuta,
 * se c'è distorsione (clipping), troppo "fango" o un suono troppo sottile (tipo flautino).
 * Le misure sono fatti (Misurato). I limiti di riferimento per genere sono punti di partenza di mestiere (Ipotesi):
 * l'ultima parola resta all'orecchio di chi ascolta, ma almeno ora ci sono numeri su cui discutere.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Ear = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BANDS = [['sub', 20, 60], ['basso', 60, 250], ['medio-basso', 250, 500], ['medio', 500, 2000], ['presenza', 2000, 5000], ['aria', 5000, 16000]];

  function mono(x) {
    if (!Array.isArray(x)) return x;
    if (x.length === 1) return x[0];
    var o = new Float32Array(x[0].length); for (var c = 0; c < x.length; c++) for (var i = 0; i < o.length; i++) o[i] += x[c][i] / x.length; return o;
  }
  function fft(re, im) { // radix-2 sul posto
    var n = re.length, i, j = 0, k, t;
    for (i = 1; i < n; i++) { var bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (var len = 2; len <= n; len <<= 1) {
      var ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (k = 0; k < len / 2; k++) {
          var a = i + k, b = a + len / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          var nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }
  function db(v) { return v > 1e-12 ? 20 * Math.log(v) / Math.LN10 : -120; }
  function r1(v) { return Math.round(v * 10) / 10; }

  /** Spettro medio (Welch, finestra di Hann, 4096 punti): restituisce potenza per riga e frequenza di ogni riga. */
  function spectrum(x, sr) {
    var N = 4096, hop = 2048, w = new Float32Array(N), i; for (i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
    var P = new Float64Array(N / 2), cnt = 0, re = new Float32Array(N), im = new Float32Array(N);
    var maxFrames = 400, stride = Math.max(hop, Math.floor((x.length - N) / maxFrames));
    for (var s = 0; s + N <= x.length; s += stride) {
      for (i = 0; i < N; i++) { re[i] = x[s + i] * w[i]; im[i] = 0; }
      fft(re, im); for (i = 0; i < N / 2; i++) P[i] += re[i] * re[i] + im[i] * im[i]; cnt++;
    }
    if (cnt) for (i = 0; i < P.length; i++) P[i] /= cnt;
    return { P: P, df: sr / N, frames: cnt };
  }

  function bandShares(sp, sr) {
    var out = {}, tot = 0, nyq = sr / 2;
    BANDS.forEach(function (b) {
      var lo = Math.floor(b[1] / sp.df), hi = Math.min(sp.P.length - 1, Math.floor(Math.min(b[2], nyq) / sp.df)), e = 0;
      for (var i = lo; i <= hi; i++) e += sp.P[i]; out[b[0]] = e; tot += e;
    });
    var sh = {}; BANDS.forEach(function (b) { sh[b[0]] = tot > 0 ? out[b[0]] / tot : 0; });
    return sh;
  }
  function centroid(sp) { var n = 0, d = 0; for (var i = 1; i < sp.P.length; i++) { n += i * sp.df * sp.P[i]; d += sp.P[i]; } return d > 0 ? n / d : 0; }

  /** Colpi nel grave: inviluppo sotto i ~150 Hz (filtro a una polo) e conteggio dei picchi. */
  function lowHits(x, sr, bpm) {
    var a = Math.exp(-2 * Math.PI * 150 / sr), y = 0, hop = Math.round(sr * 0.01), env = [], i, s;
    for (i = 0; i + hop <= x.length; i += hop) { var m = 0; for (s = 0; s < hop; s++) { y = (1 - a) * x[i + s] + a * y; m += y * y; } env.push(Math.sqrt(m / hop)); }
    var mx = 0; env.forEach(function (v) { if (v > mx) mx = v; });
    var hits = 0, last = -99, thr = mx * 0.35;
    for (i = 0; i < env.length; i++) {
      var pm = 1e9; for (s = Math.max(0, i - 4); s < i; s++) if (env[s] < pm) pm = env[s]; if (i === 0) pm = 0;
      if (env[i] > thr && env[i] > pm * 1.4 + mx * 0.02 && env[i] >= (env[i - 1] || 0) && env[i] >= (env[i + 1] || 0) && i - last > 8) { hits++; last = i; }
    }
    var bars = bpm ? (x.length / sr) / (240 / bpm) : null;
    return { hits: hits, perBar: bars ? r1(hits / bars) : null };
  }

  function levels(x, sr) {
    var n = x.length, pk = 0, sum = 0, clip = 0, dc = 0, i;
    for (i = 0; i < n; i++) { var v = x[i], a = v < 0 ? -v : v; if (a > pk) pk = a; sum += v * v; dc += v; if (a >= 0.999) clip++; }
    var rms = Math.sqrt(sum / Math.max(1, n));
    // dinamica nel tempo: RMS a finestre di 0,5 s
    var win = Math.round(sr * 0.5), vals = [];
    for (i = 0; i + win <= n; i += win) { var s2 = 0; for (var k = 0; k < win; k += 4) s2 += x[i + k] * x[i + k]; vals.push(db(Math.sqrt(s2 / (win / 4)))); }
    vals.sort(function (p, q) { return p - q; });
    var loud = vals.length ? vals[Math.floor(vals.length * 0.9)] : -120, quiet = vals.length ? vals[Math.floor(vals.length * 0.1)] : -120;
    return { peakDb: r1(db(pk)), rmsDb: r1(db(rms)), crestDb: r1(db(pk) - db(rms)), clipped: clip, dc: r1(db(Math.abs(dc / Math.max(1, n)))), swingDb: r1(loud - quiet) };
  }

  // Finestre di riferimento per genere (Ipotesi): quota di energia sotto 250 Hz, centro di gravità massimo, crest.
  var REF = {
    trapdark: { low: [0.55, 0.9], centroid: 1400, crest: [7, 16] }, drill: { low: [0.5, 0.9], centroid: 1500, crest: [7, 16] },
    trap: { low: [0.45, 0.88], centroid: 1700, crest: [7, 16] }, street: { low: [0.4, 0.85], centroid: 1800, crest: [7, 16] },
    boombap: { low: [0.3, 0.8], centroid: 2000, crest: [8, 18] }, clubtrap: { low: [0.35, 0.8], centroid: 2000, crest: [7, 15] },
    melodico: { low: [0.25, 0.75], centroid: 2300, crest: [8, 18] }, estate: { low: [0.2, 0.7], centroid: 2500, crest: [8, 18] }, epico: { low: [0.25, 0.75], centroid: 2300, crest: [8, 20] }
  };

  /**
   * @param {Float32Array|Float32Array[]} input  audio
   * @param {number} sr
   * @param {{genre?:string,bpm?:number}} [o]
   * @returns {{metrics:object, findings:Array<{level:string,id:string,text:string,fix:object|null}>, verdict:string}}
   */
  function listen(input, sr, o) {
    o = o || {};
    var x = mono(input), L = levels(x, sr), sp = spectrum(x, sr), sh = bandShares(sp, sr), cen = centroid(sp), hits = lowHits(x, sr, o.bpm);
    var low = sh.sub + sh.basso, M = {
      peakDb: L.peakDb, rmsDb: L.rmsDb, crestDb: L.crestDb, swingDb: L.swingDb, clipped: L.clipped, centroidHz: Math.round(cen),
      lowShare: Math.round(low * 100) / 100, shares: {}, lowHitsPerBar: hits.perBar, lowHits: hits.hits, seconds: r1(x.length / sr)
    };
    BANDS.forEach(function (b) { M.shares[b[0]] = Math.round(sh[b[0]] * 1000) / 1000; });
    var F = [], ref = REF[o.genre] || null;
    if (L.peakDb < -60) { F.push({ level: 'errore', id: 'silenzio', text: 'Quasi silenzio: non c\'è segnale da misurare.', fix: null }); return { metrics: M, findings: F, verdict: 'vuoto' }; }
    if (L.clipped > 8) F.push({ level: 'errore', id: 'clip', text: 'Distorsione digitale: ' + L.clipped + ' campioni al massimo. Abbassa il volume generale o la saturazione.', fix: { master: -2 } });
    if (L.peakDb > -0.3) F.push({ level: 'avviso', id: 'picco', text: 'Il picco tocca lo 0 dB: poco margine, rischio di distorsione su altoparlanti e conversioni.', fix: { master: -1 } });
    if (L.rmsDb < -24) F.push({ level: 'avviso', id: 'basso', text: 'Livello medio molto basso (' + L.rmsDb + ' dB): si sentirà debole rispetto agli altri brani.', fix: { master: 3 } });
    if (L.crestDb < 6) F.push({ level: 'avviso', id: 'schiacciato', text: 'Dinamica molto schiacciata (crest ' + L.crestDb + ' dB): suono "piatto", senza colpi.', fix: null });
    if (sh['medio-basso'] > 0.2) F.push({ level: 'avviso', id: 'fango', text: 'Troppo "fango" tra 250 e 500 Hz (' + Math.round(sh['medio-basso'] * 100) + '% dell\'energia): suono ovattato, strumenti che si coprono.', fix: { levels: { accordi: -0.15, pad: -0.15 } } });
    if (sh.aria > 0.12) F.push({ level: 'avviso', id: 'frizzante', text: 'Molta aria sopra i 5 kHz (' + Math.round(sh.aria * 100) + '%): suono sibilante e stancante, hi-hat o arpeggio troppo forti.', fix: { levels: { arpeggio: -0.2 } } });
    if (cen > 2000 && low < 0.3) F.push({ level: 'avviso', id: 'sottile', text: 'Suono sottile e acuto (centro di gravità ' + Math.round(cen) + ' Hz, grave solo ' + Math.round(low * 100) + '%): rischia di sembrare un flautino. Serve più peso in basso.', fix: { levels: { basso: 0.25, melodia: -0.2 } } });
    if (hits.perBar != null && hits.perBar < 1) F.push({ level: 'avviso', id: 'pochi-colpi', text: 'Pochi colpi nel grave (' + hits.perBar + ' a battuta): la base non "batte" abbastanza.', fix: { levels: { batteria: 0.15 } } });
    if (ref) {
      if (low < ref.low[0]) F.push({ level: 'avviso', id: 'poco-grave', text: 'Per ' + o.genre + ' ci si aspetta più energia sotto 250 Hz: qui ' + Math.round(low * 100) + '% (riferimento ' + Math.round(ref.low[0] * 100) + '-' + Math.round(ref.low[1] * 100) + '%). Alza il basso/808 o abbassa le parti acute.', fix: { levels: { basso: 0.2, melodia: -0.1, arpeggio: -0.1 } }, tag: 'Ipotesi' });
      else if (low > ref.low[1]) F.push({ level: 'avviso', id: 'troppo-grave', text: 'Il grave è ' + Math.round(low * 100) + '% (massimo ' + Math.round(ref.low[1] * 100) + '%): rischia di coprire la voce. Abbassa un po\' il basso.', fix: { levels: { basso: -0.15 } }, tag: 'Ipotesi' });
      if (cen > ref.centroid) F.push({ level: 'info', id: 'luminoso', text: 'Il suono è più luminoso del solito per ' + o.genre + ' (centro ' + Math.round(cen) + ' Hz, riferimento fino a ' + ref.centroid + ').', fix: { levels: { melodia: -0.1, arpeggio: -0.1 } }, tag: 'Ipotesi' });
      if (L.crestDb < ref.crest[0] || L.crestDb > ref.crest[1]) F.push({ level: 'info', id: 'crest', text: 'Dinamica (crest) ' + L.crestDb + ' dB fuori dalla finestra tipica ' + ref.crest[0] + '-' + ref.crest[1] + ' dB.', fix: null, tag: 'Ipotesi' });
    }
    var bad = F.filter(function (f) { return f.level === 'errore'; }).length, warn = F.filter(function (f) { return f.level === 'avviso'; }).length;
    return { metrics: M, findings: F, verdict: bad ? 'da correggere' : (warn ? 'migliorabile' : 'in ordine') };
  }

  return { listen: listen, spectrum: spectrum, BANDS: BANDS, REF: REF };
});
