const test = require('node:test'), assert = require('node:assert');
const AI = require('../src/sultan-ai.js'), LE = require('../src/lyrics-engine.js'), WB = require('../src/word-bank.js'), SP = require('../src/style-presets.js');
const lyrics = require('fs').readFileSync(__dirname + '/fixtures-testo.txt', 'utf8');
const ctx = { lyrics, LyricsEngine: LE, WordBank: WB, bank: WB.newBank(), presets: SP.LIST, memory: [] };
test('analizza il testo con numeri veri (sillabe, righe lunghe, rime, ritornello)', () => {
  const r = AI.respond('analizza il mio testo', ctx);
  assert.match(r.reply, /righe in \d+ parti/); assert.match(r.reply, /sillabe per riga/); assert.match(r.reply, /Rime tra righe vicine: \d+%/);
});
test('riga N e rime', () => {
  assert.match(AI.respond('riga 2', ctx).reply, /sillabe, la media è/);
  assert.match(AI.respond('rime per addosso', ctx).reply, /addosso/);
});
test('crea basi tipo Shiva → azione varianti con atmosfera', () => {
  const r = AI.respond('fammi 16 basi tipo Shiva', ctx); const v = r.actions.find(a => a.type === 'variants');
  assert.strictEqual(v.n, 16); assert.strictEqual(v.atm, 'shiva');
});
test('impara: ricorda / preferenze / dimentica', () => {
  const r = AI.respond('ricorda che mi piace lo stile di Shiva', ctx); assert.strictEqual(r.actions[0].type, 'remember'); assert.match(r.reply, /Imparato/);
  assert.deepStrictEqual(AI.prefs(['Mi piace lo stile di Shiva', 'non voglio basi tipo Ultimo'], SP.LIST), { like: ['shiva'], avoid: ['ultimo'] });
  assert.strictEqual(AI.respond('dimentica Shiva', ctx).actions[0].type, 'forget');
});
test('aiuto e persona prima di tutto', () => {
  const r = AI.respond('dove sono le varianti?', ctx); assert.strictEqual(r.actions[0].ws, 'base');
  assert.match(AI.respond('non ce la faccio più', ctx).reply, /112/);
});
test('«fallo cantare» → ACE-Step', () => { const r = AI.respond('fallo cantare', { presets: [] }); assert.ok(r.actions.some(a => a.type === 'sing')); });
