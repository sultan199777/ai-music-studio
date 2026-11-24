// Ascolto a misura: genera basi da testi diversi con il Cervello e stampa le misure dell'Orecchio.
// Uso: node tools/ascolta.js
const path = require('path'), root = path.join(__dirname, '..');
const Arr = require(path.join(root, 'src/arranger.js')), Back = require(path.join(root, 'src/backing.js')), Ear = require(path.join(root, 'src/ear.js')), Master = require(path.join(root, 'src/master.js')), B = require(path.join(root, 'src/sultan-brain.js')), L = require(path.join(root, 'src/lyrics-engine.js'));
const TEXTS = {
  strada: 'Nel quartiere la strada non perdona\nFra i soldi in tasca e la polizia\nIl blocco mi conosce, la gang è la mia zona\nSangue sull\'asfalto e nemici in fila\nSoldi soldi soldi, strada strada strada',
  amore: 'Ti guardo negli occhi amore mio\nIl tuo bacio sa di estate e di mare\nBalliamo insieme stasera tesoro\nIl cuore mi batte, non voglio smettere',
  dolore: 'Solo nel buio con le lacrime addosso\nIl vuoto che resta, il dolore non passa\nSilenzio di notte, mi manca il tuo nome\nPerso e spento, ombra tra le ombre',
  rabbia: 'Guerra e sangue, odio nei nemici\nFalsi e traditori, brucio tutto il fuoco\nVendetta nel cuore, combatto da solo\nCattivo per scelta, la rabbia mi guida',
  nostalgia: 'Ricordo la casa dei miei nonni da bambino\nGli anni passano e la scuola è lontana\nMia mamma cucinava e il tempo si fermava\nIeri sembra un sogno ormai passato'
};
const rows = [];
Object.keys(TEXTS).forEach((k) => {
  const pl = B.plan(TEXTS[k], L.analyze(TEXTS[k]));
  const b = Arr.generate({ sampleRate: 22050, bpm: pl.bpm, tonic: pl.tonic, mode: pl.mode, bars: 8, genre: pl.genre, seed: pl.seed, bassStyle: pl.bassStyle });
  const lv = { batteria: 1, basso: 1, accordi: 1, arpeggio: 1, pad: 1, melodia: 1 };
  const y = Master.process(Back.mix(b, lv), b.sampleRate, process.argv[2] || 'standard').samples, r = Ear.listen(y, b.sampleRate, { genre: pl.genre, bpm: pl.bpm });
  rows.push({ testo: k, stile: pl.genre, bpm: pl.bpm, picco: r.metrics.peakDb, rms: r.metrics.rmsDb, crest: r.metrics.crestDb, centro: r.metrics.centroidHz, grave: r.metrics.lowShare, colpi_bar: r.metrics.lowHitsPerBar, verdetto: r.verdict, problemi: r.findings.map((f) => f.id).join(',') });
});
console.table(rows);
