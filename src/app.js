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
  var LIB = { songs: [], cur: null, settings: { theme: 'notte', artist: '' } };
  var SESSION = { takes: [], takeId: null, imported: null, useImported: false, base: null, baseKey: '', photo: null, exports: [], clipDone: false, baseMade: false };
  var store = { kind: 'locale', doc: null, busy: false, again: false, ok: false };

  function defaultProd() {
    return { master: 'standard', genre: 'pop', bpm: 100, tonic: 0, mode: 'maggiore', bars: 8, bassStyle: null, reverb: 0, seed: 1, follow: false, levels: { batteria: 1, basso: 1, accordi: 1, pad: 1, melodia: 1 } };
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
    d.settings = d.settings || { theme: 'notte', artist: '' };
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
    if (!player.ctx) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; player.ctx = new C(); }
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
    src.start(t0);
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
  var VIEWS = ['home', 'menu', 'canzoni', 'studio', 'strumenti', 'producer', 'voce', 'video', 'marketing', 'social', 'libreria', 'impostazioni', 'beatlab' /* Beat Lab */];
  var MENU = [
    ['home', 'Home e Dashboard', 'Il tuo percorso', 'i-home'], ['canzoni', 'Le mie canzoni', 'Schede e versioni', 'i-disc'],
    ['studio', 'Music Studio', 'Testo, base, cantare', 'i-sliders'], ['strumenti', 'Strumentario', '29 strumenti veri e guida', 'i-sliders'], ['beatlab', 'Beat Lab', 'Fai le tue basi', 'i-note'] /* Beat Lab */, ['producer', 'AI Producer', 'Comandi a parole', 'i-spark'],
    ['voce', 'Vocal Studio', 'Voce e autotune', 'i-mic'], ['video', 'AI Video Studio', 'Clip a tempo', 'i-film'],
    ['marketing', 'Marketing AI', 'Piano a 30 giorni', 'i-mega'], ['social', 'Social Media Manager', 'Calendario', 'i-cal'],
    ['libreria', 'Libreria contenuti', 'Materiali', 'i-folder'], ['impostazioni', 'Impostazioni', 'Aspetto e dati', 'i-gear']
  ];
  var SHOW = {};
  function route() {
    var id = (location.hash || '').replace('#', '');
    if (VIEWS.indexOf(id) === -1) id = 'home';
    stopPlay();
    VIEWS.forEach(function (v) { $('#v-' + v).hidden = v !== id; });
    var main = ['home', 'canzoni', 'studio', 'voce'].indexOf(id) !== -1 ? id : 'menu';
    $$('#tabs a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-r') === main); });
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
    s.prod.genre = r.genre; s.prod.mode = r.mode; s.prod.bpm = r.bpm; s.prod.tonic = r.tonic; SESSION.base = null;
    $('#st-msg').textContent = 'Ipotesi: ' + r.why.join(' ') + ' Puoi cambiare tutto qui sotto.';
    fillBase(); persist();
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
  var LEVEL_NAMES = { batteria: 'Batteria', basso: 'Basso', accordi: 'Accordi', pad: 'Atmosfera (pad)', melodia: 'Melodia guida' };
  function followBars() {
    var s = cur(); if (!s.prod.follow) return;
    var n = Math.max(4, Math.min(32, lyricLines(s.lyrics).length || 8)); s.prod.bars = n; $('#b-bars').value = n; $('#b-barsv').textContent = n; persist();
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
  $('#b-genre').addEventListener('change', function () { var p = cur().prod; p.genre = this.value; p.tune = null; p.bpm = ALLG[this.value].bpm; if (['trap', 'drill', 'epico'].indexOf(this.value) >= 0) { p.mode = 'minore'; $('#b-mode').value = 'minore'; } else if (this.value === 'estate') { p.mode = 'maggiore'; $('#b-mode').value = 'maggiore'; } if (Arranger.STYLES[this.value] && p.bars < 16) { p.bars = 32; $('#b-bars').value = 32; $('#b-barsv').textContent = 32; } $('#b-bpm').value = p.bpm; persist(); });
  ['#kar-speed', '#kar-speed2'].forEach(function (id) { var el = $(id); if (el) el.addEventListener('change', function () { cur().prod.karBars = +this.value; persist(); syncKar(); }); });
  function syncKar() { var v = String(cur().prod.karBars || 2); ['#kar-speed', '#kar-speed2'].forEach(function (id) { var el = $(id); if (el) el.value = v; }); }
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
  function getBase() {
    var p = cur().prod, key = JSON.stringify([cur().id, p.genre, p.bpm, p.tonic, p.mode, p.bars, p.seed, p.bassStyle, p.tune, p.sounds, p.inst, Instruments.loaded().length]);
    if (SESSION.baseKey !== key || !SESSION.base) { SESSION.base = (Arranger.STYLES[p.genre] ? Arranger : Backing).generate({ sampleRate: 32000, bpm: p.bpm, tonic: p.tonic, mode: p.mode, bars: p.bars, genre: p.genre, seed: p.seed, bassStyle: p.bassStyle || undefined, tune: p.tune || undefined, inst: p.inst || undefined, sounds: p.sounds === 'sint' ? 'sint' : 'campioni' }); SESSION.baseKey = key; }
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
  function karaokeTick(bpm, sel) {
    sel = sel || '#kar';
    var lines = lyricLines(cur().lyrics), barLen = 4 * 60 / bpm;
    return function (t) {
      var bar = Math.floor(t / barLen), per = +(cur().prod.karBars || 2), li = Math.floor(bar / per);
      if (!lines.length) { $(sel).innerHTML = '<div><b>Scrivi un testo per vederlo qui</b></div>'; return; }
      var ln = ClipFx.lyricAt(lines, li), md = (cur().modes || {})[ln] || 'canta';
      $(sel).innerHTML = '<div><span class="mode">' + md + '</span><br><b>' + esc(ln) + '</b><small>Battuta ' + (bar + 1) + ' · poi: ' + esc(ClipFx.lyricAt(lines, bar + 1)) + '</small></div>';
    };
  }
  async function makeAndPlay(newVariant) {
    var st = $('#b-status'), p = cur().prod;
    if (newVariant) p.seed++;
    st.textContent = 'Sto componendo la base…'; await tick();
    await ensureInst();
    try {
      var mx = buildMix({ voice: false });
      var ok = playBuf(mx.samples, mx.sr, karaokeTick(mx.bpm), function () { $('#kar').innerHTML = '<div><b>Fine</b><small>Premi di nuovo per ricantare</small></div>'; });
      if (!ok) { st.textContent = 'Questo browser non riesce a riprodurre audio.'; return null; }
      st.textContent = ''; SESSION.baseMade = true;
      var s = cur(); if (['idea', 'testo'].indexOf(s.status) !== -1) { s.status = 'base'; persist(); }
      var b = SESSION.useImported ? null : getBase();
      $('#b-out').innerHTML = b ? '<div class="note"><b>' + esc(ALLG[b.genre].label) + '</b> in ' + NOTES[b.tonic] + ' ' + b.mode + ', ' + b.bpm + ' BPM, ' + b.bars + ' battute (' + fmt(b.duration) + ' s). Accordi: <span class="mono">' + b.progression.join(' · ') + '</span>. ' + (b.inst && (b.inst.melodia || b.inst.accordi || b.inst.pad) ? 'Strumenti: ' + ['melodia', 'accordi', 'pad'].filter(function (r) { return b.inst[r]; }).map(function (r) { return instName(b.inst[r]) + ' (' + r + ')'; }).join(', ') + '.' : 'Suoni sintetici.') + ' "Nuova variante" cambia la melodia.' + (b.sections ? '<br>Struttura: <span class="mono">' + b.sections.map(function (x) { return x.name + ' ' + x.bars; }).join(' · ') + '</span>' : '') + '</div>' : '';
      return mx;
    } catch (e) { st.textContent = 'Non sono riuscito a creare la base. Prova con meno battute.'; return null; }
  }
  $('#b-play').addEventListener('click', function () { makeAndPlay(false); });
  $('#b-new').addEventListener('click', function () { makeAndPlay(true); });
  $('#b-stop').addEventListener('click', stopPlay);
  $('#b-save').addEventListener('click', async function () { var mx = buildMix({ voice: false }); saveAudio(mx.samples, mx.sr, 'base-' + (cur().title || 'canzone').replace(/\W+/g, '-'), $('#b-status')); });

  /* ================= Strumenti veri ================= */
  var INST_BASES = ['inst/', 'https://sultan199777.github.io/ai-music-studio/inst/'];
  function instName(id) { var c = Instruments.info(id); if (c) return c.nome; var y = Instruments.SYNTH.filter(function (x) { return x.id === id; })[0]; return y ? y.nome : id; }
  function noteNm(m) { return NOTES[m % 12] + (Math.floor(m / 12) - 1); }
  async function loadInst(id) {
    if (!id || Instruments.has(id)) return true;
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
    return h;
  }
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
      var p = cur().prod; p.inst = Object.assign({}, p.inst || {}); p.inst[r] = this.value || null; persist(); instInfo();
      if (this.value) { $('#b-status').textContent = 'Carico ' + instName(this.value) + '…'; var ok = await loadInst(this.value); $('#b-status').textContent = ok ? instName(this.value) + ' pronto. Premi "Crea e ascolta".' : 'Download non riuscito: per ora uso il suono sintetizzato.'; }
    });
  });
  function applyRecipe(g) {
    var R = Instruments.RECIPES[g] || Instruments.RECIPES[Arranger.STYLES[g] ? g : 'melodico'], p = cur().prod;
    var k = (p.seed || 1) % 2;
    p.inst = { melodia: R.melodia[k % R.melodia.length], accordi: R.accordi[k % R.accordi.length], pad: R.pad[0] }; persist(); fillInst();
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
    var c = Instruments.info(id), sr = 32000, mid = Math.round((c.range[0] + c.range[1]) / 2 / 12) * 12, notes = [mid, mid + 4, mid + 7, mid + 12].map(function (m) { return Math.min(c.range[1], m); });
    var len = Math.round(3.6 * sr), out = new Float32Array(len);
    notes.forEach(function (m, i) { var x = Instruments.render(id, m, 0.5, sr), a = Math.round(i * 0.4 * sr); for (var j = 0; j < x.length && a + j < len; j++) out[a + j] += x[j] * 0.5; });
    notes.slice(0, 3).forEach(function (m) { var x = Instruments.render(id, m, 1.6, sr), a = Math.round(1.8 * sr); for (var j = 0; j < x.length && a + j < len; j++) out[a + j] += x[j] * 0.3; });
    playBuf(out, sr); msgEl.textContent = 'Ascolti: ' + instName(id) + ' (Do maggiore, registro centrale).';
  }
  var stFam = 'tutte';
  SHOW.strumenti = function () {
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
    if (g) { var p = cur().prod; if (ALLG[g]) { p.genre = g; p.bpm = ALLG[g].bpm; p.tune = null; if (['trap', 'drill', 'epico'].indexOf(g) >= 0) p.mode = 'minore'; } applyRecipe(g); persist(); fillBase(); $('#st-msg').textContent = 'Ricetta applicata. Vai in Studio e premi "Crea e ascolta".'; ensureInst(); }
  });

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
  $('#rec-go').addEventListener('click', async function () {
    var msg = $('#rec-msg'); msg.className = 'status'; if (REC) return;
    if (!micOk()) { msg.textContent = 'Il microfono non è disponibile in questa pagina (se hai toccato un link dentro Claude, copialo e aprilo in Safari) (dentro Claude è bloccato). Apri il sito: https://sultan199777.github.io/ai-music-studio/ (da Safari), oppure registra con Memo Vocali e importa in Voce.'; msg.className = 'status err'; return; }
    var ctx = getCtx(); if (!ctx || !ctx.createScriptProcessor) { msg.textContent = 'Questo browser non supporta la registrazione.'; msg.className = 'status err'; return; }
    if (!lyricLines(cur().lyrics).length) { msg.textContent = 'Nota: qui non c\'è ancora il testo di questa canzone. Incollalo nel campo "Testo" in alto in questa pagina per vederlo scorrere mentre canti. Chiedo il microfono…'; } else msg.textContent = 'Chiedo il permesso del microfono…';
    var stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } }); }
    catch (e) { var inApp = /iPhone|iPad/.test(navigator.userAgent) && !/Safari\//.test(navigator.userAgent); msg.textContent = (inApp ? 'Stai aprendo la pagina dentro un\'altra app (es. Claude): lì il microfono è bloccato. Copia il link e incollalo in Safari. ' : 'Il microfono non parte. ') + 'Dettaglio tecnico: ' + (e && e.name ? e.name : 'errore') + '. Su iPhone: Impostazioni > Safari > Microfono, poi riapri la pagina e consenti.'; msg.className = 'status err'; return; }
    msg.textContent = 'Preparo la base…'; await tick();
    var mx = buildMix({ voice: false }), mic = ctx.createMediaStreamSource(stream), proc = ctx.createScriptProcessor(4096, 1, 1), mute = ctx.createGain();
    mute.gain.value = 0; var chunks = [], R = { stream: stream, mic: mic, proc: proc, mute: mute, chunks: chunks, ctx: ctx, level: 0, started: ctx.currentTime };
    proc.onaudioprocess = function (ev) { var d = ev.inputBuffer.getChannelData(0), m = 0; chunks.push(new Float32Array(d)); for (var i = 0; i < d.length; i++) { var v = d[i] < 0 ? -d[i] : d[i]; if (v > m) m = v; } R.level = m; };
    mic.connect(proc); proc.connect(mute); mute.connect(ctx.destination); REC = R; recUi(true);
    var kt = karaokeTick(mx.bpm, '#rec-kar');
    var ok = playBuf(mx.samples, mx.sr, function (t) { kt(t); var m = R.level; $('#orb').style.setProperty('--lvl', Math.min(1, m * 1.6).toFixed(2)); $('#rec-meter i').style.width = Math.min(100, Math.round(m * 140)) + '%'; $('#rec-meter').classList.toggle('hot', m > 0.95); }, function () { finishRec(); });
    R.delta = Math.max(0, (player.t0 || R.started) - R.started); R.lat = (ctx.baseLatency || 0) + (ctx.outputLatency || 0);
    if (!ok) { finishRec(); return; }
    msg.textContent = 'Registro. Usa le cuffie, altrimenti la base entra nel microfono.';
  });
  $('#rec-stop').addEventListener('click', stopPlay);
  async function finishRec() {
    var R = REC; if (!R) return; REC = null;
    try { R.mic.disconnect(); R.proc.disconnect(); R.mute.disconnect(); R.proc.onaudioprocess = null; } catch (e) {}
    R.stream.getTracks().forEach(function (t) { t.stop(); }); recUi(false);
    var n = 0; R.chunks.forEach(function (c) { n += c.length; }); var sr = R.ctx.sampleRate, msg = $('#rec-msg');
    $('#rec-kar').innerHTML = '<div><b>Registrazione finita</b></div>'; $('#orb').style.setProperty('--lvl', 0);
    if (n < sr * 0.8) { msg.textContent = 'Registrazione troppo corta: riprova.'; return; }
    var mono = new Float32Array(n), o = 0; R.chunks.forEach(function (c) { mono.set(c, o); o += c.length; });
    var pk = 0; for (var i = 0; i < n; i += 7) { var v = mono[i] < 0 ? -mono[i] : mono[i]; if (v > pk) pk = v; }
    var boosted = false;
    if (pk > 0.003 && pk < 0.3) { var gk = 0.7 / pk; for (var q = 0; q < n; q++) mono[q] *= gk; boosted = true; }
    msg.textContent = 'Analizzo la registrazione…'; await tick();
    var name = 'Registrazione ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    var t = await addTake(mono, sr, name, false); t.lat = R.delta + R.lat; t.at = Date.now();
    dbTake('put', { id: t.id, name: t.name, mono: t.mono, sr: t.sr, lat: t.lat, at: t.at }).then(function (ok) { t.saved = !!ok; });
    var s = cur(); if (['idea', 'testo', 'base'].indexOf(s.status) !== -1) { s.status = 'voce'; persist(); }
    selectTake(t.id);
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
    if (t === 'notte') r.setAttribute('data-theme', 'dark'); else if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', 'light');
  }
  function renderSettings() {
    var t = LIB.settings.theme;
    $('#x-theme').innerHTML = [['notte', 'Cosmo (notte)'], ['chiaro', 'Chiaro'], ['auto', 'Automatico']].map(function (x) { return '<button class="chip ' + (t === x[0] ? 'on' : '') + '" data-theme-set="' + x[0] + '">' + x[1] + '</button>'; }).join('');
    $('#x-artist').value = LIB.settings.artist || '';
    $('#x-store').textContent = store.kind === 'account' ? 'I tuoi testi e piani sono salvati sul tuo account e ti seguono da un dispositivo all\'altro.' : 'Salvataggio solo su questo browser: se cancelli i dati del sito li perdi. Esporta un backup ogni tanto.';
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
    await load(); applyTheme(); cur(); restoreTakes(); initSample().then(function () { if (!$('#v-impostazioni').hidden) renderSettings(); });
    route();
  }
  window.__app = { LIB: function () { return LIB; }, SESSION: SESSION, store: store, addTake: addTake, selectTake: selectTake, buildMix: buildMix, route: route };
  start();
})();
