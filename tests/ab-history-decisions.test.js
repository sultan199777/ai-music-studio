const test = require('node:test'), assert = require('node:assert');
const Ab = require('../src/ab-check.js'), H = require('../src/undo-stack.js'), D = require('../src/decisions.js');
const sr = 22050;
function beat(gain, clip) { const x = new Float32Array(sr * 4); for (let i = 0; i < x.length; i++) { const t = i / sr, env = Math.exp(-((t * 2) % 1) * 6); let v = gain * (Math.sin(2 * Math.PI * 55 * t) * env + 0.3 * Math.sin(2 * Math.PI * 440 * t) * 0.3); if (clip) v = Math.max(-1, Math.min(1, v * 8)); x[i] = v; } return x; }
test('AB: una base distorta e poi corretta risulta migliorata', () => {
  const r = Ab.fromAudio(beat(0.9, true), beat(0.5, false), sr, { genre: 'trap', bpm: 120 });
  assert.equal(r.verdict, 'migliorato', JSON.stringify(r)); assert.ok(r.after > r.before); assert.ok(r.lines.length > 0);
});
test('AB: il contrario risulta peggiorato; identica = uguale', () => {
  assert.equal(Ab.fromAudio(beat(0.5, false), beat(0.9, true), sr, { genre: 'trap', bpm: 120 }).verdict, 'peggiorato');
  assert.equal(Ab.fromAudio(beat(0.5, false), beat(0.5, false), sr, { genre: 'trap', bpm: 120 }).verdict, 'uguale');
});
test('Storico: undo rimette lo stato e non condivide riferimenti', () => {
  let s = { levels: { basso: 1 }, bpm: 140 }; const h = H.create(() => s, v => { s = v; });
  h.push('Orecchio', 'basso -15%'); s.levels.basso = 0.85; s.bpm = 150; h.push('Studio', 'bpm'); s.bpm = 90;
  assert.equal(h.size(), 2); assert.equal(h.undo().who, 'Studio'); assert.equal(s.bpm, 150); assert.equal(h.undo().who, 'Orecchio'); assert.deepEqual(s, { levels: { basso: 1 }, bpm: 140 }); assert.equal(h.undo(), null);
});
test('Decisioni: ricorda per contesto e evita ciò che è stato annullato 2 volte', () => {
  const L = []; D.add(L, { kind: 'annullato', key: 'basso-', genre: 'trap' }); assert.equal(D.avoid(L, 'basso-', 'trap'), false);
  D.add(L, { kind: 'annullato', key: 'basso-', genre: 'trap' }); assert.equal(D.avoid(L, 'basso-', 'trap'), true); assert.equal(D.avoid(L, 'basso-', 'drill'), false);
  D.add(L, { kind: 'approvato', key: 'basso-', genre: 'trap' }); D.add(L, { kind: 'approvato', key: 'basso-', genre: 'trap' }); assert.equal(D.avoid(L, 'basso-', 'trap'), false);
  assert.equal(D.recall(L, { genre: 'trap' }, 2).length, 2); assert.equal(D.add(L, { kind: 'boh', key: 'x' }), null);
  for (let i = 0; i < 300; i++) D.add(L, { kind: 'applicato', key: 'k' + i }); assert.equal(L.length, D.MAX);
  assert.ok(D.summary(L).length > 5);
});
