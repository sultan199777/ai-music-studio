const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../src/beatlab-engine.js');
const SM = require('../src/beatlab-sampler.js');
const P = require('../src/beatlab-patterns.js');

const SAMPLES = path.join(__dirname, '..', 'docs', 'samples');
const hasFiles = fs.existsSync(path.join(SAMPLES, 'manifest.json'));

test('sampler: sceglie il campione piu\' vicino e accorda con la velocita\' di lettura', () => {
  const s = [{ m: 48, c: 0 }, { m: 52, c: 10 }, { m: 60, c: 0 }];
  assert.equal(SM.pickSample(s, 50).m, 48); assert.equal(SM.pickSample(s, 51).m, 52); assert.equal(SM.pickSample(s, 61).m, 60); assert.equal(SM.pickSample(s, 54).m, 52);
  assert.equal(SM.pickSample(s, 56).m, 52); // a meta' strada: prende quello sotto (si alza di meno di quanto si abbasserebbe)
  assert.ok(Math.abs(SM.rateFor({ m: 60, c: 0 }, 72) - 2) < 1e-12); assert.ok(Math.abs(SM.rateFor({ m: 60, c: 0 }, 48) - 0.5) < 1e-12);
  assert.ok(Math.abs(SM.rateFor({ m: 60, c: 100 }, 60) - Math.pow(2, -1 / 12)) < 1e-9, 'campione 100 cent sopra la nota: va riabbassato');
});

test('catalogo: ogni strumento ha il ripiego sintetico, nome, descrizione ed estensione sensata', () => {
  const V = E.Voices;
  for (const id of Object.keys(SM.CATALOG)) {
    const c = SM.CATALOG[id], I = V.INSTRUMENTS[id];
    assert.ok(I, id + ' non registrato'); assert.ok(V.INSTRUMENTS[c.fb] && typeof V.INSTRUMENTS[c.fb].fn === 'function', id + ' ripiego mancante ' + c.fb);
    assert.ok(c.name && c.desc.length > 20 && c.desc.length < 200, id + ' descrizione'); assert.ok(c.range[0] < c.range[1] && c.range[0] >= 20 && c.range[1] <= 120);
  }
  const list = SM.instrumentList(); assert.ok(list.length >= 28);
  for (const x of list) { assert.ok(x.name && x.group, x.id); assert.equal(typeof V.INSTRUMENTS[x.id].fn, 'function'); }
  const groups = new Set(list.map((x) => x.group)); for (const g of ['Bassi', 'Tastiere', 'Corde', 'Archi', 'Ottoni', 'Fiati', 'Mallet', 'Sintetizzatori']) assert.ok(groups.has(g), 'gruppo ' + g);
});

test('frasi di esempio: note nella scala della tonalita\' e dentro l\'estensione dello strumento, per ogni strumento e scala', () => {
  for (const sc of ['minor', 'major', 'phrygian']) for (const root of [0, 3, 7, 11]) {
    const key = { root, scale: sc }, degs = new Set(P.SCALES[sc]);
    for (const x of SM.instrumentList()) {
      const I = E.Voices.INSTRUMENTS[x.id], notes = P.demoNotes(x.id, key, 4);
      assert.ok(notes.length >= 3, x.id);
      for (const n of notes) { assert.ok(n.n >= I.range[0] && n.n <= I.range[1], `${x.id} ${n.n} fuori ${I.range}`); assert.ok(degs.has(((n.n - root) % 12 + 12) % 12), `${x.id} nota ${n.n} fuori scala ${sc} ${root}`); assert.ok(n.t >= 0 && n.t < 4 * E.BAR && n.d > 0 && n.v >= 1 && n.v <= 127); }
    }
  }
});

test('sampler con rete finta: caricamento a richiesta, stati, errore e ripiego', async () => {
  const calls = [];
  const man = { v: 1, sr: 32000, total_bytes: 1000, instruments: { piano: { samples: [{ m: 48, f: 'piano/48.mp3' }, { m: 60, f: 'piano/60.mp3' }], rel: 0.3, gain: 1 }, archi: { sustain: true, samples: [{ m: 60, f: 'archi/60.mp3', ls: 1, le: 2 }] } }, kits: { k1: { name: 'Kit 1', files: { kick: 'drums/k1-kick.mp3' } } } };
  const buf = (n) => ({ sampleRate: 32000, getChannelData: () => { const a = new Float32Array(n); a[100] = 0.5; return a; } });
  const fetch = async (url) => { calls.push(url); if (url.endsWith('manifest.json')) return { ok: true, json: async () => man }; if (url.includes('bad')) return { ok: false, status: 404 }; return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; };
  const sp = new SM.Sampler({ base: 'samples/', fetch, decoder: { decodeAudioData: (ab, ok) => { const b = buf(4000); if (ok) ok(b); return Promise.resolve(b); } } });
  assert.equal(sp.state('piano'), 'solo sintetizzatore');
  assert.equal(await sp.init(), true); assert.equal(calls.length, 1, 'solo il manifest finche\' non serve nulla'); assert.equal(sp.state('piano'), 'da caricare');
  const prog = []; assert.equal(await sp.load('piano', (f) => prog.push(f)), true);
  assert.equal(sp.has('piano'), true); assert.equal(sp.state('piano'), 'pronto'); assert.ok(prog[prog.length - 1] === 1);
  assert.equal(calls.filter((u) => u.includes('piano/')).length, 2); assert.equal(calls.filter((u) => u.includes('archi/')).length, 0, 'archi non scaricati');
  assert.ok(sp.inst.piano.samples[0].off >= 0);
  await sp.load('piano'); assert.equal(calls.filter((u) => u.includes('piano/')).length, 2, 'non riscarica');
  assert.equal(await sp.loadKit('k1'), true); assert.ok(sp.kitBuffers('k1').kick); assert.equal(sp.kitBuffers('nonesiste'), null);
  // memoria: oltre il massimo si liberano i meno usati, tranne quelli richiesti
  sp.maxLoaded = 1; await sp.load('archi'); sp.trim(['archi']); assert.equal(sp.has('piano'), false); assert.equal(sp.has('archi'), true);
  // rete assente: tutto cade sul sintetizzatore senza eccezioni
  const sp2 = new SM.Sampler({ base: 'x/', fetch: async () => { throw new Error('offline'); } });
  assert.equal(await sp2.init(), false); assert.equal(sp2.available, false); assert.ok(/non raggiungibili/.test(sp2.error)); assert.equal(await sp2.load('piano'), false); assert.equal(sp2.has('piano'), false);
});

