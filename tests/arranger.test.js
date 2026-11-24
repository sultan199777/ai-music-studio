const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/arranger.js');
const B = require('../src/backing.js');

const SR = 16000;
const STEPS = { maggiore: [0, 2, 4, 5, 7, 9, 11], minore: [0, 2, 3, 5, 7, 8, 10] };
const inScale = (m, t, mode) => STEPS[mode].includes((((m - t) % 12) + 12) % 12);
const energy = (x, a, b) => { let s = 0; for (let i = a; i < Math.min(b, x.length); i++) s += x[i] * x[i]; return s / Math.max(1, b - a); };
const secOf = (b, name) => b.sections.filter((s) => s.name === name);
const mixE = (b, sec) => { const m = B.mix(b, {}); return energy(m, Math.round(sec.startSec * b.sampleRate), Math.round(sec.endSec * b.sampleRate)); };

test('struttura: la somma delle battute è sempre esatta e ci sono le sezioni vere', () => {
  for (const bars of [1, 2, 4, 5, 8, 12, 16, 20, 27, 28, 32, 34, 48, 64]) {
    const p = A.planStructure(bars);
    assert.equal(p.reduce((a, s) => a + s[1], 0), bars, 'bars ' + bars);
    assert.ok(p.every((s) => s[1] >= 1));
  }
  const names = A.planStructure(32).map((s) => s[0]);
  assert.deepEqual(names, ['intro', 'strofa', 'pre', 'ritornello', 'bridge', 'ritornello', 'outro']);
});

test('ogni stile: valori finiti, durata esatta, tutte le tracce suonano', () => {
  for (const g of Object.keys(A.STYLES)) {
    const b = A.generate({ sampleRate: SR, genre: g, bars: 32, seed: 5 });
    assert.equal(b.genre, g);
    assert.equal(b.length, Math.round(60 / b.bpm / 4 * SR) * 16 * 32);
    for (const [n, t] of Object.entries(b.tracks)) {
      assert.equal(t.length, b.length);
      let e = 0, fin = true; for (const v of t) { if (!Number.isFinite(v)) fin = false; e += v * v; }
      assert.ok(fin, g + ' ' + n + ' non finito');
      assert.ok(e > 0, g + ' ' + n + ' silenzioso');
    }
    assert.equal(b.sections.length, 7);
  }
});

test('basso, melodia e accordi restano nella tonalità scelta (tutti gli stili)', () => {
  for (const [tonic, mode] of [[9, 'minore'], [0, 'maggiore'], [2, 'minore'], [7, 'maggiore']]) {
    for (const g of Object.keys(A.STYLES)) {
      const b = A.generate({ sampleRate: SR, genre: g, bars: 32, tonic, mode, seed: 9 });
      b.events.lead.forEach((e) => assert.ok(inScale(e.midi, tonic, mode), `${g} melodia ${e.midi}`));
      b.events.bass.forEach((e) => assert.ok(inScale(e.midi, tonic, mode), `${g} basso ${e.midi}`));
      b.events.chords.forEach((c) => c.midis.forEach((m) => assert.ok(inScale(m, tonic, mode), `${g} accordo ${m}`)));
    }
  }
});

test('stesso seme = stessa base, seme diverso = base diversa', () => {
  const a = A.generate({ sampleRate: SR, genre: 'trap', bars: 16, seed: 3 });
  const b = A.generate({ sampleRate: SR, genre: 'trap', bars: 16, seed: 3 });
  const c = A.generate({ sampleRate: SR, genre: 'trap', bars: 16, seed: 4 });
  assert.deepEqual(Array.from(a.tracks.kick.slice(0, 8000)), Array.from(b.tracks.kick.slice(0, 8000)));
  assert.deepEqual(a.events.lead.map((e) => e.midi), b.events.lead.map((e) => e.midi));
  assert.notDeepEqual(a.events.lead.map((e) => e.midi), c.events.lead.map((e) => e.midi));
});

