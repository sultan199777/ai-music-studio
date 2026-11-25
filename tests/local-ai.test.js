const test = require('node:test'), assert = require('node:assert/strict');
const L = require('../src/local-ai.js');
test('prompt: contiene genere, umore, riga e rime; sistema vieta copie', () => {
  const m = L.buildPrompt('continua', { line: 'Sono nato in strada', genre: 'drill', mood: 'dark', syll: 9, rhymes: ['fame', 'rame'], context: 'x' });
  assert.equal(m[0].role, 'system'); assert.match(m[0].content, /drill/); assert.match(m[0].content, /senza copiare/);
  assert.match(m[1].content, /Sono nato in strada/); assert.match(m[1].content, /fame, rame/);
});
test('pulizia: toglie numeri, preamboli, duplicati e righe in altre lingue', () => {
  const r = L.clean('Ecco le righe:\n1. Il buio mi chiama per nome\n2) "Il buio mi chiama per nome"\n- 我爱你 mia città di vetro\n* Corro dietro ai soldi e al tempo\nSono nato in strada', 'Sono nato in strada');
  assert.deepEqual(r, ['Il buio mi chiama per nome', 'Corro dietro ai soldi e al tempo']);
});
test('senza WebGPU: errore chiaro, nessun crash', async () => {
  await assert.rejects(() => L.load(L.MODELS[0].id), /WebGPU/);
});
test('Ollama: modello scelto e risposta pulita (finto server)', async () => {
  const calls = []; global.fetch = async (u, o) => { calls.push(u); if (/tags/.test(u)) return { ok: true, json: async () => ({ models: [{ name: 'llama3:8b' }, { name: 'qwen2.5:7b' }] }) }; return { ok: true, json: async () => ({ message: { content: '1. Il buio mi chiama per nome\n2. Corro dietro ai soldi e al tempo' } }) }; };
  assert.equal(await L.useOllama(), 'qwen2.5:7b');
  const r = await L.ask('versioni', { line: 'Sono nato in strada' });
  assert.equal(r.length, 2); assert.ok(calls.some((u) => /api\/chat/.test(u)));
  delete global.fetch;
});
