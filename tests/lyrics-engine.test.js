const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/lyrics-engine.js');

test('conta le sillabe di parole italiane comuni', () => {
  const casi = {
    mare: 2, amore: 3, cuore: 2, notte: 2, canzone: 3, luna: 2, stella: 2,
    città: 2, così: 2, più: 1, può: 1, farò: 2, già: 1, quando: 2, guerra: 2,
    maestro: 3, mia: 2, paura: 3, sole: 2, mai: 1
  };
  for (const [parola, attese] of Object.entries(casi)) {
    assert.equal(L.countSyllables(parola), attese, parola);
  }
});

test('stringa vuota o senza lettere = 0 sillabe', () => {
  assert.equal(L.countSyllables(''), 0);
  assert.equal(L.countSyllables('123 !?'), 0);
});

test('la sinalefe riduce le sillabe metriche', () => {
  const r = L.lineSyllables('sole e luna');
  assert.equal(r.raw, 2 + 1 + 2);
  assert.equal(r.metric, 4); // "sole e" si fondono
});

test('rime: perfetta, assonanza, nessuna', () => {
  assert.equal(L.rhymeRelation('amore', 'cuore'), 'perfect');
  assert.equal(L.rhymeRelation('amor', 'cuor'), 'perfect');
  assert.equal(L.rhymeRelation('amore', 'sole'), 'assonance');
  assert.equal(L.rhymeRelation('cuore', 'mare'), 'none');
  assert.equal(L.rhymeRelation('mare', 'mare'), 'same');
});

test('divide in strofe e legge le etichette', () => {
  const s = L.parseStanzas('[Strofa]\nuna\ndue\n\n[Ritornello]\ntre\nquattro');
  assert.equal(s.length, 2);
  assert.equal(s[0].label, 'Strofa');
  assert.equal(s[1].label, 'Ritornello');
  assert.deepEqual(s[1].lines, ['tre', 'quattro']);
});

const CANZONE = `[Strofa]
Cammino da solo sotto la luna
Il vento mi parla di te
Ricordo la sera, la prima fortuna
E il cielo era grande con me

[Ritornello]
Torna domani, torna con il sole
Torna domani, canta il mio cuore
Torna domani, senza più parole
Torna domani, torna amore

[Strofa]
Le strade sono vuote e il tempo passa
Ma dentro ho ancora un sogno da seguire

[Ritornello]
Torna domani, torna con il sole
Torna domani, canta il mio cuore
Torna domani, senza più parole
Torna domani, torna amore`;

test('analizza una canzone: strofe, righe, schema rime', () => {
  const r = L.analyze(CANZONE);
  assert.equal(r.counts.stanzas, 4);
  assert.equal(r.counts.lines, 4 + 4 + 2 + 4);
  const rit = r.stanzas[1];
  assert.equal(rit.scheme, 'ABAB');
  assert.equal(rit.rhymedLines, 4);
});

test('riconosce il ritornello ripetuto e ne spiega il punteggio', () => {
  const r = L.analyze(CANZONE);
  assert.ok(r.chorus);
  assert.equal(r.chorus.label, 'Ritornello');
  assert.equal(r.chorus.appearances, 2);
  const somma = r.chorus.components.reduce((a, c) => a + c.points, 0);
  assert.equal(somma, r.chorus.score);
  assert.ok(r.chorus.score >= 70, 'punteggio ' + r.chorus.score);
});

test('trova il ritornello anche senza etichetta se la strofa si ripete', () => {
  const r = L.analyze('ciao mare\nvento sale\n\nluna blu\nstella e mare\n\nciao mare\nvento sale');
  assert.ok(r.chorus);
  assert.equal(r.chorus.labeled, false);
  assert.equal(r.chorus.appearances, 2);
});

test('senza ritornello lo dice nei suggerimenti', () => {
  const r = L.analyze('una riga\naltra riga ancora\n\nterza strofa qui\nultima riga');
  assert.equal(r.chorus, null);
  assert.ok(r.suggestions.some((s) => /ritornello/i.test(s.text)));
});

test('emozioni: tristezza prevale su un testo triste, dati insufficienti su uno neutro', () => {
  const triste = L.analyze('Piango da solo nel buio\nIl dolore è un vuoto\nAddio, ho perduto tutto');
  assert.equal(triste.emotions.sufficient, true);
  assert.equal(triste.emotions.items[0].name, 'tristezza');
  assert.equal(triste.emotions.valence, 'negativo');

  const neutro = L.analyze('Tavolo sedia finestra\nPorta armadio libro');
  assert.equal(neutro.emotions.sufficient, false);
  assert.equal(neutro.emotions.valence, null);
});

test('righe di lunghezza molto diversa generano un suggerimento motivato', () => {
  const r = L.analyze('Sì\nQuesta è una riga davvero molto lunga da cantare tutta insieme\nNo\nUn\'altra riga lunghissima che non finisce mai di continuare');
  const s = r.suggestions.find((x) => /sillabe/.test(x.text));
  assert.ok(s);
  assert.equal(s.kind, 'analisi');
  assert.ok(s.reason.length > 10);
});

test('testo vuoto non genera errori', () => {
  const r = L.analyze('');
  assert.equal(r.counts.lines, 0);
  assert.equal(r.chorus, null);
  assert.deepEqual(r.suggestions, []);
});
