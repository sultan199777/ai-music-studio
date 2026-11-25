const test = require('node:test'), assert = require('node:assert');
const P = require('../src/prod-fx.js'), SM = require('../src/song-map.js'), LE = require('../src/lyrics-engine.js');
const TXT = '[Strofa]\nScendo in strada con la notte addosso\nmia madre prega e io non posso\nsirene sotto casa, il cuore in fiamme\nvoglio la Lambo, voglio uscire dal dramma!\n[Ritornello]\nsoldi nella mano, pioggia sul viso\nvolo in elicottero sopra la città\ne nessuno mi ferma, no, nessuno mi avrà';
const map = SM.build(TXT, { bpm: 90, syll: LE.lineSyllables, modes: {} });
test('ogni suono della libreria è valido (niente NaN, non muto)', () => {
  assert.ok(Object.keys(P.SOUNDS).length >= 28);
  for (const k in P.SOUNDS) { const b = P.sound(k, 16000, 3, { dur: 3, bpm: 90, midi: 57 }); let pk = 0; for (const v of b) { assert.ok(isFinite(v), k); pk = Math.max(pk, Math.abs(v)); } assert.ok(pk > 0.2 && pk <= 1, k + ' ' + pk); }
});
test('il testo decide i suoni: polizia → sirena, Lambo → motore, elicottero, soldi', () => {
  const pl = P.plan(map, { genre: 'drill', seed: 3, density: 2 }), s = pl.events.filter(e => e.tipo === 'sfx').map(e => e.snd);
  assert.ok(s.includes('sirena')); assert.ok(s.some(x => ['supercar', 'v8', 'passaggio'].includes(x))); assert.ok(s.includes('elicottero')); assert.ok(s.some(x => ['contasoldi', 'monete'].includes(x)));
  assert.ok(pl.themes.includes('polizia'));
  assert.ok(pl.events.some(e => e.snd === 'impatto' || e.snd === 'esplosione'), 'colpo sul ritornello');
  assert.ok(pl.events.some(e => e.tipo === 'vox' && e.snd === 'coro'), 'cori nel ritornello');
});
test('un testo senza immagini non inventa sirene o spari', () => {
  const m2 = SM.build('[Strofa]\nti penso sempre quando è sera\nla tua voce è una carezza vera', { bpm: 90, syll: LE.lineSyllables, modes: {} });
  const s = P.plan(m2, { genre: 'melodico', seed: 1, density: 1 }).events.map(e => e.snd);
  assert.ok(!s.includes('sirena') && !s.includes('sparo'));
});
test('quantità: poco < normale < tanto; i colpi cadono a fine riga (non sulle parole)', () => {
  const n = [0, 1, 2].map(d => P.plan(map, { genre: 'trap', seed: 2, density: d }).events.length);
  assert.ok(n[0] < n[1] && n[1] <= n[2], n.join());
  const pl = P.plan(map, { genre: 'trap', seed: 2, density: 1 });
  pl.events.filter(e => e.line != null && e.tipo === 'sfx').forEach(e => { const l = map.lines[e.line]; assert.ok(e.bar >= l.startBar + l.bars - 0.5); });
});
test('render: effetti a tempo e voce (eco, coro, risposta) dalla voce registrata', () => {
  const sr = 16000, bpm = 90, N = Math.round(map.totalBars * 240 / bpm * sr), pl = P.plan(map, { genre: 'drill', seed: 4, density: 1 });
  const fx = P.renderSfx(pl.events, sr, bpm, N, { seed: 4 }); assert.strictEqual(fx.length, N); assert.ok(fx.some(v => Math.abs(v) > 0.05));
  const v = new Float32Array(N); map.lines.forEach(l => { for (let i = Math.round(l.start * sr); i < Math.round(l.end * sr); i++) v[i] = 0.4 * Math.sin(2 * Math.PI * 220 * i / sr); });
  const out = P.renderVox(pl.events, { x: v, sr }, map, bpm, {}); assert.ok(out && out.some(x => Math.abs(x) > 0.02));
  const w = P.lastWord(v, sr, map.lines[0].start, map.lines[1].start - 0.03); assert.ok(w && w[1] > w[0] && Math.abs(w[1] / sr - map.lines[0].end) < 0.1);
});
test('pitch: un\'ottava sotto dimezza la frequenza, stessa durata', () => {
  const sr = 16000, x = new Float32Array(sr); for (let i = 0; i < sr; i++) x[i] = Math.sin(2 * Math.PI * 440 * i / sr);
  const y = P.pitch(x, sr, -12); assert.strictEqual(y.length, x.length); let z = 0; for (let i = 2000; i < 14000; i++) if (y[i - 1] < 0 && y[i] >= 0) z++; const f = z / (12000 / sr); assert.ok(Math.abs(f - 220) < 25, f);
});
test('firme del Cervello (SigFx): una sola volta, come eventi della Produzione', () => {
  const pl = P.plan(map, { genre: 'trap', seed: 1, density: 0, sig: ['sirena', 'spari', 'coro'] }), ev = pl.events;
  assert.ok(ev.some(e => e.snd === 'sparo' && /firma/.test(e.why)));
  const shotsOnChorus = ev.filter(e => e.snd === 'sparo' && e.bar === 4).length; assert.ok(shotsOnChorus <= 1);
  const b = P.sound('corolirico', 8000, 1, { dur: 2, midi: 57 }); assert.ok(b.length >= 8000 * 1.9 && b.some(v => Math.abs(v) > 0.1));
});
test('testo vero (25/11): niente falsi temi da parole simili (confondersi≠onde, chiamano≠telefono), cristallo e dolore sì', () => {
  const r = l => P.readLine(l).hits.map(h => h.why);
  assert.ok(!r('con gli altri, che è tanto facile non vuole confondersi').includes('mare'));
  assert.ok(!r('alcuni lo chiamano dono, altri agonia').includes('telefono'));
  assert.ok(r('sta in bilico come un cristallo su neve').includes('qualcosa che si rompe'));
  assert.ok(r('mi prendo i loro dolori e li porto addosso').includes('cuore'));
});
