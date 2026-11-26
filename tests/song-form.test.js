const test = require('node:test'), assert = require('node:assert');
global.self = global; const SM = require('../src/song-map.js'), LE = require('../src/lyrics-engine.js'), F = require('../src/song-form.js');
const map = SM.build('[Strofa]\nCammino da solo nella notte scura\nla città mi guarda e non ho paura\n[Ritornello]\nAmo tanto gli altri\nma nessuno ama me', { bpm: 137, syll: LE.lineSyllables, modes: {} });
test('duplica il ritornello: più battute e le righe del ritornello ripetute a tempo', () => {
  const op = F.parse('duplica il ritornello', map.plan); assert.strictEqual(op.op, 'dup');
  const m = F.apply(map, [op]); assert.strictEqual(m.totalBars, map.totalBars + 4);
  const rit = m.lines.filter(l => l.section === 'ritornello'); assert.strictEqual(rit.length, 4);
  assert.ok(Math.abs(rit[2].start - (rit[0].start + 4 * map.barSec)) < 1e-6);
});
test('togli, sposta, copia, allunga, aggiungi', () => {
  let m = F.apply(map, [F.parse('togli l intro', map.plan)]); assert.strictEqual(m.plan[0][0], 'strofa');
  const mv = F.parse('sposta il ritornello all inizio', map.plan); m = F.apply(map, [mv]); assert.strictEqual(m.plan[0][0], 'ritornello'); assert.strictEqual(m.lines[0].section, 'ritornello');
  m = F.apply(map, [F.parse('copia il ritornello alla fine', map.plan)]); assert.strictEqual(m.plan[m.plan.length - 1][0], 'ritornello');
  m = F.apply(map, [F.parse('allunga la strofa di 2 battute', map.plan)]); assert.strictEqual(m.plan[1][1], 10);
  m = F.apply(map, [F.parse('aggiungi un bridge di 4 battute', map.plan)]); assert.ok(m.plan.some(s => s[0] === 'bridge' && s[1] === 4));
});
test('non confonde i comandi sugli strumenti e non finge', () => {
  assert.strictEqual(F.parse('togli la batteria nell intro', map.plan), null);
  assert.strictEqual(F.parse('cambia la melodia', map.plan), null);
  assert.strictEqual(F.parse('togli il bridge', map.plan).op, 'none');
});
