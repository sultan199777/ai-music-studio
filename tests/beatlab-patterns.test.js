const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/beatlab-engine.js');
const P = require('../src/beatlab-patterns.js');

const lane = (p, l) => p.tracks.find((t) => t.lane === l);
const hits = (t, bar) => { const o = []; for (let i = bar * 16; i < bar * 16 + 16; i++) if (t.steps[i] > 0) o.push(i - bar * 16); return o; };

test('ogni stile: parametri sensati e pattern completo', () => {
  for (const id of P.STYLE_IDS) {
    const p = E.newProject(); P.applyStyle(p, id); const S = P.STYLES[id];
    assert.equal(p.bpm, S.bpm[2]); assert.ok(p.bpm >= S.bpm[0] && p.bpm <= S.bpm[1]);
    assert.ok(p.swing >= 50 && p.swing <= 75); assert.equal(p.steps, undefined);
    for (const t of E.drumTracks(p)) { assert.equal(t.steps.length, 32); for (const v of t.steps) assert.ok(Number.isInteger(v) && v >= 0 && v <= 127, id + ' vel ' + v); }
    assert.ok(hits(lane(p, 'kick'), 0).includes(0), id + ': cassa sul primo tempo');
    assert.ok(hits(lane(p, 'hat'), 0).length + hits(lane(p, 'ohat'), 0).length > 0, id + ': ha gli hi-hat');
  }
});

test('regole di genere: half-time per trap, 3 poi 4 per drill, 2 e 4 per boom bap/pop, quattro quarti per elettronico', () => {
  const g = (id) => { const p = E.newProject(); P.applyStyle(p, id); return p; };
  for (const id of ['trap', 'orchestrale']) { const p = g(id); assert.deepEqual(hits(lane(p, 'snare'), 0), [8]); assert.deepEqual(hits(lane(p, 'snare'), 1), [8]); }
  const d = g('drill'); assert.deepEqual(hits(lane(d, 'snare'), 0), [8]); assert.deepEqual(hits(lane(d, 'snare'), 1), [12]);
  for (const id of ['boombap', 'pop']) { const p = g(id); assert.deepEqual(hits(lane(p, 'snare'), 0), [4, 12]); }
  const e = g('elettronico'); assert.deepEqual(hits(lane(e, 'kick'), 0), [0, 4, 8, 12]); assert.deepEqual(hits(lane(e, 'clap'), 0).slice(0, 2), [4, 12]);
  assert.ok(g('boombap').swing >= 62 && g('trap').swing === 50);
});

test('rullate solo sugli hi-hat e solo dove c\'e\' un colpo', () => {
  for (const id of P.STYLE_IDS) {
    const p = E.newProject(); P.applyStyle(p, id);
    for (const t of E.drumTracks(p)) for (let i = 0; i < t.roll.length; i++) { if (t.lane !== 'hat') assert.equal(t.roll[i], 0); else if (t.roll[i]) assert.ok(t.steps[i] > 0); assert.ok(E.ROLLS.includes(t.roll[i])); }
  }
});

test('"casuale ma sensato": 30 semi x 7 stili rispettano le regole', () => {
  for (const id of P.STYLE_IDS) {
    const base = E.newProject(); P.applyStyle(base, id); const sn = [hits(lane(base, 'snare'), 0), hits(lane(base, 'snare'), 1)];
    const seen = new Set();
    for (let seed = 1; seed <= 30; seed++) {
      const p = E.newProject(); P.randomize(p, id, seed);
      seen.add(JSON.stringify(lane(p, 'kick').steps));
      assert.ok(p.bpm >= P.STYLES[id].bpm[0] && p.bpm <= P.STYLES[id].bpm[1], id + ' bpm ' + p.bpm);
      for (let b = 0; b < 2; b++) {
        assert.deepEqual(hits(lane(p, 'snare'), b), sn[b], id + ' rullante spostato');
        const k = hits(lane(p, 'kick'), b);
        assert.ok(k.includes(0), id + ' cassa su 1');
        for (const s of sn[b]) assert.ok(!k.includes(s) || id === 'elettronico', id + ': cassa sul rullante');
        for (let i = 1; i < k.length; i++) assert.ok(k[i] - k[i - 1] >= 2, id + ' casse attaccate');
        if (id === 'elettronico') assert.deepEqual(k, [0, 4, 8, 12]); else { assert.ok(k.length >= 2 && k.length <= 7, id + ' n casse ' + k.length); }
      }
      for (const t of E.drumTracks(p)) for (let i = 0; i < t.steps.length; i++) { assert.ok(Number.isInteger(t.steps[i]) && t.steps[i] >= 0 && t.steps[i] <= 127); if (t.lane !== 'hat') assert.equal(t.roll[i], 0); else if (t.roll[i]) assert.ok(t.steps[i] > 0 && [2, 3, 4].includes(t.roll[i])); }
      const bass = p.tracks.find((t) => t.inst === 'sub808');
      assert.ok(bass.notes.length >= 2);
      for (const n of bass.notes) { assert.ok(n.n >= 24 && n.n <= 48, 'range 808 ' + n.n); assert.ok(n.d > 0 && n.t >= 0 && n.t < 768); const step = n.t / 24; assert.ok(Number.isInteger(step)); assert.ok(lane(p, 'kick').steps[step] > 0, 'basso senza cassa'); }
    }
    if (id !== 'elettronico') assert.ok(seen.size >= 8, id + ' poca varieta\': ' + seen.size);
  }
});

test('casuale: stesso seme = stesso risultato; semi diversi = risultati diversi', () => {
  const mk = (s) => { const p = E.newProject(); P.randomize(p, 'trap', s); return JSON.stringify(p.tracks.map((t) => [t.steps, t.roll, t.notes])) + p.bpm; };
  assert.equal(mk(5), mk(5)); assert.notEqual(mk(5), mk(6));
});
