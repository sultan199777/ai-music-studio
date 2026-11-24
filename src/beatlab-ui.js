/*
 * Beat Lab - interfaccia (touch, italiano). Costruita senza librerie.
 * Si apre da #beatlab. mount(elemento) disegna tutto; unmount() ferma il suono.
 * Le sezioni sono funzioni separate (render*) e ognuna ridisegna solo la sua parte.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.BeatLabUI = factory(root);
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var E = root.BeatEngine, P = root.BeatPatterns;
  var doc = root.document;

  function h(tag, attrs, kids) {
    var e = doc.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k]; else if (k === 'text') e.textContent = attrs[k]; else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]); else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
    return e;
  }
  function icon(id) { var s = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'), u = doc.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#' + id); s.appendChild(u); return s; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  var KEY = 'beatlab.project.v1';
  var S = { sampler: null, project: null, player: null, root: null, mode: 'note', bar: 0, undo: [], curStep: -1, raf: 0, el: {}, mounted: false, lastExport: null, ext: [] };

  function save() { try { root.localStorage.setItem(KEY, JSON.stringify(S.project)); } catch (e) {} }
  function loadSaved() { try { var j = root.localStorage.getItem(KEY); if (j) { var p = JSON.parse(j); if (p && p.v === 1 && Array.isArray(p.tracks)) return p; } } catch (e) {} return null; }
  function snap() { S.undo.push(JSON.stringify(S.project)); if (S.undo.length > 12) S.undo.shift(); if (S.el.undo) S.el.undo.disabled = false; }
  function changed(what) { save(); if (S.player) { S.player.project = S.project; if (what === 'mix') S.player.mixChanged(); } }

  /* ---------- pezzi di interfaccia ---------- */
  function seg(options, value, onPick, cls) {
    var box = h('div', { class: 'seg ' + (cls || '') });
    options.forEach(function (o) { var b = h('button', { type: 'button', text: o[1], 'data-v': o[0], class: String(o[0]) === String(value) ? 'on' : '', onclick: function () { onPick(o[0]); } }); box.appendChild(b); });
    return box;
  }
  function hint(text) { return h('p', { class: 'small muted', text: text }); }

  /* ----- trasporto ----- */
  function renderTransport() {
    var p = S.project, el = S.el.transport, bar = S.el.bar; el.innerHTML = ''; bar.innerHTML = '';
    var play = h('button', { class: 'btn pri', type: 'button', id: 'bl-play', 'aria-label': 'Suona o ferma', onclick: togglePlay }, [icon(S.player && S.player.playing ? 'i-stop' : 'i-play'), S.player && S.player.playing ? 'Ferma' : 'Suona']);
    var bpm = h('input', { type: 'number', id: 'bl-bpm', min: 50, max: 220, value: p.bpm, 'aria-label': 'Battiti al minuto', onchange: function () { setBpm(this.value); } });
    var minus = h('button', { class: 'btn sm', type: 'button', text: '−', 'aria-label': 'Più lento', onclick: function () { setBpm(S.project.bpm - 1); } });
    var plus = h('button', { class: 'btn sm', type: 'button', text: '+', 'aria-label': 'Più veloce', onclick: function () { setBpm(S.project.bpm + 1); } });
    var tap = h('button', { class: 'btn sm', type: 'button', text: 'Tocca il tempo', id: 'bl-tap', onclick: tapTempo });
    var swing = h('input', { type: 'range', id: 'bl-swing', min: 50, max: 75, step: 1, value: p.swing, oninput: function () { S.project.swing = +this.value; S.el.swingv.textContent = swingLabel(+this.value); changed(); } });
    S.el.swingv = h('b', { text: swingLabel(p.swing) });
    bar.appendChild(h('div', { class: 'row bl-trow' }, [play, h('div', { class: 'bl-bpm' }, [minus, bpm, plus]), h('span', { class: 'small muted', text: 'BPM' })]));
    el.appendChild(h('div', { class: 'row' }, [tap]));
    el.appendChild(h('label', { class: 'f' }, [h('span', {}, ['Swing (ritmo dondolato) ', S.el.swingv]), swing]));
    el.appendChild(hint('BPM = battiti al minuto. Trap 130-160, drill 138-150, boom bap 82-98. Swing: 50% dritto, 66% terzina "dondolante" (boom bap).'));
  }
  function swingLabel(v) { return v + '%' + (v <= 50 ? ' dritto' : (v >= 64 && v <= 68 ? ' terzina' : '')); }
  function setBpm(v) { v = clamp(Math.round(+v || 120), 50, 220); S.project.bpm = v; var i = doc.getElementById('bl-bpm'); if (i) i.value = v; changed('mix'); }
  var taps = [];
  function tapTempo() {
    var now = Date.now(); if (taps.length && now - taps[taps.length - 1] > 2000) taps = []; taps.push(now); if (taps.length > 6) taps.shift();
    if (taps.length >= 3) { var d = []; for (var i = 1; i < taps.length; i++) d.push(taps[i] - taps[i - 1]); var avg = d.reduce(function (a, b) { return a + b; }, 0) / d.length; setBpm(60000 / avg); }
  }
  function togglePlay() {
    var pl = S.player;
    if (pl.playing) { pl.stop(); stopLoops(); renderTransport(); return; }
    snapAudioStart();
  }
  function snapAudioStart() {
    var pl = S.player; pl.project = S.project;
    try { var r = pl.play(); (r && r.then ? r : Promise.resolve()).then(function () { startLoops(); renderTransport(); }); setStatus(''); }
    catch (e) { setStatus('Non riesco ad avviare l\'audio: ' + e.message, true); }
  }
  function setStatus(t, bad) { if (S.el.status) { S.el.status.textContent = t; S.el.status.className = 'status' + (bad ? ' err' : ''); } }

  /* ----- stile ----- */
  function renderStyle() {
    var p = S.project, el = S.el.style; el.innerHTML = '';
    var chips = h('div', { class: 'chips' });
    P.STYLE_IDS.forEach(function (id) { chips.appendChild(h('button', { type: 'button', class: 'chip' + (p.style === id ? ' on' : ''), 'data-style': id, text: P.STYLES[id].name, onclick: function () { pickStyle(id); } })); });
    el.appendChild(chips);
    el.appendChild(h('p', { class: 'small', id: 'bl-styledesc', text: (P.STYLES[p.style] || {}).desc || '' }));
    var row = h('div', { class: 'row' }, [
      h('button', { class: 'btn', type: 'button', id: 'bl-rand', onclick: randomBeat }, [icon('i-spark'), 'Casuale ma sensato']),
      S.el.undo = h('button', { class: 'btn', type: 'button', id: 'bl-undo', text: 'Annulla', disabled: !S.undo.length, onclick: undo })
    ]);
    el.appendChild(row);
    el.appendChild(hint('Scegli uno stile per partire da un disegno di batteria e basso già pronto (originale, non copiato da brani). "Casuale ma sensato" ne inventa uno nuovo restando dentro le regole dello stile: rullante al posto giusto, casse mai attaccate, rullate solo a fine battuta. I valori sono punti di partenza: giudica a orecchio.'));
  }
  function pickStyle(id) { snap(); P.applyStyle(S.project, id); afterPatternChange(true); }
  function randomBeat() { snap(); P.randomize(S.project, S.project.style, Math.floor(Math.random() * 1e9), { keepBpm: false }); afterPatternChange(true); }
  function undo() { if (!S.undo.length) return; S.project = JSON.parse(S.undo.pop()); if (S.player) S.player.project = S.project; afterPatternChange(true); if (S.el.undo) S.el.undo.disabled = !S.undo.length; }
  function afterPatternChange(all) { changed('mix'); if (all) renderAll(); else renderGrid(); }

  /* ----- drum machine ----- */
  function velClass(v) { return v >= 100 ? 'v3' : (v >= 60 ? 'v2' : 'v1'); }
  function renderDrumHead() {
    var p = S.project, el = S.el.drumhead; el.innerHTML = '';
    var kits = Object.keys(E.KITS).map(function (k) { return [k, E.KITS[k].name]; });
    var sel = h('select', { id: 'bl-kit', 'aria-label': 'Kit di batteria', onchange: function () { S.project.kit = this.value; changed(); if (E.KITS[this.value] && E.KITS[this.value].remote && UI.loadKit) UI.loadKit(this.value); } });
    kits.forEach(function (k) { var o = h('option', { value: k[0], text: k[1] }); if (k[0] === p.kit) o.selected = true; sel.appendChild(o); });
    el.appendChild(h('div', { class: 'grid2' }, [
      h('label', { class: 'f' }, [h('span', { text: 'Suoni della batteria' }), sel]),
      h('label', { class: 'f' }, [h('span', { text: 'Lunghezza' }), (function () {
        var s2 = h('select', { id: 'bl-len', onchange: function () { var v = this.value.split('x'); snap(); E.resize(S.project, +v[0], +v[1]); S.bar = 0; afterPatternChange(true); } });
        [[1, 16], [2, 16], [4, 16], [1, 32], [2, 32], [4, 32]].forEach(function (c) { var o = h('option', { value: c[0] + 'x' + c[1], text: c[0] + (c[0] === 1 ? ' battuta' : ' battute') + ' · ' + c[1] + ' passi' }); if (c[0] === p.bars && c[1] === p.res) o.selected = true; s2.appendChild(o); }); return s2; })()])
    ]));
    el.appendChild(h('div', { class: 'bl-modes' }, [
      seg([['note', 'Note'], ['forza', 'Forza'], ['rullata', 'Rullata'], ['cancella', 'Cancella']], S.mode, function (m) { S.mode = m; renderDrumHead(); renderGrid(); }, 'bl-modeseg'),
    ]));
    el.appendChild(hint({
      note: 'Tocca un quadrato per mettere o togliere un colpo. Il quadrato più pieno = colpo più forte.',
      forza: 'Trascina un colpo su e giù per cambiare la forza (velocity). Un colpo debole fra due forti dà groove.',
      rullata: 'Tocca un colpo più volte: ×2 = due colpi veloci (1/32), ×3 = terzina, ×4 = quattro colpi. Funziona su tutte le righe, di solito sull\'hi-hat.',
      cancella: 'Tocca un colpo per cancellarlo. "Svuota riga" qui sotto cancella tutta la riga.'
    }[S.mode]));
    if (p.bars > 1) el.appendChild(seg(Array.apply(null, Array(p.bars)).map(function (_, i) { return [i, 'Battuta ' + (i + 1)]; }).concat([[-1, 'Tutte']]), S.bar, function (b) { S.bar = b; renderDrumHead(); renderGrid(); }, 'bl-barseg'));
  }
  function renderGrid() {
    var p = S.project, el = S.el.grid; el.innerHTML = '';
    var res = p.res, bars = S.bar < 0 ? p.bars : 1, first = S.bar < 0 ? 0 : S.bar, cols = bars * res;
    var wrap = h('div', { class: 'bl-gridwrap' }), grid = h('div', { class: 'bl-grid', style: '--cols:' + cols + ';--cw:' + (res === 32 ? 26 : 34) + 'px' });
    E.drumTracks(p).forEach(function (t) {
      var lab = h('div', { class: 'bl-lab' }, [h('b', { text: t.name }), h('button', { type: 'button', class: 'bl-clr', text: 'Svuota', 'aria-label': 'Svuota ' + t.name, onclick: function () { snap(); t.steps = t.steps.map(function () { return 0; }); t.roll = t.roll.map(function () { return 0; }); afterPatternChange(false); } })]);
      var rowEl = h('div', { class: 'bl-row', 'data-track': t.id });
      for (var c = 0; c < cols; c++) {
        var i = first * res + c, v = t.steps[i] || 0, beat = (c % res) % (res / 4) === 0;
        var cell = h('button', { type: 'button', class: 'bl-cell' + (v ? ' on ' + velClass(v) : '') + (beat ? ' beat' : '') + (((c % res) / (res / 4) | 0) % 2 ? ' alt' : ''), 'data-i': i, 'data-t': t.id, 'aria-label': t.name + ' passo ' + (c % res + 1) + (v ? ', forza ' + v : ', vuoto') });
        if (v) { cell.appendChild(h('i', { style: 'height:' + Math.round(20 + 80 * v / 127) + '%' })); if (t.roll[i]) cell.appendChild(h('em', { text: '×' + t.roll[i] })); }
        rowEl.appendChild(cell);
      }
      grid.appendChild(h('div', { class: 'bl-line' }, [lab, rowEl]));
    });
    wrap.appendChild(grid); el.appendChild(wrap);
    bindGrid(grid); S.curStep = -1;
  }
  function bindGrid(grid) {
    var drag = null;
    function find(e) { var c = e.target.closest ? e.target.closest('.bl-cell') : null; return c; }
    grid.addEventListener('click', function (ev) {
      var c = find(ev); if (!c || S.mode === 'forza') return;
      var t = E.trackById(S.project, c.getAttribute('data-t')), i = +c.getAttribute('data-i'); if (!t) return;
      snap();
      if (S.mode === 'cancella') { t.steps[i] = 0; t.roll[i] = 0; }
      else if (S.mode === 'rullata') { if (!t.steps[i]) t.steps[i] = 90; var k = E.ROLLS.indexOf(t.roll[i] || 0); t.roll[i] = E.ROLLS[(k + 1) % E.ROLLS.length]; }
      else { if (t.steps[i]) { t.steps[i] = 0; t.roll[i] = 0; } else { t.steps[i] = t.lane === 'hat' ? 85 : 105; if (S.player) S.player.audition(t.id, null, t.steps[i]); } }
      afterPatternChange(false);
    });
    grid.addEventListener('pointerdown', function (ev) {
      if (S.mode !== 'forza') return; var c = find(ev); if (!c) return;
      var t = E.trackById(S.project, c.getAttribute('data-t')), i = +c.getAttribute('data-i');
      if (!t.steps[i]) { snap(); t.steps[i] = 100; afterPatternChange(false); c = grid.querySelector('.bl-cell[data-t="' + t.id + '"][data-i="' + i + '"]'); }
      else snap();
      drag = { t: t, i: i, y: ev.clientY, v: t.steps[i], cell: c, moved: false }; try { c.setPointerCapture(ev.pointerId); } catch (e) {} ev.preventDefault();
    });
    grid.addEventListener('pointermove', function (ev) {
      if (!drag) return; var dy = drag.y - ev.clientY; if (Math.abs(dy) > 3) drag.moved = true;
      var v = clamp(Math.round(drag.v + dy * 1.6), 1, 127); drag.t.steps[drag.i] = v;
      var cell = drag.cell, inner = cell.querySelector('i'); if (inner) inner.style.height = Math.round(20 + 80 * v / 127) + '%'; cell.className = cell.className.replace(/ v[123]/, '') + ' ' + velClass(v); ev.preventDefault();
    });
    function end() { if (!drag) return; var d = drag; drag = null; if (S.player) S.player.audition(d.t.id, null, d.t.steps[d.i]); changed(); }
    grid.addEventListener('pointerup', end); grid.addEventListener('pointercancel', end);
  }
  // evidenzia il passo che sta suonando
  function setCursor(tick) {
    if (tick == null) { clearCursor(); return; }
    var p = S.project, stepT = E.BAR / p.res, idx = Math.floor(tick / stepT), bar = Math.floor(idx / p.res);
    if (S.bar >= 0 && bar !== S.bar) { clearCursor(); return; }
    var col = (S.bar < 0 ? idx : idx % p.res);
    if (col === S.curStep) return; clearCursor(); S.curStep = col;
    var rows = S.el.grid.querySelectorAll('.bl-row'); for (var r = 0; r < rows.length; r++) { var c = rows[r].children[col]; if (c) c.classList.add('now'); }
  }
  function clearCursor() { if (S.curStep < 0) return; var n = S.el.grid.querySelectorAll('.now'); for (var i = 0; i < n.length; i++) n[i].classList.remove('now'); S.curStep = -1; }

  /* ----- mixer (volume, pan, muto, solo, misuratori) ----- */
  function renderMixer() {
    var p = S.project, el = S.el.mixer; el.innerHTML = ''; S.meterEls = {};
    p.tracks.forEach(function (t) {
      var vol = h('input', { type: 'range', min: 0, max: 120, value: Math.round(t.vol * 100), 'aria-label': 'Volume ' + t.name, oninput: function () { t.vol = this.value / 100; changed('mix'); } });
      var pan = h('input', { type: 'range', min: -100, max: 100, value: Math.round(t.pan * 100), 'aria-label': 'Pan ' + t.name, class: 'bl-pan', oninput: function () { t.pan = this.value / 100; changed('mix'); }, ondblclick: function () { this.value = 0; t.pan = 0; changed('mix'); } });
      var m = h('button', { type: 'button', class: 'bl-ms' + (t.mute ? ' on mute' : ''), text: 'M', 'aria-label': 'Muto ' + t.name, 'aria-pressed': String(!!t.mute), onclick: function () { t.mute = !t.mute; renderMixer(); changed('mix'); } });
      var s = h('button', { type: 'button', class: 'bl-ms' + (t.solo ? ' on solo' : ''), text: 'S', 'aria-label': 'Solo ' + t.name, 'aria-pressed': String(!!t.solo), onclick: function () { t.solo = !t.solo; renderMixer(); changed('mix'); } });
      var meter = h('div', { class: 'bl-meter', 'aria-hidden': 'true' }, [h('i')]); S.meterEls[t.id] = meter.firstChild;
      var extra = null;
      if (t.kind === 'inst' && UI.instControls) extra = UI.instControls(t);
      el.appendChild(h('div', { class: 'bl-ch' + (!E.audibleOf(p, t) ? ' off' : ''), 'data-ch': t.id }, [h('div', { class: 'bl-chname' }, [h('b', { text: t.name }), m, s]), meter, h('div', { class: 'bl-faders' }, [h('label', {}, ['Vol', vol]), h('label', {}, ['Pan', pan])]), extra]));
    });
    var mv = h('input', { type: 'range', min: 0, max: 100, value: Math.round(p.master.vol * 100), 'aria-label': 'Volume generale', oninput: function () { p.master.vol = this.value / 100; changed('mix'); } });
    S.meterEls.master = h('i'); el.appendChild(h('div', { class: 'bl-ch master' }, [h('div', { class: 'bl-chname' }, [h('b', { text: 'Generale' })]), h('div', { class: 'bl-meter' }, [S.meterEls.master]), h('div', { class: 'bl-faders' }, [h('label', {}, ['Vol', mv])])]));
  }
  function db(x) { return x > 0.00001 ? 20 * Math.log10(x) : -100; }
  function meterLoop() {
    if (!S.mounted) return;
    var m = S.player ? S.player.meters() : {};
    for (var id in S.meterEls) { var pk = m[id] || 0, w = clamp((db(pk) + 48) / 48, 0, 1); S.meterEls[id].style.width = (w * 100) + '%'; S.meterEls[id].parentNode.classList.toggle('hot', db(pk) > -1); }
    if (S.player && S.player.playing) S.raf = root.requestAnimationFrame(meterLoop); else { S.raf = 0; for (var k in S.meterEls) S.meterEls[k].style.width = '0%'; }
  }
  function startLoops() { if (!S.raf) S.raf = root.requestAnimationFrame(meterLoop); }
  function stopLoops() { if (S.raf) root.cancelAnimationFrame(S.raf); S.raf = 0; if (S.meterEls) for (var k in S.meterEls) S.meterEls[k].style.width = '0%'; clearCursor(); }

  /* ----- esporta ----- */
  function renderExport() {
    var el = S.el.exp; el.innerHTML = '';
    var loops = h('select', { id: 'bl-loops', 'aria-label': 'Quante volte ripetere' }, [1, 2, 4, 8].map(function (n) { var o = h('option', { value: n, text: n === 1 ? 'Una volta' : n + ' volte' }); if (n === 2) o.selected = true; return o; }));
    el.appendChild(h('div', { class: 'row' }, [h('label', { class: 'f', style: 'flex:1' }, [h('span', { text: 'Ripeti il loop' }), loops]), h('button', { class: 'btn pri', id: 'bl-export', type: 'button', onclick: function () { doExport(+loops.value); } }, ['Crea il file WAV'])]));
    S.el.exportOut = h('div', { id: 'bl-exportout' }); el.appendChild(S.el.exportOut);
    el.appendChild(hint('Il WAV è reso dal programma con la stessa catena che senti suonare (qualità 44,1 kHz, 16 bit stereo).'));
  }
  function doExport(loops) {
    var out = S.el.exportOut; out.innerHTML = ''; out.appendChild(h('p', { class: 'status', text: 'Sto creando il file…' }));
    var p = JSON.parse(JSON.stringify(S.project));
    var pre = UI.preloadAll ? UI.preloadAll(p) : Promise.resolve();
    pre.then(function () { return E.exportWav(p, { loops: loops, sampleRate: 44100, sampler: S.sampler }); }).then(function (r) {
      var blob = new root.Blob([r.wav], { type: 'audio/wav' }), url = root.URL.createObjectURL(blob);
      if (S.lastExport) root.URL.revokeObjectURL(S.lastExport); S.lastExport = url;
      var rep = r.report, dur = (rep.frames / r.sr).toFixed(1);
      out.innerHTML = '';
      out.appendChild(h('audio', { controls: true, src: url, style: 'width:100%;margin-top:8px' }));
      out.appendChild(h('p', { class: 'small', id: 'bl-exportinfo', html: '<span class="tag m">Misurato</span> durata ' + dur + ' s · picco ' + rep.peakDb.toFixed(1) + ' dBFS · volume medio ' + (20 * Math.log10(Math.max(1e-6, rep.rms))).toFixed(1) + ' dBFS (RMS) · valori ' + (rep.finite ? 'tutti validi' : 'NON validi') + ' · ' + (r.wav.length / 1024 / 1024).toFixed(2) + ' MB' }));
      out.appendChild(h('a', { class: 'btn', id: 'bl-download', href: url, download: (S.project.name || 'beat').replace(/[^\w\-]+/g, '_') + '.wav' }, ['Scarica / salva il WAV']));
      out.appendChild(hint('Su iPhone: se non parte il download, tieni premuto sul lettore o usa il tasto condividi di Safari.'));
    }, function (e) { out.innerHTML = ''; out.appendChild(h('p', { class: 'status err', text: 'Non sono riuscito a creare il file: ' + e.message })); });
  }

  /* ----- montaggio ----- */
  function renderAll() {
    renderTransport(); renderStyle(); renderDrumHead(); renderGrid(); renderMixer(); renderExport();
    (S.ext || []).forEach(function (f) { try { f(S); } catch (e) { if (root.console) console.error(e); } });
  }
  function mount(el) {
    if (S.mounted && S.root === el) { renderAll(); return; }
    S.root = el; el.innerHTML = '';
    if (!S.project) { S.project = loadSaved(); if (!S.project) { S.project = E.newProject(); P.applyStyle(S.project, 'trap'); } }
    if (!S.player) S.player = new E.Player(S.project, { onTick: function (t) { setCursor(t); }, sampler: S.sampler || null });
    S.player.project = S.project;
    var q = function (id, cls, title, sub) { var c = h('section', { class: 'card ' + (cls || ''), id: id }); if (title) c.appendChild(h('div', { class: 'card-head' }, [h('h3', { text: title })])); if (sub) c.appendChild(h('p', { class: 'small muted', text: sub })); var body = h('div', { class: 'bl-body' }); c.appendChild(body); el.appendChild(c); return body; };
    el.appendChild(h('div', { class: 'head' }, [h('div', { class: 'eyebrow', text: 'Beat Lab' }), h('h1', { text: 'Fai la tua base' }), h('p', { text: 'Batteria a passi, basso 808 e tanti strumenti. Tocca "Suona" e cambia i quadrati mentre ascolti.' })]));
    S.el.bar = h('div', { class: 'bl-bar', id: 'bl-bar' }); el.appendChild(S.el.bar);
    S.el.transport = q('bl-c-transport', '');
    S.el.status = h('div', { class: 'status', id: 'bl-status' }); el.querySelector('#bl-c-transport').appendChild(S.el.status);
    S.el.style = q('bl-c-style', '', '1. Stile di partenza');
    var dm = q('bl-c-drums', '', '2. Batteria a passi'); S.el.drumhead = h('div'); S.el.grid = h('div', { id: 'bl-grid' }); dm.appendChild(S.el.drumhead); dm.appendChild(S.el.grid);
    S.el.extra = h('div', { id: 'bl-extra' }); el.appendChild(S.el.extra);
    S.el.mixer = q('bl-c-mixer', '', 'Mixer', 'Volume, posizione (pan), muto (M) e solo (S) per ogni suono.');
    S.el.exp = q('bl-c-export', '', 'Esporta');
    el.appendChild(h('div', { class: 'note', html: 'Se non senti nulla su iPhone: alza il volume, togli il silenzioso (tasto laterale) e tocca prima "Suona". Il suono si ferma se blocchi lo schermo.' }));
    S.mounted = true; renderAll();
  }
  function unmount() { if (S.player && S.player.playing) S.player.stop(); stopLoops(); }
  doc && doc.addEventListener && doc.addEventListener('visibilitychange', function () { if (doc.hidden && S.player && S.player.playing) { S.player.stop(); stopLoops(); if (S.mounted) renderTransport(); } });

  var UI = { mount: mount, unmount: unmount, state: S, h: h, icon: icon, seg: seg, hint: hint, renderAll: renderAll, changed: changed, snap: snap, afterPatternChange: afterPatternChange, extend: function (f) { S.ext.push(f); } };
  return UI;
});
