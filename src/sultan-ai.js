/*
 * Sultan IA: l'assistente con cui parli in ogni pagina. Risponde SUBITO e gratis sul telefono (niente modelli da scaricare),
 * perché ragiona con le misure vere dell'app: sillabe, rime, schema, ripetizioni, emozioni del testo (LyricsEngine),
 * rime del tuo dizionario (WordBank), atmosfere e stili (StylePresets), comandi dello Studio.
 * Impara da te: «ricorda che…», «mi piace…», «non voglio…» diventano memoria (solo frasi tue, salvate sul telefono)
 * e cambiano le scelte successive (stile preferito, cose da evitare).
 * Misurato (25/11): un modello linguistico piccolo nel browser (Qwen3 0,6B) ha risposto male in italiano e in 148 s:
 * per questo qui niente modello generico; un modello vero si collega sul computer (Ollama) quando ci sarà.
 * respond(testo, ctx) è puro: restituisce {reply, actions[]} e l'app esegue le azioni.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SultanAI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function low(s) { return String(s || '').toLowerCase().normalize ? String(s || '').toLowerCase() : String(s || '').toLowerCase(); }
  function pick(a, seed) { return a[Math.abs(seed || 0) % a.length]; }
  var WS = { testo: /testo|scriv|rim[ae]|riga|righe|parol/, base: /\bbase|basi|variant|beat|strument|atmosfer|stile/, voce: /voce|registr|canta|microfon|autotune|omino/, mix: /mix|master|salva|esport|volume|spotify/, libreria: /video|separ|impara da|cartell|youtube|canzon[ei] di/ };

  /* ---------- analisi del testo con numeri ---------- */
  function analyzeLyrics(ctx) {
    var LE = ctx.LyricsEngine, txt = ctx.lyrics || ''; if (!LE || !txt.trim()) return null;
    var a = LE.analyze(txt), lines = [], out = [];
    (a.stanzas || []).forEach(function (st) { st.lines.forEach(function (l) { lines.push({ st: st.label, t: l.text, s: l.metric || l.syllables, r: l.rhyme, last: l.lastWord }); }); });
    if (!lines.length) return null;
    var avg = a.syllables.average, sp = a.syllables.spread;
    out.push('Ho letto ' + lines.length + ' righe in ' + a.stanzas.length + ' parti. Media ' + Math.round(avg) + ' sillabe per riga' + (sp > 3.5 ? ', ma molto diverse tra loro (da ' + a.syllables.min + ' a ' + a.syllables.max + '): sulla base suonerà irregolare.' : ', abbastanza regolari.'));
    var longL = lines.map(function (l, i) { return [l, i]; }).filter(function (x) { return x[0].s > avg + Math.max(3, sp); }).slice(0, 3);
    if (longL.length) out.push('Righe troppo lunghe da cantare a tempo: ' + longL.map(function (x) { return '«' + x[0].t.slice(0, 40) + '» (' + x[0].s + ' sillabe, riga ' + (x[1] + 1) + ')'; }).join('; ') + '. Spezzale dove c\'è la virgola o togli una parola.');
    var shortL = lines.filter(function (l) { return l.s <= 4; }).length; if (shortL >= 3) out.push(shortL + ' righe sono cortissime (4 sillabe o meno): vanno bene come respiro o ad-lib, ma troppe spezzano il flow.');
    // rime: quante righe chiudono in rima con la vicina
    var rh = 0; for (var i = 1; i < lines.length; i++) if (lines[i].r && lines[i].r === lines[i - 1].r) rh++;
    var pct = Math.round(rh / Math.max(1, lines.length - 1) * 100);
    out.push('Rime tra righe vicine: ' + pct + '%' + (pct < 25 ? ' (poche: nel rap e nella trap il ritornello di solito chiude in rima, prova a far rimare almeno le coppie di righe del ritornello).' : pct > 60 ? ' (tante: bene per il rap, attenzione a non diventare prevedibile).' : '.'));
    if (a.chorus && a.chorus.lines && a.chorus.lines.length) out.push('Il ritornello si riconosce (' + a.chorus.lines.length + ' righe ripetute): bene, il gancio c\'è.'); else if (!/\[ritornello\]/i.test(txt)) out.push('Non vedo un ritornello: scrivi [Ritornello] sopra le righe che ripeti, così la base costruisce il drop lì.');
    var em = a.emotions && a.emotions.top ? a.emotions.top : null; if (em) out.push('Emozione che pesa di più: ' + (em.label || em.name || em) + '.');
    (a.suggestions || []).slice(0, 2).forEach(function (s) { out.push(typeof s === 'string' ? s : (s.text || s.msg || '')); });
    return { text: out.filter(Boolean).join('\n'), lines: lines, avg: avg };
  }
  function rhymesFor(word, ctx) {
    if (!ctx.WordBank || !ctx.bank) return null; var r = ctx.WordBank.rhymes(ctx.bank, word, {});
    var full = (r.rhyme || []).map(function (x) { return x.word; }), ass = (r.assonance || []).map(function (x) { return x.word; });
    if (!full.length && !ass.length) return 'Non ho rime per «' + word + '» nel dizionario: più testi scrivi o carichi, più rime imparo.';
    return 'Rime per «' + word + '»: ' + (full.length ? full.slice(0, 12).join(', ') : 'nessuna piena') + (ass.length ? '. Assonanze (suonano simili): ' + ass.slice(0, 10).join(', ') : '') + '.';
  }

  /* ---------- memoria: quello che mi insegni ---------- */
  function learnFrom(text) {
    var t = String(text).trim().replace(/^(ricorda(ti)?( che)?|impara( che)?|tieni a mente( che)?|da ora( in poi)?|d'ora in poi|sappi che)\s*[:,]?\s*/i, '');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  /** Dalla memoria: stile preferito (id atmosfera), stili da evitare, parole chiave. */
  function prefs(memory, presets) {
    var out = { like: [], avoid: [] }, L = (memory || []).map(low);
    (presets || []).forEach(function (p) {
      var keys = [p.id, low(p.nome.replace(/^Tipo /, '').replace(/ \(.*\)$/, ''))].filter(function (k) { return k.length >= 3; });
      L.forEach(function (m) { if (keys.some(function (k) { return m.indexOf(k) >= 0; })) { if (/non (mi piace|voglio)|odio|evita|basta con/.test(m)) out.avoid.push(p.id); else if (/piace|amo|voglio|preferisco|stile|come/.test(m)) out.like.push(p.id); } });
    });
    return out;
  }

  /** Risposta + azioni. ctx: {page, lyrics, summary, memory[], presets[], LyricsEngine, WordBank, bank, seed, mood} */
  function respond(text, ctx) {
    ctx = ctx || {}; var t = low(text).trim(), A = [], seed = ctx.seed || t.length, presets = ctx.presets || [];
    if (!t) return { reply: 'Scrivimi o parlami: posso analizzare il testo, creare basi, cambiare il suono, spiegarti dove trovare le cose. E se mi insegni qualcosa («ricorda che…») lo uso da lì in poi.', actions: [] };
    // emozioni forti: prima la persona
    if (/non ce la faccio|voglio morire|farla finita|non ha senso vivere|sto male davvero|sono disperat/.test(t)) return { reply: 'Ti ascolto. Quello che senti conta più di qualsiasi canzone. Se il peso è troppo, parlane adesso con qualcuno di cui ti fidi o chiama il 112. Se vuoi, scrivilo qui: a volte metterlo in parole aiuta, e io resto.', actions: [] };
    if (/^(grazie|ok grazie|bravo|perfetto)/.test(t)) return { reply: pick(['Grazie a te. Andiamo avanti: cosa facciamo adesso?', 'Bene. Vuoi che ti proponga altre basi o lavoriamo sul testo?'], seed), actions: [] };
    // insegnare / ricordare / dimenticare
    if (/^(ricorda|impara|tieni a mente|da ora|d'ora in poi|sappi che)/.test(t) || /^(mi piace|non mi piace|preferisco|odio|non voglio|voglio sempre)\b/.test(t)) {
      var m = learnFrom(text); A.push({ type: 'remember', text: m });
      var pf = prefs([m], presets), extra = pf.like.length ? ' Da ora parto da «' + pf.like[0] + '» quando non scegli uno stile.' : (pf.avoid.length ? ' Eviterò «' + pf.avoid.join(', ') + '».' : '');
      return { reply: 'Imparato: «' + m + '».' + extra + ' Scrivi «cosa sai di me» per vedere tutto quello che ricordo.', actions: A };
    }
    if (/dimentica le mie preferenze|azzera (le )?preferenze|cancella (le )?preferenze/.test(t)) return { reply: 'Fatto: ho azzerato le preferenze di produzione (pianoforte, profondità, batteria, spazio voce…). La memoria delle frasi che mi hai insegnato resta: per quella usa «dimentica …».', actions: [{ type: 'resetprefs' }] };
    if (/^(dimentica|cancella dalla memoria|scordati)/.test(t)) { var f = t.replace(/^(dimentica|cancella dalla memoria|scordati)\s*(di|che)?\s*/, ''); A.push({ type: 'forget', text: f }); return { reply: f ? 'Tolgo dalla memoria quello che parla di «' + f + '».' : 'Dimmi cosa dimenticare (es. «dimentica Shiva»).', actions: A }; }
    if (/cosa (sai|ricordi) di me|cosa hai imparato|la tua memoria/.test(t)) { var mm = ctx.memory || []; return { reply: mm.length ? 'Ricordo:\n• ' + mm.slice(-15).join('\n• ') : 'Non mi hai ancora insegnato niente. Prova: «ricorda che mi piacciono le basi drill scure» o «non voglio il flauto».', actions: [] }; }
    // rime
    var rm = t.match(/rim[ae]\s+(?:per|con|a|di)\s+([a-zà-ú']+)/) || t.match(/cosa rima con\s+([a-zà-ú']+)/);
    if (rm) return { reply: rhymesFor(rm[1], ctx) || 'Il dizionario delle rime non è pronto.', actions: [] };
    // una riga precisa
    var rg = t.match(/riga\s+(\d+)/);
    if (rg) { var an0 = analyzeLyrics(ctx); if (!an0) return { reply: 'Scrivi prima il testo in 1 Testo.', actions: [{ type: 'go', ws: 'testo' }] }; var L0 = an0.lines[+rg[1] - 1]; if (!L0) return { reply: 'Il testo ha ' + an0.lines.length + ' righe.', actions: [] };
      return { reply: 'Riga ' + rg[1] + ' («' + L0.t + '»): ' + L0.s + ' sillabe, la media è ' + Math.round(an0.avg) + '. ' + (L0.s > an0.avg + 3 ? 'È lunga: spezzala o togli una parola. ' : L0.s < an0.avg - 3 ? 'È corta: può diventare un respiro o un ad-lib, oppure aggiungi un\'immagine. ' : 'La lunghezza va bene. ') + (L0.last ? (rhymesFor(L0.last, ctx) || '') : ''), actions: [] }; }
    // farlo cantare (ACE-Step, tipo Suno)
    if (/(fall[oa]|fammi sentire|fai) cantar|come suonerebbe|cantal[oa]|tipo suno|canta il (mio )?testo/.test(t)) return { reply: 'Lo faccio cantare con ACE-Step (voce IA, tipo Suno) nello stile e nell\'emozione della tua base. Ci vuole circa un minuto; il risultato lo trovi in 2 Base, sotto l\'omino.', actions: [{ type: 'go', ws: 'base' }, { type: 'sing' }] };
    // analisi / migliorare il testo
    if (/analizz|migliora|cosa ne pensi|giudica|com'è il (mio )?testo|correggi|consigli? (sul|per il) testo|valuta/.test(t)) {
      var an = analyzeLyrics(ctx); if (!an) return { reply: 'Non vedo ancora il testo: scrivilo o incollalo in 1 Testo e richiedimelo.', actions: [{ type: 'go', ws: 'testo' }] };
      return { reply: an.text + '\nVuoi le rime per l\'ultima parola di una riga? Scrivi «riga 5».', actions: [] };
    }
    // basi e varianti
    var atm = null; presets.forEach(function (p) { var k = low(p.nome.replace(/^Tipo /, '').replace(/ \(.*\)$/, '')); if (!atm && (t.indexOf(p.id) >= 0 || (k.length >= 4 && t.indexOf(k) >= 0))) atm = p; });
    var nM = t.match(/(\d+)\s*(basi|varianti|versioni|beat)/), n = nM ? Math.max(4, Math.min(24, +nM[1])) : 8;
    if (/(crea|fammi|fai|genera|dammi|propon|voglio)\b.*\b(base|basi|varianti|beat|versioni)/.test(t) || (atm && /(tipo|stile|come|alla)/.test(t))) {
      A.push({ type: 'variants', n: n, atm: atm ? atm.id : null }); A.push({ type: 'go', ws: 'base' });
      return { reply: (atm ? 'Ti creo ' + n + ' basi ' + atm.nome.toLowerCase() + ' (' + (atm.spiega || '') + ')' : 'Ti creo ' + n + ' basi adatte al tuo testo') + '. Le trovi in 2 Base → Varianti: ascoltale con ▶ e scegli con Usa.', actions: A };
    }
    // aiuto: dove si trova…
    if (/dove|come (si fa|faccio|posso)|non trovo|aiut/.test(t)) {
      var ws = null; Object.keys(WS).forEach(function (k) { if (!ws && WS[k].test(t)) ws = k; });
      var H = { testo: 'In 1 Testo scrivi o incolli la canzone; metti [Strofa] e [Ritornello] sopra le parti.', base: 'In 2 Base: «Crea base» fa la base dal testo, Varianti ne crea 8-24 diverse, l\'omino ti mostra come cantare.', voce: 'In 3 Voce: premi ● in alto per registrare sulla base; sotto scegli Mic pulito o Mic autotune.', mix: 'In 4 Mix regoli i volumi e salvi la canzone finita.', libreria: 'In Libreria: scrivi il nome dell\'artista, carica video o canzoni: separo voce e base e imparo lo stile (solo numeri).' };
      if (ws) { A.push({ type: 'go', ws: ws }); return { reply: H[ws] + ' Ti ci porto.', actions: A }; }
      return { reply: 'Il percorso è: 1 Testo → 2 Base → 3 Voce → 4 Mix. Dimmi cosa cerchi (es. «dove sono le varianti», «come registro»).', actions: [] };
    }
    // comandi dello studio (mixer, 808, effetti, voce…): li esegue l'app con le regole dello Studio
    if (ctx.isStudioCommand && ctx.isStudioCommand(text)) return { reply: 'Lo faccio subito nello Studio.', actions: [{ type: 'studio', text: text }] };
    // conversazione libera: rispondo con quello che so della canzone
    var tip = [], an2 = analyzeLyrics(ctx);
    if (an2) tip.push('Sul tuo testo: media ' + Math.round(an2.avg) + ' sillabe per riga.'); if (ctx.summary) tip.push('La base adesso è ' + ctx.summary + '.');
    var pr = prefs(ctx.memory, presets); if (pr.like.length) tip.push('Ricordo che ti piace «' + pr.like[0] + '».');
    return { reply: 'Non sono sicuro di aver capito. ' + tip.join(' ') + '\nPosso: «analizza il testo», «rime per notte», «riga 3», «crea 16 basi tipo Shiva», «808 più lungo», «ricorda che…», «dove sono le varianti».', actions: [] };
  }
  return { respond: respond, analyzeLyrics: analyzeLyrics, prefs: prefs, learnFrom: learnFrom };
});
