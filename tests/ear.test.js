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

test('LUFS: sinusoide a 1 kHz con picco 0,1 = circa -23 LUFS; più forte = più LUFS', () => {
  const a = Ear.lufs(sine(1000, 4, 0.1), SR), b = Ear.lufs(sine(1000, 4, 0.2), SR);
  assert.ok(Math.abs(a - (-23)) < 0.6, 'lufs ' + a); // picco 0,1 = rms -23 dB, filtro K ~ +0,7 dB, offset -0,691
  assert.ok(Math.abs((b - a) - 6.02) < 0.3, 'passo ' + (b - a));
});
test('voce: rumore, rimbombo, sibilanti e distorsione vengono riconosciuti', () => {
  let s = 12345; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 - 0.5; };
  const voce = (amp) => { const x = new Float32Array(SR * 3); for (let i = 0; i < x.length; i++) { const env = (Math.floor(i / (SR * 0.5)) % 2 === 0) ? 1 : 0; x[i] = env * amp * (Math.sin(2 * Math.PI * 220 * i / SR) + 0.5 * Math.sin(2 * Math.PI * 440 * i / SR)); } return x; };
  const pulita = voce(0.3), ok = Ear.listenVoice(pulita, SR);
  assert.ok(ok.metrics.snrDb > 40, 'snr ' + ok.metrics.snrDb);
  const rum = voce(0.3); for (let i = 0; i < rum.length; i++) rum[i] += 0.1 * rnd();
  assert.ok(Ear.listenVoice(rum, SR).findings.some(f => f.id === 'rumore'));
  const rb = voce(0.2); for (let i = 0; i < rb.length; i++) rb[i] += 0.5 * Math.sin(2 * Math.PI * 40 * i / SR);
  assert.ok(Ear.listenVoice(rb, SR).findings.some(f => f.id === 'rimbombo'));
  const sib = voce(0.1); for (let i = 0; i < sib.length; i++) sib[i] += 0.25 * Math.sin(2 * Math.PI * 7500 * i / SR);
  assert.ok(Ear.listenVoice(sib, SR).findings.some(f => f.id === 'sibilanti'));
  const cl = voce(2); for (let i = 0; i < cl.length; i++) cl[i] = Math.max(-1, Math.min(1, cl[i]));
  assert.ok(Ear.listenVoice(cl, SR).findings.some(f => f.id === 'clip'));
});
test('umore: minore lento e scuro = malinconico/dark; maggiore luminoso = euforico', () => {
  const a = Ear.moodOf({ mode: 'minore', bpm: 140, centroidHz: 500, lowShare: 0.8 }), b = Ear.moodOf({ mode: 'maggiore', bpm: 110, centroidHz: 1200, lowShare: 0.5 }), c = Ear.moodOf({ mode: 'minore', bpm: 85, centroidHz: 900, lowShare: 0.55 });
  assert.ok(['dark', 'aggressivo'].includes(a.top), a.top); assert.equal(b.top, 'euforico'); assert.ok(['malinconico', 'nostalgico'].includes(c.top), c.top);
});