test('la canzone non è un loop: strofa e ritornello hanno accordi e intensità diversi', () => {
  for (const g of ['trap', 'epico', 'melodico']) {
    const b = A.generate({ sampleRate: SR, genre: g, bars: 32, seed: 2, mode: 'minore' });
    const strofa = secOf(b, 'strofa')[0], rit = secOf(b, 'ritornello')[0], intro = secOf(b, 'intro')[0];
    const prog = (s) => b.events.chords.filter((c) => c.bar >= s.startBar && c.bar < s.startBar + 4).map((c) => c.name).join(' ');
    assert.notEqual(prog(strofa), prog(rit), g + ' stessa progressione');
    assert.ok(mixE(b, rit) > mixE(b, strofa) * 1.05, g + ' ritornello non più forte della strofa');
    assert.ok(mixE(b, rit) > mixE(b, intro) * 1.5, g + ' ritornello non più forte dell\'intro');
  }
});

test('la melodia è nel ritornello, non nella strofa (spazio per la voce)', () => {
  const b = A.generate({ sampleRate: SR, genre: 'trap', bars: 32, seed: 6 });
  const s = secOf(b, 'strofa')[0];
  const inStrofa = b.events.lead.filter((e) => e.start >= s.startSec && e.start < s.endSec);
  assert.equal(inStrofa.length, 0);
  const r = secOf(b, 'ritornello');
  const lim = Math.min(r[0].endSec - r[0].startSec, r[1].endSec - r[1].startSec);
  const rel = (sec) => b.events.lead.filter((e) => e.start >= sec.startSec - 1e-6 && e.start < sec.startSec + lim - 1e-6).map((e) => Math.round((e.start - sec.startSec) / (60 / b.bpm / 4)) + ':' + e.midi);
  assert.ok(rel(r[0]).length > 8);
  assert.deepEqual(rel(r[0]), rel(r[1]), 'i due ritornelli devono avere lo stesso gancio');
});

test('batteria non identica battuta dopo battuta (varia dentro la strofa)', () => {
  const b = A.generate({ sampleRate: SR, genre: 'trap', bars: 32, seed: 8 });
  const s = secOf(b, 'strofa')[0], barLen = Math.round(b.length / 32);
  const sigs = new Set();
  for (let k = 0; k < s.bars; k++) {
    const a = (s.startBar + k) * barLen; let sig = '';
    for (let st = 0; st < 16; st++) sig += energy(b.tracks.kick, a + st * barLen / 16, a + st * barLen / 16 + 400) > 0.002 ? '1' : '0';
    sigs.add(sig);
  }
  assert.ok(sigs.size >= 3, 'varianti di cassa: ' + sigs.size);
});

test('stili davvero diversi tra loro (tempo, densità di cassa, basso)', () => {
  const bs = Object.keys(A.STYLES).map((g) => ({ g, b: A.generate({ sampleRate: SR, genre: g, bars: 16, seed: 1 }) }));
  const bpms = new Set(bs.map((x) => x.b.bpm));
  assert.ok(bpms.size >= 4);
  const sig = bs.map((x) => x.b.events.bass.length + '/' + x.b.bpm);
  assert.equal(new Set(sig).size, bs.length);
  const epic = bs.find((x) => x.g === 'epico').b, trap = bs.find((x) => x.g === 'trap').b;
  assert.ok(epic.bpm < trap.bpm);
});

test('c\'è un riser prima del ritornello e un impatto sul ritornello', () => {
  const b = A.generate({ sampleRate: SR, genre: 'trap', bars: 32, seed: 1 });
  const r = secOf(b, 'ritornello')[0], barLen = Math.round(b.length / 32), sr = b.sampleRate;
  const a0 = Math.round(r.startSec * sr);
  assert.ok(energy(b.tracks.fx, a0 - barLen, a0) > 0.0005, 'riser');
  assert.ok(energy(b.tracks.fx, a0, a0 + 8000) > 0.005, 'impatto');
  // respiro prima del drop: ultimi 2 passi quasi muti tranne fx
  const gap = Math.round(barLen / 16 * 2);
  assert.ok(energy(b.tracks.kick, a0 - gap + 100, a0 - 10) < 1e-6);
});

test('la base si mixa con Backing.mix e i cursori funzionano (batteria a 0)', () => {
  const b = A.generate({ sampleRate: SR, genre: 'epico', bars: 16, seed: 2 });
  const full = B.mix(b, {}), nodrum = B.mix(b, { batteria: 0 });
  assert.equal(full.length, b.length);
  let d = 0; for (let i = 0; i < full.length; i++) d += Math.abs(full[i] - nodrum[i]);
  assert.ok(d > 1);
  const noFx = B.mix(b, { pad: 0 });
  let d2 = 0; for (let i = 0; i < full.length; i++) d2 += Math.abs(full[i] - noFx[i]);
  assert.ok(d2 > 1);
});

