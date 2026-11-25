const test = require('node:test'), assert = require('node:assert');
const O = require('../src/omino.js'), SM = require('../src/song-map.js'), LE = require('../src/lyrics-engine.js');
const map = SM.build('[Strofa]\nscendo in strada con la notte addosso\nmia madre prega e io non posso', { bpm: 90, syll: LE.lineSyllables, modes: {} });
test('omino: prima della riga conta l\'entrata, sulle parole apre la bocca, tra le righe chiude', () => {
  const l = map.lines[0], w = l.words[1], beat = 60 / 90;
  const before = O.state(map, l.words[0].start - beat * 2, beat); assert.match(before.cue, /Entra tra/); assert.strictEqual(before.open, 0);
  const mid = O.state(map, (w.start + w.end) / 2, beat); assert.strictEqual(mid.word, w.w); assert.ok(mid.open > 0.3); assert.strictEqual(mid.line, l.text);
  const end = O.state(map, map.lines[1].end + 30, beat); assert.strictEqual(end.cue, 'Fine');
  assert.match(O.state(null, 1, beat).cue, /Scrivi il testo/);
});
