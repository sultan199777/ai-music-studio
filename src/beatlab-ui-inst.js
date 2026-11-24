/*
 * Beat Lab - interfaccia degli strumenti (Tappa 2): elenco per gruppi, "Ascolta", "Aggiungi traccia",
 * scelta dello strumento di una traccia, caricamento dei campioni a richiesta con stato visibile.
 */
(function (root) {
  'use strict';
  var UI = root.BeatLabUI, E = root.BeatEngine, P = root.BeatPatterns, SM = root.BeatSampler;
  if (!UI || !E || !SM) return;
  var h = UI.h, S = UI.state, V = E.Voices;
  var started = false, progress = {}, openG = null;

  function sampler() { return S.sampler; }
  function sampled(id) { var c = SM.CATALOG[id]; return !!(c && !c.synthOnly); }
  function stateText(id) {
    var sp = sampler();
    if (!sampled(id)) return ['synth', 'sintetizzatore'];
    if (!sp || !sp.available) return ['synth', 'sintetizzatore (campioni non disponibili)'];
    var st = sp.state(id);
    if (st === 'pronto') return ['ok', 'suono vero · pronto'];
    if (st === 'in caricamento') return ['soon', 'carico… ' + Math.round((progress[id] || 0) * 100) + '%'];
    if (st === 'errore') return ['bad', 'errore: uso il sintetizzatore'];
    return ['info', 'suono vero · si scarica quando serve'];
  }
  function usedInstruments(p) { var o = []; p.tracks.forEach(function (t) { if (t.kind === 'inst' && sampled(t.inst) && o.indexOf(t.inst) < 0) o.push(t.inst); }); return o; }

  // carica i campioni di uno strumento (se ci sono); aggiorna l'elenco mentre scarica
  function ensure(id) {
    var sp = sampler(); if (!sampled(id) || !sp) return Promise.resolve(false);
    return sp.init().then(function (ok) {
      if (!ok || !sp.isKnown(id)) return false;
      if (sp.has(id)) return true;
      progress[id] = 0; refreshStates();
      return sp.load(id, function (f) { progress[id] = f; refreshStates(); }).then(function (r) { sp.trim(usedInstruments(S.project).concat([id])); refreshStates(); return r; });
    });
  }
  function refreshStates() {
    var els = root.document.querySelectorAll('[data-inst-state]');
    for (var i = 0; i < els.length; i++) { var id = els[i].getAttribute('data-inst-state'), st = stateText(id); els[i].textContent = st[1]; els[i].className = 'tag ' + st[0]; }
    var st2 = root.document.getElementById('bl-samplestatus'); if (st2) st2.textContent = statusLine();
  }
  function statusLine() {
    var sp = sampler();
    if (!sp) return 'Campioni non disponibili: suono con i sintetizzatori.';
    if (!sp.initP) return 'Controllo i campioni…';
    if (!sp.available) return 'Campioni non disponibili in questa versione (' + (sp.error || 'file non trovati') + '). Gli strumenti suonano con i sintetizzatori del programma, che funzionano sempre.';
    var m = sp.manifest; return 'Suoni veri disponibili (' + Object.keys(m.instruments).length + ' strumenti, circa ' + (m.total_bytes / 1048576).toFixed(0) + ' MB in tutto, liberi CC0). Si scaricano solo quando scegli uno strumento.';
  }

  function listen(id, btn) {
    var p = S.project;
    btn.disabled = true; var old = btn.textContent; btn.textContent = '…';
    ensure(id).then(function () {
      var dur = S.player.preview(id, P.demoNotes(id, p.key, 2), p.bpm);
      btn.textContent = 'Suona…'; setTimeout(function () { btn.disabled = false; btn.textContent = old; }, Math.min(6000, dur * 1000));
    }, function () { btn.disabled = false; btn.textContent = old; });
  }
  function addTrack(id) {
    var p = S.project, I = V.INSTRUMENTS[id]; if (!I) return;
    UI.snap(); var t = E.newInstTrack(id, I.name); t.notes = P.demoNotes(id, p.key, p.bars); p.tracks.push(t);
    UI.changed('mix'); UI.renderAll(); ensure(id);
  }

  /* ---- controlli della traccia nel mixer ---- */
  function instOptions(sel, current) {
    var list = SM.instrumentList(), groups = {}, order = [];
    list.forEach(function (x) { if (!groups[x.group]) { groups[x.group] = []; order.push(x.group); } groups[x.group].push(x); });
    order.forEach(function (g) { var og = h('optgroup', { label: g }); groups[g].forEach(function (x) { var o = h('option', { value: x.id, text: x.name }); if (x.id === current) o.selected = true; og.appendChild(o); }); sel.appendChild(og); });
  }
  UI.instControls = function (t) {
    var sel = h('select', { 'aria-label': 'Strumento della traccia ' + t.name, 'data-track-inst': t.id, onchange: function () {
      var id = this.value, I = V.INSTRUMENTS[id]; if (!I) return; t.inst = id; t.name = I.name; if (S.player.G && S.player.G.voices[t.id]) { try { S.player.G.voices[t.id].stop(S.player.ctx.currentTime); } catch (e) {} delete S.player.G.voices[t.id]; } UI.changed('mix'); UI.renderAll(); ensure(id);
    } });
    instOptions(sel, t.inst);
    var st = stateText(t.inst), tag = h('span', { class: 'tag ' + st[0], 'data-inst-state': t.inst, text: st[1] });
    var del = h('button', { type: 'button', class: 'btn sm danger', 'aria-label': 'Rimuovi ' + t.name, text: 'Rimuovi traccia', onclick: function () { UI.snap(); var p = S.project; p.tracks = p.tracks.filter(function (x) { return x !== t; }); UI.changed('mix'); UI.renderAll(); } });
    return h('div', { class: 'bl-instrow' }, [sel, tag, del]);
  };
  UI.ensureInst = ensure;
  UI.preloadAll = function (p) {
    var jobs = usedInstruments(p).map(ensure);
    if (E.KITS[p.kit] && E.KITS[p.kit].remote && sampler()) jobs.push(sampler().loadKit(p.kit));
    return Promise.all(jobs);
  };
  UI.loadKit = function (id) {
    var sp = sampler(); if (!sp) return Promise.resolve(false); var st = root.document.getElementById('bl-status'); if (st) st.textContent = 'Carico i suoni della batteria…';
    return sp.loadKit(id).then(function (ok) { var s2 = root.document.getElementById('bl-status'); if (s2) s2.textContent = ok ? '' : 'Kit non caricato: suono con il kit sintetico.'; return ok; });
  };

  /* ---- scheda "Strumenti" ---- */
  function render() {
    var box = S.el.extra; if (!box) return; box.innerHTML = '';
    var card = h('section', { class: 'card', id: 'bl-c-inst' });
    card.appendChild(h('div', { class: 'card-head' }, [h('h3', { text: '7. Strumenti' })]));
    card.appendChild(h('p', { class: 'small', id: 'bl-samplestatus', text: statusLine() }));
    var groups = {}, order = [];
    SM.instrumentList().forEach(function (x) { if (!groups[x.group]) { groups[x.group] = []; order.push(x.group); } groups[x.group].push(x); });
    var pref = ['Bassi', 'Tastiere', 'Corde', 'Archi', 'Ottoni', 'Fiati', 'Mallet', 'Sintetizzatori'];
    order.sort(function (a, b) { return (pref.indexOf(a) + 1 || 99) - (pref.indexOf(b) + 1 || 99); });
    order.forEach(function (g, gi) {
      if (!openG) openG = { Bassi: true };
      var det = h('details', { class: 'bl-grp', open: !!openG[g] }, [h('summary', { text: g + ' (' + groups[g].length + ')' })]);
      det.addEventListener('toggle', function () { openG[g] = det.open; });
      groups[g].forEach(function (x) {
        var c = SM.CATALOG[x.id], st = stateText(x.id), desc = c ? c.desc : (SYNTH_DESC[x.id] || '');
        var listenBtn = h('button', { class: 'btn sm', type: 'button', text: 'Ascolta', 'aria-label': 'Ascolta ' + x.name, 'data-listen': x.id });
        listenBtn.addEventListener('click', function () { listen(x.id, listenBtn); });
        det.appendChild(h('div', { class: 'bl-inst', 'data-inst': x.id }, [
          h('div', { class: 'bl-instinfo' }, [h('b', { text: x.name }), h('span', { class: 'tag ' + st[0], 'data-inst-state': x.id, text: st[1] }), h('small', { text: desc })]),
          h('div', { class: 'bl-instbtn' }, [listenBtn, h('button', { class: 'btn sm', type: 'button', text: '+ Traccia', 'aria-label': 'Aggiungi ' + x.name + ' alla base', 'data-add': x.id, onclick: function () { addTrack(x.id); } })])
        ]));
      });
      card.appendChild(det);
    });
    card.appendChild(h('p', { class: 'small muted', text: '"Ascolta" suona una frase di prova nella tonalità del tuo beat. "+ Traccia" la aggiunge alla base come punto di partenza (la modifichi dopo con il piano roll).' }));
    box.appendChild(card);
  }
  var SYNTH_DESC = {
    sub808: '808 costruito dal programma: sinusoide con scivolata e saturazione. Si sente anche su casse piccole.', sub: 'Basso pulito e profondo, senza coda lunga.',
    pad: 'Tappeto lento: riempie lo spazio sotto la melodia.', lead: 'Suono acuto e deciso per la melodia principale.', pluck: 'Nota corta e secca, tipo corda pizzicata sintetica.',
    fm: 'Suono "elettrico" brillante tipo campana o piano elettrico.', choir: '"Aah" sintetico: atmosfere ampie.', brass: 'Ottone sintetico: colpi pieni.', strings: 'Archi sintetici: tappeti lunghi.'
  };

  UI.extend(function () {
    if (!S.sampler) S.sampler = new SM.Sampler({ base: 'samples/' });
    if (!started) {
      started = true;
      S.sampler.init().then(function (ok) {
        if (ok && S.sampler.manifest.kits) Object.keys(S.sampler.manifest.kits).forEach(function (k) { E.KITS[k] = { name: S.sampler.manifest.kits[k].name, remote: true }; });
        if (S.player) S.player.sampler = S.sampler; if (S.player && S.player.G) S.player.G.sampler = S.sampler;
        UI.renderAll(); if (ok) UI.preloadAll(S.project).then(refreshStates);
      });
    }
    if (S.player) { S.player.sampler = S.sampler; if (S.player.G) S.player.G.sampler = S.sampler; }
    render();
  });
})(typeof self !== 'undefined' ? self : this);
