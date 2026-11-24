/*
 * Laboratorio suoni: crea strumenti NUOVI partendo dai suoni grezzi.
 *
 * Un suono del laboratorio è una "ricetta":
 *   strati  : 1-3 sorgenti (strumenti veri o sintesi), ognuno con ottava, volume, scordatura
 *   morph   : 0-1, lo strato A si trasforma nello strato B durante la nota
 *   carattere (0-1): calore, brillantezza, sporco, nastro, lofi, movimento, luccichio,
 *             nebbia (granulare), risucchio (suono al contrario), doppio, attacco
 * Tutto è calcolato dal programma (filtri, saturazione, granulare, modulazioni):
 * il risultato non esiste in nessuna libreria. Le "ricette originali" qui sotto
 * sono state pensate per questo progetto (Ipotesi: il giudizio è a orecchio).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./instruments.js'));
  else root.SoundLab = factory(root.Instruments);
})(typeof self !== 'undefined' ? self : this, function (Inst) {
  'use strict';

  var KNOBS = {
    calore: 'Calore: toglie le frequenze acute dure, suono più morbido e vicino.',
    brillantezza: 'Brillantezza: alza le frequenze acute, suono più presente.',
    sporco: 'Sporco: saturazione, aggiunge armoniche e grinta (si sente anche dal telefono).',
    nastro: 'Nastro: l\'intonazione ondeggia piano come una vecchia cassetta. Nostalgia.',
    lofi: 'Lo-fi: riduce la qualità digitale (meno bit, meno campioni). Suono "rovinato" voluto.',
    movimento: 'Movimento: il volume pulsa lentamente, il suono respira.',
    luccichio: 'Luccichio: aggiunge lo stesso suono un\'ottava sopra, leggero. Suono più grande e brillante.',
    nebbia: 'Nebbia: sbriciola il suono in tantissimi granelli e li sparge nel tempo (sintesi granulare). Diventa una nuvola.',
    risucchio: 'Risucchio: aggiunge il suono al contrario che cresce fino alla fine della nota. Effetto "aspirato" verso la nota dopo.',
    doppio: 'Doppio: due copie leggermente scordate e sfasate. Suono più largo e spesso.',
    attacco: 'Attacco lento: la nota entra piano invece di colpire. Trasforma un pianoforte in un tappeto.'
  };
  var SYNTHS = {
    'synth:sub': { nome: 'Sub (sintesi)', range: [24, 60] },
    'synth:saw': { nome: 'Sega larga (sintesi)', range: [36, 96] },
    'synth:air': { nome: 'Aria (rumore intonato)', range: [48, 96] }
  };

  // ---------- ricette originali (pensate per questo progetto) ----------
  var ORIGINALS = [
    { id: 'lab:vetro', nome: 'Piano di vetro', strati: [{ src: 'piano', vol: 1 }, { src: 'glass', vol: 0.5, ott: 1 }], c: { luccichio: 0.4, brillantezza: 0.3, doppio: 0.3 },
      descr: 'Il colpo del pianoforte e la coda dei bicchieri di cristallo.', perche: 'Il piano da solo è ovunque: con la coda di vetro diventa luminoso e irreale, perfetto per ritornelli emotivi.', uso: 'Accordi lenti o melodia di poche note nel ritornello.', stili: ['trap', 'melodico'], tipo: 'corda', ruoli: ['melodia', 'accordi'] },
    { id: 'lab:fantasma', nome: 'Arpa fantasma', strati: [{ src: 'harp', vol: 1 }], c: { risucchio: 0.9, nebbia: 0.6, calore: 0.45, doppio: 0.3 },
      descr: 'Arpa con il suono al contrario che la risucchia e una nuvola granulare.', perche: 'Gli arpeggi d\'arpa sono comuni: il risucchio li fa "respirare all\'indietro", sembra un ricordo che torna.', uso: 'Arpeggi nella strofa, volume basso sotto la voce.', stili: ['trap', 'melodico', 'drill'], tipo: 'corda', ruoli: ['accordi', 'melodia'] },
    { id: 'lab:vhs', nome: 'Archi su nastro', strati: [{ src: 'violins', vol: 1 }, { src: 'cellos', vol: 0.6, ott: -1 }], c: { nastro: 0.7, lofi: 0.35, calore: 0.5 },
      descr: 'Orchestra d\'archi registrata su una cassetta consumata.', perche: 'Gli archi epici puliti sono freddi: rovinati diventano nostalgici e personali.', uso: 'Tappeto nel ritornello o intro.', stili: ['trap', 'melodico', 'lofi'], tipo: 'sostenuto', ruoli: ['pad', 'melodia'] },
    { id: 'lab:808voce', nome: '808 che canta', strati: [{ src: 'synth:sub', vol: 1 }, { src: 'synth:air', vol: 0.25, ott: 1 }], c: { sporco: 0.6, vocale: 0.8 },
      descr: 'Un basso sub con filtri a forma di vocale "o": sembra una voce profonda che canta le note.', perche: 'L\'808 di solito è solo potenza: con le formanti vocali diventa melodico e umano.', uso: 'Melodia grave nelle pause della voce, o raddoppio del basso nel ritornello.', stili: ['trap', 'drill'], tipo: 'sostenuto', ruoli: ['melodia', 'pad'] },
    { id: 'lab:cenere', nome: 'Campana di cenere', strati: [{ src: 'bells', vol: 1 }, { src: 'pizz', vol: 0.5 }], c: { sporco: 0.45, calore: 0.6, nebbia: 0.2 },
      descr: 'Campana tubolare sporca e scura, con un pizzicato dentro il colpo.', perche: 'La campana drill classica è brillante: questa è bruciata, più minacciosa.', uso: 'Un colpo ogni battuta o melodia lenta di 3-4 note.', stili: ['drill', 'epico'], tipo: 'percosso', ruoli: ['melodia', 'colore'] },
    { id: 'lab:liquida', nome: 'Kalimba liquida', strati: [{ src: 'kalimba', vol: 1 }, { src: 'marimba', vol: 0.4 }], c: { movimento: 0.5, luccichio: 0.35, doppio: 0.4 },
      descr: 'Kalimba e marimba insieme, con il volume che ondeggia come acqua.', perche: 'Unisce l\'Africa e il digitale: colore nuovo per afro-trap ed estate.', uso: 'Riff ripetuto di 4-8 note.', stili: ['estate', 'afro', 'trap'], tipo: 'corda', ruoli: ['melodia', 'accordi'] },
    { id: 'lab:nebbia', nome: 'Chitarra nella nebbia', strati: [{ src: 'guitar', vol: 1 }, { src: 'eguitar', vol: 0.4 }], c: { nebbia: 0.55, risucchio: 0.35, calore: 0.4 },
      descr: 'Chitarra acustica ed elettrica che si sciolgono in una nuvola.', perche: 'La chitarra emo/trap pulita è ovunque: questa è sognante, sembra lontana.', uso: 'Arpeggi lenti in minore, molto spazio intorno.', stili: ['trap', 'emo', 'melodico'], tipo: 'corda', ruoli: ['accordi', 'melodia'] },
    { id: 'lab:metamorfosi', nome: 'Piano che diventa archi', strati: [{ src: 'piano', vol: 1 }, { src: 'violins', vol: 0.9 }], morph: 1, c: { calore: 0.2 },
      descr: 'Ogni nota nasce pianoforte e si trasforma in violini mentre dura.', perche: 'Un solo strumento che cambia natura: nelle note lunghe crea emozione senza aggiungere tracce.', uso: 'Accordi lunghi (una o due battute).', stili: ['epico', 'melodico', 'trap'], tipo: 'sostenuto', ruoli: ['accordi', 'pad'] },
    { id: 'lab:ottonevetro', nome: 'Ottoni di cristallo', strati: [{ src: 'horn', vol: 1 }, { src: 'glass', vol: 0.6, ott: 1 }], morph: 0.6, c: { luccichio: 0.3 },
      descr: 'Il corno francese che sfuma in cristallo.', perche: 'Epico ma delicato: un tema eroico che non schiaccia la voce.', uso: 'Tema del ritornello o intro cinematica.', stili: ['epico', 'drill'], tipo: 'sostenuto', ruoli: ['melodia', 'pad'] },
    { id: 'lab:elettropizz', nome: 'Pizzicato elettrico', strati: [{ src: 'pizz', vol: 1 }, { src: 'eguitar', vol: 0.5 }], c: { sporco: 0.5, doppio: 0.3 },
      descr: 'Violini pizzicati con una chitarra elettrica distorta dentro.', perche: 'Drill + rock: aggressivo ma musicale.', uso: 'Melodie veloci e ripetute.', stili: ['drill', 'trap'], tipo: 'corda', ruoli: ['melodia'] },
    { id: 'lab:saxvuoto', nome: 'Sax nel vuoto', strati: [{ src: 'sax', vol: 1 }], c: { nebbia: 0.4, nastro: 0.3, calore: 0.4, attacco: 0.3 },
      descr: 'Sax tenore lontano, che si sfalda alla fine delle note.', perche: 'Il sax notturno diventa un fantasma: R&B moderno e scuro.', uso: 'Risposte brevi tra una riga e l\'altra.', stili: ['rnb', 'trap'], tipo: 'sostenuto', ruoli: ['melodia'] },
    { id: 'lab:respiro', nome: 'Organo che respira', strati: [{ src: 'organ', vol: 1 }, { src: 'synth:air', vol: 0.3 }], c: { movimento: 0.6, calore: 0.5, attacco: 0.6 },
      descr: 'Organo morbido con aria e un respiro lento del volume.', perche: 'Un tappeto vivo: non è mai fermo, riempie senza annoiare.', uso: 'Pad per tutta la strofa, volume basso.', stili: ['rnb', 'melodico', 'epico'], tipo: 'sostenuto', ruoli: ['pad'] }
  ];
  // Idee di generi nuovi (Ipotesi): combinazioni che non hanno ancora un nome.
  var GENRES = [
    { nome: 'Trap di vetro', base: 'trap', bpm: 130, inst: { melodia: 'lab:vetro', accordi: 'lab:fantasma', pad: 'lab:vhs' }, idea: 'Trap lenta (125-135 BPM) con suoni trasparenti e rovinati insieme: lucida in alto, nostalgica in basso. 808 lungo, pochi hi-hat.' },
    { nome: 'Drill di cenere', base: 'drill', bpm: 144, inst: { melodia: 'lab:cenere', accordi: 'lab:elettropizz', pad: 'lab:808voce' }, idea: 'Drill scura con campane bruciate, pizzicati elettrici e un 808 che "canta" le note.' },
    { nome: 'Afro liquido', base: 'estate', bpm: 104, inst: { melodia: 'lab:liquida', accordi: 'nylon', pad: 'lab:respiro' }, idea: 'Ritmo latino/afro con legni che ondeggiano come acqua: estivo ma notturno.' },
    { nome: 'Emo nella nebbia', base: 'trap', bpm: 128, inst: { melodia: 'lab:nebbia', accordi: 'lab:metamorfosi', pad: 'lab:vhs' }, idea: 'Chitarre sognanti che si sciolgono, accordi che diventano archi: per testi molto personali.' },
    { nome: 'Cinema notturno', base: 'epico', bpm: 84, inst: { melodia: 'lab:ottonevetro', accordi: 'lab:metamorfosi', pad: 'lab:respiro' }, idea: 'Colonna sonora intima: epico ma lascia spazio alla voce.' }
  ];

  // ---------- elaborazione ----------
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function synth(kind, midi, len, sr) {
    var b = new Float32Array(len), f = mtof(midi), ph = 0, i, r = rng(midi * 7 + 3);
    if (kind === 'synth:sub') {
      for (i = 0; i < len; i++) { var t = i / sr; ph += 2 * Math.PI * f * (1 + 0.4 * Math.exp(-t * 50)) / sr; b[i] = Math.tanh(Math.sin(ph) * 1.8) / Math.tanh(1.8) * Math.exp(-t * 0.5) * Math.min(1, i / 60); }
    } else if (kind === 'synth:saw') {
      [-12, -4, 4, 12].forEach(function (c, k) { var ff = f * Math.pow(2, c / 1200), p = k * 0.23; for (i = 0; i < len; i++) { b[i] += (2 * p - 1) * 0.25; p += ff / sr; if (p >= 1) p -= 1; } });
    } else { // aria: rumore filtrato attorno alla nota
      var w = 2 * Math.PI * f / sr, q = 0.02, y1 = 0, y2 = 0, c1 = 2 * (1 - q) * Math.cos(w), c2 = -(1 - q) * (1 - q);
      for (i = 0; i < len; i++) { var y = (r() * 2 - 1) * q * 2 + c1 * y1 + c2 * y2; y2 = y1; y1 = y; b[i] = y; }
      norm(b, 0.7);
    }
    return b;
  }
  function norm(x, to) { var pk = 0, i; for (i = 0; i < x.length; i++) if (Math.abs(x[i]) > pk) pk = Math.abs(x[i]); if (pk > 0) for (i = 0; i < x.length; i++) x[i] *= to / pk; return x; }
  function layer(L, midi, dur, sr) {
    var m = midi + 12 * (L.ott || 0), len = Math.round((dur + 0.6) * sr);
    if (SYNTHS[L.src]) return synth(L.src, m, len, sr);
    return Inst.renderRaw(L.src, m, dur, sr, { hold: (Inst.info(L.src) || {}).tipo === 'sostenuto' });
  }
  function onePoleLP(x, fc, sr) { var a = Math.exp(-2 * Math.PI * fc / sr), y = 0, o = new Float32Array(x.length); for (var i = 0; i < x.length; i++) { y = (1 - a) * x[i] + a * y; o[i] = y; } return o; }
  function resonate(x, f, q, sr) { var w = 2 * Math.PI * f / sr, r = 1 - Math.PI * f / q / sr, c1 = 2 * r * Math.cos(w), c2 = -r * r, y1 = 0, y2 = 0, o = new Float32Array(x.length); for (var i = 0; i < x.length; i++) { var y = x[i] * (1 - r) + c1 * y1 + c2 * y2; y2 = y1; y1 = y; o[i] = y; } return o; }

  /** Suona una ricetta: restituisce Float32Array a frequenza sr. */
  function render(rec, midi, dur, sr) {
    var c = rec.c || {}, R = rng((midi + 1) * 131 + (rec.seed || 0));
    var Ls = rec.strati.map(function (L) { return layer(L, midi, dur, sr); });
    if (Ls.some(function (x) { return !x; })) return null;
    var len = 0; Ls.forEach(function (x) { len = Math.max(len, x.length); });
    var mixA = new Float32Array(len), mixB = new Float32Array(len), hasB = rec.morph > 0 && Ls.length > 1, i, k;
    Ls.forEach(function (x, li) {
      var g = rec.strati[li].vol == null ? 1 : rec.strati[li].vol, dst = hasB && li === 1 ? mixB : mixA;
      for (i = 0; i < x.length; i++) dst[i] += x[i] * g;
    });
    var out = mixA;
    if (hasB) { // morph: A sfuma in B lungo la nota
      var T = Math.max(1, Math.round(dur * sr)), mo = Math.min(1, rec.morph);
      out = new Float32Array(len);
      for (i = 0; i < len; i++) { var p = Math.min(1, i / T) * mo; out[i] = mixA[i] * Math.cos(p * Math.PI / 2) + mixB[i] * Math.sin(p * Math.PI / 2); }
    }
    if (c.luccichio) { var up = layer({ src: rec.strati[0].src, ott: (rec.strati[0].ott || 0) + 1 }, midi, dur, sr); if (up) for (i = 0; i < Math.min(len, up.length); i++) out[i] += up[i] * 0.45 * c.luccichio; }
    if (c.doppio) { var d1 = Math.round(0.013 * sr), d2 = Math.round(0.021 * sr), o2 = new Float32Array(len); for (i = 0; i < len; i++) o2[i] = out[i] + c.doppio * 0.5 * ((out[i - d1] || 0) + (out[i - d2] || 0) * 0.8 * Math.sin(i / sr * 2 * Math.PI * 0.3)); out = o2; }
    if (c.risucchio) { // suono al contrario che cresce fino alla fine della nota
      var T2 = Math.min(len, Math.round(dur * sr)), rv = Ls[0];
      for (i = 0; i < T2; i++) { var j = T2 - 1 - i; if (j < rv.length) { var e = i / T2; out[i] += rv[j] * c.risucchio * 0.7 * e * e; } }
    }
    if (c.nebbia) { // granulare: granelli di 40-90 ms sparsi, con piccola scordatura
      var src = out.slice(), gN = Math.round(len / sr * 40 * c.nebbia) + 4, cloud = new Float32Array(len);
      for (k = 0; k < gN; k++) {
        var gl = Math.round((0.04 + 0.05 * R()) * sr), from = Math.floor(R() * Math.max(1, Math.min(src.length, Math.round(0.6 * sr)) - gl)), to = Math.floor(R() * Math.max(1, len - gl)), rate = Math.pow(2, (R() - 0.5) * 0.25 / 12);
        for (i = 0; i < gl; i++) { var w2 = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / gl), x0 = from + i * rate, j0 = x0 | 0; if (to + i < len && j0 + 1 < src.length) cloud[to + i] += (src[j0] + (src[j0 + 1] - src[j0]) * (x0 - j0)) * w2; }
      }
      norm(cloud, 0.5);
      for (i = 0; i < len; i++) out[i] = out[i] * (1 - 0.6 * c.nebbia) + cloud[i] * c.nebbia;
    }
    if (c.vocale) { var f1 = resonate(out, 450, 6, sr), f2 = resonate(out, 800, 8, sr); norm(f1, 1); norm(f2, 0.6); for (i = 0; i < len; i++) out[i] = out[i] * (1 - c.vocale * 0.7) + (f1[i] + f2[i]) * c.vocale * 0.6; }
    if (c.nastro) { // modulazione lenta dell'intonazione (wow) + veloce (flutter)
      var o3 = new Float32Array(len), depth = 0.0035 * c.nastro * sr;
      for (i = 0; i < len; i++) { var dl = depth * (1 + Math.sin(2 * Math.PI * 0.6 * i / sr)) + depth * 0.15 * (1 + Math.sin(2 * Math.PI * 7 * i / sr)), x1 = i - dl, j1 = Math.floor(x1); o3[i] = j1 >= 0 && j1 + 1 < len ? out[j1] + (out[j1 + 1] - out[j1]) * (x1 - j1) : 0; }
      out = o3;
    }
    if (c.sporco) { var dr = 1 + 6 * c.sporco; for (i = 0; i < len; i++) out[i] = Math.tanh(out[i] * dr) / Math.tanh(dr) * 0.9 + out[i] * 0.1; }
    if (c.calore || c.brillantezza) {
      var lp = onePoleLP(out, 2500, sr), warm = c.calore || 0, br = c.brillantezza || 0;
      for (i = 0; i < len; i++) out[i] = lp[i] + (out[i] - lp[i]) * (1 - 0.85 * warm + 1.2 * br);
    }
    if (c.lofi) { var hold = Math.max(1, Math.round(1 + c.lofi * 4)), lv = Math.pow(2, 12 - Math.round(c.lofi * 6)), v = 0; for (i = 0; i < len; i++) { if (i % hold === 0) v = Math.round(out[i] * lv) / lv; out[i] = v; } }
    if (c.movimento) { for (i = 0; i < len; i++) out[i] *= 1 - 0.45 * c.movimento * (0.5 + 0.5 * Math.sin(2 * Math.PI * (0.8 + c.movimento) * i / sr)); }
    var A = Math.round((c.attacco || 0) * 0.6 * sr), rel = Math.round(0.12 * sr), end = Math.min(len, Math.round(dur * sr) + rel + (rec.tipo === 'sostenuto' ? 0 : Math.round(0.5 * sr)));
    out = out.subarray(0, end);
    for (i = 0; i < end; i++) { var g2 = 1; if (i < A) g2 = i / A; if (i > end - rel) g2 *= (end - i) / rel; out[i] *= g2; }
    for (i = 0; i < end; i++) if (!Number.isFinite(out[i])) out[i] = 0;
    return norm(out, 0.85);
  }

  function deps(rec) { return rec.strati.map(function (L) { return L.src; }).filter(function (s) { return !SYNTHS[s]; }); }
  function rangeOf(rec) {
    var lo = 24, hi = 108;
    rec.strati.forEach(function (L) { var r = SYNTHS[L.src] ? SYNTHS[L.src].range : ((Inst.info(L.src) || {}).range || [36, 96]); lo = Math.max(lo, r[0] - 12 * (L.ott || 0)); hi = Math.min(hi, r[1] - 12 * (L.ott || 0)); });
    return lo < hi ? [lo, hi] : [36, 84];
  }
  /** Registra una ricetta come strumento usabile nell'arrangiatore (id 'lab:...'). */
  function install(rec) {
    var inf = { id: rec.id, nome: rec.nome, fam: 'laboratorio', famiglia: 'Laboratorio', fonte: 'laboratorio', tipo: rec.tipo || 'corda', range: rangeOf(rec), ruoli: rec.ruoli || ['melodia', 'accordi'],
      come: rec.uso || 'Strumento creato da te.', perche: rec.perche || '', combina: [], stili: rec.stili || [], descr: rec.descr || '' };
    Inst.registerCustom(rec.id, inf, function (midi, dur, sr) { return render(rec, midi, dur, sr); }, function () { return deps(rec).every(function (d) { return Inst.has(d); }); });
    return inf;
  }
  ORIGINALS.forEach(install);

  /** "Sorprendimi": inventa uno strumento nuovo, ripetibile dal seme. */
  function invent(seed, pool) {
    var R = rng(seed * 2654435761 + 7), P = pool && pool.length ? pool : Inst.CATALOG.map(function (c) { return c.id; }).filter(function (id) { return id !== 'flute'; }).concat(Object.keys(SYNTHS)); // niente flauto: non piace all'utente
    var pick = function () { return P[Math.floor(R() * P.length)]; }, a = pick(), b = pick(), n = 1 + Math.floor(R() * 2);
    var rec = { id: 'lab:inv' + seed, nome: 'Invenzione ' + seed, seed: seed, strati: [{ src: a, vol: 1 }], c: {}, tipo: (Inst.info(a) || {}).tipo || 'sostenuto', ruoli: ['melodia', 'accordi', 'pad'] };
    if (n > 1 && b !== a) rec.strati.push({ src: b, vol: 0.4 + 0.5 * R(), ott: R() < 0.3 ? 1 : 0 });
    if (rec.strati.length > 1 && R() < 0.4) rec.morph = 0.5 + 0.5 * R();
    var keys = Object.keys(KNOBS);
    for (var i = 0; i < 3; i++) { var k = keys[Math.floor(R() * keys.length)]; rec.c[k] = Math.round((0.25 + 0.6 * R()) * 100) / 100; }
    rec.descr = 'Strati: ' + rec.strati.map(function (L) { return (SYNTHS[L.src] || Inst.info(L.src) || { nome: L.src }).nome; }).join(' + ') + '. Carattere: ' + Object.keys(rec.c).join(', ') + '.';
    return rec;
  }

  return { KNOBS: KNOBS, SYNTHS: SYNTHS, ORIGINALS: ORIGINALS, GENRES: GENRES, render: render, install: install, invent: invent, deps: deps, rangeOf: rangeOf };
});
