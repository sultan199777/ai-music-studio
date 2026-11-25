'use strict';
const test = require('node:test'), assert = require('node:assert');
const Remix = require('../src/remix.js');
global.__SigFx = require('../src/sig-fx.js');
const Arranger = require('../src/arranger.js');

test('stesso seme = stesso remix, semi diversi = remix diversi', () => {
  assert.deepStrictEqual(Remix.make(5, { heavy: true }), Remix.make(5, { heavy: true }));
  const sigs = new Set(); for (let i = 0; i < 24; i++) sigs.add(JSON.stringify(Remix.make(i, { heavy: true })));
  assert.strictEqual(sigs.size, 24);
});
test('Misurato: 16 versioni sono lontane tra loro (distanza media > 0.35, nessuna sotto 0.1)', () => {
  const v = []; for (let i = 0; i < 16; i++) v.push(Remix.make(100 + i, { heavy: true }));
  let tot = 0, n = 0, min = 1;
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) { const d = Remix.distance(v[i], v[j]); tot += d; n++; min = Math.min(min, d); }
  assert.ok(tot / n > 0.35, 'media ' + tot / n);
  assert.ok(min >= 0.1, 'minimo ' + min);
});
test('i valori sono validi per l\'arrangiatore (passi 0-15, gradi 0-6)', () => {
  for (let i = 0; i < 60; i++) {
    const r = Remix.make(i, { heavy: i % 2 === 0, mode: i % 5 === 0 ? 'maggiore' : 'minore', half: i % 3 !== 0 });
    r.groove.kickPats.forEach(p => p.forEach(a => a.forEach(x => assert.ok(x >= 0 && x < 16 && Number.isInteger(x)))));
    r.groove.snare.forEach(x => assert.ok(x >= 0 && x < 16));
    assert.strictEqual(r.prog.length, 4); r.prog.forEach(d => assert.ok(d >= 0 && d < 7));
    assert.ok(r.groove.rolls >= 0 && r.groove.rolls <= 1 && r.groove.swing >= 0 && r.groove.swing <= 0.3);
  }
});
test('con l\'arrangiatore vero la batteria e gli accordi cambiano tra versioni', () => {
  const outs = [1, 2, 3, 4, 5, 6].map(i => { const r = Remix.make(i, { heavy: true }); return Arranger.generate({ genre: 'trapdark', bpm: 140, mode: 'minore', tonic: 0, seed: 7, bars: 8, groove: r.groove, prog: r.prog, tune: r.tune, melSeed: r.melSeed, heavy: true }); });
  const keys = Object.keys(outs[0].tracks || outs[0]);
  const diffTracks = new Set(); outs.forEach(o => diffTracks.add(JSON.stringify((o.tracks || o).drums || (o.tracks || o))));
  assert.ok(diffTracks.size >= 5, 'batterie diverse: ' + diffTracks.size + ' su 6 (tracce: ' + keys.join(',') + ')');
  const chords = new Set(); outs.forEach(o => chords.add(JSON.stringify((o.tracks || o).chords || (o.tracks || o).pad || '')));
  assert.ok(chords.size >= 3, 'accordi diversi: ' + chords.size);
});
