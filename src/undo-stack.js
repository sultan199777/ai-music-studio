/* Pila unica di annulla (storico) delle modifiche: ogni agente prima di cambiare qualcosa fa push(chi, cosa); undo() rimette lo stato com'era.
   get() restituisce lo stato da salvare (copia), set(stato) lo rimette. Le copie sono JSON: niente riferimenti condivisi. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.UndoStack = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function create(get, set, limit) {
    var st = [], max = limit || 30;
    return {
      push: function (who, label, meta) { st.push({ who: String(who), label: String(label).slice(0, 120), meta: meta || null, at: Date.now(), snap: JSON.stringify(get()) }); if (st.length > max) st.shift(); return st.length; },
      undo: function () { if (!st.length) return null; var e = st.pop(); set(JSON.parse(e.snap)); return { who: e.who, label: e.label, meta: e.meta, at: e.at }; },
      drop: function () { st.pop(); },
      list: function () { return st.map(function (e) { return { who: e.who, label: e.label, at: e.at }; }); },
      size: function () { return st.length; },
      clear: function () { st.length = 0; }
    };
  }
  return { create: create };
});
