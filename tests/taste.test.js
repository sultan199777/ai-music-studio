'use strict';
const test = require('node:test'), assert = require('node:assert');
const Taste = require('../src/taste.js');
const P = (genre, extra) => Object.assign({ genre, mode: 'minore', heavy: true, bpm: 140 }, extra || {});

test('memoria vuota: nessun profilo e frase di invito', () => {
  const m = Taste.newMem();
  assert.strictEqual(Taste.profile(m), null);
  assert.match(Taste.summary(m), /♥/);
});
test('pochi voti: ancora nessun profilo', () => {
  let m = Taste.newMem(); m = Taste.vote(m, P('trap'), 1); m = Taste.vote(m, P('drill'), -1);
  assert.strictEqual(Taste.profile(m), null);
  assert.match(Taste.summary(m), /pochi/);
});
test('♥ ripetuti su drill e ✕ su club: profilo positivo/negativo e lista da evitare', () => {
  let m = Taste.newMem();
  for (let i = 0; i < 4; i++) m = Taste.vote(m, P('drill', { bpm: 140 + i }), 1);
  for (let i = 0; i < 3; i++) m = Taste.vote(m, P('clubdembow', { heavy: false, mode: 'maggiore' }), -1);
  const pr = Taste.profile(m);
  assert.ok(pr.styleScore.drill > 0.5);
  assert.ok(pr.styleScore.clubdembow < -0.5);
  assert.deepStrictEqual(Taste.avoidList(m), ['clubdembow']);
  const r = Taste.bpmRange(m); assert.ok(r[0] >= 140 && r[1] <= 143);
  assert.match(Taste.summary(m), /ti piacciono drill/);
  assert.match(Taste.summary(m), /scarti spesso clubdembow/);
});
test('vote non modifica la memoria di partenza e ignora piani senza stile', () => {
  const m0 = Taste.newMem(), m1 = Taste.vote(m0, P('trap'), 1);
  assert.strictEqual(m0.n, 0); assert.strictEqual(m1.n, 1);
  assert.strictEqual(Taste.vote(m1, {}, 1).n, 1);
});
test('il registro non cresce senza fine', () => {
  let m = Taste.newMem(); for (let i = 0; i < 300; i++) m = Taste.vote(m, P('trap'), 1);
  assert.ok(m.log.length <= 200); assert.ok(m.bpm.length <= 40);
});
test('il Cervello cambia stile quando il gusto dice no (con SultanBrain)', () => {
  const Brain = require('../src/sultan-brain.js');
  const txt = '[Strofa]\nNotte in strada, sirene che urlano\nMia madre prega, io corro nel buio\n[Ritornello]\nDark nel cuore, la città mi consuma';
  const base = Brain.plan(txt, null, { variant: 0 });
  let m = Taste.newMem(); for (let i = 0; i < 5; i++) m = Taste.vote(m, P(base.genre), -1);
  const after = Brain.plan(txt, null, { variant: 0, profile: Taste.profile(m), avoid: Taste.avoidList(m) });
  assert.notStrictEqual(after.genre, base.genre);
});
