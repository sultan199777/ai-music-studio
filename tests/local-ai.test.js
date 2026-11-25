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
test('consiglio per RAM: più RAM, modello più grande', () => {
  assert.equal(L.recommend(8).model, 'qwen2.5:3b'); assert.equal(L.recommend(16).model, 'qwen2.5:7b'); assert.equal(L.recommend(32).model, 'qwen2.5:32b');
});
test('Qwen3: /no_think nel prompt e i pensieri <think> vengono tolti dalla risposta', () => {
  const m = L.buildPrompt('versioni', { line: 'Sono nato in strada', model: 'Qwen3-1.7B-q4f16_1-MLC' });
  assert.match(m[1].content, /\/no_think/);
  assert.doesNotMatch(L.buildPrompt('versioni', { line: 'x', model: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC' })[1].content, /no_think/);
  assert.deepEqual(L.clean('<think>ragiono molto qui dentro</think>\nIl buio mi chiama per nome\nCorro dietro ai soldi e al tempo'), ['Il buio mi chiama per nome', 'Corro dietro ai soldi e al tempo']);
});
test('nuovi compiti: ritornello (4 righe, un solo blocco) e migliora; i gusti e i temi entrano nel prompt', async () => {
  assert.ok(L.TASKS.ritornello && L.TASKS.migliora);
  const m = L.buildPrompt('ritornello', { genre: 'drill', mood: 'dark', syll: 8, taste: 'ti piacciono drill', scenes: 'strada, dolore', context: 'Notte in strada' });
  assert.match(m[0].content, /4 righe/); assert.match(m[0].content, /ti piacciono drill/); assert.match(m[0].content, /strada, dolore/);
  global.fetch = async (u) => /tags/.test(u) ? { ok: true, json: async () => ({ models: [{ name: 'qwen2.5:7b' }] }) } : { ok: true, json: async () => ({ message: { content: 'Dark nel cuore, la città\nSirene nella notte\nNon mi fermo mai più\nDark nel cuore, la città\nQuinta riga di troppo qui' } }) };
  await L.useOllama(); const r = await L.ask('ritornello', { genre: 'drill' });
  assert.equal(r.length, 1); assert.equal(r[0].split('\n').length, 4); delete global.fetch;
});
test('la lista modelli contiene Qwen3 con licenza dichiarata e avviso di non provato', () => {
  const q3 = L.MODELS.filter((x) => /^Qwen3/.test(x.id)); assert.ok(q3.length >= 1); q3.forEach((x) => assert.match(x.note, /non ancora provato/i));
  assert.match(L.MODELS[0].id, /Qwen2\.5-0\.5B/); /* il primo (iPhone) resta il più leggero */
});
test('artista e linguaggio: stile misurato nel prompt, crudo scelto dall\'utente, limiti di sicurezza sempre presenti', () => {
  const c = { genre: 'drill', artist: { name: 'Tipo X', note: 'rime fitte, 9 sillabe, temi strada' } };
  const crudo = L.buildPrompt('versioni', Object.assign({ raw: 'crudo' }, c))[0].content, molto = L.buildPrompt('versioni', Object.assign({ raw: 'moltocrudo' }, c))[0].content, pulito = L.buildPrompt('versioni', Object.assign({ raw: 'pulito' }, c))[0].content;
  assert.match(crudo, /parolacce ammesse/); assert.match(molto, /espliciti ammessi, solo tra adulti consenzienti/); assert.match(pulito, /Niente parolacce/);
  [crudo, molto, pulito].forEach((p) => { assert.match(p, /Tipo X/); assert.match(p, /rime fitte, 9 sillabe/); assert.match(p, /Non copiare versi esistenti/); assert.match(p, /minorenni/); assert.match(p, /odio contro gruppi/); });
  assert.doesNotMatch(L.buildPrompt('versioni', { genre: 'trap' })[0].content, /Adatta lo stile a/);
});
