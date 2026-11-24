/*
 * Beat Lab - interfaccia mix e progetti (Tappa 4): effetti per traccia, master, misura del volume,
 * salvataggio dei progetti (IndexedDB), esportazione MIDI.
 */
(function (root) {
  'use strict';
  var UI = root.BeatLabUI, E = root.BeatEngine, M = root.BeatMix, MI = root.BeatMIDI, ST = root.BeatStore;
  if (!UI || !E || !M) return;
  var h = UI.h, S = UI.state, sel = null, card = null, status = null;

  function slider(label, min, max, step, val, fmt, on, id) {
    var out = h('b', { text: fmt(val) });
    var inp = h('input', { type: 'range', min: min, max: max, step: step, value: val, 'aria-label': label, id: id, oninput: function () { var v = +this.value; out.textContent = fmt(v); on(v); UI.changed('mix'); } });
    return h('label', { class: 'f bl-fxs' }, [h('span', {}, [label + ' ', out]), inp]);
  }
  var pc = function (v) { return Math.round(v * 100) + '%'; }, dbf = function (v) { return (v > 0 ? '+' : '') + v + ' dB'; };

  function fxPanel(t) {
    var f = E.fxOf(t), box = h('div', { class: 'bl-fx', id: 'bl-fx' });
    var isKick = t.kind === 'drum' && t.lane === 'kick';
    box.appendChild(h('p', { class: 'small', text: 'Effetti di: ' + t.name }));
    box.appendChild(slider('Bassi', -12, 12, 1, f.eq.low, dbf, function (v) { f.eq.low = v; }, 'bl-fx-low'));
    box.appendChild(slider('Medi', -12, 12, 1, f.eq.mid, dbf, function (v) { f.eq.mid = v; }, 'bl-fx-mid'));
    box.appendChild(slider('Acuti', -12, 12, 1, f.eq.high, dbf, function (v) { f.eq.high = v; }, 'bl-fx-high'));
    box.appendChild(slider('Saturazione (grinta)', 0, 1, 0.05, f.sat, pc, function (v) { f.sat = v; }, 'bl-fx-sat'));
    box.appendChild(slider('Compressore (colpi più uniformi)', 0, 1, 0.05, f.comp, pc, function (v) { f.comp = v; }, 'bl-fx-comp'));
    if (!isKick) box.appendChild(slider('Sidechain: si abbassa a ogni cassa', 0, 1, 0.05, f.sc, pc, function (v) { f.sc = v; }, 'bl-fx-sc'));
    box.appendChild(slider('Riverbero (stanza)', 0, 1, 0.05, f.rev, pc, function (v) { f.rev = v; }, 'bl-fx-rev'));
    box.appendChild(slider('Eco (delay)', 0, 1, 0.05, f.dly, pc, function (v) { f.dly = v; }, 'bl-fx-dly'));
    box.appendChild(h('p', { class: 'small muted', text: 'Il sidechain qui segue i colpi della cassa nel tempo (stesso risultato in ascolto e nel file, ma non "legge" il suono della cassa).' }));
    box.appendChild(h('button', { class: 'btn sm', type: 'button', id: 'bl-fx-preset', text: 'Valori di partenza per questo suono', onclick: function () { t.fx = M.presetFor(t); UI.changed('mix'); render(); } }));
    return box;
  }
  function loudBox() {
    var out = h('div', { id: 'bl-loud' }), btn = h('button', { class: 'btn', type: 'button', id: 'bl-measure', text: 'Misura il volume del beat', onclick: function () {
      out.innerHTML = ''; out.appendChild(h('p', { class: 'status', text: 'Misuro…' }));
      var p = JSON.parse(JSON.stringify(S.project)); (UI.preloadAll ? UI.preloadAll(p) : Promise.resolve()).then(function () { return E.renderOffline(p, { sampleRate: 44100, loops: 2, sampler: S.sampler }); }).then(function (r) {
        var m = M.loudness(r.chans, r.sr); out.innerHTML = '';
        out.appendChild(h('p', { class: 'small', id: 'bl-loudinfo', html: '<span class="tag m">Misurato</span> volume ' + (isFinite(m.lufs) ? m.lufs.toFixed(1) : '—') + ' LUFS · picco ' + m.peakDb.toFixed(1) + ' dBFS · picco reale (stima) ' + m.truePeakDb.toFixed(1) + ' dB' }));
        out.appendChild(h('p', { class: 'small', text: M.advice(m) }));
        out.appendChild(h('p', { class: 'small muted', text: 'Le piattaforme di streaming portano il volume vicino a -14 LUFS: non serve "spingere" oltre. Il picco reale è una stima, non uno strumento certificato.' }));
      }, function (e) { out.innerHTML = ''; out.appendChild(h('p', { class: 'status err', text: 'Misura non riuscita: ' + e.message })); });
    } });
    return h('div', {}, [btn, out]);
  }
  function download(name, bytes, type) { var url = root.URL.createObjectURL(new root.Blob([bytes], { type: type })); var a = h('a', { class: 'btn', href: url, download: name, id: 'bl-dl-midi' }, ['Scarica ' + name]); return a; }
  function projectsBox() {
    var box = h('div', { id: 'bl-projects' }), listEl = h('div', { id: 'bl-plist' }), msg = h('p', { class: 'small', id: 'bl-pmsg' });
    function say(t) { msg.textContent = t; }
    function refresh() { ST.list().then(function (a) { listEl.innerHTML = ''; if (!a.length) listEl.appendChild(h('p', { class: 'small muted', text: 'Nessun progetto salvato.' }));
      a.forEach(function (r) { listEl.appendChild(h('div', { class: 'row bl-prow', 'data-pid': r.id }, [h('span', { text: r.name + ' · ' + new Date(r.saved).toLocaleString('it-IT') }),
        h('button', { class: 'btn sm', type: 'button', text: 'Apri', 'data-open': r.id, onclick: function () { ST.load(r.id).then(function (p) { UI.snap(); S.project = p; if (S.player) { if (S.player.playing) S.player.stop(); S.player.project = p; S.player.mixChanged(); } UI.changed('mix'); UI.renderAll(); say('Aperto: ' + p.name); }, function (e) { say('Non riesco ad aprirlo: ' + e.message); }); } }),
        h('button', { class: 'btn sm danger', type: 'button', text: 'Cancella', 'data-del': r.id, onclick: function () { ST.remove(r.id).then(refresh); } })])); });
    }, function (e) { say('Elenco non disponibile: ' + (e && e.message)); }); }
    var nameIn = h('input', { type: 'text', id: 'bl-pname', maxlength: 60, value: S.project.name || 'Il mio beat', 'aria-label': 'Nome del progetto' });
    box.appendChild(h('div', { class: 'row' }, [nameIn, h('button', { class: 'btn pri', type: 'button', id: 'bl-psave', text: 'Salva progetto', onclick: function () { S.project.name = nameIn.value.trim() || 'Il mio beat'; ST.save(S.project).then(function () { say('Salvato nel telefono: ' + S.project.name); refresh(); }, function (e) { say('Salvataggio non riuscito: ' + (e && e.message)); }); } })]));
    box.appendChild(listEl); box.appendChild(msg);
    box.appendChild(h('p', { class: 'small muted', text: 'I progetti restano nel browser di questo dispositivo (non vanno online). Se cancelli i dati di Safari spariscono: esporta il MIDI o il WAV per tenerne una copia.' }));
    refresh(); return box;
  }
  function render() {
    var p = S.project; if (!card) { card = h('section', { class: 'card', id: 'bl-c-fx' }); var ex = root.document.getElementById('bl-c-export'); if (ex && ex.parentNode) ex.parentNode.insertBefore(card, ex); else return; }
    card.innerHTML = ''; card.appendChild(h('div', { class: 'card-head' }, [h('h3', { text: '8. Effetti, master e progetti' })]));
    card.appendChild(h('p', { class: 'small muted', text: 'Tutti i valori sono punti di partenza da regolare a orecchio, non regole.' }));
    if (!sel || !p.tracks.some(function (t) { return t.id === sel; })) sel = p.tracks[0] && p.tracks[0].id;
    var picker = h('select', { id: 'bl-fx-track', 'aria-label': 'Traccia da rifinire', onchange: function () { sel = this.value; render(); } });
    p.tracks.forEach(function (t) { var o = h('option', { value: t.id, text: t.name }); if (t.id === sel) o.selected = true; picker.appendChild(o); });
    card.appendChild(h('label', { class: 'f' }, [h('span', { text: 'Traccia' }), picker]));
    var t = E.trackById(p, sel); if (t) card.appendChild(fxPanel(t));
    card.appendChild(h('div', { class: 'row' }, [h('button', { class: 'btn sm', type: 'button', id: 'bl-fx-all', text: 'Valori di partenza su tutte le tracce', onclick: function () { UI.snap(); M.applyPresets(S.project); UI.changed('mix'); render(); } }), h('button', { class: 'btn sm', type: 'button', id: 'bl-fx-off', text: 'Spegni tutti gli effetti', onclick: function () { UI.snap(); M.resetFx(S.project); UI.changed('mix'); render(); } })]));
    var mm = E.masterOf(p);
    card.appendChild(h('h4', { text: 'Master' }));
    card.appendChild(slider('Collante (compressione leggera sul totale)', 0, 1, 0.05, mm.glue, pc, function (v) { mm.glue = v; }, 'bl-m-glue'));
    card.appendChild(slider('Tetto del limiter', -6, 0, 0.5, mm.ceil, function (v) { return v + ' dB'; }, function (v) { mm.ceil = v; }, 'bl-m-ceil'));
    card.appendChild(slider('Riverbero: grandezza della stanza', 0.5, 4, 0.1, mm.revSize, function (v) { return v.toFixed(1) + ' s'; }, function (v) { mm.revSize = v; }, 'bl-m-rev'));
    card.appendChild(slider('Eco: ripetizioni', 0, 0.8, 0.05, mm.dlyFb, pc, function (v) { mm.dlyFb = v; }, 'bl-m-fb'));
    card.appendChild(h('label', { class: 'f' }, [h('span', { text: 'Eco: distanza' }), (function () { var s = h('select', { id: 'bl-m-div', onchange: function () { mm.dlyDiv = +this.value; UI.changed('mix'); } }); [['0', 'un quarto'], ['1', 'un quarto puntato'], ['2', 'un ottavo']].forEach(function (o) { var op = h('option', { value: o[0], text: o[1] }); if (+o[0] === (mm.dlyDiv | 0)) op.selected = true; s.appendChild(op); }); return s; })()]));
    card.appendChild(h('p', { class: 'small muted', text: 'Il limiter ferma i picchi sotto il tetto (-1 dB è un punto di partenza sicuro per le piattaforme).' }));
    card.appendChild(loudBox());
    card.appendChild(h('h4', { text: 'MIDI' }));
    var mo = h('div', { id: 'bl-midiout' });
    card.appendChild(h('button', { class: 'btn', type: 'button', id: 'bl-midi', text: 'Crea il file MIDI', onclick: function () { try { var u8 = MI.toMidi(S.project); mo.innerHTML = ''; mo.appendChild(download((S.project.name || 'beat').replace(/[^\w\-]+/g, '_') + '.mid', u8, 'audio/midi')); mo.appendChild(h('p', { class: 'small muted', text: 'Il MIDI contiene le note e i colpi (non i suoni): lo apri in qualsiasi programma musicale. Batteria sul canale 10.' })); } catch (e) { mo.textContent = 'MIDI non riuscito: ' + e.message; } } }));
    card.appendChild(mo);
    card.appendChild(h('h4', { text: 'Progetti' }));
    card.appendChild(ST ? projectsBox() : h('p', { class: 'small', text: 'Salvataggio non disponibile.' }));
  }
  UI.extend(render);
})(typeof self !== 'undefined' ? self : this);
