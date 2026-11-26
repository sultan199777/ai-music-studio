const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/cloud-ai.js');

function memStore() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, _m: m }; }
function fakeFetch(status, body, spy) {
  return async (url, init) => { if (spy) spy.push({ url, init }); return { ok: status >= 200 && status < 300, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) }; };
}

test('buildMessages: sistema, contesto con misure e testo, cronologia, domanda', () => {
  const msgs = C.buildMessages('migliora il ritornello', { page: 'testo', lyrics: 'riga uno\nriga due', summary: 'Drill, 142 BPM', analysis: 'Media 11 sillabe', memory: ['mi piacciono le basi scure'], presets: [{ id: 'drill', nome: 'Drill UK' }] }, [{ who: 'me', t: 'ciao' }, { who: 'ai', t: 'ciao Sultan' }]);
  assert.equal(msgs[0].role, 'system'); assert.match(msgs[0].content, /AZIONI/);
  assert.match(msgs[1].content, /Media 11 sillabe/); assert.match(msgs[1].content, /riga uno/); assert.match(msgs[1].content, /basi scure/); assert.match(msgs[1].content, /drill: Drill UK/);
  assert.deepEqual(msgs.slice(2).map(m => m.role), ['user', 'assistant', 'user']);
  assert.equal(msgs[msgs.length - 1].content, 'migliora il ritornello');
});

test('buildMessages: testo lunghissimo tagliato, cronologia limitata', () => {
  const h = Array.from({ length: 30 }, (_, i) => ({ who: i % 2 ? 'ai' : 'me', t: 'm' + i }));
  const msgs = C.buildMessages('x', { lyrics: 'a'.repeat(9000) }, h);
  assert.ok(msgs[1].content.length < 3500); assert.match(msgs[1].content, /tagliato/);
  assert.equal(msgs.length, 2 + 8 + 1);
});

test('parseReply: separa la riga AZIONI e tiene solo azioni sicure', () => {
  const raw = 'Ti faccio 12 basi drill scure.\nAZIONI: [{"type":"variants","n":12,"atm":"drill"},{"type":"go","ws":"base"},{"type":"rm -rf","x":1},{"type":"go","ws":"admin"},{"type":"studio","text":"808 più lungo"}]';
  const r = C.parseReply(raw, ['drill', 'trap']);
  assert.equal(r.reply, 'Ti faccio 12 basi drill scure.');
  assert.deepEqual(r.actions, [{ type: 'variants', n: 12, atm: 'drill' }, { type: 'go', ws: 'base' }, { type: 'studio', text: '808 più lungo' }]);
});

test('parseReply: numeri fuori misura e atmosfera inventata corretti; JSON rotto ignorato; think tolto', () => {
  assert.deepEqual(C.parseReply('ok\nAZIONI: [{"type":"variants","n":500,"atm":"inventata"}]', ['drill']).actions, [{ type: 'variants', n: 24, atm: null }]);
  const r = C.parseReply('Risposta\nAZIONI: [rotto', []); assert.equal(r.actions.length, 0); assert.match(r.reply, /Risposta/);
  assert.equal(C.parseReply('<think>ragiono</think>Ciao!').reply, 'Ciao!');
  assert.equal(C.parseReply('Solo una domanda, niente azioni.').actions.length, 0);
});

test('ask: chiama Groq con la chiave solo nell\'intestazione e restituisce risposta e azioni', async () => {
  const spy = [];
  const f = fakeFetch(200, { model: 'openai/gpt-oss-120b', choices: [{ message: { content: 'Vai in Base.\nAZIONI: [{"type":"go","ws":"base"}]' } }] }, spy);
  const r = await C.ask('portami alla base', { page: 'testo' }, { provider: 'groq', key: 'gsk_' + 'x'.repeat(30), fetch: f, presetIds: [] });
  assert.equal(r.reply, 'Vai in Base.'); assert.deepEqual(r.actions, [{ type: 'go', ws: 'base' }]);
  assert.equal(spy[0].url, C.PROVIDERS.groq.url);
  assert.match(spy[0].init.headers.Authorization, /^Bearer gsk_/);
  const body = JSON.parse(spy[0].init.body); assert.equal(body.model, 'openai/gpt-oss-120b'); assert.equal(body.reasoning_effort, 'low');
  assert.ok(!spy[0].init.body.includes('gsk_'), 'la chiave non va nel corpo');
});

test('ask: errori tradotti in italiano (chiave, limite, rete) e niente chiave = errore chiaro', async () => {
  await assert.rejects(C.ask('x', {}, { provider: 'groq', key: '', fetch: fakeFetch(200, {}) }), /Manca la chiave/);
  await assert.rejects(C.ask('x', {}, { provider: 'groq', key: 'k', fetch: fakeFetch(401, '{}') }), /chiave non è valida/);
  await assert.rejects(C.ask('x', {}, { provider: 'openrouter', key: 'k', fetch: fakeFetch(429, '{}') }), /Limite gratuito/);
  await assert.rejects(C.ask('x', {}, { provider: 'groq', key: 'k', fetch: async () => { throw new TypeError('Failed to fetch'); } }), /collegarmi/);
  await assert.rejects(C.ask('x', {}, { provider: 'groq', key: 'k', fetch: fakeFetch(200, { choices: [{ message: { content: '' } }] }) }), /vuoto/);
});

test('ask: se Groq rifiuta reasoning_effort riprova senza', async () => {
  let n = 0; const bodies = [];
  const f = async (u, init) => { n++; bodies.push(JSON.parse(init.body)); if (n === 1) return { ok: false, status: 400, text: async () => '{"error":{"message":"unsupported parameter reasoning_effort"}}' }; return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'ok' } }] }) }; };
  const r = await C.ask('x', {}, { provider: 'groq', key: 'k', fetch: f });
  assert.equal(r.reply, 'ok'); assert.equal(n, 2); assert.ok(!('reasoning_effort' in bodies[1]));
});

test('impostazioni: chiave salvata per servizio, rimossa se vuota; ready solo se accesa', () => {
  const s = memStore();
  assert.equal(C.ready(C.getCfg(s)), false);
  C.setCfg({ provider: 'groq', key: 'gsk_abc', on: true }, s);
  let c = C.getCfg(s); assert.equal(c.key, 'gsk_abc'); assert.equal(C.ready(c), true);
  C.setCfg({ provider: 'groq', key: '', on: true }, s); assert.equal(C.getCfg(s).key, '');
  C.setCfg({ provider: 'openrouter', key: 'sk-or-1', on: false }, s); c = C.getCfg(s); assert.equal(c.provider, 'openrouter'); assert.equal(C.ready(c), false);
  assert.ok(!JSON.stringify(JSON.parse(s._m['msa-cloudai'])).includes('sk-or'), 'la chiave non sta nelle impostazioni generali');
});

test('looksLikeKey: riconosce il formato delle chiavi', () => {
  assert.equal(C.looksLikeKey('groq', 'gsk_' + 'a'.repeat(40)), true);
  assert.equal(C.looksLikeKey('groq', 'sk-or-' + 'a'.repeat(40)), false);
  assert.equal(C.looksLikeKey('openrouter', 'sk-or-v1-' + 'a'.repeat(40)), true);
  assert.equal(C.looksLikeKey('groq', 'gsk_ con spazi dentro la chiave lunga'), false);
});
