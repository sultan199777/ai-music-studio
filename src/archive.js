/*
 * ARCHIVIO ONLINE: la memoria dell'app (basi studiate, gusti ♥/✕, stili DNA salvati, voce) in un tuo repository PRIVATO su GitHub.
 * Salva SOLO numeri: niente audio, niente testi, niente nomi di file privati. Se cancelli i dati di Safari, li riprendi da lì.
 *  snapshot(settings) → {v,at,learned,taste,dnaSaved,voice,prefs}      merge(a,b) → unione senza duplicati
 *  apply(settings, snap) → rimette i dati nelle impostazioni              Client({owner,repo,token,fetch}) → get/put via API GitHub
 *  sync(settings, client) → legge l'archivio, unisce, salva se serve, aggiorna le impostazioni
 * Il permesso (token) resta solo nel telefono, mai dentro lo snapshot e mai nel codice.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Archive = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var PATH = 'memoria-sultan-sound.json', MAXL = 120;
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }
  /* tieni solo numeri/schemi: da ogni base studiata i numeri del profilo; il nome file si accorcia */
  function cleanLearned(r) {
    if (!r || !r.prof || typeof r.prof !== 'object') return null;
    return { id: String(r.id || ''), name: String(r.name || '').slice(0, 40), artist: String(r.artist || 'Senza cartella').slice(0, 30), prof: clone(r.prof), vote: r.vote > 0 ? 1 : (r.vote < 0 ? -1 : 0), at: num(r.at) || 0 };
  }
  function snapshot(st) {
    st = st || {}; var gv = st.gv || {};
    return {
      v: 1, at: Date.now(),
      learned: (Array.isArray(st.learned) ? st.learned : []).map(cleanLearned).filter(Boolean).slice(-MAXL),
      taste: st.taste ? clone(st.taste) : null,
      dnaSaved: (Array.isArray(st.dnaSaved) ? st.dnaSaved : []).filter(function (d) { return d && d.name && d.dna; }).map(function (d) { return { name: String(d.name).slice(0, 40), dna: clone(d.dna), at: num(d.at) || 0 }; }),
      decisions: (Array.isArray(st.decisions) ? st.decisions : []).map(function (e) { return { id: String(e.id || ''), kind: String(e.kind || ''), key: String(e.key || '').slice(0, 40), label: String(e.label || '').slice(0, 90), genre: String(e.genre || '').slice(0, 20), mood: String(e.mood || '').slice(0, 20), at: num(e.at) || 0 }; }).filter(function (e) { return e.id && e.kind && e.key; }).slice(-200),
      voice: { f0: num(gv.f0), lo: num(gv.lo), hi: num(gv.hi), tune: num(gv.tune) },
      prefs: { useLearned: st.useLearned !== false, learnW: num(+st.learnW) || 70, oneMode: st.oneMode === 'dna' ? 'dna' : 'auto' }
    };
  }
  function union(a, b, key, cap) {
    var seen = {}, out = []; (a || []).concat(b || []).forEach(function (x) { var k = key(x); if (!k || seen[k]) return; seen[k] = 1; out.push(x); });
    return cap ? out.slice(-cap) : out;
  }
  /* local ha la precedenza dove ci sono conflitti (i tuoi ultimi ♥/✕); le cose nuove dell'altro lato si aggiungono */
  function merge(local, remote) {
    if (!remote || remote.v !== 1) return clone(local);
    var out = clone(local);
    out.learned = union(local.learned, remote.learned, function (r) { return r.id || (r.name + '|' + r.at); }, MAXL);
    out.dnaSaved = union(local.dnaSaved, remote.dnaSaved, function (d) { return d.name + '|' + d.at; }, 60);
    out.decisions = union(local.decisions, remote.decisions, function (e) { return e.id; }, 200);
    var lt = local.taste && local.taste.n || 0, rt = remote.taste && remote.taste.n || 0; out.taste = rt > lt ? clone(remote.taste) : (local.taste ? clone(local.taste) : (remote.taste ? clone(remote.taste) : null));
    out.voice = { f0: local.voice && local.voice.f0 != null ? local.voice.f0 : remote.voice && remote.voice.f0, lo: local.voice && local.voice.lo || remote.voice && remote.voice.lo, hi: local.voice && local.voice.hi || remote.voice && remote.voice.hi, tune: local.voice && local.voice.tune != null ? local.voice.tune : remote.voice && remote.voice.tune };
    out.prefs = local.learned && local.learned.length ? local.prefs : (remote.prefs || local.prefs);
    return out;
  }
  function apply(st, snap) {
    if (!snap || snap.v !== 1) return st;
    st.learned = snap.learned.slice(); if (snap.taste) st.taste = clone(snap.taste); st.dnaSaved = snap.dnaSaved.slice(); st.decisions = (snap.decisions || []).slice();
    st.gv = st.gv || {}; ['f0', 'lo', 'hi', 'tune'].forEach(function (k) { if (snap.voice && snap.voice[k] != null) st.gv[k] = snap.voice[k]; });
    if (snap.prefs) { st.useLearned = snap.prefs.useLearned; st.learnW = snap.prefs.learnW; st.oneMode = snap.prefs.oneMode; }
    return st;
  }
  function b64(s) { return typeof Buffer !== 'undefined' ? Buffer.from(s, 'utf8').toString('base64') : btoa(unescape(encodeURIComponent(s))); }
  function unb64(s) { s = String(s || '').replace(/\s/g, ''); return typeof Buffer !== 'undefined' ? Buffer.from(s, 'base64').toString('utf8') : decodeURIComponent(escape(atob(s))); }
  function explain(status) {
    if (status === 401) return 'Il permesso (token) non è valido o è scaduto: creane uno nuovo.';
    if (status === 403) return 'Il permesso non basta: deve poter leggere e scrivere i «Contents» di questo repository.';
    if (status === 404) return 'Repository non trovato, oppure il permesso non lo include. Controlla il nome e che il permesso sia per questo repository.';
    if (status === 409 || status === 422) return 'Conflitto di salvataggio: riprovo con la versione più recente.';
    return 'Risposta inattesa da GitHub (' + status + ').';
  }
  function Client(o) {
    var f = o.fetch || (typeof fetch !== 'undefined' ? fetch.bind(typeof self !== 'undefined' ? self : this) : null), base = 'https://api.github.com/repos/' + encodeURIComponent(o.owner) + '/' + encodeURIComponent(o.repo) + '/contents/' + PATH;
    function H() { return { Authorization: 'Bearer ' + o.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }; }
    return {
      get: async function () {
        var r = await f(base + '?t=' + Date.now(), { headers: H(), cache: 'no-store' });
        if (r.status === 404) { /* repository raggiungibile ma file non ancora creato? distinguiamo con una chiamata al repo */
          var rr = await f('https://api.github.com/repos/' + encodeURIComponent(o.owner) + '/' + encodeURIComponent(o.repo), { headers: H() });
          if (rr.status === 200) return null; var e0 = new Error(explain(rr.status === 200 ? 404 : rr.status)); e0.status = rr.status; throw e0;
        }
        if (!r.ok) { var e = new Error(explain(r.status)); e.status = r.status; throw e; }
        var j = await r.json(); return { sha: j.sha, data: JSON.parse(unb64(j.content)) };
      },
      put: async function (data, sha) {
        var body = { message: 'Memoria Sultan Sound', content: b64(JSON.stringify(data)) }; if (sha) body.sha = sha;
        var r = await f(base, { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, H()), body: JSON.stringify(body) });
        if (!r.ok) { var e = new Error(explain(r.status)); e.status = r.status; throw e; }
        return true;
      }
    };
  }
  /* legge, unisce, salva se c'è qualcosa di nuovo, aggiorna le impostazioni. Riprova una volta in caso di conflitto. */
  async function sync(st, client, opt) {
    opt = opt || {}; var tries = 0;
    for (;;) {
      var remote = await client.get(), local = snapshot(st), merged = merge(local, remote && remote.data);
      var changedRemote = !remote || JSON.stringify(strip(merged)) !== JSON.stringify(strip(remote.data));
      try { if (changedRemote && !opt.readOnly) await client.put(merged, remote && remote.sha); }
      catch (e) { if ((e.status === 409 || e.status === 422) && ++tries < 2) continue; throw e; }
      var before = (st.learned || []).length; apply(st, merged);
      return { remoteLearned: remote && remote.data && remote.data.learned ? remote.data.learned.length : 0, learned: merged.learned.length, addedFromArchive: Math.max(0, merged.learned.length - before), saved: !!(changedRemote && !opt.readOnly), created: !remote };
    }
  }
  function strip(s) { var c = clone(s || {}); delete c.at; return c; }
  function hash(st) { return JSON.stringify(strip(snapshot(st))); }
  return { PATH: PATH, snapshot: snapshot, merge: merge, apply: apply, Client: Client, sync: sync, hash: hash, explain: explain };
});
