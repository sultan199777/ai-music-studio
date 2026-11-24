/*
 * Coach: impara dai tuoi gesti e ti insegna. Gira tutto sul telefono, senza servizi a pagamento.
 *
 * 1. IMPARA (preferenze): ogni gesto è un voto.
 *    mi piace +3 · non mi piace -3 · base salvata +2 · voce registrata sulla base +2 ·
 *    ascoltata fino alla fine +0,5 · "nuova variante" entro 10 s -1 · strumento cambiato: vecchio -1, nuovo +0,5
 *    I voti vanno su caratteristiche (stile, scala, velocità, strumento per ruolo) sia in generale
 *    sia legate all'emozione del testo. I voti vecchi pesano un po' meno (decadimento 2% a gesto).
 * 2. PROPONE: sceglie gli strumenti con punteggio = esperienza di mestiere (ricette) + quello che ha
 *    imparato di te. Ogni tanto (20%) ti fa provare qualcosa di nuovo, e te lo dice.
 * 3. INSEGNA: controlla misure reali (voce, mix, testo) e ti spiega cosa non va, perché, e come
 *    rimediare, con un'azione da un tocco. Tiene il conto delle abilità che hai imparato.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Coach = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var W = { like: 3, dislike: -3, save: 2, record: 2, complete: 0.5, skip: -1 };
  var DECAY = 0.98, ROLES = ['melodia', 'accordi', 'pad'];

  function fresh() { return { v: 1, n: 0, prefs: {}, tries: {}, skills: {}, log: [] }; }
  function bpmBucket(b) { return Math.round((b || 100) / 10) * 10; }
  function features(ctx) {
    var f = [];
    if (ctx.genre) f.push('genre:' + ctx.genre);
    if (ctx.mode) f.push('mode:' + ctx.mode);
    if (ctx.bpm) f.push('bpm:' + bpmBucket(ctx.bpm));
    ROLES.forEach(function (r) { if (ctx.inst && ctx.inst[r]) f.push('inst.' + r + ':' + ctx.inst[r]); });
    if (ctx.emotion) f.slice().forEach(function (x) { f.push(ctx.emotion + '|' + x); });
    return f;
  }
  function bump(st, feats, w) {
    Object.keys(st.prefs).forEach(function (k) { st.prefs[k] *= DECAY; if (Math.abs(st.prefs[k]) < 0.01) delete st.prefs[k]; });
    feats.forEach(function (k) { st.prefs[k] = (st.prefs[k] || 0) + w; });
  }
  /** Registra un gesto. type: like|dislike|save|record|complete|skip|change ; ctx: {genre,mode,bpm,inst,emotion}; extra per change: {role, from, to} */
  function record(st, type, ctx, extra) {
    st = st || fresh(); ctx = ctx || {};
    if (type === 'change' && extra) {
      var e = ctx.emotion ? ctx.emotion + '|' : '';
      if (extra.from) bump(st, ['inst.' + extra.role + ':' + extra.from, e + 'inst.' + extra.role + ':' + extra.from], -1);
      if (extra.to) bump(st, ['inst.' + extra.role + ':' + extra.to, e + 'inst.' + extra.role + ':' + extra.to], 0.5);
    } else if (W[type] != null) bump(st, features(ctx), W[type]);
    ROLES.forEach(function (r) { if (ctx.inst && ctx.inst[r]) st.tries[ctx.inst[r]] = (st.tries[ctx.inst[r]] || 0) + (type === 'complete' || type === 'like' || type === 'save' ? 1 : 0); });
    st.n++;
    st.log.push({ t: type, g: ctx.genre, i: ctx.inst ? ROLES.map(function (r) { return ctx.inst[r] || ''; }).join(',') : '' });
    if (st.log.length > 200) st.log = st.log.slice(-200);
    return st;
  }
  function score(st, key, emotion) { return (st.prefs[key] || 0) + (emotion ? (st.prefs[emotion + '|' + key] || 0) * 1.5 : 0); }

  /**
   * Propone strumenti per ogni ruolo.
   * cands: {melodia:[{id, prior}], ...} (prior = esperienza di mestiere, 0-3); opt: {emotion, seed}
   */
  function suggest(st, cands, opt) {
    st = st || fresh(); opt = opt || {};
    var s = Math.imul((opt.seed || 1) >>> 0, 2654435761) >>> 0, rnd = function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; rnd();
    var out = { inst: {}, why: [], explore: null };
    ROLES.forEach(function (r) {
      var list = (cands[r] || []).map(function (c) { var learned = score(st, 'inst.' + r + ':' + c.id, opt.emotion); return { id: c.id, prior: c.prior || 0, learned: learned, total: (c.prior || 0) + learned }; });
      if (!list.length) return;
      list.sort(function (a, b) { return b.total - a.total; });
      var best = list[0];
      out.inst[r] = best.id;
      if (best.learned > 0.5) out.why.push(r + ': ' + best.id + ' perché ti è piaciuto (punteggio ' + best.learned.toFixed(1) + ')');
      else if (best.learned < -0.5) out.why.push(r + ': ' + best.id + ' anche se l\'hai scartato: le alternative sono andate peggio');
      else out.why.push(r + ': ' + best.id + ' (scelta di mestiere per questo stile)');
    });
    if (st.n >= 5 && rnd() < 0.2) { // esplorazione: un ruolo prova lo strumento meno provato tra i buoni
      var r = ROLES[Math.floor(rnd() * ROLES.length)], pool = (cands[r] || []).filter(function (c) { return (c.prior || 0) >= 0.5 && c.id !== out.inst[r] && score(st, 'inst.' + r + ':' + c.id, opt.emotion) > -2; });
      pool.sort(function (a, b) { return (st.tries[a.id] || 0) - (st.tries[b.id] || 0); });
      if (pool.length) { out.explore = { role: r, from: out.inst[r], to: pool[0].id }; out.inst[r] = pool[0].id; out.why.push('Ti faccio provare ' + pool[0].id + ' per ' + r + ': non l\'hai quasi mai sentito. Se non ti piace, dimmelo con "Non mi piace".'); }
    }
    return out;
  }

  /** Cosa ha imparato: le caratteristiche più amate e più scartate. names(key) -> testo leggibile. */
  function profile(st, names) {
    st = st || fresh(); names = names || function (k) { return k; };
    var items = Object.keys(st.prefs).filter(function (k) { return k.indexOf('|') < 0; }).map(function (k) { return { k: k, v: st.prefs[k] }; });
    items.sort(function (a, b) { return b.v - a.v; });
    return { gesti: st.n, piace: items.filter(function (x) { return x.v > 0.8; }).slice(0, 6).map(function (x) { return names(x.k); }), scarti: items.filter(function (x) { return x.v < -0.8; }).slice(-4).reverse().map(function (x) { return names(x.k); }) };
  }

  // ---------- lezioni ----------
  var SKILLS = {
    livelli: 'Livelli e distorsione', mix: 'Equilibrio voce-base', intonazione: 'Intonazione', tonalita: 'Tonalità voce-base',
    flow: 'Testo e tempo (flow)', arrangiamento: 'Spazio per la voce', struttura: 'Struttura della canzone', varieta: 'Ricerca del suono'
  };
  function compatible(a, b) { // stessa tonalità o relativa (Do maggiore = La minore)
    if (!a || !b) return true;
    if (a.tonic === b.tonic && a.mode === b.mode) return true;
    var rel = function (k) { return k.mode === 'maggiore' ? (k.tonic + 9) % 12 : (k.tonic + 3) % 12; };
    return a.mode !== b.mode && rel(a) === b.tonic;
  }
  /**
   * Controlla le misure e restituisce le lezioni. m (tutto facoltativo):
   *  take: {peakDb, rmsDb, clippingShare, cents, voiced, key:{tonic,mode,confidence,name}}
   *  base: {tonic, mode, bpm, bars, melodia (livello 0-1.8), name}
   *  mixDb: livello voce - livello base (dB) · lines: [{text, need}] (need = battute necessarie)
   *  modesSet: numero righe con modo scelto · recentInst: ultimi strumenti melodia (array)
   */
  function lessons(m) {
    m = m || {}; var L = [], checked = [];
    var add = function (o) { L.push(o); };
    if (m.take) {
      checked.push('livelli', 'intonazione');
      if (m.take.clippingShare > 0.001 || m.take.peakDb > -0.3) add({ id: 'clip', skill: 'livelli', level: 'errore', title: 'La voce distorce', what: 'Picco ' + m.take.peakDb.toFixed(1) + ' dB, campioni al massimo: ' + (m.take.clippingShare * 100).toFixed(2) + '%.', why: 'Quando il segnale tocca il massimo l\'onda viene tagliata: si sente un "gracchio" che nessun effetto può togliere dopo.', how: 'Allontanati 15-20 cm dal microfono o canta un po\' più piano nei punti forti. Riprova la registrazione.' });
      if (m.take.cents != null && m.take.voiced > 0.2) {
        if (m.take.cents > 35) add({ id: 'pitch', skill: 'intonazione', level: 'errore', title: 'Intonazione da sistemare', what: 'In media sei a ' + Math.round(m.take.cents) + ' cent dalla nota (100 cent = un semitono).', why: 'Oltre 30-35 cent l\'orecchio sente la stonatura, soprattutto sulle note lunghe.', how: 'Usa l\'autotune nella pagina Voce con correzione forte, oppure riascolta la melodia guida e canta le note lunghe più ferme.', fix: { type: 'autotune' } });
        else if (m.take.cents > 20) add({ id: 'pitch2', skill: 'intonazione', level: 'consiglio', title: 'Intonazione quasi a posto', what: 'Scostamento medio ' + Math.round(m.take.cents) + ' cent.', why: 'Va bene per il parlato e il rap; nel cantato una correzione leggera rende più pulito.', how: 'Autotune con velocità media (naturale), non robotico.', fix: { type: 'autotune' } });
      }
      if (m.take.key && m.take.key.confidence !== 'bassa' && m.base) {
        checked.push('tonalita');
        if (!compatible(m.take.key, m.base)) add({ id: 'key', skill: 'tonalita', level: 'errore', title: 'Voce e base in tonalità diverse', what: 'La voce sembra in ' + m.take.key.name + ', la base è in ' + m.base.name + '.', why: 'Se le note della voce non stanno nella scala della base, alcune parole suonano "storte" anche se canti bene.', how: 'Porta la base nella tonalità della tua voce: è più facile che cambiare il modo in cui canti.', fix: { type: 'key', tonic: m.take.key.tonic, mode: m.take.key.mode } });
      }
    }
    if (m.mixDb != null) {
      checked.push('mix');
      if (m.mixDb < -3) add({ id: 'quiet', skill: 'mix', level: 'errore', title: 'Voce troppo bassa nel mix', what: 'La voce è ' + Math.abs(m.mixDb).toFixed(1) + ' dB sotto la base.', why: 'Nel rap e nella trap la voce sta davanti: se la base la copre, il testo non si capisce.', how: 'Alza la voce o abbassa la base di qualche dB.', fix: { type: 'voicegain', delta: Math.min(6, -m.mixDb + 1) } });
      else if (m.mixDb > 9) add({ id: 'loud', skill: 'mix', level: 'consiglio', title: 'Voce molto sopra la base', what: 'La voce è ' + m.mixDb.toFixed(1) + ' dB sopra la base.', why: 'Troppo distacco fa sembrare la voce "appoggiata" e non dentro la canzone.', how: 'Abbassa un po\' la voce o aggiungi riverbero.', fix: { type: 'voicegain', delta: -3 } });
    }
    if (m.base && m.take && m.base.melodia >= 0.95) {
      checked.push('arrangiamento');
      add({ id: 'clash', skill: 'arrangiamento', level: 'consiglio', title: 'La melodia della base parla sopra di te', what: 'Melodia guida al ' + Math.round(m.base.melodia * 100) + '% mentre canti.', why: 'Due melodie insieme si disturbano: l\'orecchio non sa chi seguire.', how: 'Abbassa la melodia guida al 50-60% quando c\'è la voce (nel ritornello resta come colore).', fix: { type: 'level', key: 'melodia', value: 0.55 } });
    }
    if (m.lines && m.lines.length) {
      checked.push('flow');
      var dense = m.lines.filter(function (l) { return l.need > 4.2; });
      if (dense.length) add({ id: 'dense', skill: 'flow', level: 'consiglio', title: 'Righe troppo piene per questo tempo', what: dense.length + ' righe richiedono più di 4 battute (es. "' + dense[0].text.slice(0, 40) + '").', why: 'Una riga troppo lunga costringe a correre: le parole si mangiano e il ritmo si perde.', how: 'Dividi la riga in due, oppure segnala "parla" (rap) nella Guida alla voce, oppure rallenta la base.', fix: { type: 'parla', lines: dense.map(function (l) { return l.text; }) } });
    }
    if (m.base && m.lines && m.lines.length >= 6) {
      checked.push('struttura');
      if (m.base.bars < 16) add({ id: 'short', skill: 'struttura', level: 'consiglio', title: 'Base più corta del testo', what: 'La base ha ' + m.base.bars + ' battute per ' + m.lines.length + ' righe.', why: 'Con poche battute non c\'è spazio per strofa, ritornello e respiro: la canzone sembra un loop.', how: 'Fai durare la base quanto il testo.', fix: { type: 'follow' } });
    }
    if (m.recentInst && m.recentInst.length >= 6) {
      checked.push('varieta');
      var same = m.recentInst.slice(-6).every(function (x) { return x === m.recentInst[m.recentInst.length - 1]; });
      if (same) add({ id: 'same', skill: 'varieta', level: 'consiglio', title: 'Sempre lo stesso strumento', what: 'Le ultime 6 basi usano tutte ' + m.recentInst[m.recentInst.length - 1] + ' per la melodia.', why: 'Il tuo suono si riconosce anche dalle scelte nuove: prova un originale del Laboratorio.', how: 'Premi "Crea con il Coach": ti farò provare qualcosa di diverso.' });
    }
    return { lessons: L, checked: checked };
  }
  /** Aggiorna le abilità: un'abilità è imparata dopo 3 controlli di fila senza errori. */
  function learn(st, res) {
    st = st || fresh();
    var bad = {}; res.lessons.forEach(function (l) { bad[l.skill] = true; });
    res.checked.forEach(function (k) {
      var s = st.skills[k] || (st.skills[k] = { ok: 0, ko: 0, streak: 0 });
      if (bad[k]) { s.ko++; s.streak = 0; } else { s.ok++; s.streak++; }
    });
    return st;
  }
  function progress(st) {
    st = st || fresh();
    var list = Object.keys(SKILLS).map(function (k) { var s = st.skills[k] || { ok: 0, ko: 0, streak: 0 }; return { id: k, nome: SKILLS[k], ok: s.ok, ko: s.ko, streak: s.streak, imparata: s.streak >= 3 }; });
    var n = list.filter(function (x) { return x.imparata; }).length;
    var lv = ['Principiante', 'Apprendista', 'Producer in crescita', 'Producer', 'Producer autonomo'][Math.min(4, Math.floor(n / 2))];
    return { skills: list, imparate: n, totale: list.length, livello: lv };
  }

  return { fresh: fresh, record: record, suggest: suggest, profile: profile, lessons: lessons, learn: learn, progress: progress, features: features, compatible: compatible, SKILLS: SKILLS, WEIGHTS: W };
});
