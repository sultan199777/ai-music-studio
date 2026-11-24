/*
 * Beat Lab - teoria musicale semplice (Tappa 3): nomi delle note (Do Re Mi + lettera), note della scala,
 * blocco sulla scala, accordi e progressioni per atmosfera, quantizzazione, aggiunta/spostamento note.
 * Le progressioni sono PUNTI DI PARTENZA scritti qui (gradi della scala), non copiati da brani.
 */
(function (root, factory) {
  var E = (typeof module === 'object' && module.exports) ? require('./beatlab-engine.js') : root.BeatEngine;
  var P = (typeof module === 'object' && module.exports) ? require('./beatlab-patterns.js') : root.BeatPatterns;
  if (typeof module === 'object' && module.exports) module.exports = factory(E, P);
  else root.BeatTheory = factory(E, P);
})(typeof self !== 'undefined' ? self : this, function (E, P) {
  'use strict';
  var IT = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
  var EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function noteName(m) { var p = ((m % 12) + 12) % 12; return IT[p] + ' (' + EN[p] + ')'; }
  function noteShort(m) { var p = ((m % 12) + 12) % 12; return IT[p]; }
  function noteFull(m) { return noteName(m) + (Math.floor(m / 12) - 1); }
  var SCALE_NAMES = { minor: 'Minore', major: 'Maggiore', phrygian: 'Frigio (scuro)', dorian: 'Dorico', harmonicMinor: 'Minore armonica', pentMinor: 'Pentatonica minore', pentMajor: 'Pentatonica maggiore' };
  var SCALE_HELP = { minor: 'La più usata nel rap: suona triste e seria.', major: 'Allegra e luminosa.', phrygian: 'Scura e tesa: tipica del drill e dei film horror.', dorian: 'Minore ma più aperta e "cool": R&B e soul.', harmonicMinor: 'Drammatica, quasi orientale: epica e cinematografica.', pentMinor: 'Solo 5 note, impossibile sbagliare: ottima per melodie.', pentMajor: 'Solo 5 note allegre, semplici e dolci.' };

  function inScale(key, midi) { var sc = P.SCALES[key.scale] || P.SCALES.minor, d = (((midi - key.root) % 12) + 12) % 12; return sc.indexOf(d) >= 0; }
  function scaleDegreeOf(key, midi) { var sc = P.SCALES[key.scale], d = (((midi - key.root) % 12) + 12) % 12; return sc.indexOf(d); }
  // la nota della scala piu' vicina (a parita' va verso l'alto)
  function snapToScale(key, midi) { for (var k = 0; k < 7; k++) { if (inScale(key, midi + k)) return midi + k; if (inScale(key, midi - k)) return midi - k; } return midi; }
  function scaleNotes(key, lo, hi) { var o = []; for (var m = lo; m <= hi; m++) if (inScale(key, m)) o.push(m); return o; }

  // accordo sul grado d (0 = primo) in tre o quattro note, tutte della scala
  function chord(key, degree, center, seventh) {
    var o = [0, 2, 4].concat(seventh ? [6] : []).map(function (k) { return P.scaleNote(key, degree + k, center); });
    var lo = center - 7; o = o.map(function (n) { while (n < lo) n += 12; while (n > lo + 14) n -= 12; return n; }); o.sort(function (a, b) { return a - b; }); return o;
  }
  function chordName(key, degree) {
    var sc = P.SCALES[key.scale], n = sc.length, r = (key.root + sc[((degree % n) + n) % n]) % 12;
    var third = (sc[(degree + 2) % n] - sc[degree % n] + 12) % 12, fifth = (sc[(degree + 4) % n] - sc[degree % n] + 12) % 12;
    return noteShort(r) + (third === 3 ? (fifth === 6 ? ' dim' : ' min') : (fifth === 8 ? ' aug' : ' magg'));
  }
  // atmosfere: gradi (0-based) per ogni accordo, 1 accordo per battuta (4 accordi = 4 battute); scala consigliata
  var MOODS = {
    cupa: { name: 'Cupa', scale: 'minor', desc: 'i - VI - VII - i: buia e pesante, tipica del trap.', prog: [0, 5, 6, 0], bpm: 140 },
    malinconica: { name: 'Malinconica', scale: 'minor', desc: 'i - VI - III - VII: triste ma bella, ottima per il rap melodico.', prog: [0, 5, 2, 6], bpm: 130 },
    luminosa: { name: 'Luminosa', scale: 'major', desc: 'I - V - vi - IV: aperta e positiva, tipica del pop.', prog: [0, 4, 5, 3], bpm: 105 },
    epica: { name: 'Epica', scale: 'minor', desc: 'i - VII - VI - VII: sale come una colonna sonora.', prog: [0, 6, 5, 6], bpm: 100 },
    tesa: { name: 'Tesa (drill)', scale: 'phrygian', desc: 'i - II - i - VII: nervosa, con la seconda nota abbassata.', prog: [0, 1, 0, 6], bpm: 144 }
  };

  /* ---- piano roll: tutte le modifiche passano da qui (testate) ---- */
  function quantTicks(q, res) { return { '1/4': 96, '1/8': 48, '1/16': 24, '1/32': 12, 'tr': 32, 'off': 1 }[q] || 24; }
  function snapTick(t, q) { var g = quantTicks(q); return Math.max(0, Math.round(t / g) * g); }
  function addNote(project, track, tick, midi, o) {
    o = o || {}; var q = o.quant || '1/16', g = quantTicks(q), max = E.loopTicks(project), t = snapTick(tick, q);
    if (t >= max) t = max - g; var d = o.dur || g * 2; if (t + d > max) d = Math.max(g, max - t);
    if (o.lock !== false && project.key) midi = snapToScale(project.key, midi);
    var n = { t: t, d: d, n: clamp(midi, 0, 127), v: o.vel || 100, s: 0 };
    // stessa nota nello stesso istante: sostituisce
    track.notes = track.notes.filter(function (x) { return !(x.t === n.t && x.n === n.n); }); track.notes.push(n); return n;
  }
  function removeNote(track, note) { var i = track.notes.indexOf(note); if (i >= 0) track.notes.splice(i, 1); return i >= 0; }
  function moveNote(project, note, dTick, dMidi, o) {
    o = o || {}; var max = E.loopTicks(project); note.t = clamp(snapTick(note.t + dTick, o.quant || '1/16'), 0, max - 1);
    var m = note.n + dMidi; if (o.lock !== false && project.key) m = snapToScale(project.key, m); note.n = clamp(m, 0, 127); if (note.t + note.d > max) note.d = max - note.t; return note;
  }
  function resizeNote(project, note, newDur, quant) { var g = quantTicks(quant || '1/16'); note.d = clamp(Math.round(newDur / g) * g, g, E.loopTicks(project) - note.t); return note; }
  function setVelocity(note, v) { note.v = clamp(Math.round(v), 1, 127); return note; }
  function quantizeAll(project, track, q) { track.notes.forEach(function (n) { n.t = clamp(snapTick(n.t, q), 0, E.loopTicks(project) - 1); }); return track; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function noteAt(track, tick, midi) { for (var i = 0; i < track.notes.length; i++) { var n = track.notes[i]; if (n.n === midi && tick >= n.t && tick < n.t + n.d) return n; } return null; }

  // Progressione: scrive accordi (1 per battuta) in una traccia strumento. Ritorna le note aggiunte.
  function writeProgression(project, track, moodId, o) {
    o = o || {}; var M = MOODS[moodId], key = project.key, B = E.BAR, center = o.center || 60, seventh = !!o.seventh, out = [];
    track.notes = [];
    for (var b = 0; b < project.bars; b++) {
      var deg = M.prog[b % M.prog.length];
      chord(key, deg, center, seventh).forEach(function (n, i) { var nn = { t: b * B, d: B - 12, n: n, v: 84 + i * 3, s: 0 }; track.notes.push(nn); out.push(nn); });
    }
    return out;
  }
  function chordRow(project, moodId) { var M = MOODS[moodId]; return M.prog.map(function (d) { return { degree: d, name: chordName(project.key, d) }; }); }

  /* ---- livello Impara: spiegazioni di 1-2 righe per ogni controllo ---- */
  var LEARN = {
    bpm: { t: 'BPM (battiti al minuto)', d: 'La velocità del brano. Più alto = più veloce. Trap 130-160, drill 138-150, boom bap 82-98, pop 95-120.', ex: 'bpm' },
    swing: { t: 'Swing', d: 'Ritarda un po\' i colpi "in levare" per dare un ritmo dondolato. 50% è dritto, 66% è la classica terzina del boom bap.', ex: 'swing' },
    style: { t: 'Stile', d: 'Ogni stile ha il suo modo di mettere cassa e rullante. Nel trap e nel drill il rullante cade a metà battuta ("half-time"): per questo sembrano lenti anche se gli hi-hat sono veloci.', ex: 'style' },
    kick: { t: 'Cassa', d: 'Il colpo grave che dà il peso. Mettila sul primo tempo e poi su qualche contrattempo; mai attaccata al rullante.', ex: 'kick' },
    snare: { t: 'Rullante e clap', d: 'Il colpo secco che segna il tempo. Nel trap sta sul terzo movimento della battuta; nel boom bap sul secondo e quarto.', ex: 'snare' },
    hat: { t: 'Hi-hat e rullate', d: 'I piattini che muovono il ritmo. Una "rullata" (x2, x3, x4) ripete il colpo velocissimo dentro un passo: mettila a fine battuta per creare tensione.', ex: 'hat' },
    velocity: { t: 'Forza (velocity)', d: 'Quanto forte è ogni colpo o nota. Colpi tutti uguali suonano da macchina: alterna forti e deboli per dare groove.', ex: 'velocity' },
    '808': { t: '808', d: 'Il basso lungo e profondo della trap, accordato su una nota. Suona la tonica (la nota "casa") e fai scivolare (glide) verso altre note per il drill.', ex: '808' },
    scale: { t: 'Tonalità e scala', d: 'La scala è l\'insieme di note che stanno bene insieme. Con il blocco sulla scala suoni solo note giuste: impossibile stonare.', ex: 'scale' },
    chords: { t: 'Accordi e atmosfera', d: 'Un accordo sono 3 note insieme. Una progressione è una sequenza di accordi: sceglie l\'atmosfera (cupa, malinconica, luminosa, epica).', ex: 'chords' },
    pianoroll: { t: 'Piano roll', d: 'La griglia dove disegni le note: in alto le note acute, in basso le gravi; la lunghezza è la durata. Tocca per aggiungere, trascina per spostare, tocca una nota per cancellarla.', ex: 'pianoroll' },
    quant: { t: 'Quantizzazione', d: 'Fa "scattare" le note sulla griglia (1/4, 1/8, 1/16...). Senza, le note possono cadere fuori tempo.', ex: 'quant' },
    mixer: { t: 'Mixer', d: 'Volume = quanto forte, Pan = sinistra o destra, M = muto, S = solo (senti solo quel suono). Parti da cassa e 808 e costruisci il resto attorno.', ex: 'mixer' },
    inst: { t: 'Strumenti', d: 'Ogni strumento ha un suono e una zona di note: bassi in basso, melodie in alto. Premi "Ascolta" per sentirlo nella tonalità del tuo beat.', ex: 'inst' }
  };
  return { IT: IT, EN: EN, noteName: noteName, noteShort: noteShort, noteFull: noteFull, SCALE_NAMES: SCALE_NAMES, SCALE_HELP: SCALE_HELP, inScale: inScale, scaleDegreeOf: scaleDegreeOf, snapToScale: snapToScale, scaleNotes: scaleNotes,
    chord: chord, chordName: chordName, MOODS: MOODS, quantTicks: quantTicks, snapTick: snapTick, addNote: addNote, removeNote: removeNote, moveNote: moveNote, resizeNote: resizeNote, setVelocity: setVelocity,
    quantizeAll: quantizeAll, noteAt: noteAt, writeProgression: writeProgression, chordRow: chordRow, LEARN: LEARN };
});
