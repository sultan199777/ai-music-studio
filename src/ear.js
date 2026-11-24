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
      lufs: lufs(x, sr), peakDb: L.peakDb, rmsDb: L.rmsDb, crestDb: L.crestDb, swingDb: L.swingDb, clipped: L.clipped, centroidHz: Math.round(cen),
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


  /* ---------- loudness (stimata secondo lo schema ITU-R BS.1770: filtro K, finestre da 400 ms, doppio gate) ---------- */
  function biquad(type, f0, q, gainDb, sr) {
    var A = Math.pow(10, gainDb / 40), w = 2 * Math.PI * f0 / sr, c = Math.cos(w), sn = Math.sin(w), al = sn / (2 * q), b0, b1, b2, a0, a1, a2;
    if (type === 'hs') { var sq = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) + (A - 1) * c + sq); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - sq); a0 = (A + 1) - (A - 1) * c + sq; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - sq; }
    else { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
  }
  function runBq(x, c) { var y = new Float32Array(x.length), x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (var i = 0; i < x.length; i++) { var v = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2; y[i] = v; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; } return y; }
  function lufs(input, sr) {
    var x = mono(input); if (!x.length) return -120;
    var k = runBq(runBq(x, biquad('hs', 1681.97, 0.7072, 4.0, sr)), biquad('hp', 38.1355, 0.5003, 0, sr));
    var blk = Math.round(sr * 0.4), step = Math.round(sr * 0.1), E = [];
    for (var i = 0; i + blk <= k.length; i += step) { var s = 0; for (var j = 0; j < blk; j++) s += k[i + j] * k[i + j]; E.push(s / blk); }
    if (!E.length) { var t = 0; for (var q = 0; q < k.length; q++) t += k[q] * k[q]; return -0.691 + 10 * Math.log(t / k.length + 1e-12) / Math.LN10; }
    var lk = function (e) { return -0.691 + 10 * Math.log(e + 1e-12) / Math.LN10; };
    var g1 = E.filter(function (e) { return lk(e) > -70; }); if (!g1.length) return -120;
    var m1 = g1.reduce(function (a, b) { return a + b; }, 0) / g1.length, g2 = g1.filter(function (e) { return lk(e) > lk(m1) - 10; });
    if (!g2.length) return r1(lk(m1));
    return r1(lk(g2.reduce(function (a, b) { return a + b; }, 0) / g2.length));
  }

  /* ---------- voce registrata o intonata ---------- */
  function bandRatio(sp, lo, hi, tlo, thi, nyq) { var e = 0, t = 0, df = sp.df, i; hi = Math.min(hi, nyq); thi = Math.min(thi, nyq); for (i = Math.floor(lo / df); i <= Math.floor(hi / df); i++) e += sp.P[i] || 0; for (i = Math.floor(tlo / df); i <= Math.floor(thi / df); i++) t += sp.P[i] || 0; return t > 0 ? e / t : 0; }
  function listenVoice(input, sr) {
    var x = mono(input), n = x.length, i, win = Math.round(sr * 0.05), fr = [];
    for (i = 0; i + win <= n; i += win) { var s = 0; for (var k = 0; k < win; k += 2) s += x[i + k] * x[i + k]; fr.push(db(Math.sqrt(s / (win / 2)))); }
    var srt = fr.slice().sort(function (a, b) { return a - b; }), noise = srt.length ? srt[Math.floor(srt.length * 0.1)] : -120, speech = srt.length ? srt[Math.floor(srt.length * 0.9)] : -120;
    var L = levels(x, sr), sp = spectrum(x, sr), tot = 0; for (i = 1; i < sp.P.length; i++) tot += sp.P[i];
    var share = function (lo, hi) { var e = 0, nyq = sr / 2; for (var q = Math.floor(lo / sp.df); q <= Math.floor(Math.min(hi, nyq) / sp.df); q++) e += sp.P[q] || 0; return tot > 0 ? e / tot : 0; };
    var M = { peakDb: L.peakDb, rmsDb: L.rmsDb, lufs: lufs(x, sr), noiseFloorDb: r1(noise), speechDb: r1(speech), snrDb: r1(speech - noise), rumble: Math.round(share(20, 80) * 1000) / 1000, mud: Math.round(share(200, 400) * 1000) / 1000, presence: Math.round(share(2000, 5000) * 1000) / 1000, sibilance: Math.round(bandRatio(sp, 5500, 10000, 1000, 5000, sr / 2) * 1000) / 1000, clipped: L.clipped, seconds: r1(n / sr) };
    var F = [];
    if (L.peakDb < -50) return { metrics: M, findings: [{ level: 'errore', id: 'vuota', text: 'Quasi silenzio: la registrazione non ha segnale. Controlla il microfono.', fix: null }], verdict: 'vuota' };
    if (L.clipped > 4) F.push({ level: 'errore', id: 'clip', text: 'La voce è distorta (' + L.clipped + ' campioni al massimo): in registrazione il livello era troppo alto. Rifai la ripresa un po\' più lontano dal microfono: la distorsione non si toglie bene dopo.', fix: null });
    if (M.snrDb < 25) F.push({ level: 'avviso', id: 'rumore', text: 'Rumore di fondo alto: la voce supera il fruscio solo di ' + M.snrDb + ' dB (meglio sopra 30). Registra in una stanza più silenziosa o attiva la riduzione rumore.', fix: { adv: { clean: { denoiseDb: M.snrDb < 18 ? 14 : 9 } } } });
    if (M.rumble > 0.04) F.push({ level: 'avviso', id: 'rimbombo', text: 'Rimbombi e botti sotto 80 Hz (' + Math.round(M.rumble * 100) + '% dell\'energia): P e B sparati sul microfono o vibrazioni. Alzo il taglio dei bassi.', fix: { adv: { clean: { hp: 120 } } } });
    if (M.sibilance > 0.45) F.push({ level: 'avviso', id: 'sibilanti', text: 'Le "S" sono taglienti (energia 5,5-10 kHz pari al ' + Math.round(M.sibilance * 100) + '% dei medi-alti). Aumento il de-esser.', fix: { adv: { deess: { on: true, amount: 0.8 } } } });
    if (M.mud > 0.3) F.push({ level: 'avviso', id: 'scatola', text: 'Voce "scatolosa": troppa energia tra 200 e 400 Hz (' + Math.round(M.mud * 100) + '%). Tolgo qualche dB lì.', fix: { adv: { eq: { boxyDb: -4.5 } } } });
    if (M.presence < 0.05) F.push({ level: 'info', id: 'poca-presenza', text: 'Poca presenza tra 2 e 5 kHz (' + Math.round(M.presence * 100) + '%): la voce rischia di perdersi sopra una base pesante.', fix: { adv: { eq: { presenceDb: 4.5 } } } });
    if (M.lufs < -26) F.push({ level: 'avviso', id: 'piano', text: 'Voce molto bassa (' + M.lufs + ' LUFS): in mix andrà alzata molto e porterà con sé il rumore.', fix: null });
    var bad = F.filter(function (f) { return f.level === 'errore'; }).length, warn = F.filter(function (f) { return f.level === 'avviso'; }).length;
    return { metrics: M, findings: F, verdict: bad ? 'da rifare/correggere' : (warn ? 'migliorabile' : 'pulita') };
  }

  /* ---------- umore della base (stimato dai numeri) e coerenza con l'umore voluto ---------- */
  var MOODS = { malinconico: 'malinconico', dark: 'dark', euforico: 'euforico', aggressivo: 'aggressivo', romantico: 'romantico', nostalgico: 'nostalgico' };
  function moodOf(m) { // m: { mode, bpm, centroidHz, lowShare, crestDb }
    var sc = { malinconico: 0, dark: 0, euforico: 0, aggressivo: 0, romantico: 0, nostalgico: 0 }, minor = m.mode !== 'maggiore', bpm = m.bpm || 100, cen = m.centroidHz || 800, low = m.lowShare || 0.5;
    if (minor) { sc.malinconico += 1.5; sc.dark += 1.5; sc.nostalgico += 0.8; sc.aggressivo += 0.8; } else { sc.euforico += 2; sc.romantico += 1.5; sc.nostalgico += 0.5; }
    if (bpm < 95) { sc.malinconico += 1; sc.nostalgico += 1; sc.romantico += 0.8; } else if (bpm >= 135) { sc.aggressivo += 1.2; sc.dark += 0.6; sc.euforico += 0.6; } else { sc.euforico += 0.4; sc.dark += 0.4; }
    if (cen < 700) { sc.dark += 1.4; sc.aggressivo += 0.4; } else if (cen > 1100) { sc.euforico += 0.8; sc.romantico += 0.8; sc.malinconico += 0.3; }
    if (low > 0.75) { sc.dark += 0.8; sc.aggressivo += 0.6; }
    var order = Object.keys(sc).sort(function (a, b) { return sc[b] - sc[a]; });
    return { top: order[0], second: order[1], scores: sc };
  }

  return { lufs: lufs, listenVoice: listenVoice, moodOf: moodOf, MOODS: MOODS, listen: listen, spectrum: spectrum, BANDS: BANDS, REF: REF };
});
