/*
 * Voice Lab: interfaccia semplice per autotune e catena vocale (tappa 3). Solo browser (usa il DOM).
 * Lavora sul FILE registrato (qualità massima) con VoiceChain; in più offre un monitor in cuffia SPERIMENTALE (RtTune).
 * Il cablaggio con l'app è in src/app.js (blocco "VOICE LAB") e passa da VoiceLab.init(api).
 */
(function (root) {
  'use strict';
  var VC = root.VoiceChain, AT = root.Autotune, RT = root.RtTune, AA = root.AudioAnalysis;
  var api = null, busy = false, pending = null, timer = 0, lastBuilt = null;
  var LS = 'vl-state-v1';
  var st = { ids: ['melodico'], macros: {}, advanced: {}, mine: [] };
  var GROUPS = { clean: 'Pulizia', tune: 'Intonazione (autotune)', eq: 'Equalizzatore', deess: 'De-esser', comp: 'Compressore', sat: 'Saturazione', dist: 'Distorsione', filter: 'Filtro creativo', harmony: 'Armonie', doubles: 'Doppie voci', delay: 'Eco', reverb: 'Riverbero', out: 'Uscita' };

  function $(s) { return document.querySelector(s); }
  function esc(s) { return api.esc(s); }
  function load() { try { var o = JSON.parse(localStorage.getItem(LS) || 'null'); if (o && Array.isArray(o.ids)) { st.ids = o.ids.filter(function (i) { return VC.CHARACTERS.some(function (c) { return c.id === i; }) || /^mine:/.test(i); }); st.macros = o.macros || {}; st.advanced = o.advanced || {}; st.mine = Array.isArray(o.mine) ? o.mine.slice(0, 20) : []; } } catch (e) {} if (!st.ids.length) st.ids = ['melodico']; }
  function save() { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) {} }
  function mineList() { return st.mine.map(function (txt, i) { var p = VC.parseState(txt); return p ? { id: 'mine:' + i, name: p.name || ('Mio ' + (i + 1)), p: p } : null; }).filter(Boolean); }

  /* ---------- stato -> parametri ---------- */
  // I "miei caratteri" salvati si espandono nei caratteri base + cursori + avanzate
  function expand() {
    var ids = [], macros = {}, adv = {};
    st.ids.forEach(function (id) {
      if (/^mine:/.test(id)) { var m = mineList().filter(function (x) { return x.id === id; })[0]; if (m) { m.p.ids.forEach(function (b) { if (ids.indexOf(b) === -1) ids.push(b); }); Object.keys(m.p.macros).forEach(function (k) { macros[k] = m.p.macros[k]; }); mergeAdv(adv, m.p.advanced); } }
      else if (ids.indexOf(id) === -1) ids.push(id);
    });
    Object.keys(st.macros).forEach(function (k) { macros[k] = st.macros[k]; });
    mergeAdv(adv, st.advanced);
    return { ids: ids.length ? ids : ['melodico'], macros: macros, advanced: adv };
  }
  function mergeAdv(dst, src) { Object.keys(src || {}).forEach(function (g) { dst[g] = dst[g] || {}; Object.keys(src[g]).forEach(function (k) { dst[g][k] = src[g][k]; }); }); }
  function chosenMacros() { var e = expand(); var b = VC.buildParams({ ids: e.ids, macros: e.macros }); return b.macros; }

  /* ---------- interfaccia ---------- */
  function html() {
    return '<div class="card vl" id="vl-card"><div class="card-head"><h3>Voice Lab</h3><span class="tag i">Nuovo</span></div>' +
      '<p class="small muted">Dopo ogni registrazione l\'app intona e rifinisce la voce da sola. Qui scegli il carattere e regoli pochi cursori. Lavora sul file registrato: qualità piena, ma ci mette qualche secondo.</p>' +
      '<button class="btn pri block vl-auto" id="vl-auto">Auto</button><p class="small muted vl-hint">Auto = riconosco tonalità e rumore, scelgo le regolazioni e applico il carattere scelto.</p>' +
      '<div class="status" id="vl-status" role="status"></div><div class="vl-bar" id="vl-bar" hidden><i></i></div>' +
      '<div id="vl-key"></div>' +
      '<h4 class="vl-h">Carattere <span class="muted small">(puoi sceglierne più di uno)</span></h4><div class="chips" id="vl-chips"></div><p class="small muted" id="vl-desc"></p>' +
      '<h4 class="vl-h">Regolazioni semplici</h4><div id="vl-sliders"></div>' +
      '<div class="row vl-row"><button class="btn" id="vl-apply">Applica di nuovo</button><button class="btn sm" id="vl-reset">Rimetti i valori del carattere</button></div>' +
      '<div class="row vl-row"><input type="text" id="vl-name" maxlength="30" placeholder="Nome del tuo carattere" aria-label="Nome del tuo carattere"><button class="btn sm" id="vl-save">Salva come mio carattere</button><button class="btn sm danger" id="vl-del" hidden>Elimina</button></div>' +
      '<h4 class="vl-h">Ascolta Prima / Dopo</h4>' +
      '<div class="row vl-row"><button class="btn" id="vl-a"><svg><use href="#i-play"/></svg>Prima</button><button class="btn" id="vl-b"><svg><use href="#i-play"/></svg>Dopo</button><button class="btn" id="vl-ab">Alterna A/B</button><button class="btn" id="vl-stop" aria-label="Ferma"><svg><use href="#i-stop"/></svg></button></div>' +
      '<div class="sw"><label for="vl-eq">Stesso volume (pareggia prima e dopo)</label><input type="checkbox" id="vl-eq" checked></div><div class="small muted" id="vl-abinfo"></div>' +
      '<div id="vl-chart"></div><div id="vl-meas"></div><ul class="clean small" id="vl-notes"></ul>' +
      '<details class="vl-adv" id="vl-adv"><summary>Avanzato: tutti i parametri</summary><div id="vl-advbody"></div></details>' +
      '</div>';
  }
  function monHtml() {
    return '<div class="card vl" id="vl-mon"><div class="card-head"><h3>Monitor in cuffia</h3><span class="tag soon">Sperimentale</span></div>' +
      '<p class="small muted">Ti fa sentire la voce già un po\' intonata mentre canti. È solo un aiuto: la registrazione resta quella pulita del microfono, e la qualità vera si ottiene dopo, sul file.</p>' +
      '<div class="note warn small"><b>Limiti</b>: usa cuffie con filo (con il Bluetooth il ritardo è molto più alto; con l\'altoparlante fischia). Il suono è più granuloso di quello finale. Il ritardo totale dipende dal telefono: sotto ~20-30 ms è comodo, sopra no (soglia indicativa, non verificata).</div>' +
      '<div class="row vl-row"><button class="btn pri" id="vl-mon-go">Attiva il monitor</button><button class="btn" id="vl-mon-stop" hidden>Spegni</button></div>' +
      '<div class="sw"><label for="vl-mon-on">Correzione attiva</label><input type="checkbox" id="vl-mon-on" checked></div>' +
      '<label class="f"><span>Quanto correggere <b id="vl-mon-sv">70%</b></span><input type="range" id="vl-mon-s" min="0" max="100" value="70"></label>' +
      '<label class="f"><span>Velocità <b id="vl-mon-rv">30 ms</b></span><input type="range" id="vl-mon-r" min="0" max="150" value="30"></label>' +
      '<div class="row vl-row"><label class="f"><span>Nota di partenza</span><select id="vl-mon-t"></select></label><label class="f"><span>Scala</span><select id="vl-mon-m"><option value="cromatica">Tutte le note</option><option value="maggiore">Maggiore</option><option value="minore">Minore</option></select></label></div>' +
      '<label class="f"><span>Volume del monitor <b id="vl-mon-vv">100%</b></span><input type="range" id="vl-mon-v" min="0" max="100" value="100"></label>' +
      '<div class="status" id="vl-mon-msg" role="status"></div><div class="vl-lat" id="vl-mon-lat"></div></div>';
  }
  function featHtml() {
    var have = [
      ['Mic 1 · registra pulito', 'Registri la voce pulita; l\'autotune parte da solo dopo e lo rifinisci sotto.'],
      ['Mic 2 · autotune dal vivo', 'Senti l\'autotune in cuffia mentre canti. Ottieni 2 prove: con autotune e pulita.'],
      ['Intensità e velocità', 'Quanto e quanto in fretta la nota viene portata sulla scala (0 ms = effetto robot).'],
      ['Classic', 'Passaggio a gradino netto, suono trap duro.'],
      ['Humanize', 'Rallenta la correzione sulle note lunghe, così non suonano statiche.'],
      ['Flex-Tune', 'Non tocca le note già vicine e lascia passare le scivolate.'],
      ['Vibrato naturale e creato', 'Conservi o riduci il tuo vibrato, oppure ne aggiungi uno pulito (profondità e velocità).'],
      ['Deriva lenta', 'Quanto della lenta oscillazione dentro la nota viene mantenuto.'],
      ['Timbro (formante)', 'Voce più scura o più chiara senza cambiare nota.'],
      ['Armonie e spostamento', 'Terza o quinta sopra la scala, oppure voce spostata di semitoni.'],
      ['Tonalità automatica', 'Capisce la scala dalla tua voce; se è incerta lo dice e usa tutte le note.'],
      ['Editor note a mano', 'Sposti o correggi le singole note disegnate.'],
      ['Accordatura della base (cent)', 'Per basi non intonate a LA 440: l\'autotune segue la base.'],
      ['Caratteri vocali e A/B', 'Molti caratteri pronti e confronto prima/dopo.']
    ], miss = [
      ['Modello della gola (throat) dei plugin pro', 'Non c\'è: il timbro si cambia solo con la formante.'],
      ['Controllo da tastiera MIDI', 'Safari su iPhone non supporta il MIDI nel browser.'],
      ['Ritardo di 2-5 ms dei plugin pro', 'Qui il ritardo è molto più alto (decine di ms): il monitor serve da guida, non da sostituto.'],
      ['Correzione del tempo (timing)', 'Non fatta.'],
      ['Doppia voce automatica', 'Non fatta come funzione a parte: per ora si ottiene con le armonie.']
    ];
    var li = function (a) { return '<li><b>' + a[0] + '</b>: ' + a[1] + '</li>'; };
    return '<div class="card vl"><details><summary><b>Tutte le funzioni dell\'autotune</b> <span class="tag m">Misurato</span></summary>' +
      '<p class="small muted">Confronto con Auto-Tune Pro e Melodyne fatto sulle loro funzioni dichiarate. Il suono finale lo giudichi tu: io non posso ascoltarlo.</p>' +
      '<h4>Ce l\'hai</h4><ul class="clean small">' + have.map(li).join('') + '</ul><h4>Non c\'è ancora</h4><ul class="clean small">' + miss.map(li).join('') + '</ul></details></div>';
  }
  function setStatus(msg, kind) { var el = $('#vl-status'); if (!el) return; el.textContent = msg; el.className = 'status' + (kind === 'err' ? ' err' : ''); }
  function setBar(f) { var b = $('#vl-bar'); if (!b) return; b.hidden = f == null; if (f != null) b.firstChild.style.width = Math.round(f * 100) + '%'; }

  function renderChips() {
    var el = $('#vl-chips'); if (!el) return;
    var h = VC.CHARACTERS.map(function (c) { return '<button class="chip' + (st.ids.indexOf(c.id) !== -1 ? ' on' : '') + '" data-ch="' + c.id + '" aria-pressed="' + (st.ids.indexOf(c.id) !== -1) + '">' + esc(c.label) + '</button>'; }).join('');
    h += mineList().map(function (m) { return '<button class="chip mine' + (st.ids.indexOf(m.id) !== -1 ? ' on' : '') + '" data-ch="' + m.id + '" aria-pressed="' + (st.ids.indexOf(m.id) !== -1) + '">★ ' + esc(m.name) + '</button>'; }).join('');
    el.innerHTML = h;
    var d = st.ids.map(function (id) { var c = VC.CHARACTERS.filter(function (x) { return x.id === id; })[0]; return c ? c.label + ': ' + c.desc : (/^mine:/.test(id) ? 'Il tuo carattere salvato.' : ''); }).filter(Boolean).join(' · ');
    $('#vl-desc').textContent = d + (d ? ' (valori di partenza non verificati: regola con l\'orecchio)' : '');
    $('#vl-del').hidden = !st.ids.some(function (i) { return /^mine:/.test(i); });
  }
  var MDESC = { intensity: function (p) { return 'Correzione al ' + Math.round(p.tune.strength * 100) + '%'; }, robotic: function (p) { return p.tune.classic ? 'Gradino netto (modo Classico)' : 'Ritocco in ' + (Math.round(p.tune.retuneMs * 10) / 10) + ' ms'; }, natural: function (p) { return 'Vibrato conservato al ' + Math.round(p.tune.vibrato * 100) + '%'; }, timbre: function (p) { var f = p.tune.formantSemitones; return f === 0 ? 'Timbro invariato' : 'Timbro ' + (f > 0 ? '+' : '') + String(f).replace('.', ',') + ' semitoni'; }, space: function (p) { return p.reverb.on ? 'Riverbero ' + Math.round(p.reverb.mix * 100) + '%' + (p.delay.on ? ' + eco' : '') : 'Voce asciutta'; } };
  function renderSliders() {
    var el = $('#vl-sliders'); if (!el) return;
    var m = chosenMacros(), e = expand(), b = VC.buildParams({ ids: e.ids, macros: e.macros, advanced: e.advanced });
    if (!el.firstChild) {
      el.innerHTML = VC.MACROS.map(function (k) { return '<label class="f vl-sl"><span>' + esc(k.label) + ' <b id="vl-mv-' + k.id + '"></b></span><input type="range" min="0" max="100" data-mc="' + k.id + '" aria-label="' + esc(k.label) + '"><small class="muted">' + esc(k.hint) + '</small></label>'; }).join('');
    }
    VC.MACROS.forEach(function (k) { var inp = el.querySelector('[data-mc="' + k.id + '"]'); if (inp !== document.activeElement) inp.value = Math.round(m[k.id]); $('#vl-mv-' + k.id).textContent = MDESC[k.id](b.params); });
  }

  function keyUI(t) {
    var el = $('#vl-key'); if (!el) return;
    if (!t || !t.vl) { el.innerHTML = ''; return; }
    var v = t.vl, info = t.vlInfo, k = info && info.key, h = '';
    if (t.vlKey) h = '<div class="note small">Tonalità scelta da te: <b>' + esc(api.NOTES[t.vlKey.tonic]) + ' ' + esc(t.vlKey.mode) + '</b>.</div>';
    else if (v.uncertain) h = '<div class="note warn small"><b>Non sono sicuro della tonalità</b>' + (k ? ' (forse ' + esc(k.name) + ' o ' + esc(k.alternative.name) + ')' : ' (poche note chiare)') + '. Per non sbagliare ho corretto sulle note più vicine di tutte (niente scala, niente armonie). Se la conosci, scegli:</div>';
    else h = '<div class="note small">Tonalità riconosciuta: <b>' + esc(k.name) + '</b> (affidabilità ' + esc(k.confidence) + '). Maggiore e minore relativa hanno le stesse note: se non ti torna, cambiala. <span class="tag i">Ipotesi</span></div>';
    var cur = t.vlKey || (k ? { tonic: k.tonic, mode: k.mode } : { tonic: 0, mode: 'maggiore' });
    h += '<div class="row vl-row"><label class="f"><span>Nota</span><select id="vl-kt">' + api.NOTES.map(function (n, i) { return '<option value="' + i + '"' + (i === cur.tonic ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
      '<label class="f"><span>Scala</span><select id="vl-km">' + ['maggiore', 'minore', 'cromatica'].map(function (m) { return '<option value="' + m + '"' + (m === cur.mode ? ' selected' : '') + '>' + (m === 'cromatica' ? 'Tutte le note' : m.charAt(0).toUpperCase() + m.slice(1)) + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn sm" id="vl-kgo">Usa questa tonalità</button>' + (t.vlKey ? '<button class="btn sm" id="vl-kauto">Torna all\'automatica</button>' : '') + '</div>';
    el.innerHTML = h;
  }

  function drawChart(t) {
    var box = $('#vl-chart'); if (!box) return;
    if (!t || !t.vl || !t.vl.before || !t.vl.after) { box.innerHTML = ''; return; }
    box.innerHTML = '<canvas class="cv" id="vl-cv" height="190" aria-label="Curva di intonazione prima e dopo"></canvas><p class="small muted">Altezza nel tempo: <b style="color:var(--muted)">grigio = prima</b>, <b style="color:var(--cyan)">azzurro = dopo</b>. Le righe sono le note della scala.</p>';
    var cv = $('#vl-cv'), W = cv.clientWidth || 340, H = 190, dpr = window.devicePixelRatio || 1; cv.width = W * dpr; cv.height = H * dpr;
    var c = cv.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, W, H);
    var b = t.vl.before.curve, a = t.vl.after.curve, lo = 1e9, hi = -1e9, T = 0.5;
    [b, a].forEach(function (cu) { cu.midi.forEach(function (m, i) { if (m != null) { if (m < lo) lo = m; if (m > hi) hi = m; if (cu.t[i] > T) T = cu.t[i]; } }); });
    if (hi < lo) { box.innerHTML = '<p class="small muted">Non ci sono note chiare da disegnare.</p>'; return; }
    lo = Math.floor(lo) - 1; hi = Math.ceil(hi) + 1;
    var mask = t.vl.mask, X = function (s) { return 30 + s / T * (W - 34); }, Y = function (m) { return H - 14 - (m - lo) / (hi - lo) * (H - 22); };
    c.font = '10px Manrope,sans-serif'; c.fillStyle = api.cssv('--muted');
    for (var n = lo; n <= hi; n++) { var pc = ((n % 12) + 12) % 12; if (mask[pc]) { c.strokeStyle = api.cssv('--line'); c.lineWidth = 1; c.beginPath(); c.moveTo(30, Y(n)); c.lineTo(W, Y(n)); c.stroke(); if (hi - lo < 16 || pc === 0) c.fillText(api.NOTES[pc], 2, Y(n) + 3); } }
    [[b, api.cssv('--muted'), 1.4], [a, api.cssv('--cyan'), 2]].forEach(function (s) {
      c.strokeStyle = s[1]; c.lineWidth = s[2]; c.beginPath(); var pen = false;
      s[0].midi.forEach(function (m, i) { if (m != null) { var x = X(s[0].t[i]), y = Y(m); if (pen) c.lineTo(x, y); else c.moveTo(x, y); pen = true; } else pen = false; });
      c.stroke();
    });
  }
  function f1(v) { return String(Math.round(v * 10) / 10).replace('.', ','); }
  function renderResult(t) {
    var meas = $('#vl-meas'), notes = $('#vl-notes'); if (!meas) return;
    if (!t || !t.vl) { meas.innerHTML = ''; notes.innerHTML = ''; drawChart(null); keyUI(null); abInfo(); return; }
    var v = t.vl, r = v.report, h = '<div class="meters">';
    if (isFinite(v.before.centerCents) && isFinite(v.after.centerCents)) h += api.meter('Errore sulle note', 'misurato', Math.round(v.before.centerCents) + ' → ' + Math.round(v.after.centerCents) + ' cent', v.mask.every(Boolean) ? 'Distanza dalla nota più vicina (vibrato escluso), prima e dopo.' : 'Distanza dalla nota di scala più vicina (vibrato escluso), prima e dopo.');
    h += api.meter('Picco', 'misurato', f1(r.outputPeakDb) + ' dB', 'Il limitatore tiene il picco sotto ' + f1(v.params.out.ceilingDb) + ' dB.');
    h += api.meter('Volume medio', 'misurato', f1(r.outputRmsDb) + ' dB', 'Prima ' + f1(r.inputRmsDb) + ' dB (solo parti con voce).');
    if (r.compMaxReductionDb != null) h += api.meter('Compressore', 'misurato', f1(r.compMaxReductionDb) + ' dB', 'Riduzione massima dei picchi.');
    if (r.deessMaxReductionDb != null) h += api.meter('De-esser', 'misurato', f1(r.deessMaxReductionDb) + ' dB', 'Riduzione massima sulle "S".');
    h += api.meter('Tempo di calcolo', 'misurato', f1(v.ms / 1000) + ' s', 'Su questo dispositivo.');
    h += '</div>';
    meas.innerHTML = h;
    var ns = (v.notes || []).concat(r.warnings || []);
    if (r.tune && r.tune.meanShiftCents != null && v.params.tune.on) ns.push('Spostamento medio dell\'altezza: ' + Math.round(r.tune.meanShiftCents) + ' cent, massimo ' + Math.round(r.tune.maxShiftCents) + ' cent (misurato).');
    ns.push('Non posso ascoltare: i numeri dicono cosa è cambiato, il suono lo giudichi tu.');
    notes.innerHTML = ns.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
    keyUI(t); drawChart(t); abInfo();
  }

  /* ---------- parametri avanzati (generati dall'elenco SPEC) ---------- */
  function advRow(s, val, mod) {
    var id = 'vl-adv-' + s[0].replace('.', '-'), lab = esc(s[4]), hint = s[5] ? '<small class="muted">' + esc(s[5]) + '</small>' : '';
    if (s[1] === 'bool') return '<div class="sw vl-adv-row"><label for="' + id + '">' + lab + (mod ? ' <span class="tag i">modificato</span>' : '') + hint + '</label><input type="checkbox" id="' + id + '" data-ap="' + s[0] + '"' + (val ? ' checked' : '') + '></div>';
    if (s[1] === 'enum') return '<label class="f vl-adv-row"><span>' + lab + '</span><select id="' + id + '" data-ap="' + s[0] + '">' + s[2].map(function (o) { return '<option' + (o === val ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>' + hint + '</label>';
    var step = (s[3] - s[2]) > 100 ? 1 : (s[3] - s[2]) > 10 ? 0.5 : 0.01;
    return '<label class="f vl-adv-row"><span>' + lab + (mod ? ' <span class="tag i">modificato</span>' : '') + ' <b id="' + id + '-v">' + f1(val) + '</b></span><input type="range" id="' + id + '" data-ap="' + s[0] + '" min="' + s[2] + '" max="' + s[3] + '" step="' + step + '" value="' + val + '">' + hint + '</label>';
  }
  function buildAdvanced() {
    var body = $('#vl-advbody'); if (!body) return;
    var e = expand(), b = VC.buildParams({ ids: e.ids, macros: e.macros, advanced: e.advanced }).params, h = '<p class="small muted">Qui trovi tutto. Se ne cambi uno, vince sui cursori semplici. Ogni modifica si sente dopo "Applica di nuovo".</p>', last = '';
    VC.SPEC.forEach(function (s) {
      var g = s[0].split('.')[0]; if (g !== last) { h += '<h4 class="vl-h">' + esc(GROUPS[g] || g) + '</h4>'; last = g; }
      var val = b[g][s[0].split('.')[1]], mod = st.advanced[g] && st.advanced[g][s[0].split('.')[1]] !== undefined;
      h += advRow(s, val, mod);
    });
    h += '<div class="row vl-row"><button class="btn" id="vl-adv-apply">Applica di nuovo</button><button class="btn sm" id="vl-adv-reset">Azzera le modifiche avanzate</button></div>';
    body.innerHTML = h;
  }

  /* ---------- elaborazione ---------- */
  function schedule(delay) { clearTimeout(timer); timer = setTimeout(function () { var t = api.activeTake(); if (t) applyTake(t, {}); }, delay == null ? 700 : delay); setStatus('Cambiato: applico tra un istante…'); }
  async function applyTake(t, o) {
    o = o || {};
    if (!t || !t.mono) return;
    if (busy) { pending = { t: t, o: o }; return; }
    busy = true; $('#vl-auto').disabled = true; $('#vl-apply').disabled = true;
    var started = Date.now(), recMsgBase = o.recMsg ? o.recMsg.innerHTML : null;
    function say(m) { setStatus(m); if (o.recMsg) o.recMsg.innerHTML = recMsgBase + '<br>' + esc(m); }
    try {
      say('Analizzo la registrazione…'); setBar(0.02); await api.tick();
      if (!t.vlInfo || o.reanalyze) t.vlInfo = VC.analyzeVoice(t.mono, t.sr);
      var info = t.vlInfo, auto = VC.autoSettings(info), e = expand(), key, uncertain = false;
      if (t.vlKey) key = t.vlKey;
      else if (info.key && info.key.confidence !== 'bassa') key = { tonic: info.key.tonic, mode: info.key.mode };
      else { key = { tonic: info.key ? info.key.tonic : 0, mode: 'cromatica' }; uncertain = true; }
      var macros = Object.assign({}, e.macros);
      if (macros.intensity === undefined && auto.intensityScale < 1) macros.intensity = Math.round(VC.combineMacros(e.ids).intensity * auto.intensityScale);
      var built = VC.buildParams({ ids: e.ids, macros: macros, advanced: e.advanced, auto: auto, keyOverride: key });
      lastBuilt = built;
      var res = await VC.renderAsync(t.mono, t.sr, built.params, { bpm: api.bpm() }, function (label, f) { say(label + '…'); setBar(0.05 + f * 0.85); });
      say('Misuro il risultato…'); setBar(0.93); await api.tick();
      var mask = AT.scaleMask(key.tonic, key.mode);
      var before = AT.measure(t.mono, t.sr, { mask: mask, track: info.trackRes }), after = AT.measure(res.samples, t.sr, { mask: mask });
      t.final = res.samples; t.finalRes = AA.analyze(res.samples, t.sr, { maxSeconds: 120 }); t.vlBuf = null;
      var names = e.ids.map(function (id) { var c = VC.CHARACTERS.filter(function (x) { return x.id === id; })[0]; return c ? c.label : id; });
      t.vl = { ids: e.ids, report: res.report, params: res.params, built: built, key: key, uncertain: uncertain, before: before, after: after, mask: mask, notes: auto.notes.slice(), ms: Date.now() - started, label: names.join(' + ') };
      t.finalHtml = '<p class="small muted">Voice Lab: ' + esc(t.vl.label) + '. Ascolta "Prima" e "Dopo" nel riquadro Voice Lab.</p>';
      api.refresh(t); renderResult(t); renderSliders();
      var keyTxt = uncertain ? 'tonalità incerta (tutte le note)' : api.NOTES[key.tonic] + ' ' + key.mode;
      var done = 'Fatto in ' + f1((Date.now() - started) / 1000) + ' s: ' + t.vl.label + ', ' + keyTxt + '. Ascolta Prima e Dopo.';
      setStatus(done); if (o.recMsg) o.recMsg.innerHTML = recMsgBase + '<br>' + esc(done) + (uncertain ? ' <b>Non sono sicuro della tonalità: aprila qui sotto e scegli la tua.</b>' : '') + ' <a href="#voce" data-vl-go="1">Vai al Voice Lab</a>';
      if (!info.voicedShare || info.voicedShare < 0.03) setStatus('Non ho trovato note chiare: ho applicato solo pulizia ed effetti, senza correggere l\'intonazione.', 'err');
    } catch (err) {
      setStatus('Qualcosa è andato storto durante l\'elaborazione (' + (err && err.message ? err.message : 'errore') + '). Prova con una registrazione più corta.', 'err');
      if (typeof console !== 'undefined') console.warn('VoiceLab', err);
    }
    setBar(null); busy = false; $('#vl-auto').disabled = false; $('#vl-apply').disabled = false;
    if (pending) { var p = pending; pending = null; applyTake(p.t, p.o); }
  }

  /* ---------- ascolto Prima / Dopo (stesso volume) ---------- */
  var AB = { src: null, which: null, t0: 0, off: 0, ctx: null, gain: null };
  function abStop() { if (AB.src) { var s = AB.src; AB.src = null; try { s.onended = null; s.stop(); } catch (e) {} } AB.which = null; var bs = ['#vl-a', '#vl-b', '#vl-ab']; bs.forEach(function (x) { var b = $(x); if (b) b.classList.remove('on'); }); var ab = $('#vl-ab'); if (ab) ab.textContent = 'Alterna A/B'; }
  function abPos() { return AB.src ? AB.off + Math.max(0, AB.ctx.currentTime - AB.t0) : 0; }
  function abPlay(which, from) {
    var t = api.activeTake(); if (!t || !t.final) { setStatus('Prima applica un carattere (premi Auto).'); return; }
    var ctx = api.getCtx(); if (!ctx) return;
    abStop(); api.stopPlay();
    var eq = $('#vl-eq').checked, g = eq ? VC.matchGains(t.mono, t.final, t.sr) : { a: 1, b: 1 };
    var src = ctx.createBufferSource(), gn = ctx.createGain(), data = which === 'a' ? t.mono : t.final;
    src.buffer = api.makeBuffer(ctx, data, t.sr); gn.gain.value = which === 'a' ? g.a : g.b; src.connect(gn); gn.connect(ctx.destination);
    var off = Math.min(from || 0, data.length / t.sr - 0.05), t0 = ctx.currentTime + 0.03;
    AB = { src: src, which: which, t0: t0, off: Math.max(0, off), ctx: ctx, gain: gn };
    src.onended = function () { if (AB.src === src) abStop(); };
    src.start(t0, AB.off);
    $(which === 'a' ? '#vl-a' : '#vl-b').classList.add('on');
    $('#vl-ab').textContent = 'Ora senti: ' + (which === 'a' ? 'PRIMA' : 'DOPO') + ' · tocca per cambiare';
    $('#vl-abinfo').textContent = eq ? 'Volumi pareggiati (circa ' + f1(g.rmsDb) + ' dB di media, misurato sulle parti con voce).' : 'Volumi originali: il "dopo" può essere più forte e sembrare migliore solo per questo.';
  }
  function abInfo() { var el = $('#vl-abinfo'); if (el && !AB.src) el.textContent = ''; }

  /* ---------- monitor in tempo reale (sperimentale) ---------- */
  var MON = { on: false, stream: null, node: null, proc: null, core: null, src: null, gain: null, ctx: null, lat: null, url: null };
  function monMsg(m, err) { var el = $('#vl-mon-msg'); if (el) { el.textContent = m; el.className = 'status' + (err ? ' err' : ''); } }
  function monParams() { return { enabled: $('#vl-mon-on').checked, strength: +$('#vl-mon-s').value / 100, retuneMs: +$('#vl-mon-r').value, tonic: +$('#vl-mon-t').value, mode: $('#vl-mon-m').value }; }
  function monPush() { var p = monParams(); if (MON.node && MON.node.port) MON.node.port.postMessage(p); if (MON.core) MON.core.setParams(p); }
  function monLatency(algoMs, detMs) {
    var ctx = MON.ctx, base = ctx.baseLatency != null ? ctx.baseLatency * 1000 : null, outL = ctx.outputLatency != null && ctx.outputLatency > 0 ? ctx.outputLatency * 1000 : null;
    var inL = null; try { var s = MON.stream.getAudioTracks()[0].getSettings(); if (s.latency) inL = s.latency * 1000; } catch (e) {}
    var sys = (base || 0) + (outL || 0) + (inL || 0), tot = sys + algoMs;
    var h = '<ul class="clean small"><li><b>Calcolo del monitor</b>: ' + f1(algoMs) + ' ms <span class="tag m">Misurato</span> (+ circa ' + f1(detMs) + ' ms per capire l\'altezza)</li>' +
      '<li><b>Audio del sistema</b>: ' + (base != null ? 'buffer ' + f1(base) + ' ms' : 'non dichiarato') + (outL != null ? ' + uscita ' + f1(outL) + ' ms' : (base != null ? ', uscita non dichiarata da questo browser' : '')) + (inL != null ? ' + microfono ' + f1(inL) + ' ms' : '') + ' <span class="tag a">Dichiarato dal browser</span></li>' +
      '<li><b>Totale stimato</b>: circa ' + f1(tot) + ' ms ' + (tot > 30 ? '(alto: può dare fastidio cantando)' : '(accettabile)') + '. Non include cuffie Bluetooth, né il ritardo reale del microfono se il browser non lo dichiara. <span class="tag i">Ipotesi</span></li></ul>';
    $('#vl-mon-lat').innerHTML = h; MON.lat = { algoMs: algoMs, sysMs: sys, totalMs: tot };
  }
  async function monStart() {
    if (MON.on) return;
    if (!api.micOk()) { monMsg('Il microfono non è disponibile in questa pagina. Apri il sito da Safari.', true); return; }
    var ctx = api.getCtx(); if (!ctx) { monMsg('Questo browser non supporta l\'audio.', true); return; }
    monMsg('Chiedo il permesso del microfono…');
    var stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1, latency: 0 } }); }
    catch (e) { monMsg('Il microfono non parte (' + (e && e.name ? e.name : 'errore') + '). Su iPhone: Impostazioni > Safari > Microfono.', true); return; }
    MON.ctx = ctx; MON.stream = stream; MON.src = ctx.createMediaStreamSource(stream);
    MON.gain = ctx.createGain(); MON.gain.gain.value = +$('#vl-mon-v').value / 100; MON.gain.connect(ctx.destination);
    var p = monParams(), mode = 'worklet';
    try {
      if (!ctx.audioWorklet || typeof AudioWorkletNode === 'undefined') throw new Error('no worklet');
      MON.url = URL.createObjectURL(new Blob([RT.workletSource()], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(MON.url);
      MON.node = new AudioWorkletNode(ctx, 'vl-rt', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: p });
      var core0 = RT.createCore(ctx.sampleRate, p);
      MON.node.port.onmessage = function (ev) { var d = ev.data || {}; var s = $('#vl-mon-msg'); if (s) s.textContent = d.voiced ? 'Sento una nota: ' + Math.round(d.f0) + ' Hz, correzione ' + Math.round(d.cents) + ' cent.' : 'Nessuna nota chiara (silenzio o rumore).'; };
      MON.src.connect(MON.node); MON.node.connect(MON.gain); monLatency(core0.getLatencyMs(), core0.detectDelayMs);
    } catch (e) {
      mode = 'script';
      if (!ctx.createScriptProcessor) { monMsg('Questo browser non supporta il monitor.', true); monStop(); return; }
      MON.core = RT.createCore(ctx.sampleRate, p); MON.proc = ctx.createScriptProcessor(1024, 1, 1);
      MON.proc.onaudioprocess = function (ev) { MON.core.process(ev.inputBuffer.getChannelData(0), ev.outputBuffer.getChannelData(0)); };
      MON.src.connect(MON.proc); MON.proc.connect(MON.gain);
      monLatency(MON.core.getLatencyMs() + 1024 / ctx.sampleRate * 1000, MON.core.detectDelayMs);
    }
    MON.on = true; MON.mode = mode; $('#vl-mon-go').hidden = true; $('#vl-mon-stop').hidden = false;
    monMsg('Monitor attivo (' + (mode === 'worklet' ? 'AudioWorklet' : 'modo di riserva, più ritardo') + '). Canta con le cuffie con filo.');
  }
  function monStop() {
    try { if (MON.src) MON.src.disconnect(); if (MON.node) { MON.node.disconnect(); MON.node.port.onmessage = null; } if (MON.proc) { MON.proc.disconnect(); MON.proc.onaudioprocess = null; } if (MON.gain) MON.gain.disconnect(); } catch (e) {}
    if (MON.stream) MON.stream.getTracks().forEach(function (tr) { tr.stop(); });
    if (MON.url) { try { URL.revokeObjectURL(MON.url); } catch (e) {} }
    MON.on = false; MON.stream = MON.node = MON.proc = MON.core = MON.src = MON.gain = MON.url = null;
    var g = $('#vl-mon-go'); if (g) { g.hidden = false; $('#vl-mon-stop').hidden = true; } monMsg('Monitor spento.');
  }


  /* ---------- Mic 2: autotune dal vivo DURANTE la registrazione (due uscite: cuffia e registratore) ---------- */
  function liveParams() {
    var st = ($('#rec-live-st') ? $('#rec-live-st').value : '80,15').split(','), strength = +st[0] / 100, ret = +st[1];
    return { enabled: true, strength: strength, retuneMs: ret, tonic: +($('#rec-live-t') ? $('#rec-live-t').value : 0), mode: $('#rec-live-m') ? $('#rec-live-m').value : 'cromatica' };
  }
  // mic = nodo sorgente del microfono già creato dall'app. Restituisce { wetStream, stop(), mode, latencyMs } oppure null.
  async function liveAttach(ctx, mic) {
    if (MON.on) monStop();
    var p = liveParams(), L = { nodes: [], url: null }, dest = ctx.createMediaStreamDestination(), out = ctx.createGain();
    out.gain.value = 1; out.connect(dest); out.connect(ctx.destination);
    var mode = 'worklet', core0 = RT.createCore(ctx.sampleRate, p), latMs = core0.getLatencyMs();
    try {
      if (!ctx.audioWorklet || typeof AudioWorkletNode === 'undefined') throw new Error('no worklet');
      L.url = URL.createObjectURL(new Blob([RT.workletSource()], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(L.url);
      var node = new AudioWorkletNode(ctx, 'vl-rt', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: p });
      mic.connect(node); node.connect(out); L.nodes.push(node);
    } catch (e) {
      mode = 'script';
      if (!ctx.createScriptProcessor) return null;
      var core = RT.createCore(ctx.sampleRate, p), proc = ctx.createScriptProcessor(1024, 1, 1);
      proc.onaudioprocess = function (ev) { core.process(ev.inputBuffer.getChannelData(0), ev.outputBuffer.getChannelData(0)); };
      mic.connect(proc); proc.connect(out); L.nodes.push(proc); latMs += 1024 / ctx.sampleRate * 1000;
    }
    return { wetStream: dest.stream, mode: mode, latencyMs: latMs, stop: function () {
      try { L.nodes.forEach(function (n) { n.disconnect(); if (n.onaudioprocess) n.onaudioprocess = null; }); out.disconnect(); } catch (e) {}
      if (L.url) { try { URL.revokeObjectURL(L.url); } catch (e) {} }
    } };
  }

  /* ---------- eventi ---------- */
  function wire() {
    $('#vl-auto').addEventListener('click', function () { var t = api.activeTake(); if (!t) { setStatus('Prima registra o importa una voce.'); return; } st.macros = {}; st.advanced = {}; save(); renderSliders(); applyTake(t, { reanalyze: true }); });
    $('#vl-apply').addEventListener('click', function () { var t = api.activeTake(); if (t) applyTake(t, {}); });
    $('#vl-reset').addEventListener('click', function () { st.macros = {}; st.advanced = {}; save(); renderSliders(); buildAdvanced(); var t = api.activeTake(); if (t) schedule(200); });
    $('#vl-chips').addEventListener('click', function (e) {
      var id = e.target.getAttribute('data-ch'); if (!id) return;
      var i = st.ids.indexOf(id); if (i === -1) st.ids.push(id); else if (st.ids.length > 1) st.ids.splice(i, 1);
      st.macros = {}; st.advanced = {}; save(); renderChips(); renderSliders(); buildAdvanced(); schedule();
    });
    $('#vl-sliders').addEventListener('input', function (e) { var k = e.target.getAttribute('data-mc'); if (!k) return; st.macros[k] = +e.target.value; var ex = expand(); var b = VC.buildParams({ ids: ex.ids, macros: ex.macros, advanced: ex.advanced }); $('#vl-mv-' + k).textContent = MDESC[k](b.params); });
    $('#vl-sliders').addEventListener('change', function (e) { if (e.target.getAttribute('data-mc')) { save(); schedule(); } });
    $('#vl-save').addEventListener('click', function () {
      var name = ($('#vl-name').value || '').trim() || ('Mio ' + (st.mine.length + 1)), m = chosenMacros(), e = expand();
      st.mine.push(VC.serializeState({ ids: e.ids, macros: m, advanced: e.advanced, name: name })); if (st.mine.length > 20) st.mine.shift();
      st.ids = ['mine:' + (st.mine.length - 1)]; st.macros = {}; st.advanced = {}; save(); $('#vl-name').value = ''; renderChips(); renderSliders(); setStatus('Salvato "' + name + '": lo trovi tra i caratteri con la stella.');
    });
    $('#vl-del').addEventListener('click', function () {
      var mi = st.ids.filter(function (i) { return /^mine:/.test(i); }).map(function (i) { return +i.slice(5); }).sort(function (a, b) { return b - a; });
      mi.forEach(function (i) { st.mine.splice(i, 1); }); st.ids = ['melodico']; st.macros = {}; st.advanced = {}; save(); renderChips(); renderSliders(); setStatus('Carattere eliminato.');
    });
    $('#vl-a').addEventListener('click', function () { abPlay('a', 0); });
    $('#vl-b').addEventListener('click', function () { abPlay('b', 0); });
    $('#vl-ab').addEventListener('click', function () { var t = api.activeTake(); if (!t || !t.final) { setStatus('Prima applica un carattere (premi Auto).'); return; } var pos = abPos(); abPlay(AB.which === 'b' ? 'a' : 'b', AB.src ? pos : 0); });
    $('#vl-stop').addEventListener('click', function () { abStop(); });
    $('#vl-eq').addEventListener('change', function () { if (AB.src) abPlay(AB.which, abPos()); });
    $('#vl-key').addEventListener('click', function (e) {
      var t = api.activeTake(); if (!t) return;
      if (e.target.id === 'vl-kgo') { t.vlKey = { tonic: +$('#vl-kt').value, mode: $('#vl-km').value }; applyTake(t, {}); }
      if (e.target.id === 'vl-kauto') { t.vlKey = null; applyTake(t, {}); }
    });
    $('#vl-adv').addEventListener('toggle', function () { if (this.open) buildAdvanced(); });
    $('#vl-advbody').addEventListener('input', function (e) {
      var p = e.target.getAttribute('data-ap'); if (!p) return; var g = p.split('.'), v = e.target.type === 'checkbox' ? e.target.checked : (e.target.tagName === 'SELECT' ? e.target.value : +e.target.value);
      st.advanced[g[0]] = st.advanced[g[0]] || {}; st.advanced[g[0]][g[1]] = v; var out = $('#' + e.target.id + '-v'); if (out) out.textContent = f1(v); save();
    });
    $('#vl-advbody').addEventListener('click', function (e) {
      if (e.target.id === 'vl-adv-apply') { var t = api.activeTake(); if (t) applyTake(t, {}); }
      if (e.target.id === 'vl-adv-reset') { st.advanced = {}; save(); buildAdvanced(); renderSliders(); }
    });
    // monitor
    $('#vl-mon-t').innerHTML = api.NOTES.map(function (n, i) { return '<option value="' + i + '">' + n + '</option>'; }).join('');
    var lt = $('#rec-live-t'); if (lt) lt.innerHTML = $('#vl-mon-t').innerHTML;
    $('#vl-mon-go').addEventListener('click', monStart); $('#vl-mon-stop').addEventListener('click', monStop);
    ['#vl-mon-on', '#vl-mon-t', '#vl-mon-m'].forEach(function (s) { $(s).addEventListener('change', monPush); });
    $('#vl-mon-s').addEventListener('input', function () { $('#vl-mon-sv').textContent = this.value + '%'; monPush(); });
    $('#vl-mon-r').addEventListener('input', function () { $('#vl-mon-rv').textContent = this.value + ' ms'; monPush(); });
    $('#vl-mon-v').addEventListener('input', function () { $('#vl-mon-vv').textContent = this.value + '%'; if (MON.gain) MON.gain.gain.value = this.value / 100; });
    window.addEventListener('resize', function () { var t = api.activeTake(); if (t && t.vl) drawChart(t); });
  }

  /* ---------- API pubblica ---------- */
  function init(a) {
    api = a; load();
    var r = document.getElementById('vl-root'), m = document.getElementById('vl-mon-root');
    if (!r || !m) return;
    r.innerHTML = html(); m.innerHTML = featHtml() + monHtml();
    renderChips(); renderSliders(); wire();
  }
  function onNewTake(t, recMsg) {
    if (!api || !t) return;
    applyTake(t, { reanalyze: true, recMsg: recMsg || null });
  }
  function onSelect(t) { if (!api || !$('#vl-card')) return; renderResult(t && t.vl ? t : null); if (t && !t.vl) setStatus('Premi Auto per intonare e rifinire questa voce.'); else if (t && t.vl) setStatus('Ultima elaborazione: ' + t.vl.label + '.'); abStop(); }
  function stop() { abStop(); }
  root.VoiceLab = { liveAttach: liveAttach, liveParams: liveParams, init: init, onNewTake: onNewTake, onSelect: onSelect, stop: stop, monitorStop: monStop, _state: function () { return { st: st, busy: busy, mon: MON, built: lastBuilt }; }, _apply: applyTake };
})(typeof self !== 'undefined' ? self : this);
