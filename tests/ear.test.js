const test = require('node:test');
const assert = require('node:assert/strict');
const Ear = require('../src/ear.js');
const SR = 22050;
const sine = (f, sec, a) => { const x = new Float32Array(Math.round(SR * sec)); for (let i = 0; i < x.length; i++) x[i] = (a || 0.5) * Math.sin(2 * Math.PI * f * i / SR); return x; };

test('misura la banda giusta: un 60 Hz è grave, un 3 kHz è presenza', () => {
  const g = Ear.listen(sine(60, 2), SR), p = Ear.listen(sine(3000, 2), SR);
  assert.ok(g.metrics.lowShare > 0.9, 'grave ' + g.metrics.lowShare);
  assert.ok(p.metrics.shares.presenza > 0.9, 'presenza ' + p.metrics.shares.presenza);
  assert.ok(Math.abs(p.metrics.centroidHz - 3000) < 120, 'centro ' + p.metrics.centroidHz);
});
test('livello: sinusoide 0,5 = picco -6 dB, rms -9 dB, crest 3 dB', () => {
  const r = Ear.listen(sine(440, 2, 0.5), SR);
  assert.ok(Math.abs(r.metrics.peakDb + 6) < 0.2); assert.ok(Math.abs(r.metrics.rmsDb + 9) < 0.2); assert.ok(Math.abs(r.metrics.crestDb - 3) < 0.3);
});
test('clipping e silenzio vengono segnalati', () => {
  const c = sine(200, 2, 3); for (let i = 0; i < c.length; i++) c[i] = Math.max(-1, Math.min(1, c[i]));
  assert.ok(Ear.listen(c, SR).findings.some(f => f.id === 'clip'));
  const s = Ear.listen(new Float32Array(SR), SR); assert.equal(s.verdict, 'vuoto');
});
test('suono sottile e acuto = "flautino"; con un grave aggiunto sparisce', () => {
  const hi = sine(2400, 3, 0.4), r = Ear.listen(hi, SR, { genre: 'trapdark' });
  assert.ok(r.findings.some(f => f.id === 'sottile'), r.findings.map(f => f.id).join());
  const mix = sine(2400, 3, 0.2); const lo = sine(55, 3, 0.6); for (let i = 0; i < mix.length; i++) mix[i] += lo[i];
  assert.ok(!Ear.listen(mix, SR).findings.some(f => f.id === 'sottile'));
});
test('colpi nel grave: 4 colpi di cassa in 2 s a 120 BPM = circa 2 a battuta', () => {
  const x = new Float32Array(SR * 4); for (let k = 0; k < 8; k++) { const st = Math.round(k * 0.5 * SR); for (let i = 0; i < SR * 0.25; i++) x[st + i] += Math.sin(2 * Math.PI * 55 * i / SR) * Math.exp(-i / (SR * 0.06)) * 0.8; }
  const r = Ear.listen(x, SR, { bpm: 120 });
  assert.equal(r.metrics.lowHits, 8); assert.ok(Math.abs(r.metrics.lowHitsPerBar - 4) < 0.6, 'a battuta ' + r.metrics.lowHitsPerBar);
});
test('basi del Cervello: nessun errore e nessun clipping per tutti gli stili', () => {
  const Arr = require('../src/arranger.js'), Back = require('../src/backing.js'), Master = require('../src/master.js');
  ['trap', 'trapdark', 'boombap', 'street', 'clubtrap', 'drill', 'melodico'].forEach((g) => {
    const b = Arr.generate({ sampleRate: 22050, bpm: Arr.STYLES[g].bpm, tonic: 9, mode: 'minore', bars: 4, genre: g, seed: 9 });
    const r = Ear.listen(Master.process(Back.mix(b, { batteria: 1, basso: 1, accordi: 1, arpeggio: 1, pad: 1, melodia: 1 }), b.sampleRate, 'standard').samples, b.sampleRate, { genre: g, bpm: Arr.STYLES[g].bpm });
    assert.ok(!r.findings.some(f => f.level === 'errore'), g + ': ' + r.findings.map(f => f.id).join());
    assert.ok(r.metrics.lowShare > 0.4, g + ' grave ' + r.metrics.lowShare);
  });
});
