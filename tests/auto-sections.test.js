'use strict';
const test = require('node:test'), assert = require('node:assert');
const A = require('../src/auto-sections.js'), SongMap = require('../src/song-map.js');
const types = r => r.sections.map(s => s.type[0]).join('');

const CHOR = 'Dark nel cuore, la città mi consuma\nSirene nella notte, ma io non mi fermo';
const V1 = 'Notte in strada, sirene che urlano\nMia madre prega, io corro nel buio\nFreddo sul cemento, le mani nelle tasche\nNessuno mi aspetta, nessuno mi chiama';
const V2 = 'Ricordo le scale, il rumore dei passi\nI soldi non bastano, i sogni nemmeno\nGuardo le luci, la città che dorme\nUn giorno ce la faccio, lo giuro a me stesso';

test('titolo in cima, ritornello scritto prima e poi ripetuto, strofe nel mezzo', () => {
  const r = A.label('25 maggio\n\n' + CHOR + '\n\n' + V1 + '\n\n' + CHOR + '\n\n' + V2 + '\n\n' + CHOR);
  assert.strictEqual(r.title, '25 maggio');
  assert.strictEqual(types(r), 'rsrsr');
  assert.strictEqual(r.confidence, 'alta');
  assert.ok(!r.text.includes('25 maggio'));
});
test('ritornello scritto una volta sola in cima (più corto delle strofe): lo riconosce', () => {
  const r = A.label('Dark\n\n' + CHOR + '\n\n' + V1 + '\n\n' + V2);
  assert.strictEqual(r.title, 'Dark'); assert.strictEqual(types(r), 'rss'); assert.strictEqual(r.confidence, 'media');
});
test('un solo blocco senza righe vuote: separa la sequenza che ritorna', () => {
  const r = A.label([V1, CHOR, V2, CHOR].join('\n'));
  assert.strictEqual(types(r), 'srsr');
});
test('se ci sono già i titoli tra parentesi non tocca niente', () => {
  const t = '[Strofa]\n' + V1 + '\n\n[Ritornello]\n' + CHOR;
  const r = A.label(t); assert.strictEqual(r.changed, false); assert.strictEqual(r.text, t);
});
test('senza ripetizioni e senza blocchi corti: tutto strofa, dice che non lo sa', () => {
  const r = A.label(V1 + '\n\n' + V2);
  assert.strictEqual(types(r), 'ss'); assert.strictEqual(r.confidence, 'bassa'); assert.match(r.notes.join(' '), /non so dove sia il ritornello/);
});
test('"Titolo: ..." viene tolto; un verso lungo in cima non è un titolo', () => {
  assert.strictEqual(A.label('Titolo: Notte\n\n' + V1 + '\n\n' + CHOR).title, 'Notte');
  const r = A.label(V1 + '\n\n' + CHOR); assert.strictEqual(r.title, '');
});
test('una riga corta che ritorna nel testo è un verso, non il titolo', () => {
  const r = A.label('Dark\n\n' + V1 + '\n\nDark\nnel cuore');
  assert.strictEqual(r.title, '');
});
test('la mappa della canzone riceve ritornello e strofe dal testo con i titoli aggiunti', () => {
  const r = A.label('25 maggio\n\n' + CHOR + '\n\n' + V1 + '\n\n' + CHOR);
  const m = SongMap.build(r.text, { bpm: 140, syll: l => l.split(/\s+/).length * 2, modes: {} });
  const secs = new Set(m.lines.map(l => l.section)); assert.ok(secs.has('ritornello') && secs.has('strofa'));
});
test('testo vuoto: niente da fare', () => { assert.strictEqual(A.label('').changed, false); assert.strictEqual(A.label('   \n ').changed, false); });