test('prestazioni: 32 battute a 32 kHz in tempi ragionevoli', () => {
  const t0 = Date.now(); const b = A.generate({ sampleRate: 32000, genre: 'epico', bars: 32, seed: 1 });
  const ms = Date.now() - t0;
  assert.ok(b.duration > 50);
  assert.ok(ms < 15000, 'troppo lento: ' + ms + ' ms');
});

test('suoni veri: stessa struttura, batteria diversa dai sintetici, valori finiti', () => {
  const a = A.generate({ sampleRate: SR, genre: 'trap', bars: 16, seed: 3, sounds: 'campioni' });
  const b = A.generate({ sampleRate: SR, genre: 'trap', bars: 16, seed: 3, sounds: 'sint' });
  assert.equal(a.length, b.length);
  assert.deepEqual(a.events.lead.map((e) => e.midi), b.events.lead.map((e) => e.midi));
  for (const n of ['kick', 'snare', 'hat']) {
    let e = 0, d = 0; for (let i = 0; i < a.length; i++) { assert.ok(Number.isFinite(a.tracks[n][i])); e += a.tracks[n][i] ** 2; d += Math.abs(a.tracks[n][i] - b.tracks[n][i]); }
    assert.ok(e > 0 && d > 1, n);
  }
});

test('hi-hat: rullate veloci (1/32, terzine, 1/48) nella trap, non nell\'estate', () => {
  let rolls = 0, fine = 0;
  for (const seed of [1, 2, 3]) {
    const b = A.generate({ sampleRate: SR, genre: 'trap', bars: 32, seed });
    const r = b.events.hat.filter((h) => h.roll);
    rolls += r.length;
    fine += r.filter((h) => Math.abs(h.step - Math.round(h.step)) > 1e-6).length;
    r.forEach((h) => assert.ok(h.step >= 0 && h.step < 16 && h.vel > 0 && h.vel <= 1));
  }
  assert.ok(rolls > 30, 'rullate: ' + rolls);
  assert.ok(fine > 15, 'colpi tra un passo e l\'altro: ' + fine);
  const e = A.generate({ sampleRate: SR, genre: 'estate', bars: 32, seed: 1 });
  assert.equal(e.events.hat.filter((h) => h.roll).length, 0);
});

test('808: glide tra note diverse, più frequente nella drill che nella trap', () => {
  const count = (g) => { let s = 0, n = 0; for (const seed of [1, 2, 3, 4]) { const b = A.generate({ sampleRate: SR, genre: g, bars: 32, seed }); b.events.bass.forEach((e) => { n++; if (e.slideFrom != null) { s++; assert.notEqual(e.slideFrom, e.midi); } }); } return s / n; };
  const tr = count('trap'), dr = count('drill');
  assert.ok(tr > 0.03, 'trap glide ' + tr);
  assert.ok(dr > tr, 'drill ' + dr + ' trap ' + tr);
  const ep = A.generate({ sampleRate: SR, genre: 'epico', bars: 16, seed: 1 });
  assert.ok(ep.events.bass.every((e) => e.slideFrom == null));
});

test('808: coda lunga e armoniche (non è una sinusoide pura)', () => {
  const b = A.generate({ sampleRate: SR, genre: 'trap', bars: 8, seed: 2, sounds: 'sint' });
  const x = b.tracks.bass;
  assert.ok(x.every(Number.isFinite));
  // armoniche: la forma d'onda saturata ha un fattore di cresta più basso di una sinusoide (1.414)
  const ev = b.events.bass.find((v) => v.dur > 0.3 && v.slideFrom == null);
  assert.ok(ev, 'nota lunga');
  let pk = 0, e = 0, n = 0; const a0 = Math.round((ev.start + 0.1) * SR);
  for (let i = a0; i < a0 + Math.round(0.04 * SR); i++) { pk = Math.max(pk, Math.abs(x[i])); e += x[i] * x[i]; n++; }
  assert.ok(pk / Math.sqrt(e / n) < 1.39, 'cresta ' + (pk / Math.sqrt(e / n)).toFixed(2));
});

