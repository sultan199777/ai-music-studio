const test = require('node:test'), assert = require('node:assert');
const A = require('../src/arranger.js'), Q = require('../src/quality-check.js');
const gen = o => A.generate(Object.assign({ sampleRate: 8000, bars: 20, sounds: 'sint', plan: [['intro', 2], ['strofa', 8], ['ritornello', 8], ['outro', 2]] }, o));
test('impronta: la stessa base è identica a sé stessa, generi diversi si somigliano poco', () => {
  const a = gen({ bpm: 140, tonic: 9, mode: 'minore', genre: 'trap', seed: 1 }), b = gen({ bpm: 76, tonic: 2, mode: 'maggiore', genre: 'melodico', seed: 9 });
  assert.strictEqual(Q.similarity(Q.fingerprint(a), Q.fingerprint(a)), 1);
  assert.ok(Q.similarity(Q.fingerprint(a), Q.fingerprint(b)) < 0.4);
});
test('controllo: una copia delle precedenti viene segnalata; controlli misurati e da ascoltare separati', () => {
  const a = gen({ bpm: 140, tonic: 9, mode: 'minore', genre: 'trap', seed: 1 }), r = Q.check(a, { recent: [Q.fingerprint(a)] });
  assert.ok(r.weak.some(c => c.id === 'diversa' && c.fix === 'nuova'));
  assert.ok(r.checks.some(c => c.tipo === 'ascolto')); assert.ok(r.score >= 0 && r.score <= 100);
  const ok = Q.check(a, { recent: [] }); assert.ok(!ok.weak.some(c => c.id === 'diversa'));
});
test('controllo audio: distorsione e silenzio vengono visti', () => {
  const a = gen({ bpm: 140, tonic: 9, mode: 'minore', genre: 'trap', seed: 2 });
  assert.ok(Q.check(a, { mix: new Float32Array(8000) }).weak.some(c => c.id === 'audio'));
  const loud = new Float32Array(8000).fill(1); assert.ok(Q.check(a, { mix: loud }).weak.some(c => c.id === 'audio'));
});
