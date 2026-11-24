/*
 * Beat Lab - pattern di partenza per stile, ORIGINALI (scritti qui, non copiati da brani).
 * Le regole vengono dalle schede di ricerca C (notes/RICERCA-C-produzione.md): half-time, rullante sul 3 (drill: sul 3 poi sul 4),
 * hi-hat a ottavi con rullate a fine battuta, swing MPC per il boom bap, quattro quarti per l'elettronico.
 * I numeri (BPM, swing, velocity) sono PUNTI DI PARTENZA da ascoltare e correggere, non verita'.
 *
 * Notazione dei pattern: una stringa per battuta, 16 caratteri (un carattere = un sedicesimo).
 *   '.' vuoto, cifra 1-9 = forza (9 = massima, 1 = ghost note).  Per le rullate una seconda stringa con 0/2/3/4.
 */
(function (root, factory) {
  var E = (typeof module === 'object' && module.exports) ? require('./beatlab-engine.js') : root.BeatEngine;
  if (typeof module === 'object' && module.exports) module.exports = factory(E);
  else root.BeatPatterns = factory(E);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  function velOf(c) { return c === '.' || c === ' ' ? 0 : Math.round(14 * (+c) + 1); }
  function row(str) { var o = []; for (var i = 0; i < str.length; i++) o.push(velOf(str[i])); return o; }
  function rrow(str) { var o = []; for (var i = 0; i < str.length; i++) o.push(str[i] === '.' ? 0 : +str[i]); return o; }

  // bass: elenco per battuta di [passo, durata in passi, gradino] (gradino = semitoni sopra la tonica; slide = 1 per glide)
  var STYLES = {
    trap: {
      name: 'Trap', desc: 'Lenta e pesante: cassa e rullante dimezzati, hi-hat veloci con rullate, 808 lunghi.',
      bpm: [130, 160, 140], swing: 50, key: { root: 0, scale: 'minor' }, kit: 'kitA', bassOct: 0,
      kick: ['9.....6...7.....', '9..5..6...7..5..'], snare: ['........9.......', '........9.......'], clap: ['........7.......', '........7.......'],
      hat: ['6454645464546453', '6454645464546454'], hatRoll: ['..............32', '......2.....3...'],
      ohat: ['..............5.', '................'], perc: ['................', '..............3.'],
      bass: [[[0, 5, 0], [5, 3, 0], [10, 4, 0]], [[0, 3, 0], [3, 2, 0], [6, 4, 3], [10, 3, 0], [13, 3, -2]]]
    },
    drill: {
      name: 'Drill', desc: 'Scura e nervosa: rullante sul 3 poi sul 4, hi-hat spezzati, 808 con scivolate.',
      bpm: [138, 150, 144], swing: 50, key: { root: 0, scale: 'phrygian' }, kit: 'kitB', bassOct: 0,
      kick: ['9..5....6..7....', '9....6..5.....7.'], snare: ['........9.......', '............9...'], clap: ['................', '................'],
      hat: ['7.5.7.5.7.5.7.5.', '7.5.7.5.7.5.7.5.'], hatRoll: ['.....3......2.3.', '..3.......2.3.4.'],
      ohat: ['................', '..............4.'], perc: ['................', '................'],
      bass: [[[0, 6, 0, 0], [9, 3, 7, 1], [13, 3, 0, 1]], [[0, 5, 0, 0], [5, 4, 3, 1], [10, 4, 1, 1], [14, 2, 0, 1]]]
    },
    boombap: {
      name: 'Boom bap', desc: 'Classico anni 90: cassa e rullante sui tempi, swing "MPC", suono polveroso.',
      bpm: [82, 98, 90], swing: 66, key: { root: 9, scale: 'minor' }, kit: 'kitC', bassOct: 0,
      kick: ['9.....5...7.....', '9.....5.7..5....'], snare: ['....9.......9...', '....9.......9..4'], clap: ['................', '................'],
      hat: ['6.3.5.3.6.3.5.43', '6.3.5.3.63.3.5.4.'], hatRoll: ['................', '..............2.'],
      ohat: ['................', '..............4.'], perc: ['................', '................'],
      bass: [[[0, 6, 0], [10, 5, 7]], [[0, 6, 0], [8, 3, 3], [12, 4, 5]]]
    },
    rnb: {
      name: 'R&B', desc: 'Morbida e spaziata: groove rilassato, rim e clap leggeri, hi-hat radi con ghost note.',
      bpm: [66, 90, 78], swing: 58, key: { root: 3, scale: 'minor' }, kit: 'kitC', bassOct: 0,
      kick: ['9.......6.5.....', '9.....5...6...5.'], snare: ['........7.......', '........7......3'], clap: ['........5.......', '........5.......'],
      hat: ['4.3.4.3.4.3.4.3.', '4.3.4.3.4.3.4.4.'], hatRoll: ['................', '..............2.'],
      ohat: ['..............3.', '..2.............'], perc: ['....3.......3...', '....3.....3.....'],
      bass: [[[0, 7, 0], [8, 3, 7], [12, 3, 5]], [[0, 6, 0], [6, 2, 3], [10, 5, 7]]]
    },
    pop: {
      name: 'Pop', desc: 'Chiara e ballabile: cassa sui tempi, rullante e clap sul 2 e 4, hi-hat a ottavi.',
      bpm: [92, 118, 100], swing: 50, key: { root: 0, scale: 'major' }, kit: 'kitA', bassOct: 0,
      kick: ['9.......8.5.....', '9.....5.8.......'], snare: ['....9.......9...', '....9.......9...'], clap: ['....6.......6...', '....6.......6...'],
      hat: ['7.5.7.5.7.5.7.5.', '7.5.7.5.7.5.7.6.'], hatRoll: ['................', '..............2.'],
      ohat: ['......4.......4.', '......4.......4.'], perc: ['................', '................'],
      bass: [[[0, 6, 0], [8, 6, 7]], [[0, 6, 5], [8, 4, 7], [12, 4, 0]]]
    },
    orchestrale: {
      name: 'Orchestrale', desc: 'Epica e cinematografica: colpi grandi e radi, tom in crescendo, pochi hi-hat.',
      bpm: [76, 100, 88], swing: 50, key: { root: 2, scale: 'minor' }, kit: 'kitB', bassOct: 0,
      kick: ['9...............', '9.......6.......'], snare: ['........9.......', '........9.......'], clap: ['................', '........4.......'],
      hat: ['3.2.3.2.3.2.3.2.', '3.2.3.2.3.2.3.2.'], hatRoll: ['................', '................'],
      ohat: ['................', '................'], perc: ['............4567', '............5678'],
      bass: [[[0, 16, 0]], [[0, 8, 0], [8, 8, 7]]]
    },
    elettronico: {
      name: 'Elettronico', desc: 'Ballabile: quattro quarti di cassa, clap sul 2 e 4, hi-hat aperti sui controtempi.',
      bpm: [118, 132, 124], swing: 50, key: { root: 5, scale: 'minor' }, kit: 'kitA', bassOct: 0,
      kick: ['9...9...9...9...', '9...9...9...9...'], snare: ['................', '................'], clap: ['....8.......8...', '....8.......8..5'],
      hat: ['..3...3...3...3.', '.4.3.4.3.4.3.4.3'], hatRoll: ['................', '..............2.'],
      ohat: ['..6...6...6...6.', '..6...6...6...6.'], perc: ['................', '..........3.....'],
      bass: [[[2, 2, 0], [6, 2, 0], [10, 2, 0], [14, 2, 7]], [[2, 2, 0], [6, 2, 0], [10, 2, 3], [14, 2, 0]]]
    }
  };
  var STYLE_IDS = Object.keys(STYLES);
  var SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], harmonicMinor: [0, 2, 3, 5, 7, 8, 11], pentMinor: [0, 3, 5, 7, 10], pentMajor: [0, 2, 4, 7, 9] };

  function mulberry(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function ensureBass(p) {
    var t = p.tracks.filter(function (x) { return x.kind === 'inst' && x.inst === 'sub808'; })[0];
    if (!t) { t = E.newInstTrack('sub808', '808'); t.id = 'i-808'; p.tracks.push(t); }
    return t;
  }
  function rootMidi(p, oct) { return 24 + p.key.root + (oct || 0) * 12; } // 808 intorno a Do1 (24)..Si1: nota piu' bassa udibile

  // Scrive i pattern dello stile nel progetto (2 battute a 16 passi; con altre misure ripete).
  function applyStyle(p, id, o) {
    o = o || {}; var S = STYLES[id]; if (!S) throw new Error('stile sconosciuto ' + id);
    p.style = id; p.bpm = o.keepBpm ? p.bpm : S.bpm[2]; p.swing = S.swing; p.key = { root: S.key.root, scale: S.key.scale }; p.kit = o.kit || (E.KITS[p.kit] && o.keepKit ? p.kit : S.kit);
    if (p.bars !== 2 || p.res !== 16) E.resize(p, 2, 16);
    var bpb = 2, res = 16;
    E.drumTracks(p).forEach(function (t) {
      var pat = S[t.lane], rolls = t.lane === 'hat' ? S.hatRoll : null;
      for (var i = 0; i < t.steps.length; i++) { var b = Math.floor(i / res) % bpb, s = i % res; t.steps[i] = velOf(pat[b][s]); t.roll[i] = rolls ? (rrow(rolls[b])[s]) : 0; if (t.roll[i] && !(t.steps[i] > 0)) t.steps[i] = 66; }
      t.rollShape = id === 'trap' || id === 'drill' ? 'down' : 'dip';
    });
    var bass = ensureBass(p); bass.notes = [];
    S.bass.forEach(function (bar, b) { bar.forEach(function (n) { bass.notes.push({ t: b * E.BAR + n[0] * 24, d: n[1] * 24 - 6, n: rootMidi(p) + n[2] + (S.key.scale === 'phrygian' && n[2] === 1 ? 0 : 0), v: 100, s: n[3] ? 1 : 0 }); }); });
    fixBassRange(bass);
    return p;
  }
  function fixBassRange(t) { t.notes.forEach(function (n) { while (n.n < 24) n.n += 12; while (n.n > 48) n.n -= 12; }); }

  /*
   * "Casuale ma sensato": non sceglie a caso passo per passo, ma dentro regole di genere.
   * - il rullante/clap resta dove lo stile lo vuole (half-time per trap/drill, 2 e 4 per boom bap/pop)
   * - le casse hanno posizioni "forti" (probabili) e non stanno mai attaccate al rullante ne' fra loro (distanza >= 2 passi)
   * - hi-hat: griglia dello stile con qualche passo tolto e rullate solo a fine battuta o prima del rullante
   * - il 808 segue le casse, con la stessa tonica dello stile e qualche nota della scala; nel drill scivola.
   */
  function randomize(p, id, seed, o) {
    o = o || {}; var S = STYLES[id || p.style]; id = id || p.style; var R = mulberry(seed == null ? Math.floor(Math.random() * 1e9) : seed);
    var energy = o.energy == null ? 0.5 : o.energy;
    applyStyle(p, id, { keepBpm: !!o.keepBpm });
    var res = 16, kinds = { trap: 4, drill: 4, boombap: 3, rnb: 3, pop: 3, orchestrale: 2, elettronico: 4 };
    var kLo = id === 'elettronico' ? 4 : 2, kHi = id === 'elettronico' ? 4 : (kinds[id] + 1 + Math.round(energy * 2));
    var tr = {}; E.drumTracks(p).forEach(function (t) { tr[t.lane] = t; });
    // BPM vicino al centro dell'intervallo (se non lo fissa l'utente)
    if (!o.keepBpm) p.bpm = Math.round(S.bpm[0] + (S.bpm[1] - S.bpm[0]) * (0.25 + R() * 0.5));
    for (var b = 0; b < 2; b++) {
      var base = b * res, snareSteps = [];
      for (var s = 0; s < res; s++) if (tr.snare.steps[base + s] > 0 || tr.clap.steps[base + s] > 0) snareSteps.push(s);
      // casse: pesi per posizione (inizio forte, poi sincopi tipiche)
      var weights = []; for (var q = 0; q < res; q++) weights.push(q === 0 ? 10 : (q % 4 === 0 ? 3 : (q % 2 === 0 ? 2.2 : 0.7)));
      if (id === 'elettronico') { for (var z = 0; z < res; z++) tr.kick.steps[base + z] = z % 4 === 0 ? 127 - Math.floor(R() * 8) : 0; }
      else {
        for (var z2 = 0; z2 < res; z2++) tr.kick.steps[base + z2] = 0;
        var want = kLo + Math.floor(R() * (kHi - kLo + 1)), placed = [];
        tr.kick.steps[base] = 127; placed.push(0);
        var guard = 0;
        while (placed.length < want && guard++ < 200) {
          var tot = 0, cand = []; for (var c = 1; c < res; c++) {
            var ok = placed.every(function (x) { return Math.abs(x - c) >= 2; }) && snareSteps.indexOf(c) < 0;
            if (ok) { cand.push(c); tot += weights[c]; }
          }
          if (!cand.length) break; var r = R() * tot, pick = cand[cand.length - 1];
          for (var ci = 0; ci < cand.length; ci++) { r -= weights[cand[ci]]; if (r <= 0) { pick = cand[ci]; break; } }
          placed.push(pick); tr.kick.steps[base + pick] = Math.round(70 + R() * 50);
        }
        placed.sort(function (x, y) { return x - y; });
      }
      // hi-hat: tolgo qualche passo e variano le forze
      var skip = id === 'drill' ? 0.28 : (id === 'trap' ? 0.1 : 0.12), hatBase = tr.hat.steps;
      for (var h = 0; h < res; h++) {
        var i = base + h; if (hatBase[i] <= 0) { tr.hat.roll[i] = 0; continue; }
        if (R() < skip && h % 4 !== 0) { hatBase[i] = 0; tr.hat.roll[i] = 0; continue; }
        hatBase[i] = Math.round(clampN(hatBase[i] + (R() - 0.5) * 22 + (h % 4 === 0 ? 8 : 0), 25, 120)); tr.hat.roll[i] = 0;
      }
      // rullate: solo sui passi che hanno un colpo, a fine battuta o subito prima del rullante
      var rollSpots = [14, 15, 13]; snareSteps.forEach(function (s2) { if (s2 > 1) rollSpots.push(s2 - 1, s2 - 2); });
      var nrolls = id === 'orchestrale' || id === 'rnb' ? (R() < 0.4 ? 1 : 0) : 1 + Math.floor(R() * (1 + energy * 2));
      for (var rr = 0; rr < nrolls; rr++) {
        var spot = rollSpots[Math.floor(R() * rollSpots.length)], ii = base + spot;
        if (spot < 0 || spot >= res) continue; if (hatBase[ii] <= 0) hatBase[ii] = 78; var types = id === 'drill' ? [3, 3, 2, 4] : [2, 3, 3, 4]; tr.hat.roll[ii] = types[Math.floor(R() * types.length)];
      }
      // hi-hat aperto raro, mai sullo stesso passo di un colpo pesante di rullante
      for (var o2 = 0; o2 < res; o2++) { tr.ohat.steps[base + o2] = 0; }
      if (id !== 'orchestrale' && R() < 0.65) { var os = id === 'elettronico' ? 2 + 4 * Math.floor(R() * 4) : 6 + 4 * Math.floor(R() * 2) + (R() < 0.5 ? 1 : 0); if (os < res && snareSteps.indexOf(os) < 0) tr.ohat.steps[base + os] = 60 + Math.floor(R() * 30); }
    }
    // 808 dal kick
    var bass = ensureBass(p); bass.notes = []; var degs = SCALES[p.key.scale] || SCALES.minor, rt = rootMidi(p), slide = id === 'drill';
    for (var b2 = 0; b2 < 2; b2++) {
      var ks = []; for (var u = 0; u < res; u++) if (tr.kick.steps[b2 * res + u] > 0) ks.push(u);
      ks.forEach(function (s3, idx) {
        var next = idx + 1 < ks.length ? ks[idx + 1] : res, len = Math.max(1, Math.min(next - s3, id === 'trap' || id === 'drill' ? 8 : 6));
        var pitch = 0; if (idx > 0 && R() < 0.4 + energy * 0.2) { var pool = [degs[0], degs[2 % degs.length], degs[4 % degs.length], degs[0], degs[6 % degs.length] - 12]; pitch = pool[Math.floor(R() * pool.length)]; if (id === 'orchestrale') pitch = [0, 7][Math.floor(R() * 2)]; }
        bass.notes.push({ t: b2 * E.BAR + s3 * 24, d: len * 24 - 6, n: rt + pitch, v: 90 + Math.floor(R() * 30), s: slide && idx > 0 && R() < 0.5 ? 1 : 0 });
      });
    }
    fixBassRange(bass);
    return p;
  }
  function clampN(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /* ---------- frasi di esempio per gli strumenti (Tappa 2) ---------- */
  var HELD = { pad: 1, organo: 1, archi: 1, celli: 1, strings: 1, corno: 1, tromba: 1, trombone: 1, brass: 1, choir: 1, flauto: 1, clarinetto: 1 };
  var BASSY = { sub808: 1, sub808s: 1, sub: 1, basso: 1 };
  // nota della scala: grado (0=tonica, anche negativo o oltre l'ottava) a partire da una nota MIDI di centro
  function scaleNote(key, degree, center) {
    var sc = SCALES[key.scale] || SCALES.minor, n = sc.length, oct = Math.floor(degree / n), d = ((degree % n) + n) % n;
    var base = center - ((center - key.root) % 12 + 12) % 12;       // tonica sotto o uguale al centro
    return base + sc[d] + 12 * oct;
  }
  function rangeCenter(inst) { var I = E.Voices.INSTRUMENTS[inst]; var r = I && I.range ? I.range : [48, 84]; return Math.round((r[0] + r[1]) / 2); }
  // 2 battute di esempio nella tonalita' del progetto. Ritorna note [{t,d,n,v,s}] in tick (si ripete se il loop e' piu' lungo).
  function demoNotes(inst, key, bars) {
    bars = bars || 2; var out = [], B = E.BAR, S16 = 24;
    var center = rangeCenter(inst), I = E.Voices.INSTRUMENTS[inst] || {}, r = I.range || [36, 96];
    function put(t, d, deg, v, c) { var n = scaleNote(key, deg, c == null ? center : c); while (n < r[0]) n += 12; while (n > r[1]) n -= 12; out.push({ t: t, d: d, n: n, v: v || 96, s: 0 }); }
    if (BASSY[inst]) { var lo = inst === 'sub808' || inst === 'sub808s' ? 36 : 40; [0, 3, 6, 10].forEach(function (st, i) { put(st * S16, 5 * S16 - 6, i === 3 ? 4 : 0, 100, lo); });
      put(B + 0, 6 * S16, 0, 100, lo); put(B + 8 * S16, 4 * S16, 2, 92, lo); put(B + 12 * S16, 3 * S16, 4, 96, lo); }
    else if (HELD[inst]) { // accordi lunghi: i - VI (o I - V se maggiore)
      var prog = key.scale === 'major' ? [[0, 2, 4], [4, 6, 8]] : [[0, 2, 4], [5, 7, 9]];
      [0, 1].forEach(function (b) { prog[b].forEach(function (deg, k) { put(b * B, B - 12, deg, 80 + k * 4, center - 6); }); });
    } else { // motivo di 8 note + risposta
      var deg = [0, 2, 4, 2, 5, 4, 2, 1], pos = [0, 3, 6, 8, 10, 12, 14, 15];
      deg.forEach(function (d, i) { put(pos[i] * S16, 2 * S16, d, 92 + (i % 2) * 8); });
      [4, 2, 0, 2].forEach(function (d, i) { put(B + i * 4 * S16, 3 * S16, d, 96); });
    }
    var full = []; for (var b = 0; b < bars; b += 2) out.forEach(function (n) { var t = n.t + b * B; if (t < bars * B) full.push({ t: t, d: n.d, n: n.n, v: n.v, s: n.s }); });
    return full;
  }

  return { scaleNote: scaleNote, demoNotes: demoNotes, HELD: HELD, BASSY: BASSY, STYLES: STYLES, STYLE_IDS: STYLE_IDS, SCALES: SCALES, applyStyle: applyStyle, randomize: randomize, mulberry: mulberry, velOf: velOf };
});
