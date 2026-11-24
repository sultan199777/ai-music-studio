const test = require('node:test');
const assert = require('node:assert/strict');
const PA = require('../src/producer-actions.js');
const PP = require('../src/promo-plan.js');

const S0 = () => ({ bpm: 100, mode: 'maggiore', genre: 'pop', bassStyle: null, bars: 8, reverb: 0, levels: { batteria: 1, basso: 1, accordi: 1, pad: 1, melodia: 1 } });

test('producer: più energia alza tempo e batteria, non modifica lo stato originale', () => {
  const s = S0(); const r = PA.interpret('Dai più energia a questa base', s);
  assert.equal(r.understood, true);
  assert.equal(r.state.bpm, 108); assert.ok(r.state.levels.batteria > 1);
  assert.equal(s.bpm, 100); assert.equal(s.levels.batteria, 1);
  assert.ok(r.notes.length >= 1);
});

test('producer: basso più profondo usa il basso 808 e lo alza', () => {
  const r = PA.interpret('Aggiungi un basso più profondo', S0());
  assert.equal(r.state.bassStyle, '808'); assert.ok(r.state.levels.basso > 1);
});

test('producer: cinematografica = più lenta, minore, pad e riverbero', () => {
  const r = PA.interpret('Voglio un\'atmosfera più cinematografica', S0());
  assert.equal(r.state.mode, 'minore'); assert.ok(r.state.bpm < 100); assert.ok(r.state.levels.pad > 1.2); assert.ok(r.state.reverb > 0);
});

test('producer: troppo vuota riaccende gli strumenti spenti', () => {
  const s = S0(); s.levels.pad = 0; s.levels.accordi = 0.2;
  const r = PA.interpret('Questa parte è troppo vuota', s);
  assert.ok(r.state.levels.pad >= 1 && r.state.levels.accordi >= 1);
});

test('producer: tre alternative chiede tre varianti', () => {
  assert.equal(PA.interpret('Fammi ascoltare tre alternative', S0()).variants, 3);
});

test('producer: limiti rispettati (tempo e volumi)', () => {
  let s = S0(); s.bpm = 178;
  for (let i = 0; i < 6; i++) s = PA.interpret('più energia', s).state;
  assert.ok(s.bpm <= 180); assert.ok(s.levels.batteria <= 1.8);
  s.bpm = 62; for (let i = 0; i < 6; i++) s = PA.interpret('più lenta', s).state;
  assert.ok(s.bpm >= 60);
});

test('producer: sezioni singole dichiarate non supportate ma applicate a tutta la base', () => {
  const r = PA.interpret('Nel secondo ritornello voglio più energia', S0());
  assert.equal(r.understood, true); assert.ok(r.unsupported && /intera/.test(r.unsupported));
});

test('producer: comando non riconosciuto non cambia nulla', () => {
  const s = S0(); const r = PA.interpret('Parlami del tempo', s);
  assert.equal(r.understood, false); assert.deepEqual(r.state, s);
});

test('producer: minore, maggiore e senza batteria', () => {
  assert.equal(PA.interpret('più malinconica', S0()).state.mode, 'minore');
  const s = S0(); s.mode = 'minore';
  assert.equal(PA.interpret('più luminosa', s).state.mode, 'maggiore');
  assert.equal(PA.interpret('senza batteria', S0()).state.levels.batteria, 0);
});

const LYR = '[Strofa]\nCammino da solo sotto la luna\nIl vento mi parla di te\n\n[Ritornello]\nTorna domani, torna con il sole\nTorna domani, canta il mio cuore\nTorna domani, senza più parole\nTorna domani, torna amore';

test('promozione: 30 giorni, date ordinate, uscita il giorno 14', () => {
  const p = PP.generate({ title: 'Torna domani', lyrics: LYR, genre: 'pop', moods: ['amore'], startDate: '2026-12-01' });
  assert.equal(p.startDate, '2026-12-01'); assert.equal(p.releaseDate, '2026-12-14');
  assert.ok(p.items.length >= 15);
  for (let i = 1; i < p.items.length; i++) assert.ok(p.items[i].day >= p.items[i - 1].day);
  assert.ok(p.items.every((i) => i.day >= 1 && i.day <= 30));
  const last = p.items[p.items.length - 1];
  assert.equal(last.date, '2026-12-30');
  const rel = p.items.filter((i) => i.type === 'uscita'); assert.ok(rel.length >= 2 && rel.every((i) => i.date === '2026-12-14'));
});

test('promozione: tutti i contenuti richiesti presenti e per le tre piattaforme', () => {
  const p = PP.generate({ title: 'X', lyrics: LYR, startDate: '2026-01-01' });
  const types = new Set(p.items.map((i) => i.type));
  for (const t of ['teaser', 'estratto', 'lyric-video', 'uscita', 'dietro-le-quinte', 'copertina', 'alternativo']) assert.ok(types.has(t), t);
  const plat = new Set(p.items.map((i) => i.platform));
  assert.deepEqual([...plat].sort(), ['instagram', 'tiktok', 'youtube']);
  assert.ok(p.items.every((i) => i.status === 'da fare' && /^\d{2}:\d{2}$/.test(i.time)));
});

test('promozione: didascalie usano righe del testo vero e hashtag sono pertinenti e limitati', () => {
  const p = PP.generate({ title: 'Torna domani', lyrics: LYR, genre: 'lofi', moods: ['nostalgia'], startDate: '2026-12-01' });
  const est = p.items.find((i) => i.type === 'estratto');
  assert.ok(/Torna domani/.test(est.caption));
  assert.ok(p.items.every((i) => i.caption.trim().length > 10));
  for (const i of p.items) {
    assert.ok(i.hashtags.length >= 3 && i.hashtags.length <= 8);
    assert.ok(i.hashtags.every((h) => /^#[a-z0-9]+$/.test(h)));
    assert.equal(new Set(i.hashtags).size, i.hashtags.length);
  }
  assert.ok(p.items.find((i) => i.platform === 'tiktok').hashtags.length <= 5);
  assert.ok(p.items[0].hashtags.includes('#lofi'));
});

test('promozione: senza testo né titolo non si rompe', () => {
  const p = PP.generate({});
  assert.ok(p.items.length >= 15); assert.ok(p.items.every((i) => !/undefined|NaN|null/.test(i.caption)));
});

test('promozione: CSV con virgolette e virgole nelle didascalie', () => {
  const csv = PP.toCsv([{ date: '2026-01-01', time: '18:30', platform: 'tiktok', format: 'video', title: 'A, B', caption: 'Dice "ciao"', hashtags: ['#a', '#b'], status: 'da fare' }]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'data,ora,piattaforma,formato,titolo,didascalia,hashtag,stato');
  assert.ok(lines[1].includes('"A, B"') && lines[1].includes('"Dice ""ciao"""'));
});
