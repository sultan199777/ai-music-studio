(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(v, d) { return Number(v).toFixed(d || 0).replace('.', ','); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function tick() { return new Promise(function (r) { setTimeout(r, 40); }); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var ALLG = {}; [Backing.GENRES, Arranger.STYLES].forEach(function (g) { Object.keys(g).forEach(function (k) { ALLG[k] = g[k]; }); });
  var NOTES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
  var TAGS = { misurato: ['m', 'Misurato'], analisi: ['a', 'Analisi'], ipotesi: ['i', 'Ipotesi'] };
  function tag(k, label) { var t = TAGS[k]; return '<span class="tag ' + (t ? t[0] : k) + '">' + (label || (t && t[1]) || k) + '</span>'; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function uid() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* ================= Dati e salvataggio ================= */
  var STATUSES = ['idea', 'testo', 'base', 'voce', 'mix', 'clip', 'pubblicata'];
  var LIB = { songs: [], cur: null, settings: { theme: 'studio', artist: '', v3: 1 } };
  var SESSION = { takes: [], takeId: null, imported: null, useImported: false, base: null, baseKey: '', photo: null, exports: [], clipDone: false, baseMade: false };
  var store = { kind: 'locale', doc: null, busy: false, again: false, ok: false };

  function defaultProd() {
    return { master: 'standard', genre: 'melodico', bpm: 96, tonic: 0, mode: 'maggiore', inst: { melodia: 'piano', accordi: 'guitar', pad: 'violins' }, v2: 1, bars: 8, bassStyle: null, reverb: 0, seed: 1, follow: false, levels: { batteria: 1, basso: 1, accordi: 1, arpeggio: 1, pad: 1, melodia: 1, voce: 1 } };
  }
  function newSong(title) {
    return { id: uid(), title: title || 'Senza titolo', lyrics: '', versions: [], status: 'idea', folder: 'lavorazione', modes: {}, mood: '', key: '', release: '', links: '', notes: '', prod: defaultProd(), plan: null, created: today() };
  }
  function cur() {
    var s = LIB.songs.filter(function (x) { return x.id === LIB.cur; })[0];
    if (!s) { s = LIB.songs[0]; }
    if (!s) { s = newSong(); LIB.songs.push(s); }
    LIB.cur = s.id;
    if (!s.prod) s.prod = defaultProd();
    return s;
  }
  var saveT = null;
  function persist() {
    try { localStorage.setItem('msa-lib', JSON.stringify(LIB)); } catch (e) {}
    if (!store.doc) return;
    clearTimeout(saveT);
    saveT = setTimeout(flush, 700);
  }
  async function flush() {
    if (!store.doc) return;
    if (store.busy) { store.again = true; return; }
    store.busy = true;
    try { await store.doc.set({ v: 1, json: JSON.stringify(LIB) }); } catch (e) { /* resta il salvataggio locale */ }
    store.busy = false;
    if (store.again) { store.again = false; flush(); }
  }
  function sanitize(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.songs)) return null;
    d.settings = d.settings || { theme: 'studio', artist: '' };
    if (!d.settings.v3) { d.settings.theme = 'studio'; d.settings.v3 = 1; } // nuovo aspetto da studio, una volta sola
    var OLDG = { pop: 'melodico', lofi: 'melodico', hiphop: 'trap', dance: 'estate' };
    d.songs.forEach(function (s) {
      // una volta sola: le basi del vecchio generatore (melodia simile a un flauto) passano al nuovo arrangiatore con strumenti veri
      if (s.prod && !s.prod.v2) { if (OLDG[s.prod.genre]) { s.prod.genre = OLDG[s.prod.genre]; s.prod.tune = null; } if (!s.prod.inst) s.prod.inst = defaultProd().inst; if (s.prod.karBars == null || s.prod.karBars === 2) s.prod.karBars = 'auto'; s.prod.v2 = 1; }
    });
    d.songs.forEach(function (s) { s.folder = s.folder || 'lavorazione'; s.modes = s.modes || {}; s.prod = Object.assign(defaultProd(), s.prod || {}); s.prod.levels = Object.assign(defaultProd().levels, s.prod.levels || {}); s.versions = s.versions || []; });
    return d;
  }
  async function load() {
    var loaded = null;
    try { loaded = sanitize(JSON.parse(localStorage.getItem('msa-lib') || 'null')); } catch (e) {}
    if (loaded) LIB = loaded;
    try {
      if (window.claude && window.claude.use) {
        var timeout = new Promise(function (r) { setTimeout(function () { r(null); }, 10000); });
        var pair = await Promise.race([Promise.all([window.claude.use('db'), window.claude.use('user')]), timeout]);
        if (pair && pair[0] && pair[1]) {
          var id = await pair[1].id();
          if (id) {
            var d = pair[0].doc('data/users/' + id + '/library');
            var snap = await Promise.race([d.get(), timeout]);
            if (snap) {
              store.doc = d; store.kind = 'account';
              if (snap.exists) {
                var remote = null;
                try { remote = sanitize(JSON.parse(snap.data().json)); } catch (e) {}
                if (remote) LIB = remote;
              } else if (loaded) { flush(); }
            }
          }
        }
      }
    } catch (e) { /* si lavora in locale */ }
  }

  /* ================= Audio ================= */
  var player = { ctx: null, src: null, raf: 0 };
  function getCtx() {
    if (!player.ctx) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {} player.ctx = new C(); }
    if (player.ctx.state === 'suspended' && player.ctx.resume) player.ctx.resume();
    return player.ctx;
  }
  function makeBuffer(ctx, samples, sr) {
    var b = ctx.createBuffer(1, samples.length, sr);
    if (b.copyToChannel) b.copyToChannel(samples, 0); else b.getChannelData(0).set(samples);
    return b;
  }
  function stopPlay() {
    cancelAnimationFrame(player.raf);
    if (player.src) { var s = player.src; player.src = null; try { s.onended = null; s.stop(); } catch (e) {} }
    if (player.onStop) { var f = player.onStop; player.onStop = null; f(); }
    if (window.VoiceLab) VoiceLab.stop(); // VOICE LAB: ferma anche l'ascolto Prima/Dopo
  }
  // Riproduce; onTick(t) viene chiamata a ogni fotogramma con i secondi trascorsi.
  function playBuf(samples, sr, onTick, onStop) {
    var ctx = getCtx();
    if (!ctx) return false;
    stopPlay();
    var src = ctx.createBufferSource();
    src.buffer = makeBuffer(ctx, samples, sr);
    src.connect(ctx.destination);
    var t0 = ctx.currentTime + 0.05;
    player.t0 = t0; player.src = src; player.onStop = onStop || null;
    src.onended = function () { if (player.src === src) { player.src = null; cancelAnimationFrame(player.raf); var f = player.onStop; player.onStop = null; if (f) f(); } };
    src.start(t0); audioCheck();
    if (onTick) {
      var loop = function () { if (player.src !== src) return; onTick(Math.max(0, ctx.currentTime - t0)); player.raf = requestAnimationFrame(loop); };
      loop();
    }
    return true;
  }
  async function getDl() { try { return window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { return null; } }
  async function saveFile(filename, data, el, okMsg) {
    var dl = await getDl();
    if (!dl) { // versione app (fuori da Claude): download normale del browser
      try {
        var blob = data instanceof Blob ? data : new Blob([data], { type: 'text/plain' }), u = URL.createObjectURL(blob), an = document.createElement('a');
        an.href = u; an.download = filename; document.body.appendChild(an); an.click(); an.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
        el.textContent = (okMsg || 'File pronto.') + ' Lo trovi in Download / File.'; SESSION.exports.push({ name: filename, time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) }); return true;
      } catch (e2) { el.textContent = 'Non sono riuscito a salvare il file.'; return false; }
    }
    try { await dl.save({ filename: filename, data: data }); el.textContent = okMsg || 'File pronto.'; SESSION.exports.push({ name: filename, time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) }); return true; }
    catch (e) { el.textContent = e && e.code === 'declined' ? 'Salvataggio annullato.' : 'Non sono riuscito a salvare il file.'; return false; }
  }
  function wavBlob(x, sr) {
    var n = x.length, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), i, o = 44;
    function s(off, t) { for (var k = 0; k < t.length; k++) v.setUint8(off + k, t.charCodeAt(k)); }
    s(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); s(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, n * 2, true);
    for (i = 0; i < n; i++, o += 2) { var q = Math.max(-1, Math.min(1, x[i])); v.setInt16(o, q < 0 ? q * 32768 : q * 32767, true); }
    return new Blob([b], { type: 'audio/wav' });
  }
  async function saveAudio(samples, sr, baseName, el) {
    if (!(await getDl())) { await saveFile(baseName + '.wav', wavBlob(samples, sr), el, 'File WAV pronto (qualità piena).'); return; }
    var ctx = getCtx();
    var types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
    var mime = window.MediaRecorder ? types.filter(function (t) { return MediaRecorder.isTypeSupported(t); })[0] : null;
    if (!ctx || !ctx.createMediaStreamDestination || !mime) { el.textContent = 'Il salvataggio dell\'audio non è disponibile in questo browser.'; return; }
    stopPlay();
    var dest = ctx.createMediaStreamDestination(), src = ctx.createBufferSource();
    src.buffer = makeBuffer(ctx, samples, sr); src.connect(dest);
    var rec = new MediaRecorder(dest.stream, { mimeType: mime }), chunks = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    var stopped = new Promise(function (r) { rec.onstop = r; }), ended = new Promise(function (r) { src.onended = r; });
    rec.start(); src.start();
    el.textContent = 'Preparo il file: circa ' + Math.ceil(samples.length / sr) + ' secondi. Resta su questa pagina.';
    await ended; await sleep(250); rec.stop(); await stopped;
    await saveFile(baseName + '.' + (mime.indexOf('mp4') !== -1 ? 'mp4' : 'webm'), new Blob(chunks, { type: mime }), el);
  }
  function toMono(chs) {
    if (chs.length === 1) return chs[0];
    var o = new Float32Array(chs[0].length);
    for (var c = 0; c < chs.length; c++) for (var i = 0; i < o.length; i++) o[i] += chs[c][i] / chs.length;
    return o;
  }
  async function decode(file) {
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) throw new Error('noaudio');
    var ctx = new C();
    try {
      var a = await ctx.decodeAudioData(await file.arrayBuffer());
      var chs = []; for (var c = 0; c < a.numberOfChannels; c++) chs.push(a.getChannelData(c));
      return { mono: toMono(chs), sr: a.sampleRate };
    } finally { if (ctx.close) ctx.close(); }
  }

  /* ================= Claude (facoltativo) ================= */
  var sampleFn = null;
  async function initSample() {
    try { if (window.claude && window.claude.use) { sampleFn = await window.claude.use('sample'); } } catch (e) { sampleFn = null; }
    $$('[data-needs-ai]').forEach(function (e) { e.hidden = !sampleFn; });
  }
  async function ask(prompt, onText) {
    if (!sampleFn) throw { code: 'unavailable' };
    return sampleFn(prompt, { onText: function (x) { onText(x.text); }, cache: false });
  }
  function songContext(s) {
    var a = s.lyrics.trim() ? LyricsEngine.analyze(s.lyrics) : null;
    var ctx = 'Titolo: ' + s.title + '\nGenere: ' + s.prod.genre + ', ' + s.prod.bpm + ' BPM, ' + NOTES[s.prod.tonic] + ' ' + s.prod.mode + '\nTesto:\n' + s.lyrics.slice(0, 1500);
    if (a && a.emotions.sufficient) ctx += '\nTono emotivo del testo: ' + a.emotions.items[0].name + ' (' + a.emotions.valence + ')';
    return ctx;
  }
  var AI_RULES = 'Rispondi in italiano, in modo concreto e breve (massimo 150 parole). Distingui chiaramente ciò che è un\'ipotesi da ciò che è un fatto. Non promettere successo, hit o effetti emotivi garantiti. Non citare né copiare testi di altri autori.';

  /* ================= Navigazione ================= */
  var VIEWS = ['daw', 'home', 'menu', 'canzoni', 'studio', 'strumenti', 'producer', 'voce', 'video', 'marketing', 'social', 'libreria', 'impostazioni', 'artisti', 'beatlab' /* Beat Lab */];
  var MENU = [
    ['home', 'Home e Dashboard', 'Il tuo percorso', 'i-home'], ['canzoni', 'Le mie canzoni', 'Schede e versioni', 'i-disc'],
    ['studio', 'Testo e Base', 'Scrivi, crea la base, canta', 'i-sliders'], ['strumenti', 'Strumentario', '29 strumenti veri e guida', 'i-sliders'], ['beatlab', 'Beat Lab', 'Fai le tue basi', 'i-note'] /* Beat Lab */, ['producer', 'AI Producer', 'Comandi a parole', 'i-spark'],
    ['voce', 'Vocal Studio', 'Voce e autotune', 'i-mic'], ['video', 'AI Video Studio', 'Clip a tempo', 'i-film'],
    ['marketing', 'Marketing AI', 'Piano a 30 giorni', 'i-mega'], ['social', 'Social Media Manager', 'Calendario', 'i-cal'],
    ['artisti', 'Cartelle artista', 'Impara lo stile (solo numeri)', 'i-disc'], ['libreria', 'Libreria contenuti', 'Materiali', 'i-folder'], ['impostazioni', 'Impostazioni', 'Aspetto e dati', 'i-gear']
  ];
  var SHOW = {};
  function route() {
    var id = (location.hash || '').replace('#', '');
    if (VIEWS.indexOf(id) === -1) id = 'daw';
    stopPlay(); if (typeof dwStop === 'function' && id !== 'daw') dwStop();
    VIEWS.forEach(function (v) { $('#v-' + v).hidden = v !== id; });
    $$('#tabs a').forEach(function (a) { a.classList.toggle('on', id === 'daw' && a.getAttribute('data-ws') === dwWsName()); });
    var s = cur();
    $('#top-song').textContent = s.title || 'Senza titolo';
    applyMood();
    if (SHOW[id]) SHOW[id]();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  /* ---- Beat Lab (blocco aggiunto): si apre con #beatlab; il suono si ferma quando esci ---- */
  SHOW.beatlab = function () { if (window.BeatLabUI) window.BeatLabUI.mount($('#bl-root')); };
  window.addEventListener('hashchange', function () { if (location.hash !== '#beatlab' && window.BeatLabUI) window.BeatLabUI.unmount(); });
  /* ---- fine Beat Lab ---- */


  /* ================= Atmosfera: i colori seguono l'emozione del testo ================= */
  var PAL = { amore: [335, 20, 290], tristezza: [225, 250, 200], rabbia: [5, 25, 340], gioia: [45, 175, 320], speranza: [200, 45, 160], nostalgia: [30, 280, 15], neutro: [255, 190, 330] };
  var MOOD_LABEL = { amore: 'rosa e corallo', tristezza: 'blu e indaco', rabbia: 'rosso e arancio', gioia: 'oro e turchese', speranza: 'azzurro e oro', nostalgia: 'ambra e lilla', neutro: 'viola e azzurro' };
  function applyMood() {
    var m = (topMood(cur()) || '').toLowerCase(), key = PAL[m] ? m : 'neutro', p = PAL[key], st = document.documentElement.style;
    st.setProperty('--h1', p[0]); st.setProperty('--h2', p[1]); st.setProperty('--h3', p[2]);
    var oc = document.getElementById('orb-cap'); if (oc) oc.innerHTML = 'Emozione del testo: <b>' + (key === 'neutro' ? 'neutra' : key) + '</b>';
    return key;
  }

  /* ================= Home ================= */
  SHOW.home = function () {
    var s = cur(), lines = lyricLines(s.lyrics).length;
    $('#h-title').textContent = s.title || 'Senza titolo';
    var mk = applyMood(); $('#h-sub').textContent = lines ? lines + (lines === 1 ? ' riga' : ' righe') + ' di testo · stato: ' + s.status + ' · atmosfera: ' + (mk === 'neutro' ? 'neutra' : mk) + ' (' + MOOD_LABEL[mk] + ')' : 'Scrivi il testo per cominciare.';
    var takes = SESSION.takes.length, fixed = SESSION.takes.some(function (t) { return t.final; });
    var st = [
      ['studio', 'Testo', lines ? lines + (lines === 1 ? ' riga scritta' : ' righe scritte') : 'Scrivi o incolla il testo', lines > 0],
      ['studio', 'Base', SESSION.baseMade || SESSION.imported ? 'Base pronta' : 'Crea la base che segue il testo', !!(SESSION.baseMade || SESSION.imported)],
      ['voce', 'Voce', takes ? takes + ' registrazion' + (takes === 1 ? 'e importata' : 'i importate') : 'Importa la registrazione dal telefono', takes > 0],
      ['voce', 'Autotune', fixed ? 'Voce elaborata' : 'Correggi e rifinisci la voce', fixed],
      ['video', 'Clip', SESSION.clipDone ? 'Clip provato' : 'Foto + musica = videoclip', SESSION.clipDone]
    ];
    $('#h-steps').innerHTML = st.map(function (x, i) {
      return '<li><a class="' + (x[4] ? 'done' : '') + '" href="#' + x[0] + '"><span class="n">' + (x[4] ? '✓' : i + 1) + '</span><span class="t"><b>' + x[1] + '</b><small>' + esc(x[2]) + '</small></span><svg><use href="#i-chev"/></svg></a></li>';
    }).join('');
    var rows = [
      ['ok', 'Analisi del testo: sillabe, rime, ritornello, tono emotivo'], ['ok', 'Base musicale generata dal testo (suoni sintetici, bozza)'],
      ['ok', 'Voce: analisi, tonalità, autotune, armonia, riduzione rumore, EQ/compressore/riverbero'], ['ok', 'Voce sopra la base, ascolto e salvataggio'],
      ['ok', 'Clip con foto in stile cartone/manga a tempo di musica'], ['ok', 'Piano di promozione 30 giorni con approvazione manuale'],
      ['ok', 'Registrare con il microfono: nella pagina Voce, aperta da Safari (dentro Claude non funziona)'], ['soon', 'Correzione del tempo (timing) e separazione delle tracce'],
      ['soon', 'Voce clonata che canta il testo: serve un servizio esterno, da provare'], ['soon', 'Personaggio manga animato 3D: serve un servizio esterno'],
      ['soon', 'Pubblicazione automatica su Instagram, TikTok, YouTube: non collegata']
    ];
    $('#h-status').innerHTML = '<ul class="clean small">' + rows.map(function (r) { return '<li>' + (r[0] === 'ok' ? '<span class="tag ok">Funziona</span>' : '<span class="tag soon">Non ancora</span>') + ' ' + esc(r[1]) + '</li>'; }).join('') + '</ul>';
  };
  $('#menu-grid').innerHTML = MENU.map(function (m) { return '<a href="#' + m[0] + '"><span class="ic"><svg><use href="#' + m[3] + '"/></svg></span><b>' + m[1] + '</b><small>' + m[2] + '</small></a>'; }).join('');

  function lyricLines(t) { return String(t || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l && !/^\[.*\]$/.test(l); }); }
  function analysisOf(s) { return s.lyrics.trim() ? LyricsEngine.analyze(s.lyrics) : null; }
  function topMood(s) { var a = analysisOf(s); return a && a.emotions.sufficient && a.emotions.items[0].count > 0 ? a.emotions.items[0].name : ''; }

  /* ================= Canzoni ================= */
  function songCard(s) {
    return '<div class="song ' + (s.id === LIB.cur ? 'on' : '') + '" data-act="pick" data-id="' + s.id + '"><div class="cover">' + esc((s.title || '?').charAt(0).toUpperCase()) + '</div><div class="m"><b>' + esc(s.title) + '</b><small>' +
      esc((FOLDERS.filter(function (f) { return f[0] === s.folder; })[0] || ['', ''])[1]) + ' · ' + esc(s.status) + ' · ' + s.prod.bpm + ' BPM · ' + NOTES[s.prod.tonic] + ' ' + s.prod.mode + '</small></div><svg width="18" height="18"><use href="#i-chev"/></svg></div>';
  }
  var delArm = false, folderSel = 'tutte';
  var FOLDERS = [['idee', 'Idee e appunti'], ['lavorazione', 'In lavorazione'], ['revisione', 'Da revisionare'], ['approvato', 'Approvati'], ['definitivo', 'Definitivi'], ['musica', 'Progetti musicali']];
  function inFolder(s, f) { return f === 'tutte' ? true : f === 'musica' ? ['base', 'voce', 'mix', 'clip', 'pubblicata'].indexOf(s.status) !== -1 : s.folder === f; }
  SHOW.canzoni = function () {
    var s = cur();
    $('#s-folders').innerHTML = [['tutte', 'Tutte']].concat(FOLDERS).map(function (f) { return '<button class="chip ' + (folderSel === f[0] ? 'on' : '') + '" data-folder="' + f[0] + '">' + f[1] + ' (' + LIB.songs.filter(function (x) { return inFolder(x, f[0]); }).length + ')</button>'; }).join('');
    var shown = LIB.songs.filter(function (x) { return inFolder(x, folderSel); });
    $('#s-list').innerHTML = shown.length ? shown.map(songCard).join('') : '<p class="empty">Nessuna canzone in questa cartella.</p>';
    var vers = s.versions.map(function (v, i) {
      return '<li><div class="row" style="justify-content:space-between"><span class="small"><b>Versione ' + (i + 1) + '</b> · ' + esc(v.date) + ' · ' + lyricLines(v.text).length + ' righe</span><button class="btn sm" data-act="restore" data-i="' + i + '">Ripristina</button></div></li>';
    }).reverse().join('');
    $('#s-detail').innerHTML = '<div class="card"><div class="card-head"><h3>Scheda: ' + esc(s.title) + '</h3></div><div class="stack">' +
      '<label class="f"><span>Titolo</span><input type="text" data-f="title" value="' + esc(s.title) + '"></label>' +
      '<div class="grid2"><label class="f"><span>Stato</span><select data-f="status">' + STATUSES.map(function (x) { return '<option' + (x === s.status ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' +
      '<label class="f"><span>Uscita prevista</span><input type="date" data-f="release" value="' + esc(s.release) + '"></label></div>' +
      '<div class="grid3"><label class="f"><span>Genere</span><select data-p="genre">' + Object.keys(ALLG).map(function (g) { return '<option value="' + g + '"' + (g === s.prod.genre ? ' selected' : '') + '>' + ALLG[g].label + '</option>'; }).join('') + '</select></label>' +
      '<label class="f"><span>BPM</span><input type="number" data-p="bpm" min="60" max="180" value="' + s.prod.bpm + '"></label>' +
      '<label class="f"><span>Tonalità</span><select data-p="tonic">' + NOTES.map(function (n, i) { return '<option value="' + i + '"' + (i === s.prod.tonic ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label></div>' +
      '<label class="f"><span>Scala</span><select data-p="mode"><option value="maggiore"' + (s.prod.mode === 'maggiore' ? ' selected' : '') + '>Maggiore</option><option value="minore"' + (s.prod.mode === 'minore' ? ' selected' : '') + '>Minore</option></select></label>' +
      '<label class="f"><span>Cartella del testo</span><select data-f="folder">' + FOLDERS.slice(0, 5).map(function (f) { return '<option value="' + f[0] + '"' + (f[0] === s.folder ? ' selected' : '') + '>' + f[1] + '</option>'; }).join('') + '</select></label>' +
      '<div class="row"><button class="btn sm pri" data-act="approve">Approva: sposta nei Definitivi</button></div>' +
      '<label class="f"><span>Umore</span><input type="text" data-f="mood" value="' + esc(s.mood || topMood(s)) + '" placeholder="Es. nostalgia"></label>' +
      '<label class="f"><span>Link (social, streaming)</span><textarea data-f="links" rows="2" placeholder="Un link per riga">' + esc(s.links) + '</textarea></label>' +
      '<label class="f"><span>Note, idee, copertine, clip</span><textarea data-f="notes" rows="3">' + esc(s.notes) + '</textarea></label>' +
      '</div><p class="small muted">Audio, foto e clip restano sul tuo telefono: qui scrivi dove sono e cosa sono.</p></div>' +
      '<div class="card"><div class="card-head"><h3>Versioni del testo</h3></div>' + (vers ? '<ul class="clean">' + vers + '</ul>' : '<p class="empty">Nessuna versione salvata. In Studio premi "Salva questa versione" prima di cambiare il testo.</p>') + '</div>' +
      '<div class="card"><div class="row"><button class="btn ' + (delArm ? 'danger' : '') + '" data-act="del">' + (delArm ? 'Conferma: elimina davvero' : 'Elimina questa canzone') + '</button>' + (delArm ? '<button class="btn" data-act="delno">Annulla</button>' : '') + '</div></div>';
  };
  $('#s-folders').addEventListener('click', function (e) { var f = e.target.getAttribute('data-folder'); if (f) { folderSel = f; SHOW.canzoni(); } });
  $('#s-new').addEventListener('click', function () { var s = newSong('Nuova canzone ' + (LIB.songs.length + 1)); LIB.songs.push(s); LIB.cur = s.id; persist(); delArm = false; SHOW.canzoni(); $('#top-song').textContent = s.title; });
  $('#v-canzoni').addEventListener('input', function (e) {
    var t = e.target, s = cur(), f = t.getAttribute('data-f'), p = t.getAttribute('data-p');
    if (f) { s[f] = t.value; if (f === 'title') $('#top-song').textContent = t.value || 'Senza titolo'; }
    else if (p) { s.prod[p] = (p === 'bpm' || p === 'tonic') ? Math.max(p === 'bpm' ? 60 : 0, Math.min(p === 'bpm' ? 180 : 11, +t.value || (p === 'bpm' ? 100 : 0))) : t.value; }
    persist();
  });
  $('#v-canzoni').addEventListener('change', function (e) { if (e.target.tagName === 'SELECT') { $('#s-list').innerHTML = LIB.songs.map(songCard).join(''); } });
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;
    var act = el.getAttribute('data-act'), s = cur();
    if (act === 'pick') { LIB.cur = el.getAttribute('data-id'); persist(); SESSION.base = null; delArm = false; SHOW.canzoni(); $('#top-song').textContent = cur().title; applyMood(); }
    else if (act === 'restore') { var v = s.versions[+el.getAttribute('data-i')]; if (v) { s.versions.push({ text: s.lyrics, date: today() }); s.lyrics = v.text; persist(); SHOW.canzoni(); } }
    else if (act === 'del') { if (!delArm) { delArm = true; SHOW.canzoni(); } else { LIB.songs = LIB.songs.filter(function (x) { return x.id !== s.id; }); LIB.cur = null; delArm = false; cur(); persist(); SHOW.canzoni(); $('#top-song').textContent = cur().title; } }
    else if (act === 'approve') { if (!s.lyrics.trim()) return; var lv = s.versions[s.versions.length - 1]; if (!lv || lv.text !== s.lyrics) s.versions.push({ text: s.lyrics, date: today() }); s.folder = 'definitivo'; persist(); SHOW.canzoni(); }
    else if (act === 'delno') { delArm = false; SHOW.canzoni(); }
  });

  /* ================= Studio: testo ================= */
  var anaT = null;
  function renderAnalysis() {
    var s = cur(), out = $('#st-analysis'), n = lyricLines(s.lyrics).length;
    $('#st-count').textContent = n + (n === 1 ? ' riga' : ' righe');
    if (!s.lyrics.trim()) { out.innerHTML = '<h3>Analisi del testo</h3><p class="empty">Scrivi o incolla un testo per vedere l\'analisi.</p>'; return; }
    var r = LyricsEngine.analyze(s.lyrics);
    var rhymed = r.stanzas.reduce(function (a, x) { return a + x.rhymedLines; }, 0);
    var h = '<div class="card-head"><h3>Analisi del testo</h3></div><div class="meters">' +
      meter('Strofe · righe', 'analisi', r.counts.stanzas + ' · ' + r.counts.lines, r.counts.words + ' parole') +
      meter('Sillabe per riga', 'analisi', fmt(r.syllables.average, 1), 'da ' + r.syllables.min + ' a ' + r.syllables.max + '. Conteggio approssimato.') +
      meter('Righe in rima', 'analisi', (r.counts.lines ? fmt(rhymed / r.counts.lines * 100) : '0') + '%', 'Rime perfette nella stessa strofa.') +
      meter('Finali aperti', 'analisi', fmt(r.singability.openEndingShare * 100) + '%', 'Righe che finiscono in vocale: più facili da tenere cantando.') + '</div>';
    r.stanzas.forEach(function (st) { h += '<p class="small"><b>' + esc(st.label) + '</b> · schema <span class="mono">' + esc(st.scheme) + '</span></p>'; });
    if (r.chorus) {
      h += '<h3 style="margin-top:12px">Ritornello ' + tag('ipotesi') + '</h3><p class="small">Memorabilità stimata <b class="mono">' + r.chorus.score + '/100</b>, su cinque criteri semplici del testo. Non è una previsione e non considera la melodia.</p>';
      r.chorus.components.forEach(function (k) { h += '<div class="small row" style="flex-wrap:nowrap"><span style="flex:0 0 42%;min-width:0">' + esc(k.name) + '</span><div class="bar" style="flex:1"><i style="width:' + (k.points / k.max * 100) + '%"></i></div><span class="mono">' + k.points + '/' + k.max + '</span></div>'; });
    }
    var e = r.emotions;
    h += '<h3 style="margin-top:12px">Tono emotivo ' + tag('ipotesi') + '</h3>';
    if (e.sufficient) {
      h += '<p class="small">Tono complessivo: <b>' + e.valence + '</b> (' + e.matchedWords + ' parole riconosciute su ' + e.totalWords + ').</p>';
      e.items.filter(function (i) { return i.count > 0; }).forEach(function (i) { h += '<div class="small row" style="flex-wrap:nowrap"><span style="flex:0 0 30%">' + cap(i.name) + '</span><div class="bar" style="flex:1"><i style="width:' + Math.round(i.share * 100) + '%"></i></div><span class="mono">' + Math.round(i.share * 100) + '%</span></div>'; });
      h += '<p class="small muted">Si basa su un piccolo dizionario: non capisce ironia, negazioni o metafore.</p>';
    } else h += '<p class="small">Poche parole riconosciute (' + e.matchedWords + '): non giudico il tono.</p>';
    h += '<h3 style="margin-top:12px">Suggerimenti</h3>';
    if (r.suggestions.length) h += '<ul class="clean small">' + r.suggestions.map(function (x) { return '<li>' + tag(x.kind) + ' <b>' + esc(x.text) + '</b><br><span class="muted">Perché: ' + esc(x.reason) + '</span></li>'; }).join('') + '</ul>';
    else h += '<p class="small muted">Nessun punto critico trovato con i controlli disponibili. Non significa che il testo sia perfetto.</p>';
    out.innerHTML = h;
  }
  function meter(label, kind, v, note) { return '<div class="meter"><div class="k"><span>' + label + '</span>' + tag(kind) + '</div><div class="v">' + v + '</div>' + (note ? '<p class="n">' + esc(note) + '</p>' : '') + '</div>'; }

  $('#st-title').addEventListener('input', function () { cur().title = this.value; $('#top-song').textContent = this.value || 'Senza titolo'; persist(); });
  $('#st-lyrics').addEventListener('input', function () {
    var s = cur();
    if (s.folder === 'definitivo' && s.lyrics.trim()) { s.versions.push({ text: s.lyrics, date: today() }); s.folder = 'lavorazione'; $('#st-msg').textContent = 'Testo definitivo modificato: la versione definitiva è salvata in Canzoni e il testo torna in lavorazione.'; }
    s.lyrics = this.value;
    if (s.status === 'idea' && s.lyrics.trim()) s.status = 'testo';
    persist(); clearTimeout(anaT); anaT = setTimeout(function () { renderAnalysis(); followBars(); applyMood(); renderGuide(); }, 300);
  });
  $('#st-ver').addEventListener('click', function () {
    var s = cur(); if (!s.lyrics.trim()) { $('#st-msg').textContent = 'Scrivi prima un testo.'; return; }
    var last = s.versions[s.versions.length - 1];
    if (last && last.text === s.lyrics) { $('#st-msg').textContent = 'Questa versione è già salvata.'; return; }
    s.versions.push({ text: s.lyrics, date: today() }); persist(); $('#st-msg').textContent = 'Versione ' + s.versions.length + ' salvata. La trovi in Canzoni.';
  });
  $('#st-suggest').addEventListener('click', function () {
    var s = cur(), a = analysisOf(s);
    if (!a) { $('#st-msg').textContent = 'Scrivi prima un testo.'; return; }
    var r = LyricsToBase.suggest(a, { tonic: s.prod.tonic });
    s.prod.genre = r.genre; s.prod.mode = r.mode; s.prod.bpm = r.bpm; s.prod.tonic = r.tonic; s.prod.tune = null; if (r.inst) s.prod.inst = r.inst; SESSION.base = null;
    $('#st-msg').textContent = 'Ipotesi: ' + r.why.join(' ') + ' Strumenti: ' + ['melodia', 'accordi', 'pad'].map(function (k) { return instName(s.prod.inst[k]); }).join(', ') + '. Puoi cambiare tutto qui sotto.';
    fillBase(); persist(); ensureInst();
  });


  /* ================= Guida alla voce: canta / parla / allunga ================= */
  var MODES = [['canta', 'Canta'], ['parla', 'Parla'], ['allunga', 'Allunga']];
  function renderGuide() {
    var s = cur(), lines = lyricLines(s.lyrics), el = $('#vg-list');
    if (!lines.length) { el.innerHTML = '<p class="empty">Scrivi il testo per assegnare le righe.</p>'; return; }
    el.innerHTML = lines.map(function (l, i) {
      var m = s.modes[l] || 'canta';
      return '<div class="vg"><div class="small"><b>' + (i + 1) + '.</b> ' + esc(l) + '</div><div class="seg" data-line="' + i + '">' + MODES.map(function (x) { return '<button data-m="' + x[0] + '" class="' + (m === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div></div>';
    }).join('');
  }
  $('#vg-list').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-m]'), seg = e.target.closest('[data-line]'); if (!b || !seg) return;
    var s = cur(), l = lyricLines(s.lyrics)[+seg.getAttribute('data-line')]; if (l == null) return;
    s.modes[l] = b.getAttribute('data-m'); persist(); renderGuide();
  });
  $('#vg-auto').addEventListener('click', function () {
    var s = cur(); if (!s.lyrics.trim()) { $('#vg-msg').textContent = 'Scrivi prima il testo.'; return; }
    var a = LyricsEngine.analyze(s.lyrics), n = { parla: 0, canta: 0, allunga: 0 };
    a.stanzas.forEach(function (st) {
      var chorus = /ritornello/i.test(st.label);
      st.lines.forEach(function (l, i) {
        var m = 'canta';
        if (!chorus && l.metric >= 11) m = 'parla';
        else if (chorus && i === st.lines.length - 1 && /[aeiouàèéìòù]$/i.test(l.text.replace(/[^\wàèéìòù]+$/i, ''))) m = 'allunga';
        s.modes[l.text] = m; n[m]++;
      });
    });
    persist(); renderGuide();
    $('#vg-msg').textContent = 'Ipotesi: ' + n.parla + ' righe parlate (lunghe, 11 sillabe o più nelle strofe), ' + n.allunga + ' allungate (ultima riga del ritornello se finisce in vocale), ' + n.canta + ' cantate. Cambia quello che non ti convince.';
  });

  /* ================= Studio: base ================= */
  var LEVEL_NAMES = { batteria: 'Batteria', basso: 'Basso', accordi: 'Accordi', arpeggio: 'Arpeggio', pad: 'Atmosfera (pad)', melodia: 'Melodia guida' };
  function followBars() {
    var s = cur(); if (!s.prod.follow) return;
    var tl = ClipFx.timeline(lyricLines(s.lyrics), { bpm: s.prod.bpm, syll: LyricsEngine.lineSyllables, modes: s.modes || {}, barsPerLine: s.prod.karBars || 'auto' });
    var n = Math.max(4, Math.min(64, tl.length ? tl[tl.length - 1].startBar + tl[tl.length - 1].bars : 8)); s.prod.bars = n; $('#b-bars').value = n; $('#b-barsv').textContent = n; persist();
  }
  function fillBase() {
    var p = cur().prod;
    $('#b-genre').value = p.genre; $('#b-bpm').value = p.bpm; $('#b-tonic').value = p.tonic; $('#b-mode').value = p.mode;
    fillInst(); $('#b-master').value = p.master || 'standard'; $('#b-sounds').value = p.sounds || 'campioni'; syncKar(); $('#b-bars').value = p.bars; $('#b-barsv').textContent = p.bars; $('#b-follow').checked = !!p.follow;
    $('#b-levels').innerHTML = Object.keys(LEVEL_NAMES).map(function (k) {
      return '<label class="f"><span>' + LEVEL_NAMES[k] + '<b data-lv="' + k + '">' + Math.round(p.levels[k] * 100) + '%</b></span><input type="range" min="0" max="180" value="' + Math.round(p.levels[k] * 100) + '" data-level="' + k + '"></label>';
    }).join('');
  }
  $('#b-genre').innerHTML = Object.keys(ALLG).map(function (g) { return '<option value="' + g + '">' + ALLG[g].label + '</option>'; }).join('');
  $('#b-tonic').innerHTML = NOTES.map(function (n, i) { return '<option value="' + i + '">' + n + '</option>'; }).join('');
  $('#b-genre').addEventListener('change', function () { cur().genreManual = true; var p = cur().prod; p.genre = this.value; p.tune = null; p.bpm = ALLG[this.value].bpm; if (['trap', 'drill', 'epico', 'boombap', 'street', 'trapdark', 'clubtrap'].indexOf(this.value) >= 0) { p.mode = 'minore'; $('#b-mode').value = 'minore'; } else if (this.value === 'estate') { p.mode = 'maggiore'; $('#b-mode').value = 'maggiore'; } if (Arranger.STYLES[this.value] && p.bars < 16) { p.bars = 32; $('#b-bars').value = 32; $('#b-barsv').textContent = 32; } $('#b-bpm').value = p.bpm;
    /* cambiare genere cambia TUTTO: ritmo, giro, strumenti, effetti (prima restavano quelli di prima e la base sembrava uguale) */
    var g = this.value, fam = DNA.LIST.filter(function (d) { return d.fam === g; })[0], sd = (Date.now() % 100000) + 1, R = Instruments.RECIPES[g] || {};
    if (fam) { var pr = DNA.toProd(fam, sd); p.groove = pr.groove; p.prog = pr.prog; p.tune = pr.tune; p.heavy = pr.heavy; p.leadRest = pr.leadRest; p.melSeed = pr.melSeed; p.tonic = pr.tonic; p.bpm = pr.bpm; p.mode = pr.mode; $('#b-bpm').value = p.bpm; $('#b-mode').value = p.mode; }
    else { var st = Arranger.STYLES[g] || {}, rx = Remix.make(sd, { half: !st.snare || st.snare.length === 1, mode: p.mode }); p.groove = rx.groove; p.prog = rx.prog; p.tune = rx.tune; p.melSeed = rx.melSeed; p.leadRest = undefined; }
    p.seed = sd; p.kit = null; p.arpPattern = undefined; p.bassStyle = ['trap', 'trapdark', 'drill', 'brooklyn', 'street', 'rage', 'phonk'].indexOf(g) >= 0 ? '808' : undefined;
    try { p.sig = SigFx.pick({ styleText: '', seed: sd, scenes: [], genre: g }); } catch (e) {}
    p.inst = Object.assign({}, p.inst || {}); ['melodia', 'accordi', 'pad'].forEach(function (role) { var l = (R[role] || []).filter(function (id) { return !BANNED_INST[id]; }); if (l.length) p.inst[role] = l[(sd + role.length) % l.length]; });
    persist(); try { fillInst(); } catch (e) {} makeAndPlay(false); });
  ['#kar-speed', '#kar-speed2'].forEach(function (id) { var el = $(id); if (el) el.addEventListener('change', function () { cur().prod.karBars = this.value === 'auto' ? 'auto' : +this.value; persist(); syncKar(); }); });
  function syncKar() { var v = String(cur().prod.karBars || 'auto'); ['#kar-speed', '#kar-speed2'].forEach(function (id) { var el = $(id); if (el) el.value = v; }); }
  $('#b-sounds').addEventListener('change', function () { cur().prod.sounds = this.value; persist(); });
  $('#b-master').addEventListener('change', function () { cur().prod.master = this.value; persist(); });
  $('#b-bpm').addEventListener('change', function () { cur().prod.bpm = Math.max(60, Math.min(180, +this.value || 100)); this.value = cur().prod.bpm; persist(); });
  $('#b-tonic').addEventListener('change', function () { cur().prod.tonic = +this.value; persist(); });
  $('#b-mode').addEventListener('change', function () { cur().prod.mode = this.value; persist(); });
  $('#b-bars').addEventListener('input', function () { cur().prod.bars = +this.value; $('#b-barsv').textContent = this.value; persist(); });
  $('#b-follow').addEventListener('change', function () { cur().prod.follow = this.checked; followBars(); persist(); });
  $('#b-levels').addEventListener('input', function (e) {
    var k = e.target.getAttribute('data-level'); if (!k) return;
    cur().prod.levels[k] = +e.target.value / 100; $('[data-lv="' + k + '"]').textContent = e.target.value + '%'; persist();
  });


  var taps = [];
  $('#b-tap').addEventListener('click', function () {
    var now = performance.now(); if (taps.length && now - taps[taps.length - 1] > 2000) taps = []; taps.push(now); taps = taps.slice(-8);
    if (taps.length >= 3) { var d = []; for (var i = 1; i < taps.length; i++) d.push(taps[i] - taps[i - 1]); var avg = d.reduce(function (a, b) { return a + b; }, 0) / d.length, bpm = Math.max(60, Math.min(180, Math.round(60000 / avg))); cur().prod.bpm = bpm; $('#b-bpm').value = bpm; persist(); $('#b-status').textContent = 'Tempo battuto: ' + bpm + ' BPM.'; }
    else $('#b-status').textContent = 'Continua a battere il ritmo (almeno 3 colpi).';
  });
  // Mappa della canzone: se c'è un testo, la struttura della base viene dal testo (righe sulle battute giuste).
  function songMap() {
    var s = cur(), p = s.prod;
    if (p.useLyrics === false || !lyricLines(s.lyrics).length) return null;
    return SongMap.build(s.lyrics, { bpm: p.bpm, syll: LyricsEngine.lineSyllables, modes: s.modes || {} });
  }
  function getBase() {
    var p = cur().prod, map = songMap(), key = JSON.stringify([cur().id, p.genre, p.bpm, p.tonic, p.mode, p.bars, p.seed, p.melSeed, p.heavy, p.leadRest, pfSig(p).join(), p.bassStyle, p.tune, p.sounds, p.inst, p.arpPattern, p.groove, p.prog, p.perc, p.drumPat, p.chordBars, p.arp, p.kit, p.notes, p.b808, p.fxList, map && map.plan, Instruments.loaded().length]);
    if (SESSION.baseKey !== key || !SESSION.base) { SESSION.base = (Arranger.STYLES[p.genre] ? Arranger : Backing).generate({ sampleRate: 32000, bpm: p.bpm, tonic: p.tonic, mode: p.mode, bars: p.bars, genre: p.genre, seed: p.seed, melSeed: p.melSeed || 0, heavy: !!p.heavy, leadRest: typeof p.leadRest === 'number' ? p.leadRest : undefined, sig: pfSig(p), bassStyle: p.bassStyle || undefined, tune: p.tune || undefined, inst: p.inst || undefined, plan: map ? map.plan : undefined, arpPattern: p.arpPattern || undefined, groove: p.groove || undefined, prog: p.prog || undefined, drumPat: p.drumPat || undefined, drumRender: p.kit && SynthDesign.KITS[p.kit] ? function (part, o, s2) { return SynthDesign.kitRender(p.kit, part, o, s2); } : undefined, chordBars: p.chordBars || undefined, arp: p.arp === false ? false : undefined, percEvents: p.perc && p.perc.type ? function (secs, sr) { return SynthDesign.percEvents(p.perc.type, secs, sr, p.perc.on || ['strofa', 'ritornello']); } : undefined, notes: p.notes || undefined, bassRender: p.b808 ? function (m, d, s2, from, gl) { return SynthDesign.b808(p.b808, m, d, s2, from, gl); } : undefined, extraFx: p.fxList && p.fxList.length ? extraFxBufs(p) : undefined, sounds: p.sounds === 'sint' ? 'sint' : 'campioni' }); SESSION.baseKey = key; }
    return SESSION.base;
  }
  function activeTake() { return SESSION.takes.filter(function (t) { return t.id === SESSION.takeId; })[0] || null; }
  // Costruisce il mix completo. opts.voice: includere la voce selezionata.
  function buildMix(opts) {
    opts = opts || {};
    var p = cur().prod, samples, sr, bpm = p.bpm, imp = SESSION.useImported && SESSION.imported;
    if (imp) { samples = imp.mono; sr = imp.sr; bpm = imp.bpm || p.bpm; }
    else {
      var b = getBase(); sr = b.sampleRate; bpm = p.bpm;
      samples = Backing.mix(b, p.levels, p.sec);
      if (p.reverb > 0) samples = Polish.reverb(samples, sr, { mix: Math.min(0.5, p.reverb), roomSize: 1 });
    }
    var t = opts.voice ? activeTake() : null, used = null;
    if (t) {
      var vgain = +$('#v-gain').value / 100, off = (+$('#v-bar').value || 0) * 4 * 60 / bpm + (+$('#v-off').value || 0) / 1000 - (t.lat || 0);
      samples = Backing.withVoice(samples, sr, t.final || t.mono, t.sr, vgain, off); used = t.final ? 'elaborata' : 'originale';
    }
    var mp = cur().prod.master || 'standard', mrep = null;
    if (mp !== 'off' && Master.PRESETS[mp]) { var mr = Master.process(samples, sr, mp); samples = mr.samples; mrep = mr.report; }
    return { samples: samples, sr: sr, bpm: bpm, voice: used, master: mrep };
  }
  // Testo che scorre: ogni riga dura in base alle sillabe e al modo (canta/parla/allunga); la parola in corso è evidenziata.
  function karaokeTick(bpm, sel) {
    sel = sel || '#kar';
    var smap = SESSION.useImported ? null : songMap();
    if (smap) { var lk = ''; return function (t) { var h = lyricHtml(smap, t), k2 = h.key; if (k2 === lk) return; lk = k2; $(sel).innerHTML = h.html; }; }
    var lines = lyricLines(cur().lyrics), per = cur().prod.karBars || 'auto';
    var tl = ClipFx.timeline(lines, { bpm: bpm, syll: LyricsEngine.lineSyllables, modes: cur().modes || {}, barsPerLine: per }), lastKey = '';
    return function (t) {
      if (!tl.length) { if (lastKey !== 'x') $(sel).innerHTML = '<div><b>Scrivi un testo per vederlo qui</b></div>'; lastKey = 'x'; return; }
      var p = ClipFx.lineAt(tl, t), key = p.index + ':' + p.word + ':' + p.bar;
      if (key === lastKey) return; lastKey = key; // aggiorna la pagina solo quando cambia qualcosa (meno lavoro per l'iPhone)
      var words = p.line.words.map(function (w, k) { return k === p.word ? '<mark>' + esc(w.w) + '</mark>' : (k < p.word ? '<span class="sung">' + esc(w.w) + '</span>' : esc(w.w)); }).join(' ');
      $(sel).innerHTML = '<div><span class="mode">' + p.line.mode + ' · ' + p.line.bars + (p.line.bars > 1 ? ' battute' : ' battuta') + '</span><br><b class="kw">' + words + '</b><small>Battuta ' + (p.bar + 1) + '/' + p.line.bars + ' · poi: ' + esc(p.next.text) + '</small></div>';
    };
  }
  async function makeAndPlay(newVariant) {
    var st = $('#b-status'), p = cur().prod;
    if (newVariant && SESSION.lastPlay && performance.now() - SESSION.lastPlay.t < 10000) coachRec('skip', SESSION.lastPlay.ctx);
    if (newVariant) p.seed++;
    st.textContent = 'Sto componendo la base…'; await tick();
    await ensureInst();
    try {
      var mx = buildMix({ voice: false });
      if (gvS().on && !SESSION.useImported && cur().lyrics && cur().lyrics.trim()) { st.textContent = 'Aggiungo la voce guida…'; await tick(); mx = gvAdd(mx); }
      var lp = SESSION.lastPlay = { t: performance.now(), ctx: coachCtx(), dur: mx.samples.length / mx.sr };
      var ok = playBuf(mx.samples, mx.sr, karaokeTick(mx.bpm), function () { $('#kar').innerHTML = '<div><b>Fine</b><small>Premi di nuovo per ricantare</small></div>'; if ((performance.now() - lp.t) / 1000 > lp.dur * 0.9) coachRec('complete', lp.ctx); });
      if (!ok) { st.textContent = 'Questo browser non riesce a riprodurre audio.'; return null; }
      st.textContent = ''; SESSION.baseMade = true; try { dwSteps(); projLine(); DW.bufKey = ''; dwRefresh(); } catch (e) {}
      var s = cur(); if (['idea', 'testo'].indexOf(s.status) !== -1) { s.status = 'base'; persist(); }
      var b = SESSION.useImported ? null : getBase();
      $('#b-out').innerHTML = b ? '<div class="note"><b>' + esc(ALLG[b.genre].label) + '</b> in ' + NOTES[b.tonic] + ' ' + b.mode + ', ' + b.bpm + ' BPM, ' + b.bars + ' battute (' + fmt(b.duration) + ' s). Accordi: <span class="mono">' + b.progression.join(' · ') + '</span>. ' + (b.inst && (b.inst.melodia || b.inst.accordi || b.inst.pad) ? 'Strumenti: ' + ['melodia', 'accordi', 'pad'].filter(function (r) { return b.inst[r]; }).map(function (r) { return instName(b.inst[r]) + ' (' + r + ')'; }).join(', ') + '.' : 'Suoni sintetici.') + ' "Nuova variante" cambia la melodia.' + (b.sections ? '<br>Struttura: <span class="mono">' + b.sections.map(function (x) { return x.name + ' ' + x.bars; }).join(' · ') + '</span>' : '') + '</div>' : '';
      if (mx.guide) $('#b-out').insertAdjacentHTML('beforeend', '<p class="small muted">Canta la voce guida: uomo, sintetica, autotune duro (' + mx.guide + ' sillabe). Si regola in «3 Voce».</p>');
      return mx;
    } catch (e) { st.textContent = 'Non sono riuscito a creare la base. Prova con meno battute.'; return null; }
  }
  /* ===== Rime dal dizionario personale ===== */
  function wbStore() { LIB.settings.words = LIB.settings.words || WordBank.newBank(); return LIB.settings.words; }
  function wbLearnSongs() { var b = wbStore(); if (b.songsAt === cur().id + ':' + (cur().lyrics || '').length) return; WordBank.learn(b, cur().lyrics || ''); b.songsAt = cur().id + ':' + (cur().lyrics || '').length; persist(); }
  function rhChips(list, cls) { return list.map(function (x) { return '<span class="tag ' + cls + '" style="margin:2px;display:inline-block" title="' + x.syll + ' sillabe">' + esc(x.word) + (x.mine ? ' ★' : '') + ' <small>' + x.syll + '</small></span>'; }).join(' '); }

  /* ===== Assistente testi (AI locale, opzionale) ===== */
  (function () {
    var sel = $('#ai-model'); if (!sel) return;
    sel.innerHTML = '<option value="ollama">Ollama sul computer (migliore, se lo hai)</option>' + LocalAI.MODELS.map(function (m) { return '<option value="' + m.id + '">' + m.label + ' · ' + m.note + '</option>'; }).join('');
    /* artista: cartelle imparate (numeri misurati) + atmosfere; il linguaggio crudo è una scelta tua e si ricorda */
    (function () {
      var as = $('#ai-artist'), rw = $('#ai-raw'); if (!as || !rw) return; var h = '<option value="">Nessuno: solo il mio stile</option>', st = arStore();
      var names = Object.keys(st).filter(function (n) { return st[n].on; });
      if (names.length) h += '<optgroup label="Le tue cartelle artista">' + names.map(function (n) { return '<option value="a:' + esc(n) + '">' + esc(n) + '</option>'; }).join('') + '</optgroup>';
      if (window.StylePresets) h += '<optgroup label="Atmosfere">' + StylePresets.LIST.map(function (pr) { return '<option value="p:' + pr.id + '">' + esc(pr.nome) + '</option>'; }).join('') + '</optgroup>';
      as.innerHTML = h; try { if (LIB.settings.aiRaw) rw.value = LIB.settings.aiRaw; if (LIB.settings.aiArtist) as.value = LIB.settings.aiArtist; } catch (e) {}
      as.addEventListener('change', function () { LIB.settings.aiArtist = as.value; persist(); }); rw.addEventListener('change', function () { LIB.settings.aiRaw = rw.value; persist(); });
    })();
    function aiArtist() {
      var v = ($('#ai-artist') || {}).value || ''; if (!v) return null;
      if (v.indexOf('a:') === 0) { var n = v.slice(2), st = arStore(); try { var P = ArtistLab.blend([ArtistLab.finalize(st[n].acc)], [n]); return { name: n, note: P && P.mood ? P.mood : '' }; } catch (e) { return { name: n, note: '' }; } }
      var pr = StylePresets.byId(v.slice(2)); return pr ? { name: pr.nome, note: (pr.spiega || '') + ' Circa ' + pr.bpm + ' BPM.' } : null;
    }
    var ramBox = $('#ai-ram'); if (ramBox) ramBox.addEventListener('change', function () { var r = LocalAI.recommend(ramBox.value); $('#ai-ramnote').innerHTML = r.note + ' Comando da scrivere nel Terminale: <span class="mono">ollama pull ' + r.model + '</span>'; });
    function ready(on) { ['#ai-v', '#ai-p', '#ai-c', '#ai-m', '#ai-r'].forEach(function (i) { var el = $(i); if (el) el.disabled = !on; }); }
    var LINE = '';
    function lyTa() { var d = $('#dw-lyrics'); return d && d.offsetParent ? d : $('#st-lyrics'); }
    function pickLine() {
      var ta = lyTa(), ls = lyricLines(cur().lyrics), t = ta ? ta.value : cur().lyrics;
      if (ta && ta.selectionStart != null && ta.selectionEnd > ta.selectionStart) { LINE = t.slice(ta.selectionStart, ta.selectionEnd).trim(); }
      else { var pos = ta && ta.selectionStart != null ? ta.selectionStart : t.length, a = t.lastIndexOf('\n', pos - 1) + 1, b = t.indexOf('\n', pos); LINE = t.slice(a, b < 0 ? t.length : b).trim(); if (!LINE || /^\[/.test(LINE)) LINE = ls.length ? ls[ls.length - 1] : ''; }
      return LINE;
    }
    $('#ai-on').addEventListener('click', async function () {
      var m = $('#ai-msg');
      if (sel.value === 'ollama') { try { var nm = await LocalAI.useOllama(); m.textContent = 'Collegato a Ollama (' + nm + '). Seleziona una riga e scegli cosa vuoi.'; ready(true); } catch (e) { m.textContent = e.message; } return; } if (!LocalAI.supported()) { m.textContent = 'Questo browser non ha WebGPU: l\'assistente AI non può partire qui. Il cervello Sultan funziona lo stesso.'; return; }
      m.textContent = 'Scarico il modello (solo la prima volta)…'; this.disabled = true;
      try { await LocalAI.load(sel.value, function (p) { m.textContent = (p && p.text ? p.text : 'Carico…').slice(0, 90) + (p && p.progress != null ? ' ' + Math.round(p.progress * 100) + '%' : ''); }); m.textContent = 'Assistente pronto. Seleziona una riga nel testo e scegli cosa vuoi.'; ready(true); }
      catch (e) { m.textContent = 'Non è partito: ' + (e && e.message ? e.message : e); this.disabled = false; }
    });
    async function go(task) {
      var line = pickLine(), out = $('#ai-out'); if (!line && task !== 'ritornello') { out.innerHTML = '<p class="small">Scrivi o seleziona prima una riga.</p>'; return; }
      var s = cur(), M = arModel(), last = line.replace(/[^\wàèéìíòóùú\s']/gi, ' ').trim().split(/\s+/).pop(), rh = [];
      try { wbLearnSongs(); var r = WordBank.rhymes(wbStore(), last, { max: 8 }); rh = (r.rhyme || []).map(function (x) { return x.w || x; }); } catch (e) {}
      out.innerHTML = '<p class="small">Penso…</p>';
      try {
        var sc = {}; try { sc = SultanBrain.plan(s.lyrics, analysisOf(s), {}).scenes || {}; } catch (e) {} var topSc = Object.keys(sc).filter(function (k) { return sc[k] > 0; }).sort(function (a, b) { return sc[b] - sc[a]; }).slice(0, 3).join(', ');
        var res = await LocalAI.ask(task, { artist: aiArtist(), raw: ($('#ai-raw') || {}).value || 'crudo', taste: Taste.summary(tasteMem()), scenes: topSc, line: line || '', context: lyricLines(s.lyrics).slice(task === 'ritornello' ? -14 : -6).join('\n'), genre: (ALLG[s.prod.genre] || {}).label || s.prod.genre, mood: s.moodTarget || 'dark', syll: line ? ((LyricsEngine.lineSyllables(line) || {}).metric || 10) : 8, rhymes: rh, artistNote: M ? M.mood : '' });
        out.innerHTML = res.length ? '<ul class="clean small">' + res.map(function (x, i) { return '<li>' + esc(x) + ' <button class="chip" data-ai-use="' + i + '" style="min-height:28px;padding:2px 10px">Usa</button></li>'; }).join('') + '</ul><p class="small muted"><span class="tag i">Ipotesi</span> Sono bozze di un modello piccolo: controlla senso e rime.</p>' : '<p class="small">Nessuna proposta utile, riprova.</p>';
        out._res = res; out._line = line; out._task = task;
      } catch (e) { out.innerHTML = '<p class="small">Errore: ' + esc(e && e.message ? e.message : e) + '</p>'; }
    }
    $('#ai-v').addEventListener('click', function () { go('versioni'); });
    $('#ai-p').addEventListener('click', function () { go('punchline'); });
    $('#ai-c').addEventListener('click', function () { go('continua'); });
    $('#ai-m').addEventListener('click', function () { go('migliora'); });
    $('#ai-r').addEventListener('click', function () { go('ritornello'); });
    $('#ai-out').addEventListener('click', function (e) {
      var i = e.target && e.target.getAttribute && e.target.getAttribute('data-ai-use'); if (i == null) return;
      var out = $('#ai-out'), txt = out._res[+i], s = cur(), ta = lyTa();
      s.lyrics = out._task === 'continua' ? s.lyrics.replace(/\s+$/, '') + '\n' + txt : out._task === 'ritornello' ? s.lyrics.replace(/\s+$/, '') + '\n\n[Ritornello]\n' + txt : s.lyrics.replace(out._line, txt);
      if (ta) { ta.value = s.lyrics; ta.dispatchEvent(new Event('input', { bubbles: true })); } persist(); out.insertAdjacentHTML('beforeend', '<p class="small">Inserita nel testo.</p>');
    });
  })();
  $('#rh-go').addEventListener('click', function () {
    var w = ($('#rh-word').value || '').trim(), out = $('#rh-out');
    if (!w) { var ls = lyricLines(cur().lyrics); var last = ls.length ? ls[ls.length - 1].replace(/[^\wàèéìíòóùú\s']/gi, ' ').trim().split(/\s+/).pop() : ''; w = last || ''; $('#rh-word').value = w; }
    if (!w) { out.innerHTML = '<p class="small">Scrivi una parola o prima un po\' di testo.</p>'; return; }
    wbLearnSongs();
    var r = WordBank.rhymes(wbStore(), w, { max: 28 });
    out.innerHTML = (r.rhyme.length ? '<p class="small"><b>Rime piene con "' + esc(r.word) + '"</b> (' + r.syll + ' sillabe) <span class="tag m">Misurato</span></p><div>' + rhChips(r.rhyme, 'm') + '</div>' : '<p class="small">Nessuna rima piena trovata nel dizionario.</p>') +
      (r.assonance.length ? '<p class="small" style="margin-top:8px"><b>Assonanze</b> (stesse vocali, suono vicino) <span class="tag i">Ipotesi</span></p><div>' + rhChips(r.assonance, 'i') + '</div>' : '') +
      '<p class="small muted">★ = parola dai tuoi testi. Il numero è quante sillabe ha: ti serve per far stare la riga nel metro.</p>';
  });
  /* ===== Cartelle artista: stile misurato dai testi caricati (solo numeri) ===== */
  function arStore() { LIB.settings.artists = LIB.settings.artists || {}; return LIB.settings.artists; }
  function tasteMem() { return LIB.settings.taste || (LIB.settings.taste = Taste.newMem()); }
  function arModel() {
    var b = arModel0(), t = Taste.profile(tasteMem()); if (!t) return b; if (!b) return t;
    var sc = Object.assign({}, b.styleScore || {}); Object.keys(t.styleScore).forEach(function (g) { sc[g] = (sc[g] || 0) + 1.5 * t.styleScore[g]; });
    return Object.assign({}, b, { styleScore: sc, names: (b.names || '') + ' + ' + t.names });
  }
  function arModel0() {
    var st = arStore(), names = Object.keys(st).filter(function (n) { return st[n].on; });
    var a = names.length ? ArtistLab.blend(names.map(function (n) { return ArtistLab.finalize(st[n].acc); }), names) : null, bp = beatProfile();
    if (!a) return bp; if (!bp) return a;
    var sc = Object.assign({}, a.styleScore || {}); Object.keys(bp.styleScore).forEach(function (g) { sc[g] = (sc[g] || 0) + 0.7 * bp.styleScore[g]; });
    return Object.assign({}, a, { styleScore: sc, names: (a.names || '') + ' + ' + bp.names });
  }
  // basi imparate (solo numeri) → profilo per il cervello: quanto ogni stile pesa nelle canzoni che ti piacciono
  function beatProfile() {
    var L = (LIB.settings.learned || []).filter(function (r) { return r.vote > 0 && r.prof; }); if (!L.length) return null;
    var map = { trap: 'trap', drill: 'drill', melodico: 'melodico', estate: 'estate', epico: 'epico' }, sc = {};
    L.forEach(function (r) { var g = map[r.prof.style] || 'trap'; if (r.prof.style === 'trap' && r.prof.sub > 0.55) g = 'trapdark'; sc[g] = (sc[g] || 0) + 1 / L.length; });
    var arts = []; L.forEach(function (r) { if (r.artist && arts.indexOf(r.artist) < 0) arts.push(r.artist); });
    return { styleScore: sc, names: 'basi imparate' + (arts.length ? ' (' + arts.slice(0, 3).join(', ') + ')' : ''), mood: 'ritmo vicino alle ' + L.length + ' basi che ti piacciono' };
  }
  function arBars(P) { return P.top.slice(0, 5).map(function (t) { return '<div class="small">' + esc(ArtistLab.SCENE_IT[t.scene]) + ' <b>' + Math.round(t.share * 100) + '%</b><div style="height:6px;border-radius:3px;background:var(--line,#333);overflow:hidden"><i style="display:block;height:100%;width:' + Math.round(t.share * 100) + '%;background:var(--acc,#8b5cf6)"></i></div></div>'; }).join(''); }
  function arRender() {
    var st = arStore(), names = Object.keys(st);
    $('#ar-list').innerHTML = names.map(function (n) {
      var P = ArtistLab.finalize(st[n].acc); if (!P) return '';
      return '<div class="card"><div class="card-head"><h3>' + esc(n) + '</h3><span class="tag m">' + P.songs + ' brani · ' + P.lines + ' righe</span></div>' +
        '<div class="sw"><label for="ar-on-' + esc(n) + '">Usa nel mio modello</label><input type="checkbox" data-aron="' + esc(n) + '" id="ar-on-' + esc(n) + '"' + (st[n].on ? ' checked' : '') + '></div>' +
        '<p class="small"><b>Umore:</b> ' + esc(P.mood) + '</p>' + arBars(P) +
        '<ul class="clean small"><li>Sillabe per riga: <b>' + P.avgSyll + '</b> <span class="tag m">Misurato</span></li><li>Righe in rima: <b>' + Math.round(P.rhyme * 100) + '%</b></li><li>Ripetizioni: <b>' + Math.round(P.rep * 100) + '%</b></li><li>Varietà di parole: <b>' + Math.round(P.richness * 100) + '%</b></li>' +
        (P.pairs.length ? '<li>Mondi che stanno insieme: ' + P.pairs.slice(0, 3).map(function (q) { return esc(q.pair.split('+').map(function (k) { return ArtistLab.SCENE_IT[k]; }).join(' + ')) + ' (' + q.lines + ' righe)'; }).join('; ') + '</li>' : '') + '</ul>' +
        (P.enough ? '' : '<p class="small muted">Pochi dati (meno di 20 righe): le misure sono ancora instabili. Aggiungi altri brani.</p>') +
        '<div class="row"><button class="btn sm" data-ardel="' + esc(n) + '">Elimina cartella</button></div></div>';
    }).join('') || '<div class="card"><p class="small muted">Nessuna cartella ancora. Creane una qui sopra.</p></div>';
    var M = arModel();
    $('#ar-model').innerHTML = M ? '<p><b>' + esc(M.names) + '</b></p><p class="small">' + esc(M.mood) + '</p><ul class="clean small"><li>Sillabe per riga: ' + M.avgSyll + '</li><li>Rime: ' + Math.round(M.rhyme * 100) + '% · Ripetizioni: ' + Math.round(M.rep * 100) + '%</li></ul><p class="small muted">Il bottone "Cervello Sultan" in Testo e Base ora segue questo modello.</p>' : 'Spunta una o più cartelle: il modello è la loro media.';
  }
  SHOW.artisti = arRender;
  async function arAdd() {
    var nm = ($('#ar-name').value || '').trim(), m = $('#ar-msg'); m.className = 'status';
    if (!nm) { m.textContent = 'Scrivi il nome della cartella (es. un artista).'; return; }
    var texts = [], f = $('#ar-files').files;
    for (var i = 0; i < f.length; i++) { try { texts.push(await f[i].text()); } catch (e) {} }
    var pasted = ($('#ar-text').value || '').trim(); if (pasted) pasted.split(/\n\s*---+\s*\n/).forEach(function (t) { if (t.trim()) texts.push(t); });
    if (!texts.length) { m.textContent = 'Carica un file .txt o incolla un testo.'; return; }
    var st = arStore(), rec = st[nm] || (st[nm] = { acc: ArtistLab.newAcc(), on: false }), added = 0;
    texts.forEach(function (t) { var me = ArtistLab.measure(t); if (me.lines) { rec.acc = ArtistLab.merge(rec.acc, me); added++; WordBank.learn(wbStore(), t); } });
    if (!added) { m.textContent = 'Non ho trovato righe di testo da misurare.'; if (!rec.acc.lines) delete st[nm]; return; }
    persist(); $('#ar-files').value = ''; $('#ar-text').value = '';
    m.textContent = 'Aggiunti ' + added + ' brani a "' + nm + '". Ho tenuto solo i numeri, non il testo.'; arRender();
  }
  $('#ar-add').addEventListener('click', arAdd);
  $('#ar-list').addEventListener('change', function (e) { var n = e.target.getAttribute('data-aron'); if (n && arStore()[n]) { arStore()[n].on = e.target.checked; persist(); arRender(); } });
  $('#ar-list').addEventListener('click', function (e) { var n = e.target.getAttribute('data-ardel'); if (n) { delete arStore()[n]; persist(); arRender(); } });
  $('#ar-cmp').addEventListener('click', function () {
    var M = arModel(), s = cur(); if (!M) { $('#ar-adv').innerHTML = '<p class="small">Spunta prima almeno una cartella.</p>'; return; }
    $('#ar-adv').innerHTML = '<ul class="clean small">' + ArtistLab.compare(s.lyrics, M).map(function (x) { return '<li><span class="tag ' + (x.tag === 'Misurato' ? 'm' : 'i') + '">' + x.tag + '</span> ' + esc(x.text) + '</li>'; }).join('') + '</ul>';
  });
  /* ===== Cervello Sultan nel Beat Lab ===== */
  function blBrain(again) {
    var s = cur(), m = $('#bl-brain-msg');
    if (!s.lyrics.trim()) { m.textContent = 'Scrivi prima il testo in Testo e Base: il cervello parte da quello.'; return; }
    if (!window.BeatLabUI || !window.BeatLabUI.state.project) { m.textContent = 'Il Beat Lab si sta caricando: riprova tra un secondo.'; return; }
    s.brainBL = again ? (s.brainBL || 0) + 1 : 0;
    var pl = SultanBrain.plan(s.lyrics, analysisOf(s), { variant: s.brainBL, profile: arModel(), mood: $('#bl-mood').value || null }), r = window.BeatLabUI.applyBrain(pl);
    m.innerHTML = '<b>' + esc(pl.label) + '</b> → stile Beat Lab "' + esc(r.style) + '" · ' + r.bpm + ' BPM · ' + NOTES[pl.tonic] + ' ' + (pl.mode === 'maggiore' ? 'maggiore' : 'minore') + '<br>' + pl.why.slice(0, 3).map(esc).join('<br>') + '<br><span class="tag i">Ipotesi</span> Premi "Suona". Se non ti piace: "Altra versione".';
  }
  $('#bl-brain').addEventListener('click', function () { blBrain(false); });
  $('#bl-brain2').addEventListener('click', function () { blBrain(true); });
  /* ===== Orecchio di Sultan: ascolto con strumenti di misura ===== */
  function earMeasure() { var p = cur().prod, mx = buildMix({ voice: false }); return Ear.listen(mx.samples, mx.sr, { genre: SESSION.useImported ? null : p.genre, bpm: p.bpm }); }
  function earApply(r) {
    var p = cur().prod, ch = [], add = {};
    r.findings.forEach(function (f) { if (f.fix && f.fix.levels) Object.keys(f.fix.levels).forEach(function (k) { add[k] = (add[k] || 0) + f.fix.levels[k]; }); });
    Object.keys(add).forEach(function (k) { if (p.levels[k] == null) return; var nv = Math.max(0.1, Math.min(1.8, Math.round((p.levels[k] + Math.max(-0.4, Math.min(0.4, add[k]))) * 100) / 100)); if (nv !== p.levels[k]) { ch.push(LEVEL_NAMES[k] + ' ' + Math.round(p.levels[k] * 100) + '% → ' + Math.round(nv * 100) + '%'); p.levels[k] = nv; } });
    if (ch.length) { persist(); fillBase(); }
    return ch;
  }
  function earHtml(r) {
    var M = r.metrics, sh = M.shares;
    return '<div class="note"><b>Orecchio di Sultan</b> <span class="tag m">Misurato</span> · verdetto: <b>' + esc(r.verdict) + '</b>' +
      '<ul class="clean small"><li>Livello medio ' + M.rmsDb + ' dB, picco ' + M.peakDb + ' dB, dinamica (crest) ' + M.crestDb + ' dB</li>' +
      '<li>Grave (sotto 250 Hz) ' + Math.round(M.lowShare * 100) + '% · sub ' + Math.round(sh.sub * 100) + '% · medi ' + Math.round((sh['medio-basso'] + sh.medio) * 100) + '% · presenza ' + Math.round(sh.presenza * 100) + '% · aria ' + Math.round(sh.aria * 100) + '%</li>' +
      '<li>Centro di gravità ' + M.centroidHz + ' Hz · colpi nel grave ' + (M.lowHitsPerBar == null ? '–' : M.lowHitsPerBar + ' a battuta') + '</li></ul>' +
      (r.findings.length ? '<ul class="clean small">' + r.findings.map(function (f) { return '<li><span class="tag ' + (f.level === 'errore' ? 'soon' : (f.tag === 'Ipotesi' ? 'i' : 'm')) + '">' + (f.level === 'errore' ? 'Errore' : (f.tag || 'Misurato')) + '</span> ' + esc(f.text) + '</li>'; }).join('') + '</ul>' : '<p class="small">Nessun problema misurabile.</p>') + '</div>';
  }
  function earMoodNote(r) {
    var s = cur(), p = s.prod, want = s.moodTarget; if (!want || SESSION.useImported) return '';
    var m = Ear.moodOf({ mode: p.mode, bpm: p.bpm, centroidHz: r.metrics.centroidHz, lowShare: r.metrics.lowShare });
    var ok = m.top === want || m.second === want;
    return '<p class="small"><span class="tag i">Ipotesi</span> Umore voluto: <b>' + esc(want) + '</b>. La base misurata suona soprattutto <b>' + esc(m.top) + '</b> (poi ' + esc(m.second) + '). ' + (ok ? 'Coincidono.' : 'Non coincidono: scegli l\'umore in alto e premi "Altra versione dal testo", oppure cambia scala e velocità.') + '</p>';
  }
  async function earRun(auto) {
    var out = $('#ear-out'); out.innerHTML = '<p class="small muted">Ascolto la base con gli strumenti di misura…</p>'; await tick();
    try {
      var r = earMeasure(), fixed = [];
      if (auto) for (var i = 0; i < 2; i++) { var ch = r.findings.some(function (f) { return f.fix && f.fix.levels; }) ? earApply(r) : []; if (!ch.length) break; fixed = fixed.concat(ch); await tick(); r = earMeasure(); }
      out.innerHTML = earHtml(r) + earMoodNote(r) + (fixed.length ? '<p class="small"><b>Ho corretto da solo i volumi:</b> ' + esc(fixed.join(', ')) + '.</p>' : '') + (!auto && r.findings.some(function (f) { return f.fix && f.fix.levels; }) ? '<div class="row"><button class="btn sm pri" id="ear-fix">Applica i consigli</button></div>' : '');
      return r;
    } catch (e) { out.innerHTML = '<p class="small">Non sono riuscito a misurare la base.</p>'; return null; }
  }
  $('#ear-go').addEventListener('click', function () { earRun(false); });
  $('#ear-out').addEventListener('click', async function (e) { if (e.target.id !== 'ear-fix') return; var r = earMeasure(), ch = earApply(r); $('#ear-out').innerHTML = '<p class="small">' + (ch.length ? 'Ho cambiato: ' + esc(ch.join(', ')) + '. Riascolto…' : 'Niente da cambiare.') + '</p>'; await tick(); await earRun(false); });
  /* sfondo ed emozione: espone l'umore sul body (la grafica la decide la schermata, in CSS con body[data-mood]) */
  function applyMoodBg(m) { try { document.body.dataset.mood = ({ emo: 'malinconico', horror: 'dark', sognante: 'romantico', trionfale: 'euforico' })[m] || m || ''; } catch (e) {} }
  /* umore attuale: quello scelto dal Cervello, altrimenti misurato da tonalità e velocità della base */
  function moodNow() { var s = cur(), p = s.prod; if (s.moodTarget) return s.moodTarget; try { return Ear.moodOf({ mode: p.mode, bpm: p.bpm }).top; } catch (e) { return ''; } }
  /* ===== Cervello Sultan: dal testo alla base (stile, velocità, tonalità, strumenti) ===== */
  var BANNED_INST = { flute: 1, ocarina: 1, harmonica: 1, clarinet: 1, kalimba: 0 };
  /* se nel testo mancano i titoli [Strofa]/[Ritornello], li mette l'app (e toglie il titolo dal testo cantato) */
  function autoSecs() {
    var s = cur(); if (!s.lyrics || !s.lyrics.trim() || typeof AutoSections === 'undefined') return '';
    var r = AutoSections.label(s.lyrics); if (!r.changed) return '';
    s.lyrics = r.text; ['#dw-lyrics', '#st-lyrics'].forEach(function (q) { var el = $(q); if (el) el.value = r.text; });
    if (r.title && (!s.title || /^(nuova canzone|senza titolo)/i.test(s.title))) { s.title = r.title; ['#dw-name', '#st-title'].forEach(function (q) { var el = $(q); if (el) el.value = r.title; }); var ts = $('#top-song'); if (ts) ts.textContent = r.title; }
    persist(); return '<span class="tag i">Ipotesi</span> ' + esc(AutoSections.summary(r)) + ' Puoi cambiare i titoli tra parentesi.';
  }
  /* ===== Voce guida: voce maschile sintetica sulla base (impara solo l'altezza della tua voce) ===== */
  function gvS() { var g = LIB.settings.gv; if (g && !g.v2) { g.v2 = 1; g.on = false; } return g || (LIB.settings.gv = { v2: 1, on: false, gain: 70, tune: 18, f0: 130, lo: 0, hi: 0, n: 0 }); }
  function gvAdd(mx) {
    var g = gvS(); if (!g.on || SESSION.useImported || typeof GuideVoice === 'undefined') return mx;
    var s = cur(); if (!s.lyrics || !s.lyrics.trim()) return mx;
    try {
      var map = songMap(); if (!map || !map.lines || !map.lines.length) return mx; var p = s.prod;
      var r = GuideVoice.render(map.lines, { sr: mx.sr, length: mx.samples.length, tonic: p.tonic || 0, mode: p.mode, f0: g.f0 || 130, seed: (p.melSeed || 0) * 13 + (p.seed || 1), tuneMs: g.tune || 18 });
      var out = new Float32Array(mx.samples.length), k = (g.gain / 100) * 0.55, i, pk = 0;
      for (i = 0; i < out.length; i++) { out[i] = mx.samples[i] + r.audio[i] * k; var a = Math.abs(out[i]); if (a > pk) pk = a; }
      if (pk > 0.98) { var sc = 0.98 / pk; for (i = 0; i < out.length; i++) out[i] *= sc; }
      return Object.assign({}, mx, { samples: out, guide: r.syllables });
    } catch (e) { return mx; }
  }
  (function () {
    var g = gvS(), on = $('#gv-on'), ga = $('#gv-gain'), tu = $('#gv-tune'); if (!on) return;
    on.checked = !!g.on; ga.value = g.gain; $('#gv-gv').textContent = g.gain; tu.value = String(g.tune);
    on.addEventListener('change', function () { gvS().on = on.checked; persist(); });
    ga.addEventListener('input', function () { gvS().gain = +ga.value; $('#gv-gv').textContent = ga.value; });
    ga.addEventListener('change', persist);
    tu.addEventListener('change', function () { gvS().tune = +tu.value; persist(); });
    $('#gv-play').addEventListener('click', function () { var s = cur(); if (!s.lyrics || !s.lyrics.trim()) { $('#gv-msg').textContent = 'Scrivi prima il testo.'; return; } if (!gvS().on) { gvS().on = true; on.checked = true; persist(); } $('#gv-msg').textContent = 'Preparo base e voce guida…'; makeAndPlay(false); });
    $('#gv-learn').addEventListener('click', function () {
      var t = activeTake(), m = $('#gv-msg'); if (!t) { m.textContent = 'Registra prima una ripresa: la voce che registri è quella che misuro.'; return; }
      var r = GuideVoice.measureF0(t.mono, t.sr, AudioAnalysis.detectPitch); if (!r) { m.textContent = 'Non sento abbastanza voce chiara in questa ripresa (serve almeno qualche secondo cantato o parlato vicino al microfono).'; return; }
      var gg = gvS(), w0 = Math.min(gg.n || 0, 400); gg.f0 = Math.round(((gg.f0 || 130) * w0 + r.f0 * r.n) / (w0 + r.n) * 10) / 10; gg.lo = gg.lo ? Math.round((gg.lo + r.lo) / 2) : r.lo; gg.hi = gg.hi ? Math.round((gg.hi + r.hi) / 2) : r.hi; gg.n = Math.min(2000, (gg.n || 0) + r.n); persist();
      var midi = Math.round(GuideVoice.hzToMidi(gg.f0)); m.innerHTML = '<span class="tag m">Misurato</span> La tua voce sta intorno a ' + gg.f0 + ' Hz (nota ' + NOTES[((midi % 12) + 12) % 12] + '), da ' + gg.lo + ' a ' + gg.hi + ' Hz. La voce guida ora usa questa altezza. Il timbro non lo imita ancora.';
    });
  })();
  /* ===== Controllo del telefono: gira SUL tuo iPhone e dice cosa funziona (Misurato) ===== */
  (function () {
    var b = $('#stest-go'); if (!b) return;
    b.addEventListener('click', async function () {
      var out = $('#stest-out'), rows = [], add = function (n, ok, note, ms) { rows.push({ n: n, ok: ok, note: note || '', ms: ms }); }, T = function (f) { var t0 = performance.now(), r; try { r = f(); } catch (e) { r = { error: e && e.message ? e.message : String(e) }; } return { r: r, ms: Math.round(performance.now() - t0) }; };
      out.innerHTML = '<p class="small">Controllo il telefono…</p>'; await tick();
      try { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) add('Audio', false, 'Web Audio non c\'è'); else { var ac = new AC(); add('Audio', true, 'frequenza ' + ac.sampleRate + ' Hz, stato ' + ac.state + (ac.state === 'suspended' ? ' (parte al primo tocco: normale su iPhone)' : '')); try { ac.close(); } catch (e) {} } } catch (e) { add('Audio', false, e.message); }
      add('Microfono (strumento presente)', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia), 'il permesso lo chiede Safari al primo uso; qui non lo richiedo');
      add('Installata come app (Home)', !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches)), 'se no: Condividi → Aggiungi a Home');
      add('Senza internet (service worker)', 'serviceWorker' in navigator, '');
      add('WebGPU (serve all\'AI locale)', !!navigator.gpu, navigator.gpu ? 'presente: l\'assistente testi può partire' : 'assente: l\'AI locale non parte, tutto il resto sì');
      try { localStorage.setItem('__t', new Array(1025).join('x')); localStorage.removeItem('__t'); add('Salvataggio sul telefono', true, ''); } catch (e) { add('Salvataggio sul telefono', false, 'bloccato (modalità privata?)'); }
      try { var est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; add('Spazio disponibile', !!est, est ? Math.round(est.usage / 1e6) + ' MB usati su circa ' + Math.round(est.quota / 1e6) + ' MB' : 'non misurabile'); } catch (e) { add('Spazio disponibile', false, 'non misurabile'); }
      await tick();
      var a = T(function () { return Arranger.generate({ genre: 'trapdark', bpm: 140, mode: 'minore', tonic: 0, seed: 3, bars: 8, heavy: true }); });
      add('Velocità: arrangiamento di 8 battute', !a.r.error && a.ms < 4000, a.r.error || (a.ms + ' ms' + (a.ms >= 4000 ? ' (lento)' : '')), a.ms); await tick();
      var ln = [{ text: 'prova di voce guida sulla base', mode: 'canta', words: 'prova di voce guida sulla base'.split(' ').map(function (w, i) { return { w: w, start: i * 0.5, end: i * 0.5 + 0.45 }; }) }], sr0 = 32000;
      var v = T(function () { return GuideVoice.render(ln, { sr: sr0, length: sr0 * 20, tonic: 0, mode: 'minore', f0: 130, seed: 1 }); });
      add('Velocità: voce guida su 20 secondi', !v.r.error && v.ms < 6000, v.r.error || (v.ms + ' ms' + (v.ms >= 6000 ? ' (lento)' : '')), v.ms);
      var x = T(function () { return Remix.make(7, { heavy: true }); }), au = T(function () { return AutoSections.label('25 maggio\n\nuno due tre quattro\ncinque sei sette otto\n\nuno due tre quattro\ncinque sei sette otto'); });
      add('Ritmi nuovi e sezioni automatiche', !x.r.error && !au.r.error && au.r.changed, (x.ms + au.ms) + ' ms');
      var mods = { SultanBrain: window.SultanBrain, Taste: window.Taste, LocalAI: window.LocalAI, BeatLearn: window.BeatLearn, Arranger: window.Arranger, GuideVoice: window.GuideVoice }, miss = Object.keys(mods).filter(function (k) { return !mods[k]; });
      add('Moduli dell\'app caricati', !miss.length, miss.length ? 'mancano: ' + miss.join(', ') : 'tutti');
      var bad = rows.filter(function (r) { return !r.ok; }).length, plain = rows.map(function (r) { return (r.ok ? 'OK  ' : 'NO  ') + r.n + (r.note ? ' — ' + r.note : ''); }).join('\n');
      out.innerHTML = '<table class="small" style="width:100%;border-collapse:collapse">' + rows.map(function (r) { return '<tr><td style="padding:4px 6px;white-space:nowrap">' + (r.ok ? '✅' : '⚠️') + '</td><td style="padding:4px 6px"><b>' + esc(r.n) + '</b><br><span class="muted">' + esc(r.note) + '</span></td></tr>'; }).join('') + '</table><p class="small"><span class="tag m">Misurato</span> ' + (bad ? bad + ' cose da guardare.' : 'Tutto ok su questo telefono.') + ' Non provo il microfono vero, l\'ascolto e la AI scaricata: quelli si provano a mano.</p><textarea readonly rows="6" style="width:100%">' + esc(navigator.userAgent + '\n' + plain) + '</textarea>';
    });
  })();
  var SB_FORCE = { genre: null, preset: null };
  function rxFor(pl, v, radical) { var st = Arranger.STYLES[pl.genre] || {}; return Remix.make(((pl.seed >>> 0) + (v || 0) * 7919 + (radical ? 104729 : 0)) >>> 0, { half: !st.snare || st.snare.length === 1, heavy: !!pl.heavy, mode: pl.mode }); }
  async function runBrain(again, fixedV, mel, radical) {
    var s = cur(), p = s.prod, m = $('#sb-msg'); s.recentG = s.recentG || [];
    if (radical) { fixedV = (s.brainV || 0) + 1; mel = (s.brainV || 0) + 7; }
    if (!s.lyrics.trim()) { m.textContent = 'Scrivi o incolla prima il testo (in alto): il cervello parte da quello.'; return; }
    var secTxt = autoSecs();
    s.brainV = fixedV != null ? fixedV : (again ? (s.brainV || 0) + 1 : 0); s.brainFor = SultanBrain.hash(s.lyrics.trim()); s.genreManual = false;
    var a = analysisOf(s), pl = SultanBrain.plan(s.lyrics, a, { variant: s.brainV, profile: arModel(), mood: $('#sb-mood').value || null, styleText: ($('#sb-style') || {}).value || '', forceGenre: SB_FORCE.genre || null, avoid: (radical ? s.recentG.slice(-5) : []).concat(Taste.avoidList(tasteMem())) }); s.recentG.push(pl.genre); s.lastPlan = { genre: pl.genre, mode: pl.mode, heavy: !!pl.heavy, bpm: pl.bpm }; if (s.recentG.length > 12) s.recentG.shift(); s.moodTarget = pl.moodTarget; applyMoodBg(pl.moodTarget); persist();
    p.heavy = !!pl.heavy; p.leadRest = undefined; p.melSeed = mel || 0; p.sig = SigFx.pick({ styleText: ($('#sb-style') || {}).value || '', seed: pl.seed, scenes: pl.scenes, genre: pl.genre }); p.genre = pl.genre; p.bpm = pl.bpm; p.mode = pl.mode; p.tonic = pl.tonic; p.seed = pl.seed; p.bassStyle = pl.bassStyle; p.sounds = 'campioni'; p.tune = null;
    var res = Coach.suggest(coachState(), coachCands(p.genre), { emotion: pl.scene, seed: pl.seed }), R = Instruments.RECIPES[p.genre] || {};
    ['melodia', 'accordi', 'pad'].forEach(function (role) { if (BANNED_INST[res.inst[role]]) res.inst[role] = (R[role] || ['piano'])[0]; });
    if (res.inst.accordi === res.inst.melodia) { var alt = (R.accordi || []).concat(R.melodia || []).filter(function (id) { return id !== res.inst.melodia && !BANNED_INST[id]; }); if (alt.length) res.inst.accordi = alt[(pl.seed >>> 3) % Math.min(alt.length, 3)]; }
    if (['trap', 'trapdark', 'drill', 'street', 'boombap', 'clubtrap'].indexOf(p.genre) >= 0) { /* rap: strofe parlate a ritmo, ritornelli cantati (solo righe senza modo scelto da te) */
      s.modes = s.modes || {}; var sm0 = SongMap.build(s.lyrics, { bpm: p.bpm, syll: LyricsEngine.lineSyllables, modes: {} });
      sm0.lines.forEach(function (ln) { if (!s.modes[ln.text]) s.modes[ln.text] = (ln.section === 'ritornello' || ln.section === 'bridge') ? 'canta' : 'parla'; }); }
    /* imparato dalle basi che ti piacciono (solo numeri): ritmo, cassa, rullante, giro di accordi, tempo. «Stravolgi» li lascia da parte per darti qualcosa di diverso. */
    var lp = (radical || s.brainV > 0) ? null : learnPlan(), learnTxt = '', rx = rxFor(pl, s.brainV, radical);
    if (lp && lp.from) { p.groove = lp.groove; p.prog = lp.prog; p.tune = lp.tune; p.fromLearn = lp.from; if (Math.abs(lp.bpm - pl.bpm) <= 30) p.bpm = Math.round((pl.bpm + 2 * lp.bpm) / 3); if (lp.from >= 2) p.mode = lp.mode;
      learnTxt = '<br><span class="tag m">Misurato</span> Ho usato i numeri di ' + lp.from + ' basi che ti piacciono: cassa sui passi ' + lp.groove.kickPats[0][0].map(function (x) { return x + 1; }).join(', ') + (lp.prog ? ', giro ' + BeatLearn.progName(lp.prog, lp.mode) : '') + ', ' + p.bpm + ' BPM.'; }
    else { p.groove = rx.groove; p.prog = null; p.tune = rx.tune; p.fromLearn = 0; if (s.brainV > 0 || radical) p.melSeed = mel != null ? mel : rx.melSeed; learnTxt = '<br><span class="tag m">Misurato</span> Versione ' + (s.brainV + 1) + ': ' + esc(rx.label) + '.' + (p.sig && p.sig.length ? ' Effetti: ' + esc(([].concat(p.sig)).join(', ')) + '.' : '') + (learnList().some(function (r) { return r.vote > 0; }) ? '' : '<br><span class="small muted">Non ho ancora basi imparate: caricane una in Libreria e premi ♥ per farmi imparare ritmo e accordi.</span>'); }
    p.inst = res.inst; persist(); fillBase();
    m.innerHTML = '<b>' + esc(pl.label) + '</b> · ' + pl.bpm + ' BPM · ' + pl.mode + '<br>' + pl.why.map(esc).join('<br>') + '<br><span class="tag i">Ipotesi</span> Strumenti: ' + ['melodia', 'accordi', 'pad'].map(function (r) { return r + ' ' + esc(instName(p.inst[r])); }).join(', ') + '. Se non ti piace premi "Altra versione dal testo".' + (secTxt ? '<br>' + secTxt : '') + learnTxt + '<div class="row" style="margin-top:8px"><button class="chip" data-taste="1">♥ Mi piace</button><button class="chip" data-taste="-1">✕ Scarta e dammene un\'altra</button></div><div class="small muted" id="sb-taste">' + esc(Taste.summary(tasteMem())) + '</div>';
    await makeAndPlay(false);
    earRun(true);
  }
  /* ===== MUSICAL DNA ENGINE: mescola stili (numeri), emozioni del testo → base vera ===== */
  var DNAUI = { n: Date.now() % 1000, over: {} };
  function dnaSaved() { return LIB.settings.dnaSaved || (LIB.settings.dnaSaved = []); }
  function dnaOpts(sel, withNone) {
    var g = {}; DNA.LIST.forEach(function (d) { (g[d.gruppo] = g[d.gruppo] || []).push('<option value="' + d.id + '">' + esc(d.nome) + '</option>'); });
    var h = withNone ? '<option value="">— nessuno —</option>' : ''; Object.keys(g).forEach(function (k) { h += '<optgroup label="' + k + '">' + g[k].join('') + '</optgroup>'; });
    var sv = dnaSaved(); if (sv.length) h += '<optgroup label="I miei stili">' + sv.map(function (x, i) { return '<option value="my:' + i + '">' + esc(x.name) + '</option>'; }).join('') + '</optgroup>';
    sel.innerHTML = h;
  }
  function dnaParts() {
    var out = []; $$('#dna-rows .dna-row').forEach(function (r) { var id = r.querySelector('select').value, w = +r.querySelector('input').value; if (!id || !(w > 0)) return; if (id.indexOf('my:') === 0) { var m = dnaSaved()[+id.slice(3)]; if (m) out.push({ dna: m.dna, id: 'my', w: w }); } else out.push({ id: id, w: w }); });
    return out;
  }
  function dnaBuild() {
    var s = cur(), parts = dnaParts(); if (!parts.length) { parts = [{ id: 'f-trap', w: 1 }]; }
    var d = DNA.fuse(parts, DNAUI.n + 1), why = [], em = DNA.emotion(s.lyrics || '');
    if ($('#dna-emo').checked && s.lyrics && s.lyrics.trim()) { var ae = DNA.applyEmotion(d, em, (+$('#dna-emo-w').value || 0) / 100); d = ae.dna; why = ae.why; }
    DNA.ORDER.forEach(function (k) { if (DNAUI.over[k] != null) d[k] = DNAUI.over[k]; });
    return { dna: DNA.sanitize(Object.assign({}, d, { name: d.name, parts: d.parts })), why: why, em: em };
  }
  function dnaSliders(d) {
    $('#dna-sl').innerHTML = DNA.ORDER.map(function (k) { var f = DNA.FIELDS[k], st = k === 'bpm' ? 1 : 0.01; return '<label class="f"><span>' + f[2] + ': <b id="dna-v-' + k + '">' + (k === 'bpm' ? Math.round(d[k]) : d[k]) + '</b> <small class="muted">' + esc(f[3]) + '</small></span><input type="range" data-dna="' + k + '" min="' + f[0] + '" max="' + f[1] + '" step="' + st + '" value="' + d[k] + '"></label>'; }).join('');
  }
  async function dnaCreate(again) {
    var s = cur(), p = s.prod, m = $('#dna-msg'); if (again) DNAUI.n++;
    stopPlay(); var b = dnaBuild(), pr = DNA.toProd(b.dna, ((s.dnaSeed = s.dnaSeed || (SultanBrain.hash(s.lyrics || 'x') >>> 0) % 100000) + DNAUI.n * 7919));
    var sp = pr.preset && StylePresets.byId(pr.preset) ? StylePresets.variant(StylePresets.byId(pr.preset), pr.melSeed) : null, R = Instruments.RECIPES[pr.genre] || {}, ok = function (id) { return !BANNED_INST[id]; };
    p.genre = pr.genre; p.bpm = pr.bpm; p.tonic = pr.tonic; p.mode = pr.mode; p.groove = pr.groove; p.prog = pr.prog; p.tune = pr.tune; p.heavy = pr.heavy; p.leadRest = pr.leadRest; p.melSeed = pr.melSeed; p.seed = (s.dnaSeed || 1) + DNAUI.n * 31; p.bassStyle = pr.heavy ? '808' : undefined; p.fromLearn = 0;
    var inst = sp ? Object.assign({}, sp.inst) : {}; ['melodia', 'accordi', 'pad'].forEach(function (r) { var l = (R[r] || []).filter(ok); if (!inst[r] || BANNED_INST[inst[r]]) inst[r] = l.length ? l[(pr.melSeed + r.length) % l.length] : undefined; }); p.inst = inst; if (sp && sp.kit) p.kit = sp.kit; s.genreManual = true;
    if (['trap', 'trapdark', 'drill', 'brooklyn', 'street', 'boombap', 'clubtrap', 'rage', 'phonk'].indexOf(p.genre) >= 0 && s.lyrics && s.lyrics.trim()) { /* rap: strofe parlate a ritmo, ritornelli cantati: la voce guida segue lo stile */
      s.modes = s.modes || {}; SongMap.build(s.lyrics, { bpm: p.bpm, syll: LyricsEngine.lineSyllables, modes: {} }).lines.forEach(function (ln) { if (!s.modes[ln.text]) s.modes[ln.text] = (ln.section === 'ritornello' || ln.section === 'bridge') ? 'canta' : 'parla'; }); }
    persist(); try { fillInst(); } catch (e) {} fillBase();
    m.innerHTML = '<b>' + esc(b.dna.name) + '</b> · ' + pr.bpm + ' BPM · ' + pr.mode + '<br><span class="tag m">Misurato</span> Cassa sui passi ' + pr.groove.kickPats[0][0].map(function (x) { return x + 1; }).join(', ') + ', rullante ' + pr.groove.snare.map(function (x) { return x + 1; }).join(', ') + ', giro ' + Remix.progName(pr.prog, pr.mode) + '.' + (b.why.length ? '<br><span class="tag i">Ipotesi</span> ' + b.why.map(esc).join(' ') : '') + '<br><small class="muted">Premi «Un\'altra versione» per lo stesso DNA con ritmo e melodia nuovi.</small>';
    dnaSliders(b.dna); await makeAndPlay(false);
  }
  (function dnaInit() {
    if (!$('#dna-rows') || typeof DNA === 'undefined') return;
    var defs = [['sfera', 70], ['f-ballata', 30], ['', 0]];
    $('#dna-rows').innerHTML = defs.map(function (d, i) { return '<div class="dna-row row" style="gap:6px;align-items:center"><select aria-label="Stile ' + (i + 1) + '" style="flex:2"></select><input type="range" min="0" max="100" step="5" value="' + d[1] + '" style="flex:1" aria-label="Peso ' + (i + 1) + '"><b class="small" style="width:3em;text-align:right">' + d[1] + '%</b></div>'; }).join('');
    $$('#dna-rows .dna-row').forEach(function (r, i) { var sel = r.querySelector('select'); dnaOpts(sel, i > 0); sel.value = defs[i][0]; r.querySelector('input').addEventListener('input', function () { r.querySelector('b').textContent = this.value + '%'; }); });
    dnaSliders(dnaBuild().dna);
    $('#dna-sl').addEventListener('input', function (e) { var k = e.target.getAttribute('data-dna'); if (!k) return; DNAUI.over[k] = +e.target.value; $('#dna-v-' + k).textContent = k === 'bpm' ? Math.round(e.target.value) : e.target.value; });
    var aiN = 0;
    $('#dna-ai').addEventListener('click', function () {
      var s = cur(); if (!s.lyrics || !s.lyrics.trim()) { $('#dna-ai-out').textContent = 'Scrivi prima il testo: il consigliere lo legge.'; return; }
      var r = DNA.suggest(s.lyrics, 3, ++aiN), top = r.emotions.top;
      $('#dna-ai-out').innerHTML = '<p><span class="tag i">Ipotesi</span> Emozioni trovate: ' + (top.length ? top.map(function (e) { return e + ' ' + Math.round(r.emotions.share[e] * 100) + '%'; }).join(', ') : 'poche parole di emozione, scelgo io') + '. Consigliere a regole sul telefono (non è un modello di linguaggio).</p>' +
        r.recipes.map(function (x, i) { return '<div class="note" style="margin:6px 0"><b>' + esc(x.name) + '</b><br><small class="muted">' + esc(x.why) + '</small><br><button class="btn sm" data-dna-r="' + i + '">Crea questa base</button></div>'; }).join('') + '<button class="btn sm" id="dna-ai-more">Altri 3 consigli</button>';
      DNAUI.recipes = r.recipes;
    });
    $('#dna-ai-out').addEventListener('click', function (e) {
      if (e.target.id === 'dna-ai-more') { $('#dna-ai').click(); return; }
      var i = e.target.getAttribute && e.target.getAttribute('data-dna-r'); if (i == null || !DNAUI.recipes) return; var x = DNAUI.recipes[+i], rows = $$('#dna-rows .dna-row');
      rows.forEach(function (r, k) { var part = x.parts[k]; r.querySelector('select').value = part ? part.id : ''; r.querySelector('input').value = part ? part.w : 0; r.querySelector('b').textContent = (part ? part.w : 0) + '%'; });
      DNAUI.over = {}; dnaCreate(true);
    });
    $('#dna-go').addEventListener('click', function () { dnaCreate(true); });
    $('#dna-again').addEventListener('click', function () { dnaCreate(true); });
    $('#dna-reset').addEventListener('click', function () { DNAUI.over = {}; dnaSliders(dnaBuild().dna); });
    $('#dna-save').addEventListener('click', function () { var nm = ($('#dna-name').value || '').trim().slice(0, 40); if (!nm) { $('#dna-msg').textContent = 'Scrivi un nome per il tuo stile.'; return; } var b = dnaBuild(); dnaSaved().push({ name: nm, dna: b.dna, at: Date.now() }); persist(); $$('#dna-rows select').forEach(function (sel, i) { var v = sel.value; dnaOpts(sel, i > 0); sel.value = v; }); $('#dna-msg').textContent = 'Salvato «' + nm + '». Lo trovi in «I miei stili» in ogni menu: puoi rimescolarlo con altri.'; });
  })();
  $('#sb-mood').addEventListener('change', function () { $('#bl-mood').value = this.value; });
  $('#bl-mood').addEventListener('change', function () { $('#sb-mood').value = this.value; });
  /* base nuova da un'atmosfera (quella scelta in «Suona come», altrimenti trap/drill/street a caso): stravolge davvero
     genere, velocità, strumenti, kit, giro e ritmo. Serve quando non c'è ancora il testo. */
  function atmQuick(el) {
    var p = cur().prod, v = LIB.settings.varStyle || '', w = { trap: 3, trapdark: 3, drill: 3, brooklyn: 2, street: 2, plugg: 1.5, rage: 1.2, emorap: 1.2, cloud: 1, phonk: 1 };
    var sp = v.slice(0, 2) === 'a:' ? StylePresets.pickMany(1, null, Date.now() % 1e9, v.slice(2))[0] : (v.slice(0, 2) === 'f:' && folderProf(v.slice(2)) ? learnSpecs2(folderProf(v.slice(2)), 2)[Math.floor(Math.random() * 2)] : StylePresets.pickMany(1, textWeights() || w, Date.now() % 1e9)[0]);
    if (!sp) return; stopPlay(); dwStop();
    p.genre = sp.genre; p.bpm = sp.bpm; p.seed = sp.seed || (1 + Math.floor(Math.random() * 99999)); p.inst = Object.assign({}, sp.inst); p.kit = sp.kit; p.arpPattern = sp.arpPattern; p.mix = null;
    p.groove = sp.groove || null; p.prog = sp.prog || null; p.mode = sp.mode || p.mode; if (sp.tonic != null) p.tonic = sp.tonic; else p.tonic = Math.floor(Math.random() * 12); p.tune = sp.tune || null; p.bassStyle = sp.bassStyle !== undefined ? sp.bassStyle : p.bassStyle; p.melSeed = (p.melSeed || 0) + 1; p.atmNome = sp.nome || null;
    persist(); try { fillInst(); fillBase(); dwFill(); } catch (e) {} dwChanged(true); projLine();
    var msg = 'Base nuova: ' + (sp.nome || sp.genre) + ' · ' + p.bpm + ' BPM' + (cur().lyrics && cur().lyrics.trim() ? '' : '. Scrivi il testo in «1 Testo» e la base si adatterà alle tue parole (forma ed effetti).');
    if (el) el.textContent = msg; var sm = $('#sb-msg'); if (sm) sm.textContent = msg; makeAndPlay(false);
  }
  $('#sb-make').addEventListener('click', function () { var s = cur(); if (!(s.lyrics || '').trim()) { atmQuick($('#sb-msg')); return; } Promise.resolve(runBrain(!!(s.lyrics && s.brainFor === SultanBrain.hash(s.lyrics.trim())))).then(refApply); });
  $('#sb-wild').addEventListener('click', function () { if (!(cur().lyrics || '').trim()) { atmQuick($('#sb-msg')); return; } runBrain(false, null, null, true); });
  /* quello che scrivi nel campo stile si applica da solo (Invio o quando esci dal campo) */
  var sbLast = '';
  function sbAuto() { var v = ($('#sb-style') || {}).value || ''; if (v.trim() && v !== sbLast && cur().lyrics.trim()) { sbLast = v; runBrain(false); } }
  $('#sb-style').addEventListener('change', sbAuto); $('#sb-style').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); sbAuto(); } });
  /* proposte diverse dallo stesso testo, senza limite: ogni "Altre 6" ne aggiunge altre (stile, velocità, tonalità e melodia cambiano) */
  var SB_N = 0;
  function sbMore(reset) {
    var s = cur(), box = $('#sb-list'); if (!s.lyrics.trim()) { box.innerHTML = '<p class="small">Scrivi prima il testo.</p>'; return; }
    autoSecs();
    if (reset) { SB_N = 0; box.innerHTML = '<ul class="clean small" id="sb-ul"></ul><div class="row"><button class="btn sm" id="sb-more">Ancora proposte (non finiscono mai)</button></div>'; }
    var a = analysisOf(s), st = ($('#sb-style') || {}).value || '', h = '', i;
    for (i = SB_N; i < SB_N + 6; i++) {
      var pl = SultanBrain.plan(s.lyrics, a, { variant: i, profile: arModel(), mood: $('#sb-mood').value || null, styleText: st, forceGenre: SB_FORCE.genre || null, avoid: Taste.avoidList(tasteMem()) });
      h += '<li>' + (i + 1) + '. <b>' + esc(pl.label) + '</b> · ' + pl.bpm + ' BPM · ' + NOTES[pl.tonic] + ' ' + pl.mode + (pl.heavy ? ' · pesante' : '') + '<br><small class="muted">' + esc(rxFor(pl, i, false).label) + '</small><br><button class="chip" data-sb-v="' + i + '" style="min-height:28px;padding:2px 10px">Ascolta</button> <button class="chip" data-sb-like="' + i + '" style="min-height:28px;padding:2px 10px">♥</button><button class="chip" data-sb-nope="' + i + '" style="min-height:28px;padding:2px 10px">✕</button></li>';
    }
    SB_N += 6; $('#sb-ul').insertAdjacentHTML('beforeend', h);
  }
  $('#sb-six').addEventListener('click', function () { sbMore(true); });
  $('#sb-list').addEventListener('click', function (e) {
    if (e.target && e.target.id === 'sb-more') { sbMore(false); return; }
    var v = e.target && e.target.getAttribute && e.target.getAttribute('data-sb-v'); if (v != null) { runBrain(false, +v, +v); return; }
    var lk = e.target && e.target.getAttribute && e.target.getAttribute('data-sb-like'), np = e.target && e.target.getAttribute && e.target.getAttribute('data-sb-nope'), k = lk != null ? lk : np;
    if (k != null) { var s = cur(), pl = SultanBrain.plan(s.lyrics, analysisOf(s), { variant: +k, profile: arModel(), mood: $('#sb-mood').value || null, styleText: ($('#sb-style') || {}).value || '', avoid: Taste.avoidList(tasteMem()) }); LIB.settings.taste = Taste.vote(tasteMem(), pl, lk != null ? 1 : -1); persist(); e.target.textContent = lk != null ? '♥ ok' : '✕ ok'; e.target.disabled = true; }
  });
  /* Gusto: ♥ / ✕ sulla base appena fatta */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('[data-taste]'); if (!b) return; var s = cur(), v = +b.getAttribute('data-taste');
    if (!s.lastPlan) return; LIB.settings.taste = Taste.vote(tasteMem(), s.lastPlan, v); persist();
    var t = document.getElementById('sb-taste'); if (t) t.textContent = Taste.summary(tasteMem());
    if (v < 0) runBrain(false, null, null, true); else b.textContent = '♥ salvato';
  });
  $('#sb-again').addEventListener('click', function () { runBrain(true); });
  /* Lista degli stili: li propone l'app dal testo, tu tocchi. Consigliati, atmosfere (artisti, solo numeri) e tutti gli stili. */
  function sbChips() {
    var box = $('#sb-chips'); if (!box) return; var s = cur(), sc = {}, h = '', on = function (c) { return c ? ' on' : ''; };
    if (s.lyrics && s.lyrics.trim()) { try { sc = SultanBrain.plan(s.lyrics, analysisOf(s), { mood: $('#sb-mood').value || null }).scores || {}; } catch (e) {} }
    var gs = Object.keys(Arranger.STYLES), rec = gs.slice().sort(function (a, b) { return (sc[b] || 0) - (sc[a] || 0); }).slice(0, 6);
    var chip = function (g) { return '<button class="chip' + on(SB_FORCE.genre === g) + '" data-sb-g="' + g + '">' + esc(Arranger.STYLES[g].label) + '</button>'; };
    h += '<h4>Stile: lo decide il testo, oppure scegli</h4><button class="chip' + on(!SB_FORCE.genre && !SB_FORCE.preset) + '" data-sb-g="">Libero · decide il testo</button>';
    h += '<h4>Consigliati per il tuo testo</h4>' + (s.lyrics && s.lyrics.trim() ? rec.map(chip).join('') : '<span class="small muted">Scrivi il testo e te li consiglio.</span>');
    if (window.StylePresets) { var g = {}; StylePresets.LIST.forEach(function (pr) { (g[pr.gruppo] = g[pr.gruppo] || []).push(pr); });
      h += '<details><summary class="small"><b>Atmosfere</b> (' + StylePresets.LIST.length + ', descritte con numeri: tempo, ritmo, suoni. Non copiano canzoni)</summary>' + Object.keys(g).map(function (k) { return '<h4>' + esc(k) + '</h4>' + g[k].map(function (pr) { return '<button class="chip' + on(SB_FORCE.preset === pr.id) + '" data-sb-p="' + pr.id + '">' + esc(pr.nome) + '</button>'; }).join(''); }).join('') + '</details>'; }
    h += '<details><summary class="small"><b>Tutti gli stili</b> (' + gs.length + ')</summary>' + gs.map(chip).join('') + '</details>';
    box.innerHTML = h;
  }
  async function sbPreset(id) {
    var pr = StylePresets.byId(id); if (!pr) return; var sp = StylePresets.variant(pr, Math.floor(Math.random() * 1e9)), p = cur().prod, m = $('#sb-msg');
    stopPlay(); SB_FORCE = { genre: null, preset: id };
    p.genre = sp.genre; p.leadRest = undefined; p.bpm = sp.bpm; p.seed = sp.seed; p.inst = Object.assign({}, sp.inst); p.kit = sp.kit; p.arpPattern = sp.arpPattern; if (sp.mode) p.mode = sp.mode; if (sp.tonic != null) p.tonic = sp.tonic; p.tune = sp.tune || null; p.prog = sp.prog || null; p.bassStyle = sp.bassStyle; p.atmNome = sp.nome; p.mix = null; p.sounds = 'campioni';
    var st = Arranger.STYLES[p.genre] || {}, rx = Remix.make((sp.seed >>> 0) + 31, { half: !st.snare || st.snare.length === 1, heavy: !!p.heavy, mode: p.mode });
    p.groove = sp.groove || rx.groove; p.melSeed = rx.melSeed; p.heavy = ['trap', 'trapdark', 'drill', 'brooklyn', 'street', 'rage', 'phonk'].indexOf(p.genre) >= 0;
    persist(); try { fillInst(); } catch (e) {} fillBase(); sbChips();
    m.innerHTML = '<b>' + esc(sp.nome || pr.nome) + '</b> · ' + p.bpm + ' BPM · ' + p.mode + '<br><span class="tag i">Ipotesi</span> ' + esc(pr.spiega || '') + '<br><span class="tag m">Misurato</span> ' + esc(rx.label) + '.';
    await makeAndPlay(false);
  }
  $('#sb-chips').addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-sb-g')) { SB_FORCE = { genre: b.getAttribute('data-sb-g') || null, preset: null }; sbChips(); var s = cur(); if (s.lyrics && s.lyrics.trim()) runBrain(true); else $('#sb-msg').textContent = 'Scrivi prima il testo: poi creo la base in questo stile.'; }
    else if (b.hasAttribute('data-sb-p')) sbPreset(b.getAttribute('data-sb-p'));
  });
  var sbChipsT; function sbChipsLater() { clearTimeout(sbChipsT); sbChipsT = setTimeout(sbChips, 600); }
  ['#dw-lyrics', '#st-lyrics'].forEach(function (q) { var el = $(q); if (el) el.addEventListener('input', sbChipsLater); }); $('#sb-mood').addEventListener('change', sbChips); setTimeout(sbChips, 1500);
  /* il testo decide la base: se non hai scelto tu il genere a mano, parte il Cervello Sultan (una base diversa per ogni testo) */
  function brainFirst(again) { var s = cur(); if (s.lyrics && s.lyrics.trim() && !s.genreManual && (again || s.brainFor !== SultanBrain.hash(s.lyrics.trim()))) { runBrain(again && s.brainFor === SultanBrain.hash(s.lyrics.trim())); return true; } return false; }
  $('#b-play').addEventListener('click', function () { if (brainFirst(false)) return; var p = cur().prod; if (!(cur().lyrics || '').trim() && !cur().genreManual && p.genre === 'melodico' && !p.atmNome) { atmQuick($('#b-status')); return; } if (SESSION.lastPlay && SESSION.baseMade) { newVariantBase(); return; } makeAndPlay(false); });
  $('#b-mel').addEventListener('click', function () { var p = cur().prod; p.melSeed = (p.melSeed || 0) + 1;
    /* anche gli strumenti della melodia e degli accordi cambiano, così la differenza si sente */
    var R = Instruments.RECIPES[p.genre] || {}, ok = function (id) { return !BANNED_INST[id]; }, ml = (R.melodia || []).filter(ok), ac = (R.accordi || []).filter(ok);
    p.inst = Object.assign({}, p.inst || {}); if (ml.length) p.inst.melodia = ml[p.melSeed % ml.length]; if (ac.length) p.inst.accordi = ac[(p.melSeed + 1) % ac.length]; if (p.inst.accordi === p.inst.melodia && ac.length > 1) p.inst.accordi = ac[(p.melSeed + 2) % ac.length];
    persist(); fillBase(); makeAndPlay(false); });
  /* «Nuova variante»: se il cervello non parte (stile scelto a mano o niente testo) applico comunque un Remix vero:
     cassa, rullante, hi-hat, mix e melodia cambiano, lo stile resta. Prima cambiava solo il seme e si sentiva la stessa base. */
  function newVariantBase() {
    if (brainFirst(true)) return;
    if (!(cur().lyrics || '').trim() && !cur().genreManual) { atmQuick($('#b-status')); return; }
    var s = cur(), p = s.prod; s.varN = (s.varN || 0) + 1;
    var rx = rxFor({ genre: p.genre, seed: p.seed, heavy: p.heavy, mode: p.mode }, s.varN, true);
    p.groove = rx.groove; p.tune = rx.tune; p.melSeed = rx.melSeed; p.prog = rx.prog; p.fromLearn = 0;
    var T3 = [0, 2, 3, 5, 7, 10, 4, 9]; p.tonic = (((p.tonic || 0) + T3[s.varN % T3.length]) % 12 + 12) % 12; p.bpm = Math.round(Math.max(60, Math.min(175, p.bpm * (1 + ((s.varN % 5) - 2) * 0.03))));
    var R2 = Instruments.RECIPES[p.genre] || {}; p.inst = Object.assign({}, p.inst || {}); ['melodia', 'accordi'].forEach(function (role) { var l = (R2[role] || []).filter(function (id) { return !BANNED_INST[id]; }); if (l.length) p.inst[role] = l[(rx.melSeed + role.length) % l.length]; }); persist();
    $('#b-status').textContent = 'Nuova variante ' + (s.varN + 1) + ': ' + rx.label + '.';
    makeAndPlay(true);
  }
  $('#b-new').addEventListener('click', newVariantBase);
  $('#b-stop').addEventListener('click', stopPlay);
  $('#b-save').addEventListener('click', async function () { coachRec('save', coachCtx()); var mx = buildMix({ voice: false }); saveAudio(mx.samples, mx.sr, 'base-' + (cur().title || 'canzone').replace(/\W+/g, '-'), $('#b-status')); });

  /* ================= Strumenti veri ================= */
  var INST_BASES = ['inst/', 'https://sultan199777.github.io/ai-music-studio/inst/'];
  function instName(id) { var c = Instruments.info(id); if (c) return c.nome; var y = Instruments.SYNTH.filter(function (x) { return x.id === id; })[0]; return y ? y.nome : id; }
  function noteNm(m) { return NOTES[m % 12] + (Math.floor(m / 12) - 1); }
  function labRec(id) { return SoundLab.ORIGINALS.concat(LIB.settings.lab || []).filter(function (r) { return r.id === id; })[0]; }
  async function loadInst(id) {
    if (!id || Instruments.has(id)) return true;
    var lr = labRec(id);
    if (lr) { var deps = SoundLab.deps(lr), okAll = true; for (var d = 0; d < deps.length; d++) if (!(await loadInst(deps[d]))) okAll = false; return okAll; }
    for (var i = 0; i < INST_BASES.length; i++) { if (await Instruments.load(id, INST_BASES[i])) return true; }
    return false;
  }
  async function ensureInst() {
    var inst = cur().prod.inst || {}, miss = [];
    for (var r in inst) if (inst[r] && !(await loadInst(inst[r]))) miss.push(instName(inst[r]));
    if (miss.length) $('#b-in-info').innerHTML = '<span class="err">Non riesco a scaricare: ' + esc(miss.join(', ')) + '. Uso i suoni sintetici (serve internet la prima volta).</span>';
    return !miss.length;
  }
  function instOptions(role) {
    var h = '<option value="">Automatico (sintetizzato)</option>';
    Object.keys(Instruments.FAMILIES).forEach(function (f) {
      var list = Instruments.CATALOG.filter(function (c) { return c.fam === f && c.ruoli.indexOf(role) >= 0; });
      if (role === 'pad') list = Instruments.CATALOG.filter(function (c) { return c.fam === f && (c.ruoli.indexOf('pad') >= 0 || c.tipo === 'sostenuto'); });
      if (list.length) h += '<optgroup label="' + esc(Instruments.FAMILIES[f]) + '">' + list.map(function (c) { return '<option value="' + c.id + '">' + esc(c.nome) + '</option>'; }).join('') + '</optgroup>';
    });
    var orig = SoundLab.ORIGINALS.filter(function (r) { return r.ruoli.indexOf(role) >= 0 || role === 'pad' && r.tipo === 'sostenuto'; });
    if (orig.length) h += '<optgroup label="Originali (Laboratorio)">' + orig.map(function (r) { return '<option value="' + r.id + '">' + esc(r.nome) + '</option>'; }).join('') + '</optgroup>';
    var mine = LIB.settings.lab || [];
    if (mine.length) h += '<optgroup label="I tuoi strumenti">' + mine.map(function (r) { return '<option value="' + r.id + '">' + esc(r.nome) + '</option>'; }).join('') + '</optgroup>';
    return h;
  }
  function refreshInstSelects() { Object.keys(ROLES).forEach(function (r) { $(ROLES[r]).innerHTML = instOptions(r); }); fillInst(); }
  var ROLES = { melodia: '#b-in-melodia', accordi: '#b-in-accordi', pad: '#b-in-pad' };
  Object.keys(ROLES).forEach(function (r) { $(ROLES[r]).innerHTML = instOptions(r); });
  function instInfo() {
    var inst = cur().prod.inst || {}, parts = [];
    Object.keys(ROLES).forEach(function (r) { var c = Instruments.info(inst[r]); if (c) parts.push('<b>' + esc(c.nome) + '</b> (' + r + '): ' + esc(c.come)); });
    $('#b-in-info').innerHTML = parts.length ? '<div style="margin-top:6px">' + parts.join('<br>') + '</div>' : '';
  }
  function fillInst() { var inst = cur().prod.inst || {}; Object.keys(ROLES).forEach(function (r) { $(ROLES[r]).value = inst[r] || ''; }); instInfo(); }
  Object.keys(ROLES).forEach(function (r) {
    $(ROLES[r]).addEventListener('change', async function () {
      var p = cur().prod, old = (p.inst || {})[r]; p.inst = Object.assign({}, p.inst || {}); p.inst[r] = this.value || null; persist(); instInfo();
      coachRec('change', coachCtx(), { role: r, from: old, to: this.value || null });
      if (this.value) { $('#b-status').textContent = 'Carico ' + instName(this.value) + '…'; var ok = await loadInst(this.value); $('#b-status').textContent = ok ? instName(this.value) + ' pronto. Premi "Crea e ascolta".' : 'Download non riuscito: per ora uso il suono sintetizzato.'; }
    });
  });
  function applyRecipe(g) {
    var R = Instruments.RECIPES[g] || Instruments.RECIPES[Arranger.STYLES[g] ? g : 'melodico'], p = cur().prod;
    var k = (p.seed || 1) % 2;
    p.inst = { melodia: R.melodia[k % R.melodia.length], accordi: R.accordi[k % R.accordi.length], pad: R.pad[0], arpeggio: R.arpeggio ? R.arpeggio[k % R.arpeggio.length] : undefined }; if (R.kit) p.kit = R.kit; persist(); fillInst();
    return R;
  }
  $('#b-in-rec').addEventListener('click', async function () {
    var R = applyRecipe(cur().prod.genre); $('#b-status').textContent = 'Ricetta "' + R.nome + '": carico gli strumenti…';
    var ok = await ensureInst(); $('#b-status').textContent = ok ? 'Pronto: ' + R.spiega : '';
  });
  // anteprima: accordo arpeggiato e poi suonato insieme, nel registro dello strumento
  async function previewInst(id, msgEl) {
    msgEl.textContent = 'Carico ' + instName(id) + '…';
    if (!(await loadInst(id))) { msgEl.textContent = 'Download non riuscito (serve internet la prima volta).'; return; }
    var c = Instruments.info(id) || { range: [48, 84] }, sr = 32000, mid = Math.round((c.range[0] + c.range[1]) / 2 / 12) * 12, notes = [mid, mid + 4, mid + 7, mid + 12].map(function (m) { return Math.min(c.range[1], m); });
    var len = Math.round(3.6 * sr), out = new Float32Array(len);
    notes.forEach(function (m, i) { var x = Instruments.render(id, m, 0.5, sr), a = Math.round(i * 0.4 * sr); for (var j = 0; j < x.length && a + j < len; j++) out[a + j] += x[j] * 0.5; });
    notes.slice(0, 3).forEach(function (m) { var x = Instruments.render(id, m, 1.6, sr), a = Math.round(1.8 * sr); for (var j = 0; j < x.length && a + j < len; j++) out[a + j] += x[j] * 0.3; });
    playBuf(out, sr); msgEl.textContent = 'Ascolti: ' + instName(id) + ' (Do maggiore, registro centrale).';
  }

  /* ---------- Laboratorio suoni ---------- */
  var LAB = { c: {} };
  function labOptions(optional) {
    var h = optional ? '<option value="">Nessuno</option>' : '';
    h += Instruments.CATALOG.map(function (c) { return '<option value="' + c.id + '">' + esc(c.nome) + '</option>'; }).join('');
    return h + Object.keys(SoundLab.SYNTHS).map(function (k) { return '<option value="' + k + '">' + esc(SoundLab.SYNTHS[k].nome) + '</option>'; }).join('');
  }
  function labCurrent() {
    var a = $('#lab-a').value, b = $('#lab-b').value, rec = { id: 'lab:prova', nome: $('#lab-name').value.trim() || 'Senza nome', strati: [{ src: a, vol: 1 }], c: Object.assign({}, LAB.c), tipo: (Instruments.info(a) || {}).tipo || 'sostenuto', ruoli: ['melodia', 'accordi', 'pad'] };
    if (b) { rec.strati.push({ src: b, vol: +$('#lab-bv').value / 100, ott: +$('#lab-bo').value }); rec.morph = +$('#lab-m').value / 100; }
    Object.keys(rec.c).forEach(function (k) { if (!rec.c[k]) delete rec.c[k]; });
    return rec;
  }
  function labSet(rec) {
    $('#lab-a').value = rec.strati[0].src; $('#lab-b').value = rec.strati[1] ? rec.strati[1].src : '';
    $('#lab-bv').value = Math.round(((rec.strati[1] || {}).vol || 0.5) * 100); $('#lab-bvv').textContent = $('#lab-bv').value + '%'; $('#lab-bo').value = String((rec.strati[1] || {}).ott || 0);
    $('#lab-m').value = Math.round((rec.morph || 0) * 100); $('#lab-mv').textContent = $('#lab-m').value + '%';
    LAB.c = Object.assign({}, rec.c || {}); renderKnobs();
  }
  function renderKnobs() {
    $('#lab-knobs').innerHTML = Object.keys(SoundLab.KNOBS).map(function (k) {
      var v = Math.round((LAB.c[k] || 0) * 100), txt = SoundLab.KNOBS[k];
      return '<label class="f"><span>' + esc(txt.split(':')[0]) + ' <b data-kv="' + k + '">' + v + '%</b></span><input type="range" min="0" max="100" value="' + v + '" data-knob="' + k + '"><small class="muted">' + esc(txt.split(':').slice(1).join(':').trim()) + '</small></label>';
    }).join('');
  }
  async function labPlayRec(rec, msg) {
    var deps = SoundLab.deps(rec); msg.textContent = 'Carico i suoni…';
    for (var i = 0; i < deps.length; i++) if (!(await loadInst(deps[i]))) { msg.textContent = 'Download non riuscito (serve internet la prima volta).'; return; }
    SoundLab.install(rec); await previewInst(rec.id, msg);
  }
  function renderLab() {
    $('#lab-orig').innerHTML = SoundLab.ORIGINALS.map(function (r) {
      return '<div class="note" style="margin-top:8px"><div class="row" style="justify-content:space-between;align-items:center"><b>' + esc(r.nome) + '</b><span class="row"><button class="btn sm" data-labprev="' + r.id + '">Ascolta</button><button class="btn sm" data-labedit="' + r.id + '">Modifica</button></span></div>' +
        '<p class="small">' + esc(r.descr) + '</p><p class="small"><b>Perché dovrebbe esistere:</b> ' + esc(r.perche) + '</p><p class="small muted"><b>Come si usa:</b> ' + esc(r.uso) + ' · Stili: ' + esc(r.stili.join(', ')) + '</p></div>';
    }).join('');
    $('#lab-gen').innerHTML = SoundLab.GENRES.map(function (g, i) {
      return '<div class="note" style="margin-top:8px"><b>' + esc(g.nome) + '</b><p class="small">' + esc(g.idea) + '</p><p class="small muted">Melodia: ' + esc(instName(g.inst.melodia)) + ' · Accordi: ' + esc(instName(g.inst.accordi)) + ' · Atmosfera: ' + esc(instName(g.inst.pad)) + '</p><button class="btn sm" data-labgen="' + i + '">Prova nella base</button></div>';
    }).join('');
    var mine = LIB.settings.lab || [];
    $('#lab-mine').innerHTML = mine.length ? '<h3 style="margin-top:12px">I tuoi strumenti</h3>' + mine.map(function (r) {
      return '<div class="note" style="margin-top:6px"><div class="row" style="justify-content:space-between;align-items:center"><b>' + esc(r.nome) + '</b><span class="row"><button class="btn sm" data-labprev="' + r.id + '">Ascolta</button><button class="btn sm" data-labedit="' + r.id + '">Modifica</button><button class="btn sm" data-labdel="' + r.id + '">Elimina</button></span></div><p class="small muted">' + esc(r.descr || '') + '</p></div>';
    }).join('') : '';
  }
  $('#lab-a').innerHTML = labOptions(false); $('#lab-b').innerHTML = labOptions(true); $('#lab-a').value = 'piano'; renderKnobs();
  $('#lab-knobs').addEventListener('input', function (e) { var k = e.target.getAttribute('data-knob'); if (!k) return; LAB.c[k] = +e.target.value / 100; $('[data-kv="' + k + '"]').textContent = e.target.value + '%'; });
  $('#lab-bv').addEventListener('input', function () { $('#lab-bvv').textContent = this.value + '%'; });
  $('#lab-m').addEventListener('input', function () { $('#lab-mv').textContent = this.value + '%'; });
  $('#lab-play').addEventListener('click', function () { labPlayRec(labCurrent(), $('#lab-msg')); });
  $('#lab-rand').addEventListener('click', function () {
    LAB.seed = (LAB.seed || Math.floor(Math.random() * 9000) + 1) + 1;
    var r = SoundLab.invent(LAB.seed); labSet(r); $('#lab-name').value = ''; $('#lab-msg').textContent = 'Invenzione n. ' + LAB.seed + ': ' + r.descr;
    labPlayRec(Object.assign(r, { id: 'lab:prova' }), $('#lab-msg'));
  });
  $('#lab-save').addEventListener('click', function () {
    var r = labCurrent(), nm = $('#lab-name').value.trim(); if (!nm) { $('#lab-msg').textContent = 'Dai un nome al tuo strumento.'; return; }
    LIB.settings.lab = LIB.settings.lab || [];
    var ex = LIB.settings.lab.filter(function (x) { return x.nome === nm; })[0];
    r.id = ex ? ex.id : 'lab:mio' + Date.now().toString(36); r.nome = nm;
    r.descr = 'Strati: ' + r.strati.map(function (L) { return instName(L.src) || L.src; }).join(' + ') + (Object.keys(r.c).length ? '. Carattere: ' + Object.keys(r.c).map(function (k) { return k + ' ' + Math.round(r.c[k] * 100) + '%'; }).join(', ') : '') + '.';
    if (ex) LIB.settings.lab[LIB.settings.lab.indexOf(ex)] = r; else LIB.settings.lab.push(r);
    SoundLab.install(r); persist(); renderLab(); refreshInstSelects();
    $('#lab-msg').textContent = '"' + nm + '" salvato. Ora lo trovi nei menu Melodia, Accordi e Atmosfera della base.';
  });
  $('#v-strumenti').addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    var pv = t.getAttribute('data-labprev'), ed = t.getAttribute('data-labedit'), dl = t.getAttribute('data-labdel'), gi = t.getAttribute('data-labgen');
    if (pv) labPlayRec(labRec(pv), $('#lab-msg'));
    if (ed) { var r = labRec(ed); labSet(r); $('#lab-name').value = (LIB.settings.lab || []).indexOf(r) >= 0 ? r.nome : r.nome + ' (mia versione)'; $('#lab-msg').textContent = 'Modifica i cursori, premi Ascolta, poi Salva.'; $('#lab-a').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    if (dl) { LIB.settings.lab = (LIB.settings.lab || []).filter(function (x) { return x.id !== dl; }); persist(); renderLab(); refreshInstSelects(); }
    if (gi != null) { var g = SoundLab.GENRES[+gi], p = cur().prod; p.genre = g.base; p.bpm = g.bpm || ALLG[g.base].bpm; p.tune = null; if (['trap', 'drill', 'epico', 'boombap', 'street', 'trapdark', 'clubtrap'].indexOf(g.base) >= 0) p.mode = 'minore'; p.inst = Object.assign({}, g.inst); persist(); fillBase(); ensureInst(); $('#lab-msg').textContent = '"' + g.nome + '" impostato. Vai in Studio e premi "Crea e ascolta".'; }
  });
  var stFam = 'tutte';
  SHOW.strumenti = function () {
    renderLab();
    $('#st-count').textContent = Instruments.CATALOG.length + ' strumenti';
    $('#st-how').innerHTML = '<ol class="small" style="padding-left:18px;line-height:1.6">' +
      '<li><b>Ritmo</b> (cassa, rullante o clap, hi-hat): decide il genere e la velocità. Va per primo.</li>' +
      '<li><b>Basso</b> (808 o basso rotondo): suona la nota principale dell\'accordo insieme alla cassa. Registro Do1-Do3.</li>' +
      '<li><b>Accordi</b> (piano, chitarra, arpa, piano elettrico): danno l\'emozione (minore = malinconia, maggiore = luce). Registro Do3-Do5.</li>' +
      '<li><b>Melodia</b> (flauto, campane, pizzicati, synth): il "gancio" che si ricorda. Registro Do4-Do6. Suona soprattutto quando la voce tace.</li>' +
      '<li><b>Atmosfera / pad</b> (archi, organo, cristalli): note lunghe e basse di volume che riempiono lo spazio.</li>' +
      '<li><b>Colore</b> (glockenspiel, campane, kalimba): pochi tocchi nei punti importanti.</li></ol>' +
      '<p class="small"><b>Regola d\'oro:</b> ogni strumento al suo "piano" (registro), così non si coprono. Insieme alla voce, al massimo 3-4 elementi alla volta. Strofa = pochi strumenti (spazio al testo); ritornello = si aggiungono melodia e archi. Il testo viene prima: scegli gli strumenti in base all\'emozione delle tue parole.</p>';
    $('#st-rec').innerHTML = Object.keys(Instruments.RECIPES).map(function (g) {
      var R = Instruments.RECIPES[g], nm = function (l) { return l.map(instName).join(', '); };
      return '<div class="note" style="margin-top:8px"><b>' + esc(R.nome) + '</b><p class="small">' + esc(R.spiega) + '</p><p class="small muted">Melodia: ' + esc(nm(R.melodia)) + ' · Accordi: ' + esc(nm(R.accordi)) + ' · Atmosfera: ' + esc(nm(R.pad)) + '</p>' +
        '<button class="btn sm" data-recipe="' + g + '">Usa nella base (' + esc(ALLG[g] ? ALLG[g].label : g) + ')</button></div>';
    }).join('');
    $('#st-fam').innerHTML = ['tutte'].concat(Object.keys(Instruments.FAMILIES)).map(function (f) { return '<button class="chip' + (f === stFam ? ' on' : '') + '" data-fam="' + f + '">' + (f === 'tutte' ? 'Tutte' : esc(Instruments.FAMILIES[f])) + '</button>'; }).join('');
    $('#st-list').innerHTML = Instruments.CATALOG.filter(function (c) { return stFam === 'tutte' || c.fam === stFam; }).map(function (c) {
      return '<div class="note" style="margin-top:8px"><div class="row" style="justify-content:space-between;align-items:center"><b>' + esc(c.nome) + '</b><button class="btn sm" data-prev="' + c.id + '">Ascolta</button></div>' +
        '<p class="small muted">' + esc(c.famiglia) + ' · ' + (c.fonte === 'campione' ? 'registrato (CC0)' : 'sintetizzato') + ' · ' + esc(c.ruoli.join(', ')) + ' · da ' + noteNm(c.range[0]) + ' a ' + noteNm(c.range[1]) + '</p>' +
        '<p class="small"><b>Come si usa:</b> ' + esc(c.come) + '</p><p class="small"><b>Combacia con:</b> ' + esc(c.combina.map(instName).join(', ')) + '. ' + esc(c.perche) + '</p>' +
        '<p class="small muted">Stili: ' + esc(c.stili.join(', ')) + '</p></div>';
    }).join('');
  };
  $('#v-strumenti').addEventListener('click', async function (e) {
    var t = e.target.closest('button'); if (!t) return;
    if (t.getAttribute('data-fam')) { stFam = t.getAttribute('data-fam'); SHOW.strumenti(); return; }
    if (t.getAttribute('data-prev')) { previewInst(t.getAttribute('data-prev'), $('#st-msg')); return; }
    var g = t.getAttribute('data-recipe');
    if (g) { var p = cur().prod; if (ALLG[g]) { p.genre = g; p.bpm = ALLG[g].bpm; p.tune = null; if (['trap', 'drill', 'epico', 'boombap', 'street', 'trapdark', 'clubtrap'].indexOf(g) >= 0) p.mode = 'minore'; } applyRecipe(g); persist(); fillBase(); $('#st-msg').textContent = 'Ricetta applicata. Vai in Studio e premi "Crea e ascolta".'; ensureInst(); }
  });

  /** Testo da mostrare al tempo t con la mappa (anche nello Studio). */
  /* Guida al canto: istruzioni riga per riga (entrata, tenuta, respiro) dal testo e dalla base */
  function sgGuide(map) { if (!map) return null; if (!map.__guide) map.__guide = SingGuide.build(map); return map.__guide; }
  function sgCue(map, i) { var g = sgGuide(map), l = g && g.lines[i]; return l && l.cue ? '<small class="sgcue"><b>' + esc(l.cue) + '</b></small>' : ''; }
  function sgRender(checkRes) {
    var map = songMap(), g = sgGuide(map), box = $('#sg-out'); if (!box) return;
    if (!g) { box.innerHTML = '<p class="small">Scrivi prima il testo: la guida nasce da quello e dalla base.</p>'; return; }
    var ST = { ok: 'Ok', vuota: 'Non cantata', sfora: 'Sfora sulla riga dopo', tardi: 'Entri tardi' };
    box.innerHTML = '<p class="small"><span class="tag m">Misurato</span> ' + g.lines.length + ' righe · ' + Math.round(map.barSec * 10) / 10 + ' s a battuta. Soglie di velocità e respiro: <span class="tag i">Ipotesi</span>.</p><ol class="clean small sg-list">' + g.lines.map(function (l) {
      var c = checkRes && checkRes.lines[l.index];
      return '<li><b>' + esc(l.text) + '</b><br>Entra a battuta ' + l.entryBar + ' (' + l.entrySec + ' s) · ' + l.mode + ' · ' + l.syllables + ' sillabe in ' + l.singSec + ' s' + (l.cue ? '<br>' + esc(l.cue) : '') + (l.warn ? '<br><span class="tag soon">Attenzione</span> ' + esc(l.warn) : '') +
        (c ? '<br><span class="tag ' + (c.status === 'ok' ? 'm' : 'soon') + '">' + ST[c.status] + '</span> hai cantato ' + c.voicedSec + ' s su ' + c.plannedSec + ' previsti' + (c.spillSec ? ', sfori di ' + c.spillSec + ' s' : '') : '') + '</li>';
    }).join('') + '</ol>' + (checkRes ? '<p class="small">' + (checkRes.bad ? checkRes.bad + ' righe da rifare.' : 'Tutte le righe sono dentro la guida.') + '</p>' : '');
  }
  document.addEventListener('click', function (e) {
    var id = e.target && e.target.id; if (id === 'sg-go') sgRender(null);
    if (id === 'sg-check') { var t = activeTake(), map = songMap(), g = sgGuide(map); if (!t) { $('#sg-out').innerHTML = '<p class="small">Registra prima una ripresa (parte insieme alla base).</p>'; return; } sgRender(SingGuide.check(t.mono, t.sr, g, map)); }
  });
  function lyricHtml(map, t) {
    var a = SongMap.at(map, t);
    if (a.state === 'vuoto') return { key: 'v', html: '<div><b>Scrivi un testo per vederlo qui</b></div>' };
    if (a.state === 'prima') return { key: 'p' + a.bars, html: '<div><span class="mode">intro</span><br><b>Si parte tra ' + a.bars + (a.bars > 1 ? ' battute' : ' battuta') + '</b><small>Prima riga: ' + esc(a.next.text) + '</small></div>' };
    if (a.state === 'fine') return { key: 'f', html: '<div><b>Fine del testo</b><small>La base chiude con l\'outro</small></div>' };
    var words = a.line.words.map(function (w, k) { return k === a.word ? '<mark>' + esc(w.w) + '</mark>' : (k < a.word ? '<span class="sung">' + esc(w.w) + '</span>' : esc(w.w)); }).join(' ');
    return { key: a.index + ':' + a.word + ':' + a.bar, html: '<div><span class="mode">' + a.line.section + ' · ' + a.line.mode + ' · ' + a.line.bars + (a.line.bars > 1 ? ' battute' : ' battuta') + '</span><br><b class="kw">' + words + '</b><small>Battuta ' + (a.bar + 1) + '/' + a.line.bars + (a.next ? ' · poi: ' + esc(a.next.text) : ' · ultima riga') + '</small>' + sgCue(map, a.index) + '</div>' };
  }

  /* ================= Coach ================= */
  function coachState() { LIB.settings.coach = LIB.settings.coach || Coach.fresh(); return LIB.settings.coach; }
  function coachCtx() {
    var s = cur(), p = s.prod, a = analysisOf(s), sug = a ? LyricsToBase.suggest(a, {}) : null;
    return { genre: p.genre, mode: p.mode, bpm: p.bpm, inst: Object.assign({}, p.inst || {}), emotion: sug && sug.confident ? sug.emotion : null };
  }
  function coachRec(type, ctx, extra) { Coach.record(coachState(), type, ctx, extra); persist(); renderCoach(); }
  function coachName(k) {
    var parts = k.split(':'), key = parts[0], val = parts.slice(1).join(':');
    if (key === 'genre') return 'stile ' + (ALLG[val] ? ALLG[val].label : val);
    if (key === 'mode') return 'scala ' + val;
    if (key === 'bpm') return 'circa ' + val + ' BPM';
    if (key.indexOf('inst.') === 0) return instName(val) + ' (' + key.slice(5) + ')';
    return k;
  }
  function coachCands(genre) {
    var R = Instruments.RECIPES[genre] || Instruments.RECIPES.melodico, out = {};
    ['melodia', 'accordi', 'pad'].forEach(function (role) {
      var m = {}, put = function (id, pr) { if (id && (m[id] == null || m[id] < pr)) m[id] = pr; };
      (R[role] || []).forEach(function (id, i) { put(id, 2 - i * 0.3); });
      SoundLab.ORIGINALS.forEach(function (o) { if ((o.ruoli.indexOf(role) >= 0 || role === 'pad' && o.tipo === 'sostenuto') && o.stili.indexOf(genre) >= 0) put(o.id, 1.2); });
      (LIB.settings.lab || []).forEach(function (o) { put(o.id, 1); });
      Instruments.CATALOG.forEach(function (c) { if (c.ruoli.indexOf(role) >= 0 || role === 'pad' && c.tipo === 'sostenuto') put(c.id, c.stili.indexOf(genre) >= 0 ? 0.8 : (c.id === 'flute' ? -1 : 0.2)); });
      out[role] = Object.keys(m).map(function (id) { return { id: id, prior: m[id] }; });
    });
    return out;
  }
  $('#co-like').addEventListener('click', function () { if (!SESSION.baseMade) { $('#co-msg').textContent = 'Prima crea e ascolta una base.'; return; } coachRec('like', coachCtx()); $('#co-msg').textContent = 'Segnato: questa combinazione ti piace. La userò di più.'; });
  $('#co-dislike').addEventListener('click', function () { if (!SESSION.baseMade) { $('#co-msg').textContent = 'Prima crea e ascolta una base.'; return; } coachRec('dislike', coachCtx()); $('#co-msg').textContent = 'Segnato: la eviterò. Premi "Crea con il Coach" per un\'altra proposta.'; });
  $('#co-make').addEventListener('click', async function () {
    var s = cur(), p = s.prod, a = analysisOf(s), ctx = coachCtx();
    if (a && !SESSION.coachSet) { var sug = LyricsToBase.suggest(a, { tonic: p.tonic }); if (sug.confident && p.genre !== sug.genre) { p.genre = sug.genre; p.mode = sug.mode; p.bpm = sug.bpm; p.tune = null; } }
    var res = Coach.suggest(coachState(), coachCands(p.genre), { emotion: ctx.emotion, seed: (coachState().n + 1) * 7 + p.seed });
    p.inst = res.inst; p.seed++; persist(); fillBase();
    $('#co-msg').innerHTML = '<b>Il Coach ha scelto' + (ctx.emotion ? ' (testo: ' + esc(ctx.emotion) + ')' : '') + ':</b><br>' + res.why.map(function (w) { var ids = Object.keys(res.inst).map(function (k) { return res.inst[k]; }).concat(res.explore ? [res.explore.from] : []); ids.sort(function (x, y) { return y.length - x.length; }); ids.forEach(function (id) { if (id) w = w.split(id).join(instName(id)); }); return esc(w); }).join('<br>') + '<br><span class="muted">Dimmi "Mi piace" o "Non mi piace": così impara.</span>';
    await makeAndPlay(false);
  });
  function coachMeasure() {
    var s = cur(), p = s.prod, t = activeTake(), m = {};
    var tl = ClipFx.timeline(lyricLines(s.lyrics), { bpm: p.bpm, syll: LyricsEngine.lineSyllables, modes: s.modes || {}, barsPerLine: 'auto' }), barSec = 240 / p.bpm;
    if (tl.length) m.lines = tl.map(function (l) { return { text: l.text, need: l.syllables / ({ parla: 5.5, canta: 3, allunga: 1.8 })[l.mode] / barSec }; });
    m.base = { tonic: p.tonic, mode: p.mode, bpm: p.bpm, bars: (SESSION.base && songMap()) ? SESSION.base.bars : (songMap() ? 999 : p.bars), melodia: p.levels.melodia, name: NOTES[p.tonic] + ' ' + p.mode };
    if (t && !t.example) {
      var r = t.res;
      m.take = { peakDb: r.levels.peakDb, rmsDb: r.levels.rmsDb, clippingShare: r.levels.clippingShare, cents: r.pitch ? r.pitch.meanAbsCentsFromNote : null, voiced: r.voicedShare, key: t.key && t.key.tonic != null ? { tonic: t.key.tonic, mode: t.key.mode, confidence: t.key.confidence, name: t.key.name } : null };
      try { // equilibrio voce/base, misurato sul mix reale
        var b = getBase(), mix = Backing.mix(b, p.levels, p.sec), v = t.final || t.mono, g = +$('#v-gain').value / 100, n = Math.min(v.length, Math.round(mix.length * t.sr / b.sampleRate));
        var ev = 0, eb = 0, cnt = 0; for (var i = 0; i < n; i += 4) { var x = v[i] * g; if (Math.abs(x) > 0.02) { ev += x * x; var j = Math.round(i * b.sampleRate / t.sr); eb += mix[j] * mix[j]; cnt++; } }
        if (cnt > 100 && eb > 0) m.mixDb = 10 * Math.log10(ev / eb);
      } catch (e) {}
    }
    m.recentInst = coachState().log.filter(function (x) { return x.t === 'complete' || x.t === 'save' || x.t === 'like'; }).map(function (x) { return x.i.split(',')[0]; }).filter(Boolean);
    return m;
  }
  var LAST_LESSONS = [];
  function coachCheck(auto) {
    var res = Coach.lessons(coachMeasure());
    Coach.learn(coachState(), res); persist(); LAST_LESSONS = res.lessons;
    $('#co-lessons').innerHTML = res.lessons.length ? res.lessons.map(function (l, i) {
      return '<div class="note' + (l.level === 'errore' ? ' warn' : '') + '" style="margin-top:8px"><b>' + esc(l.title) + '</b> <span class="tag m">Misurato</span><p class="small">' + esc(l.what) + '</p><p class="small"><b>Perché conta:</b> ' + esc(l.why) + '</p><p class="small"><b>Come si fa:</b> ' + esc(l.how) + '</p>' + (l.fix ? '<button class="btn sm" data-cofix="' + i + '">Correggi per me</button>' : '') + '</div>';
    }).join('') : '<div class="note" style="margin-top:8px">' + (res.checked.length ? 'Tutto a posto su: ' + res.checked.map(function (k) { return Coach.SKILLS[k]; }).join(', ') + '.' : 'Niente da controllare: scrivi un testo, crea una base e registra la voce.') + '</div>';
    if (!auto) $('#co-msg').textContent = res.lessons.length ? res.lessons.length + ' cose da migliorare. Ogni abilità si impara dopo 3 controlli giusti di fila.' : '';
    else if (res.lessons.length) $('#co-msg').textContent = 'Il Coach ha ascoltato la registrazione: guarda i consigli qui sotto.';
    renderCoach();
  }
  $('#co-check').addEventListener('click', function () { coachCheck(false); });
  $('#co-lessons').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cofix]'); if (!b) return;
    $('#co-msg').textContent = coachFix(LAST_LESSONS[+b.getAttribute('data-cofix')]);
  });
  function coachFix(l) {
    var s = cur(), p = s.prod, f = l.fix, msg = '';
    if (f.type === 'key') { p.tonic = f.tonic; p.mode = f.mode; msg = 'Base portata in ' + NOTES[f.tonic] + ' ' + f.mode + '.'; }
    else if (f.type === 'level') { p.levels[f.key] = f.value; msg = 'Melodia guida al ' + Math.round(f.value * 100) + '%.'; }
    else if (f.type === 'voicegain') { var g = $('#v-gain'); g.value = Math.max(20, Math.min(160, Math.round(+g.value * Math.pow(10, f.delta / 20)))); $('#v-gv').textContent = g.value + '%'; msg = 'Volume voce ora ' + g.value + '%.'; }
    else if (f.type === 'parla') { s.modes = s.modes || {}; f.lines.forEach(function (x) { s.modes[x] = 'parla'; }); renderGuide(); msg = f.lines.length + ' righe segnate come "parla" (rap).'; }
    else if (f.type === 'follow') { p.follow = true; followBars(); msg = 'La base ora dura quanto il testo (' + p.bars + ' battute).'; }
    else if (f.type === 'autotune') { location.hash = '#voce'; msg = 'Apri l\'autotune qui in Voce.'; }
    persist(); fillBase(); SESSION.baseKey = ''; return 'Fatto: ' + msg + ' Riascolta e controlla di nuovo.';
  }
  function renderCoach() {
    var st = coachState(), pf = Coach.profile(st, coachName), pg = Coach.progress(st);
    $('#co-profile').innerHTML = st.n ? '<b>Cosa ho imparato di te</b> (' + pf.gesti + ' gesti): ' + (pf.piace.length ? 'ti piacciono ' + esc(pf.piace.join(', ')) : 'ancora troppo presto per dirlo') + (pf.scarti.length ? '. Scarti spesso: ' + esc(pf.scarti.join(', ')) : '') + '.' : '';
    $('#co-progress').innerHTML = '<b>Il tuo percorso: ' + esc(pg.livello) + '</b> <span class="small muted">(' + pg.imparate + '/' + pg.totale + ' abilità)</span><div class="chips" style="margin-top:6px">' + pg.skills.map(function (k) { return '<span class="chip' + (k.imparata ? ' on' : '') + '" title="' + k.ok + ' ok, ' + k.ko + ' da sistemare">' + (k.imparata ? '✓ ' : '') + esc(k.nome) + '</span>'; }).join('') + '</div>';
  }

  /* ================= Studio (DAW): tracce, trasporto, testo, agenti ================= */
  var DW = { srcs: [], gains: {}, master: null, playing: false, t0: 0, from: 0, raf: 0, mute: {}, solo: {}, bufs: null, bufKey: '', px: 34, rec: null, recording: false, k: 1 };
  var LANES = [
    { id: 'drums', nome: 'Batteria', tracks: ['kick', 'snare', 'hat'], level: 'batteria', c: '#e3c48f' },
    { id: 'bass', nome: 'Basso 808', tracks: ['bass'], level: 'basso', c: '#ff8f6b' },
    { id: 'chords', nome: 'Accordi', tracks: ['chords'], level: 'accordi', role: 'accordi', c: '#9c86ff' },
    { id: 'arp', nome: 'Arpeggio', tracks: ['arp'], level: 'arpeggio', role: 'arpeggio', c: '#6fd8cb' },
    { id: 'lead', nome: 'Melodia', tracks: ['lead'], level: 'melodia', role: 'melodia', c: '#e6a1c4' },
    { id: 'pad', nome: 'Atmosfera', tracks: ['pad', 'fx'], level: 'pad', role: 'pad', c: '#8fb4ff' },
    { id: 'sfx', nome: 'Effetti', tracks: [], level: 'effetti', fx: true, c: '#ffb454' },
    { id: 'voice', nome: 'Voce', voice: true, level: 'voce', c: '#ff5d6c' },
    { id: 'vox', nome: 'Voci prod.', voxfx: true, level: 'vocifx', c: '#ff9ec0' }
  ];
  var SECCOL = { intro: '#8a8c96', strofa: '#9c86ff', pre: '#6fd8cb', ritornello: '#e3c48f', bridge: '#e6a1c4', outro: '#8a8c96' };
  function lvl(k) { var v = cur().prod.levels[k]; return v == null ? 1 : v; }
  function dwFill() {
    var s = cur(), p = s.prod;
    $('#dw-name').value = s.title === 'Senza titolo' ? '' : (s.title || '');
    var gk = Object.keys(Arranger.STYLES);
    $('#dw-genre').innerHTML = gk.map(function (g) { return '<option value="' + g + '">' + esc(Arranger.STYLES[g].label) + '</option>'; }).join('');
    if (gk.indexOf(p.genre) < 0) { p.genre = 'melodico'; }
    $('#dw-genre').value = p.genre; $('#dw-bpm').value = p.bpm;
    var ko = []; NOTES.forEach(function (n, i) { ko.push('<option value="' + i + ':minore">' + n + ' minore</option>', '<option value="' + i + ':maggiore">' + n + ' maggiore</option>'); });
    $('#dw-key').innerHTML = ko.join(''); $('#dw-key').value = p.tonic + ':' + p.mode;
    if ($('#dw-lyrics') !== document.activeElement) $('#dw-lyrics').value = s.lyrics || '';
    $('#dw-master').value = p.master || 'standard';
    var off = +($('#v-off') ? $('#v-off').value : 0) || 0; $('#dw-off').value = off; $('#dw-offv').textContent = off;
    dwLyInfo(); dwSteps();
  }
  function dwLyInfo() {
    var m = songMap();
    $('#dw-lyinfo').textContent = m ? m.lines.length + ' righe · ' + m.plan.filter(function (x) { return x[0] !== 'intro' && x[0] !== 'outro'; }).length + ' parti · ' + m.totalBars + ' battute' : 'nessun testo';
  }
  function dwSteps() {
    var s = cur(), st = { testo: !!lyricLines(s.lyrics).length, base: !!SESSION.baseMade, voce: SESSION.takes.some(function (t) { return !t.example; }), mix: !!SESSION.dwExported };
    st.base = st.base && !!SESSION.lastPlay; /* la base conta solo se l'hai davvero fatta partire */
    var first = ['testo', 'base', 'voce', 'mix'].filter(function (k) { return !st[k]; })[0];
    $$('#dw-steps a').forEach(function (a) { var k = a.getAttribute('data-step'); a.classList.toggle('done', st[k]); a.classList.toggle('now', k === first); });
    /* «Prossimo passo»: una scheda sola che dice cosa fare adesso, con un tasto grande */
    var nx = $('#dw-next'); if (!nx) { var bar = $('#v-daw .dw-transport') || $('#v-daw').firstElementChild; if (!bar || !bar.parentNode) return; nx = document.createElement('div'); nx.id = 'dw-next'; nx.className = 'dw-panel'; nx.style.cssText = 'margin:8px 0;padding:12px;border:2px solid var(--accent,#8b5cf6);border-radius:12px'; bar.parentNode.insertBefore(nx, $('#dw-ws') || bar.nextSibling); }
    var TX = { testo: ['Passo 1 di 4 · Scrivi il testo', 'Incolla o scrivi la tua canzone. Il titolo e il ritornello li capisco io.', 'Vai al testo'], base: ['Passo 2 di 4 · Crea la base', 'Premi «Crea e ascolta»; se non ti piace premi «Nuova variante»: cambia davvero.', 'Vai alla base'], voce: ['Passo 3 di 4 · Registra la voce', 'Metti le cuffie, premi ● e canta sulla base (microfono solo da Safari).', 'Vai alla voce'], mix: ['Passo 4 di 4 · Mix e salvataggio', 'Regola i volumi, ascolta tutto e salva la canzone.', 'Vai al mix'] };
    if (!first) { nx.innerHTML = '<b>Canzone pronta</b><div class="small muted">Hai fatto tutti i passi. Per un\'altra versione torna alla base e premi «Nuova variante».</div>'; return; }
    nx.innerHTML = '<b>' + TX[first][0] + '</b><div class="small muted" style="margin:4px 0 8px">' + TX[first][1] + '</div><button class="btn pri" id="dw-next-go" data-go="' + first + '" style="width:100%">' + TX[first][2] + '</button>';
  }
  document.addEventListener('click', function (e) { var g = e.target.closest && e.target.closest('#dw-next-go'); if (g) { dwWs(g.getAttribute('data-go')); window.scrollTo(0, 0); } });
  async function dwBase() {
    await ensureInst();
    var b = getBase(); SESSION.baseMade = true; return b;
  }
  function voiceTake() { var t = activeTake(); return t && !t.example ? t : null; }
  function dwBuffers(b) {
    var t = voiceTake(), pf0 = pfPlan(), key = SESSION.baseKey + '|' + vclipKey() + '|' + pfKey(pf0);
    if (DW.bufKey === key && DW.bufs) return DW.bufs;
    var bufs = {}, N = b.length, sum = new Float32Array(N), i;
    LANES.forEach(function (L) {
      if (L.voice || L.fx || L.voxfx) return;
      var x = new Float32Array(N);
      L.tracks.forEach(function (tr) { var a = b.tracks[tr]; if (a) for (i = 0; i < N; i++) x[i] += a[i]; });
      // bilanciamento automatico (come un fonico): ogni traccia al suo livello di riferimento (RMS dei punti attivi)
      var tgt = { drums: -18, bass: -17.5, chords: -18, lead: -16.5, arp: -21, pad: -20 }[L.id], ss = 0, nn = 0;
      for (i = 0; i < N; i += 4) { var av = x[i] < 0 ? -x[i] : x[i]; if (av > 1e-4) { ss += x[i] * x[i]; nn++; } }
      if (tgt != null && nn > N / 400) { var rdb = 10 * Math.log10(ss / nn), gk = Math.pow(10, Math.max(-24, Math.min(26, tgt - rdb)) / 20); for (i = 0; i < N; i++) x[i] *= gk; }
      for (i = 0; i < N; i++) sum[i] += x[i];
      bufs[L.id] = { x: x, sr: b.sampleRate, start: 0 };
    });
    var pk = 0; for (i = 0; i < N; i++) { var v = sum[i] < 0 ? -sum[i] : sum[i]; if (v > pk) pk = v; }
    DW.k = pk > 0 ? 0.8 / pk : 1;
    var vb = vclipBuffer(b.duration); if (vb) bufs.voice = vb;
    if (pf0 && pf0.on && pf0.events && pf0.events.length) {
      try { bufs.sfx = { x: ProdFx.renderSfx(pf0.events, b.sampleRate, b.bpm, N, { seed: pf0.seed, tonic: b.tonic, mode: b.mode }), sr: b.sampleRate, start: 0 }; } catch (e) {}
      if (vb) try { var vx = ProdFx.renderVox(pf0.events, vb, songMap(), b.bpm, { bank: ADLIB.list, melodic: !PF_HARD[b.genre] }); if (vx) bufs.vox = { x: vx, sr: vb.sr, start: 0 }; } catch (e) {}
    }
    DW.bufs = bufs; DW.bufKey = key; return bufs;
  }
  function gainFor(L) {
    var any = Object.keys(DW.solo).some(function (k) { return DW.solo[k]; });
    if (DW.mute[L.id] || (any && !DW.solo[L.id])) return 0;
    if (L.voice) return DW.recording ? 0 : lvl('voce');
    if (L.voxfx) return DW.recording ? 0 : lvl('voce') * lvl(L.level);
    return lvl(L.level) * DW.k;
  }
  function dwGains() { LANES.forEach(function (L) { var g = DW.gains[L.id]; if (g) g.gain.setTargetAtTime(gainFor(L), g.context.currentTime, 0.02); }); }
  function dwStop(keepPos, keepRec) {
    cancelAnimationFrame(DW.raf);
    DW.srcs.forEach(function (s) { try { s.onended = null; s.stop(); } catch (e) {} }); DW.srcs = []; DW.gains = {};
    if (DW.playing && !keepPos) DW.from = 0;
    document.body.classList.remove('dw-playing', 'mood-hi');
    DW.playing = false; var pb = $('#dw-play'); if (pb) { pb.classList.remove('on'); pb.innerHTML = '<svg><use href="#i-play"/></svg>'; }
    if (DW.rec && !DW.rec.stopping && !keepRec) dwRecStop();
  }
  async function dwPlay(from) {
    var ctx = getCtx(); if (!ctx) { $('#dw-msg').textContent = 'Questo browser non riproduce audio.'; return; }
    stopPlay(); dwStop(true, true);
    $('#dw-msg').textContent = SESSION.base ? '' : 'Compongo la base…'; await tick();
    var b; try { b = await dwBase(); } catch (e) { $('#dw-msg').textContent = 'Non riesco a creare la base.'; return; }
    var bufs = dwBuffers(b); dwDraw(b);
    from = Math.max(0, Math.min(from || 0, b.duration - 0.5)); DW.from = from;
    var master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination); DW.master = master;
    var t0 = ctx.currentTime + 0.08; DW.t0 = t0; DW.dur = b.duration;
    var gr = dwGraph(ctx, master, bufs, b, from, t0, DW.gains); DW.mixer = gr.mixer; DW.srcs = gr.srcs;
    gr.srcs.forEach(function (src) { if (src._lane === 'drums') src.onended = function () { if (DW.playing) { var lp = SESSION.lastPlay; if (DW.from === 0 && lp) coachRec('complete', lp.ctx); dwStop(); dwPos(0); } }; });
    applyMoodBg(moodNow()); document.body.style.setProperty('--beat', (60 / b.bpm).toFixed(3) + 's'); document.body.classList.add('dw-playing');
    audioCheck(); DW.playing = true; SESSION.lastPlay = { t: performance.now(), ctx: coachCtx(), dur: b.duration };
    var pb = $('#dw-play'); pb.classList.add('on'); pb.innerHTML = '<svg><use href="#i-stop"/></svg>';
    var map = songMap(), lk = '', loop = function () {
      if (!DW.playing) return;
      var t = ctx.currentTime - DW.t0 + DW.from; dwPos(t);
      if (map) { var h = lyricHtml(map, t); if (h.key !== lk) { lk = h.key; $('#dw-kar').innerHTML = h.html; var a = SongMap.at(map, t); $$('#dw-lyl span').forEach(function (sp, i) { sp.classList.toggle('on', a.state === 'riga' && a.index === i); }); } }
      DW.raf = requestAnimationFrame(loop);
    };
    loop(); dwSteps();
  }
  /* omino che canta: a tempo con lo Studio */
  var OM = { last: -1 };
  function ominoTick(t) {
    var cv = $('#dw-omino'); if (!cv || cv.offsetParent === null) return; var b = SESSION.base; if (!b) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    var map = null; try { map = songMap(); } catch (e) {}
    Omino.draw(cv, Omino.state(map, t, 60 / b.bpm), document.body.dataset.mood || '');
  }
  function dwPos(t) {
    var b = SESSION.base; if (!b) return; try { ominoTick(t); } catch (e) {}
    var barSec = 240 / b.bpm, x = t / barSec * DW.px, ph = $('#dw-playhead'); if (ph) ph.style.transform = 'translateX(' + x + 'px)';
    $('#dw-time').textContent = Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
    var bar = Math.floor(t / barSec), sec = (b.sections || []).filter(function (s) { return t >= s.startSec && t < s.endSec; })[0];
    if (DW.playing) document.body.classList.toggle('mood-hi', !!(sec && sec.name === 'ritornello'));
    $('#dw-pos').textContent = 'battuta ' + (bar + 1) + (sec ? ' · ' + sec.name : '');
    var sc = $('#dw-scroll'); if (DW.playing && sc && (x < sc.scrollLeft + 20 || x > sc.scrollLeft + sc.clientWidth - 40)) sc.scrollLeft = Math.max(0, x - 60);
  }
  function dwDraw(b) {
    b = b || SESSION.base; if (!b) return;
    var barSec = 240 / b.bpm, W = Math.max(320, Math.round(b.bars * DW.px)), map = songMap(), bufs = DW.bufs || {};
    $('#dw-canvas').style.width = W + 'px';
    var step = b.bars > 48 ? 4 : 2, r = '';
    for (var i = 0; i < b.bars; i += step) r += '<span style="left:' + i * DW.px + 'px">' + (i + 1) + '</span>';
    $('#dw-ruler').innerHTML = r;
    $('#dw-secs').innerHTML = (b.sections || []).map(function (s) { return '<span style="left:' + (s.startBar * DW.px + 1) + 'px;width:' + (s.bars * DW.px - 2) + 'px;background:' + (SECCOL[s.name] || '#888') + '">' + s.name + '</span>'; }).join('');
    $('#dw-lyl').innerHTML = map && b.bars === map.totalBars ? map.lines.map(function (l) { return '<span style="left:' + (l.startBar * DW.px + 1) + 'px;width:' + (l.bars * DW.px - 2) + 'px" title="' + esc(l.text) + '">' + esc(l.text) + '</span>'; }).join('') : '';
    var inst = cur().prod.inst || {};
    $('#dw-heads').innerHTML = '<div class="dw-hl">Battute</div><div class="dw-hl s">Parti</div><div class="dw-hl l">Testo</div>' + LANES.map(function (L) {
      var label = L.fx ? pfCount('sfx') + ' suoni dal testo' : L.voxfx ? pfCount('vox') + ' interventi voce' : L.role ? (inst[L.role] ? instName(inst[L.role]) : 'Sintetizzato') : (L.id === 'drums' ? (cur().prod.kit && SynthDesign.KITS[cur().prod.kit] ? 'Kit ' + SynthDesign.KITS[cur().prod.kit].nome : (cur().prod.sounds === 'sint' ? 'Sintetici' : 'Campioni veri')) : (L.id === 'bass' ? (cur().prod.bassStyle === '808' ? '808 sempre' : 'Dallo stile') : (voiceTake() ? voiceTake().name : 'Registra con ●')));
      return '<div class="dw-lh" style="--lc:' + L.c + '"><b>' + L.nome + '</b><button class="inst" data-inst="' + L.id + '">' + esc(label) + '</button><div class="ms"><button data-m="' + L.id + '" class="' + (DW.mute[L.id] ? 'on' : '') + '">M</button><button data-s="' + L.id + '" class="' + (DW.solo[L.id] ? 'on' : '') + '">S</button><input type="range" min="0" max="160" value="' + Math.round(lvl(L.level) * 100) + '" data-lv="' + L.id + '" aria-label="Volume ' + L.nome + '"></div></div>';
    }).join('');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    $('#dw-lanes').innerHTML = LANES.map(function (L) { return '<div class="dw-lane"><canvas data-c="' + L.id + '" width="' + Math.round(W * dpr) + '" height="' + Math.round(58 * dpr) + '" style="width:' + W + 'px"></canvas></div>'; }).join('');
    LANES.forEach(function (L) {
      var cv = $('[data-c="' + L.id + '"]'), g = cv.getContext('2d'), H = cv.height, Wc = cv.width;
      (b.sections || []).forEach(function (s, k) { if (k % 2) { g.fillStyle = 'rgba(255,255,255,.025)'; g.fillRect(s.startBar * DW.px * dpr, 0, s.bars * DW.px * dpr, H); } });
      var B = bufs[L.id]; if (!B) return;
      var x = B.x, sps = barSec * B.sr / (DW.px * dpr), off = B.start * B.sr, pk = 0, j;
      for (j = 0; j < x.length; j += 4) { var v0 = x[j] < 0 ? -x[j] : x[j]; if (v0 > pk) pk = v0; }
      if (!pk) return;
      g.fillStyle = L.c; g.globalAlpha = 0.85;
      for (var px = 0; px < Wc; px++) {
        var a = Math.floor(px * sps - off), z = Math.floor((px + 1) * sps - off), m = 0;
        if (z <= 0 || a >= x.length) continue;
        for (j = Math.max(0, a); j < Math.min(x.length, z); j += 2) { var v = x[j] < 0 ? -x[j] : x[j]; if (v > m) m = v; }
        var h = Math.max(1, Math.sqrt(m / pk) * (H * 0.44)); g.fillRect(px, H / 2 - h, 1, h * 2);
      }
    });
    var p = cur().prod, it = p.inst || {};
    $('#dw-arrinfo').textContent = (Arranger.STYLES[b.genre] ? Arranger.STYLES[b.genre].label : b.genre) + ' · ' + NOTES[b.tonic] + ' ' + b.mode + ' · ' + b.bpm + ' BPM · ' + b.bars + ' battute (' + fmt(b.duration, 0) + ' s)' + (map ? ' · forma dal testo' : '');
    dwPos(DW.from || 0);
  }
  async function dwRefresh() { try { var b = await dwBase(); dwBuffers(b); dwDraw(b); try { pfRender(); } catch (e) {} try { ominoTick(DW.from || 0); } catch (e) {} dwSteps(); if (window.__prReady) prDraw(); } catch (e) { $('#dw-msg').textContent = 'Non riesco a creare la base.'; } }
  var dwT = null;
  function dwChanged(rebuildAgents) { try { projLine(); } catch (e) {} SESSION.baseKey = ''; DW.bufKey = ''; persist(); clearTimeout(dwT); dwT = setTimeout(function () { dwRefresh(); if (rebuildAgents) agentsRun(); }, 250); }

  // ---------- registrazione nello Studio ----------
  async function dwRecord() {
    if (DW.rec) { dwStop(); return; }
    if (!micOk()) { $('#dw-msg').textContent = 'Microfono non disponibile qui: apri il sito in Safari (dentro Claude è bloccato).'; return; }
    var ctx = getCtx(), stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } }); }
    catch (e) { $('#dw-msg').textContent = 'Il microfono non parte (' + (e && e.name || 'errore') + '). Su iPhone: Impostazioni > Safari > Microfono.'; return; }
    var types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'], mime = window.MediaRecorder ? types.filter(function (t) { return MediaRecorder.isTypeSupported(t); })[0] : null;
    if (!mime) { stream.getTracks().forEach(function (t) { t.stop(); }); $('#dw-msg').textContent = 'Questo browser non registra.'; return; }
    var R = { stream: stream, chunks: [], mime: mime, mr: new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 256000 }) };
    R.mr.ondataavailable = function (e) { if (e.data && e.data.size) R.chunks.push(e.data); };
    R.done = new Promise(function (res) { R.mr.onstop = res; });
    DW.rec = R; DW.recording = true; $('#dw-rec').classList.add('on');
    R.mr.start(); R.at = ctx.currentTime;
    await dwPlay(0);
    R.lat = (DW.t0 - R.at) + (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
    $('#dw-msg').textContent = 'Registro: canta seguendo il testo. Premi ● o ■ per fermare. Usa le cuffie.';
  }
  async function dwRecStop() {
    var R = DW.rec; if (!R) return; R.stopping = true;
    try { if (R.mr.state !== 'inactive') R.mr.stop(); await R.done; } catch (e) {}
    R.stream.getTracks().forEach(function (t) { t.stop(); });
    DW.rec = null; DW.recording = false; $('#dw-rec').classList.remove('on');
    $('#dw-msg').textContent = 'Analizzo la registrazione…'; await tick();
    try {
      var d = await decode(new Blob(R.chunks, { type: R.mime })), mono = d.mono, sr = d.sr;
      if (mono.length < sr * 0.8) { $('#dw-msg').textContent = 'Registrazione troppo corta.'; return; }
      var pk = 0, i; for (i = 0; i < mono.length; i += 7) { var v = mono[i] < 0 ? -mono[i] : mono[i]; if (v > pk) pk = v; }
      if (pk > 0.003 && pk < 0.3) { var gk = 0.7 / pk; for (i = 0; i < mono.length; i++) mono[i] *= gk; }
      var t = await addTake(mono, sr, 'Studio ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }), false);
      t.lat = R.lat || 0; t.at = Date.now();
      dbTake('put', { id: t.id, name: t.name, mono: t.mono, sr: t.sr, lat: t.lat, at: t.at }).then(function (ok) { t.saved = !!ok; });
      SESSION.takeId = t.id; try { selectTake(t.id); } catch (e) {}
      cur().vclips = [Clips.whole(t, t.lat || 0)]; CLUI.sel = 0;
      coachRec('record', coachCtx()); DW.bufKey = ''; DW.raw = false;
      $('#dw-msg').textContent = 'Voce registrata. Applico il microfono (' + (micSet().mode === 'autotune' ? 'autotune' : 'pulito') + ')…';
      await micApply(true);
      $('#dw-msg').textContent = 'Voce registrata e regolata. Premi Play per riascoltarla con la base. Il Coach la sta controllando.';
      await dwRefresh(); clipsRender(); agentsRun(true);
    } catch (e) { $('#dw-msg').textContent = 'Non riesco a leggere la registrazione. Riprova.'; }
  }

  // ---------- scelta strumento (foglio) ----------
  var SHEET = { role: null, fam: 'tutte' };
  function sheetOpen(role) { SHEET.role = role; SHEET.fam = 'tutte'; $('#dw-sheet').hidden = false; sheetRender(); }
  function sheetRender() {
    var role = SHEET.role, cur0 = (cur().prod.inst || {})[role];
    $('#dw-sheet-t').textContent = 'Strumento per: ' + role;
    var fams = [['tutte', 'Tutti'], ['orig', 'Originali'], ['mine', 'I tuoi']].concat(Object.keys(Instruments.FAMILIES).map(function (f) { return [f, Instruments.FAMILIES[f]]; }));
    $('#dw-sheet-f').innerHTML = fams.map(function (f) { return '<button class="chip' + (SHEET.fam === f[0] ? ' on' : '') + '" data-sf="' + f[0] + '">' + esc(f[1]) + '</button>'; }).join('');
    var list = [{ id: '', nome: 'Sintetizzato (automatico)', come: 'Suono generato dal programma, cambia con lo stile.' }];
    var orig = SoundLab.ORIGINALS.map(function (r) { return { id: r.id, nome: r.nome, come: r.descr, o: 1 }; }), mine = (LIB.settings.lab || []).concat(LIB.settings.synths || [], LIB.settings.voxInst || []).map(function (r) { return { id: r.id, nome: r.nome, come: r.descr || 'Creato da te.', m: 1 }; });
    var pro = SynthDesign.PRO.filter(function (r) { return r.ruoli.indexOf(role) >= 0 || (role === 'arpeggio' && r.tipo === 'percussivo'); }).map(function (r) { return { id: r.id, nome: r.nome, come: r.come, f: 'synthpro', fam: 'synthpro', ruoli: r.ruoli, tipo: r.tipo }; });
    var cat = pro.concat(Instruments.CATALOG).filter(function (c) { if (c.f === 'synthpro') return true; return role === 'arpeggio' ? c.tipo !== 'sostenuto' || c.ruoli.indexOf('accordi') >= 0 : (c.ruoli.indexOf(role) >= 0 || (role === 'pad' && c.tipo === 'sostenuto')); }).map(function (c) { return { id: c.id, nome: c.nome, come: c.come, f: c.fam }; });
    if (SHEET.fam === 'orig') list = orig; else if (SHEET.fam === 'mine') list = mine; else if (SHEET.fam !== 'tutte') list = cat.filter(function (c) { return c.f === SHEET.fam; }); else list = list.concat(orig, mine, cat);
    $('#dw-sheet-g').innerHTML = list.length ? list.map(function (c) { return '<div class="dw-card' + ((c.id || '') === (cur0 || '') ? ' sel' : '') + '"><b>' + esc(c.nome) + '</b><small>' + esc((c.come || '').slice(0, 110)) + '</small><div class="row">' + (c.id ? '<button class="btn sm" data-sp="' + c.id + '">Ascolta</button>' : '') + '<button class="btn sm pri" data-su="' + c.id + '">Usa</button></div></div>'; }).join('') : '<p class="small muted">Niente qui: crea strumenti nel Laboratorio.</p>';
  }
  $('#dw-sheet').addEventListener('click', async function (e) {
    if (e.target === this || e.target.id === 'dw-sheet-x') { this.hidden = true; return; }
    var b = e.target.closest('button'); if (!b) return;
    if (b.getAttribute('data-sf')) { SHEET.fam = b.getAttribute('data-sf'); sheetRender(); return; }
    if (b.getAttribute('data-sp')) { previewInst(b.getAttribute('data-sp'), $('#dw-msg')); return; }
    if (b.hasAttribute('data-su')) {
      var id = b.getAttribute('data-su') || null, p = cur().prod, old = (p.inst || {})[SHEET.role];
      p.inst = Object.assign({}, p.inst || {}); p.inst[SHEET.role] = id; coachRec('change', coachCtx(), { role: SHEET.role, from: old, to: id });
      this.hidden = true; $('#dw-msg').textContent = id ? 'Carico ' + instName(id) + '…' : '';
      if (id && !(await loadInst(id))) $('#dw-msg').textContent = 'Download non riuscito (serve internet la prima volta).';
      else $('#dw-msg').textContent = (id ? instName(id) : 'Sintetizzato') + ' su ' + SHEET.role + '. Premi Play.';
      fillInst(); dwChanged(true);
    }
  });

  // ---------- agenti ----------
  var AG = { arr: { st: 'fermo', props: [] }, sd: { st: 'fermo', props: [] }, co: { st: 'fermo', lessons: [] }, li: { st: 'fermo', prop: null }, tv: { st: 'fermo', tips: [], rec: null }, busy: false, again: false, key: '' };
  function agentsRender() {
    var dot = function (st) { return '<span class="dw-dot ' + (st === 'al lavoro' ? 'work' : (st === 'pronto' ? 'ok' : '')) + '"></span>'; };
    var h = '<div class="dw-agent"><header>' + dot(AG.arr.st) + '<b>Arrangiatore</b><span class="st">' + AG.arr.st + '</span></header><p class="small muted">Prepara 3 varianti della tua base partendo da quello che ti è piaciuto. Una è sempre un esperimento.</p>' +
      AG.arr.props.map(function (pr, i) { return '<div class="dw-prop"><div><b>Variante ' + (i + 1) + (pr.explore ? ' · esperimento' : '') + '</b><small>' + esc(pr.desc) + '</small></div><button class="btn sm" data-ap="' + i + '">Ascolta</button><button class="btn sm pri" data-au="' + i + '">Usa</button><button class="btn sm" data-an="' + i + '" aria-label="Non mi piace">✕</button></div>'; }).join('') + '</div>';
    h += '<div class="dw-agent"><header>' + dot(AG.sd.st) + '<b>Inventore di suoni</b><span class="st">' + AG.sd.st + '</span></header><p class="small muted">Inventa strumenti nuovi mescolando i suoni che preferisci. Se uno ti piace, salvalo: diventa tuo.</p>' +
      AG.sd.props.map(function (r, i) { return '<div class="dw-prop"><div><b>' + esc(r.nome) + '</b><small>' + esc(r.descr) + '</small></div><button class="btn sm" data-sp2="' + i + '">Ascolta</button><button class="btn sm pri" data-su2="' + i + '">Usa</button><button class="btn sm" data-ss2="' + i + '">Salva</button></div>'; }).join('') + '</div>';
    h += '<div class="dw-agent"><header>' + dot(AG.co.st) + '<b>Coach</b><span class="st">' + AG.co.st + '</span></header><p class="small muted">Controlla testo, base e voce con misure vere. ' + esc(coachSummary()) + '</p>' +
      (AG.co.lessons.length ? AG.co.lessons.slice(0, 4).map(function (l, i) { return '<div class="dw-prop"><div><b>' + esc(l.title) + '</b><small>' + esc(l.what) + ' ' + esc(l.how) + '</small></div>' + (l.fix ? '<button class="btn sm pri" data-cf="' + i + '">Correggi</button>' : '') + '</div>'; }).join('') : '<div class="dw-prop"><div><small>Niente da correggere per ora.</small></div></div>') + '</div>';
    // Ascoltatore: impara dalle canzoni che carichi e propone una base con il groove dei tuoi gusti
    var nl = learnList().length, lk = learnList().filter(function (r) { return r.vote > 0; }).length;
    h += '<div class="dw-agent"><header>' + dot(AG.li.st) + '<b>Ascoltatore</b><span class="st">' + AG.li.st + '</span></header><p class="small muted">Ha studiato ' + nl + ' canzoni tue (' + lk + ' ti piacciono). Unisce i ritmi che ami ed evita quelli che non ami. <a href="#dw-p-learn">Fagli ascoltare una canzone</a>.</p>' +
      (AG.li.prop ? '<div class="dw-prop"><div><b>Base dai tuoi gusti</b><small>' + esc(AG.li.prop.desc) + '</small></div><button class="btn sm" data-lip="1">Ascolta</button><button class="btn sm pri" data-liu="1">Usa</button></div>' : '<div class="dw-prop"><div><small>' + (lk ? 'Preparo una proposta…' : 'Serve almeno una canzone che ti piace.') + '</small></div></div>') + '</div>';
    // Tecnico voce: misura la tua registrazione e regola il microfono
    h += '<div class="dw-agent"><header>' + dot(AG.tv.st) + '<b>Tecnico voce</b><span class="st">' + AG.tv.st + '</span></header><p class="small muted">Misura la tua voce registrata (rumore, intonazione, volume) e ti dice come regolare il microfono.</p>' +
      (AG.tv.tips.length ? AG.tv.tips.map(function (t) { return '<div class="dw-prop"><div><small>' + esc(t) + '</small></div></div>'; }).join('') + (AG.tv.rec ? '<div class="dw-prop"><div><b>Consiglio: ' + esc(AG.tv.rec.label) + '</b></div><button class="btn sm pri" data-tva="1">Applica</button></div>' : '') : '<div class="dw-prop"><div><small>Registra la voce con ● e la controllo.</small></div></div>') + '</div>';
    $('#dw-agents').innerHTML = h;
  }
  async function agentTecnico() {
    var t = voiceTake(); AG.tv.tips = []; AG.tv.rec = null;
    if (!t) { AG.tv.st = 'fermo'; return; }
    AG.tv.st = 'al lavoro'; agentsRender(); await wait(30);
    if (!t.vlInfo) t.vlInfo = VoiceChain.analyzeVoice(t.mono, t.sr);
    var i = t.vlInfo, tips = [], err = Math.abs(i.chromaticErrCents);
    tips.push('Distanza voce-rumore: ' + Math.round(i.snrDb) + ' dB ' + (i.snrDb >= 30 ? '(ottima).' : i.snrDb >= 20 ? '(buona).' : '(c\'è fruscio: avvicinati al microfono o cambia stanza).'));
    if (i.clippedShare > 0.001) tips.push('La voce satura in alcuni punti: allontana il telefono di una spanna o canta un po\' più piano.');
    else if (i.peakDb < -18) tips.push('Volume basso (picco ' + Math.round(i.peakDb) + ' dB): avvicinati un po\'.');
    if (isFinite(err)) tips.push('Intonazione media: ' + Math.round(err) + ' centesimi dalla nota più vicina ' + (err < 15 ? '(molto intonata).' : err < 30 ? '(buona, l\'autotune leggero basta).' : '(l\'autotune aiuta molto qui).'));
    if (i.sibilanceDb > -12) tips.push('Le "s" sono forti: il de-esser del microfono le ammorbidisce.');
    var m = micSet();
    if (isFinite(err) && err >= 30 && m.mode !== 'autotune') AG.tv.rec = { mode: 'autotune', ids: ['melodico'], label: 'passa a Mic autotune (Melodico)' };
    else if (isFinite(err) && err < 15 && m.mode === 'autotune' && m.ids.indexOf('robotico') < 0) AG.tv.rec = { mode: 'autotune', ids: ['naturale'], label: 'autotune più leggero (Naturale): sei già intonato' };
    else if (i.snrDb < 20) AG.tv.rec = { mode: m.mode, ids: m.ids.slice(), label: 'riapplica il microfono: toglie il fruscio misurato' };
    AG.tv.tips = tips; AG.tv.st = 'pronto';
  }
  async function agentAscoltatore() {
    var pl = learnPlan(); AG.li.prop = null;
    if (!pl) { AG.li.st = 'fermo'; return; }
    AG.li.st = 'al lavoro'; agentsRender(); await wait(30);
    var p = cur().prod, map = songMap(), g = Arranger.STYLES[pl.genre] ? pl.genre : p.genre;
    var bb = Arranger.generate({ sampleRate: 22050, bpm: pl.bpm, tonic: p.tonic, mode: pl.mode, bars: p.bars, genre: g, seed: p.seed + 7, inst: p.inst, plan: map ? map.plan : undefined, groove: pl.groove, tune: pl.tune, sounds: p.sounds === 'sint' ? 'sint' : 'campioni' });
    AG.li.prop = { plan: pl, mix: Backing.mix(bb, p.levels, p.sec), sr: bb.sampleRate, desc: (Arranger.STYLES[g] ? Arranger.STYLES[g].label : g) + ' · ' + pl.bpm + ' BPM · ' + pl.mode + ' · cassa ' + pl.groove.kickPats[0][0].map(function (x) { return x + 1; }).join('-') + ' · da ' + pl.from + ' canzoni' };
    AG.li.st = 'pronto';
  }
  function coachSummary() { var pg = Coach.progress(coachState()), pf = Coach.profile(coachState(), coachName); return 'Livello: ' + pg.livello + ' (' + pg.imparate + '/' + pg.totale + ' abilità).' + (pf.piace.length ? ' Ti piace: ' + pf.piace.slice(0, 3).join(', ') + '.' : ''); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function agentsRun(coachOnly) {
    if (AG.busy) { AG.again = true; return; }
    AG.busy = true;
    try {
      AG.co.st = 'al lavoro'; agentsRender(); await wait(30);
      AG.co.lessons = Coach.lessons(coachMeasure()).lessons; AG.co.st = 'pronto'; agentsRender();
      try { await agentTecnico(); } catch (e) { AG.tv.st = 'errore'; } agentsRender();
      if (coachOnly) return;
      try { await agentAscoltatore(); } catch (e) { AG.li.st = 'errore'; } agentsRender();
      var p = cur().prod, map = songMap(), ctx = coachCtx(), st = coachState();
      // Arrangiatore: 3 varianti calcolate davvero (base completa a 22 kHz)
      AG.arr.st = 'al lavoro'; AG.arr.props = []; agentsRender();
      var seen = {};
      for (var k = 0; k < 3; k++) {
        var res = Coach.suggest(st, coachCands(p.genre), { emotion: ctx.emotion, seed: (st.n + 3) * 97 + k * 31 + p.seed });
        if (k === 2 && !res.explore) { var cands = coachCands(p.genre).melodia.filter(function (c) { return c.prior > 0 && c.id !== res.inst.melodia; }); if (cands.length) { var pick = cands[(st.n + p.seed) % cands.length].id; res.explore = { role: 'melodia', from: res.inst.melodia, to: pick }; res.inst.melodia = pick; } }
        if (k === 1) { var cc = coachCands(p.genre); ['accordi', 'pad'].forEach(function (rl) { var l2 = cc[rl].slice().sort(function (x, y) { return y.prior - x.prior; }).filter(function (c) { return c.id !== res.inst[rl] && c.prior > 0; }); if (l2.length) res.inst[rl] = l2[0].id; }); }
        var arps = Object.keys(Arranger.ARP), ap = arps[(p.seed + k * 2 + st.n) % arps.length];
        res.inst.arpeggio = res.inst.arpeggio || (p.inst || {}).arpeggio || res.inst.accordi;
        var sig = JSON.stringify(res.inst) + ap; if (seen[sig]) { ap = arps[(arps.indexOf(ap) + 3) % arps.length]; } seen[sig] = 1;
        for (var r in res.inst) if (res.inst[r]) await loadInst(res.inst[r]);
        await wait(20);
        var bb = Arranger.generate({ sampleRate: 22050, bpm: p.bpm, tonic: p.tonic, mode: p.mode, bars: p.bars, genre: p.genre, seed: p.seed + k + 1, inst: res.inst, plan: map ? map.plan : undefined, arpPattern: ap, sounds: p.sounds === 'sint' ? 'sint' : 'campioni', tune: p.tune || undefined });
        var mix = Backing.mix(bb, p.levels, p.sec);
        AG.arr.props.push({ inst: res.inst, arpPattern: ap, seed: p.seed + k + 1, explore: !!res.explore, mix: mix, sr: bb.sampleRate, ctx: { genre: p.genre, mode: p.mode, bpm: p.bpm, inst: res.inst, emotion: ctx.emotion },
          desc: ['melodia', 'accordi', 'arpeggio', 'pad'].map(function (r) { return r + ': ' + (res.inst[r] ? instName(res.inst[r]) : 'sintesi'); }).join(' · ') + ' · arpeggio ' + ap });
        agentsRender(); await wait(30);
      }
      AG.arr.st = 'pronto'; agentsRender();
      // Sound designer: inventa 2 strumenti dai tuoi preferiti
      AG.sd.st = 'al lavoro'; agentsRender(); await wait(30);
      var liked = Object.keys(st.prefs).filter(function (k2) { return /^inst\./.test(k2) && st.prefs[k2] > 0.5; }).map(function (k2) { return k2.split(':').slice(1).join(':'); }).filter(function (id) { return Instruments.info(id) && !/^lab:/.test(id); });
      var pool = liked.length >= 2 ? liked.concat(['glass', 'harp', 'synth:sub', 'synth:air']) : null;
      AG.sd.props = [];
      for (var q = 0; q < 2; q++) {
        var rec = SoundLab.invent((st.n + 1) * 13 + q * 7 + p.seed * 3, pool);
        rec.id = 'lab:ag' + q; rec.nome = ['Idea', 'Scoperta'][q] + ' n. ' + ((st.n + 1) * 13 + q * 7 + p.seed * 3);
        var deps = SoundLab.deps(rec), okd = true; for (var d = 0; d < deps.length; d++) if (!(await loadInst(deps[d]))) okd = false;
        if (!okd) continue;
        SoundLab.install(rec); AG.sd.props.push(rec);
      }
      AG.sd.st = 'pronto'; agentsRender();
    } catch (e) { AG.arr.st = AG.arr.st === 'al lavoro' ? 'errore' : AG.arr.st; agentsRender(); }
    finally { AG.busy = false; if (AG.again) { AG.again = false; setTimeout(agentsRun, 400); } }
  }
  $('#dw-agents').addEventListener('click', async function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-lip') && AG.li.prop) { dwStop(); playBuf(AG.li.prop.mix, AG.li.prop.sr); $('#dw-msg').textContent = 'Ascolti la base dai tuoi gusti. Premi Usa se ti piace.'; return; }
    if (b.hasAttribute('data-liu') && AG.li.prop) { stopPlay(); learnUse(AG.li.prop.plan); coachRec('like', coachCtx()); $('#dw-msg').textContent = 'Base dai tuoi gusti applicata: ' + AG.li.prop.desc + '.'; return; }
    if (b.hasAttribute('data-tva') && AG.tv.rec) { var mm = micSet(); mm.mode = AG.tv.rec.mode; mm.ids = AG.tv.rec.ids; mm.macros = {}; persist(); micRender(); $('#dw-msg').textContent = 'Applico il consiglio del Tecnico voce…'; await micApply(false); agentsRun(true); return; }
    var ap = b.getAttribute('data-ap'), au = b.getAttribute('data-au'), an = b.getAttribute('data-an'), sp = b.getAttribute('data-sp2'), su = b.getAttribute('data-su2'), ss = b.getAttribute('data-ss2'), cf = b.getAttribute('data-cf');
    if (ap != null) { var pr = AG.arr.props[+ap]; dwStop(); playBuf(pr.mix, pr.sr); $('#dw-msg').textContent = 'Ascolti la variante ' + (+ap + 1) + '. Premi Usa se ti piace.'; }
    if (au != null) { var pu = AG.arr.props[+au], p = cur().prod; stopPlay(); p.inst = Object.assign({}, pu.inst); p.arpPattern = pu.arpPattern; p.seed = pu.seed; coachRec('like', pu.ctx); fillInst(); $('#dw-msg').textContent = 'Variante applicata: ' + pu.desc; dwChanged(true); }
    if (an != null) { coachRec('dislike', AG.arr.props[+an].ctx); AG.arr.props.splice(+an, 1); agentsRender(); $('#dw-msg').textContent = 'Segnato: l\'Arrangiatore la eviterà.'; }
    if (sp != null) previewInst(AG.sd.props[+sp].id, $('#dw-msg'));
    if (su != null) { var r = AG.sd.props[+su], p2 = cur().prod; r = Object.assign({}, r, { id: 'lab:mio' + Date.now().toString(36) }); LIB.settings.lab = (LIB.settings.lab || []).concat([r]); SoundLab.install(r); p2.inst = Object.assign({}, p2.inst || {}); p2.inst.melodia = r.id; coachRec('change', coachCtx(), { role: 'melodia', from: null, to: r.id }); refreshInstSelects(); $('#dw-msg').textContent = '"' + r.nome + '" ora suona la melodia (salvato tra i tuoi strumenti).'; dwChanged(false); }
    if (ss != null) { var r2 = Object.assign({}, AG.sd.props[+ss], { id: 'lab:mio' + Date.now().toString(36) }); LIB.settings.lab = (LIB.settings.lab || []).concat([r2]); SoundLab.install(r2); persist(); refreshInstSelects(); $('#dw-msg').textContent = '"' + r2.nome + '" salvato: lo trovi nel Laboratorio e nei menu degli strumenti.'; }
    if (cf != null) { $('#dw-msg').textContent = coachFix(AG.co.lessons[+cf]); dwChanged(false); agentsRun(true); }
  });

  // ---------- comandi ----------
  $('#dw-play').addEventListener('click', function () { if (DW.playing) { dwStop(true); } else dwPlay(DW.from || 0); });
  $('#dw-stop').addEventListener('click', function () { dwStop(); stopPlay(); DW.from = 0; dwPos(0); });
  $('#dw-rec').addEventListener('click', dwRecord);
  $('#dw-new').addEventListener('click', function () { var p = cur().prod; if (SESSION.lastPlay && performance.now() - SESSION.lastPlay.t < 10000) coachRec('skip', SESSION.lastPlay.ctx); p.seed++; dwStop(); dwChanged(true); setTimeout(function () { dwPlay(0); }, 300); });
  $('#dw-name').addEventListener('input', function () { cur().title = this.value.trim() || 'Senza titolo'; $('#top-song').textContent = cur().title; persist(); });
  $('#dw-genre').addEventListener('change', function () { var p = cur().prod; p.genre = this.value; p.bpm = Arranger.STYLES[this.value].bpm; p.tune = null; p.groove = null; p.prog = null; p.mix = null; p.atmNome = null; applyRecipe(this.value); mixRender(); $('#dw-bpm').value = p.bpm; dwStop(); fillBase(); dwChanged(true); });
  $('#dw-bpm').addEventListener('change', function () { cur().prod.bpm = Math.max(60, Math.min(180, +this.value || 100)); this.value = cur().prod.bpm; dwStop(); fillBase(); dwChanged(true); dwLyInfo(); });
  $('#dw-key').addEventListener('change', function () { var v = this.value.split(':'), p = cur().prod; p.tonic = +v[0]; p.mode = v[1]; dwStop(); fillBase(); dwChanged(true); });
  $('#dw-master').addEventListener('change', function () { cur().prod.master = this.value; persist(); fillBase(); });
  $('#dw-off').addEventListener('input', function () { $('#dw-offv').textContent = this.value; var o = $('#v-off'); if (o) o.value = this.value; var t = voiceTake(); if (t) { DW.bufKey = ''; } });
  $('#dw-lyrics').addEventListener('input', function () { var s = cur(); s.lyrics = this.value; var st = $('#st-lyrics'); if (st) st.value = this.value; persist(); dwLyInfo(); dwSteps(); clearTimeout(DW.lt); DW.lt = setTimeout(function () { dwStop(); dwChanged(true); }, 900); });
  $('#dw-fromtext').addEventListener('click', function () { var s = cur(), a = analysisOf(s); if (!a) { $('#dw-tmsg').textContent = 'Scrivi prima il testo.'; return; } $('#st-suggest').click(); $('#dw-tmsg').textContent = $('#st-msg').textContent; dwFill(); dwStop(); dwChanged(true); });
  $('#dw-scroll').addEventListener('click', function (e) {
    var b = SESSION.base; if (!b || e.target.closest('button')) return;
    var r = $('#dw-canvas').getBoundingClientRect(), x = e.clientX - r.left, t = x / DW.px * 240 / b.bpm;
    DW.from = Math.max(0, t); if (DW.playing) dwPlay(DW.from); else dwPos(DW.from);
  });
  $('#dw-heads').addEventListener('click', function (e) {
    var lh = e.target.closest('.dw-lh'), b = e.target.closest('button');
    if (lh && !b && !e.target.closest('input')) { var idx = Array.prototype.indexOf.call($$('#dw-heads .dw-lh'), lh); if (LANES[idx]) inspOpen(LANES[idx].id, 'suono'); return; }
    if (!b) return;
    var m = b.getAttribute('data-m'), so = b.getAttribute('data-s'), ins = b.getAttribute('data-inst');
    if (m) { DW.mute[m] = !DW.mute[m]; b.classList.toggle('on', DW.mute[m]); dwGains(); }
    if (so) { DW.solo[so] = !DW.solo[so]; b.classList.toggle('on', DW.solo[so]); dwGains(); }
    if (ins === 'sfx' || ins === 'vox') { pfGo(); return; }
    if (ins) { inspOpen(ins, 'suono'); return; }
    if (false) {
      var L = LANES.filter(function (x) { return x.id === ins; })[0], p = cur().prod;
      if (L.role) sheetOpen(L.role);
      else if (L.id === 'drums') { p.sounds = p.sounds === 'sint' ? 'campioni' : 'sint'; fillBase(); dwStop(); dwChanged(true); }
      else if (L.id === 'bass') { p.bassStyle = p.bassStyle === '808' ? null : '808'; dwStop(); dwChanged(true); }
      else if (L.voice) { location.hash = '#voce'; }
    }
  });
  $('#dw-heads').addEventListener('input', function (e) {
    var id = e.target.getAttribute('data-lv'); if (!id) return;
    var L = LANES.filter(function (x) { return x.id === id; })[0]; cur().prod.levels[L.level] = +e.target.value / 100; persist(); dwGains();
  });
  // ---------- Parla con lo Studio: frasi → modifiche vere, con Accetta / Annulla ----------
  var TALK = [];
  function talkRender() {
    $('#dw-talk-log').innerHTML = TALK.slice(-6).map(function (h, i, a) {
      var last = i === a.length - 1 && h.state === 'attesa';
      return '<div class="dw-prop"><div><b>Tu: ' + esc(h.text) + '</b><small>' + esc(h.reply) + (h.state === 'annullato' ? ' (annullato)' : (h.state === 'accettato' ? ' ✓' : '')) + '</small>' + (h.lyrics && h.lyrics.length ? '<small class="dw-lyrsug">' + h.lyrics.map(esc).join('<br>') + '</small><button class="btn sm" data-tkl="' + (TALK.length - a.length + i) + '">Aggiungi al testo</button>' : '') + '</div>' +
        (last ? '<button class="btn sm pri" data-tk="ok">Accetta</button><button class="btn sm" data-tk="undo">Annulla</button>' : '') + '</div>';
    }).join('') || '<p class="small muted">Esempi: ' + StudioAgent.EXAMPLES.map(esc).join(' · ') + '</p>';
  }
  function aiSet() { var a = LIB.settings.ai; if (!a || typeof a !== 'object') a = LIB.settings.ai = { engine: 'regole', model: '', url: 'http://localhost:11434' }; return a; }
  function aiRender() {
    var a = aiSet(), eng = a.engine;
    $('#dw-ai-engine').value = eng;
    var models = StudioAI.MODELS[eng] || {};
    $('#dw-ai-model').hidden = eng === 'regole'; $('#dw-ai-test').hidden = eng !== 'ollama';
    $('#dw-ai-model').innerHTML = Object.keys(models).map(function (k) { return '<option value="' + k + '"' + (k === a.model ? ' selected' : '') + '>' + esc(models[k].nome) + '</option>'; }).join('');
    if (eng !== 'regole' && !models[a.model]) { a.model = Object.keys(models)[0]; $('#dw-ai-model').value = a.model; }
    $('#dw-ai-info').innerHTML = eng === 'regole' ? 'Capisce le frasi dell\'elenco, subito e senza scaricare niente.' : eng === 'significato' ? 'Capisce frasi libere in italiano e le collega ai comandi dello Studio. Scarica 118 MB la prima volta; va anche su iPhone.' : (eng === 'browser' ? 'Il modello gira dentro la pagina: la prima volta scarica ' + (StudioAI.MODELS.browser[a.model] || {}).mb + ' MB. Consigliato sul computer.' :
      'Sul Mac: installa Ollama (ollama.com), poi nel Terminale: <span class="mono">ollama pull ' + esc(a.model || 'qwen2.5:7b') + '</span> e avvia con <span class="mono">OLLAMA_ORIGINS="' + esc(location.origin) + '" ollama serve</span>.');
  }
  $('#dw-ai-engine').addEventListener('change', function () { aiSet().engine = this.value; aiSet().model = ''; persist(); aiRender(); });
  $('#dw-ai-model').addEventListener('change', function () { aiSet().model = this.value; persist(); aiRender(); });
  $('#dw-ai-test').addEventListener('click', async function () { var m = await StudioAI.pingOllama(aiSet().url); $('#dw-ai-info').textContent = m ? 'Ollama collegato. Modelli presenti: ' + (m.join(', ') || 'nessuno (scaricane uno)') + '.' : 'Ollama non risponde: è acceso sul Mac con OLLAMA_ORIGINS impostato? (Dall\'iPhone non si raggiunge il Mac.)'; });
  // esegue comandi dello Studio (frasi) su una copia dello stato; ritorna cosa è cambiato
  function runCommands(list, st) {
    var said = [], extra = { variant: false, fromText: false };
    list.forEach(function (cmd) {
      if (/nuova variante/i.test(cmd)) { st.prod.seed = (st.prod.seed || 1) + 1; said.push('nuova variante'); extra.variant = true; return; }
      if (/crea la base dal testo|base dal testo/i.test(cmd)) { extra.fromText = true; said.push('base dal testo'); return; }
      var r = StudioAgent.interpret(cmd, st), pa = ProducerActions.interpret(cmd, st.prod);
      if (pa.understood) { ['bpm', 'mode', 'bassStyle', 'reverb', 'levels', 'sec', 'tonic', 'genre', 'tune'].forEach(function (k) { if (pa.state[k] !== undefined) st.prod[k] = pa.state[k]; }); said = said.concat(pa.notes); }
      said = said.concat(r.changes);
    });
    var seen = {}; said = said.map(function (x) { return String(x).replace(/\.+$/, ''); }).filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; });
    return { said: said, extra: extra };
  }
  function talkState() {
    var s = cur(), b = SESSION.base;
    return { prod: JSON.parse(JSON.stringify(s.prod)), mic: JSON.parse(JSON.stringify(micSet())), ctx: { sections: b && b.sections ? b.sections.map(function (x) { return { name: x.name, startBar: x.startBar }; }) : [], leadNotes: b && b.events ? b.events.lead.filter(function (n) { return n.bar != null; }).map(function (n) { return { bar: n.bar, step: n.step, len: Math.max(1, Math.round(n.len || 2)), midi: Math.round(n.midi) }; }) : [] } };
  }
  async function talkGo(text) {
    text = (text || '').trim(); if (!text) return;
    var s = cur(), a = aiSet(), before = { prod: JSON.parse(JSON.stringify(s.prod)), mic: JSON.parse(JSON.stringify(micSet())) }, st = talkState(), reply = '', lyr = [];
    var cmds = [text];
    if (a.engine !== 'regole') {
      TALK.push({ text: text, reply: 'Ci penso…', state: 'pensa' }); talkRender();
      try {
        var p = cur().prod, lk = learnList().filter(function (r) { return r.vote > 0; }).map(function (r) { return (r.artist || '') + ' ' + r.prof.bpm + ' BPM'; }).slice(0, 4).join(', ');
        var res = await StudioAI.think(text, { summary: (Arranger.STYLES[p.genre] ? Arranger.STYLES[p.genre].label : p.genre) + ' · ' + p.bpm + ' BPM · ' + NOTES[p.tonic] + ' ' + p.mode, lyrics: s.lyrics || '', taste: lk },
          { engine: a.engine, model: a.model, url: a.url, wasmPaths: new URL('tf/', location.href).href, onProgress: function (x, y) { TALK[TALK.length - 1].reply = 'Scarico il modello: ' + Math.round(x / 1048576) + ' di ' + Math.round(y / 1048576) + ' MB (solo la prima volta)…'; talkRender(); } });
        TALK.pop(); reply = res.reply; cmds = res.commands; lyr = res.lyrics;
      } catch (e) { TALK.pop(); TALK.push({ text: text, reply: 'L\'IA locale non ha risposto (' + (e && e.message || 'errore') + '). Uso le regole.', state: 'nulla' }); talkRender(); cmds = [text]; }
    }
    var run = runCommands(cmds, st);
    if (a.engine !== 'regole' && !run.said.length) { st = talkState(); run = runCommands([text], st); if (run.said.length) reply = (reply ? reply + ' ' : '') + '(Ho usato le regole sulla tua frase.)'; }
    if (!run.said.length && !lyr.length) { TALK.push({ text: text, reply: (reply ? reply + ' ' : '') + (a.engine === 'regole' ? 'Non l\'ho capito, quindi non ho cambiato niente. Prova: ' + StudioAgent.EXAMPLES.slice(0, 4).join(' · ') : 'Nessuna modifica alla base.'), state: 'nulla' }); talkRender(); return; }
    s.prod = st.prod; LIB.settings.mic = st.mic; if (before.prod.genre !== s.prod.genre && Arranger.STYLES[s.prod.genre]) { s.prod.mix = null; applyRecipe(s.prod.genre); } persist();
    TALK.push({ text: text, reply: (reply ? reply + ' ' : '') + (run.said.length ? 'Fatto: ' + run.said.join('; ') + '. Se non ti piace, Annulla.' : ''), lyrics: lyr, state: run.said.length ? 'attesa' : 'nulla', before: before, mic: !!st.micChanged }); talkRender();
    coachRec('change', coachCtx(), { role: 'chat', from: null, to: text.slice(0, 40) });
    if (run.extra.fromText && (s.lyrics || '').trim()) $('#dw-fromtext').click();
    if (run.said.length) await talkApply(!!st.micChanged);
  }
  async function talkApply(micToo) {
    dwFill(); fillBase(); mixRender(); micRender(); dsRender(); mpRender(); projLine(); SESSION.baseKey = ''; DW.bufKey = '';
    dwStop(true); await dwRefresh(); if (micToo && voiceTake()) await micApply(true); prDraw();
  }
  $('#dw-talk-go').addEventListener('click', function () { var t = $('#dw-talk-in'); talkGo(t.value); t.value = ''; });
  $('#dw-talk-in').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('#dw-talk-go').click(); } });
  $('#dw-talk-log').addEventListener('click', async function (e) {
    var lb = e.target.closest('[data-tkl]'); if (lb) { var hh = TALK[+lb.getAttribute('data-tkl')], s1 = cur(); s1.lyrics = (s1.lyrics ? s1.lyrics.replace(/\s+$/, '') + '\n' : '') + hh.lyrics.join('\n'); persist(); dwFill(); dwChanged(true); lb.textContent = 'Aggiunte ✓'; lb.disabled = true; return; }
    var b = e.target.closest('[data-tk]'); if (!b) return; var h = TALK[TALK.length - 1]; if (!h || h.state !== 'attesa') return;
    if (b.getAttribute('data-tk') === 'ok') { h.state = 'accettato'; coachRec('like', coachCtx()); talkRender(); return; }
    cur().prod = h.before.prod; LIB.settings.mic = h.before.mic; persist(); h.state = 'annullato'; coachRec('dislike', coachCtx()); talkRender(); await talkApply(h.mic);
  });
  // ---------- Mastering professionale, riferimento A/B, tracce separate ----------
  var MP = { ref: null, out: null };
  function mpSet() { var p = cur().prod; if (!p.mpro) p.mpro = { target: 'forte', width: 1.1, sat: 0.25, comp: 0.35, match: false }; return p.mpro; }
  function mpRender() {
    var m = mpSet();
    $('#dw-mp-target').innerHTML = Object.keys(MasterPro.TARGETS).map(function (k) { var t = MasterPro.TARGETS[k]; return '<option value="' + k + '"' + (k === m.target ? ' selected' : '') + '>' + t.nome + ' (' + t.lufs + ' LUFS)</option>'; }).join('');
    $('#dw-mp-knobs').innerHTML = [['comp', 'Compressione multibanda', 0, 1, 0.01], ['width', 'Larghezza stereo', 0, 2, 0.01], ['sat', 'Saturazione analogica', 0, 1, 0.01]].map(function (d) { return '<label class="f"><span>' + d[1] + ' <b>' + Math.round(m[d[0]] * 100) + '%</b></span><input type="range" min="' + d[2] + '" max="' + d[3] + '" step="' + d[4] + '" value="' + m[d[0]] + '" data-mpk="' + d[0] + '"></label>'; }).join('');
    $('#dw-mp-match').checked = !!m.match; $('#dw-mp-match').disabled = !MP.ref;
    $('#dw-mp-refinfo').textContent = MP.ref ? 'Riferimento: ' + MP.ref.name + ' · ' + MP.ref.lufs.toFixed(1) + ' LUFS' : 'Nessun riferimento caricato.';
  }
  $('#dw-mp-knobs').addEventListener('input', function (e) { var k = e.target.getAttribute('data-mpk'); if (!k) return; mpSet()[k] = +e.target.value; e.target.previousElementSibling.querySelector('b').textContent = Math.round(+e.target.value * 100) + '%'; persist(); });
  $('#dw-mp-target').addEventListener('change', function () { mpSet().target = this.value; persist(); });
  $('#dw-mp-match').addEventListener('change', function () { mpSet().match = this.checked; persist(); });
  $('#dw-mp-ref').addEventListener('change', async function () {
    var f = this.files && this.files[0], el = $('#dw-mp-msg'); this.value = ''; if (!f) return; el.textContent = 'Leggo il riferimento…';
    try { var d = await decodeStereo(f, 32000), R = d.R || d.L, n = Math.min(d.L.length, 32000 * 90), L = d.L.subarray(0, n); R = R.subarray(0, n);
      MP.ref = { name: f.name.replace(/\.[^.]+$/, '').slice(0, 40), L: L, R: R, sr: d.sr, lufs: BeatMix.loudness([L, R], d.sr).lufs, spec: MasterPro.spectrum(MasterPro.mono(L, R), d.sr) };
      mpRender(); el.textContent = 'Riferimento pronto: serve solo per confrontare (non finisce nel tuo brano).'; } catch (e) { el.textContent = 'Non riesco a leggere questo file.'; }
  });
  async function mpMake(withVoice) {
    var m = mpSet(), el = $('#dw-mp-msg'); el.textContent = 'Preparo il mix…'; await tick();
    var raw = await dwRender(withVoice, true); el.textContent = 'Mastering: multibanda, stereo, saturazione, volume e limitatore…'; await tick();
    var c = m.comp, band = function (thr) { return { thr: thr + 8 - 16 * c, ratio: 1 + 3 * c, gain: 0 }; };
    var mine = MasterPro.spectrum(MasterPro.mono(raw.L, raw.R), raw.sr);
    var r = MasterPro.process(raw.L, raw.R, raw.sr, { target: m.target, low: band(-18), mid: band(-20), high: band(-22), width: m.width, sat: m.sat, matchRef: m.match && MP.ref ? MP.ref.spec : null, mySpec: mine }, BeatMix.loudness);
    MP.out = { L: r.L, R: r.R, sr: raw.sr, rep: r.report, spec: MasterPro.spectrum(MasterPro.mono(r.L, r.R), raw.sr) };
    var rp = r.report, h = '<div class="dw-agent"><header><span class="dw-dot ok"></span><b>Master pronto</b><span class="st">' + esc(rp.target) + '</span></header><ul class="clean small">' +
      '<li>Volume: <b>' + rp.lufs + ' LUFS</b> · picco reale ' + rp.truePeakDb + ' dBTP · limitatore ' + rp.limiterDb + ' dB</li>' +
      '<li>Compressione: bassi ' + rp.grLow + ' dB · medi ' + rp.grMid + ' dB · alti ' + rp.grHigh + ' dB</li>' +
      '<li>Fase (correlazione L/R): ' + rp.corr + (rp.corr < 0.2 ? ' — attenzione: in mono si perde qualcosa, riduci la larghezza.' : ' — ok anche in mono.') + '</li></ul>';
    if (MP.ref) h += '<p class="small"><b>Confronto col riferimento:</b></p><ul class="clean small">' + MasterPro.compare(MP.out.spec, MP.ref.spec).tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    $('#dw-mp-report').innerHTML = h + '</div>'; el.textContent = 'Ascolta e confronta, poi salva.'; coachRec('save', coachCtx());
  }
  $('#dw-p-mix').addEventListener('click', async function (e) {
    var b = e.target.closest('button'); if (!b) return; var el = $('#dw-mp-msg');
    try {
      if (b.id === 'dw-mp-make') await mpMake(true);
      if (b.id === 'dw-mp-play') { if (!MP.out) { el.textContent = 'Prima premi "Crea il master".'; return; } dwStop(true); playBuf(MasterPro.mono(MP.out.L, MP.out.R), MP.out.sr); el.textContent = 'Ascolti il TUO master.'; }
      if (b.id === 'dw-mp-ab') { if (!MP.ref) { el.textContent = 'Carica prima un brano di riferimento.'; return; } var g = MP.out ? Math.pow(10, (MP.out.rep.lufs - MP.ref.lufs) / 20) : 1, mo = MasterPro.mono(MP.ref.L, MP.ref.R); for (var i = 0; i < mo.length; i++) mo[i] *= g; dwStop(true); playBuf(mo, MP.ref.sr); el.textContent = 'Ascolti il RIFERIMENTO allo stesso volume del tuo master (confronto onesto).'; }
      if (b.id === 'dw-mp-save') { if (!MP.out) { el.textContent = 'Prima premi "Crea il master".'; return; } await saveFile((cur().title || 'canzone').replace(/\W+/g, '-') + '-master.wav', wavStereo(MP.out.L, MP.out.R, MP.out.sr), el, 'Master WAV stereo salvato.'); }
      if (b.id === 'dw-mp-stems') {
        var names = { drums: 'batteria', bass: 'basso', chords: 'accordi', arp: 'arpeggio', lead: 'melodia', pad: 'atmosfera', voice: 'voce' }, saved = 0, solo0 = DW.solo, mute0 = DW.mute;
        for (var k in names) { if (k === 'voice' && !voiceTake()) continue; DW.solo = {}; DW.solo[k] = true; DW.mute = {}; el.textContent = 'Salvo la traccia ' + names[k] + '…'; var r = await dwRender(k === 'voice', true); var e2 = 0; for (var j = 0; j < r.L.length; j += 64) e2 += Math.abs(r.L[j]); if (e2 < 1e-3) continue; await saveFile((cur().title || 'canzone').replace(/\W+/g, '-') + '-' + names[k] + '.wav', wavStereo(r.L, r.R, r.sr), el, ''); saved++; }
        DW.solo = solo0; DW.mute = mute0; el.textContent = saved + ' tracce separate salvate (WAV stereo, con il mixer, senza master).';
      }
    } catch (err) { el.textContent = 'Non riuscito: ' + (err && err.message || 'errore'); }
  });
  // ---------- Designer suoni: synth, 808, effetti di transizione ----------
  function synthRegister(r) {
    Instruments.registerCustom(r.id, { id: r.id, nome: r.nome, fam: 'synth', fonte: 'Creato da te', tipo: 'sostenuto', range: [24, 100], ruoli: ['melodia', 'accordi', 'pad', 'arpeggio'], come: 'Synth wavetable creato nel Designer.', combina: '', perche: '', stili: [] },
      function (midi, dur, sr) { return SynthDesign.synth(r.params, midi, dur, sr); });
  }
  var DS = { tab: 'synth', syn: SynthDesign.synthParams(SynthDesign.SYNTH_PRESETS['Pluck lucido']), fxType: 'riser' };
  var DS_SYN = [['pos', 'Forma d\'onda', 0, 1, 0.01], ['lfo', 'Movimento', 0, 1, 0.01], ['lfoHz', 'Velocità movimento (Hz)', 0.05, 8, 0.05], ['voices', 'Voci (unisono)', 1, 7, 1], ['detune', 'Larghezza (cent)', 0, 40, 1], ['cutoff', 'Filtro (luminosità)', 0.05, 1, 0.01], ['res', 'Risonanza', 0, 0.9, 0.01], ['envAmt', 'Apertura del filtro sul colpo', 0, 1, 0.01], ['attack', 'Attacco (s)', 0.001, 2, 0.001], ['decay', 'Decadimento (s)', 0.02, 2, 0.01], ['sustain', 'Tenuta', 0, 1, 0.01], ['release', 'Rilascio (s)', 0.02, 3, 0.01]];
  var DS_808 = [['decay', 'Durata', 0.1, 4, 0.05], ['punch', 'Colpo (caduta di nota)', 0, 1, 0.01], ['drive', 'Distorsione', 0, 1, 0.01], ['tone', 'Tono (scuro → brillante)', 0, 1, 0.01], ['click', 'Click d\'attacco', 0, 1, 0.01]];
  function dsSliders(defs, obj, attr) { return defs.map(function (d) { return '<label class="f"><span>' + d[1] + ' <b>' + (+obj[d[0]]).toFixed(d[4] >= 1 ? 0 : 2) + '</b></span><input type="range" min="' + d[2] + '" max="' + d[3] + '" step="' + d[4] + '" value="' + obj[d[0]] + '" ' + attr + '="' + d[0] + '"></label>'; }).join(''); }
  function dsRender() {
    var p = cur().prod, h = '';
    $$('#dw-ds-tabs .chip').forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-dst') === DS.tab); });
    if (DS.tab === 'synth') {
      var mine = LIB.settings.synths || [];
      h = '<div class="chips">' + Object.keys(SynthDesign.SYNTH_PRESETS).map(function (k) { return '<button class="chip" data-dsp="' + esc(k) + '">' + esc(k) + '</button>'; }).join('') + '</div>' +
        '<div class="dw-knobs">' + dsSliders(DS_SYN, DS.syn, 'data-dss') + '</div>' +
        '<div class="row"><button class="btn sm" id="dw-ds-play">▶ Ascolta</button><button class="btn sm pri" id="dw-ds-save">Salva come strumento</button></div>' +
        (mine.length ? '<p class="small muted" style="margin:8px 0 4px">I tuoi synth (usali dal nome dello strumento sulla traccia):</p><div class="chips">' + mine.map(function (r, i) { return '<button class="chip" data-dsu="' + i + '">' + esc(r.nome) + ' → melodia</button>'; }).join('') + '</div>' : '');
    } else if (DS.tab === '808') {
      var b = SynthDesign.b808Params(p.b808 || DS.b8 || {}); DS.b8 = b;
      h = '<div class="chips">' + Object.keys(SynthDesign.B808_PRESETS).map(function (k) { return '<button class="chip" data-ds8p="' + esc(k) + '">' + esc(k) + '</button>'; }).join('') + '</div><div class="dw-knobs">' + dsSliders(DS_808, b, 'data-ds8') + '</div><div class="row"><button class="btn sm" id="dw-ds-8play">▶ Ascolta (con glide)</button><button class="btn sm pri" id="dw-ds-8use">Usa nella base</button><button class="btn sm" id="dw-ds-8off">Torna all\'808 dello stile</button></div>' +
        '<p class="small muted">' + (p.b808 ? 'La base usa il TUO 808.' : 'La base usa l\'808 dello stile.') + '</p>';
    } else if (DS.tab === 'perc') {
      var pc = p.perc || {}, secs = ['intro', 'strofa', 'pre', 'ritornello', 'bridge', 'outro'], on = pc.on || ['strofa', 'ritornello'];
      h = '<div class="chips">' + Object.keys(SynthDesign.PERC).map(function (k) { return '<button class="chip' + (k === (DS.perc || pc.type) ? ' on' : '') + '" data-dspc="' + k + '">' + SynthDesign.PERC[k].nome + '</button>'; }).join('') + '</div>' +
        '<div class="chips">' + secs.map(function (x) { return '<label class="chip"><input type="checkbox" data-dspo="' + x + '"' + (on.indexOf(x) >= 0 ? ' checked' : '') + '> ' + x + '</label>'; }).join('') + '</div>' +
        '<div class="row"><button class="btn sm" id="dw-ds-pplay">▶ Ascolta 1 battuta</button><button class="btn sm pri" id="dw-ds-padd">Metti nella base</button><button class="btn sm" id="dw-ds-poff">Togli le percussioni</button></div><p class="small muted">' + (pc.type ? 'Nella base: ' + SynthDesign.PERC[pc.type].nome + ' in ' + on.join(', ') + '.' : 'Nessuna percussione aggiunta.') + '</p>';
    } else if (DS.tab === 'vox') {
      var vx = LIB.settings.voxInst || [];
      h = '<p class="small muted">Un pezzo di voce intonata diventa uno strumento che suona ogni nota (vocal chop). Dall\'ultima prova registrata, oppure dalla voce separata in "Impara da una base".</p><div class="row"><button class="btn sm pri" id="dw-ds-vtake">Strumento dall\'ultima prova</button><button class="btn sm" id="dw-ds-vlearn">Dalla voce separata</button></div>' +
        (vx.length ? '<div class="chips">' + vx.map(function (r, i) { return '<button class="chip" data-dsvp="' + i + '">▶ ' + esc(r.nome) + '</button><button class="chip" data-dsvu="' + i + '">usa su arpeggio</button>'; }).join('') + '</div>' : '');
    } else {
      var bars = SESSION.base ? SESSION.base.bars : 16, list = p.fxList || [];
      h = '<div class="chips">' + Object.keys(SynthDesign.FX).map(function (k) { return '<button class="chip' + (k === DS.fxType ? ' on' : '') + '" data-dsf="' + k + '">' + SynthDesign.FX[k].nome + '</button>'; }).join('') + '</div>' +
        '<label class="f"><span>Battuta</span><select id="dw-ds-bar">' + Array.from({ length: bars }, function (_, i) { return '<option value="' + i + '">' + (i + 1) + '</option>'; }).join('') + '</select></label>' +
        '<div class="row"><button class="btn sm" id="dw-ds-fplay">▶ Ascolta</button><button class="btn sm pri" id="dw-ds-fadd">Metti nella base</button></div>' +
        (list.length ? list.map(function (f, i) { return '<div class="dw-prop"><div><b>' + SynthDesign.FX[f.type].nome + '</b><small>' + (SynthDesign.FX[f.type].end ? 'finisce alla' : 'alla') + ' battuta ' + (f.bar + 1) + '</small></div><button class="btn sm" data-dsx="' + i + '">Togli</button></div>'; }).join('') : '<p class="small muted">Riser e reverse finiscono sulla battuta scelta (preparano l\'entrata); impact e downlifter partono dalla battuta.</p>');
    }
    $('#dw-ds-body').innerHTML = h;
  }
  $('#dw-p-design').addEventListener('click', async function (e) {
    var b = e.target.closest('button'); if (!b) return; var p = cur().prod, el = $('#dw-ds-msg');
    if (b.getAttribute('data-dst')) { DS.tab = b.getAttribute('data-dst'); dsRender(); return; }
    if (b.getAttribute('data-ds8p')) { DS.b8 = SynthDesign.b808Params(SynthDesign.B808_PRESETS[b.getAttribute('data-ds8p')]); if (p.b808) p.b808 = Object.assign({}, DS.b8); else p.b808 = null; if (!p.b808) delete p.b808; dsRender(); el.textContent = '808 "' + b.getAttribute('data-ds8p') + '": premi Ascolta, poi Usa nella base.'; return; }
    if (b.getAttribute('data-dspc')) { DS.perc = b.getAttribute('data-dspc'); dsRender(); return; }
    if (b.id === 'dw-ds-pplay') { var P = SynthDesign.PERC[DS.perc || 'conga'], srp = 32000, st = 240 / p.bpm / 16, o2 = new Float32Array(Math.round(srp * st * 16 * 2)); for (var rep2 = 0; rep2 < 2; rep2++) P.steps.forEach(function (x) { var hb = P.hit(srp, P.acc.indexOf(x) >= 0), at = Math.round((rep2 * 16 + x) * st * srp); for (var k = 0; k < hb.length && at + k < o2.length; k++) o2[at + k] += hb[k]; }); dwStop(true); playBuf(o2, srp); return; }
    if (b.id === 'dw-ds-padd') { var on2 = $$('[data-dspo]').filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute('data-dspo'); }); p.perc = { type: DS.perc || 'conga', on: on2.length ? on2 : ['strofa', 'ritornello'] }; dwChanged(false); dsRender(); el.textContent = SynthDesign.PERC[p.perc.type].nome + ' nella base. Premi Play.'; return; }
    if (b.id === 'dw-ds-poff') { delete p.perc; dwChanged(false); dsRender(); el.textContent = 'Percussioni tolte.'; return; }
    if (b.id === 'dw-ds-vtake') { var tk = voiceTake(); if (!tk) { el.textContent = 'Registra prima una prova con ●.'; return; } el.textContent = voxMake((!DW.raw && tk.final) || tk.mono, tk.sr, 'Voce ' + tk.name) || ''; dsRender(); return; }
    if (b.id === 'dw-ds-vlearn') { if (!LEARN.cur || !LEARN.cur.voice) { el.textContent = 'Carica prima una canzone in "Impara da una base".'; return; } el.textContent = voxMake(LEARN.cur.voice, LEARN.cur.sr, 'Chop ' + LEARN.cur.name) || ''; dsRender(); return; }
    if (b.getAttribute('data-dsvp') != null) { var r3 = LIB.settings.voxInst[+b.getAttribute('data-dsvp')]; await loadInst(r3.id); previewInst(r3.id, el); return; }
    if (b.getAttribute('data-dsvu') != null) { var r4 = LIB.settings.voxInst[+b.getAttribute('data-dsvu')]; p.inst = Object.assign({}, p.inst || {}); p.inst.arpeggio = r4.id; fillInst(); dwChanged(false); el.textContent = '"' + r4.nome + '" suona l\'arpeggio. Premi Play.'; return; }
    if (b.getAttribute('data-dsp')) { DS.syn = SynthDesign.synthParams(SynthDesign.SYNTH_PRESETS[b.getAttribute('data-dsp')]); dsRender(); el.textContent = 'Preset "' + b.getAttribute('data-dsp') + '": premi Ascolta.'; return; }
    if (b.id === 'dw-ds-play') { var sr = 32000, seq = [60, 63, 67, 72], out = new Float32Array(Math.round(sr * 2.6)); seq.forEach(function (m, i) { var y = SynthDesign.synth(DS.syn, m + (cur().prod.tonic || 0), 0.35, sr); for (var k = 0; k < y.length && i * 0.4 * sr + k < out.length; k++) out[Math.round(i * 0.4 * sr) + k] += y[k]; }); var ch = SynthDesign.synth(DS.syn, 48 + (p.tonic || 0), 0.6, sr); for (var k2 = 0; k2 < ch.length && 1.7 * sr + k2 < out.length; k2++) out[Math.round(1.7 * sr) + k2] += ch[k2]; dwStop(true); playBuf(out, sr); return; }
    if (b.id === 'dw-ds-save') { var nm = (prompt('Nome del tuo synth') || '').trim().slice(0, 30); if (!nm) return; var r = { id: 'syn:' + uid(), nome: nm, params: Object.assign({}, DS.syn) }; LIB.settings.synths = (LIB.settings.synths || []).concat([r]); synthRegister(r); persist(); refreshInstSelects(); dsRender(); el.textContent = '"' + nm + '" salvato: ora è uno strumento (lo trovi tra "I tuoi").'; return; }
    if (b.getAttribute('data-dsu') != null) { var r2 = (LIB.settings.synths || [])[+b.getAttribute('data-dsu')]; p.inst = Object.assign({}, p.inst || {}); p.inst.melodia = r2.id; coachRec('change', coachCtx(), { role: 'melodia', from: null, to: r2.id }); fillInst(); dwChanged(false); el.textContent = '"' + r2.nome + '" suona la melodia. Premi Play.'; return; }
    if (b.id === 'dw-ds-8play') { var s8 = 32000, a = SynthDesign.b808(DS.b8, 36 + (p.tonic || 0) % 12, 0.7, s8), c = SynthDesign.b808(DS.b8, 43 + (p.tonic || 0) % 12, 1.2, s8, 36 + (p.tonic || 0) % 12, 0.1), o = new Float32Array(a.length + c.length); o.set(a); o.set(c, a.length); dwStop(true); playBuf(o, s8); return; }
    if (b.id === 'dw-ds-8use') { p.b808 = Object.assign({}, DS.b8); p.bassStyle = '808'; dwChanged(false); dsRender(); el.textContent = 'Il tuo 808 è nella base. Premi Play.'; coachRec('change', coachCtx(), { role: '808', from: null, to: 'designer' }); return; }
    if (b.id === 'dw-ds-8off') { delete p.b808; dwChanged(false); dsRender(); el.textContent = 'Torna l\'808 dello stile.'; return; }
    if (b.getAttribute('data-dsf')) { DS.fxType = b.getAttribute('data-dsf'); dsRender(); return; }
    if (b.id === 'dw-ds-fplay') { var bs = 240 / p.bpm; dwStop(true); playBuf(SynthDesign.FX[DS.fxType].make(32000, 1, bs), 32000); return; }
    if (b.id === 'dw-ds-fadd') { p.fxList = (p.fxList || []).concat([{ type: DS.fxType, bar: +$('#dw-ds-bar').value }]); dwChanged(false); dsRender(); el.textContent = SynthDesign.FX[DS.fxType].nome + ' messo nella base. Premi Play.'; return; }
    if (b.getAttribute('data-dsx') != null) { p.fxList.splice(+b.getAttribute('data-dsx'), 1); dwChanged(false); dsRender(); el.textContent = 'Effetto tolto.'; return; }
  });
  $('#dw-ds-body').addEventListener('input', function (e) {
    var k = e.target.getAttribute('data-dss'), k8 = e.target.getAttribute('data-ds8'), v = +e.target.value;
    if (k) DS.syn[k] = v; else if (k8) { DS.b8[k8] = v; } else return;
    e.target.previousElementSibling.querySelector('b').textContent = v.toFixed(+e.target.step >= 1 ? 0 : 2);
  });
  // strumento dalla voce: trova il pezzo più intonato e stabile (0,5 s), lo salva (22 kHz, 16 bit) e lo registra
  function voxRegister(r) {
    var bin = atob(r.pcm), n = bin.length >> 1, seg = new Float32Array(n);
    for (var i = 0; i < n; i++) { var v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v > 32767) v -= 65536; seg[i] = v / 32768; }
    Instruments.registerCustom(r.id, { id: r.id, nome: r.nome, fam: 'voce', fonte: 'La tua voce', tipo: 'sostenuto', range: [36, 96], ruoli: ['melodia', 'accordi', 'pad', 'arpeggio'], come: 'Strumento fatto da un pezzo di voce.', combina: '', perche: '', stili: [] }, SynthDesign.voiceInstrument(seg, 22050, r.root));
  }
  function voxMake(x, sr, name) {
    var trk = Autotune.track(x, sr, { maxSeconds: 120 }), fr = trk.frames, hop = trk.hopSeconds, need = Math.ceil(0.3 / hop), best = null;
    for (var i = 0; i + need < fr.length; i += 2) { var ok = true, ms = []; for (var k = i; k < i + need; k++) { if (!fr[k].voiced || !(fr[k].f0 > 0)) { ok = false; break; } ms.push(69 + 12 * Math.log2(fr[k].f0 / 440)); } if (!ok) continue; var mean = ms.reduce(function (a, c) { return a + c; }, 0) / ms.length, v = ms.reduce(function (a, c) { return a + (c - mean) * (c - mean); }, 0) / ms.length; if (!best || v < best.v) best = { i: i, v: v, m: mean }; }
    if (!best || best.v > 0.8) return 'Non trovo un pezzo di nota tenuta e intonata: canta una vocale lunga ("aaa") e riprova.';
    var t0 = fr[best.i].t, a0 = Math.round(t0 * sr), n = Math.round(0.3 * sr), ratio = sr / 22050, m = Math.round(0.3 * 22050), seg = new Float32Array(m), pk = 0;
    for (i = 0; i < m; i++) { var pos = a0 + i * ratio, k2 = Math.floor(pos), f = pos - k2; seg[i] = (x[k2] || 0) * (1 - f) + (x[k2 + 1] || 0) * f; if (Math.abs(seg[i]) > pk) pk = Math.abs(seg[i]); }
    var s16 = ''; for (i = 0; i < m; i++) { var q = Math.round(Math.max(-1, Math.min(1, seg[i] / (pk || 1) * 0.9)) * 32767); if (q < 0) q += 65536; s16 += String.fromCharCode(q & 255, q >> 8); }
    var r = { id: 'vox:' + uid(), nome: name.slice(0, 30), root: Math.round(best.m * 10) / 10, pcm: btoa(s16) };
    LIB.settings.voxInst = (LIB.settings.voxInst || []).concat([r]).slice(-12); voxRegister(r); persist(); refreshInstSelects();
    return 'Strumento "' + r.nome + '" creato (nota di partenza misurata: ' + NOTES[Math.round(best.m) % 12] + '). Lo trovi tra "I tuoi".';
  }
  function extraFxBufs(p) { var bs = 240 / p.bpm; return (p.fxList || []).filter(function (f) { return SynthDesign.FX[f.type]; }).map(function (f) { return { bar: f.bar, end: !!SynthDesign.FX[f.type].end, buf: SynthDesign.FX[f.type].make(32000, 1, bs) }; }); }
  // ---------- Piano roll nello Studio (melodia e basso 808) ----------
  var PR = { tr: 'lead', sel: -1, cw: 14, rh: 12 };
  var PR_RANGE = { lead: [55, 86], bass: [24, 50] };
  var SCALE_ST = { maggiore: [0, 2, 4, 5, 7, 9, 11], minore: [0, 2, 3, 5, 7, 8, 10] };
  function prNotes() { var p = cur().prod; return p.notes && Array.isArray(p.notes[PR.tr]) ? p.notes[PR.tr] : null; }
  function prGenerated() { var b = SESSION.base; if (!b || !b.events) return []; return (b.events[PR.tr] || []).filter(function (n) { return n.bar != null; }).map(function (n) { return { bar: n.bar, step: n.step, len: Math.max(1, Math.round(n.len || 2)), midi: Math.round(n.midi), slide: !!n.slide }; }); }
  function inScale(m) { var p = cur().prod; return (SCALE_ST[p.mode] || SCALE_ST.minore).indexOf(((m - p.tonic) % 12 + 12) % 12) >= 0; }
  var DEG_NAMES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  function chordsDraw() {
    var b = SESSION.base, p = cur().prod; if (!b || !b.events) return;
    var steps = p.mode === 'maggiore' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10], qual = p.mode === 'maggiore' ? ['', 'm', 'm', '', '', 'm', '°'] : ['m', '°', '', 'm', 'm', '', ''];
    var opts = DEG_NAMES.map(function (d, i) { return '<option value="' + i + '">' + NOTES[(p.tonic + steps[i]) % 12] + qual[i] + ' (' + d + ')</option>'; }).join('');
    var bySec = {}; (b.sections || []).forEach(function (s) { for (var k = 0; k < s.bars; k++) bySec[s.startBar + k] = s.name; });
    var cur0 = {}; b.events.chords.forEach(function (c) { cur0[c.bar] = steps.indexOf(((c.midis[0] - p.tonic) % 12 + 12) % 12); });
    var arps = Object.keys(Arranger.ARP);
    $('#dw-pr-chords').innerHTML = '<p class="small muted" style="margin:0 0 6px">Accordo di ogni battuta: basso, accordi, arpeggio e atmosfera lo seguono.</p><div class="dw-chgrid">' + Array.from({ length: b.bars }, function (_, bar) {
      var v = p.chordBars && p.chordBars[bar] != null ? p.chordBars[bar] : cur0[bar];
      return '<label class="dw-chcell' + (p.chordBars && p.chordBars[bar] != null ? ' own' : '') + '"><small>' + (bar + 1) + ' · ' + esc(bySec[bar] || '') + '</small><select data-chb="' + bar + '">' + opts.replace('value="' + v + '"', 'value="' + v + '" selected') + '</select></label>';
    }).join('') + '</div><div class="row"><button class="btn sm" id="dw-ch-reset">Torna agli accordi dello stile</button></div>' +
      '<p class="small muted" style="margin:10px 0 4px">Arpeggio:</p><div class="chips">' + ['spento'].concat(arps).map(function (k) { var on = k === 'spento' ? p.arp === false : (p.arp !== false && p.arpPattern === k); return '<button class="chip' + (on ? ' on' : '') + '" data-arpk="' + k + '">' + k + '</button>'; }).join('') + '</div>';
  }
  $('#dw-pr-chords').addEventListener('change', function (e) { var bar = e.target.getAttribute('data-chb'); if (bar == null) return; var p = cur().prod; p.chordBars = Object.assign({}, p.chordBars || {}); p.chordBars[bar] = +e.target.value; prSave('Accordo della battuta ' + (+bar + 1) + ' cambiato.'); });
  $('#dw-pr-chords').addEventListener('click', function (e) {
    e.stopPropagation(); var b = e.target.closest('button'); if (!b) return; var p = cur().prod;
    if (b.id === 'dw-ch-reset') { delete p.chordBars; prSave('Accordi dello stile.'); return; }
    var k = b.getAttribute('data-arpk'); if (k) { if (k === 'spento') p.arp = false; else { delete p.arp; p.arpPattern = k; } prSave(k === 'spento' ? 'Arpeggio spento.' : 'Arpeggio: ' + k + '.'); }
  });
  function drumDefault() {
    var b = SESSION.base, ev = b && b.events, st = b && (b.sections || []).filter(function (x) { return x.name === 'strofa' || x.name === 'ritornello'; })[0], bar = st ? st.startBar : 0;
    var kick = ev ? ev.kick.filter(function (e) { return e.bar === bar; }).map(function (e) { return e.step; }) : [0, 10];
    var hat = ev ? ev.hat.filter(function (e) { return e.bar === bar && !e.roll && e.step % 1 === 0; }).map(function (e) { return e.step; }) : [0, 2, 4, 6, 8, 10, 12, 14];
    var sty = Arranger.STYLES[cur().prod.genre] || {}; return { kick: kick.length ? kick : [0], snare: (sty.snare || [8]).slice(), hat: hat, rolls: true };
  }
  function drumDraw() {
    var p = cur().prod, dp = p.drumPat || drumDefault(), own = !!p.drumPat;
    $('#dw-pr-drum').innerHTML = [['kick', 'Cassa'], ['snare', 'Rullante'], ['hat', 'Hi-hat']].map(function (r) {
      return '<div class="dw-drow"><b>' + r[1] + '</b>' + Array.from({ length: 16 }, function (_, i) { return '<button class="dw-step' + (dp[r[0]].indexOf(i) >= 0 ? ' on' : '') + (i % 4 === 0 ? ' beat' : '') + '" data-ds="' + r[0] + ':' + i + '"></button>'; }).join('') + '</div>';
    }).join('') + '<div class="row"><label class="sw small"><input type="checkbox" id="dw-pr-rolls"' + (dp.rolls !== false ? ' checked' : '') + '> Rullate di hi-hat automatiche</label><button class="btn sm" id="dw-pr-dreset">Torna alla batteria dello stile</button></div><p class="small muted">' + (own ? 'Batteria TUA: vale in ogni battuta dove suona la batteria.' : 'Questa è la batteria dello stile: tocca un passo per renderla tua.') + '</p>';
  }
  function prDraw() {
    var isCh = PR.tr === 'chords'; $('#dw-pr-chords').hidden = !isCh; if (isCh) { $('#dw-pr-drum').hidden = true; $('.dw-pr-wrap').hidden = true; $('#dw-pr-edit').hidden = true; $('#dw-pr-reset').hidden = true; $('#dw-pr-snap').parentElement.hidden = true; $('#dw-pr-tools').hidden = true; $('#dw-pr-info').textContent = ''; $$('#dw-pr-tr .chip').forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-prt') === PR.tr); }); chordsDraw(); return; }
    var isDrum = PR.tr === 'drums'; $('#dw-pr-drum').hidden = !isDrum; $('#dw-pr-chords').hidden = true; $('#dw-pr-snap').parentElement.hidden = isDrum; $('.dw-pr-wrap').hidden = isDrum; $('#dw-pr-edit').hidden = isDrum; $('#dw-pr-reset').hidden = isDrum;
    if (isDrum) { $$('#dw-pr-tr .chip').forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-prt') === PR.tr); }); $('#dw-pr-tools').hidden = true; $('#dw-pr-info').textContent = ''; drumDraw(); return; }
    var b = SESSION.base, cv = $('#dw-pr-cv'); if (!b || !cv) return;
    var own = prNotes(), notes = own || prGenerated(), r = PR_RANGE[PR.tr], rows = r[1] - r[0] + 1, W = b.bars * 16 * PR.cw, H = rows * PR.rh, dpr = window.devicePixelRatio || 1;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    for (var m = r[0]; m <= r[1]; m++) { var y = (r[1] - m) * PR.rh; g.fillStyle = inScale(m) ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.25)'; g.fillRect(0, y, W, PR.rh - 1); if (m % 12 === cur().prod.tonic) { g.fillStyle = 'rgba(227,196,143,.16)'; g.fillRect(0, y, W, PR.rh - 1); } }
    for (var s = 0; s <= b.bars * 16; s++) { g.fillStyle = s % 16 === 0 ? 'rgba(255,255,255,.35)' : (s % 4 === 0 ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.04)'); g.fillRect(s * PR.cw, 0, 1, H); }
    notes.forEach(function (n, i) {
      var x = (n.bar * 16 + n.step) * PR.cw, y = (r[1] - n.midi) * PR.rh;
      g.fillStyle = !own ? 'rgba(156,134,255,.45)' : (i === PR.sel ? '#ffe2a8' : (PR.tr === 'bass' ? '#ff8f6b' : '#e6a1c4'));
      g.fillRect(x + 1, y + 1, n.len * PR.cw - 2, PR.rh - 2);
      if (n.slide) { g.fillStyle = '#fff'; g.fillText('↗', x + 2, y + PR.rh - 2); }
    });
    var NN = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'], sn = own && own[PR.sel];
    $('#dw-pr-info').textContent = own ? (sn ? 'Nota scelta: ' + NN[sn.midi % 12] + (Math.floor(sn.midi / 12) - 1) + ', battuta ' + (sn.bar + 1) + ', passo ' + (sn.step + 1) + ', lunga ' + sn.len + '/16' + (sn.slide ? ', con glide' : '') : 'Tocca una casella vuota per aggiungere una nota, tocca una nota per sceglierla.') : 'Queste sono le note generate (viola). Premi "Modifica le note" per cambiarle.';
    $('#dw-pr-tools').hidden = !own; $('#dw-pr-glide').hidden = PR.tr !== 'bass';
    $$('#dw-pr-tr .chip').forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-prt') === PR.tr); });
  }
  function prSave(msg) { var p = cur().prod; persist(); SESSION.baseKey = ''; DW.bufKey = ''; prDraw(); if (msg) $('#dw-pr-msg').textContent = msg; clearTimeout(PR.t); PR.t = setTimeout(function () { var was = DW.playing, at = was ? getCtx().currentTime - DW.t0 + DW.from : DW.from; dwStop(true); dwRefresh().then(function () { prDraw(); if (was) dwPlay(at); }); }, 350); }
  function prStepMidi(m, d) { var x = m + d, guard = 0; if ($('#dw-pr-snap').checked) while (!inScale(x) && guard++ < 3) x += d; return x; }
  $('#dw-p-roll').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.closest('#dw-pr-drum')) return;
    var p = cur().prod, own = prNotes(), n = own && own[PR.sel];
    if (b.getAttribute('data-prt')) { PR.tr = b.getAttribute('data-prt'); PR.sel = -1; prDraw(); return; }
    if (b.id === 'dw-pr-edit') { p.notes = Object.assign({}, p.notes || {}); p.notes[PR.tr] = prGenerated(); PR.sel = -1; prSave('Ora le note sono tue: modificale.'); coachRec('change', coachCtx(), { role: 'pianoroll', from: null, to: PR.tr }); return; }
    if (b.id === 'dw-pr-reset') { if (p.notes) { delete p.notes[PR.tr]; } PR.sel = -1; prSave('Tornato alle note generate.'); return; }
    if (!n) { $('#dw-pr-msg').textContent = 'Scegli prima una nota.'; return; }
    var a = b.getAttribute('data-pra');
    if (a === 'up') n.midi = prStepMidi(n.midi, 1); else if (a === 'down') n.midi = prStepMidi(n.midi, -1);
    else if (a === 'left') { var t = n.bar * 16 + n.step - 1; if (t >= 0) { n.bar = Math.floor(t / 16); n.step = t % 16; } }
    else if (a === 'right') { var t2 = n.bar * 16 + n.step + 1; n.bar = Math.floor(t2 / 16); n.step = t2 % 16; }
    else if (a === 'long') n.len = Math.min(32, n.len + 1); else if (a === 'short') n.len = Math.max(1, n.len - 1);
    else if (a === 'oct') n.midi += n.midi + 12 <= PR_RANGE[PR.tr][1] ? 12 : -12;
    else if (a === 'glide') n.slide = !n.slide;
    else if (a === 'del') { own.splice(PR.sel, 1); PR.sel = -1; }
    n.midi = Math.max(PR_RANGE[PR.tr][0], Math.min(PR_RANGE[PR.tr][1], n.midi));
    prSave('');
  });
  $('#dw-pr-drum').addEventListener('click', function (e) {
    e.stopPropagation(); var t = e.target.closest('[data-ds]'), p = cur().prod;
    if (t) { var k = t.getAttribute('data-ds').split(':'), i = +k[1]; p.drumPat = p.drumPat || drumDefault(); var arr = p.drumPat[k[0]], at = arr.indexOf(i); if (at >= 0) arr.splice(at, 1); else { arr.push(i); arr.sort(function (a, c) { return a - c; }); } prSave(''); return; }
    if (e.target.id === 'dw-pr-dreset') { delete p.drumPat; prSave('Torna la batteria dello stile.'); }
  });
  $('#dw-pr-drum').addEventListener('change', function (e) { if (e.target.id !== 'dw-pr-rolls') return; var p = cur().prod; p.drumPat = p.drumPat || drumDefault(); p.drumPat.rolls = e.target.checked; prSave(e.target.checked ? 'Rullate accese.' : 'Rullate spente.'); });
  $('#dw-pr-cv').addEventListener('click', function (e) {
    var own = prNotes(); if (!own) { $('#dw-pr-msg').textContent = 'Premi prima "Modifica le note".'; return; }
    var rc = this.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top, r = PR_RANGE[PR.tr];
    var st = Math.floor(x / PR.cw), midi = r[1] - Math.floor(y / PR.rh), bar = Math.floor(st / 16), step = st % 16;
    var hit = -1; own.forEach(function (n, i) { var s0 = n.bar * 16 + n.step; if (n.midi === midi && st >= s0 && st < s0 + n.len) hit = i; });
    if (hit >= 0) { PR.sel = hit; prDraw(); return; }
    if (bar >= (SESSION.base ? SESSION.base.bars : 0)) return;
    own.push({ bar: bar, step: step, len: PR.tr === 'bass' ? 4 : 2, midi: midi, slide: false }); PR.sel = own.length - 1;
    prSave('Nota aggiunta.');
  });
  window.__prReady = true;
  // ---------- Voce: prove e montaggio (clip) ----------
  function realTakes() { return SESSION.takes.filter(function (t) { return !t.example; }); }
  function takeById(id) { return SESSION.takes.filter(function (t) { return t.id === id; })[0] || null; }
  function vclips() {
    var s = cur();
    if (Array.isArray(s.vclips)) { s.vclips = s.vclips.filter(function (c) { return takeById(c.take); }); if (s.vclips.length) return s.vclips; }
    var t = voiceTake(); return t ? [Clips.whole(t, t.lat || 0)] : [];
  }
  function vclipKey() { return JSON.stringify(vclips().map(function (c) { var t = takeById(c.take); return [c.take, c.start, c.offset, c.len, c.gain, c.fadeIn, c.fadeOut, t && t.final && !DW.raw ? (t.finalV || 1) : 0]; })); }
  function vclipBuffer(dur) {
    var cl = vclips(); if (!cl.length) return null;
    var map = {}; cl.forEach(function (c) { var t = takeById(c.take); if (t) map[c.take] = { x: (!DW.raw && t.final) || t.mono, sr: t.sr }; });
    var sr = 44100; return { x: Clips.render(cl, map, sr, Math.max(dur, Clips.end(cl)) + 0.5), sr: sr, start: 0 };
  }
  function setClips(cl, msg) { cur().vclips = cl.map(Clips.clip); DW.bufKey = ''; persist(); clipsRender(); if (msg) $('#dw-cl-msg').textContent = msg; var was = DW.playing, at = was ? (getCtx().currentTime - DW.t0 + DW.from) : DW.from; dwStop(true); dwRefresh().then(function () { if (was) dwPlay(at); }); }
  function fmtS(s) { return Math.floor(s / 60) + ':' + (s % 60).toFixed(1).padStart(4, '0'); }
  var CLUI = { sel: 0 };
  function clipsRender() {
    var tk = realTakes(), cl = vclips(), map = songMap(), lines = map ? map.lines : [];
    $('#dw-cl-takes').innerHTML = tk.length ? tk.map(function (t, i) { return '<div class="dw-prop"><div><b>Prova ' + (i + 1) + ' · ' + esc(t.name) + '</b><small>' + fmtS(t.mono.length / t.sr) + (t.final ? ' · regolata col microfono' : '') + '</small></div><button class="btn sm" data-ctp="' + t.id + '">▶</button><button class="btn sm pri" data-ctu="' + t.id + '">Usa tutta</button><button class="btn sm" data-ctx="' + t.id + '">Elimina</button></div>'; }).join('') : '<p class="small muted">Nessuna prova: registra con ● in alto. Ogni registrazione diventa una prova, nessuna si perde.</p>';
    var comp = '';
    if (lines.length && tk.length >= 2) {
      var ch = cur().vcomp || {};
      comp = '<p class="small muted" style="margin:10px 0 4px">Componi la voce: per ogni riga scegli la prova migliore.</p>' + lines.map(function (ln, i) {
        return '<label class="f dw-compl"><span>' + esc(ln.text.slice(0, 48)) + '</span><select data-cpl="' + i + '"><option value="">— niente —</option>' + tk.map(function (t, k) { return '<option value="' + t.id + '"' + ((ch[i] || tk[tk.length - 1].id) === t.id ? ' selected' : '') + '>Prova ' + (k + 1) + '</option>'; }).join('') + '</select></label>';
      }).join('') + '<div class="row"><button class="btn sm pri" id="dw-cl-comp">Monta la voce dalle righe scelte</button></div>';
    } else if (tk.length >= 2) comp = '<p class="small muted">Scrivi il testo per montare la voce riga per riga.</p>';
    $('#dw-cl-comp-box').innerHTML = comp;
    CLUI.sel = Math.min(CLUI.sel, Math.max(0, cl.length - 1));
    $('#dw-cl-list').innerHTML = cl.length ? cl.map(function (c, i) {
      var t = takeById(c.take), k = realTakes().indexOf(t) + 1;
      return '<button class="chip' + (i === CLUI.sel ? ' on' : '') + '" data-cls="' + i + '">Clip ' + (i + 1) + ' · prova ' + k + ' · ' + fmtS(c.start) + '–' + fmtS(c.start + c.len) + '</button>';
    }).join('') : '';
    var c = cl[CLUI.sel];
    $('#dw-cl-edit').innerHTML = c ? [
      ['start', 'Posizione nella canzone', 0, Math.max(30, Clips.end(cl) + 10), 0.01, fmtS(c.start)],
      ['gain', 'Volume della clip', 0, 2, 0.01, (20 * Math.log10(Math.max(1e-4, c.gain))).toFixed(1) + ' dB'],
      ['fadeIn', 'Entrata sfumata', 0, 2, 0.01, c.fadeIn.toFixed(2) + ' s'],
      ['fadeOut', 'Uscita sfumata', 0, 2, 0.01, c.fadeOut.toFixed(2) + ' s']
    ].map(function (r) { return '<label class="f"><span>' + r[1] + ' <b>' + r[5] + '</b></span><input type="range" min="' + r[2] + '" max="' + r[3] + '" step="' + r[4] + '" value="' + c[r[0]] + '" data-cle="' + r[0] + '"></label>'; }).join('') +
      '<div class="row"><button class="btn sm" data-clm="-0.05">◀ 50 ms</button><button class="btn sm" data-clm="0.05">50 ms ▶</button><button class="btn sm pri" id="dw-cl-split">Taglia al cursore</button><button class="btn sm" id="dw-cl-del">Togli la clip</button></div>' : '';
  }
  $('#dw-p-clips').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var cl = vclips().map(function (x) { return Object.assign({}, x); }), el = $('#dw-cl-msg');
    if (b.getAttribute('data-ctp')) { var t = takeById(b.getAttribute('data-ctp')); dwStop(true); playBuf((!DW.raw && t.final) || t.mono, t.sr); return; }
    if (b.getAttribute('data-ctu')) { var t2 = takeById(b.getAttribute('data-ctu')); SESSION.takeId = t2.id; CLUI.sel = 0; setClips([Clips.whole(t2, t2.lat || 0)], 'Ora la voce è tutta la ' + esc(t2.name) + '.'); return; }
    if (b.getAttribute('data-ctx')) { var id = b.getAttribute('data-ctx'); SESSION.takes = SESSION.takes.filter(function (x) { return x.id !== id; }); dbTake('del', id); if (SESSION.takeId === id) SESSION.takeId = realTakes().length ? realTakes()[realTakes().length - 1].id : null; setClips(vclips().filter(function (x) { return x.take !== id; }), 'Prova eliminata.'); return; }
    if (b.getAttribute('data-cls') != null) { CLUI.sel = +b.getAttribute('data-cls'); clipsRender(); return; }
    if (b.id === 'dw-cl-comp') {
      var map = songMap(), ch = {}; $$('#dw-cl-comp-box select').forEach(function (s) { ch[+s.getAttribute('data-cpl')] = s.value; }); cur().vcomp = ch;
      var lat = {}; realTakes().forEach(function (x) { lat[x.id] = x.lat || 0; });
      var res = Clips.compByLines(map.lines, map.lines.map(function (_, i) { return ch[i]; }), realTakes(), lat);
      CLUI.sel = 0; setClips(res, 'Voce montata: ' + res.length + ' clip, una per riga, con dissolvenze. Premi Play.'); coachRec('change', coachCtx(), { role: 'comp', from: null, to: res.length }); return;
    }
    var c = cl[CLUI.sel]; if (!c) return;
    if (b.getAttribute('data-clm')) { c.start = Math.max(0, c.start + +b.getAttribute('data-clm')); setClips(cl, 'Clip spostata di ' + Math.round(+b.getAttribute('data-clm') * 1000) + ' ms.'); return; }
    if (b.id === 'dw-cl-split') { var at = DW.playing ? (getCtx().currentTime - DW.t0 + DW.from) : (DW.from || 0), parts = Clips.split(c, at); if (!parts) { el.textContent = 'Metti il cursore dentro la clip (tocca la timeline) e riprova.'; return; } cl.splice(CLUI.sel, 1, parts[0], parts[1]); setClips(cl, 'Clip tagliata a ' + fmtS(at) + '.'); return; }
    if (b.id === 'dw-cl-del') { cl.splice(CLUI.sel, 1); CLUI.sel = 0; setClips(cl, 'Clip tolta (la prova resta salvata).'); return; }
  });
  $('#dw-cl-edit').addEventListener('change', function (e) {
    var k = e.target.getAttribute('data-cle'); if (!k) return;
    var cl = vclips().map(function (x) { return Object.assign({}, x); }); cl[CLUI.sel][k] = +e.target.value; setClips(cl, '');
  });
  // ---------- Mixer a canali (stessa catena per ascolto e file salvato) ----------
  var MIX_LANES = ['drums', 'bass', 'chords', 'arp', 'lead', 'pad', 'sfx', 'voice', 'vox'];
  function mixSet() {
    var p = cur().prod;
    if (!p.mix || typeof p.mix !== 'object' || p.mixV !== 2) { p.mix = Mixer.preset(p.genre, MIX_LANES); p.mixV = 2; } // v2: mix pulito (tagli dei bassi, meno distorsione)
    MIX_LANES.forEach(function (id) { p.mix[id] = Mixer.channel(p.mix[id]); });
    return p.mix;
  }
  // collega le sorgenti delle tracce al mixer; usata da Play e dal salvataggio
  function dwGraph(ctx, dest, bufs, b, from, t0, gains) {
    var au = cur().prod.auto || {}, autoPts = {}; MIX_LANES.forEach(function (id) { var q = Mixer.autoPoints(au[id], b.sections || []); if (q) autoPts[id] = q; });
    var mx = Mixer.build(ctx, dest, { auto: autoPts, lanes: MIX_LANES, settings: mixSet(), bpm: b.bpm, kick: b.tracks && b.tracks.kick ? { x: b.tracks.kick, sr: b.sampleRate } : null, t0: t0, from: from });
    var srcs = [];
    LANES.forEach(function (L) {
      var B = bufs[L.id]; if (!B) return;
      var src = ctx.createBufferSource(); src.buffer = makeBuffer(ctx, B.x, B.sr);
      var g = ctx.createGain(); g.gain.value = gainFor(L); src.connect(g); g.connect(mx.input(L.id)); if (gains) gains[L.id] = g;
      var st = B.start - from;
      if (st >= 0) src.start(t0 + st); else if (-st < B.x.length / B.sr) src.start(t0, -st); else return;
      src._lane = L.id; srcs.push(src);
    });
    return { mixer: mx, srcs: srcs };
  }
  var MIXUI = { lane: 'voice' };
  function mixRender() {
    var m = mixSet(), id = MIXUI.lane, c = m[id];
    $('#dw-mx-lanes').innerHTML = LANES.map(function (L) { return '<button class="chip' + (L.id === id ? ' on' : '') + '" data-mxl="' + L.id + '" style="border-color:' + L.c + '">' + esc(L.nome) + '</button>'; }).join('');
    var keys = ['hp', 'low', 'mid', 'midHz', 'high', 'comp', 'sat', 'pan', 'rev', 'dly'].concat(id === 'drums' || id === 'voice' ? [] : ['duck']);
    $('#dw-mx-knobs').innerHTML = keys.map(function (k) {
      var L = Mixer.LIMITS[k], lab = Mixer.LABELS[k], v = c[k], step = k === 'midHz' || k === 'hp' ? 5 : (L[1] - L[0] > 3 ? 0.5 : 0.01);
      return '<label class="f"><span>' + esc(lab[0]) + ' <b>' + mixFmt(k, v) + '</b></span><input type="range" min="' + L[0] + '" max="' + L[1] + '" step="' + step + '" value="' + v + '" data-mxk="' + k + '"><small class="muted">' + esc(lab[2]) + '</small></label>';
    }).join('');
    autoRender();
  }
  function mixFmt(k, v) { var u = Mixer.LABELS[k][1]; if (u === '%') return Math.round(v * 100) + '%'; if (k === 'pan') return v === 0 ? 'centro' : (v < 0 ? 'sin ' : 'des ') + Math.round(Math.abs(v) * 100); return (k === 'midHz' || k === 'hp' ? Math.round(v) : (v > 0 ? '+' : '') + (+v).toFixed(1)) + ' ' + u; }
  $('#dw-p-mixer').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.getAttribute('data-mxl')) { MIXUI.lane = b.getAttribute('data-mxl'); mixRender(); }
    if (b.id === 'dw-mx-preset') { var p = cur().prod; p.mix = Mixer.preset(p.genre, MIX_LANES); persist(); mixRender(); if (DW.mixer) MIX_LANES.forEach(function (id) { for (var k in p.mix[id]) DW.mixer.set(id, k, p.mix[id][k]); }); $('#dw-mx-msg').textContent = 'Mix di partenza per ' + (Arranger.STYLES[p.genre] ? Arranger.STYLES[p.genre].label : p.genre) + ' applicato a tutte le tracce.'; }
    if (b.id === 'dw-mx-flat') { var m = mixSet(); m[MIXUI.lane] = Mixer.channel({}); persist(); mixRender(); if (DW.mixer) for (var k2 in m[MIXUI.lane]) DW.mixer.set(MIXUI.lane, k2, m[MIXUI.lane][k2]); $('#dw-mx-msg').textContent = 'Canale azzerato: senti la traccia senza effetti.'; }
  });
  $('#dw-mx-knobs').addEventListener('input', function (e) {
    var k = e.target.getAttribute('data-mxk'); if (!k) return;
    var m = mixSet(), v = +e.target.value; m[MIXUI.lane][k] = Mixer.channel(Object.assign({}, m[MIXUI.lane], { [k]: v }))[k];
    e.target.previousElementSibling.querySelector('b').textContent = mixFmt(k, m[MIXUI.lane][k]);
    if (DW.mixer) DW.mixer.set(MIXUI.lane, k, m[MIXUI.lane][k]);
    clearTimeout(MIXUI.t); MIXUI.t = setTimeout(persist, 400);
  });
  // automazione per sezione: volume e filtro della traccia scelta cambiano tra strofa, ritornello…
  function autoRender() {
    var b = SESSION.base, id = MIXUI.lane, names = [], au = (cur().prod.auto || {})[id] || {};
    (b && b.sections || []).forEach(function (x) { if (names.indexOf(x.name) < 0) names.push(x.name); });
    $('#dw-mx-auto').innerHTML = names.length ? '<p class="small muted" style="margin:10px 0 4px"><b>Automazione</b> di questa traccia per parte della canzone (cambia da sola mentre suona):</p>' + names.map(function (n) {
      var a = au[n] || {}, vol = Math.round((a.vol == null ? 1 : a.vol) * 100), cut = Math.round((a.cut == null ? 1 : a.cut) * 100);
      return '<div class="dw-autor"><b>' + esc(n) + '</b><label>Volume <i>' + vol + '%</i><input type="range" min="0" max="150" value="' + vol + '" data-aus="' + n + '" data-auk="vol"></label><label>Filtro <i>' + (cut >= 100 ? 'aperto' : cut + '%') + '</i><input type="range" min="0" max="100" value="' + cut + '" data-aus="' + n + '" data-auk="cut"></label></div>';
    }).join('') : '';
  }
  $('#dw-mx-auto').addEventListener('change', function (e) {
    var n = e.target.getAttribute('data-aus'), k = e.target.getAttribute('data-auk'); if (!n) return;
    var p = cur().prod; p.auto = p.auto || {}; p.auto[MIXUI.lane] = p.auto[MIXUI.lane] || {}; p.auto[MIXUI.lane][n] = p.auto[MIXUI.lane][n] || {};
    p.auto[MIXUI.lane][n][k] = +e.target.value / 100; persist(); autoRender();
    $('#dw-mx-msg').textContent = 'Automazione salvata: ' + n + ' → ' + (k === 'vol' ? 'volume ' : 'filtro ') + e.target.value + '%. La senti da Play (anche nel file salvato).';
    if (DW.playing) { var at = getCtx().currentTime - DW.t0 + DW.from; dwPlay(at); }
  });
  // versioni del progetto: istantanee da riaprire
  function verRender() {
    var v = cur().versions || [];
    $('#dw-ver-list').innerHTML = v.length ? v.map(function (x, i) { return '<div class="dw-prop"><div><b>' + esc(x.name) + '</b><small>' + new Date(x.at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' · ' + esc(x.prod.genre) + ' ' + x.prod.bpm + ' BPM</small></div><button class="btn sm pri" data-vo="' + i + '">Apri</button><button class="btn sm" data-vx="' + i + '">Elimina</button></div>'; }).join('') : '<p class="small muted">Nessuna versione salvata.</p>';
  }
  $('#dw-p-mix').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; var s0 = cur(), el = $('#dw-ver-msg');
    if (b.id === 'dw-ver-save') { var nm = ($('#dw-ver-name').value || '').trim().slice(0, 40) || ('Versione ' + ((s0.versions || []).length + 1)); s0.versions = (s0.versions || []).concat([{ name: nm, at: Date.now(), lyrics: s0.lyrics, prod: JSON.parse(JSON.stringify(s0.prod)), vclips: s0.vclips ? JSON.parse(JSON.stringify(s0.vclips)) : null }]).slice(-20); $('#dw-ver-name').value = ''; persist(); verRender(); el.textContent = '"' + nm + '" salvata.'; }
    if (b.getAttribute('data-vo') != null) { var v = s0.versions[+b.getAttribute('data-vo')]; s0.versions.push({ name: 'Prima di aprire "' + v.name + '"', at: Date.now(), lyrics: s0.lyrics, prod: JSON.parse(JSON.stringify(s0.prod)), vclips: s0.vclips ? JSON.parse(JSON.stringify(s0.vclips)) : null }); s0.lyrics = v.lyrics; s0.prod = JSON.parse(JSON.stringify(v.prod)); s0.vclips = v.vclips ? JSON.parse(JSON.stringify(v.vclips)) : null; persist(); dwStop(); dwFill(); fillBase(); mixRender(); mpRender(); dsRender(); clipsRender(); verRender(); dwChanged(true); el.textContent = 'Aperta "' + v.name + '" (la situazione di prima è salvata come versione).'; }
    if (b.getAttribute('data-vx') != null) { s0.versions.splice(+b.getAttribute('data-vx'), 1); persist(); verRender(); }
  });
  // salvataggio in stereo con la stessa catena del mixer (OfflineAudioContext)
  async function dwRender(withVoice, raw) {
    var b = await dwBase(), bufs = dwBuffers(b), sr = b.sampleRate, t = withVoice ? voiceTake() : null;
    var len = Math.ceil((b.duration + 2.5) * sr), oc = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, len, sr);
    var use = {}; for (var k in bufs) if (k !== 'voice' || t) use[k] = bufs[k];
    var wasRec = DW.recording; DW.recording = false; dwGraph(oc, oc.destination, use, b, 0, 0, null); DW.recording = wasRec;
    var out = await oc.startRendering(), L = out.getChannelData(0), R = out.getChannelData(1), mp = cur().prod.master || 'standard';
    if (!raw && mp !== 'off' && Master.PRESETS[mp]) { L = Master.process(L, sr, mp).samples; R = Master.process(R, sr, mp).samples; }
    return { L: L, R: R, sr: sr };
  }
  function wavStereo(L, R, sr) {
    var n = L.length, b = new ArrayBuffer(44 + n * 4), v = new DataView(b), o = 44, i;
    function s(off, t) { for (var k = 0; k < t.length; k++) v.setUint8(off + k, t.charCodeAt(k)); }
    s(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); s(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, n * 4, true);
    for (i = 0; i < n; i++, o += 4) { var a = Math.max(-1, Math.min(1, L[i])), c = Math.max(-1, Math.min(1, R[i])); v.setInt16(o, a < 0 ? a * 32768 : a * 32767, true); v.setInt16(o + 2, c < 0 ? c * 32768 : c * 32767, true); }
    return new Blob([b], { type: 'audio/wav' });
  }
  async function dwExport(withVoice) {
    var el = $('#dw-xmsg'); el.textContent = 'Preparo il file con il mixer…'; await tick();
    try {
      var r = await dwRender(withVoice), name = (cur().title || 'canzone').replace(/\W+/g, '-') + (withVoice ? '' : '-base');
      if (!(await getDl())) await saveFile(name + '.wav', wavStereo(r.L, r.R, r.sr), el, 'File WAV stereo pronto (con il mixer e il master).');
      else { var mono = new Float32Array(r.L.length); for (var i = 0; i < mono.length; i++) mono[i] = (r.L[i] + r.R[i]) / 2; await saveAudio(mono, r.sr, name, el); }
      SESSION.dwExported = true; dwSteps(); coachRec('save', coachCtx());
    } catch (e) { el.textContent = 'Salvataggio non riuscito.'; }
  }
  $('#dw-export').addEventListener('click', function () { dwExport(true); });
  $('#dw-export-base').addEventListener('click', function () { dwExport(false); });
  // ---------- Microfono nello Studio: pulito o autotune, tutto modificabile ----------
  function micSet() {
    var m = LIB.settings.mic;
    if (!m || typeof m !== 'object') m = LIB.settings.mic = { mode: 'pulito', ids: ['naturale'], macros: {} };
    if (!Array.isArray(m.ids) || !m.ids.length) m.ids = [m.mode === 'autotune' ? 'melodico' : 'naturale'];
    m.macros = m.macros || {};
    return m;
  }
  function micRender() {
    var m = micSet(), auto = m.mode === 'autotune';
    $$('#dw-p-mic .dw-mode').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-mic') === m.mode); });
    $('#dw-mic-state').textContent = auto ? 'Mic autotune' : 'Mic pulito';
    var chars = VoiceChain.CHARACTERS.filter(function (c) { return auto || ['naturale', 'scuro', 'brillante', 'morbido', 'potente', 'doppie', 'ruvido'].indexOf(c.id) >= 0; });
    $('#dw-mic-chars').innerHTML = chars.map(function (c) { return '<button class="chip' + (m.ids.indexOf(c.id) >= 0 ? ' on' : '') + '" data-mc="' + c.id + '" title="' + esc(c.desc) + '">' + esc(c.label) + '</button>'; }).join('');
    var base = VoiceChain.combineMacros(m.ids.filter(function (id) { return VoiceChain.CHARACTERS.some(function (c) { return c.id === id; }); }));
    $('#dw-mic-knobs').innerHTML = VoiceChain.MACROS.filter(function (k) { return auto || (k.id !== 'robotic' && k.id !== 'natural'); }).map(function (k) {
      var v = typeof m.macros[k.id] === 'number' ? m.macros[k.id] : Math.round(base[k.id]);
      var label = !auto && k.id === 'intensity' ? 'Quanto lavoro sulla voce' : k.label;
      return '<label class="f"><span>' + esc(label) + ' <b>' + v + '</b></span><input type="range" min="0" max="100" value="' + v + '" data-mk="' + k.id + '"><small class="muted">' + esc(k.hint) + '</small></label>';
    }).join('');
    var cp = m.chordPull == null ? 50 : m.chordPull, fxa = m.fxMix == null ? 70 : m.fxMix;
    $('#dw-mic-knobs').insertAdjacentHTML('beforeend', (auto ? '<label class="f"><span>Segui gli accordi <b>' + cp + '</b></span><input type="range" min="0" max="100" value="' + cp + '" data-mk2="chordPull"><small class="muted">La voce va sulle note dell\'accordo che suona in quel momento (0 = solo la scala).</small></label>' : '') +
      '<label class="f"><span>Quantità effetto <b>' + fxa + '</b></span><input type="range" min="0" max="100" value="' + fxa + '" data-mk2="fxMix"><small class="muted">Per Vocoder, Metallico e Radio.</small></label>');
    $('#dw-mic-fx').innerHTML = [['', 'Nessun effetto']].concat(Object.keys(VoiceFx.FX).map(function (k) { return [k, VoiceFx.FX[k].nome]; })).map(function (f) { return '<button class="chip' + ((m.fx || '') === f[0] ? ' on' : '') + '" data-mfx="' + f[0] + '">' + f[1] + '</button>'; }).join('');
    var pr = LIB.settings.micPresets || [];
    $('#dw-mic-presets').innerHTML = pr.map(function (q, i) { return '<button class="chip" data-mpr="' + i + '">' + esc(q.name) + '</button>'; }).join('') + '<button class="chip" id="dw-mic-save">+ Salva come mio preset</button>';
    $('#dw-mic-ab').textContent = DW.raw ? 'Senti la voce regolata' : 'Senti la voce originale';
  }
  // accordi della base nel tempo della prova (per autotune che segue gli accordi e vocoder)
  function takeChords(t) {
    var b = SESSION.base; if (!b || !b.events || !b.events.chords) return [];
    var bs = 240 / b.bpm, lat = t.lat || 0;
    return b.events.chords.map(function (c) { return { t0: c.bar * bs + lat, t1: (c.bar + 1) * bs + lat, pcs: c.midis.map(function (x) { return ((x % 12) + 12) % 12; }) }; });
  }
  async function micApply(quiet) {
    var t = voiceTake(), el = $('#dw-mic-msg');
    if (!t) { if (!quiet) el.textContent = 'Prima registra la voce con ● (in alto) mentre suona la base.'; return false; }
    var m = micSet(), p = cur().prod, auto = m.mode === 'autotune';
    el.textContent = 'Regolo la voce…'; await tick();
    try {
      if (!t.vlInfo) t.vlInfo = VoiceChain.analyzeVoice(t.mono, t.sr);
      var info = t.vlInfo, as = VoiceChain.autoSettings(info), adv = auto ? {} : { tune: { on: false } };
      if (auto) adv.tune = { chordPull: (m.chordPull == null ? 50 : m.chordPull) / 100 };
      var built = VoiceChain.buildParams({ ids: m.ids, macros: m.macros, auto: as, advanced: adv, keyOverride: { tonic: p.tonic, mode: p.mode } });
      var chords = takeChords(t), res = await VoiceChain.renderAsync(t.mono, t.sr, built.params, { bpm: p.bpm, chords: chords, notes: auto && t.notes ? t.notes.filter(function (n) { return n.edited; }).map(function (n) { return { t0: n.t0, t1: n.t1, target: n.target, amount: n.amount }; }) : null }, function (label) { el.textContent = label + '…'; });
      var outV = res.samples;
      if (m.fx) { el.textContent = 'Effetto ' + VoiceFx.FX[m.fx].nome + '…'; await tick(); outV = VoiceFx.apply(m.fx, outV, t.sr, { chords: chords, tonic: p.tonic, mix: (m.fxMix == null ? 70 : m.fxMix) / 100 }); }
      t.final = outV; t.finalV = (t.finalV || 0) + 1; t.finalRes = null; DW.raw = false; DW.bufKey = '';
      var names = m.ids.map(function (id) { var c = VoiceChain.CHARACTERS.filter(function (x) { return x.id === id; })[0]; return c ? c.label : id; }).join(' + ');
      el.textContent = (auto ? 'Autotune in ' + NOTES[p.tonic] + ' ' + p.mode + ' (la tonalità della base)' : 'Voce pulita, senza autotune') + ' · ' + names + (m.fx ? ' · effetto ' + VoiceFx.FX[m.fx].nome : '') + (auto ? ' · segue gli accordi ' + (m.chordPull == null ? 50 : m.chordPull) + '%' : '') + '. ' + (function () { var nn = (as.notes || []).filter(function (x) { return !/onalit/.test(x); }); return nn.length ? 'Ho misurato: ' + nn.slice(0, 2).join(' ') : ''; })() + ' Premi Play.';
      coachRec('change', coachCtx(), { role: 'mic', from: null, to: m.mode + ':' + m.ids.join('+') });
      micRender(); if (!quiet) { dwStop(true); await dwRefresh(); }
      return true;
    } catch (e) { el.textContent = 'Non riesco a regolare la voce (' + (e && e.message || 'errore') + ').'; return false; }
  }
  $('#dw-p-mic').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var m = micSet(), md = b.getAttribute('data-mic'), mc = b.getAttribute('data-mc');
    if (md) { m.mode = md; m.ids = [md === 'autotune' ? 'melodico' : 'naturale']; m.macros = {}; persist(); micRender(); if (voiceTake()) micApply(); }
    if (mc) { var i = m.ids.indexOf(mc); if (i >= 0) { if (m.ids.length > 1) m.ids.splice(i, 1); } else { m.ids.push(mc); if (m.ids.length > 3) m.ids.shift(); } m.macros = {}; persist(); micRender(); }
  });
  $('#dw-p-mic').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; var m = micSet();
    if (b.hasAttribute('data-mfx')) { m.fx = b.getAttribute('data-mfx'); persist(); micRender(); $('#dw-mic-msg').textContent = m.fx ? 'Effetto scelto: premi Applica alla voce.' : 'Nessun effetto.'; }
    if (b.id === 'dw-mic-save') { var nm = (prompt('Nome del preset (es. "Mia voce trap")') || '').trim().slice(0, 30); if (!nm) return; LIB.settings.micPresets = (LIB.settings.micPresets || []).concat([{ name: nm, set: JSON.parse(JSON.stringify(m)) }]); persist(); micRender(); $('#dw-mic-msg').textContent = 'Preset "' + nm + '" salvato.'; }
    if (b.hasAttribute('data-mpr')) { var q = (LIB.settings.micPresets || [])[+b.getAttribute('data-mpr')]; if (q) { LIB.settings.mic = JSON.parse(JSON.stringify(q.set)); persist(); micRender(); $('#dw-mic-msg').textContent = 'Preset "' + q.name + '" caricato.'; if (voiceTake()) micApply(); } }
  });
  $('#dw-mic-knobs').addEventListener('change', function (e) { var k = e.target.getAttribute('data-mk2'); if (!k) return; micSet()[k] = +e.target.value; persist(); micRender(); });
  $('#dw-mic-knobs').addEventListener('input', function (e) { var k = e.target.getAttribute('data-mk'); if (!k) return; micSet().macros[k] = +e.target.value; e.target.previousElementSibling.querySelector('b').textContent = e.target.value; persist(); });
  $('#dw-mic-apply').addEventListener('click', function () { micApply(false); });
  $('#dw-mic-ab').addEventListener('click', async function () { if (!voiceTake()) { $('#dw-mic-msg').textContent = 'Nessuna voce registrata.'; return; } DW.raw = !DW.raw; DW.bufKey = ''; micRender(); var was = DW.playing, at = DW.playing ? (getCtx().currentTime - DW.t0) : (DW.from || 0); dwStop(true); await dwRefresh(); if (was) dwPlay(Math.max(0, at)); $('#dw-mic-msg').textContent = DW.raw ? 'Ora senti la voce ORIGINALE (come è uscita dal microfono).' : 'Ora senti la voce REGOLATA.'; });

  // ---------- Impara da una base ----------
  var LEARN = { cur: null };
  function learnList() { if (!Array.isArray(LIB.settings.learned)) LIB.settings.learned = []; return LIB.settings.learned; }
  async function decodeStereo(file, rate) {
    var buf = await file.arrayBuffer(), OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, a = null;
    if (OC) { try { var oc = new OC(2, 1, rate); a = await new Promise(function (res, rej) { var pr = oc.decodeAudioData(buf.slice(0), res, rej); if (pr && pr.then) pr.then(res, rej); }); } catch (e) { a = null; } }
    if (!a) { var C = window.AudioContext || window.webkitAudioContext, ctx = new C(); try { a = await ctx.decodeAudioData(buf); } finally { if (ctx.close) ctx.close(); } }
    var L = a.getChannelData(0), R = a.numberOfChannels > 1 ? a.getChannelData(1) : null, max = Math.round(a.sampleRate * 240);
    if (L.length > max) { L = L.slice(0, max); if (R) R = R.slice(0, max); }
    return { L: L, R: R, sr: a.sampleRate };
  }
  function learnBar(f) { var b = $('#dw-learn-bar'); b.hidden = f == null; if (f != null) b.firstElementChild.style.width = Math.round(f * 100) + '%'; }
  function sepMode() { return LIB.settings.sepMode === 'studio' || (LIB.settings.sepMode == null && SEPGPU) ? 'studio' : 'rapida'; }
  var SEPGPU = false; AiSeparator.gpu().then(function (g) { SEPGPU = g; });
  async function sepInfo() {
    $$('#dw-sep-modes .dw-mode').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-sep') === sepMode()); });
    var st = sepMode() === 'studio', have = await AiSeparator.cached(st ? 'melband_roformer_kim' : 'scnet_small'), gpu = false;
    try { gpu = !!(navigator.gpu && await navigator.gpu.requestAdapter()); } catch (e) {}
    $('#dw-sep-info').textContent = (have ? 'Modello già sul dispositivo.' : 'La prima volta scarico il modello (' + (st ? '474 + 27' : '27') + ' MB, meglio con Wi-Fi), poi resta salvato.') +
      (st ? ' Modalità Studio: ' + (gpu ? 'userò la scheda grafica.' : 'senza scheda grafica è lenta, circa 15 minuti per ogni minuto di canzone (misurato).') + ' Consigliata sul computer: sul telefono può finire la memoria.' : ' Circa 2 minuti per ogni minuto di canzone sul processore (misurato).') + ' Fino a 5 minuti: lavoro a pezzi di 40 secondi per non finire la memoria.';
  }
  $('#dw-sep-modes').addEventListener('click', function (e) { var b = e.target.closest('[data-sep]'); if (!b) return; LIB.settings.sepMode = b.getAttribute('data-sep'); persist(); sepInfo(); });
  function stMono(st) { var o = new Float32Array(st.left.length); for (var i = 0; i < o.length; i++) o[i] = (st.left[i] + st.right[i]) / 2; return o; }
  function withTimeout(pr, ms, why) { return Promise.race([pr, new Promise(function (_, rej) { setTimeout(function () { rej(new Error(why)); }, ms); })]); }
  /* rifiuta se il lavoro non dà segni di vita per "ms" (idle() = ms dall'ultimo avanzamento) */
  function stallGuard(pr, idle, ms) { var t; return Promise.race([pr, new Promise(function (_, rej) { t = setInterval(function () { if (idle() > ms) rej(new Error('separazione ferma da ' + Math.round(ms / 60000) + ' minuti')); }, 3000); })]).then(function (v) { clearInterval(t); return v; }, function (e) { clearInterval(t); throw e; }); }
  async function sepAi(f, el) {
    var mode = sepMode();
    el.textContent = 'Leggo l\'audio del file…'; learnBar(0.01);
    var d = await withTimeout(decodeStereo(f, 44100), 120000, 'il file non si apre (troppo lungo o formato video non letto)'), max = 44100 * learnSecs();
    el.textContent = 'Preparo il modello di separazione…'; await tick();
    // si analizza un pezzo centrale (dove di solito ci sono strofa e ritornello): una canzone intera sul telefono richiede troppo tempo e memoria
    if (d.L.length > max) { var a0 = Math.max(0, Math.min(d.L.length - max, Math.round(d.L.length * 0.3))); d.L = d.L.slice(a0, a0 + max); if (d.R) d.R = d.R.slice(a0, a0 + max); }
    var secs = Math.round(d.L.length / 44100);
    var last = Date.now(), alive = function () { last = Date.now(); }, full = learnSecs() >= 300, fk = 'k' + f.name + '|' + f.size + '|' + mode + '|';
    var sopt = full ? { mono: true, load: function (c) { return sepIdb('get', fk + c); }, save: function (c, r) { return sepIdb('put', fk + c, r); } } : null;
    var wl = await wakeOn(); // schermo sempre acceso finché lavora (Safari 16.4+)
    var r = await stallGuard(AiSeparator.separate(d.L, d.R || d.L, mode,
      function (p, txt) { alive(); el.textContent = txt + ' (' + secs + ' s di audio, ' + Math.round(p * 100) + '%). Resta su questa pagina…'; learnBar(0.1 + p * 0.75); },
      function (phase, got, tot, mem) { alive(); if (phase === 'download' && !mem) { el.textContent = 'Scarico il modello: ' + Math.round(got / 1048576) + ' di ' + Math.round(tot / 1048576) + ' MB (solo la prima volta)…'; learnBar(0.01 + 0.09 * got / tot); } }, sopt), function () { return Date.now() - last; }, 150000).finally(function () { try { if (wl) wl.release(); } catch (e) {} });
    if (full) { try { await sepIdb('clear'); } catch (e) {} }
    var st = { drums: stMono(r.drums), bass: stMono(r.bass), other: stMono(r.other) }, voice = stMono(r.vocals), n = voice.length;
    var base = new Float32Array(n), rhythm = new Float32Array(n), orig = new Float32Array(n);
    for (var i = 0; i < n; i++) { base[i] = st.drums[i] + st.bass[i] + st.other[i]; rhythm[i] = st.drums[i] + st.bass[i]; orig[i] = d.R ? (d.L[i] + d.R[i]) / 2 : d.L[i]; }
    return { sr: 44100, voice: voice, base: base, stems: st, rhythm: rhythm, orig: orig, ai: true,
      note: (mode === 'studio' ? 'Modalità Studio: voce con Mel-Band RoFormer, base divisa con SCNet.' : 'Modalità Rapida: SCNet.') + ' Modelli open source, tutto sul dispositivo. Ritmo misurato su batteria e basso separati.' };
  }
  function learnSecs() { var v = +LIB.settings.learnSecs; return v >= 20 && v <= 300 ? v : 40; }
  /* pezzi già separati, salvati nel telefono (database a parte: non si caricano all'avvio) */
  var SDB = null;
  function sepDb() { if (SDB) return SDB; SDB = new Promise(function (res) { try { var rq = indexedDB.open('msa-sep', 1); rq.onupgradeneeded = function () { rq.result.createObjectStore('chunks'); }; rq.onsuccess = function () { res(rq.result); }; rq.onerror = function () { res(null); }; } catch (e) { res(null); } }); return SDB; }
  async function sepIdb(op, key, val) { var db = await sepDb(); if (!db) return null; return new Promise(function (res) { try { var tx = db.transaction('chunks', op === 'get' ? 'readonly' : 'readwrite'), st = tx.objectStore('chunks'), r = op === 'get' ? st.get(key) : op === 'put' ? st.put(val, key) : op === 'clear' ? st.clear() : st.delete(key); tx.oncomplete = function () { res(op === 'get' ? r.result || null : true); }; tx.onerror = function () { res(null); }; } catch (e) { res(null); } }); }
  async function wakeOn() { try { if (navigator.wakeLock) return await navigator.wakeLock.request('screen'); } catch (e) {} return null; }
  /* Separazione sul TUO spazio gratuito Hugging Face (iPhone: niente limiti di memoria, canzone intera, modello più pulito).
     Il file va al tuo spazio, torna diviso in voce, batteria, basso e resto; lo spazio non conserva nulla. Client: @gradio/client (ISC). */
  async function sepServer(f, el) {
    var sp = (LIB.settings.sepServer || '').trim(), modo = LIB.settings.sepServerMode === 'pulita' ? 'pulita' : 'veloce'; if (!sp) throw new Error('nessuno spazio impostato');
    if (f.size > 250 * 1048576) throw new Error('file troppo grande (oltre 250 MB): in Foto accorcia il video o salva solo l\'audio');
    el.textContent = 'Mi collego al tuo spazio di separazione (se dormiva, la prima volta ci mette 1-3 minuti a svegliarsi)…'; learnBar(0.02);
    var GC = await import('https://cdn.jsdelivr.net/npm/@gradio/client@2.8.0/+esm'), cl = await GC.Client.connect(/^https?:/.test(sp) ? sp : sp.replace(/^.*huggingface\.co\/spaces\//, ''));
    var wl = await wakeOn(), out = null, t0 = Date.now();
    try {
      var job = cl.submit('/separa', { file: GC.handle_file(f), modo: modo, parole: !$('#dw-tr-auto') || $('#dw-tr-auto').checked, lingua: 'it' });
      for await (var msg of job) {
        if (msg.type === 'status') {
          if (msg.stage === 'error') throw new Error(msg.message || 'errore dello spazio');
          var pd = msg.progress_data && msg.progress_data[0], sec = Math.round((Date.now() - t0) / 1000);
          el.textContent = (msg.queue && msg.position != null && msg.position > 0 ? 'In coda (posizione ' + msg.position + ')' : (pd && pd.desc ? pd.desc : 'Il tuo spazio sta separando (' + modo + ')')) + ' · ' + sec + ' s. Puoi tenere aperta questa pagina.';
          if (pd && pd.progress != null) learnBar(0.05 + 0.75 * pd.progress);
        } else if (msg.type === 'data') { out = msg.data; }
      }
    } finally { try { if (wl) wl.release(); } catch (e) {} }
    if (!out || out.length < 4) throw new Error('lo spazio non ha restituito le tracce');
    el.textContent = 'Scarico le tracce separate…'; learnBar(0.82);
    var names = ['voice', 'drums', 'bass', 'other'], mono = {}, n = 0;
    for (var i = 0; i < 4; i++) {
      var u = out[i] && (out[i].url || out[i].path); if (!u) throw new Error('traccia mancante');
      var ab = await (await fetch(u)).arrayBuffer(), oc = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 44100);
      var a = await new Promise(function (res, rej) { var pr = oc.decodeAudioData(ab, res, rej); if (pr && pr.then) pr.then(res, rej); });
      var L = a.getChannelData(0), R = a.numberOfChannels > 1 ? a.getChannelData(1) : L, m = new Float32Array(L.length); for (var j = 0; j < m.length; j++) m[j] = (L[j] + R[j]) / 2;
      mono[names[i]] = m; n = n ? Math.min(n, m.length) : m.length;
    }
    var st = { drums: mono.drums.subarray(0, n), bass: mono.bass.subarray(0, n), other: mono.other.subarray(0, n) }, voice = mono.voice.subarray(0, n);
    var base = new Float32Array(n), rhythm = new Float32Array(n), orig = new Float32Array(n);
    for (i = 0; i < n; i++) { base[i] = st.drums[i] + st.bass[i] + st.other[i]; rhythm[i] = st.drums[i] + st.bass[i]; orig[i] = base[i] + voice[i]; }
    var trS = out[4] && out[4].lines && out[4].lines.length ? { lines: out[4].lines, text: out[4].text || '' } : null;
    return { tr: trS, sr: 44100, voice: voice, base: base, stems: st, rhythm: rhythm, orig: orig, ai: true, note: (trS ? 'Parole trascritte sul tuo spazio. ' : '') + 'Separato sul tuo spazio Hugging Face (' + (modo === 'pulita' ? 'Mel-Band RoFormer + htdemucs' : 'htdemucs') + '), canzone intera, in ' + Math.round((Date.now() - t0) / 1000) + ' s.' };
  }
  async function sepFast(f, el) {
    var d = await decodeStereo(f, 32000), sr = d.sr, i, mx = Math.round(sr * learnSecs());
    if (d.L.length > mx) { var b0 = Math.max(0, Math.min(d.L.length - mx, Math.round(d.L.length * 0.3))); d.L = d.L.slice(b0, b0 + mx); if (d.R) d.R = d.R.slice(b0, b0 + mx); }
    var sep = await BeatLearn.separateAsync(d.L, d.R, sr, {}, function (p) { learnBar(0.05 + p * 0.6); });
    var bm = new Float32Array(sep.baseL.length), mono = new Float32Array(d.L.length);
    for (i = 0; i < bm.length; i++) bm[i] = (sep.baseL[i] + sep.baseR[i]) / 2;
    for (i = 0; i < mono.length; i++) mono[i] = d.R ? (d.L[i] + d.R[i]) / 2 : d.L[i];
    return { sr: sr, voice: sep.voice, base: bm, stems: null, rhythm: mono, orig: mono, ai: false, note: 'ATTENZIONE: l\'AI non è partita su questo dispositivo, ho usato il metodo semplice. Voce e base NON sono pulite: va bene solo per misurare il ritmo.' };
  }
  function normOnly(x, sr) { return BeatLearn.clean(x, sr, { denoise: 0 }).x; }
  (function learnCrashNote() { try { var r = JSON.parse(localStorage.getItem('learnRunning') || 'null'); if (!r) return; localStorage.removeItem('learnRunning'); if (Date.now() - r.at > 3 * 3600e3) return; if ((r.secs || 0) >= 300) { $('#dw-learn-msg').textContent = 'La separazione di "' + r.name + '" si è interrotta (il telefono ha chiuso la pagina). Ricarica lo STESSO file: riparto dai pezzi già finiti, non da capo.'; return; } LIB.settings.learnSecs = Math.max(20, Math.round((r.secs || 40) * 0.6)); persist(); $('#dw-learn-msg').textContent = 'L\'ultima analisi di "' + r.name + '" si è interrotta: il telefono ha chiuso la pagina (memoria o schermo bloccato). Riprova: ora analizzo solo ' + LIB.settings.learnSecs + ' secondi. Tieni lo schermo acceso.'; } catch (e) {} })();
  $('#dw-learn-secs').value = String(learnSecs()); $('#dw-learn-secs').addEventListener('change', function () { LIB.settings.learnSecs = +this.value; persist(); });
  (function sepWhereUi() {
    var w = $('#dw-sep-where'), n = $('#dw-sep-space'), m = $('#dw-sep-smode'); if (!w) return;
    w.value = LIB.settings.sepWhere || ''; n.value = LIB.settings.sepServer || ''; m.value = LIB.settings.sepServerMode || 'veloce'; $('#dw-sep-srv').hidden = w.value !== 'server';
    w.addEventListener('change', function () { LIB.settings.sepWhere = this.value; persist(); $('#dw-sep-srv').hidden = this.value !== 'server'; });
    n.addEventListener('change', function () { LIB.settings.sepServer = this.value.trim(); persist(); });
    m.addEventListener('change', function () { LIB.settings.sepServerMode = this.value; persist(); });
  })();
  $('#dw-tr-auto').checked = LIB.settings.trAuto !== false; $('#dw-tr-auto').addEventListener('change', function () { LIB.settings.trAuto = this.checked; persist(); });
  $('#dw-bt-on').checked = LIB.settings.beatThis !== false; $('#dw-bt-on').addEventListener('change', function () { LIB.settings.beatThis = this.checked; persist(); });
  /* Beat This! (MIT): battiti e inizio battuta con una rete neurale da 10 MB, scaricata una volta sola */
  async function btGrid(x, sr, el) {
    if (!window.BeatThis) return null; var max = sr * 120; if (x.length > max) x = x.subarray(0, max);
    var t0 = Date.now(); await BeatThis.load(function (got, tot, fromCache) { if (!fromCache) { el.textContent = 'Scarico Beat This! (solo la prima volta): ' + Math.round(got / 1048576 * 10) / 10 + ' di ' + Math.round(tot / 1048576) + ' MB…'; } });
    el.textContent = 'Trovo battiti e battute con Beat This!…'; await tick();
    var r = await BeatThis.track(x, sr, function (f) { el.textContent = 'Trovo battiti e battute con Beat This! ' + Math.round(f * 100) + '%'; }); r.ms = Date.now() - t0; return r;
  }
  $('#dw-learn-file').addEventListener('change', async function () {
    var fs = Array.prototype.slice.call(this.files || []); this.value = ''; if (!fs.length) return;
    var art = (($('#dw-learn-art0') || {}).value || '').trim().slice(0, 30); if (art) { LEARN.lastArt = art; LIB.settings.learnArt = art; persist(); }
    for (var q = 0; q < fs.length; q++) { $('#dw-learn-msg').textContent = (fs.length > 1 ? 'Canzone ' + (q + 1) + ' di ' + fs.length + ': ' : ''); await learnOne(fs[q], art || 'Senza cartella', q === fs.length - 1); }
  });
  async function learnOne(f, art, last) {
    var el = $('#dw-learn-msg');
    el.textContent = 'Apro "' + f.name + '"…'; learnBar(0.02); await tick(); dwStop(); stopPlay();
    try { localStorage.setItem('learnRunning', JSON.stringify({ name: f.name, at: Date.now(), secs: learnSecs() })); } catch (e) {}
    try {
      var s, why = '';
      try { if ((LIB.settings.sepWhere || '') === 'server' && LIB.settings.sepServer) { try { s = await sepServer(f, el); } catch (e1) { var why1 = ((e1 && e1.message) || e1).toString().slice(0, 120); el.textContent = 'Il tuo spazio non ha risposto (' + why1 + '). Provo sul telefono…'; await tick(); s = await sepAi(f, el); s.note = 'ATTENZIONE: il tuo spazio non ha risposto (' + why1 + '), ho separato sul telefono. ' + s.note; } } else s = await sepAi(f, el); }
      catch (e) { why = (e && e.message || 'memoria').slice(0, 80); el.textContent = 'L\'AI non è riuscita (' + why + '). Uso il metodo semplice solo per il ritmo…'; await tick(); s = await sepFast(f, el); }
      el.textContent = 'Porto le tracce al volume giusto…'; learnBar(0.88); await tick();
      var voice = normOnly(s.voice, s.sr), base = normOnly(s.base, s.sr);
      if (s.stems) for (var k in s.stems) s.stems[k] = normOnly(s.stems[k], s.sr);
      el.textContent = 'Misuro il ritmo…'; learnBar(0.95); await tick();
      var tuneM = null; if (s.ai) { try { var vm = s.voice.length > s.sr * 60 ? s.voice.subarray(0, s.sr * 60) : s.voice, mz = Autotune.measure(vm, s.sr, {}); if (mz.voicedFrames > 50 && isFinite(mz.rawCents)) tuneM = { cents: Math.round(Math.abs(mz.rawCents)), label: Math.abs(mz.rawCents) < 8 ? 'autotune forte (note quasi perfette)' : (Math.abs(mz.rawCents) < 16 ? 'autotune medio o voce molto intonata' : 'voce naturale, poco o niente autotune') }; } catch (e) {} }
      var grid = null; if (LIB.settings.beatThis !== false) { try { grid = await btGrid(s.orig && s.orig.length ? s.orig : s.rhythm, s.sr, el); } catch (e) { grid = null; el.textContent = 'Beat This! non è partito (' + ((e && e.message) || e).toString().slice(0, 60) + '): uso il metodo a regole.'; await tick(); } }
      var prof = BeatLearn.learn(s.rhythm, s.sr, { grid: grid, harm: s.stems ? (function () { var h = new Float32Array(s.stems.other.length); for (var q = 0; q < h.length; q++) h[q] = s.stems.other[q] + s.stems.bass[q]; return h; })() : null });
      if (grid) prof.why.unshift((prof.grid === 'beatthis' ? 'Misurato con Beat This! (rete neurale): ' + grid.beats.length + ' battiti, ' + grid.downbeats.length + ' inizi di battuta, affidabilità ' + Math.round((grid.conf || 0) * 100) + '%.' : 'Beat This! poco sicuro su questa base (affidabilità ' + Math.round((grid.conf || 0) * 100) + '%): velocità dal metodo a regole.'));
      if (tuneM) { prof.tune = tuneM; prof.why.push('Voce: ' + tuneM.label + ' (scarto medio ' + tuneM.cents + ' cent dalla nota).'); }
      LEARN.cur = { name: f.name.replace(/\.[^.]+$/, '').slice(0, 40), prof: prof, voice: voice, base: base, orig: s.orig, stems: s.stems, sr: s.sr, note: s.note, vote: 1, ai: s.ai };
      var rec = { id: uid(), name: LEARN.cur.name, artist: art, prof: prof, vote: 1, at: Date.now() }, LL = learnList(); LL.push(rec); if (LL.length > 120) LL.shift(); LEARN.cur.recId = rec.id; persist();
      learnBar(null);
      if (s.tr) lyricsDone(LEARN.cur, s.tr, el); else if ((LIB.settings.sepWhere || '') === 'server' && /spazio Hugging/.test(s.note || '')) { /* sul telefono Whisper pesa circa 1 GB: se lo spazio non ha trascritto, non lo rifaccio qui */ } else if ($('#dw-tr-auto') && $('#dw-tr-auto').checked && s.ai) { try { localStorage.removeItem('learnRunning'); } catch (x) {} await learnLyrics(LEARN.cur, 'italian'); }
      if (last) setTimeout(function () { var fp = folderProf(art); varMake('', learnSpecs2(fp || prof, varCount()), '#dw-learn-msg'); }, 50); el.textContent = s.ai ? 'Fatto. Ascolta le parti separate' + (LEARN.cur.tr ? ' e leggi il testo studiato' : '') + ': la canzone è nella cartella «' + art + '».' : 'Fatto, ma senza AI (' + why + '): voce e base non sono pulite.';
      try { localStorage.removeItem('learnRunning'); } catch (e) {}
      learnRender(); coachRec('complete', coachCtx()); sepInfo();
    } catch (e) {
      learnBar(null); try { localStorage.removeItem('learnRunning'); } catch (x) {}
      var why2 = ' [Motivo tecnico: ' + String((e && (e.name || '') + ' ' + (e && e.message || e)) || '?').slice(0, 90) + ' · file ' + Math.round((f.size || 0) / 1048576 * 10) / 10 + ' MB, tipo ' + (f.type || 'sconosciuto') + ']';
      el.textContent = /video|mov|mp4/i.test((f.type || '') + f.name) ? 'Non riesco a leggere l\'audio di questo video. Su iPhone: apri il video in Foto, Condividi > Salva su File, poi riprova.' : 'Non riesco a leggere questo file. Prova un MP3, M4A, WAV o un video MP4/MOV.' + why2;
    }
  }
  // metodo del testo: righe, sillabe, velocità, rime, ripetizioni (si salvano i NUMERI, non le parole)
  function lyricStats(tr) {
    var lines = tr.lines.length ? tr.lines : [{ t0: 0, t1: 0, text: tr.text }], txt = lines.map(function (l) { return l.text; }).join('\n'), a = LyricsEngine.analyze(txt);
    var all = []; (a.stanzas || []).forEach(function (st) { all = all.concat(st.lines); });
    var syl = all.reduce(function (q, l) { return q + l.syllables; }, 0), dur = lines.reduce(function (q, l) { return q + Math.max(0, (l.t1 || 0) - (l.t0 || 0)); }, 0);
    var rhymed = all.filter(function (l, i) { return all.some(function (o, j) { return j !== i && Math.abs(j - i) <= 2 && o.rhyme === l.rhyme; }); }).length;
    return { righe: all.length, sillabeRiga: all.length ? Math.round(syl / all.length * 10) / 10 : 0, sillabeSec: dur > 0 ? Math.round(syl / dur * 10) / 10 : null, rimePct: all.length ? Math.round(rhymed / all.length * 100) : 0, ripetute: Math.round((a.repetitionShare || 0) * 100), schema: all.slice(0, 4).map(function (l) { return l.rhyme; }).join('') };
  }
  function trHtml(c) {
    var st = c.prof.lyr || {}, flow = st.sillabeSec == null ? '' : st.sillabeSec >= 5 ? ' (flow veloce, rap serrato)' : (st.sillabeSec >= 3.2 ? ' (flow medio)' : ' (flow lento/melodico)');
    return '<ul class="clean small"><li>Righe: ' + st.righe + ' · sillabe per riga: ' + st.sillabeRiga + (st.sillabeSec != null ? ' · <b>' + st.sillabeSec + ' sillabe al secondo</b>' + flow : '') + '</li><li>Righe in rima con una vicina: ' + st.rimePct + '% · schema delle prime righe: ' + esc(st.schema) + '</li><li>Righe ripetute (gancio/ritornello): ' + st.ripetute + '%</li></ul>' +
      '<details class="small"><summary>Parole trascritte (solo per studiare, non vengono salvate)</summary><p class="muted">' + c.tr.lines.map(function (l) { return esc(l.text); }).join('<br>') + '</p></details>';
  }
  $('#dw-learn-cur').addEventListener('click', async function (e) {
    if (!e.target.closest('#dw-tr-go')) return; await learnLyrics(LEARN.cur, $('#dw-tr-lang').value);
  });
  async function learnLyrics(c, lang, given) {
    var el = $('#dw-learn-msg'); if (!c) return; lang = lang || 'italian';
    if (given) return lyricsDone(c, given, el);
    el.textContent = 'Preparo Whisper (la prima volta scarico circa 80 MB)…'; learnBar(0.02);
    try {
      var tr = await Transcribe.run(c.voice, c.sr, { language: lang, onProgress: function (a, b) { if (b) { el.textContent = 'Scarico Whisper: ' + Math.round(a / 1048576) + ' di ' + Math.round(b / 1048576) + ' MB (solo la prima volta)…'; learnBar(0.02 + 0.4 * a / b); } } });
      learnBar(null); lyricsDone(c, tr, el);
    } catch (err) { learnBar(null); el.textContent = 'Trascrizione non riuscita (' + (err && err.message || 'memoria') + ').'; }
  }
  function lyricsDone(c, tr, el) {
    try {
      c.tr = tr; c.prof.lyr = lyricStats(tr);
      var rec = learnList().filter(function (r) { return r.id === c.recId; })[0], art = rec ? rec.artist : '';
      if (rec) rec.prof.lyr = c.prof.lyr;
      if (tr.text && art && art !== 'Senza cartella') { var st = arStore(), ar = st[art] || (st[art] = { acc: ArtistLab.newAcc(), on: false }), me = ArtistLab.measure(tr.text); if (me.lines) { ar.acc = ArtistLab.merge(ar.acc, me); WordBank.learn(wbStore(), tr.text); } }
      persist();
      el.textContent = tr.text ? 'Testo studiato' + (art && art !== 'Senza cartella' ? ' e aggiunto alla cartella testi «' + art + '» (solo numeri e parole singole per le rime): in 1 Testo puoi attivarla come stile' : '') + '.' : 'Non ho sentito parole chiare in questa voce.'; learnRender();
    } catch (err) { learnBar(null); el.textContent = 'Trascrizione non riuscita (' + (err && err.message || 'memoria') + ').'; }
  }
  function profLine(p) { return p.bpm + ' BPM · ' + (p.key ? p.key.name : 'tonalità incerta') + (p.prog ? ' · giro ' + BeatLearn.progName(p.prog, p.key && p.key.mode) : '') + ' · simile a: ' + (Arranger.STYLES[p.style] ? Arranger.STYLES[p.style].label : p.style); }
  function learnRender() {
    var c = LEARN.cur, h = '';
    if (c) {
      h = '<div class="dw-agent"><header><span class="dw-dot ok"></span><b>' + esc(c.name) + '</b><span class="st">' + esc(profLine(c.prof)) + '</span></header>' +
        '<ul class="clean small">' + c.prof.why.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul><p class="small muted">' + esc(c.note) + ' <span class="tag i">Ipotesi</span> la separazione è una stima: giudica tu ascoltando.</p>' +
        '<div class="row"><button class="btn sm" data-lp="voice">▶ Voce</button><button class="btn sm" data-lp="base">▶ Base</button>' + (c.stems ? '<button class="btn sm" data-lp="drums">▶ Batteria</button><button class="btn sm" data-lp="bass">▶ Basso</button><button class="btn sm" data-lp="other">▶ Resto</button>' : '') + '<button class="btn sm" data-lp="orig">▶ Originale</button><button class="btn sm" data-lp="stop">■</button></div>' +
        '<div class="row"><button class="btn sm pri" id="dw-tr-go">Trascrivi le parole e studia il testo</button><select id="dw-tr-lang"><option value="italian">italiano</option><option value="english">inglese</option><option value="spanish">spagnolo</option><option value="french">francese</option></select></div><div id="dw-tr-out">' + (c.tr ? trHtml(c) : '') + '</div>' +
        '<div class="row"><button class="btn sm" data-ls="voice">Salva la voce (WAV)</button><button class="btn sm" data-ls="base">Salva la base (WAV)</button></div>' +
        '<label class="f" style="margin-top:8px"><span>Cartella (artista o genere)</span><input id="dw-learn-art" list="dw-learn-arts" maxlength="30" placeholder="es. Sfera, Drill UK, Club" value="' + esc(LEARN.lastArt || '') + '"><datalist id="dw-learn-arts">' + learnArtists().map(function (a) { return '<option value="' + esc(a) + '">'; }).join('') + '</datalist></label>' +
        '<div class="row"><button class="btn sm pri" data-lv="1">Mi piace questo ritmo</button><button class="btn sm" data-lv="-1">Non mi piace</button></div></div>';
    }
    $('#dw-learn-cur').innerHTML = h;
    var dl = $('#dw-learn-arts0'); if (dl) { var nm = learnArtists().filter(function (x) { return x !== 'Senza cartella'; }).concat(StylePresets.LIST.map(function (p) { return p.nome.replace(/^Tipo /, '').replace(/ \(.*\)$/, ''); })); dl.innerHTML = nm.filter(function (v, i) { return nm.indexOf(v) === i; }).map(function (x) { return '<option value="' + esc(x) + '">'; }).join(''); }
    var a0 = $('#dw-learn-art0'); if (a0 && !a0.value && LIB.settings.learnArt) a0.value = LIB.settings.learnArt;
    try { varStyleRender(); } catch (e) {}
    var L = learnList(), arts = learnArtists();
    $('#dw-learn-list').innerHTML = L.length ? arts.map(function (a) {
      var items = L.map(function (r, i) { return [r, i]; }).filter(function (x) { return (x[0].artist || 'Senza cartella') === a; }), lk = items.filter(function (x) { return x[0].vote > 0; }).length;
      var pr = items.map(function (x) { return x[0].prof; }), avg = function (f) { var v = pr.map(f).filter(function (z) { return z != null && isFinite(z); }); return v.length ? Math.round(v.reduce(function (q, z) { return q + z; }, 0) / v.length * 10) / 10 : null; }, sps = avg(function (q) { return q.lyr && q.lyr.sillabeSec; }), cents = avg(function (q) { return q.tune && q.tune.cents; });
      var sum = 'Media: ' + avg(function (q) { return q.bpm; }) + ' BPM' + (sps != null ? ' · ' + sps + ' sillabe/s' : '') + (cents != null ? ' · scarto voce ' + cents + ' cent' + (cents < 8 ? ' (autotune forte)' : '') : '');
      return '<div class="dw-agent"><header><span class="dw-dot ' + (lk ? 'ok' : '') + '"></span><b>' + esc(a) + '</b><span class="st">' + items.length + (items.length === 1 ? ' canzone · ' : ' canzoni · ') + lk + ' ♥</span></header>' +
        '<p class="small muted">' + esc(sum) + '</p>' +
        items.map(function (x) { var r = x[0]; return '<div class="dw-prop"><div><b>' + (r.vote > 0 ? '♥ ' : '✕ ') + esc(r.name) + '</b><small>' + esc(profLine(r.prof)) + '</small></div><button class="btn sm" data-lx="' + x[1] + '">Togli</button></div>'; }).join('') +
        (lk ? '<div class="row"><button class="btn sm pri" data-lm="' + esc(a) + '">Crea ' + varCount() + ' basi nello stile ' + esc(a) + '</button><button class="btn sm" data-la="' + esc(a) + '">Usa subito una base</button></div>' + (lk < 4 ? '<p class="small muted">Con ' + lk + (lk === 1 ? ' canzone' : ' canzoni') + ' lo stile è ancora grezzo: ne servono 4-5.</p>' : '') : '') + '</div>';
    }).join('') : '<p class="small muted">Ancora niente. Carica 2 o 3 canzoni che ti piacciono e una che non ti piace: impara la differenza.</p>';
  }
  $('#dw-p-learn').addEventListener('click', async function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var c = LEARN.cur, lp = b.getAttribute('data-lp'), ls = b.getAttribute('data-ls'), lv = b.getAttribute('data-lv'), lx = b.getAttribute('data-lx');
    if (lp) { dwStop(); if (lp === 'stop') stopPlay(); else if (c) playBuf(c[lp] || (c.stems && c.stems[lp]), c.sr); }
    if (ls && c) await saveAudio(c[ls], c.sr, c.name.replace(/\W+/g, '-') + '-' + (ls === 'voice' ? 'voce' : 'base'), $('#dw-learn-msg'));
    if (lv && c) {
      var art = (($('#dw-learn-art') || {}).value || '').trim().slice(0, 30) || 'Senza cartella'; LEARN.lastArt = art === 'Senza cartella' ? '' : art;
      var L = learnList(), ex = L.filter(function (r) { return r.id === c.recId; })[0]; if (ex) { ex.vote = +lv; ex.artist = art; } else { L.push({ id: uid(), name: c.name, artist: art, prof: c.prof, vote: +lv, at: Date.now() }); if (L.length > 120) L.shift(); }
      persist(); LEARN.cur = null; stopPlay();
      $('#dw-learn-msg').textContent = +lv > 0 ? 'Imparato: terrò conto di questo ritmo. Ho cancellato l\'audio, restano solo le misure.' : 'Segnato: eviterò questo tipo di ritmo.';
      learnRender(); agentsRun();
    }
    if (lx != null) { learnList().splice(+lx, 1); persist(); learnRender(); }
    var la = b.getAttribute('data-la');
    var lm = b.getAttribute('data-lm'); if (lm) { var fp = folderProf(lm); if (fp) { dwStop(); varMake('', learnSpecs2(fp, varCount()), '#dw-learn-msg'); $('#dw-learn-prop').scrollIntoView({ behavior: 'smooth' }); } return; }
    if (la) { var pl = learnPlan(la); if (pl) { learnUse(pl); $('#dw-learn-msg').textContent = 'Base nuova nello stile "' + la + '" (da ' + pl.from + (pl.from === 1 ? ' canzone' : ' canzoni') + ' della cartella): ' + (Arranger.STYLES[pl.genre] ? Arranger.STYLES[pl.genre].label : pl.genre) + ', ' + pl.bpm + ' BPM. Ogni volta che la premi esce una base diversa. Premi Play.'; } }
  });
  function varCount() { var v = +(($('#dw-var-n') || {}).value || 16); return v > 0 ? v : 16; }
  /* profilo medio di una cartella (solo canzoni che ti piacciono): stile più frequente, velocità mediana, tonalità e giro più usati, cassa e rullante */
  function folderProf(artist) {
    var L = learnList().filter(function (r) { return (r.artist || 'Senza cartella') === artist && r.vote > 0 && r.prof; }).map(function (r) { return r.prof; }); if (!L.length) return null;
    function most(f) { var c = {}, best = null; L.forEach(function (p) { var k = f(p); if (k == null) return; k = JSON.stringify(k); c[k] = (c[k] || 0) + 1; if (best == null || c[k] > c[best]) best = k; }); return best == null ? null : JSON.parse(best); }
    function med(f) { var v = L.map(f).filter(function (x) { return x != null && isFinite(x); }).sort(function (a, b) { return a - b; }); return v.length ? v[v.length >> 1] : null; }
    var bl = learnPlan(artist), out = Object.assign({}, L[L.length - 1]);
    out.style = most(function (p) { return p.style; }) || out.style; out.bpm = Math.round(med(function (p) { return p.bpm; }) || out.bpm); out.key = most(function (p) { return p.key; }) || out.key;
    out.prog = most(function (p) { return p.prog; }) || out.prog; out.kick = bl && bl.groove ? bl.groove.kickPats[0][0] : out.kick; out.snare = bl && bl.groove ? bl.groove.snare : out.snare;
    out.swing = med(function (p) { return p.swing; }) || 0; out.triplets = med(function (p) { return p.triplets; }) || 0; out.hatDensity = med(function (p) { return p.hatDensity; }); out.bright = med(function (p) { return p.bright; });
    out.artist = artist; out.count = L.length; return out;
  }
  function learnArtists() { var seen = {}, out = []; learnList().forEach(function (r) { var a = r.artist || 'Senza cartella'; if (!seen[a]) { seen[a] = 1; out.push(a); } }); return out; }
  function learnPlan(artist) { var L = learnList().filter(function (r) { return !artist || (r.artist || 'Senza cartella') === artist; }); return BeatLearn.blend(L.filter(function (r) { return r.vote > 0; }).map(function (r) { return r.prof; }), L.filter(function (r) { return r.vote < 0; }).map(function (r) { return r.prof; })); }
  function learnUse(pl) {
    var p = cur().prod; if (!pl) return false;
    if (Arranger.STYLES[pl.genre]) p.genre = pl.genre;
    p.bpm = Math.max(60, Math.min(180, pl.bpm)); p.mode = pl.mode; p.groove = pl.groove; p.prog = pl.prog || null; p.tune = pl.tune; p.seed = (p.seed || 1) + 1;
    coachRec('change', coachCtx(), { role: 'groove', from: null, to: 'gusti' });
    dwFill(); fillBase(); dwStop(); dwChanged(true); return true;
  }
  $('#dw-learn-make').addEventListener('click', function () {
    var pl = learnPlan(), el = $('#dw-learn-msg');
    if (!pl) { el.textContent = 'Prima carica almeno una canzone e premi "Mi piace questo ritmo".'; return; }
    learnUse(pl); el.textContent = 'Base nuova creata dai tuoi gusti (' + pl.from + ' che ti piacciono' + (pl.avoid ? ', ' + pl.avoid + ' da evitare' : '') + '): ' + (Arranger.STYLES[pl.genre] ? Arranger.STYLES[pl.genre].label : pl.genre) + ', ' + pl.bpm + ' BPM, cassa sui passi ' + pl.groove.kickPats[0][0].map(function (x) { return x + 1; }).join(', ') + '. Premi Play.';
  });
  document.body.appendChild($('#dw-sheet')); // sopra a tutto, anche alla barra in basso
  // spazi di lavoro dello Studio: Impara · Base · Testo · Voce · Mix (un solo gruppo di pannelli alla volta)
  function dwWsName() { var w = LIB.settings.ws; return ['testo', 'base', 'voce', 'mix', 'libreria'].indexOf(w) >= 0 ? w : 'testo'; }
  function dwWs(ws) {
    LIB.settings.ws = ws; persist();
    var adv = !!LIB.settings.adv; $$('#v-daw [data-ws]').forEach(function (el) { var a = el.getAttribute('data-adv'); el.hidden = (' ' + el.getAttribute('data-ws') + ' ').indexOf(' ' + ws + ' ') < 0 || (!adv && a && (' ' + a + ' ').indexOf(' ' + ws + ' ') >= 0); });
    var ab = $('#dw-adv'); if (ab) ab.textContent = adv ? 'Nascondi strumenti avanzati' : 'Mostra strumenti avanzati';
    $$('#tabs a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-ws') === ws); });
    if (ws === 'base' || ws === 'voce' || ws === 'mix') setTimeout(function () { if (SESSION.base) { dwDraw(SESSION.base); prDraw(); } }, 30);
  }

  $('#dw-adv').addEventListener('click', function () { LIB.settings.adv = !LIB.settings.adv; persist(); dwWs(dwWsName()); });
  /* ===== Studio a passi: porto qui i comandi del Cervello (stessi id, stessi ascolti) ===== */
  (function dwAdoptBrain() {
    function mv(id, to, wrapLabel) { var el = $('#' + id), t = $(to); if (!el || !t) return; if (wrapLabel) el = el.closest('label') || el; t.appendChild(el); }
    ['sb-style', 'sb-mood'].forEach(function (id) { mv(id, '#dwb-fields', true); });
    ['sb-make', 'sb-wild', 'sb-six', 'sb-again'].forEach(function (id) { mv(id, '#dwb-actions'); });
    ['sb-chips', 'sb-list', 'sb-msg'].forEach(function (id) { mv(id, '#dwb-out'); });
    ['b-play', 'b-mel', 'b-new', 'b-stop'].forEach(function (id) { mv(id, '#dwp-actions'); });
    ['b-status', 'b-out', 'ear-out'].forEach(function (id) { mv(id, '#dwp-out'); });
    ['ear-go', 'b-save'].forEach(function (id) { mv(id, '#dwp-more'); });
    mv('ai-card', '#dwx-ai'); mv('gv-card', '#dwx-sg'); mv('rh-card', '#dwx-rh'); mv('sg-card', '#dwx-sg');
  })();
  $('#tabs').addEventListener('click', function (e) { var a = e.target.closest('[data-ws]'); if (!a) return; if (location.hash === '#daw') { e.preventDefault(); dwWs(a.getAttribute('data-ws')); window.scrollTo(0, 0); } else LIB.settings.ws = a.getAttribute('data-ws'); });
  // ---------- Varianti: 8 basi diverse alla volta, da ascoltare e scegliere (senza limite: premi ancora) ----------
  var VAR = { list: [], busy: false };
  function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
  function varSpec(g, same) {
    var R = Instruments.RECIPES[g] || Instruments.RECIPES.melodico, st = Arranger.STYLES[g], kits = Object.keys(SynthDesign.KITS);
    return { genre: g, bpm: same ? cur().prod.bpm : st.bpm + Math.round((Math.random() - 0.5) * 6), seed: 1 + Math.floor(Math.random() * 99999),
      inst: { melodia: rnd(R.melodia), accordi: rnd(R.accordi), pad: rnd(R.pad), arpeggio: R.arpeggio ? rnd(R.arpeggio) : undefined },
      kit: Math.random() < 0.75 && R.kit ? R.kit : rnd(kits), arpPattern: rnd(Object.keys(Arranger.ARP)), mode: cur().prod.mode, prog: rnd(StylePresets.PROGS[cur().prod.mode] || StylePresets.PROGS.minore), tune: { hat: 0.8 + Math.random() * 0.45, lift: 0.85 + Math.random() * 0.45, kickVar: 0.8 + Math.random() * 0.5 } };
  }
  async function varMake(mode, given, elSel) {
    if (VAR.busy) return; VAR.busy = true; var el = $(elSel || '#dw-var-msg'), p = cur().prod, map = songMap(), specs = given || [];
    if (given) {} else if (mode === 'stili') { var keys = Object.keys(Arranger.STYLES).filter(function (g) { return g !== p.genre; }).sort(function () { return Math.random() - 0.5; }).slice(0, 8); keys.forEach(function (g) { specs.push(varSpec(g, false)); }); }
    else for (var i = 0; i < 8; i++) specs.push(varSpec(p.genre, true));
    VAR.list = []; varRender();
    for (var k = 0; k < specs.length; k++) {
      var sp = specs[k]; el.textContent = 'Compongo la base ' + (k + 1) + ' di ' + specs.length + '…'; await tick();
      for (var r in sp.inst) if (sp.inst[r]) await loadInst(sp.inst[r]);
      try {
        var bb = Arranger.generate({ sampleRate: 22050, bpm: sp.bpm, tonic: sp.tonic != null ? sp.tonic : p.tonic, mode: sp.mode, bars: p.bars, genre: sp.genre, seed: sp.seed, inst: sp.inst, plan: map ? map.plan : undefined, arpPattern: sp.arpPattern, groove: sp.groove, prog: sp.prog, tune: sp.tune, bassStyle: sp.bassStyle || undefined, sounds: 'campioni', drumRender: function (part, o, s2) { return SynthDesign.kitRender(sp.kit, part, o, s2); } });
        sp.mix = Backing.mix(bb, p.levels, p.sec); sp.sr = bb.sampleRate;
        var pfv = pfPlan(); if (pfv.on && map) { var pv = ProdFx.plan(map, { genre: sp.genre, seed: sp.seed, density: Math.min(1, pfv.density) }); sp.fxNames = pv.events.filter(function (e2) { return e2.tipo === 'sfx' && ProdFx.SOUNDS[e2.snd].gruppo !== 'Cinema'; }).map(function (e2) { return ProdFx.SOUNDS[e2.snd].nome.split(' (')[0].toLowerCase(); }).filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 4); var sx = ProdFx.renderSfx(pv.events, sp.sr, sp.bpm, sp.mix.length, { seed: sp.seed, tonic: p.tonic }); var pkv = 0, q; for (q = 0; q < sx.length; q++) { sp.mix[q] += sx[q] * 0.5; var av = sp.mix[q] < 0 ? -sp.mix[q] : sp.mix[q]; if (av > pkv) pkv = av; } if (pkv > 0.98) for (q = 0; q < sp.mix.length; q++) sp.mix[q] *= 0.98 / pkv; }
        VAR.list.push(sp); varRender();
      } catch (e) { VAR.err = (e && e.message) || String(e); }
    }
    if (!VAR.list.length && specs.length) { el.textContent = 'Nessuna base creata (errore: ' + (VAR.err || 'sconosciuto') + '). Mandami questo messaggio.'; VAR.busy = false; return; }
    el.textContent = given ? VAR.list.length + ' basi nuove pronte, sul tuo testo: ascoltale e scegli con Usa. Premi ancora per altre diverse.' : VAR.list.length + ' varianti pronte: ascoltale, scegli con Usa. Premi ancora per altre 8 nuove.'; VAR.busy = false;
  }
  function varName(sp) { return (sp.nome || (Arranger.STYLES[sp.genre] ? Arranger.STYLES[sp.genre].label : sp.genre)) + ' · ' + sp.bpm + ' BPM' + (sp.prog ? ' · giro ' + StylePresets.progName(sp.prog, sp.mode) : ''); }
  $('#dw-var-style').addEventListener('change', function () { refSet(this.value); });
  $('#dw-ref').addEventListener('change', function () { refSet(this.value); $('#dw-ref-msg').textContent = this.value ? 'Da ora testi e basi seguono questo stile. Premi «Cervello Sultan · crea dal testo».' : 'Lo stile lo decide il testo.'; });
  function atmRender() { varStyleRender(); var g = {}; StylePresets.LIST.forEach(function (p) { (g[p.gruppo] = g[p.gruppo] || []).push(p); }); $('#dw-var-atm').innerHTML = Object.keys(g).map(function (k) { return '<p class="small muted" style="margin:8px 0 4px">' + esc(k) + '</p><div class="chips">' + g[k].map(function (p) { return '<button class="chip" data-atm="' + p.id + '" title="' + esc(p.spiega) + '">' + esc(p.nome.replace(/^Tipo /, '')) + '</button>'; }).join('') + '</div>'; }).join(''); }
  function varRender() {
    var lp = $('#dw-learn-prop'); $('#dw-var-list').innerHTML = (lp ? lp.innerHTML = varHtml() : varHtml());
  }
  function varHtml() {
    return VAR.list.map(function (sp, i) {
      return '<div class="dw-prop"><div><b>' + (i + 1) + '. ' + esc(varName(sp)) + '</b><small>' + ['melodia', 'accordi', 'pad'].map(function (r) { return sp.inst[r] ? instName(sp.inst[r]) : ''; }).filter(Boolean).join(' · ') + ' · kit ' + esc(SynthDesign.KITS[sp.kit].nome) + (sp.fxNames && sp.fxNames.length ? '<br>🎬 ' + esc(sp.fxNames.join(', ')) : '') + '</small></div><button class="btn sm" data-vp="' + i + '">▶</button><button class="btn sm pri" data-vu="' + i + '">Usa</button></div>';
    }).join('');
  }
  function varClick(e) {
    var b = e.target.closest('button'); if (!b) return;
    var cnt = +(($('#dw-var-n') || {}).value || 8);
    if (b.id === 'dw-var-same') { var ss = []; for (var q = 0; q < cnt; q++) ss.push(varSpec(cur().prod.genre, true)); varMake('', ss); } else if (b.id === 'dw-var-other') { var vs = ($('#dw-var-style') || {}).value || '';
      if (vs.slice(0, 2) === 'f:' && folderProf(vs.slice(2))) varMake('', learnSpecs2(folderProf(vs.slice(2)), cnt));
      else if (vs.slice(0, 2) === 'a:') varMake('', StylePresets.pickMany(cnt, null, Date.now() % 1e9, vs.slice(2)));
      else varMake('', StylePresets.pickMany(cnt, textWeights(), Date.now() % 1e9)); }
    if (b.getAttribute('data-atm')) { varMake('', StylePresets.pickMany(cnt, null, Date.now() % 1e9, b.getAttribute('data-atm'))); $('#dw-var-msg').textContent = 'Compongo varianti ' + StylePresets.byId(b.getAttribute('data-atm')).nome + '…'; }
    var vp = b.getAttribute('data-vp'), vu = b.getAttribute('data-vu');
    if (vp != null) { var s1 = VAR.list[+vp]; dwStop(true); playBuf(s1.mix, s1.sr); $('#dw-var-msg').textContent = 'Ascolti: ' + varName(s1); }
    if (vu != null) {
      var s2 = VAR.list[+vu], p = cur().prod, changed = p.genre !== s2.genre; stopPlay();
      p.genre = s2.genre; p.bpm = s2.bpm; p.seed = s2.seed; p.inst = Object.assign({}, s2.inst); p.kit = s2.kit; p.arpPattern = s2.arpPattern; if (changed) { p.mix = null; p.groove = null; p.prog = null; p.tune = null; } p.atmNome = s2.nome || null; if (s2.groove) p.groove = s2.groove; if (s2.prog) p.prog = s2.prog; if (s2.mode) p.mode = s2.mode; if (s2.tonic != null) p.tonic = s2.tonic; if (s2.tune) p.tune = s2.tune; if (s2.bassStyle !== undefined) p.bassStyle = s2.bassStyle;
      coachRec('like', { genre: s2.genre, mode: p.mode, bpm: s2.bpm, inst: s2.inst }); fillInst(); fillBase(); dwFill(); dwChanged(true); projLine();
      $('#dw-var-msg').textContent = 'Usata: ' + varName(s2) + '. Ora la puoi modificare traccia per traccia.';
      if (e.currentTarget && e.currentTarget.id === 'dw-p-learn') { dwWs('base'); window.scrollTo(0, 0); }
    }
  }
  $('#dw-p-var').addEventListener('click', varClick);
  $('#dw-p-learn').addEventListener('click', function (e) { if (e.target.closest('[data-vp],[data-vu]')) varClick(e); });
  // proposte automatiche dopo aver imparato una canzone: stile, ritmo, giro armonico e tempo misurati, strumenti nostri
  // quanto ogni stile base si adatta al testo (cervello Sultan dell'altra chat: punteggi per genere)
  /* Collegatore: lo stile scelto (una tua cartella imparata dai video, o un'atmosfera) guida sia i TESTI sia le BASI.
     - cartella: accende la cartella testi con lo stesso nome (il Cervello scrive e sceglie più vicino a quell'artista)
       e, dopo "crea dal testo", mette ritmo, giro, velocità e tonalità imparati dalle canzoni della cartella;
     - atmosfera: strumenti, kit e velocità di quell'atmosfera. La forma della canzone e gli effetti restano del TUO testo. */
  function refSet(v) {
    LIB.settings.varStyle = v || ''; var st = arStore();
    if (v && v.slice(0, 2) === 'f:') { var nm = v.slice(2); Object.keys(st).forEach(function (k) { st[k].on = k === nm; }); }
    persist(); varStyleRender();
  }
  function refApply() {
    var v = LIB.settings.varStyle || '', p = cur().prod, m = $('#sb-msg'); if (!v) return;
    if (v.slice(0, 2) === 'f:') {
      var fp = folderProf(v.slice(2)); if (!fp) return; var kick = fp.kick && fp.kick.length ? fp.kick : [0], kb = kick.slice(); if (kb.length > 1) kb[kb.length - 1] = Math.min(15, kb[kb.length - 1] + 1); else kb.push(10);
      p.bpm = Math.max(60, Math.min(180, fp.bpm || p.bpm)); if (fp.key) { p.mode = fp.key.mode; p.tonic = fp.key.tonic; } if (fp.prog && fp.prog.length) p.prog = fp.prog;
      p.groove = { kickPats: [[kick, kb]], snare: fp.snare, swing: fp.swing || 0, rolls: Math.max(0, Math.min(1, (fp.triplets || 0) * 1.2 + ((fp.hatDensity || 0.5) - 0.5) * 0.6)) };
      var pr = StylePresets.LIST.filter(function (x) { var a = v.slice(2).toLowerCase().replace(/[^a-z0-9]/g, ''); return a.length >= 3 && (x.id + x.nome).toLowerCase().replace(/[^a-z0-9]/g, '').indexOf(a) >= 0; })[0];
      if (pr) { var va = StylePresets.variant(pr, p.seed || 1); p.inst = va.inst; p.kit = va.kit; }
      p.atmNome = 'Stile ' + v.slice(2) + ' (' + fp.count + (fp.count === 1 ? ' canzone' : ' canzoni') + ')';
      if (m) m.textContent += ' · Suono dallo stile ' + v.slice(2) + ': ' + p.bpm + ' BPM, ritmo e giro imparati dalle tue canzoni.';
    } else if (v.slice(0, 2) === 'a:') {
      var pa = StylePresets.byId(v.slice(2)); if (!pa) return; var vb = StylePresets.variant(pa, p.seed || 1);
      if (Arranger.STYLES[vb.genre]) p.genre = vb.genre; p.bpm = vb.bpm; p.inst = vb.inst; p.kit = vb.kit; p.arpPattern = vb.arpPattern; p.prog = vb.prog; p.tune = vb.tune; p.atmNome = vb.nome;
      if (m) m.textContent += ' · Suono: ' + vb.nome + '.';
    }
    try { fillInst(); fillBase(); dwFill(); } catch (e) {} dwChanged(true); projLine();
  }
  function varStyleRender() {
    var sel = $('#dw-var-style'); if (!sel) return; var v = LIB.settings.varStyle || sel.value || '';
    var folders = learnArtists().filter(function (a) { return a !== 'Senza cartella' && folderProf(a); });
    sel.innerHTML = '<option value="">Lo decide il mio testo</option>' + (folders.length ? '<optgroup label="Le mie cartelle (imparate)">' + folders.map(function (a) { return '<option value="f:' + esc(a) + '">' + esc(a) + ' (' + folderProf(a).count + ')</option>'; }).join('') + '</optgroup>' : '') +
      '<optgroup label="Atmosfere">' + StylePresets.LIST.map(function (p) { return '<option value="a:' + p.id + '">' + esc(p.nome.replace(/^Tipo /, '')) + '</option>'; }).join('') + '</optgroup>';
    sel.value = v; if (sel.value !== v) sel.value = '';
    var r2 = $('#dw-ref'); if (r2) { r2.innerHTML = sel.innerHTML; r2.value = sel.value; }
  }
  function textWeights() {
    var s0 = cur(); if (!(s0.lyrics || '').trim()) return null; if (!window.SultanBrain) return pfImageWeights(s0.lyrics, null);
    try { var pl = SultanBrain.plan(s0.lyrics, analysisOf(s0), {}), sc = pl.scores || {}, mx = Math.max.apply(null, Object.keys(sc).map(function (k) { return sc[k]; }).concat([1])), w = {};
      Object.keys(sc).forEach(function (k) { w[k] = 0.4 + 2.6 * Math.max(0, sc[k]) / mx; }); w.cloud = w.cloud || w.trapdark; w.brooklyn = w.brooklyn || w.drill; w.rnb = w.rnb || w.melodico; w.emorap = w.emorap || w.trap; w.plugg = w.plugg || w.trap; w.reggaeton = w.reggaeton || w.estate; w.afrotrap = w.afrotrap || w.estate; w.rage = w.rage || w.clubtrap; w.jersey = w.jersey || w.clubtrap; return pfImageWeights(s0.lyrics, w); } catch (e) { return null; }
  }
  /* le immagini del testo (strada, polizia, soldi, motori, fede, lacrime…) spingono gli stili adatti */
  function pfImageWeights(txt, w) {
    var B = { strada: ['drill', 'street', 'trapdark', 'brooklyn'], polizia: ['drill', 'street', 'brooklyn', 'trapdark'], spari: ['drill', 'brooklyn', 'street'], raffica: ['drill', 'brooklyn'], motori: ['trap', 'clubtrap', 'plugg', 'rage'], 'auto in corsa': ['trap', 'clubtrap', 'phonk'], soldi: ['trap', 'clubtrap', 'plugg'], volo: ['trap', 'cloud', 'plugg'], fede: ['melodico', 'emorap', 'epico'], 'pioggia/lacrime': ['emorap', 'melodico', 'cloud', 'rnb'], ricordi: ['lofi', 'boombap', 'melodico'], cuore: ['rnb', 'melodico', 'emorap'], palco: ['clubtrap', 'rage', 'jersey'], mare: ['estate', 'afrotrap', 'reggaeton'], 'colpo forte': ['trapdark', 'epico', 'drill'], temporale: ['trapdark', 'epico', 'cloud'] };
    var cnt = {}, n = 0; String(txt || '').split(/\n/).forEach(function (l) { if (!l.trim() || /^\[/.test(l.trim())) return; n++; ProdFx.readLine(l).hits.forEach(function (h) { cnt[h.why] = (cnt[h.why] || 0) + 1; }); });
    if (!n) return w; w = w || {}; Object.keys(Arranger.STYLES).forEach(function (g) { if (w[g] == null) w[g] = 1; });
    Object.keys(cnt).forEach(function (k) { (B[k] || []).forEach(function (g) { if (w[g] != null) w[g] *= 1 + Math.min(1.5, cnt[k] * 0.45); }); });
    return w;
  }
  /* proposte FEDELI a quello che ha imparato: atmosfere dello stesso stile e velocità vicina, stesso giro, stessa tonalità,
     stessa cassa/rullante/swing/densità hi-hat. Solo numeri della canzone, nessun suono copiato. */
  function learnSpecs2(prof, n) {
    n = n || 12;
    var near = { trap: ['trap', 'trapdark', 'plugg', 'emorap', 'cloud'], drill: ['drill', 'brooklyn', 'trapdark', 'street'], melodico: ['melodico', 'rnb', 'emorap', 'cloud', 'lofi'], estate: ['estate', 'afrotrap', 'reggaeton', 'clubtrap'], epico: ['epico', 'cloud', 'trapdark'] }[prof.style] || ['trap'];
    var bpm = prof.bpm || 120, dark = (prof.bright || 0.5) < 0.45, mode = prof.key ? prof.key.mode : null;
    function bd(b) { return Math.min(Math.abs(b - bpm), Math.abs(b / 2 - bpm), Math.abs(b * 2 - bpm)); }
    var DARK = /scur|dark|drill|street|cupa|pesante|cinema/i;
    var ranked = StylePresets.LIST.map(function (pr) {
      var sc = (near.indexOf(pr.base) === 0 ? 5 : near.indexOf(pr.base) > 0 ? 3 : 0) - bd(pr.bpm) / 6 + (mode && pr.mode === mode ? 1.5 : 0) + (dark === DARK.test(pr.spiega + pr.nome) ? 1 : 0);
      var an = String(prof.artist || '').toLowerCase().replace(/[^a-z0-9]/g, ''), pn = (pr.id + pr.nome).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (an.length >= 3 && pn.indexOf(an) >= 0) sc += 20; // la cartella ha il nome di un'atmosfera che conosco: quella guida
      return { pr: pr, sc: sc + Math.random() * 0.8 };
    }).sort(function (a, b) { return b.sc - a.sc; }).slice(0, Math.max(3, Math.ceil(n / 2)));
    if (ranked[0].sc >= 15) { var hit = ranked[0], rest = ranked.slice(1); ranked = []; for (var z = 0; z < Math.ceil(n / 4); z++) ranked.push(hit); ranked = ranked.concat(rest).slice(0, Math.max(3, Math.ceil(n / 2))); } // metà delle basi sull'atmosfera dell'artista
    var kick = prof.kick && prof.kick.length ? prof.kick : [0], kb = kick.slice(); if (kb.length > 1) kb[kb.length - 1] = Math.min(15, kb[kb.length - 1] + 1); else kb.push(10);
    var out = []; ranked.forEach(function (r, k) { for (var q = 0; q < 2; q++) {
      var v = StylePresets.variant(r.pr, Math.floor(Math.random() * 1e9));
      v.bpm = Math.round(Math.max(60, Math.min(180, bpm + (q ? 0 : (k % 3 - 1))))); v.mode = mode || v.mode; v.tonic = prof.key ? prof.key.tonic : undefined;
      if (prof.prog && prof.prog.length) v.prog = prof.prog;
      v.groove = { kickPats: [[kick, kb]], snare: prof.snare, swing: prof.swing || 0, rolls: Math.max(0, Math.min(1, (prof.triplets || 0) * 1.2 + ((prof.hatDensity || 0.5) - 0.5) * 0.6)) };
      v.tune = Object.assign({}, v.tune || {}, { hat: 0.7 + (prof.hatDensity || 0.5) * 0.7 });
      v.nome = prof.artist ? 'Stile ' + prof.artist + ' · ' + (out.length + 1) + ' (' + r.pr.nome.replace(/^Tipo /, '').replace(/ \(.*\)$/, '') + ')' : v.nome + ' · dalla canzone'; out.push(v);
    } });
    return out.slice(0, n);
  }
  function learnSpecs(prof) {
    var g = Arranger.STYLES[prof.style] ? prof.style : 'trap', out = [];
    var near = { trap: ['trap', 'trapdark', 'plugg'], drill: ['drill', 'brooklyn', 'trapdark'], melodico: ['melodico', 'rnb', 'emorap'], estate: ['estate', 'afrotrap', 'reggaeton'], epico: ['epico', 'cloud', 'trapdark'] }[g] || [g];
    var kick = prof.kick && prof.kick.length ? prof.kick : [0], kb = kick.slice(); if (kb.length > 1) kb[kb.length - 1] = Math.min(15, kb[kb.length - 1] + 1); else kb.push(10);
    for (var i = 0; i < 6; i++) { var sp = varSpec(near[i % near.length], false); sp.bpm = Math.max(60, Math.min(180, prof.bpm + (i % 3 - 1) * 2)); sp.mode = prof.key ? prof.key.mode : 'minore';
      sp.groove = { kickPats: [[kick, kb]], snare: prof.snare, swing: prof.swing || 0, rolls: Math.max(0, Math.min(1, (prof.triplets || 0) * 1.2 + ((prof.hatDensity || 0.5) - 0.5) * 0.6)) }; sp.prog = prof.prog || undefined; out.push(sp); }
    return out;
  }
  // ---------- Ispettore della traccia: un tocco sulla traccia → Suono · Note · Canale ----------
  var INSP = { lane: null, tab: 'suono' };
  var LANE_NOTES = { lead: 'lead', bass: 'bass', drums: 'drums', chords: 'chords', arp: 'chords', pad: 'chords' };
  (function () { // pannelli piano roll e mixer dentro l'ispettore (stessi controlli, un posto solo)
    $('#dw-in-note').appendChild($('#dw-p-roll')); $('#dw-in-canale').appendChild($('#dw-p-mixer'));
    $('#dw-pr-tr').hidden = true; $('#dw-mx-lanes').hidden = true; document.body.appendChild($('#dw-insp'));
  })();
  function inspSuono(L) {
    var p = cur().prod, inst = p.inst || {}, h = '';
    if (L.role) h = '<p class="small">Suono: <b>' + esc(inst[L.role] ? instName(inst[L.role]) : 'Sintetizzato') + '</b></p><div class="row"><button class="btn pri" data-ins="choose">Cambia suono</button><button class="btn" data-ins="lib">Crea un suono tuo</button></div>';
    else if (L.id === 'drums') h = '<p class="small" style="margin:0 0 6px">Kit:</p><div class="chips">' + [['', 'Campioni veri']].concat(Object.keys(SynthDesign.KITS).map(function (k) { return [k, SynthDesign.KITS[k].nome]; })).map(function (k) { return '<button class="chip' + ((p.kit || '') === k[0] ? ' on' : '') + '" data-kit="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div><p class="small">Batteria: <b>' + (p.kit && SynthDesign.KITS[p.kit] ? SynthDesign.KITS[p.kit].nome : (p.sounds === 'sint' ? 'sintetica' : 'campioni veri')) + '</b>' + (p.perc ? ' · percussioni: ' + esc(SynthDesign.PERC[p.perc.type].nome) : '') + '</p><div class="row"><button class="btn pri" data-ins="drumsnd">Passa a ' + (p.sounds === 'sint' ? 'campioni veri' : 'sintetica') + '</button><button class="btn" data-ins="perc">Percussioni del mondo</button></div>';
    else if (L.id === 'bass') h = '<p class="small">Basso: <b>' + (p.b808 ? '808 tuo (designer)' : (p.bassStyle === '808' ? '808' : 'dallo stile')) + '</b></p><div class="row"><button class="btn pri" data-ins="808">Disegna il tuo 808</button><button class="btn" data-ins="bassty">' + (p.bassStyle === '808' ? 'Basso dello stile' : 'Usa 808') + '</button></div>';
    else h = '<p class="small">' + (voiceTake() ? 'Prova attiva: <b>' + esc(voiceTake().name) + '</b>' : 'Nessuna voce registrata.') + '</p><div class="row"><button class="btn pri" data-ins="mic">Microfono e prove</button></div>';
    $('#dw-in-suono').innerHTML = h;
  }
  function inspTab(t) {
    INSP.tab = t; $$('#dw-in-tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-int') === t); });
    ['suono', 'note', 'canale'].forEach(function (k) { $('#dw-in-' + k).hidden = k !== t; });
    if (t === 'note') { PR.tr = LANE_NOTES[INSP.lane]; PR.sel = -1; prDraw(); }
    if (t === 'canale') { MIXUI.lane = INSP.lane; mixRender(); }
  }
  function inspOpen(id, tab) {
    var L = LANES.filter(function (x) { return x.id === id; })[0]; if (!L) return; if (L.fx || L.voxfx) { pfGo(); return; } INSP.lane = id;
    $('#dw-in-t').textContent = L.nome; $('#dw-in-dot').style.background = L.c;
    $('#dw-in-tabs [data-int="note"]').hidden = !LANE_NOTES[id];
    inspSuono(L); $('#dw-insp').hidden = false; inspTab(tab === 'note' && !LANE_NOTES[id] ? 'suono' : tab);
  }
  $('#dw-insp').addEventListener('click', function (e) {
    if (e.target === this || e.target.id === 'dw-in-x') { this.hidden = true; return; }
    var t = e.target.closest('[data-int]'); if (t) { inspTab(t.getAttribute('data-int')); return; }
    var kb = e.target.closest('[data-kit]'); if (kb) { var pk = cur().prod; if (kb.getAttribute('data-kit')) pk.kit = kb.getAttribute('data-kit'); else { delete pk.kit; pk.sounds = 'campioni'; } dwStop(); dwChanged(true); inspSuono(LANES[0]); return; }
    var b = e.target.closest('[data-ins]'); if (!b) return; var a = b.getAttribute('data-ins'), L = LANES.filter(function (x) { return x.id === INSP.lane; })[0], p = cur().prod;
    if (a === 'choose') sheetOpen(L.role);
    else if (a === 'lib' || a === 'perc' || a === '808') { this.hidden = true; DS.tab = a === 'perc' ? 'perc' : (a === '808' ? '808' : 'synth'); dwWs('libreria'); dsRender(); setTimeout(function () { $('#dw-p-design').scrollIntoView({ behavior: 'smooth' }); }, 50); }
    else if (a === 'drumsnd') { p.sounds = p.sounds === 'sint' ? 'campioni' : 'sint'; fillBase(); dwStop(); dwChanged(true); inspSuono(L); }
    else if (a === 'bassty') { p.bassStyle = p.bassStyle === '808' ? null : '808'; dwStop(); dwChanged(true); inspSuono(L); }
    else if (a === 'mic') { this.hidden = true; dwWs('voce'); }
  });
  $('#v-daw').addEventListener('click', function (e) { var b = e.target.closest('[data-next]'); if (!b) return; dwWs(b.getAttribute('data-next')); window.scrollTo(0, 0); });
  function projLine() { var p = cur().prod; $('#dw-proj-t').textContent = (p.atmNome || (Arranger.STYLES[p.genre] ? Arranger.STYLES[p.genre].label : p.genre)) + ' · ' + p.bpm + ' BPM · ' + NOTES[p.tonic] + ' ' + p.mode; }
  $('#dw-proj').addEventListener('click', function () { $('#dw-set').hidden = false; });
  $('#dw-set').addEventListener('click', function (e) { if (e.target === this || e.target.id === 'dw-set-x') { this.hidden = true; projLine(); } });
  document.body.appendChild($('#dw-set'));
  // spiegazioni nascoste: un "?" in ogni pannello le mostra
  $$('#v-daw .dw-panel .dw-ph').forEach(function (ph) { var b = document.createElement('button'); b.className = 'dw-help'; b.type = 'button'; b.textContent = '?'; b.setAttribute('aria-label', 'Spiegazione'); b.addEventListener('click', function () { ph.parentElement.classList.toggle('show-help'); }); ph.appendChild(b); });

  // ---------- Produzione: effetti da film e interventi vocali scelti dal testo (ProdFx), modificabili a mano ----------
  var ADLIB = { list: [] }, PF_HARD = { drill: 1, brooklyn: 1, trapdark: 1, rage: 1, phonk: 1, street: 1, trap: 1, jersey: 1, plugg: 1, detroit: 1, clubtrap: 1 };
  var PF_SIG = { sirena: 'sirena', spari: 'sparo', mitra: 'raffica', coro: 'corolirico' };
  function pfSig(p) { var pf = p.prodFx; if (!pf || !pf.on) return p.sig || []; var on = {}; (pf.events || []).forEach(function (e) { if (!e.off) on[e.snd] = 1; }); return (p.sig || []).filter(function (k) { return !on[PF_SIG[k]]; }); }
  function pfHash(str) { var h = 5381; for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; return h; }
  function pfPlan(force) {
    var s = cur(), p = s.prod; if (!p.prodFx) p.prodFx = { on: true, density: 1, events: [] }; var pf = p.prodFx;
    var k = pfHash((s.lyrics || '') + '|' + p.genre + '|' + p.seed + '|' + pf.density + '|' + ADLIB.list.length + '|' + (p.sig || []).join());
    if (force || (!pf.manual && pf.key !== k)) {
      var map = null; try { map = songMap(); } catch (e) {}
      var r = ProdFx.plan(map, { genre: p.genre, seed: p.seed, density: pf.density, adlibs: ADLIB.list.length, sig: p.sig || [] });
      pf.events = r.events; pf.themes = r.themes; pf.key = k; pf.seed = p.seed; pf.manual = false;
    } else pf.stale = pf.manual && pf.key !== k;
    return pf;
  }
  function pfKey(pf) { return pf ? (pf.on ? 1 : 0) + ':' + pfHash(JSON.stringify(pf.events || []) + ADLIB.list.map(function (a) { return a.id; }).join()) : ''; }
  function pfCount(t) { var pf = cur().prod.prodFx; return pf && pf.on ? (pf.events || []).filter(function (e) { return e.tipo === t && !e.off; }).length : 0; }
  function pfGo() { dwWs('base'); setTimeout(function () { var el = $('#dw-p-prod'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 60); }
  function pfName(e) { return e.tipo === 'sfx' ? (ProdFx.SOUNDS[e.snd] || {}).nome || e.snd : (ProdFx.VOX[e.snd] || {}).nome || e.snd; }
  function pfWhere(e) {
    var map = null; try { map = songMap(); } catch (x) {} var sec = '', b0 = 0;
    if (map) map.plan.some(function (q) { if (e.bar < b0 + q[1]) { sec = q[0]; return true; } b0 += q[1]; return false; });
    return (sec ? sec + ', ' : '') + 'battuta ' + (Math.floor(e.bar) + 1) + (e.bar % 1 ? '½' : '');
  }
  function pfChanged(manual) { var pf = cur().prod.prodFx; if (manual) pf.manual = true; DW.bufKey = ''; persist(); pfRender(); var was = DW.playing; dwStop(true); dwRefresh().then(function () { if (was) dwPlay(DW.from || 0); }); }
  function pfRender() {
    var el = $('#pf-list'); if (!el) return; var pf = pfPlan(), p = cur().prod;
    $('#pf-on').checked = !!pf.on; $('#pf-dens').value = String(pf.density);
    $('#pf-themes').innerHTML = (pf.themes && pf.themes.length ? 'Immagini trovate nel testo: <b>' + esc(pf.themes.slice(0, 8).join(', ')) + '</b>' : (cur().lyrics.trim() ? 'Nessuna immagine forte nel testo: metto solo transizioni e voci.' : 'Scrivi il testo: gli effetti nascono dalle tue parole.')) + (pf.stale ? ' · <b>Il testo è cambiato</b>: premi «L\'IA rilegge il testo» per riallineare.' : '') + (voiceTake() ? '' : '<br><span class="muted">Le voci di produzione (eco, cori, risposte) si sentono quando hai registrato la voce.</span>');
    el.innerHTML = (pf.events || []).map(function (e, i) {
      var ic = e.tipo === 'sfx' ? '🎬' : '🎤';
      return '<div class="dw-prop' + (e.off ? ' off' : '') + '" style="' + (e.off ? 'opacity:.45' : '') + '"><div><b>' + ic + ' ' + esc(pfName(e)) + '</b><small>' + esc(pfWhere(e)) + (e.why ? ' · ' + esc(e.why) : '') + '</small><input type="range" min="0" max="200" value="' + Math.round((e.gain == null ? 1 : e.gain) * 100) + '" data-pfr="' + i + '" aria-label="Volume" style="width:100%"></div>' +
        '<button class="btn sm" data-pfp="' + i + '" title="Ascolta nel brano">▶</button>' + (e.tipo === 'sfx' ? '<button class="btn sm" data-pfv="' + i + '" title="Un\'altra versione del suono">↻</button>' : '') + '<button class="btn sm" data-pfx="' + i + '" title="' + (e.off ? 'Riattiva' : 'Togli') + '">' + (e.off ? '+' : '✕') + '</button></div>';
    }).join('') || '<p class="small muted">Nessun intervento.</p>';
    var map = null; try { map = songMap(); } catch (x) {}
    $('#pf-add-snd').innerHTML = '<optgroup label="Effetti">' + Object.keys(ProdFx.SOUNDS).map(function (k) { return '<option value="s:' + k + '">' + esc(ProdFx.SOUNDS[k].nome) + '</option>'; }).join('') + '</optgroup><optgroup label="Voce">' + Object.keys(ProdFx.VOX).map(function (k) { return '<option value="v:' + k + '">' + esc(ProdFx.VOX[k].nome) + '</option>'; }).join('') + '</optgroup>';
    $('#pf-add-at').innerHTML = map ? map.lines.map(function (l, i) { return '<option value="' + i + '">Riga ' + (i + 1) + ': ' + esc(l.text.slice(0, 34)) + '</option>'; }).join('') : '<option value="">Scrivi prima il testo</option>';
    if (!$('#pf-lib').innerHTML) { var g = {}; Object.keys(ProdFx.SOUNDS).forEach(function (k) { var S = ProdFx.SOUNDS[k]; (g[S.gruppo] = g[S.gruppo] || []).push('<button class="chip" data-pfl="' + k + '">' + esc(S.nome) + '</button>'); }); $('#pf-lib').innerHTML = Object.keys(g).map(function (k) { return '<p class="small muted" style="margin:8px 0 4px">' + k + '</p><div class="chips">' + g[k].join('') + '</div>'; }).join(''); }
    pfAdRender();
  }
  function pfAdRender() { var el = $('#pf-ad-list'); if (!el) return; el.innerHTML = ADLIB.list.length ? ADLIB.list.map(function (a, i) { return '<div class="dw-prop"><div><b>' + esc(a.name) + '</b><small>' + (a.x.length / a.sr).toFixed(1) + ' s</small></div><button class="btn sm" data-pap="' + i + '">▶</button><button class="btn sm" data-pax="' + i + '">✕</button></div>'; }).join('') : '<p class="small muted">Nessun ad-lib. Registrane 3-6 (la tua voce): l\'IA li userà nei vuoti dopo le righe, con eco.</p>'; }
  $('#dw-p-prod').addEventListener('click', async function (e) {
    var b = e.target.closest('button'); if (!b) return; var pf = pfPlan(), m = $('#pf-msg'), a;
    if (b.id === 'pf-auto') { pf.manual = false; pfPlan(true); m.textContent = pf.events.length + ' interventi scelti dal testo. Premi ▶ su uno per sentirlo nel brano.'; pfChanged(false); return; }
    if (b.id === 'pf-add') {
      var v = $('#pf-add-snd').value, li = $('#pf-add-at').value, map = songMap(); if (!map || li === '') { m.textContent = 'Scrivi prima il testo.'; return; }
      var l = map.lines[+li], t = v.slice(0, 1) === 's' ? 'sfx' : 'vox', id = v.slice(2), S = ProdFx.SOUNDS[id], ev = { id: 'm' + Date.now(), tipo: t, snd: id, line: +li, gain: 1, why: 'messo da te' };
      if (t === 'sfx') { if (S.tipo === 'letto') { ev.bar = l.startBar; ev.dur = l.bars * 2; } else if (S.tipo === 'fine') { ev.bar = l.startBar; ev.dur = 1; } else ev.bar = l.startBar + l.bars - 0.25; }
      else { ev.bar = id === 'coro' || id === 'scura' || id === 'reverse' ? l.startBar : l.startBar + l.bars; ev.dur = l.bars; if (id === 'adlib') ev.pick = Math.floor(Math.random() * Math.max(1, ADLIB.list.length)); }
      pf.events.push(ev); pf.events.sort(function (x, y) { return x.bar - y.bar; }); m.textContent = 'Aggiunto: ' + pfName(ev) + ' (' + pfWhere(ev) + ').'; pfChanged(true); return;
    }
    if ((a = b.getAttribute('data-pfl'))) { var sn = ProdFx.sound(a, 32000, 1 + Math.floor(Math.random() * 999), { bpm: cur().prod.bpm, dur: 5, midi: 48 + cur().prod.tonic }); dwStop(true); playBuf(sn, 32000); m.textContent = 'Ascolti: ' + ProdFx.SOUNDS[a].nome; return; }
    if ((a = b.getAttribute('data-pfp')) != null) { var e1 = pf.events[+a], bs = 240 / cur().prod.bpm; dwStop(true); dwPlay(Math.max(0, e1.bar * bs - (e1.tipo === 'vox' ? 3 : 1.5))); m.textContent = 'Ascolti dal punto: ' + pfName(e1) + '.'; return; }
    if ((a = b.getAttribute('data-pfv')) != null) { var e2 = pf.events[+a]; e2.var = (e2.var || 0) + 1; m.textContent = 'Nuova versione di ' + pfName(e2) + '.'; pfChanged(true); return; }
    if ((a = b.getAttribute('data-pfx')) != null) { var e3 = pf.events[+a]; e3.off = !e3.off; pfChanged(true); return; }
    if ((a = b.getAttribute('data-pap')) != null) { var ad = ADLIB.list[+a]; dwStop(true); playBuf(ad.x, ad.sr); return; }
    if ((a = b.getAttribute('data-pax')) != null) { var ad2 = ADLIB.list.splice(+a, 1)[0]; await dbTake('del', ad2.id); pfAdRender(); pfChanged(false); return; }
    if (b.id === 'pf-ad-rec') {
      if (!micOk() || !window.MediaRecorder) { m.textContent = 'Microfono non disponibile qui: apri l\'app da Safari (sito) e consenti il microfono.'; return; }
      try {
        var st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }), mr = new MediaRecorder(st), ch = [];
        mr.ondataavailable = function (ev2) { if (ev2.data && ev2.data.size) ch.push(ev2.data); };
        var done = new Promise(function (res) { mr.onstop = res; }); mr.start(); m.textContent = '● Registro… dì il tuo ad-lib adesso'; b.disabled = true;
        setTimeout(function () { try { mr.stop(); } catch (x) {} }, 2000); await done; st.getTracks().forEach(function (tr) { tr.stop(); }); b.disabled = false;
        var ab = await new Blob(ch, { type: mr.mimeType || 'audio/mp4' }).arrayBuffer(), dec = await new Promise(function (res, rej) { getCtx().decodeAudioData(ab, res, rej); }), x = dec.getChannelData(0), sr = dec.sampleRate;
        var pk = 0, i0 = 0, i1 = x.length - 1, i; for (i = 0; i < x.length; i++) { var av = x[i] < 0 ? -x[i] : x[i]; if (av > pk) pk = av; }
        if (pk < 0.01) { m.textContent = 'Non ho sentito niente: riprova più vicino al microfono.'; return; }
        while (i0 < x.length && Math.abs(x[i0]) < pk * 0.08) i0++; while (i1 > i0 && Math.abs(x[i1]) < pk * 0.08) i1--;
        var y = new Float32Array(Math.max(1, i1 - i0 + Math.round(sr * 0.08))); for (i = 0; i < y.length; i++) y[i] = (x[i0 + i] || 0) * 0.8 / pk;
        var nm = ($('#pf-ad-name').value || 'ad-lib ' + (ADLIB.list.length + 1)).slice(0, 20), rec = { id: 'adlib-' + Date.now(), name: nm, mono: y, sr: sr, at: Date.now(), adlib: true };
        await dbTake('put', rec); ADLIB.list.push({ id: rec.id, name: nm, x: y, sr: sr }); $('#pf-ad-name').value = ''; m.textContent = 'Ad-lib «' + nm + '» salvato. L\'IA ora lo usa nei vuoti (premi «L\'IA rilegge» per rimetterli).'; pfAdRender(); pfChanged(false);
      } catch (err) { b.disabled = false; m.textContent = 'Non riesco a registrare: ' + ((err && err.message) || err); }
    }
  });
  $('#dw-p-prod').addEventListener('input', function (e) { var a = e.target.getAttribute('data-pfr'); if (a == null) return; var pf = pfPlan(); pf.events[+a].gain = +e.target.value / 100; clearTimeout(pfChanged.t); pfChanged.t = setTimeout(function () { pfChanged(true); }, 350); });
  $('#dw-p-prod').addEventListener('change', function (e) { var pf = pfPlan(); if (e.target.id === 'pf-dens') { pf.density = +e.target.value; pf.manual = false; pfPlan(true); pfChanged(false); } if (e.target.id === 'pf-on') { pf.on = e.target.checked; pfChanged(false); } });
  // iPhone: sblocca l'audio al primo tocco (Safari tiene l'audio spento finché non tocchi; con questo suona anche col silenzioso)
  /* iPhone: Safari sospende l'audio (blocco schermo, altra app, chiamata) e lo riattiva SOLO dentro un tocco.
     Per questo a OGNI tocco/click riattivo il contesto, prima di qualsiasi attesa (prima valeva solo il primo tocco). */
  var UNLOCKED = false;
  ['touchend', 'click', 'keydown'].forEach(function (ev) { document.addEventListener(ev, function () {
    var c = player.ctx; if (!c) c = getCtx(); if (!c) return;
    if (c.state !== 'running' && c.resume) { try { c.resume(); } catch (x) {} }
    if (!UNLOCKED) { UNLOCKED = true; try { var bf = c.createBuffer(1, 1, 22050), sn = c.createBufferSource(); sn.buffer = bf; sn.connect(c.destination); sn.start(0); } catch (x) {} }
  }, true); });
  /* se dopo aver premuto play l'audio è ancora fermo, lo dico (invece del silenzio senza spiegazione) */
  function audioCheck() { setTimeout(function () { var c = player.ctx; if (c && c.state !== 'running') { var m = 'Audio fermo (Safari: ' + c.state + '). Tocca lo schermo una volta e ripremi ▶. Se ancora niente: chiudi Safari e riaprilo.'; ['#dw-msg', '#b-status'].forEach(function (q) { var e = $(q); if (e) e.textContent = m; }); } }, 600); }
  SHOW.daw = function () { applyMoodBg(moodNow()); dwWs(dwWsName()); projLine(); aiRender(); atmRender(); try { pfRender(); } catch (e) {} verRender(); dwFill(); mixRender(); clipsRender(); dsRender(); mpRender(); talkRender(); setTimeout(prDraw, 400); micRender(); learnRender(); sepInfo(); agentsRender(); dwRefresh().then(function () { var k = SESSION.baseKey; if (AG.key !== k) { AG.key = k; agentsRun(); } }); };

  /* base importata */
  $('#ib-file').addEventListener('change', async function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var msg = $('#ib-msg'); msg.textContent = 'Leggo il file…'; await tick();
    try {
      var d = await decode(f); if (d.mono.length > 240 * d.sr) d.mono = d.mono.slice(0, 240 * d.sr);
      msg.textContent = 'Analizzo velocità e tonalità…'; await tick();
      var a = BaseAnalysis.analyze(d.mono, d.sr, { maxSeconds: 60 });
      SESSION.imported = { mono: d.mono, sr: d.sr, bpm: a.bpm, key: a.key, name: f.name }; SESSION.useImported = true;
      msg.textContent = 'Base importata: ' + f.name; $('#ib-off').hidden = false;
      var h = '<div class="meters" style="margin-top:10px">' + meter('Velocità', 'misurato', a.bpm ? fmt(a.bpm, 0) + ' BPM' : '—', a.bpm ? 'Stima: può risultare la metà o il doppio del vero tempo.' : 'Non riconosciuta.') +
        meter('Tonalità', 'misurato', a.key ? esc(a.key.name) : '—', a.key ? 'Affidabilità ' + a.key.confidence + '. Seconda ipotesi: ' + a.key.alternative.name + '.' : 'Non riconosciuta.') + '</div>';
      if (a.key || a.bpm) h += '<div class="row" style="margin-top:10px"><button class="btn sm" id="ib-use">Usa questi valori nella canzone</button></div>';
      $('#ib-out').innerHTML = h;
      var u = $('#ib-use'); if (u) u.addEventListener('click', function () { var p = cur().prod; if (a.bpm) p.bpm = Math.round(a.bpm); if (a.key) { p.tonic = a.key.tonic; p.mode = a.key.mode; } persist(); fillBase(); msg.textContent = 'Valori applicati.'; });
    } catch (err) { msg.textContent = 'Non riesco a leggere questo file. Prova WAV, MP3 o M4A.'; msg.className = 'status err'; }
    e.target.value = '';
  });
  $('#ib-off').addEventListener('click', function () { SESSION.useImported = false; this.hidden = true; $('#ib-msg').textContent = 'Uso di nuovo la base creata dal programma.'; });

  /* stile da riferimenti */
  SESSION.refs = SESSION.refs || [];
  function renderRefs() {
    $('#sc-list').innerHTML = SESSION.refs.map(function (r, i) {
      var c = r.card;
      return '<div class="note" style="margin-top:8px"><b>' + esc(c.name) + '</b> <span class="small muted">' + (c.bpm ? fmt(StyleCard.normBpm(c.bpm), 0) + ' BPM' : 'tempo n.d.') + ' · basso ' + Math.round(c.bassShare * 100) + '% · colpi/battuta ' + (c.onsetsPerBeat == null ? 'n.d.' : fmt(c.onsetsPerBeat, 1)) + ' · crescita ×' + fmt(c.lift, 1) + ' <i>(misurato)</i></span>' +
        '<label class="f"><span>Peso <b>' + r.w + '%</b></span><input type="range" min="0" max="100" value="' + r.w + '" data-ref="' + i + '"></label></div>';
    }).join('');
    $('#sc-row').hidden = !SESSION.refs.length; $('#sc-clear').hidden = !SESSION.refs.length;
    $$('#sc-list [data-ref]').forEach(function (el) { el.addEventListener('input', function () { SESSION.refs[+el.dataset.ref].w = +el.value; el.previousElementSibling.querySelector('b').textContent = el.value + '%'; }); });
  }
  $('#sc-file').addEventListener('change', async function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return; e.target.value = '';
    if (SESSION.refs.length >= 3) { $('#sc-msg').textContent = 'Massimo 3 riferimenti: svuota e ricomincia.'; return; }
    var msg = $('#sc-msg'); msg.className = 'status'; msg.textContent = 'Leggo e misuro…'; await tick();
    try {
      var d = await decode(f); await tick();
      var card = StyleCard.measure(d.mono, d.sr, { maxSeconds: 90, name: f.name.replace(/\.[^.]+$/, '').slice(0, 40) });
      SESSION.refs.push({ card: card, w: 50 }); renderRefs(); msg.textContent = 'Misurato: ' + card.name;
    } catch (err) { msg.textContent = 'Non riesco a leggere questo file. Prova WAV, MP3 o M4A.'; msg.className = 'status err'; }
  });
  $('#sc-clear').addEventListener('click', function () { SESSION.refs = []; renderRefs(); $('#sc-out').innerHTML = ''; $('#sc-msg').textContent = ''; });
  $('#sc-use').addEventListener('click', function () {
    var cards = SESSION.refs.map(function (r) { return r.card; }), ws = SESSION.refs.map(function (r) { return r.w; });
    if (ws.every(function (w) { return !w; })) ws = ws.map(function () { return 1; });
    var m = StyleCard.blend(cards, ws), pr = StyleCard.toParams(m), p = cur().prod;
    p.genre = pr.genre; if (pr.bpm) p.bpm = pr.bpm; if (pr.mode) p.mode = pr.mode; p.tune = pr.tune; p.bars = Math.max(p.bars, 32); p.seed = (p.seed || 1) + 1; SESSION.useImported = false; SESSION.baseKey = ''; persist(); fillBase();
    $('#sc-out').innerHTML = '<div class="note"><b>Stile mescolato</b> (ipotesi basata su misure, non una copia): ' + esc(pr.why.join(' ')) + ' Ora premi "Crea e ascolta" qui sopra: la base nasce da questi parametri, con melodie e accordi nuovi.</div>';
  });

  SHOW.studio = function () {
    var s = cur(); $('#st-title').value = s.title; $('#st-lyrics').value = s.lyrics; fillBase(); renderAnalysis(); renderGuide();
    $('#ib-off').hidden = !SESSION.useImported;
  };

  /* ================= AI Producer ================= */
  var CHAT = [], HIST = [];
  function chatPush(who, text) { CHAT.push({ who: who, text: text }); renderChat(); return CHAT[CHAT.length - 1]; }
  function renderChat() {
    if (!CHAT.length) CHAT.push({ who: 'ai', text: 'Dimmi cosa vuoi cambiare nella base, per esempio "più energia" o "basso più profondo". Applico la modifica e te la faccio ascoltare.' });
    var el = $('#p-chat'); el.innerHTML = CHAT.map(function (m) { return '<div class="msg ' + (m.who === 'me' ? 'me' : 'ai') + '">' + esc(m.text) + '</div>'; }).join(''); el.scrollTop = el.scrollHeight;
  }
  function renderHist() {
    $('#p-hist').innerHTML = HIST.length ? '<ul class="clean small">' + HIST.map(function (h, i) { return '<li><b>' + (i + 1) + '.</b> ' + esc(h.text) + '</li>'; }).join('') + '</ul>' : '<p class="empty">Ancora nessuna modifica.</p>';
    $('#p-undo').disabled = !HIST.length;
  }
  function snapshot(p) { return JSON.parse(JSON.stringify(p)); }
  async function producerGo(text) {
    text = (text || '').trim(); if (!text) return;
    var s = cur(), p = s.prod; chatPush('me', text);
    var r = ProducerActions.interpret(text, p);
    if (r.understood) {
      HIST.push({ text: text, before: snapshot(p) });
      ['bpm', 'mode', 'bassStyle', 'reverb', 'levels', 'sec', 'tonic', 'genre', 'tune'].forEach(function (k) { p[k] = r.state[k]; });
      if (r.variants) p.seed = 11;
      persist(); SESSION.baseKey = '';
      chatPush('ai', r.notes.join(' ') + (r.unsupported ? '\n' + r.unsupported : '') + '\nOra la ascolti.');
      renderHist(); $('#p-msg').textContent = 'Sto componendo…'; await tick();
      var mx = buildMix({ voice: false });
      playBuf(mx.samples, mx.sr, null); SESSION.baseMade = true; $('#p-msg').textContent = '';
      return;
    }
    var wants = /(cosa manca|consigl|arrangiament|miglior|suggeri|che ne pensi|manca)/i.test(text);
    if (sampleFn) {
      var m = chatPush('ai', 'Ci penso…');
      try {
        await ask('Sei un produttore musicale. ' + AI_RULES + '\n\nCanzone:\n' + songContext(s) + '\n\nRichiesta della persona: ' + text + '\nSe possibile, indica quale di questi comandi può provare: ' + ProducerActions.HELP.join('; ') + '.', function (t) { m.text = t; renderChat(); });
      } catch (e) { m.text = 'Non riesco a contattare Claude adesso. ' + localAdvice(s); renderChat(); }
    } else chatPush('ai', wants ? localAdvice(s) : 'Non ho capito questo comando. Posso fare: ' + ProducerActions.HELP.join('; ') + '.');
  }
  function localAdvice(s) {
    var a = analysisOf(s); if (!a) return 'Scrivi prima il testo in Studio: i consigli partono da lì.';
    var out = a.suggestions.slice(0, 3).map(function (x) { return '• (' + x.kind + ') ' + x.text; });
    var b = LyricsToBase.suggest(a, { tonic: s.prod.tonic }); out.push('• (ipotesi) ' + b.why.join(' '));
    return out.join('\n');
  }
  $('#p-go').addEventListener('click', function () { var v = $('#p-in').value; $('#p-in').value = ''; producerGo(v); });
  $('#p-in').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('#p-go').click(); } });
  $('#p-chips').innerHTML = ['Più energia', 'Più emozionante', 'Basso più profondo', 'Più cinematografica', 'Questa base è troppo vuota', 'Cosa manca a questa canzone?', 'Consigli sull\'arrangiamento'].map(function (c) { return '<button class="chip" data-chip="' + esc(c) + '">' + esc(c) + '</button>'; }).join('');
  $('#p-chips').addEventListener('click', function (e) { var c = e.target.getAttribute('data-chip'); if (c) producerGo(c); });
  $('#p-undo').addEventListener('click', function () {
    var h = HIST.pop(); if (!h) return; var p = cur().prod, b = h.before;
    ['bpm', 'mode', 'bassStyle', 'reverb', 'levels', 'sec', 'tonic', 'genre', 'tune'].concat(['seed']).forEach(function (k) { p[k] = b[k]; }); SESSION.baseKey = ''; persist();
    chatPush('ai', 'Annullato: "' + h.text + '".'); renderHist();
  });
  $('#p-var').innerHTML = ['A', 'B', 'C'].map(function (l, i) { return '<button class="btn" data-var="' + (21 + i) + '">Variante ' + l + '</button>'; }).join('');
  $('#p-var').addEventListener('click', async function (e) {
    var v = e.target.getAttribute('data-var'); if (!v) return;
    cur().prod.seed = +v; persist(); $('#p-msg').textContent = 'Sto componendo…'; await tick();
    var mx = buildMix({ voice: false }); playBuf(mx.samples, mx.sr, null); SESSION.baseMade = true; $('#p-msg').textContent = 'Variante ' + 'ABC'.charAt(+v - 21) + ' (melodia diversa, stessi accordi).';
  });
  $('#p-help').innerHTML = ProducerActions.HELP.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('');
  SHOW.producer = function () { renderChat(); renderHist(); };

  /* ================= Vocal Studio ================= */
  var RET = function (v) { return v <= 5 ? 'Robot' : v <= 50 ? 'Rapida' : v <= 120 ? 'Media' : 'Naturale'; };
  $('#v-tonic').innerHTML = NOTES.map(function (n, i) { return '<option value="' + i + '">' + n + '</option>'; }).join('');
  var sh = ''; for (var i = -12; i <= 12; i++) sh += '<option value="' + i + '"' + (i === 0 ? ' selected' : '') + '>' + (i === 0 ? 'Nessuno spostamento' : (i > 0 ? '+' : '') + i + ' semitoni') + '</option>'; $('#v-shift').innerHTML = sh;
  $('#v-str').addEventListener('input', function () { $('#v-sv').textContent = this.value + '%'; });
  function setAT(str, ret, vib) { $('#v-str').value = str; $('#v-ret').value = ret; $('#v-vib').value = vib; $('#v-sv').textContent = str + '%'; $('#v-rv').textContent = RET(ret); $('#v-vibv').textContent = vib + '%'; }
  $('#v-p-nat').addEventListener('click', function () { setAT(60, 80, 70); });
  $('#v-p-trap').addEventListener('click', function () { setAT(100, 0, 0); });
  $('#v-ret').addEventListener('input', function () { $('#v-rv').textContent = RET(+this.value); });
  $('#v-vib').addEventListener('input', function () { $('#v-vibv').textContent = this.value + '%'; });
  $('#v-gain').addEventListener('input', function () { $('#v-gv').textContent = this.value + '%'; });
  $('#v-off').addEventListener('input', function () { $('#v-offv').textContent = this.value + ' ms'; });

  async function addTake(mono, sr, name, example) {
    if (mono.length > 120 * sr) mono = mono.slice(0, 120 * sr);
    var res = AudioAnalysis.analyze(mono, sr, { maxSeconds: 120 });
    var t = { id: uid(), name: name, mono: mono, sr: sr, res: res, key: KeyDetect.detect(res.frames), final: null, example: !!example };
    SESSION.takes.push(t); SESSION.takeId = t.id; return t;
  }
  $('#v-file').addEventListener('change', async function (e) {
    var files = Array.prototype.slice.call(e.target.files || []); if (!files.length) return;
    var msg = $('#v-msg'); msg.className = 'status';
    for (var i = 0; i < files.length; i++) {
      msg.textContent = 'Leggo e analizzo ' + files[i].name + '…'; await tick();
      try { var d = await decode(files[i]); var nt = await addTake(d.mono, d.sr, files[i].name, false); nt.at = Date.now(); dbTake('put', { id: nt.id, name: nt.name, mono: nt.mono, sr: nt.sr, lat: 0, at: nt.at }); }
      catch (err) { msg.textContent = 'Non riesco a leggere "' + files[i].name + '". Prova con un file M4A, MP3 o WAV.'; msg.className = 'status err'; e.target.value = ''; renderTakes(); return; }
    }
    msg.textContent = files.length + ' registrazion' + (files.length === 1 ? 'e importata.' : 'i importate.'); e.target.value = '';
    var s = cur(); if (['idea', 'testo', 'base'].indexOf(s.status) !== -1) { s.status = 'voce'; persist(); }
    selectTake(SESSION.takeId);
  });
  $('#v-demo').addEventListener('click', async function () { var sr = 22050; await addTake(AudioAnalysis.synthExample(sr), sr, 'Segnale di esempio (non è una voce)', true); selectTake(SESSION.takeId); });

  /* ===== Registrazione con il microfono vero (solo nella versione app; dentro Claude il microfono è bloccato) ===== */
  var REC = null, TDB = null;
  function micOk() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
  function tdb() {
    if (TDB) return TDB;
    TDB = new Promise(function (res) {
      try {
        var rq = indexedDB.open('msa-takes', 1);
        rq.onupgradeneeded = function () { rq.result.createObjectStore('takes', { keyPath: 'id' }); };
        rq.onsuccess = function () { res(rq.result); }; rq.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
    return TDB;
  }
  async function dbTake(op, rec) {
    try {
      var db = await tdb(); if (!db) return null;
      return await new Promise(function (res) {
        var tx = db.transaction('takes', op === 'all' ? 'readonly' : 'readwrite'), st = tx.objectStore('takes'), r;
        if (op === 'put') r = st.put(rec); else if (op === 'del') r = st.delete(rec); else if (op === 'clear') r = st.clear(); else r = st.getAll();
        tx.oncomplete = function () { res(r && r.result !== undefined ? r.result : true); }; tx.onerror = function () { res(null); };
      });
    } catch (e) { return null; }
  }
  async function restoreTakes() {
    var all = await dbTake('all'); if (!all || !all.length) return;
    ADLIB.list = all.filter(function (r) { return r.adlib; }).map(function (r) { return { id: r.id, name: r.name, x: r.mono, sr: r.sr }; }); all = all.filter(function (r) { return !r.adlib; }); try { pfAdRender(); } catch (e) {}
    all.sort(function (x, y) { return (x.at || 0) - (y.at || 0); });
    for (var i = Math.max(0, all.length - 8); i < all.length; i++) {
      var r = all[i]; if (SESSION.takes.some(function (t) { return t.id === r.id; })) continue;
      var res = AudioAnalysis.analyze(r.mono, r.sr, { maxSeconds: 120 });
      SESSION.takes.push({ id: r.id, name: r.name, mono: r.mono, sr: r.sr, res: res, key: KeyDetect.detect(res.frames), final: null, example: false, lat: r.lat || 0, at: r.at, saved: true });
      await tick();
    }
    if (SESSION.takes.length && !SESSION.takeId) SESSION.takeId = SESSION.takes[SESSION.takes.length - 1].id;
    renderTakes();
  }
  function recUi(on) { $('#rec-go').hidden = on; $('#rec-stop').hidden = !on; $('#rec-meter').hidden = !on; }
  $('#rec-go').addEventListener('click', function () { startRec(false); });
  $('#rec-live').addEventListener('click', function () { startRec(true); });
  async function startRec(live) {
    var msg = $('#rec-msg'); msg.className = 'status'; if (REC) return;
    $('#rec-live-box').hidden = !live && $('#rec-live-box').hidden;
    if (!micOk()) { msg.textContent = 'Il microfono non è disponibile in questa pagina (se hai toccato un link dentro Claude, copialo e aprilo in Safari) (dentro Claude è bloccato). Apri il sito: https://sultan199777.github.io/ai-music-studio/ (da Safari), oppure registra con Memo Vocali e importa in Voce.'; msg.className = 'status err'; return; }
    var ctx = getCtx(); if (!ctx || !ctx.createScriptProcessor) { msg.textContent = 'Questo browser non supporta la registrazione.'; msg.className = 'status err'; return; }
    if (!lyricLines(cur().lyrics).length) { msg.textContent = 'Nota: qui non c\'è ancora il testo di questa canzone. Incollalo nel campo "Testo" in alto in questa pagina per vederlo scorrere mentre canti. Chiedo il microfono…'; } else msg.textContent = 'Chiedo il permesso del microfono…';
    var stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } }); }
    catch (e) { var inApp = /iPhone|iPad/.test(navigator.userAgent) && !/Safari\//.test(navigator.userAgent); msg.textContent = (inApp ? 'Stai aprendo la pagina dentro un\'altra app (es. Claude): lì il microfono è bloccato. Copia il link e incollalo in Safari. ' : 'Il microfono non parte. ') + 'Dettaglio tecnico: ' + (e && e.name ? e.name : 'errore') + '. Su iPhone: Impostazioni > Safari > Microfono, poi riapri la pagina e consenti.'; msg.className = 'status err'; return; }
    msg.textContent = 'Preparo la base…'; await tick();
    var mx = buildMix({ voice: false }), mic = ctx.createMediaStreamSource(stream), chunks = [], R = { stream: stream, mic: mic, chunks: chunks, ctx: ctx, level: 0, started: ctx.currentTime };
    // Registratore nativo (MediaRecorder): lavora fuori dalla grafica, quindi niente buchi ("sgretolio")
    // quando il testo scorre. Il misuratore usa un Analyser, che non tocca la registrazione.
    var rtypes = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'], rmime = window.MediaRecorder ? rtypes.filter(function (t) { return MediaRecorder.isTypeSupported(t); })[0] : null;
    var an = ctx.createAnalyser(); an.fftSize = 1024; mic.connect(an); R.an = an; R.abuf = new Float32Array(an.fftSize);
    if (rmime) {
      R.mr = new MediaRecorder(stream, { mimeType: rmime, audioBitsPerSecond: 256000 }); R.mime = rmime;
      R.mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      R.mrStopped = new Promise(function (res) { R.mr.onstop = res; });
      R.mr.start(); R.recAt = ctx.currentTime;
    } else { // vecchio metodo, solo se il registratore nativo manca
      var proc = ctx.createScriptProcessor(4096, 1, 1), mute = ctx.createGain(); mute.gain.value = 0; R.proc = proc; R.mute = mute;
      proc.onaudioprocess = function (ev) { chunks.push(new Float32Array(ev.inputBuffer.getChannelData(0))); };
      mic.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
    }
    if (live) {
      if (!window.VoiceLab || !rmime) { msg.textContent = 'Mic 2 non è disponibile su questo browser: uso la registrazione pulita.'; }
      else {
        try { R.live = await VoiceLab.liveAttach(ctx, mic); } catch (e) { R.live = null; }
        if (R.live) {
          R.wchunks = []; R.wmr = new MediaRecorder(R.live.wetStream, { mimeType: rmime, audioBitsPerSecond: 256000 });
          R.wmr.ondataavailable = function (e) { if (e.data && e.data.size) R.wchunks.push(e.data); };
          R.wStopped = new Promise(function (res) { R.wmr.onstop = res; }); R.wmr.start();
        } else msg.textContent = 'Non riesco ad accendere l\'autotune dal vivo: registro solo la voce pulita.';
      }
    }
    REC = R; recUi(true);
    var kt = karaokeTick(mx.bpm, '#rec-kar');
    var ok = playBuf(mx.samples, mx.sr, function (t) { kt(t); R.an.getFloatTimeDomainData(R.abuf); var m = 0; for (var ai = 0; ai < R.abuf.length; ai++) { var av = R.abuf[ai] < 0 ? -R.abuf[ai] : R.abuf[ai]; if (av > m) m = av; } R.level = m; $('#orb').style.setProperty('--lvl', Math.min(1, m * 1.6).toFixed(2)); $('#rec-meter i').style.width = Math.min(100, Math.round(m * 140)) + '%'; $('#rec-meter').classList.toggle('hot', m > 0.95); }, function () { finishRec(); });
    R.delta = Math.max(0, (player.t0 || R.started) - (R.recAt != null ? R.recAt : R.started)); R.lat = (ctx.baseLatency || 0) + (ctx.outputLatency || 0);
    if (!ok) { finishRec(); return; }
    msg.textContent = live && R.live ? 'Registro con autotune dal vivo (' + (R.live.mode === 'worklet' ? 'AudioWorklet' : 'modo di riserva') + ', ritardo di calcolo circa ' + Math.round(R.live.latencyMs) + ' ms). Cuffie con filo!' : 'Registro. Usa le cuffie, altrimenti la base entra nel microfono.';
  }
  $('#h-mic1').addEventListener('click', function () { location.hash = '#voce'; startRec(false); });
  $('#h-mic2').addEventListener('click', function () { location.hash = '#voce'; startRec(true); });
  $('#rec-stop').addEventListener('click', stopPlay);
  async function finishRec() {
    var R = REC; if (!R) return; REC = null;
    var msg = $('#rec-msg'), mono, sr;
    if (R.mr) { try { if (R.mr.state !== 'inactive') R.mr.stop(); await R.mrStopped; } catch (e) {} }
    if (R.wmr) { try { if (R.wmr.state !== 'inactive') R.wmr.stop(); await R.wStopped; } catch (e) {} }
    if (R.live) { try { R.live.stop(); } catch (e) {} }
    try { R.mic.disconnect(); if (R.proc) { R.proc.disconnect(); R.mute.disconnect(); R.proc.onaudioprocess = null; } } catch (e) {}
    R.stream.getTracks().forEach(function (t) { t.stop(); }); recUi(false);
    $('#rec-kar').innerHTML = '<div><b>Registrazione finita</b></div>'; $('#orb').style.setProperty('--lvl', 0);
    if (R.mr) {
      try { var dd = await decode(new Blob(R.chunks, { type: R.mime })); mono = dd.mono; sr = dd.sr; }
      catch (e) { msg.textContent = 'Non riesco a leggere la registrazione (' + (e && e.name || 'errore') + '). Riprova.'; msg.className = 'status err'; return; }
    } else {
      var n = 0; R.chunks.forEach(function (c) { n += c.length; }); sr = R.ctx.sampleRate;
      mono = new Float32Array(n); var o = 0; R.chunks.forEach(function (c) { mono.set(c, o); o += c.length; });
    }
    var n = mono.length;
    if (n < sr * 0.8) { msg.textContent = 'Registrazione troppo corta: riprova.'; return; }
    var pk = 0; for (var i = 0; i < n; i += 7) { var v = mono[i] < 0 ? -mono[i] : mono[i]; if (v > pk) pk = v; }
    var boosted = false;
    if (pk > 0.003 && pk < 0.3) { var gk = 0.7 / pk; for (var q = 0; q < n; q++) mono[q] *= gk; boosted = true; }
    msg.textContent = 'Analizzo la registrazione…'; await tick();
    var name = 'Registrazione ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    if (R.wchunks && R.wchunks.length) {
      try {
        var wd = await decode(new Blob(R.wchunks, { type: R.mime })), wm = wd.mono, wp = 0; for (var wi = 0; wi < wm.length; wi += 7) { var wv = wm[wi] < 0 ? -wm[wi] : wm[wi]; if (wv > wp) wp = wv; }
        if (wp > 0.003 && wp < 0.3) { var wg = 0.7 / wp; for (var wq = 0; wq < wm.length; wq++) wm[wq] *= wg; }
        var wt = await addTake(wm, wd.sr, name + ' · Mic 2 live', false); wt.lat = R.delta + R.lat; wt.at = Date.now();
        dbTake('put', { id: wt.id, name: wt.name, mono: wt.mono, sr: wt.sr, lat: wt.lat, at: wt.at }).then(function (ok) { wt.saved = !!ok; });
      } catch (e) {}
    }
    var t = await addTake(mono, sr, name + (R.wchunks ? ' · pulita' : ''), false); t.lat = R.delta + R.lat; t.at = Date.now();
    dbTake('put', { id: t.id, name: t.name, mono: t.mono, sr: t.sr, lat: t.lat, at: t.at }).then(function (ok) { t.saved = !!ok; });
    var s = cur(); if (['idea', 'testo', 'base'].indexOf(s.status) !== -1) { s.status = 'voce'; persist(); }
    selectTake(t.id);
    if (!SESSION.useImported) coachRec('record', coachCtx());
    setTimeout(function () { coachCheck(true); }, 300);
    msg.innerHTML = (pk <= 0.003 ? 'Non ho sentito quasi nulla: controlla che il microfono non sia coperto e che le cuffie abbiano il microfono. ' : (boosted ? 'Il volume era basso: l\'ho alzato automaticamente (picco originale ' + Math.round(pk * 100) + '%). ' : (pk > 0.98 ? 'Il suono satura: canta più lontano o più piano. ' : ''))) + 'Salvata tra le prove. <a href="#voce">Apri Voce per autotune e mix</a>';
    if (window.VoiceLab && pk > 0.003) VoiceLab.onNewTake(t, msg); // VOICE LAB: applica da solo il carattere scelto (tonalità rilevata da sola)
  }

  function renderTakes() {
    var el = $('#v-takes');
    if (!SESSION.takes.length) { el.innerHTML = ''; $('#v-work').hidden = true; return; }
    el.innerHTML = '<h3 style="margin-top:12px">Le tue prove</h3>' + SESSION.takes.map(function (t, i) {
      var p = t.res.pitch;
      return '<div class="song ' + (t.id === SESSION.takeId ? 'on' : '') + '" data-take="' + t.id + '"><div class="cover">' + (i + 1) + '</div><div class="m"><b>' + esc(t.name) + '</b><small>' + (p ? 'scostamento ' + fmt(p.meanAbsCentsFromNote, 0) + ' cent · ' : 'nota non chiara · ') + fmt(t.res.voicedShare * 100) + '% con nota' + (t.final ? ' · elaborata' : '') + '</small></div><button class="btn sm" data-tplay="' + t.id + '"><svg><use href="#i-play"/></svg></button></div>';
    }).join('') + '<p class="small muted">Confronta le prove: meno centesimi di scostamento = note più centrate (misurato, non giudica l\'espressività).</p>';
    $('#v-work').hidden = false;
  }
  $('#v-takes').addEventListener('click', function (e) {
    var pl = e.target.closest('[data-tplay]');
    if (pl) { var t = SESSION.takes.filter(function (x) { return x.id === pl.getAttribute('data-tplay'); })[0]; if (t) playBuf(t.mono, t.sr); return; }
    var c = e.target.closest('[data-take]'); if (c) selectTake(c.getAttribute('data-take'));
  });
  function selectTake(id) {
    SESSION.takeId = id; var t = activeTake(); if (!t) return;
    renderTakes(); renderTakeAnalysis(t);
    if (window.VoiceLab) VoiceLab.onSelect(t); // VOICE LAB
    var k = t.key;
    if (!k) { $('#v-key').textContent = 'Non ho abbastanza note chiare per stimare la tonalità: scegli tu nota e scala (o lascia "tutte le note").'; $('#v-tonic').value = 0; $('#v-mode').value = 'cromatica'; }
    else if (k.confidence === 'bassa') { $('#v-key').innerHTML = 'Stima poco sicura: <b>' + esc(k.name) + '</b> oppure ' + esc(k.alternative.name) + '. Per non rischiare correzioni sbagliate uso "tutte le note". Se conosci la tonalità, sceglila.'; $('#v-tonic').value = k.tonic; $('#v-mode').value = 'cromatica'; }
    else { $('#v-key').innerHTML = 'Tonalità stimata: <b>' + esc(k.name) + '</b> (affidabilità ' + k.confidence + '), seconda ipotesi ' + esc(k.alternative.name) + '. Maggiore e minore relativa si confondono: se non ti torna, cambiala. ' + tag('ipotesi'); $('#v-tonic').value = k.tonic; $('#v-mode').value = k.mode; }
    $('#v-fix').disabled = !t.final; $('#v-result').innerHTML = t.final ? t.finalHtml || '' : '';
    if (!t.notes) t.notes = PitchEditor.segment(t.res, { tonic: +$('#v-tonic').value, mode: $('#v-mode').value });
    NE.sel = null; renderNotes();
  }
  function renderTakeAnalysis(t) {
    var r = t.res, h = '';
    if (t.example) h += '<div class="note warn">Segnale sintetico di esempio, non una voce reale.</div>';
    h += '<div class="meters">';
    h += meter('Tempo con nota chiara', 'misurato', fmt(r.voicedShare * 100) + '%', 'Quando riconosco un\'altezza stabile.');
    if (r.pitch) {
      h += meter('Nota centrale', 'misurato', esc(r.pitch.medianNote), fmt(r.pitch.medianHz) + ' Hz');
      h += meter('Estensione', 'misurato', esc(r.pitch.lowNote) + '–' + esc(r.pitch.highNote), 'Circa ' + fmt(r.pitch.spanSemitones, 1) + ' semitoni.');
      h += meter('Scostamento', 'misurato', fmt(r.pitch.meanAbsCentsFromNote, 0) + ' cent', 'Dalle note temperate (La = 440 Hz). Vibrato e scivolate contano.');
    }
    h += meter('Picco', 'misurato', fmt(r.levels.peakDb, 1) + ' dB', r.levels.clippingShare > 0.001 ? 'Possibile distorsione.' : 'Nessun segno di distorsione.');
    h += meter('Livello medio', 'misurato', fmt(r.levels.rmsDb, 1) + ' dB', r.dynamics ? 'Dinamica ' + fmt(r.dynamics.rangeDb, 1) + ' dB.' : '');
    h += '</div>';
    if (!r.pitch) h += '<div class="note warn">Non ho trovato abbastanza note chiare: voce debole, rumore o musica sotto. Registra la sola voce.</div>';
    $('#v-analysis').innerHTML = h;
    $('#v-chart').innerHTML = r.pitch ? '<canvas class="cv" id="v-cv" height="170"></canvas><p class="small muted">Altezza delle note nel tempo' + (t.final ? ': grigio = originale, colore = elaborata' : '') + '.</p>' : '';
    drawPitch(t);
  }
  function cssv(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888'; }
  function drawPitch(t) {
    var cv = $('#v-cv'); if (!cv || !t.res.pitch) return;
    var W = cv.clientWidth || 340, H = 170, dpr = window.devicePixelRatio || 1; cv.width = W * dpr; cv.height = H * dpr;
    var c = cv.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, W, H);
    var fr = t.res.frames, T = fr.length ? fr[fr.length - 1].t : 1, lo = 1e9, hi = -1e9;
    var m = function (f) { return 69 + 12 * Math.log(f / 440) / Math.LN2; };
    var sets = [{ fr: fr, col: t.final ? cssv('--muted') : cssv('--violet') }];
    if (t.finalRes) sets.push({ fr: t.finalRes.frames, col: cssv('--cyan') });
    sets.forEach(function (s) { s.fr.forEach(function (f) { if (f.voiced && f.f0 > 0) { var v = m(f.f0); if (v < lo) lo = v; if (v > hi) hi = v; } }); });
    if (hi < lo) return; lo = Math.floor(lo) - 1; hi = Math.ceil(hi) + 1;
    c.strokeStyle = cssv('--line'); c.lineWidth = 1; c.font = '10px Manrope,sans-serif'; c.fillStyle = cssv('--muted');
    for (var n = lo; n <= hi; n++) { if (((n % 12) + 12) % 12 in { 0: 1, 4: 1, 7: 1 } || hi - lo < 14) { var y = H - 14 - (n - lo) / (hi - lo) * (H - 22); c.beginPath(); c.moveTo(30, y); c.lineTo(W, y); c.stroke(); c.fillText(NOTES[((n % 12) + 12) % 12], 2, y + 3); } }
    sets.forEach(function (s, idx) {
      c.strokeStyle = s.col; c.lineWidth = idx ? 2.2 : 1.6; c.beginPath(); var pen = false;
      s.fr.forEach(function (f) { if (f.voiced && f.f0 > 0) { var x = 30 + f.t / T * (W - 34), y = H - 14 - (m(f.f0) - lo) / (hi - lo) * (H - 22); if (pen) c.lineTo(x, y); else c.moveTo(x, y); pen = true; } else pen = false; });
      c.stroke();
    });
  }
  $('#v-apply').addEventListener('click', async function () {
    var t = activeTake(); if (!t) return; var btn = this; btn.disabled = true;
    $('#v-result').innerHTML = '<p class="muted">Sto elaborando la voce…</p>'; await tick();
    try {
      var x = t.mono, sr = t.sr, str = +$('#v-str').value / 100, harm = +$('#v-harm').value, shift = +$('#v-shift').value, stats = null;
      if ($('#v-den').checked) { x = Polish.denoise(x, sr, { reduceDb: 18, marginDb: 8 }); await tick(); }
      if (str > 0 || harm || shift) {
        var r = Autotune.correct(x, sr, { tonic: +$('#v-tonic').value, mode: $('#v-mode').value, strength: str, retuneMs: +$('#v-ret').value, vibrato: +$('#v-vib').value / 100, harmonyDegrees: harm || 0, shiftSemitones: shift, maxSeconds: 120,
          notes: $('#n-use').checked && t.notes && t.notes.length ? t.notes.map(function (n) { return { t0: n.t0, t1: n.t1, target: n.target, amount: n.amount }; }) : null });
        x = r.samples; stats = r.stats; await tick();
      }
      x = Polish.process(x, sr, $('#v-pol').value);
      t.final = x; t.finalRes = AudioAnalysis.analyze(x, sr, { maxSeconds: 120 });
      var h = '';
      if (t.res.pitch && t.finalRes.pitch) h += '<div class="meters" style="margin-top:12px">' + meter('Scostamento dalle note', 'misurato', fmt(t.res.pitch.meanAbsCentsFromNote, 0) + ' → ' + fmt(t.finalRes.pitch.meanAbsCentsFromNote, 0) + ' cent', 'Prima e dopo, misurato sul file.') + (stats ? meter('Parti corrette', 'misurato', fmt(stats.correctedSeconds, 1) + ' s', 'Spostamento medio ' + fmt(stats.meanShiftCents, 0) + ' cent.') : '') + '</div>';
      h += '<p class="small muted">Ascolta "Originale" e "Elaborata". Se suona metallica: abbassa intensità o rallenta la velocità. Con armonia attiva il confronto in centesimi include la seconda voce.</p>';
      t.finalHtml = h; $('#v-result').innerHTML = h; $('#v-fix').disabled = false; renderTakes(); renderTakeAnalysis(t); drawNotes();
      var s = cur(); if (['idea', 'testo', 'base', 'voce'].indexOf(s.status) !== -1) { s.status = 'voce'; persist(); }
      playBuf(x, sr);
    } catch (err) { $('#v-result').innerHTML = '<p>Qualcosa è andato storto durante l\'elaborazione. Prova con un file più corto.</p>'; }
    btn.disabled = false;
  });
  $('#v-orig').addEventListener('click', function () { var t = activeTake(); if (t) playBuf(t.mono, t.sr); });
  $('#v-fix').addEventListener('click', function () { var t = activeTake(); if (t && t.final) playBuf(t.final, t.sr); });
  $('#v-stop').addEventListener('click', stopPlay);
  /* Mix automatico: l'Orecchio misura voce e base (LUFS) e regola il volume della voce; poi misura il mix finale. */
  $('#v-automix').addEventListener('click', async function () {
    var t = activeTake(), m = $('#v-mixmsg'); if (!t) { m.textContent = 'Prima registra o importa una voce.'; return; }
    m.textContent = 'Misuro voce e base…'; await tick();
    try {
      var base = buildMix({ voice: false }), vox = t.final || t.mono, bl = Ear.lufs(base.samples, base.sr), vl = Ear.lufs(vox, t.sr);
      if (vl < -60 || bl < -60) { m.textContent = 'Non riesco a misurare: voce o base quasi silenziose.'; return; }
      var wantDb = 1.0, gain = Math.pow(10, (bl + wantDb - vl) / 20), sv = Math.max(20, Math.min(160, Math.round(gain * 100)));
      $('#v-gain').value = sv; $('#v-gv').textContent = sv + '%'; await tick();
      var mx = buildMix({ voice: true }), r = Ear.listen(mx.samples, mx.sr, { bpm: cur().prod.bpm }), notes = r.findings.filter(function (f) { return f.id === 'clip' || f.id === 'picco' || f.id === 'schiacciato'; }).map(function (f) { return f.text; });
      var fl = r.metrics.lufs, adv = fl > -9 ? 'più forte dello streaming: le piattaforme lo abbassano (circa -14 LUFS)' : (fl < -16 ? 'più basso dello standard streaming (circa -14 LUFS): usa il master "Forte"' : 'vicino allo standard streaming (circa -14 LUFS)');
      m.innerHTML = '<span class="tag m">Misurato</span> Base ' + bl + ' LUFS · voce ' + vl + ' LUFS → ho messo il volume voce al <b>' + sv + '%</b> (voce circa 1 LU sopra la base: <span class="tag i">Ipotesi</span> di mestiere, regola a orecchio)' + (Math.round(gain * 100) > 160 ? ' <b>Limite massimo raggiunto</b>: la voce è molto bassa, scegli un carattere più potente o registra più forte.' : '') + ' Mix finale: <b>' + fl + ' LUFS</b>, picco ' + r.metrics.peakDb + ' dB: ' + esc(adv) + '.' + (notes.length ? ' Attenzione: ' + esc(notes.join(' ')) : '');
    } catch (e) { m.textContent = 'Non sono riuscito a misurare il mix.'; }
  });
  $('#v-mix').addEventListener('click', async function () {
    var t = activeTake(), m = $('#v-mixmsg'); if (!t) return; m.textContent = 'Preparo il mix…'; await tick();
    try {
      var mx = buildMix({ voice: true }); playBuf(mx.samples, mx.sr, null); SESSION.baseMade = true;
      m.textContent = 'In ascolto: base + voce ' + mx.voice + '. Se la voce entra troppo presto o tardi usa "Entra alla battuta" e "Aggiusta".';
      var s = cur(); if (['idea', 'testo', 'base', 'voce'].indexOf(s.status) !== -1) { s.status = 'mix'; persist(); }
    } catch (e) { m.textContent = 'Non sono riuscito a creare il mix.'; }
  });
  $('#v-save').addEventListener('click', function () { var t = activeTake(); if (t) saveAudio(t.final || t.mono, t.sr, 'voce-' + (cur().title || 'canzone').replace(/\W+/g, '-'), $('#v-mixmsg')); });
  $('#v-savemix').addEventListener('click', async function () { if (!activeTake()) return; var mx = buildMix({ voice: true }); saveAudio(mx.samples, mx.sr, 'mix-' + (cur().title || 'canzone').replace(/\W+/g, '-'), $('#v-mixmsg')); });

  /* ---- Editor delle note (piano roll) ---- */
  var NE = { sel: null, drag: null };
  function noteName(m) { var r = Math.round(m); return NOTES[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1); }
  function geom(t) {
    var cv = $('#n-cv'), W = cv.clientWidth || 340, H = 280, notes = t.notes || [], T = Math.max(0.5, t.res.analyzedDuration || (t.mono.length / t.sr));
    var lo = 1e9, hi = -1e9; notes.forEach(function (n) { lo = Math.min(lo, n.midi, n.target); hi = Math.max(hi, n.midi, n.target); });
    if (hi < lo) { lo = 57; hi = 69; } lo = Math.floor(lo) - 2; hi = Math.ceil(hi) + 2; if (hi - lo < 12) { var mid = (hi + lo) / 2; lo = Math.floor(mid - 6); hi = lo + 12; }
    var padL = 38, padB = 16, rowH = (H - padB - 4) / (hi - lo + 1);
    return { cv: cv, W: W, H: H, T: T, lo: lo, hi: hi, padL: padL, rowH: rowH, x: function (s) { return padL + s / T * (W - padL - 4); }, y: function (m) { return 4 + (hi + 0.5 - m) * rowH; } };
  }
  function drawNotes() {
    var t = activeTake(), cv = $('#n-cv'); if (!t || !cv || $('#v-work').hidden) return;
    var g = geom(t), dpr = window.devicePixelRatio || 1; cv.width = g.W * dpr; cv.height = g.H * dpr;
    var c = cv.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, g.W, g.H);
    var tonic = +$('#v-tonic').value, mode = $('#v-mode').value, mask = Autotune.scaleMask(tonic, mode), chroma = mode === 'cromatica';
    c.font = '10px Manrope,sans-serif'; c.textBaseline = 'middle';
    for (var m = g.lo; m <= g.hi; m++) {
      var pc = ((m % 12) + 12) % 12, y = g.y(m), inS = !chroma && mask[pc], black = [1, 3, 6, 8, 10].indexOf(pc) !== -1;
      c.fillStyle = inS ? cssv('--glow1') : (black ? cssv('--bg2') : 'transparent'); c.fillRect(g.padL, y - g.rowH / 2, g.W - g.padL, g.rowH);
      c.strokeStyle = cssv('--line'); c.beginPath(); c.moveTo(g.padL, y + g.rowH / 2); c.lineTo(g.W, y + g.rowH / 2); c.stroke();
      if (pc === 0 || g.rowH > 13 || pc === tonic) { c.fillStyle = pc === tonic && !chroma ? cssv('--violet') : cssv('--muted'); c.textAlign = 'left'; c.fillText(noteName(m), 2, y); }
    }
    // curva elaborata
    if (t.finalRes) {
      c.strokeStyle = cssv('--cyan'); c.lineWidth = 1.6; c.beginPath(); var pen = false;
      t.finalRes.frames.forEach(function (f) { var mm = f.voiced && f.f0 > 0 ? 69 + 12 * Math.log(f.f0 / 440) / Math.LN2 : -1; if (mm >= g.lo - 0.5 && mm <= g.hi + 0.5) { var x = g.x(f.t), y = g.y(mm); if (pen) c.lineTo(x, y); else c.moveTo(x, y); pen = true; } else pen = false; }); c.stroke();
    }
    (t.notes || []).forEach(function (n, i) {
      var x0 = g.x(n.t0), x1 = Math.max(x0 + 6, g.x(n.t1)), yt = g.y(n.target), yo = g.y(n.midi), h = Math.max(10, g.rowH * 0.8), sel = NE.sel === i;
      c.globalAlpha = 0.35 + 0.65 * n.amount; c.fillStyle = cssv('--violet'); c.beginPath();
      if (c.roundRect) c.roundRect(x0, yt - h / 2, x1 - x0, h, 5); else c.rect(x0, yt - h / 2, x1 - x0, h); c.fill(); c.globalAlpha = 1;
      if (sel) { c.strokeStyle = cssv('--pink'); c.lineWidth = 2.2; c.stroke(); }
      c.strokeStyle = cssv('--ink'); c.lineWidth = 2; c.beginPath(); c.moveTo(x0, yo); c.lineTo(x1, yo); c.stroke();
      if (Math.abs(yo - yt) > 3) { c.strokeStyle = cssv('--ink'); c.globalAlpha = .4; c.lineWidth = 1; c.beginPath(); c.moveTo((x0 + x1) / 2, yo); c.lineTo((x0 + x1) / 2, yt); c.stroke(); c.globalAlpha = 1; }
    });
    c.textAlign = 'right'; c.fillStyle = cssv('--muted'); c.fillText(fmt(g.T, 1) + ' s', g.W - 2, g.H - 7);
  }
  function renderNotes() {
    var t = activeTake(), el = $('#n-panel'); if (!t) return; drawNotes();
    var notes = t.notes || [];
    if (!notes.length) { el.innerHTML = '<p class="small muted">Non ho trovato note chiare da mostrare.</p>'; return; }
    if (NE.sel == null) { el.innerHTML = '<p class="small muted" style="margin-top:8px">' + notes.length + ' note trovate. Tocca una barra per sceglierla.</p>'; return; }
    var n = notes[NE.sel], off = PitchEditor.offsetCents(n);
    el.innerHTML = '<div class="note" style="margin-top:10px"><b>Nota ' + (NE.sel + 1) + '</b> · ' + fmt(n.t0, 2) + '–' + fmt(n.t1, 2) + ' s<br>Cantata: <b>' + noteName(n.midi) + '</b> (' + (off > 0 ? '+' : '') + fmt(off, 0) + ' cent rispetto al bersaglio) → bersaglio: <b>' + noteName(n.target) + '</b>' + (n.edited ? ' · modificata a mano' : '') + '</div>' +
      '<div class="row"><button class="btn sm" data-ne="down">▼ Semitono</button><button class="btn sm" data-ne="up">▲ Semitono</button><button class="btn sm" data-ne="snap">Alla scala</button><button class="btn sm" data-ne="keep">Lasciala com\'è</button><button class="btn sm" data-ne="tone"><svg><use href="#i-play"/></svg>Senti la nota giusta</button></div>' +
      '<label class="f" style="margin-top:8px"><span>Quanto correggere questa nota <b id="n-av">' + Math.round(n.amount * 100) + '%</b></span><input type="range" id="n-am" min="0" max="100" value="' + Math.round(n.amount * 100) + '"></label>';
  }
  function playTone(midi, sec) {
    var ctx = getCtx(); if (!ctx) return; stopPlay();
    var o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime + 0.02; o.type = 'triangle'; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.28, t0 + 0.03); g.gain.setValueAtTime(0.28, t0 + sec - 0.1); g.gain.linearRampToValueAtTime(0, t0 + sec);
    o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + sec + 0.02);
  }
  function noteAtX(t, g, px) { var s = (px - g.padL) / (g.W - g.padL - 4) * g.T, best = null; (t.notes || []).forEach(function (n, i) { if (s >= n.t0 - 0.03 && s <= n.t1 + 0.03) best = i; }); return best; }
  function ptr(e) { var r = $('#n-cv').getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  $('#n-drag').addEventListener('change', function () { $('#n-cv').style.touchAction = this.checked ? 'none' : 'pan-y'; });
  $('#n-cv').addEventListener('pointerdown', function (e) {
    var t = activeTake(); if (!t) return; var g = geom(t), p = ptr(e), i = noteAtX(t, g, p.x);
    NE.sel = i; if (i != null && $('#n-drag').checked) { NE.drag = { y: p.y, target: t.notes[i].target, i: i }; try { this.setPointerCapture(e.pointerId); } catch (x) {} }
    renderNotes();
  });
  $('#n-cv').addEventListener('pointermove', function (e) {
    var t = activeTake(); if (!t || !NE.drag) return; var g = geom(t), p = ptr(e), n = t.notes[NE.drag.i];
    var nt = Math.max(36, Math.min(96, Math.round(NE.drag.target - (p.y - NE.drag.y) / g.rowH))); if (nt !== n.target) { n.target = nt; n.edited = true; drawNotes(); }
  });
  function endDrag() { if (NE.drag) { NE.drag = null; renderNotes(); } }
  $('#n-cv').addEventListener('pointerup', endDrag); $('#n-cv').addEventListener('pointercancel', endDrag);
  $('#n-panel').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ne]'), t = activeTake(); if (!b || !t || NE.sel == null) return; var n = t.notes[NE.sel], a = b.getAttribute('data-ne');
    if (a === 'up') { n.target++; n.edited = true; } else if (a === 'down') { n.target--; n.edited = true; }
    else if (a === 'snap') { n.target = PitchEditor.snap(n.midi, +$('#v-tonic').value, $('#v-mode').value); n.edited = false; n.amount = 1; }
    else if (a === 'keep') { n.amount = 0; n.edited = true; }
    else if (a === 'tone') { playTone(n.target, Math.min(1.2, Math.max(0.5, n.t1 - n.t0))); return; }
    renderNotes();
  });
  $('#n-panel').addEventListener('input', function (e) { var t = activeTake(); if (e.target.id === 'n-am' && t && NE.sel != null) { t.notes[NE.sel].amount = +e.target.value / 100; t.notes[NE.sel].edited = true; $('#n-av').textContent = e.target.value + '%'; drawNotes(); } });
  $('#n-reset').addEventListener('click', function () { var t = activeTake(); if (!t) return; t.notes.forEach(function (n) { n.edited = false; n.amount = 1; n.target = PitchEditor.snap(n.midi, +$('#v-tonic').value, $('#v-mode').value); }); renderNotes(); });
  $('#n-redo').addEventListener('click', function () { var t = activeTake(); if (!t) return; t.notes = PitchEditor.segment(t.res, { tonic: +$('#v-tonic').value, mode: $('#v-mode').value }); NE.sel = null; renderNotes(); });
  function rescale() { var t = activeTake(); if (t && t.notes) { PitchEditor.resnap(t.notes, +$('#v-tonic').value, $('#v-mode').value); renderNotes(); } }
  $('#v-tonic').addEventListener('change', rescale); $('#v-mode').addEventListener('change', rescale);

  /* base sulla voce */
  $('#v-mkbase').addEventListener('click', async function () {
    var t = activeTake(), m = $('#v-mixmsg'); if (!t) return; var p = cur().prod, mode = $('#v-mode').value;
    p.tonic = +$('#v-tonic').value; if (mode !== 'cromatica') p.mode = mode;
    var dur = t.mono.length / t.sr, bars = Math.max(4, Math.min(32, Math.ceil(dur / (240 / p.bpm)))); p.bars = bars; p.follow = false; SESSION.useImported = false; SESSION.baseKey = ''; $('#v-bar').value = 0; persist();
    m.textContent = 'Creo la base su ' + NOTES[p.tonic] + ' ' + p.mode + ', ' + p.bpm + ' BPM, ' + bars + ' battute…'; await tick();
    try { var mx = buildMix({ voice: true }); playBuf(mx.samples, mx.sr, null); SESSION.baseMade = true; m.textContent = 'Base su misura per la tua voce (' + NOTES[p.tonic] + ' ' + p.mode + ', ' + p.bpm + ' BPM, ' + bars + ' battute). Se il ritmo non coincide con come hai cantato, cambia i BPM in Studio (o "Batti il tempo") e riprova.'; }
    catch (e) { m.textContent = 'Non sono riuscito a creare la base.'; }
  });
  SHOW.voce = function () { renderTakes(); if (activeTake()) selectTake(SESSION.takeId); };
  window.addEventListener('resize', function () { var t = activeTake(); if (t && !$('#v-work').hidden) { drawPitch(t); drawNotes(); } });

  /* ===== VOICE LAB (cablaggio): il codice sta in src/voice-chain.js, src/voice-lab.js, src/realtime-tune.js ===== */
  VoiceLab.init({ esc: esc, fmt: fmt, tick: tick, meter: meter, cssv: cssv, NOTES: NOTES, activeTake: activeTake, getCtx: getCtx, makeBuffer: makeBuffer, stopPlay: stopPlay, micOk: micOk,
    bpm: function () { return cur().prod.bpm; },
    refresh: function (t) { renderTakes(); renderTakeAnalysis(t); drawNotes(); $('#v-fix').disabled = false; $('#v-result').innerHTML = t.finalHtml || ''; var s = cur(); if (['idea', 'testo', 'base', 'voce'].indexOf(s.status) !== -1) { s.status = 'voce'; persist(); } } });
  /* ===== fine VOICE LAB ===== */

  /* ================= Video ================= */
  var CV = $('#m-cv'), CX = CV.getContext('2d'), mgTimer = null;
  function filterPhoto() {
    var im = SESSION.photo && SESSION.photo.img; if (!im) return;
    var W0 = im.naturalWidth || im.width, H0 = im.naturalHeight || im.height, s = Math.min(1, 900 / Math.max(W0, H0));
    var w = Math.max(2, Math.round(W0 * s)), h = Math.max(2, Math.round(H0 * s)), c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h);
    var d = x.getImageData(0, 0, w, h); MangaFilter.apply(d, { mode: $('#m-mode').value, detail: +$('#m-det').value / 100 }); x.putImageData(d, 0, 0);
    SESSION.photo.cv = c; $('#m-msg').textContent = ''; drawClip(0, cur().prod.bpm, null, true);
  }
  $('#m-file').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return; $('#m-msg').textContent = 'Carico la foto…';
    var url = URL.createObjectURL(f), im = new Image();
    im.onload = function () { SESSION.photo = { img: im }; URL.revokeObjectURL(url); filterPhoto(); };
    im.onerror = function () { $('#m-msg').textContent = 'Non riesco ad aprire questa immagine. Prova con JPG o PNG.'; };
    im.src = url;
  });
  function soon() { clearTimeout(mgTimer); mgTimer = setTimeout(filterPhoto, 160); }
  $('#m-mode').addEventListener('change', soon);
  $('#m-det').addEventListener('input', function () { $('#m-dv').textContent = this.value + '%'; soon(); });
  function wrap(c, text, maxW) { var words = text.split(' '), lines = [], cur = ''; words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }); if (cur) lines.push(cur); return lines; }
  function drawClip(t, bpm, lines, still) {
    var W = CV.width, H = CV.height, f = ClipFx.frame(t, bpm), c = CX;
    c.save(); c.clearRect(0, 0, W, H);
    var g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2c1f7a'); g.addColorStop(.55, '#2a74f5'); g.addColorStop(1, '#14b8d4'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    var ph = SESSION.photo && SESSION.photo.cv;
    if (ph) {
      var k = Math.max(W / ph.width, H / ph.height) * f.scale, dw = ph.width * k, dh = ph.height * k, dx = (W - dw) / 2 + f.shakeX, dy = (H - dh) / 2 + f.shakeY;
      c.drawImage(ph, dx, dy, dw, dh);
      if (f.split > 1) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = .22; c.drawImage(ph, dx - f.split, dy, dw, dh); c.drawImage(ph, dx + f.split, dy, dw, dh); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    } else {
      var r = 160 + 90 * f.scale + 40 * Math.sin(t * 2); c.fillStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.arc(W / 2, H * .4, r, 0, 6.283); c.fill();
      c.fillStyle = 'rgba(255,255,255,.9)'; c.font = '700 26px Sora,sans-serif'; c.textAlign = 'center'; c.fillText('Scegli una foto', W / 2, H * .4 + 8);
    }
    if (f.flash > 0.02) { c.fillStyle = 'rgba(255,255,255,' + f.flash + ')'; c.fillRect(0, 0, W, H); }
    var gr = c.createLinearGradient(0, H * .6, 0, H); gr.addColorStop(0, 'rgba(10,10,30,0)'); gr.addColorStop(1, 'rgba(10,10,30,.78)'); c.fillStyle = gr; c.fillRect(0, H * .6, W, H * .4);
    c.textAlign = 'center'; c.fillStyle = '#fff'; c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 8;
    c.font = '700 22px Manrope,sans-serif'; c.globalAlpha = .9; c.fillText((cur().title || '').toUpperCase().slice(0, 34), W / 2, 60); c.globalAlpha = 1;
    var txt = lines ? ClipFx.lyricAt(lines, f.bar) : (lyricLines(cur().lyrics)[0] || '');
    c.font = '800 38px Sora,sans-serif'; var ls = wrap(c, txt, W - 80), y = H - 120 - (ls.length - 1) * 22;
    ls.slice(0, 4).forEach(function (l, i) { c.fillText(l, W / 2, y + i * 46); });
    c.restore();
  }
  var clipTimer = null;
  function clipMix() { var mx = buildMix({ voice: !!activeTake() }); return mx; }
  $('#m-play').addEventListener('click', async function () {
    var mx = clipMix(), lines = lyricLines(cur().lyrics); await tick();
    playBuf(mx.samples, mx.sr, function (t) { drawClip(t, mx.bpm, lines); }, function () { drawClip(0, mx.bpm, lines, true); });
    SESSION.clipDone = true; var s = cur(); if (s.status !== 'pubblicata') { s.status = 'clip'; persist(); }
    $('#m-exmsg').textContent = activeTake() ? 'Anteprima con base e voce.' : 'Anteprima con la base (nessuna voce importata).';
  });
  $('#m-stop').addEventListener('click', stopPlay);
  $('#m-png').addEventListener('click', function () { drawClip(0.0, cur().prod.bpm, null, true); CV.toBlob(function (b) { if (b) saveFile('clip-fotogramma.png', b, $('#m-exmsg'), 'Immagine pronta.'); }, 'image/png'); });
  $('#m-exp').addEventListener('click', async function () {
    var msg = $('#m-exmsg'), ctx = getCtx(), types = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
    var mime = window.MediaRecorder ? types.filter(function (t) { return MediaRecorder.isTypeSupported(t); })[0] : null;
    if (!ctx || !ctx.createMediaStreamDestination || !CV.captureStream || !mime) { msg.textContent = 'L\'esportazione del clip non è disponibile in questo browser.'; return; }
    stopPlay(); var mx = clipMix(), lines = lyricLines(cur().lyrics), maxS = Math.min(mx.samples.length / mx.sr, 60);
    var dest = ctx.createMediaStreamDestination(), src = ctx.createBufferSource(); src.buffer = makeBuffer(ctx, mx.samples.subarray(0, Math.floor(maxS * mx.sr)), mx.sr); src.connect(dest);
    var stream = CV.captureStream(30); dest.stream.getAudioTracks().forEach(function (tr) { stream.addTrack(tr); });
    var rec = new MediaRecorder(stream, { mimeType: mime }), chunks = []; rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    var stopped = new Promise(function (r) { rec.onstop = r; }), t0 = ctx.currentTime + 0.1, done = false;
    src.onended = function () { done = true; };
    rec.start(); src.start(t0); msg.textContent = 'Registro il clip: ' + Math.ceil(maxS) + ' secondi. Resta su questa pagina.';
    await new Promise(function (res) { var loop = function () { if (done) return res(); drawClip(Math.max(0, ctx.currentTime - t0), mx.bpm, lines); requestAnimationFrame(loop); }; loop(); });
    await sleep(300); rec.stop(); await stopped; SESSION.clipDone = true;
    await saveFile('clip-' + (cur().title || 'canzone').replace(/\W+/g, '-') + '.' + (mime.indexOf('mp4') !== -1 ? 'mp4' : 'webm'), new Blob(chunks, { type: mime }), msg, 'Clip pronto.');
  });

  /* idee videoclip */
  function renderIdeas() {
    var s = cur(), mood = s.mood || topMood(s) || '';
    var g = VideoIdeas.generate({ title: s.title, lyrics: s.lyrics, genre: s.prod.genre, mood: mood.toLowerCase(), bpm: s.prod.bpm, bars: s.prod.bars });
    var h = '<div class="note"><b>' + esc(g.concept.style) + '</b> · ' + esc(g.concept.summary) + '<br><span class="small">Luce: ' + esc(g.concept.light) + '. Durata prevista: circa ' + g.totalSeconds + ' secondi.</span></div>';
    h += '<h3 style="margin-top:12px">Struttura a tempo</h3>' + g.sections.map(function (x) { return '<div class="post"><div class="tt"><b>' + esc(x.name) + '</b><span class="small mono">battute ' + x.fromBar + '–' + x.toBar + ' · ' + fmt(x.seconds, 1) + ' s</span></div><p class="small">' + esc(x.scene) + '</p>' + (x.text ? '<p class="small muted">Scritta: «' + esc(x.text) + '»</p>' : '') + '</div>'; }).join('');
    h += '<h3 style="margin-top:12px">Formati da pubblicare</h3><ul class="clean small">' + g.formats.map(function (f) { return '<li><b>' + esc(f.platform) + '</b> · ' + esc(f.length) + '<br><span class="muted">' + esc(f.use) + '</span></li>'; }).join('') + '</ul>';
    h += '<h3 style="margin-top:12px">Come girare con l\'iPhone</h3><ul class="clean small">' + g.phone.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    h += '<h3 style="margin-top:12px">Montaggio</h3><ul class="clean small">' + g.editing.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    h += '<h3 style="margin-top:12px">Da evitare</h3><ul class="clean small">' + g.avoid.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    h += '<p class="small muted">Sono idee da un archivio di regole per umore e genere, non una garanzia di risultato. L\'umore usato: ' + esc(g.mood) + '.</p>';
    $('#vi-out').innerHTML = h;
  }
  $('#vi-go').addEventListener('click', renderIdeas);
  $('#vi-ai').addEventListener('click', async function () {
    var s = cur(), out = $('#vi-ai-out'); out.innerHTML = '<p class="small" id="vi-ai-t">Ci penso…</p>';
    try { await ask('Sei un regista di videoclip musicali low-budget. ' + AI_RULES + '\n\nCanzone:\n' + songContext(s) + '\n\nProponi un concetto originale di videoclip girabile con un iPhone da una persona sola, con 5 scene collegate alle parole del testo. Non imitare videoclip di altri artisti.', function (t) { $('#vi-ai-t').textContent = t; }); }
    catch (e) { $('#vi-ai-t').textContent = 'Non riesco a contattare Claude adesso.'; }
  });
  SHOW.video = function () { drawClip(0, cur().prod.bpm, null, true); };

  /* ================= Marketing e Social ================= */
  var calDay = null;
  function copyText(text, el) {
    var done = function () { el.textContent = 'Copiato.'; };
    try { navigator.clipboard.writeText(text).then(done, function () { el.textContent = 'Seleziona e copia a mano.'; }); } catch (e) { el.textContent = 'Seleziona e copia a mano.'; }
  }
  var PLAT = { instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' };
  function post(it, edit) {
    return '<div class="post" data-pid="' + it.id + '"><div class="tt"><span><b>' + esc(it.date.slice(8) + '/' + it.date.slice(5, 7)) + ' · ' + esc(it.time) + '</b> <span class="tag info">' + PLAT[it.platform] + '</span></span>' +
      '<select data-ps style="width:auto;padding:6px 10px;font-size:14px">' + ['da fare', 'approvato', 'pubblicato'].map(function (s) { return '<option' + (s === it.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
      '<b>' + esc(it.title) + '</b> <span class="small muted">· ' + esc(it.format) + '</span><p class="small muted">' + esc(it.what) + '</p>' +
      '<textarea data-pc rows="3">' + esc(it.caption) + '</textarea><p class="small mono" style="color:var(--blue)">' + esc(it.hashtags.join(' ')) + '</p>' +
      '<div class="row"><button class="btn sm" data-pcopy>Copia testo</button><span class="small muted" data-pmsg></span></div></div>';
  }
  function findItem(id) { var p = cur().plan; return p && p.items.filter(function (x) { return x.id === id; })[0]; }
  function postEvents(root) {
    root.addEventListener('input', function (e) { var b = e.target.closest('[data-pid]'); if (!b || !e.target.hasAttribute('data-pc')) return; var it = findItem(b.getAttribute('data-pid')); if (it) { it.caption = e.target.value; persist(); } });
    root.addEventListener('change', function (e) { var b = e.target.closest('[data-pid]'); if (!b || !e.target.hasAttribute('data-ps')) return; var it = findItem(b.getAttribute('data-pid')); if (it) { it.status = e.target.value; persist(); refreshSocial(); } });
    root.addEventListener('click', function (e) { var b = e.target.closest('[data-pid]'); if (!b) return; var it = findItem(b.getAttribute('data-pid'));
      if (e.target.hasAttribute('data-pcopy') && it) copyText(it.caption + '\n\n' + it.hashtags.join(' '), b.querySelector('[data-pmsg]'));
      if (e.target.hasAttribute('data-approve') && it) { it.status = 'approvato'; persist(); refreshSocial(); } });
  }
  postEvents($('#k-list')); postEvents($('#c-day')); postEvents($('#c-queue'));
  function genPlan() {
    var s = cur(); if (!s.lyrics.trim()) { $('#k-msg').textContent = 'Scrivi prima il testo in Studio: le didascalie usano le tue parole.'; return false; }
    var m = s.mood || topMood(s);
    s.plan = PromoPlan.generate({ title: s.title, artist: LIB.settings.artist, lyrics: s.lyrics, genre: s.prod.genre, moods: m ? [m.toLowerCase()] : [], startDate: $('#k-start').value || today() });
    s.release = s.plan.releaseDate; persist(); return true;
  }
  $('#k-gen').addEventListener('click', function () {
    var s = cur(); if (s.plan && s.plan.items.some(function (i) { return i.status !== 'da fare'; }) && !this.getAttribute('data-sure')) { this.setAttribute('data-sure', '1'); $('#k-msg').textContent = 'Il piano attuale ha contenuti già approvati o pubblicati. Premi di nuovo per sostituirlo.'; return; }
    this.removeAttribute('data-sure'); if (genPlan()) { $('#k-msg').textContent = 'Piano creato: l\'uscita è il ' + cur().plan.releaseDate.split('-').reverse().join('/') + '. Nulla viene pubblicato da solo.'; renderPlan(); }
  });
  function renderPlan() {
    var p = cur().plan, el = $('#k-list');
    if (!p) { el.innerHTML = '<div class="card"><p class="empty">Nessun piano. Scegli il primo giorno e premi "Crea il piano".</p></div>'; return; }
    var weeks = {}; p.items.forEach(function (i) { var w = Math.floor((i.day - 1) / 7) + 1; (weeks[w] = weeks[w] || []).push(i); });
    el.innerHTML = Object.keys(weeks).map(function (w) { return '<h3 style="margin:16px 0 8px">Settimana ' + w + '</h3>' + weeks[w].map(function (i) { return post(i); }).join(''); }).join('');
  }
  $('#k-ai').addEventListener('click', async function () {
    var s = cur(), out = $('#k-ai-out'); out.innerHTML = '<div class="card"><h3>Idee in più</h3><p id="k-ai-t" class="small">Ci penso…</p></div>';
    try { await ask('Sei un social media manager musicale. ' + AI_RULES + '\n\nCanzone:\n' + songContext(s) + '\n\nProponi 5 idee di contenuti brevi originali (non copiare altri artisti) oltre a un normale piano teaser/estratto/uscita. Per ognuna: piattaforma, idea, e una didascalia breve basata sulle parole del testo.', function (t) { $('#k-ai-t').textContent = t; }); }
    catch (e) { $('#k-ai-t').textContent = 'Non riesco a contattare Claude adesso.'; }
  });
  SHOW.marketing = function () { $('#k-start').value = (cur().plan && cur().plan.startDate) || $('#k-start').value || today(); renderPlan(); };

  function refreshSocial() {
    var s = cur(), p = s.plan, grid = $('#c-grid');
    if (!p) { grid.innerHTML = ''; $('#c-legend').textContent = 'Non c\'è ancora un piano. Crealo in Marketing.'; $('#c-queue').innerHTML = '<p class="empty">Nessun contenuto.</p>'; $('#c-count').textContent = '0'; $('#c-day').innerHTML = ''; return; }
    var start = new Date(p.startDate + 'T12:00:00'), lead = (start.getDay() + 6) % 7, h = ['L', 'M', 'M', 'G', 'V', 'S', 'D'].map(function (d) { return '<div class="small muted" style="text-align:center">' + d + '</div>'; }).join('');
    for (var i = 0; i < lead; i++) h += '<div></div>';
    for (var d = 1; d <= 30; d++) {
      var date = new Date(start.getTime() + (d - 1) * 86400000), items = p.items.filter(function (x) { return x.day === d; });
      h += '<button data-day="' + d + '" class="' + (calDay === d ? 'on' : '') + '">' + date.getDate() + '<i>' + items.map(function (x) { return '<s class="' + (x.status === 'pubblicato' ? 'ok' : x.status === 'approvato' ? 'ap' : '') + '"></s>'; }).join('') + '</i></button>';
    }
    grid.innerHTML = h; $('#c-legend').innerHTML = 'Viola = da fare · azzurro = approvato · verde = pubblicato da te.';
    var q = p.items.filter(function (x) { return x.status === 'da fare'; }); $('#c-count').textContent = q.length + ' da approvare';
    $('#c-queue').innerHTML = q.length ? q.slice(0, 6).map(function (it) { return post(it).replace('<div class="row"><button class="btn sm" data-pcopy>', '<div class="row"><button class="btn sm pri" data-approve>Approva</button><button class="btn sm" data-pcopy>'); }).join('') + (q.length > 6 ? '<p class="small muted">E altri ' + (q.length - 6) + ' contenuti.</p>' : '') : '<p class="empty">Tutto approvato.</p>';
    var di = calDay ? p.items.filter(function (x) { return x.day === calDay; }) : [];
    $('#c-day').innerHTML = calDay ? '<div class="card"><h3>Giorno ' + calDay + '</h3>' + (di.length ? di.map(function (i) { return post(i); }).join('') : '<p class="empty">Nessun contenuto in questo giorno.</p>') + '</div>' : '';
  }
  $('#c-grid').addEventListener('click', function (e) { var b = e.target.closest('[data-day]'); if (b) { calDay = +b.getAttribute('data-day'); refreshSocial(); } });
  $('#c-csv').addEventListener('click', function () { var p = cur().plan; if (!p) { $('#c-msg').textContent = 'Crea prima il piano in Marketing.'; return; } saveFile('calendario-' + (cur().title || 'canzone').replace(/\W+/g, '-') + '.csv', PromoPlan.toCsv(p.items), $('#c-msg'), 'Calendario pronto.'); });
  SHOW.social = refreshSocial;

  /* ================= Libreria ================= */
  SHOW.libreria = function () {
    var h = '';
    LIB.songs.forEach(function (s) {
      var lines = lyricLines(s.lyrics), pl = s.plan ? s.plan.items : [];
      var cnt = { 'da fare': 0, approvato: 0, pubblicato: 0 }; pl.forEach(function (i) { cnt[i.status]++; });
      h += '<details class="card"><summary>' + esc(s.title) + ' <span class="tag info">' + esc(s.status) + '</span></summary>' +
        '<dl class="kv"><dt>Testo</dt><dd>' + lines.length + ' righe, ' + s.versions.length + ' versioni salvate</dd><dt>Musica</dt><dd>' + esc(ALLG[s.prod.genre].label) + ', ' + s.prod.bpm + ' BPM, ' + NOTES[s.prod.tonic] + ' ' + s.prod.mode + '</dd><dt>Promozione</dt><dd>' + (pl.length ? pl.length + ' contenuti: ' + cnt['da fare'] + ' da fare, ' + cnt.approvato + ' approvati, ' + cnt.pubblicato + ' pubblicati' : 'nessun piano') + '</dd></dl>' +
        (pl.length ? '<h3 style="margin-top:12px">Didascalie pronte</h3>' + pl.slice(0, 8).map(function (i) { return '<p class="small"><b>' + esc(i.title) + '</b> (' + PLAT[i.platform] + ')<br>' + esc(i.caption) + '</p>'; }).join('') : '') +
        (lines.length ? '<h3 style="margin-top:12px">Righe del testo</h3><p class="small muted">' + lines.slice(0, 6).map(esc).join('<br>') + '</p>' : '') + '</details>';
    });
    h += '<div class="card"><h3>Salvati in questa sessione</h3>' + (SESSION.exports.length ? '<ul class="clean small">' + SESSION.exports.map(function (x) { return '<li>' + esc(x.name) + ' <span class="muted">· ' + x.time + '</span></li>'; }).join('') + '</ul><p class="small muted">I file sono sul tuo telefono (di solito in File → Download).</p>' : '<p class="empty">Ancora nessun file salvato. Audio, voci e clip esportati compaiono qui.</p>') + '</div>';
    $('#l-out').innerHTML = h;
  };

  /* ================= Impostazioni ================= */
  function applyTheme() {
    var t = LIB.settings.theme, r = document.documentElement;
    r.classList.toggle('studio', t === 'studio');
    if (t === 'studio') r.setAttribute('data-theme', 'dark'); else if (t === 'notte') r.setAttribute('data-theme', 'dark'); else if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', 'light');
  }
  function renderSettings() {
    var t = LIB.settings.theme;
    $('#x-theme').innerHTML = [['studio', 'Studio (elegante)'], ['notte', 'Cosmo (notte)'], ['chiaro', 'Chiaro'], ['auto', 'Automatico']].map(function (x) { return '<button class="chip ' + (t === x[0] ? 'on' : '') + '" data-theme-set="' + x[0] + '">' + x[1] + '</button>'; }).join('');
    $('#x-artist').value = LIB.settings.artist || '';
    $('#x-store').textContent = store.kind === 'account' ? 'I tuoi testi e piani sono salvati sul tuo account e ti seguono da un dispositivo all\'altro.' : 'Salvataggio solo su questo browser: se cancelli i dati del sito li perdi. Salva una copia ogni tanto.';
    $('#x-int').innerHTML = [
      ['ok', 'Salvataggio dati', store.kind === 'account' ? 'sul tuo account' : 'solo in questo browser'], [sampleFn ? 'ok' : 'soon', 'Claude (consigli, idee)', sampleFn ? 'disponibile (chiede il tuo consenso)' : 'non disponibile in questa vista'],
      ['soon', 'Voce clonata / canto AI', 'non collegata: serve un servizio esterno, da valutare'], ['soon', 'Video AI con personaggio', 'non collegato: serve un servizio esterno'], ['soon', 'Instagram · TikTok · YouTube', 'non collegati']
    ].map(function (r) { return '<li><span class="tag ' + (r[0] === 'ok' ? 'ok' : 'soon') + '">' + (r[0] === 'ok' ? 'attivo' : 'non ancora') + '</span> <b>' + r[1] + '</b> — ' + r[2] + '</li>'; }).join('');
  }
  SHOW.impostazioni = renderSettings;
  $('#x-theme').addEventListener('click', function (e) { var t = e.target.getAttribute('data-theme-set'); if (t) { LIB.settings.theme = t; applyTheme(); persist(); renderSettings(); } });
  $('#x-artist').addEventListener('input', function () { LIB.settings.artist = this.value; persist(); });
  $('#x-exp').addEventListener('click', function () { saveFile('music-studio-backup.json', JSON.stringify(LIB, null, 1), $('#x-msg'), 'Backup pronto.'); });
  $('#x-imp').addEventListener('change', async function (e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    try { var d = sanitize(JSON.parse(await f.text())); if (!d || !d.songs.length) throw new Error('vuoto'); LIB = d; cur(); persist(); applyTheme(); renderSettings(); $('#x-msg').textContent = 'Importate ' + d.songs.length + ' canzoni.'; }
    catch (err) { $('#x-msg').textContent = 'Questo file non è un backup valido.'; }
    e.target.value = '';
  });
  var wipe = false;
  $('#x-del').addEventListener('click', function () {
    if (!wipe) { wipe = true; this.textContent = 'Conferma: cancella tutto'; return; }
    wipe = false; this.textContent = 'Cancella tutto'; LIB = { songs: [], cur: null, settings: { theme: LIB.settings.theme, artist: '' } }; SESSION.takes = []; SESSION.takeId = null; dbTake('clear'); cur(); persist(); renderSettings(); $('#x-msg').textContent = 'Dati cancellati.';
  });

  /* ================= Avvio ================= */
  async function start() {
    await load(); renderCoach(); (LIB.settings.lab || []).forEach(function (r) { try { SoundLab.install(r); } catch (e) {} }); SynthDesign.PRO.forEach(function (r) { Instruments.registerCustom(r.id, { id: r.id, nome: r.nome, fam: 'synthpro', fonte: 'Synth Pro (sintesi originale)', tipo: r.tipo, range: r.range, ruoli: r.ruoli, come: r.come, combina: '', perche: '', stili: [] }, r.fn); }); Instruments.FAMILIES.synthpro = 'Synth pro'; (LIB.settings.synths || []).forEach(function (r) { try { synthRegister(r); } catch (e) {} }); (LIB.settings.voxInst || []).forEach(function (r) { try { voxRegister(r); } catch (e) {} }); refreshInstSelects(); applyTheme(); cur(); restoreTakes(); initSample().then(function () { if (!$('#v-impostazioni').hidden) renderSettings(); });
    route();
  }
  window.__app = { LIB: function () { return LIB; }, SESSION: SESSION, store: store, addTake: addTake, selectTake: selectTake, buildMix: buildMix, route: route };
  start();
})();
