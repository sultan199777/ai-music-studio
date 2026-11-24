const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I = require('../src/instruments.js');
const L = require('../src/sound-lab.js');
const A = require('../src/arranger.js');
const AA = require('../src/audio-analysis.js');

const dir = path.join(__dirname, '..', 'assets', 'inst');
for (const f of fs.readdirSync(dir)) I.register(JSON.parse(fs.readFileSync(path.join(dir, f))));
const SR = 22050;
const centroid = (x, a, n) => { let num = 0, den = 0; for (let k = 1; k < 64; k++) { let re = 0, im = 0; for (let i = 0; i < n; i++) { const w = 2 * Math.PI * k * i / n; re += x[a + i] * Math.cos(w); im -= x[a + i] * Math.sin(w); } const m = Math.hypot(re, im); num += k * m; den += m; } return num / den; };

test('ogni strumento originale: dipendenze esistenti, suona, valori finiti, spiegato', () => {
  const ids = new Set(I.CATALOG.map((c) => c.id).concat(Object.keys(L.SYNTHS)));
  assert.ok(L.ORIGINALS.length >= 10);
  for (const r of L.ORIGINALS) {
    r.strati.forEach((s) => assert.ok(ids.has(s.src), r.id + ' usa ' + s.src));
    assert.ok(r.descr && r.perche && r.uso, r.id);
    assert.ok(I.has(r.id), r.id + ' non pronto');
    const x = I.render(r.id, 60, 1, SR);
    assert.ok(x && x.length > SR * 0.8, r.id);
    let pk = 0; for (const v of x) { assert.ok(Number.isFinite(v)); pk = Math.max(pk, Math.abs(v)); }
    assert.ok(pk > 0.5 && pk <= 0.86, r.id + ' picco ' + pk);
  }
});

test('gli strumenti originali sono diversi dalla loro materia prima (misurato)', () => {
  const diff = (a, b) => { let d = 0, e = 0; const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) { d += (a[i] - b[i]) ** 2; e += b[i] ** 2; } return d / e; };
  for (const [lab, raw] of [['lab:vetro', 'piano'], ['lab:fantasma', 'harp'], ['lab:vhs', 'violins'], ['lab:nebbia', 'guitar']]) {
    const a = I.render(lab, 60, 1, SR), b = I.render(raw, 60, 1, SR, { hold: true });
    assert.ok(diff(a, b) > 0.3, lab + ' troppo simile a ' + raw);
  }
});

test('morph: il piano diventa archi (la nota non si spegne come un piano, misurato)', () => {
  const en = (x, a, b) => { let e = 0; for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) e += x[i] * x[i]; return e; };
  const m = I.render('lab:metamorfosi', 60, 2, SR), p = I.render('piano', 60, 2, SR);
  const rm = en(m, 1.5, 1.9) / en(m, 0.05, 0.45), rp = en(p, 1.5, 1.9) / en(p, 0.05, 0.45);
  assert.ok(rm > rp * 5, 'coda morph ' + rm.toFixed(3) + ' piano ' + rp.toFixed(3));
});

test('l\'intonazione resta giusta negli strumenti con altezza chiara', () => {
  for (const id of ['lab:vetro', 'lab:vhs', 'lab:metamorfosi']) {
    const x = I.render(id, 62, 1.2, SR), p = AA.detectPitch(x, Math.round(0.3 * SR), 2048, SR, 40, 2000);
    const d = AA.freqToMidi(p.f0) - 62, pc = d - 12 * Math.round(d / 12); // gli strati all'ottava sono voluti
    assert.ok(p.clarity > 0.6 && Math.abs(pc) < 0.5, id + ' ' + AA.freqToMidi(p.f0));
  }
});

test('"Sorprendimi": invenzioni ripetibili dal seme, diverse tra loro, suonabili', () => {
  const a = L.invent(5), b = L.invent(5), c = L.invent(6);
  assert.deepEqual(a, b); assert.notEqual(JSON.stringify([a.strati, a.c]), JSON.stringify([c.strati, c.c]));
  for (let s = 1; s <= 40; s++) assert.ok(L.invent(s).strati.every((x) => x.src !== 'flute'), 'niente flauto');
  for (let s = 1; s <= 12; s++) { const r = L.invent(s); L.install(r); const x = I.render(r.id, 60, 0.8, SR); assert.ok(x && x.every(Number.isFinite), 'invenzione ' + s); }
});

test('generi nuovi: usano strumenti esistenti e si suonano con l\'arrangiatore', () => {
  for (const g of L.GENRES) {
    assert.ok(A.STYLES[g.base], g.nome);
    const b = A.generate({ sampleRate: 16000, genre: g.base, bars: 8, seed: 2, inst: g.inst });
    for (const r of Object.keys(g.inst)) assert.equal(b.inst[r], g.inst[r], g.nome);
    for (const tr of ['lead', 'chords', 'pad']) for (let i = 0; i < b.length; i += 97) assert.ok(Number.isFinite(b.tracks[tr][i]));
  }
});