test('cassa: pattern dello stile che si ripete (groove), con variazione ogni 4 battute', () => {
  const b = A.generate({ sampleRate: SR, genre: 'trap', bars: 32, seed: 4 });
  const s = secOf(b, 'strofa')[0];
  const sig = (bar) => b.events.kick.filter((k) => k.bar === bar).map((k) => k.step).join(',');
  assert.equal(sig(s.startBar), sig(s.startBar + 2), 'battute 1 e 3 uguali');
  assert.equal(sig(s.startBar + 4), sig(s.startBar), 'il groove torna');
  assert.notEqual(sig(s.startBar + 3), sig(s.startBar + 1), 'variazione alla 4a battuta');
  const e = A.generate({ sampleRate: SR, genre: 'estate', bars: 16, seed: 1 });
  const es = secOf(e, 'strofa')[0];
  assert.equal(e.events.kick.filter((k) => k.bar === es.startBar).map((k) => k.step).join(','), '0,4,8,12');
});

test('arpeggi: ci sono in ogni stile, più fitti nel ritornello, note dell\'accordo nella scala', () => {
  for (const g of Object.keys(A.STYLES)) {
    const b = A.generate({ sampleRate: 8000, genre: g, bars: 32, seed: 3, tonic: 9, mode: 'minore' });
    assert.ok(b.events.arp.length > 40, g + ' arpeggi ' + b.events.arp.length);
    b.events.arp.forEach((e) => assert.ok(inScale(e.midi, 9, 'minore'), g + ' nota ' + e.midi));
    const dens = (name) => { const s = secOf(b, name)[0]; return b.events.arp.filter((e) => e.start >= s.startSec && e.start < s.endSec).length / s.bars; };
    assert.ok(dens('ritornello') >= dens('strofa'), g + ' ritornello più fitto');
  }
  const off = A.generate({ sampleRate: 8000, genre: 'trap', bars: 8, seed: 1, arp: false });
  assert.equal(off.events.arp.length, 0);
});

test('piano roll: note scritte a mano sostituiscono melodia e basso, il resto resta identico', () => {
  const base = { sampleRate: 8000, bpm: 140, genre: 'trap', bars: 4, seed: 3, sounds: 'sint' };
  const a = A.generate(base);
  assert.ok(a.events.lead.length && a.events.lead[0].bar != null && a.events.lead[0].step != null);
  assert.ok(a.events.bass[0].len > 0);
  const notes = { lead: [{ bar: 0, step: 0, len: 4, midi: 72 }], bass: [{ bar: 0, step: 0, len: 8, midi: 36 }, { bar: 0, step: 8, len: 8, midi: 41, slide: true }] };
  const b = A.generate(Object.assign({}, base, { notes }));
  assert.strictEqual(b.events.lead.length, 1); assert.strictEqual(b.events.bass.length, 2); assert.ok(b.events.bass[1].slide);
  const e = (x, s, n) => { let t = 0; for (let i = s; i < s + n; i++) t += x[i] * x[i]; return t; };
  const bar = Math.round(240 / 140 * 8000);
  assert.ok(e(b.tracks.lead, bar * 2, bar) < 1e-9, 'niente melodia dopo la nota scritta');
  assert.ok(e(b.tracks.bass, bar, bar) < 1e-9, 'niente basso nelle battute senza note');
  let d = 0; for (let i = 0; i < a.tracks.kick.length; i++) d = Math.max(d, Math.abs(a.tracks.kick[i] - b.tracks.kick[i]));
  assert.strictEqual(d, 0, 'la batteria non cambia');
});

test('batteria a passi: cassa, rullante e hi-hat scritti a mano', () => {
  const base = { sampleRate: 8000, bpm: 140, genre: 'trap', bars: 4, seed: 3, sounds: 'sint', plan: [['strofa', 4]] };
  const g = A.generate(Object.assign({}, base, { drumPat: { kick: [0, 7], snare: [8], hat: [0, 4, 8, 12], rolls: false } }));
  const kb = g.events.kick.filter(e => e.bar === 1).map(e => e.step); assert.deepStrictEqual(kb, [0, 7]);
  const hb = g.events.hat.filter(e => e.bar === 1); assert.ok(hb.every(e => !e.roll)); assert.ok(hb.every(e => [0, 4, 8, 12].includes(e.step)));
});
