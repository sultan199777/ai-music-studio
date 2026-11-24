const test = require('node:test'), assert = require('node:assert');
const AI = require('../src/local-ai.js'), SA = require('../src/studio-agent.js'), PA = require('../src/producer-actions.js');
test('parse: legge risposta, comandi e testo anche se un po\' storti', () => {
  const r = AI.parse('**RISPOSTA:** Metto più spazio sulla voce.\nCOMANDI:\n1. voce più riverbero\n- 808 più lungo.\nTESTO:\n- Riga uno\nRiga due');
  assert.strictEqual(r.reply, 'Metto più spazio sulla voce.'); assert.deepStrictEqual(r.commands, ['voce più riverbero', '808 più lungo']); assert.deepStrictEqual(r.lyrics, ['Riga uno', 'Riga due']);
  assert.deepStrictEqual(AI.parse('Ciao, non serve niente.').commands, []);
});
test('ogni comando dell\'elenco lo capisce davvero lo Studio (agente o comandi base)', () => {
  AI.COMANDI.filter(c => !/nuova variante|crea la base dal testo/.test(c)).forEach(c => {
    const st = { prod: { levels: {}, mix: {} }, mic: {}, ctx: { sections: [{ name: 'ritornello', startBar: 4 }], leadNotes: [{ bar: 0, step: 0, len: 2, midi: 70 }] } };
    const pa = PA.interpret(c, { bpm: 140, mode: 'minore', genre: 'trap', levels: {} });
    assert.ok(SA.interpret(c, st).understood || pa.understood, 'non capito: ' + c);
  });
});
test('messages: contiene contesto e richiesta', () => {
  const m = AI.messages('base più triste', { summary: 'Trap · 140 BPM', lyrics: 'riga', taste: '' });
  assert.strictEqual(m[0].role, 'system'); assert.ok(/base più triste/.test(m[m.length - 1].content)); assert.ok(/Trap · 140/.test(m[m.length - 1].content));
});