test('motore: senza campioni lo strumento "pianoforte" suona col ripiego (evento valido, nessuna eccezione)', () => {
  const p = E.newProject(); const t = E.newInstTrack('piano', 'Pianoforte'); t.notes = P.demoNotes('piano', p.key, 2); p.tracks.push(t);
  const ev = E.eventsInRange(p, 0, 768).filter((e) => e.type === 'note'); assert.ok(ev.length > 5);
  const bass = E.newInstTrack('basso', 'Basso'); bass.notes = [{ t: 0, d: 50, n: 36, v: 100 }, { t: 96, d: 50, n: 38, v: 100, s: 1 }]; p.tracks.push(bass);
  const evb = E.eventsInRange(p, 0, 384).filter((e) => e.track === bass.id); assert.ok(evb.every((e) => e.mono === true), 'basso monofonico'); assert.equal(evb[1].glideFrom, 36);
});

test('campioni pubblicati (docs/samples): file presenti, MP3 validi, licenza CC0, peso sotto 40 MB, crediti scritti', { skip: !hasFiles && 'campioni non generati' }, () => {
  const m = JSON.parse(fs.readFileSync(path.join(SAMPLES, 'manifest.json'), 'utf8'));
  let total = 0; const credits = fs.readFileSync(path.join(__dirname, '..', 'notes', 'LICENZE-SUONI.md'), 'utf8');
  const chk = (rel) => { const f = path.join(SAMPLES, rel); assert.ok(fs.existsSync(f), 'manca ' + rel); const b = fs.readFileSync(f); assert.ok(b.length > 500, rel + ' troppo piccolo'); total += b.length; const ok = (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) || b.slice(0, 3).toString() === 'ID3'; assert.ok(ok, rel + ' non e\' un MP3'); };
  for (const id of Object.keys(m.instruments)) {
    const I = m.instruments[id]; assert.equal(I.license, 'CC0-1.0', id); assert.ok(m.sources[I.source], id + ' fonte'); assert.ok(credits.includes(I.source), 'crediti: ' + I.source); assert.ok(credits.includes(I.name), 'crediti senza ' + I.name);
    assert.ok(I.samples.length >= 1); const roots = I.samples.map((s) => s.m); assert.deepEqual(roots, roots.slice().sort((a, b) => a - b)); assert.equal(new Set(roots).size, roots.length, id + ' radici doppie');
    for (let i = 1; i < roots.length; i++) assert.ok(roots[i] - roots[i - 1] <= 14, id + ' buco di ' + (roots[i] - roots[i - 1]) + ' semitoni');
    for (const s of I.samples) { chk(s.f); assert.ok(s.m >= 12 && s.m <= 120); assert.ok(Math.abs(s.c) <= 60); if (s.ls != null) { assert.ok(s.le > s.ls + 0.5 && s.ls > 0.2, id + ' loop'); } if (I.sustain) assert.ok(s.ls != null, id + ' sostenuto senza loop'); }
    assert.ok(SM.CATALOG[id], id + ' non e\' nel catalogo'); if (I.samples.length > 1) { const r = SM.CATALOG[id].range; assert.ok(r[0] >= roots[0] - 6 && r[1] <= roots[roots.length - 1] + 6, id + ' estensione del catalogo ' + r + ' fuori dai campioni ' + roots[0] + '-' + roots[roots.length - 1]); } assert.ok(I.samples.length >= 3 || id === 'sub808s' || id === 'campane', id + ' pochi campioni');
  }
  for (const k of Object.keys(m.kits)) for (const l of Object.keys(m.kits[k].files)) chk(m.kits[k].files[l]);
  for (const id of Object.keys(SM.CATALOG)) if (!SM.CATALOG[id].synthOnly) assert.ok(m.instruments[id], 'catalogo senza campioni: ' + id);
  assert.ok(total < 40 * 1024 * 1024, 'peso ' + (total / 1048576).toFixed(1) + ' MB'); assert.ok(Math.abs(total - m.total_bytes) < 4096, 'total_bytes del manifest');
  assert.ok(Object.keys(m.instruments).length >= 18 && Object.keys(m.kits).length >= 5);
});
