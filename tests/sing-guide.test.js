const test = require('node:test'), assert = require('node:assert/strict');
const SM = require('../src/song-map.js'), SG = require('../src/sing-guide.js');
const txt = '[Strofa]\nSono nato in strada con la fame addosso\nOgni giorno una guerra per il pane\n[Ritornello]\nVoglio volare via\nLontano da qui';
test('guida: una riga per riga di testo, con entrata, tenuta e respiro', () => {
  const g = SG.build(SM.build(txt, { bpm: 90, modes: { 'Voglio volare via': 'allunga', 'Lontano da qui': 'allunga' } }));
  assert.equal(g.lines.length, 4);
  g.lines.forEach((l) => { assert.ok(l.entrySec >= 0 && l.singSec > 0 && l.entryBar >= 1); });
  assert.ok(g.lines[2].holdSec > 0 && /tieni/.test(g.lines[2].cue), 'tenuta sul ritornello');
  assert.ok(g.lines[3].breath, 'respiro a fine sezione');
});
test('riga troppo veloce segnalata', () => {
  const g = SG.build(SM.build('uno due tre quattro cinque sei sette otto nove dieci undici dodici tredici quattordici quindici sedici', { bpm: 90, barsPerLine: 1, modes: { 'uno due tre quattro cinque sei sette otto nove dieci undici dodici tredici quattordici quindici sedici': 'parla' }, syll: (l) => l.split(/\s+/).length * 2 }));
  assert.ok(g.lines[0].warn);
});
test('check: riga cantata ok, riga vuota rilevata', () => {
  const sr = 8000, map = SM.build('Prima riga di prova qui\nSeconda riga di prova qui', { bpm: 120, intro: 0, outro: 0 }), g = SG.build(map), x = new Float32Array(sr * Math.ceil(map.lines[1].end + 1));
  const a = Math.round(map.lines[0].start * sr), b = Math.round((map.lines[0].start + 1.2) * sr);
  for (let i = a; i < b; i++) x[i] = 0.5 * Math.sin(i * 0.2);
  const c = SG.check(x, sr, g, map);
  assert.equal(c.lines[0].status, 'ok'); assert.equal(c.lines[1].status, 'vuota');
});
