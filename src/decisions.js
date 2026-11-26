/* Registro delle decisioni: cosa è stato applicato, annullato o scartato, in che contesto (genere, umore), e le soluzioni agli errori.
   Serve alla squadra per NON ripetere ciò che l'utente ha già annullato. Solo etichette e numeri: mai testi delle canzoni. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Decisions = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var KINDS = { applicato: 1, annullato: 1, approvato: 1, scartato: 1, errore: 1, soluzione: 1 }, MAX = 200;
  function clean(e) {
    if (!e || !KINDS[e.kind] || !e.key) return null;
    return { id: String(e.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6))), kind: e.kind, key: String(e.key).slice(0, 40), label: String(e.label || e.key).slice(0, 90), genre: String(e.genre || '').slice(0, 20), mood: String(e.mood || '').slice(0, 20), at: +e.at || Date.now() };
  }
  function add(list, e) { var c = clean(e); if (!c) return null; list.push(c); while (list.length > MAX) list.shift(); return c; }
  /* le più utili per un contesto: stesso genere/umore, le più recenti prima */
  function recall(list, ctx, n) {
    ctx = ctx || {};
    return list.map(function (e) { return { e: e, s: (e.genre && e.genre === ctx.genre ? 2 : 0) + (e.mood && e.mood === ctx.mood ? 1 : 0) + (e.key && e.key === ctx.key ? 2 : 0) + e.at / 1e15 }; })
      .filter(function (x) { return x.s >= 1; }).sort(function (a, b) { return b.s - a.s; }).slice(0, n || 5).map(function (x) { return x.e; });
  }
  /* true se l'utente ha già annullato/scartato questa stessa cosa almeno 2 volte nello stesso genere (e non l'ha poi tenuta) */
  function avoid(list, key, genre) {
    var no = 0, yes = 0; list.forEach(function (e) { if (e.key !== key || (genre && e.genre && e.genre !== genre)) return; if (e.kind === 'annullato' || e.kind === 'scartato') no++; else if (e.kind === 'approvato') yes++; });
    return no >= 2 && no > yes;
  }
  function summary(list) {
    if (!list.length) return 'Nessuna decisione registrata ancora.';
    var c = {}; list.forEach(function (e) { c[e.kind] = (c[e.kind] || 0) + 1; });
    return Object.keys(c).map(function (k) { return c[k] + ' ' + k; }).join(', ') + '.';
  }
  return { add: add, recall: recall, avoid: avoid, summary: summary, clean: clean, MAX: MAX };
});
