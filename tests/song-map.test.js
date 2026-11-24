const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/song-map.js');
const A = require('../src/arranger.js');
const L = require('../src/lyrics-engine.js');

const TXT = '[Strofa]\nCorro di notte sotto le luci della città\nNessuno mi ferma\nHo fame di vincere ancora\nE non mi fermo più\n\n[Ritornello]\nVolo alto\nSopra tutto quello che ho perso\n\n[Strofa]\nRiga uno\nRiga due';

test('il testo decide la struttura: intro, sezioni dai titoli, outro, battute pari', () => {
  const m = M.build(TXT, { bpm: 140, syll: L.lineSyllables });
  assert.deepEqual(m.plan.map((x) => x[0]), ['intro', 'strofa', 'ritornello', 'strofa', 'outro']);
  m.plan.forEach((x) => assert.ok(x[1] % 2 === 0 && x[1] >= 2, x.join(':')));
  assert.equal(m.totalBars, m.plan.reduce((a, x) => a + x[1], 0));
  assert.equal(m.lines.length, 8);
  assert.equal(m.lines[0].startBar, 2, 'la prima riga parte DOPO l\'intro');
  assert.ok(m.lines.every((l) => l.bars >= 2), 'cantato: almeno 2 battute per riga');
  const rit = m.lines.find((l) => l.section === 'ritornello');
  assert.equal(rit.startBar, 2 + m.plan[1][1], 'il ritornello del testo cade sul ritornello della base');
});

test('rap ("parla") è più fitto del cantato; senza titoli tutto è strofa', () => {
  const lines = TXT.split('\n').filter((l) => l && !l.startsWith('['));
  const modes = Object.fromEntries(lines.map((l) => [l, 'parla']));
  const a = M.build(TXT, { bpm: 140, syll: L.lineSyllables, modes }), b = M.build(TXT, { bpm: 140, syll: L.lineSyllables });
  assert.ok(a.totalBars < b.totalBars);
  const n = M.build('uno due tre\nquattro cinque', { bpm: 100 });
  assert.deepEqual(n.plan.map((x) => x[0]), ['intro', 'strofa', 'outro']);
});

test('karaoke senza giri: prima dell\'intro conta le battute, poi segue righe e parole, poi finisce', () => {
  const m = M.build(TXT, { bpm: 140, syll: L.lineSyllables });
  const p0 = M.at(m, 0.1); assert.equal(p0.state, 'prima'); assert.equal(p0.bars, 2);
  const p1 = M.at(m, m.lines[1].start + 0.01); assert.equal(p1.index, 1); assert.equal(p1.word, 0);
  assert.equal(M.at(m, m.totalBars * m.barSec + 1).state, 'fine');
});

test('la base segue la mappa: stesse sezioni e stessa durata', () => {
  const m = M.build(TXT, { bpm: 140, syll: L.lineSyllables });
  const b = A.generate({ sampleRate: 8000, genre: 'trap', bpm: 140, seed: 2, plan: m.plan });
  assert.deepEqual(b.sections.map((s) => s.name), m.plan.map((x) => x[0]));
  assert.equal(b.bars, m.totalBars);
  const rit = b.sections.find((s) => s.name === 'ritornello'), line = m.lines.find((l) => l.section === 'ritornello');
  assert.ok(Math.abs(rit.startSec - line.start) < 0.05, 'il ritornello cantato parte quando parte il ritornello della base');
});
