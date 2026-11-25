'use strict';
const test = require('node:test'), assert = require('node:assert');
const A = require('../src/archive.js');
function fakeGitHub() {
  const store = { file: null, sha: 0, puts: 0 };
  const f = async (url, o) => {
    o = o || {}; const u = String(url);
    if (!/Bearer tok/.test((o.headers || {}).Authorization || '')) return { status: 401, ok: false, json: async () => ({}) };
    if (u.includes('/contents/')) {
      if (o.method === 'PUT') { const b = JSON.parse(o.body); if (store.file && b.sha !== String(store.sha)) return { status: 409, ok: false }; store.file = Buffer.from(b.content, 'base64').toString('utf8'); store.sha++; store.puts++; return { status: 200, ok: true, json: async () => ({}) }; }
      if (!store.file) return { status: 404, ok: false };
      return { status: 200, ok: true, json: async () => ({ sha: String(store.sha), content: Buffer.from(store.file).toString('base64') }) };
    }
    return { status: /nonesiste/.test(u) ? 404 : 200, ok: !/nonesiste/.test(u), json: async () => ({}) };
  };
  return { store, f };
}
const L = (id, bpm, vote) => ({ id, name: 'base ' + id, artist: 'Artista', prof: { bpm, kick: [0, 4, 8] }, vote: vote == null ? 1 : vote, at: 1000 + bpm });
const settings = () => ({ learned: [L('a', 140), L('b', 90, -1)], taste: { n: 5, up: 3, down: 2, g: { trap: 2 }, mode: {}, heavy: 1, bpm: [140], log: [] }, dnaSaved: [{ name: 'Notte', dna: { bpm: 100 }, at: 5 }], gv: { f0: 120, tune: 18 }, useLearned: true, learnW: 80, oneMode: 'dna' });

test('snapshot: solo numeri e schemi, nessun testo, niente token', () => {
  const st = settings(); st.lyrics = 'testo segreto'; st.token = 'tok-segreto'; st.learned[0].prof.nota = 'x';
  const s = A.snapshot(st), txt = JSON.stringify(s);
  assert.ok(!txt.includes('testo segreto') && !txt.includes('tok-segreto'));
  assert.strictEqual(s.learned.length, 2); assert.strictEqual(s.voice.f0, 120); assert.strictEqual(s.prefs.learnW, 80);
});
test('salva → cancella tutto → ricarica: i numeri tornano', async () => {
  const gh = fakeGitHub(), c = A.Client({ owner: 'sultan199777', repo: 'memoria', token: 'tok', fetch: gh.f });
  const r1 = await A.sync(settings(), c); assert.ok(r1.saved && r1.created); assert.strictEqual(gh.store.puts, 1);
  const vuoto = {}; const r2 = await A.sync(vuoto, c);
  assert.strictEqual(vuoto.learned.length, 2); assert.strictEqual(vuoto.learned[1].vote, -1); assert.strictEqual(vuoto.taste.n, 5); assert.strictEqual(vuoto.dnaSaved[0].name, 'Notte'); assert.strictEqual(vuoto.gv.f0, 120); assert.strictEqual(vuoto.oneMode, 'dna');
  assert.strictEqual(r2.addedFromArchive, 2); assert.strictEqual(r2.saved, false, 'niente di nuovo da salvare'); assert.strictEqual(gh.store.puts, 1);
});
test('due telefoni/computer: le basi nuove di entrambi si uniscono senza duplicati', async () => {
  const gh = fakeGitHub(), c = A.Client({ owner: 'o', repo: 'r', token: 'tok', fetch: gh.f });
  const tel = settings(), pc = { learned: [L('a', 140), L('c', 120)] };
  await A.sync(tel, c); await A.sync(pc, c); await A.sync(tel, c);
  const ids = x => x.learned.map(r => r.id).sort().join();
  assert.strictEqual(ids(pc), 'a,b,c'); assert.strictEqual(ids(tel), 'a,b,c');
});
test('errori in italiano: permesso sbagliato e repository inesistente', async () => {
  const gh = fakeGitHub();
  await assert.rejects(A.sync({}, A.Client({ owner: 'o', repo: 'r', token: 'sbagliato', fetch: gh.f })), /token.*non è valido/);
  await assert.rejects(A.sync({}, A.Client({ owner: 'o', repo: 'nonesiste', token: 'tok', fetch: gh.f })), /Repository non trovato/);
});
test('conflitto di salvataggio (409): riprova con la versione nuova', async () => {
  const gh = fakeGitHub(), c = A.Client({ owner: 'o', repo: 'r', token: 'tok', fetch: gh.f });
  await A.sync(settings(), c); const orig = c.get; let first = true;
  c.get = async () => { const r = await orig(); if (first) { first = false; gh.store.sha++; gh.store.file = JSON.stringify(Object.assign(JSON.parse(gh.store.file), { learned: [L('z', 150)].concat(JSON.parse(gh.store.file).learned) })); } return r; };
  const st = settings(); st.learned.push(L('n', 100)); const r = await A.sync(st, c); assert.ok(r.saved);
  assert.ok(JSON.parse(gh.store.file).learned.some(x => x.id === 'n'));
});
test('solo lettura: non scrive mai', async () => {
  const gh = fakeGitHub(), c = A.Client({ owner: 'o', repo: 'r', token: 'tok', fetch: gh.f }); await A.sync(settings(), c); const p = gh.store.puts;
  const st = settings(); st.learned.push(L('x', 99)); const r = await A.sync(st, c, { readOnly: true }); assert.strictEqual(gh.store.puts, p); assert.strictEqual(r.saved, false);
});
