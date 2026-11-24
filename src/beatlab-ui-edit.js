/*
 * Beat Lab - aiuto per chi non e' esperto (Tappa 3): tonalita' e blocco sulla scala, tastiera touch,
 * accordi per atmosfera, piano roll semplice e livello "Impara" con esempi da ascoltare.
 */
(function (root) {
  'use strict';
  var UI = root.BeatLabUI, E = root.BeatEngine, P = root.BeatPatterns, T = root.BeatTheory, SM = root.BeatSampler;
  if (!UI || !T) return;
  var h = UI.h, S = UI.state, doc = root.document;
  var ED = { track: null, octave: 0, lock: true, rec: false, mood: 'malinconica', quant: '1/16', dur: 48, sel: null, rollOct: 0, mode: 'draw', learn: false, kbdOct: 0 };
  try { ED.learn = root.localStorage.getItem('beatlab.learn') === '1'; } catch (e) {}

  function instTracks() { return S.project.tracks.filter(function (t) { return t.kind === 'inst'; }); }
  function curTrack() { var p = S.project, t = ED.track && E.trackById(p, ED.track); if (!t || t.kind !== 'inst') { var l = instTracks().filter(function (x) { return !P.BASSY[x.inst]; }); t = l[0] || null; ED.track = t ? t.id : null; } return t; }
  function rangeOf(t) { var I = t && E.Voices.INSTRUMENTS[t.inst]; return I && I.range ? I.range : [36, 84]; }
  function centerOf(t) { var r = rangeOf(t); return Math.round((r[0] + r[1]) / 2) + ED.kbdOct * 12; }
  function changed() { UI.changed('mix'); }
  function ensureTrack(id) { var t = curTrack(); if (t) return t; t = E.newInstTrack(id || 'piano', null); S.project.tracks.push(t); ED.track = t.id; changed(); setTimeout(function () { UI.renderAll(); if (UI.ensureInst) UI.ensureInst(t.inst); }, 0); return t; }
  function trackSelect(onchange) {
    var sel = h('select', { 'aria-label': 'Traccia da suonare o modificare' }), l = instTracks(), cur = curTrack();
    if (!l.length) sel.appendChild(h('option', { value: '', text: '(nessuna traccia strumento: ne creo una)' }));
    l.forEach(function (t) { var o = h('option', { value: t.id, text: t.name }); if (cur && t.id === cur.id) o.selected = true; sel.appendChild(o); });
    sel.addEventListener('change', function () { ED.track = this.value; ED.sel = null; onchange(); }); return sel;
  }

  /* ================= Tonalita' ================= */
  function renderKey(box) {
    var p = S.project, key = p.key;
    var tonic = h('select', { id: 'bl-tonic', 'aria-label': 'Nota di partenza (tonica)', onchange: function () { setKey(+this.value, S.project.key.scale); } });
    T.IT.forEach(function (n, i) { var o = h('option', { value: i, text: n + ' (' + T.EN[i] + ')' }); if (i === key.root) o.selected = true; tonic.appendChild(o); });
    var scale = h('select', { id: 'bl-scale', 'aria-label': 'Scala', onchange: function () { setKey(S.project.key.root, this.value); } });
    Object.keys(T.SCALE_NAMES).forEach(function (k) { var o = h('option', { value: k, text: T.SCALE_NAMES[k] }); if (k === key.scale) o.selected = true; scale.appendChild(o); });
    box.appendChild(h('div', { class: 'grid2' }, [h('label', { class: 'f' }, [h('span', { text: 'Nota di partenza' }), tonic]), h('label', { class: 'f' }, [h('span', { text: 'Scala' }), scale])]));
    var names = P.SCALES[key.scale].map(function (d) { return T.noteShort(key.root + d); });
    box.appendChild(h('p', { class: 'small', id: 'bl-scalenotes', html: 'Note della scala: <b>' + names.join(' · ') + '</b>' }));
    box.appendChild(h('p', { class: 'small muted', text: T.SCALE_HELP[key.scale] }));
  }
  function setKey(root_, scale) {
    var p = S.project, old = p.key; UI.snap();
    var delta = ((root_ - old.root + 18) % 12) - 6; p.key = { root: root_, scale: scale };
    instTracks().forEach(function (t) { t.notes.forEach(function (n) { n.n = T.snapToScale(p.key, n.n + delta); }); });
    changed(); UI.renderAll();
  }

  /* ================= Tastiera sulla scala ================= */
  function renderKeyboard(box) {
    var p = S.project, t = curTrack();
    box.appendChild(h('div', { class: 'row' }, [h('label', { class: 'f', style: 'flex:1' }, [h('span', { text: 'Suona con' }), trackSelect(function () { UI.renderAll(); })]),
      h('div', { class: 'row' }, [h('button', { class: 'btn sm', type: 'button', text: 'Ottava −', onclick: function () { ED.kbdOct--; UI.renderAll(); } }), h('button', { class: 'btn sm', type: 'button', text: 'Ottava +', onclick: function () { ED.kbdOct++; UI.renderAll(); } })])]));
    var lock = h('input', { type: 'checkbox', id: 'bl-lock', checked: ED.lock, onchange: function () { ED.lock = this.checked; UI.renderAll(); } });
    var rec = h('input', { type: 'checkbox', id: 'bl-rec', checked: ED.rec, onchange: function () { ED.rec = this.checked; } });
    box.appendChild(h('div', { class: 'sw' }, [h('label', { for: 'bl-lock', text: 'Blocco sulla scala (solo note giuste)' }), lock]));
    box.appendChild(h('div', { class: 'sw' }, [h('label', { for: 'bl-rec', text: 'Registra mentre suona la base' }), rec]));
    var c = centerOf(t), lo = c - 12, hi = c + 12, kb = h('div', { class: 'bl-kbd', id: 'bl-kbd', role: 'group', 'aria-label': 'Tastiera' });
    for (var m = lo; m <= hi; m++) {
      var inS = T.inScale(p.key, m);
      if (ED.lock && !inS) continue;
      var tonic = ((m - p.key.root) % 12 + 12) % 12 === 0;
      var k = h('button', { type: 'button', class: 'bl-key' + (inS ? ' in' : ' out') + (tonic ? ' tonic' : ''), 'data-midi': m, 'aria-label': T.noteFull(m) }, [h('b', { text: T.noteShort(m) }), h('small', { text: T.EN[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1) })]);
      kb.appendChild(k);
    }
    kb.addEventListener('pointerdown', function (ev) { var k = ev.target.closest('.bl-key'); if (!k) return; ev.preventDefault(); playKey(+k.getAttribute('data-midi'), k); });
    box.appendChild(h('div', { class: 'bl-kbdwrap' }, [kb]));
    box.appendChild(h('p', { class: 'small muted', text: ED.lock ? 'Vedi solo le note della scala scelta: la nota di partenza è evidenziata. Scorri di lato per le altre.' : 'Tutte le 12 note: quelle fuori scala sono scure e possono suonare "stonate" nel tuo beat.' }));
    UI.ed = ED;
  }
  function playKey(midi, el) {
    var t = ensureTrack(); S.player.audition(t.id, midi, 100); if (el) { el.classList.add('hit'); setTimeout(function () { el.classList.remove('hit'); }, 150); }
    if (ED.rec && S.player.playing) {
      var pos = S.player.position(); if (pos == null) return; UI.snap();
      var n = T.addNote(S.project, t, pos, midi, { quant: ED.quant, dur: ED.dur, lock: ED.lock }); ED.sel = n; changed(); drawRoll();
    }
  }

  /* ================= Accordi ================= */
  function renderChords(box) {
    var p = S.project, mk = h('div', { class: 'chips' });
    Object.keys(T.MOODS).forEach(function (id) { mk.appendChild(h('button', { type: 'button', class: 'chip' + (ED.mood === id ? ' on' : ''), 'data-mood': id, text: T.MOODS[id].name, onclick: function () { ED.mood = id; UI.renderAll(); } })); });
    box.appendChild(mk);
    var M = T.MOODS[ED.mood];
    box.appendChild(h('p', { class: 'small', id: 'bl-mooddesc', text: M.desc + (p.key.scale !== M.scale ? ' Funziona meglio in scala ' + T.SCALE_NAMES[M.scale] + '.' : '') }));
    var row = h('div', { class: 'bl-chords', id: 'bl-chords' });
    T.chordRow(p, ED.mood).forEach(function (c, i) { row.appendChild(h('button', { type: 'button', class: 'btn', 'data-deg': c.degree, onclick: function () { playChord(c.degree); } }, [h('small', { text: (i + 1) + '.' }), c.name])); });
    box.appendChild(row);
    box.appendChild(h('div', { class: 'row' }, [
      h('button', { class: 'btn pri', type: 'button', id: 'bl-writechords', text: 'Scrivi gli accordi nella traccia', onclick: writeChords }),
      h('button', { class: 'btn', type: 'button', text: 'Ascolta la progressione', onclick: function () { var t = curTrack(); var tmp = { notes: [] }, pr = JSON.parse(JSON.stringify(S.project)); var tt = t ? JSON.parse(JSON.stringify(t)) : E.newInstTrack('piano'); T.writeProgression(pr, tt, ED.mood, { center: centerOf(tt) }); S.player.preview(tt.inst, tt.notes, S.project.bpm); } })]));
    box.appendChild(h('p', { class: 'small muted', text: 'Ogni accordo dura una battuta. "Scrivi" mette le note nella traccia scelta: poi le sistemi nel piano roll.' }));
  }
  function playChord(deg) { var t = ensureTrack(), c = T.chord(S.project.key, deg, centerOf(t)); c.forEach(function (n, i) { setTimeout(function () { S.player.audition(t.id, n, 92); }, i * 12); }); if (ED.rec && S.player.playing) { var pos = S.player.position(); if (pos != null) { UI.snap(); c.forEach(function (n) { T.addNote(S.project, t, pos, n, { quant: ED.quant, dur: 96, lock: false }); }); changed(); drawRoll(); } } }
  function writeChords() { var t = ensureTrack(); UI.snap(); T.writeProgression(S.project, t, ED.mood, { center: centerOf(t) }); changed(); UI.renderAll(); }

  /* ================= Piano roll ================= */
  var CW = 22, RH = 22, LABW = 54, canvas = null, rows = [];
  function rollRows(t) {
    var p = S.project, c = centerOf(t) + ED.rollOct * 12, lo = c - 12, hi = c + 12, r = [];
    for (var m = hi; m >= lo; m--) if (!ED.lock || T.inScale(p.key, m)) r.push(m); return r;
  }
  function renderRoll(box) {
    var t = curTrack(), p = S.project;
    box.appendChild(h('div', { class: 'row' }, [h('label', { class: 'f', style: 'flex:1' }, [h('span', { text: 'Traccia' }), trackSelect(function () { UI.renderAll(); })])]));
    var q = h('select', { id: 'bl-quant', 'aria-label': 'Quantizzazione', onchange: function () { ED.quant = this.value; } });
    [['1/4', 'Quarti'], ['1/8', 'Ottavi'], ['1/16', 'Sedicesimi'], ['1/32', 'Trentaduesimi'], ['tr', 'Terzine']].forEach(function (o) { var op = h('option', { value: o[0], text: o[1] }); if (o[0] === ED.quant) op.selected = true; q.appendChild(op); });
    var d = h('select', { id: 'bl-notedur', 'aria-label': 'Lunghezza nuove note', onchange: function () { ED.dur = +this.value; } });
    [[12, '1/32'], [24, '1/16'], [48, '1/8'], [96, '1/4'], [192, '1/2'], [384, '1 battuta']].forEach(function (o) { var op = h('option', { value: o[0], text: o[1] }); if (o[0] === ED.dur) op.selected = true; d.appendChild(op); });
    box.appendChild(h('div', { class: 'grid2' }, [h('label', { class: 'f' }, [h('span', { text: 'Quantizzazione' }), q]), h('label', { class: 'f' }, [h('span', { text: 'Lunghezza nota' }), d])]));
    box.appendChild(h('div', { class: 'bl-modes' }, [UI.seg([['draw', 'Disegna'], ['scroll', 'Scorri']], ED.mode, function (m) { ED.mode = m; UI.renderAll(); })]));
    if (!t) { box.appendChild(h('p', { class: 'small muted', text: 'Aggiungi prima una traccia strumento (sezione Strumenti) o tocca la tastiera: ne creo una.' })); return; }
    var wrap = h('div', { class: 'bl-rollwrap' }); canvas = h('canvas', { id: 'bl-roll', class: 'bl-roll ' + (ED.mode === 'scroll' ? 'scroll' : 'draw'), 'aria-label': 'Piano roll' }); wrap.appendChild(canvas); box.appendChild(wrap);
    rows = rollRows(t); sizeRoll(); bindRoll();
    var sel = ED.sel, v = h('input', { type: 'range', id: 'bl-selvel', min: 1, max: 127, value: sel ? sel.v : 100, 'aria-label': 'Forza della nota selezionata', disabled: !sel, oninput: function () { if (ED.sel) { T.setVelocity(ED.sel, +this.value); changed(); drawRoll(); } } });
    box.appendChild(h('div', { class: 'row' }, [h('label', { class: 'f', style: 'flex:1;min-width:140px' }, [h('span', { text: 'Forza nota selezionata' }), v]),
      h('button', { class: 'btn sm', type: 'button', id: 'bl-delnote', text: 'Cancella nota', disabled: !sel, onclick: function () { if (ED.sel) { UI.snap(); T.removeNote(curTrack(), ED.sel); ED.sel = null; changed(); UI.renderAll(); } } }),
      h('button', { class: 'btn sm', type: 'button', text: 'Quantizza tutto', onclick: function () { UI.snap(); T.quantizeAll(S.project, curTrack(), ED.quant); changed(); drawRoll(); } }),
      h('button', { class: 'btn sm', type: 'button', text: 'Note più alte', onclick: function () { ED.rollOct++; UI.renderAll(); } }), h('button', { class: 'btn sm', type: 'button', text: 'Note più basse', onclick: function () { ED.rollOct--; UI.renderAll(); } })]));
    box.appendChild(h('p', { class: 'small muted', id: 'bl-rollhelp', text: ED.mode === 'draw' ? 'Tocca uno spazio vuoto per aggiungere una nota, tocca una nota per selezionarla, trascinala per spostarla, trascina il bordo destro per allungarla.' : 'Modalità scorrimento: muovi la griglia con il dito. Torna a "Disegna" per modificare.' }));
    drawRoll();
  }
  function sizeRoll() {
    var p = S.project, cols = E.loopTicks(p) / 24, w = LABW + cols * CW, hgt = rows.length * RH + 18, dpr = root.devicePixelRatio || 1;
    canvas.style.width = w + 'px'; canvas.style.height = hgt + 'px'; canvas.width = Math.round(w * dpr); canvas.height = Math.round(hgt * dpr); canvas._dpr = dpr;
  }
  function cssv(n, f) { var v = root.getComputedStyle(doc.documentElement).getPropertyValue(n).trim(); return v || f; }
  function drawRoll() {
    var t = curTrack(); if (!canvas || !t || !canvas.isConnected) return; var p = S.project, c = canvas.getContext('2d'), dpr = canvas._dpr || 1, cols = E.loopTicks(p) / 24, W = LABW + cols * CW;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, canvas.height);
    var ink = cssv('--ink', '#eee'), muted = cssv('--muted', '#999'), line = cssv('--line', '#333'), vio = cssv('--violet', '#a58cff'), cy = cssv('--cyan', '#0ef'), pk = cssv('--pink', '#f3c');
    rows.forEach(function (m, i) {
      var y = 18 + i * RH, tonic = ((m - p.key.root) % 12 + 12) % 12 === 0, inS = T.inScale(p.key, m);
      c.fillStyle = tonic ? 'rgba(165,140,255,.18)' : (inS ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.25)'); c.fillRect(LABW, y, cols * CW, RH);
      c.strokeStyle = line; c.beginPath(); c.moveTo(LABW, y + .5); c.lineTo(W, y + .5); c.stroke();
      c.fillStyle = tonic ? vio : muted; c.font = '11px Manrope,system-ui,sans-serif'; c.textBaseline = 'middle'; c.fillText(T.noteShort(m) + (Math.floor(m / 12) - 1), 6, y + RH / 2);
    });
    for (var i = 0; i <= cols; i++) { var x = LABW + i * CW; c.strokeStyle = i % 16 === 0 ? ink : (i % 4 === 0 ? muted : line); c.globalAlpha = i % 16 === 0 ? .6 : (i % 4 === 0 ? .5 : .35); c.beginPath(); c.moveTo(x + .5, 18); c.lineTo(x + .5, 18 + rows.length * RH); c.stroke(); c.globalAlpha = 1; if (i % 4 === 0 && i < cols) { c.fillStyle = muted; c.font = '10px sans-serif'; c.fillText(String(Math.floor(i / 16) + 1) + '.' + (Math.floor((i % 16) / 4) + 1), x + 3, 9); } }
    t.notes.forEach(function (n) {
      var ri = rows.indexOf(n.n); if (ri < 0) return; var x = LABW + n.t / 24 * CW, y = 18 + ri * RH, w = Math.max(5, n.d / 24 * CW - 1);
      c.globalAlpha = .45 + .55 * n.v / 127; c.fillStyle = n === ED.sel ? cy : pk; c.fillRect(x, y + 2, w, RH - 4); c.globalAlpha = 1;
      c.strokeStyle = n === ED.sel ? '#fff' : vio; c.lineWidth = n === ED.sel ? 2 : 1; c.strokeRect(x + .5, y + 2.5, w - 1, RH - 5); c.lineWidth = 1;
    });
    var pos = S.player && S.player.playing ? S.player.position() : null;
    if (pos != null) { var px = LABW + pos / 24 * CW; c.strokeStyle = cy; c.lineWidth = 2; c.beginPath(); c.moveTo(px, 14); c.lineTo(px, 18 + rows.length * RH); c.stroke(); c.lineWidth = 1; }
  }
  function hit(ev) {
    var r = canvas.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    return { tick: (x - LABW) / CW * 24, ri: Math.floor((y - 18) / RH), x: x, y: y };
  }
  function bindRoll() {
    var drag = null;
    canvas.addEventListener('pointerdown', function (ev) {
      if (ED.mode !== 'draw') return; var t = curTrack(), a = hit(ev); if (a.x < LABW || a.ri < 0 || a.ri >= rows.length) return;
      var midi = rows[a.ri], n = null; for (var i = 0; i < t.notes.length; i++) { var q = t.notes[i]; if (q.n === midi && a.tick >= q.t && a.tick < q.t + q.d) { n = q; break; } }
      ev.preventDefault(); try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
      if (n) { var edge = (LABW + (n.t + n.d) / 24 * CW) - a.x < 10; drag = { n: n, mode: edge ? 'size' : 'move', x0: a.x, y0: a.y, t0: n.t, m0: n.n, d0: n.d, ri0: a.ri, moved: false, snap: false }; ED.sel = n; }
      else { UI.snap(); var nn = T.addNote(S.project, t, a.tick - 0, midi, { quant: ED.quant, dur: ED.dur, lock: ED.lock }); ED.sel = nn; S.player.audition(t.id, nn.n, nn.v); changed(); drag = null; refreshSel(); drawRoll(); }
    });
    canvas.addEventListener('pointermove', function (ev) {
      if (!drag) return; var a = hit(ev), dx = a.x - drag.x0, dy = a.y - drag.y0; if (!drag.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      if (!drag.snap) { UI.snap(); drag.snap = true; } drag.moved = true; var n = drag.n;
      if (drag.mode === 'size') { n.d = drag.d0; T.resizeNote(S.project, n, drag.d0 + dx / CW * 24, ED.quant); }
      else { n.t = drag.t0; n.n = drag.m0; var ri = clamp(a.ri, 0, rows.length - 1); T.moveNote(S.project, n, dx / CW * 24, 0, { quant: ED.quant, lock: false }); n.n = rows[ri]; }
      drawRoll(); ev.preventDefault();
    });
    function up() { if (!drag) return; var n = drag.n, mv = drag.moved; drag = null; if (mv) { S.player.audition(curTrack().id, n.n, n.v); changed(); } refreshSel(); drawRoll(); }
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function refreshSel() { var v = doc.getElementById('bl-selvel'), d = doc.getElementById('bl-delnote'); if (v) { v.disabled = !ED.sel; if (ED.sel) v.value = ED.sel.v; } if (d) d.disabled = !ED.sel; }

  /* ================= Impara ================= */
  function seg(styleId, f) { var p = E.newProject(); P.applyStyle(p, styleId); if (f) f(p); return p; }
  function only(p, lanes) { p.tracks.forEach(function (t) { if (t.kind === 'drum' && lanes.indexOf(t.lane) < 0) t.mute = true; if (t.kind === 'inst') t.mute = true; }); }
  var EXAMPLES = {
    bpm: function () { return [seg('trap', function (p) { p.bpm = 80; p.bars = 1; E.resize(p, 1, 16); }), seg('trap', function (p) { p.bpm = 160; E.resize(p, 1, 16); })]; },
    swing: function () { return [seg('boombap', function (p) { p.swing = 50; E.resize(p, 1, 16); }), seg('boombap', function (p) { p.swing = 66; E.resize(p, 1, 16); })]; },
    style: function () { return [seg('trap'), seg('boombap')]; },
    kick: function () { return [seg('trap', function (p) { only(p, ['kick']); })]; },
    snare: function () { return [seg('trap', function (p) { only(p, ['kick', 'snare', 'clap']); }), seg('boombap', function (p) { only(p, ['kick', 'snare']); })]; },
    hat: function () { return [seg('trap', function (p) { only(p, ['hat']); p.tracks.forEach(function (t) { if (t.lane === 'hat') t.roll = t.roll.map(function () { return 0; }); }); }), seg('trap', function (p) { only(p, ['hat']); })]; },
    velocity: function () { return [seg('pop', function (p) { only(p, ['hat']); p.tracks.forEach(function (t) { if (t.lane === 'hat') t.steps = t.steps.map(function (v) { return v ? 100 : 0; }); }); }), seg('pop', function (p) { only(p, ['hat']); })]; },
    '808': function () { return [seg('drill', function (p) { p.tracks.forEach(function (t) { if (t.kind === 'drum') t.mute = true; }); })]; },
    scale: function () { var p = seg('trap', function (q) { q.tracks.forEach(function (t) { t.mute = true; }); }), t = E.newInstTrack('piano', 'x'), k = p.key; T.scaleNotes(k, 60, 72).forEach(function (m, i) { t.notes.push({ t: i * 48, d: 40, n: m, v: 96, s: 0 }); }); p.bpm = 120; p.tracks.push(t); return [p]; },
    chords: function () { var p = seg('trap', function (q) { q.tracks.forEach(function (t) { t.mute = true; }); q.bars = 4; }), t = E.newInstTrack('pad', 'x'); T.writeProgression(p, t, ED.mood); p.tracks.push(t); p.bpm = 100; return [p]; },
    pianoroll: function () { var p = seg('trap', function (q) { q.tracks.forEach(function (t) { t.mute = true; }); }), t = E.newInstTrack('pluck', 'x'); t.notes = P.demoNotes('pluck', p.key, 2); p.tracks.push(t); return [p]; },
    quant: function () { var mk = function (off) { var p = seg('trap', function (q) { q.tracks.forEach(function (t) { t.mute = true; }); }), t = E.newInstTrack('pluck', 'x'); [0, 96, 192, 288].forEach(function (b, i) { t.notes.push({ t: b + (off ? [9, -7, 13, -11][i] : 0), d: 60, n: [60, 63, 67, 63][i] + 12, v: 100, s: 0 }); }); p.tracks.push(t); p.bpm = 110; return p; }; return [mk(true), mk(false)]; },
    mixer: function () { return [seg('trap', function (p) { only(p, ['kick']); }), seg('trap')]; },
    inst: function () { var t = curTrack(); return null; }
  };
  var playing = null;
  function playExample(key, btn) {
    if (key === 'inst') { var t = curTrack(); if (t) S.player.preview(t.inst, P.demoNotes(t.inst, S.project.key, 2), S.project.bpm); return; }
    var segs = EXAMPLES[key] && EXAMPLES[key](); if (!segs) return; btn.disabled = true; var old = btn.textContent; btn.textContent = 'Preparo…';
    S.player.ensure(); var ctx = S.player.ctx, sampler = S.sampler;
    (UI.preloadAll ? Promise.all(segs.map(function (s) { return UI.preloadAll(s); })) : Promise.resolve()).then(function () {
      return Promise.all(segs.map(function (s) { return E.renderOffline(s, { loops: 1, tail: 0.4, sampler: sampler, sampleRate: 44100 }); }));
    }).then(function (rs) {
      var go = function () { var t0 = ctx.currentTime + 0.05; if (playing) { try { playing.stop(); } catch (e) {} } rs.forEach(function (r) { var s = ctx.createBufferSource(); s.buffer = r.buffer; var g = ctx.createGain(); g.gain.value = 0.9; s.connect(g); g.connect(ctx.destination); s.start(t0); t0 += r.buffer.duration - 0.35; playing = s; }); btn.textContent = 'Suona…'; setTimeout(function () { btn.disabled = false; btn.textContent = old; }, (t0 - ctx.currentTime) * 1000 + 100); };
      if (ctx.state === 'suspended') ctx.resume().then(go, go); else go();
    }).catch(function (e) { btn.disabled = false; btn.textContent = old; if (root.console) console.error(e); });
  }
  function learnBox(key) {
    var L = T.LEARN[key]; var b = h('div', { class: 'bl-learnbox', 'data-learn': key }, [h('b', { text: L.t }), h('p', { text: L.d })]);
    var btn = h('button', { class: 'btn sm', type: 'button', text: 'Ascolta esempio', 'data-example': key }); btn.addEventListener('click', function () { playExample(key, btn); }); b.appendChild(btn); return b;
  }
  var LEARN_AT = { '#bl-c-transport .bl-body': ['bpm', 'swing'], '#bl-c-style .bl-body': ['style'], '#bl-c-drums .bl-body': ['kick', 'snare', 'hat', 'velocity', '808'], '#bl-c-key .bl-body': ['scale'], '#bl-c-chords .bl-body': ['chords'], '#bl-c-roll .bl-body': ['pianoroll', 'quant'], '#bl-c-inst': ['inst'], '#bl-c-mixer .bl-body': ['mixer'] };
  function injectLearn() {
    Object.keys(LEARN_AT).forEach(function (sel) { var host = doc.querySelector(sel); if (!host) return; var old = host.querySelectorAll('.bl-learnbox'); for (var i = 0; i < old.length; i++) old[i].remove(); LEARN_AT[sel].forEach(function (k) { host.appendChild(learnBox(k)); }); });
    S.root.classList.toggle('bl-learn', ED.learn);
  }

  /* ================= montaggio ================= */
  var cards = null;
  function card(id, title) { var c = h('section', { class: 'card', id: id }); c.appendChild(h('div', { class: 'card-head' }, [h('h3', { text: title })])); var b = h('div', { class: 'bl-body' }); c.appendChild(b); return { c: c, b: b }; }
  UI.extend(function () {
    var extra = S.el.extra; if (!extra || !extra.parentNode) return;
    if (!cards || !cards.k.c.isConnected) {
      cards = { k: card('bl-c-key', '3. Tonalità'), kb: card('bl-c-kbd', '4. Tastiera sulla scala'), ch: card('bl-c-chords', '5. Accordi e atmosfera'), pr: card('bl-c-roll', '6. Piano roll') };
      cards.ch.c.id = 'bl-c-chords'; cards.pr.c.id = 'bl-c-roll';
      ['k', 'kb', 'ch', 'pr'].forEach(function (k) { extra.parentNode.insertBefore(cards[k].c, extra); });
    }
    ['k', 'kb', 'ch', 'pr'].forEach(function (k) { cards[k].b.innerHTML = ''; });
    renderKey(cards.k.b); renderKeyboard(cards.kb.b); renderChords(cards.ch.b); renderRoll(cards.pr.b);
    if (!doc.getElementById('bl-learnswitch')) { var head = S.root.querySelector('.head'); if (head) head.appendChild(h('div', { class: 'sw' }, [h('label', { for: 'bl-learnswitch', text: 'Impara: mostra le spiegazioni' }), h('input', { type: 'checkbox', id: 'bl-learnswitch', checked: ED.learn, onchange: function () { ED.learn = this.checked; try { root.localStorage.setItem('beatlab.learn', ED.learn ? '1' : '0'); } catch (e) {} S.root.classList.toggle('bl-learn', ED.learn); } })])); }
    injectLearn();
  });
  // il cursore del piano roll segue la riproduzione
  var last = 0; (function tick() { var now = Date.now(); if (S.player && S.player.playing && canvas && canvas.isConnected && now - last > 60) { last = now; drawRoll(); } root.requestAnimationFrame(tick); })();
  UI.edit = { ED: ED, playExample: playExample, EXAMPLES: EXAMPLES, writeChords: writeChords, setKey: setKey };
})(typeof self !== 'undefined' ? self : this);
