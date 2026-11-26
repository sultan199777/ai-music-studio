const test = require('node:test'), assert = require('node:assert'), Ag = require('../src/agents.js'), Ear = require('../src/ear.js');
const sr = 22050; const x = new Float32Array(sr * 4); for (let i = 0; i < x.length; i++) { const t = i / sr; x[i] = Math.max(-1, Math.min(1, 6 * Math.sin(2 * Math.PI * 55 * t) * Math.exp(-((t * 2) % 1) * 6))); }
const ear = Ear.listen(x, sr, { genre: 'trap', bpm: 120 });
const ctx = { prod: { genre: 'trap', bpm: 140, tonic: 9, mode: 'minor', prog: [0, 5, 3, 4], groove: { kickPats: [[[0, 3, 8], 1]], snare: [4, 12], rolls: 0.3 } }, ear, em: { found: 5, words: 40, top: ['malinconia', 'solitudine'], share: { malinconia: 0.6, solitudine: 0.4 } }, voice: { f0: 130, lo: 90, hi: 200, tune: 18 }, learnedN: 3, tasteText: 'Gusti: scuro.', decisions: [{ id: '1', kind: 'annullato', key: 'basso-', label: 'basso -15%', genre: 'trap', at: 1 }], mood: 'malinconico', sections: [{ name: 'Strofa' }, { name: 'Ritornello' }] };
test('12 ruoli, tutti con testo e etichetta', () => {
  const r = Ag.run(ctx); assert.equal(r.length, 12); assert.equal(Ag.ROLES, 12); r.forEach(a => { assert.ok(a.role && a.says.length > 10, a.role); assert.ok(['Misurato', 'Ipotesi'].includes(a.tag)); });
  assert.equal(new Set(r.map(a => a.role)).size, 12);
});
test('i ruoli leggono le misure vere: clipping rilevato da Mastering e riportato dal coordinatore', () => {
  const r = Ag.run(ctx), m = r.find(a => a.role === 'Mastering Engineer'); assert.equal(m.level, 'errore', m.says); const c = Ag.coordinate(r); assert.equal(c.first.role, 'Mastering Engineer'); assert.ok(/Da fare per primo/.test(c.text));
});
test('senza misure o dati non inventano', () => {
  const r = Ag.run({}); assert.equal(r.length, 12); assert.ok(r.find(a => a.role === 'Mixing Engineer').says.includes('Ascolta')); assert.ok(r.find(a => a.role === 'Vocal Producer').tag === 'Ipotesi');
  assert.ok(/Nessun problema/.test(Ag.coordinate(r).text));
});
test('Memory Manager richiama le decisioni del contesto', () => { assert.ok(Ag.run(ctx).find(a => a.role === 'Memory Manager').says.includes('basso -15%')); });
