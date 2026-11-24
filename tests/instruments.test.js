const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I = require('../src/instruments.js');
const A = require('../src/arranger.js');
const AA = require('../src/audio-analysis.js');

const dir = path.join(__dirname, '..', 'assets', 'inst');
const loadAll = () => { for (const f of fs.readdirSync(dir)) I.register(JSON.parse(fs.readFileSync(path.join(dir, f)))); };
const pitchOf = (x, sr, t = 0.12) => { const p = AA.detectPitch(x, Math.round(t * sr), 2048, sr, 30, 2500); return p.clarity > 0.7 ? AA.freqToMidi(p.f0) : null; };

test('ogni strumento a campioni del catalogo ha il suo file CC0, decodificabile e pulito', () => {
  for (const c of I.CATALOG.filter((c) => c.fonte === 'campione')) {
    const f = path.join(dir, c.id + '.json');
    assert.ok(fs.existsSync(f), 'manca ' + c.id);
    const j = JSON.parse(fs.readFileSync(f));
    assert.equal(j.license, 'CC0 1.0');
    assert.ok(j.notes.length >= 4, c.id + ' note ' + j.notes.length);
    const b = I.register(j);
    b.notes.forEach((n) => { let pk = 0; for (const v of n.x) { assert.ok(Number.isFinite(v)); pk = Math.max(pk, Math.abs(v)); } assert.ok(pk > 0.3 && pk <= 1, c.id + ' picco ' + pk); });
  }
});

test('catalogo: ogni voce spiega come si usa, con cosa combacia (strumenti esistenti) e in che stili', () => {
  const ids = new Set(I.CATALOG.map((c) => c.id));
  for (const c of I.CATALOG) {
    assert.ok(c.come.length > 20 && c.perche.length > 10 && c.ruoli.length && c.stili.length, c.id);
    c.combina.forEach((k) => assert.ok(ids.has(k), c.id + ' combina con ' + k + ' che non esiste'));
    assert.ok(c.range[0] < c.range[1]);
  }
  for (const [g, r] of Object.entries(I.RECIPES)) ['melodia', 'accordi', 'pad'].forEach((ru) => r[ru].forEach((k) => assert.ok(ids.has(k), g + ' ' + ru + ' ' + k)));
});

test('campionatore: la nota suonata è quella chiesta anche tra due campioni (misurato)', () => {
  loadAll();
  const sr = 32000;
  for (const [id, m] of [['piano', 61], ['piano', 49], ['flute', 74], ['sax', 58], ['violins', 70], ['epiano', 57], ['cellos', 50]]) {
    const x = I.render(id, m, 1, sr);
    const got = pitchOf(x, sr, 0.15);
    assert.ok(got != null && Math.abs(got - m) < 0.35, id + ' ' + m + ' -> ' + got);
  }
});

test('chitarre sintetizzate (Karplus-Strong): intonate, finite, si spengono', () => {
  const sr = 32000;
  for (const id of ['guitar', 'nylon', 'eguitar']) {
    for (const m of [45, 52, 64]) {
      const x = I.render(id, m, 0.8, sr);
      assert.ok(x.every(Number.isFinite));
      const got = pitchOf(x, sr, 0.05);
      assert.ok(got != null && Math.abs(got - m) < 0.35, id + ' ' + m + ' -> ' + got);
      assert.ok(Math.abs(x[x.length - 1]) < 1e-3, 'coda chiusa');
    }
  }
});

test('suono tenuto allungato oltre il campione senza buchi (pad lento)', () => {
  loadAll();
  const sr = 32000, x = I.render('violins', 64, 4, sr, { hold: true, attack: 0.2 });
  assert.ok(x.length >= 4 * sr);
  for (let t = 0.5; t < 3.8; t += 0.25) { let e = 0; const a = Math.round(t * sr); for (let i = a; i < a + 1600; i++) e += x[i] * x[i]; assert.ok(e / 1600 > 1e-4, 'buco a ' + t + ' s'); }
});

test('arrangiatore con strumenti veri: stessa melodia, suono diverso, valori finiti', () => {
  loadAll();
  const base = { sampleRate: 16000, genre: 'trap', bars: 16, seed: 3 };
  const a = A.generate(base), b = A.generate(Object.assign({ inst: { melodia: 'piano', accordi: 'harp', pad: 'violins' } }, base));
  assert.deepEqual(b.inst, { melodia: 'piano', accordi: 'harp', pad: 'violins' });
  assert.deepEqual(a.events.lead.map((e) => e.midi), b.events.lead.map((e) => e.midi));
  for (const tr of ['lead', 'chords', 'pad']) {
    let d = 0, e = 0; for (let i = 0; i < b.length; i++) { assert.ok(Number.isFinite(b.tracks[tr][i])); d += Math.abs(a.tracks[tr][i] - b.tracks[tr][i]); e += b.tracks[tr][i] ** 2; }
    assert.ok(d > 1 && e > 0.1, tr);
  }
  const c = A.generate(Object.assign({ inst: { melodia: 'nonesiste' } }, base));
  assert.equal(c.inst.melodia, null);
});
