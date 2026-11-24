/*
 * AI Producer: trasforma un comando scritto in italiano in modifiche REALI alla base.
 * Riconosce un elenco limitato di richieste (vedi HELP). Quello che non riconosce
 * non viene eseguito: l'app lo passa a Claude come consiglio a parole.
 * Ogni modifica è una funzione pura sullo stato, quindi si può annullare.
 *
 * Stato: { bpm, mode, genre, bassStyle, bars, reverb, levels:{batteria,basso,accordi,pad,melodia} }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ProducerActions = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var LEVEL_KEYS = ['batteria', 'basso', 'accordi', 'pad', 'melodia'];

  var HELP = [
    'più energia / più carica',
    'più emozionante',
    'basso più profondo',
    'più cinematografica',
    'questa parte è troppo vuota',
    'più lenta / più veloce',
    'più malinconica (minore) / più luminosa (maggiore)',
    'senza batteria',
    'più melodia / meno melodia',
    'fammi ascoltare tre alternative',
    'a 140 bpm / in La minore / stile drill (trap, drill, epico, melodico, estate)',
    'togli / rimetti / alza / abbassa cassa, rullante, hi-hat, 808, accordi, pad, melodia',
    'solo il basso e la cassa',
    'senza hi-hat nella strofa / alza l\'808 nel ritornello (intro, strofa, pre, ritornello, bridge, outro)',
    'hi-hat più fitti / più radi'
  ];

  function cloneState(s) {
    var o = JSON.parse(JSON.stringify(s));
    o.levels = o.levels || {};
    LEVEL_KEYS.forEach(function (k) { if (o.levels[k] == null) o.levels[k] = 1; });
    if (o.reverb == null) o.reverb = 0;
    return o;
  }

  function lv(state, key, mult, min, max) {
    var before = state.levels[key];
    state.levels[key] = Math.round(clamp(before * mult, min == null ? 0 : min, max == null ? 1.8 : max) * 100) / 100;
  }


  var TRACKS = [
    ['kick', /\b(cassa|kick)\b/i, 'la cassa'], ['snare', /\b(rullante|snare|clap)\b/i, 'il rullante'],
    ['hat', /\b(hi[\s-]?hat|hihat|charleston|piatti)\b/i, 'l\'hi-hat'], ['bass', /\b(808|basso|bassi|sub)\b/i, 'il basso 808'],
    ['chords', /\b(accord[io]|armonia)\b/i, 'gli accordi'], ['pad', /\bpad\b/i, 'il pad'],
    ['lead', /\b(melodia|lead|ritornello melodico)\b/i, 'la melodia'], ['fx', /\b(effett[io]|riser|impatto)\b/i, 'gli effetti']
  ];
  var SECS = [['intro', /\bintro\b/i], ['strofa', /\bstrof[ae]\b/i], ['pre', /\bpre[\s-]?(ritornello|chorus)?\b/i], ['ritornello', /\britornell[oi]\b/i], ['bridge', /\bbridge\b/i], ['outro', /\b(outro|finale|chiusura)\b/i]];
  var NOTES = { 'do': 0, 're': 2, 'mi': 4, 'fa': 5, 'sol': 7, 'la': 9, 'si': 11 };
  var STYLE_BPM = { trap: 140, drill: 142, epico: 84, melodico: 96, estate: 100, boombap: 90, street: 96, trapdark: 144, clubtrap: 98 };

  function trackIn(t) { for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i][1].test(t)) return TRACKS[i]; return null; }
  function secsIn(t) { var out = []; SECS.forEach(function (x) { if (x[1].test(t)) out.push(x[0]); }); if (out.indexOf('pre') >= 0 && /pre[\s-]?ritornello|pre[\s-]?chorus/i.test(t) === false && out.indexOf('ritornello') >= 0) out.splice(out.indexOf('pre'), 1); return out; }
  function setTrack(s, tr, secs, val, rel) {
    if (secs.length) {
      s.sec = s.sec || {};
      secs.forEach(function (sc) { s.sec[sc] = s.sec[sc] || {}; var cur = s.sec[sc][tr] == null ? 1 : s.sec[sc][tr]; s.sec[sc][tr] = Math.round(clamp(rel ? cur * val : val, 0, 1.8) * 100) / 100; });
    } else {
      s.levels[tr] = Math.round(clamp(rel ? (s.levels[tr] == null ? 1 : s.levels[tr]) * val : val, 0, 1.8) * 100) / 100;
    }
  }

  /* Regole nuove: valori esatti, stile, singoli strumenti, singole parti. Hanno la precedenza. */
  var PRE = [
    { id: 'bpmset', re: /(\d{2,3})\s*(bpm|battiti)|\ba\s+(\d{2,3})\b(?!\s*%)/i, run: function (s, t) {
      var m = t.match(/(\d{2,3})\s*(bpm|battiti)/i) || t.match(/\ba\s+(\d{2,3})\b/i), v = +m[1];
      if (v < 60 || v > 180) return { notes: ['Il tempo deve stare tra 60 e 180 BPM: non lo cambio.'], keep: true };
      s.bpm = v; return { notes: ['Imposto ' + v + ' BPM.'] };
    } },
    { id: 'keyset', re: /\b(in|tonalit[aà]|nota)\s+(do|re|mi|fa|sol|la|si)(\s*(#|diesis))?(\s+(maggiore|minore))?\b/i, run: function (s, t) {
      var m = t.match(/\b(?:in|tonalit[aà]|nota)\s+(do|re|mi|fa|sol|la|si)(\s*(#|diesis))?(?:\s+(maggiore|minore))?\b/i);
      var ton = (NOTES[m[1].toLowerCase()] + (m[3] ? 1 : 0)) % 12; s.tonic = ton; var out = ['Tonalità: ' + m[1].toUpperCase().slice(0, 1) + m[1].toLowerCase().slice(1) + (m[3] ? '#' : '')];
      if (m[4]) { s.mode = m[4].toLowerCase(); out[0] += ' ' + s.mode; } out[0] += '.'; return { notes: out };
    } },
    { id: 'style', re: /\b(stile|genere|tipo)?\s*(trap|drill|epico|melodico|estate|boombap|street|trapdark|clubtrap)\b/i, run: function (s, t) {
      var g = t.match(/\b(trap|drill|epico|melodico|estate|boombap|street|trapdark|clubtrap)\b/i)[1].toLowerCase(); s.genre = g; s.bpm = STYLE_BPM[g]; s.tune = null;
      if (['trap', 'drill', 'epico', 'boombap', 'street', 'trapdark', 'clubtrap'].indexOf(g) >= 0) s.mode = 'minore'; if (g === 'estate') s.mode = 'maggiore';
      return { notes: ['Cambio stile in ' + g + ' (' + s.bpm + ' BPM). Rifaccio la base da capo con struttura e suoni di quello stile.'] };
    } },
    { id: 'solo', re: /\bsolo\s+(il |la |lo |l'|gli )?(.+)/i, run: function (s, t) {
      var keep = TRACKS.filter(function (x) { return x[1].test(t.replace(/^.*?\bsolo\b/i, '')); });
      if (!keep.length) return null;
      TRACKS.forEach(function (x) { s.levels[x[0]] = keep.indexOf(x) >= 0 ? 1 : 0; });
      s.levels.batteria = 1; s.levels.basso = 1; s.levels.accordi = 1; s.levels.pad = 1; s.levels.melodia = 1;
      return { notes: ['Ascolto solo ' + keep.map(function (x) { return x[2]; }).join(' e ') + '; gli altri strumenti sono spenti.'] };
    } },
    { id: 'hatdense', re: /hi[\s-]?hat.*(fitt|veloc|rullat|più|piu)|(fitt|rullat).*hi[\s-]?hat/i, run: function (s, t) {
      if (/(radi|meno|rar)/i.test(t)) return null;
      s.tune = s.tune || {}; s.tune.hat = Math.round(clamp((s.tune.hat == null ? 0.8 : s.tune.hat) * 1.3, 0.3, 1.5) * 100) / 100;
      return { notes: ['Hi-hat più fitti (densità ' + Math.round(s.tune.hat * 100) + '%).'] };
    } },
    { id: 'hatsparse', re: /hi[\s-]?hat.*(radi|meno|rar)|(meno|radi).*hi[\s-]?hat/i, run: function (s) {
      s.tune = s.tune || {}; s.tune.hat = Math.round(clamp((s.tune.hat == null ? 0.8 : s.tune.hat) * 0.7, 0.3, 1.5) * 100) / 100;
      return { notes: ['Hi-hat più radi (densità ' + Math.round(s.tune.hat * 100) + '%).'] };
    } },
    { id: 'inst', re: /\b(togli|toglier|spegni|muta|senza|elimina|rimetti|riaccendi|accendi|alza|aumenta|abbassa|diminuisci|più|piu|meno)\b/i, run: function (s, t) {
      var tr = trackIn(t); if (!tr || /\bbatteria\b/i.test(t)) return null;
      if (tr[0] === 'bass' && /(profond|pesant|potent|grosso)/i.test(t)) return null;
      var secs = secsIn(t), where = secs.length ? ' ' + secs.map(function (x) { return ({ intro: 'nell\'intro', strofa: 'nella strofa', pre: 'nel pre-ritornello', ritornello: 'nel ritornello', bridge: 'nel bridge', outro: 'nell\'outro' })[x]; }).join(' e ') : '';
      var off = /(togli|toglier|spegni|muta|senza|elimina)/i.test(t), on = /(rimetti|riaccendi|accendi)/i.test(t), up = /(alza|aumenta|\bpiù\b|\bpiu\b)/i.test(t), dn = /(abbassa|diminuisci|\bmeno\b)/i.test(t);
      if (off) { setTrack(s, tr[0], secs, 0, false); return { notes: ['Spengo ' + tr[2] + where + '.'] }; }
      if (on) { setTrack(s, tr[0], secs, 1, false); return { notes: ['Riaccendo ' + tr[2] + where + '.'] }; }
      if (up) { setTrack(s, tr[0], secs, 1.3, true); return { notes: ['Alzo ' + tr[2] + where + '.'] }; }
      if (dn) { setTrack(s, tr[0], secs, 0.7, true); return { notes: ['Abbasso ' + tr[2] + where + '.'] }; }
      return null;
    } }
  ];

  var RULES = [
    { re: /\b(tre|3)\s+altern/i, id: 'variants', run: function () { return { variants: 3, notes: ['Creo tre varianti della stessa base con melodie diverse.'] }; } },
    { re: /(cinemat|film|epic|colonna sonora)/i, id: 'cinema', run: function (s) {
      s.bpm = clamp(s.bpm - 12, 60, 180); if (s.mode === 'maggiore') s.mode = 'minore';
      lv(s, 'pad', 1.6, 0, 1.8); lv(s, 'batteria', 0.6); lv(s, 'accordi', 0.85); s.reverb = Math.max(s.reverb, 0.35);
      return { notes: ['Più lenta, scala minore, pad in primo piano, batteria più discreta e riverbero ampio.'] };
    } },
    { re: /(vuot|spoglia|povera|piatta)/i, id: 'fuller', run: function (s) {
      LEVEL_KEYS.forEach(function (k) { if (s.levels[k] < 0.6) s.levels[k] = 1; });
      lv(s, 'accordi', 1.2); lv(s, 'pad', 1.25);
      return { notes: ['Riaccendo gli strumenti spenti e alzo accordi e pad per riempire.'] };
    } },
    { re: /basso.*(profond|pien|grosso|potente|pesante|più)|(più|piu).*basso/i, id: 'bass', run: function (s) {
      s.bassStyle = '808'; lv(s, 'basso', 1.4, 0.2, 1.8);
      return { notes: ['Passo al basso profondo in stile 808 e lo alzo di volume.'] };
    } },
    { re: /(emozion|commov|toccante|più intens|piu intens|struggente)/i, id: 'emotional', run: function (s) {
      s.bpm = clamp(s.bpm - 6, 60, 180); lv(s, 'pad', 1.35, 0, 1.8); lv(s, 'melodia', 1.15, 0, 1.8); lv(s, 'batteria', 0.85); s.reverb = Math.max(s.reverb, 0.2);
      return { notes: ['Ipotesi: un tempo un po\' più lento, più pad e melodia e meno batteria tendono a rendere il brano più intimo. Ascolta e giudica tu.'] };
    } },
    { re: /(energia|carica|potente|aggressiv|più forte|piu forte|spinta|ritmo)/i, id: 'energy', run: function (s) {
      s.bpm = clamp(s.bpm + 8, 60, 180); lv(s, 'batteria', 1.3); lv(s, 'basso', 1.15); lv(s, 'pad', 0.85);
      return { notes: ['Più veloce, batteria e basso più forti, pad più discreto.'] };
    } },
    { re: /(più|piu)\s+(lent|piano|calm)|rallenta/i, id: 'slower', run: function (s) { s.bpm = clamp(s.bpm - 10, 60, 180); return { notes: ['Rallento di 10 battiti al minuto.'] }; } },
    { re: /(più|piu)\s+(veloc|rapid)|accelera/i, id: 'faster', run: function (s) { s.bpm = clamp(s.bpm + 10, 60, 180); return { notes: ['Accelero di 10 battiti al minuto.'] }; } },
    { re: /(minore|malinconi|trist|scur|nostalg)/i, id: 'minor', run: function (s) { s.mode = 'minore'; return { notes: ['Passo alla scala minore, più malinconica.'] }; } },
    { re: /(maggiore|luminos|allegr|solare|felice)/i, id: 'major', run: function (s) { s.mode = 'maggiore'; return { notes: ['Passo alla scala maggiore, più luminosa.'] }; } },
    { re: /(senza|togli|toglier|elimina|via la)\s+(la\s+)?batteria/i, id: 'nodrums', run: function (s) { s.levels.batteria = 0; return { notes: ['Spengo la batteria.'] }; } },
    { re: /(più|piu)\s+(di\s+)?melodia|melodia\s+(più|piu)/i, id: 'moremelody', run: function (s) { lv(s, 'melodia', 1.3, 0, 1.8); return { notes: ['Alzo la melodia.'] }; } },
    { re: /(meno|abbassa)\s+(la\s+)?melodia/i, id: 'lessmelody', run: function (s) { lv(s, 'melodia', 0.7); return { notes: ['Abbasso la melodia.'] }; } }
  ];

  var UNSUPPORTED = /(secondo ritornello|primo ritornello|ritornello|strofa|bridge|intro|finale|a un certo punto|in questa parte|nel secondo)/i;

  /** @returns {{understood:boolean, state:object, notes:string[], variants:number, unsupported:string|null, ids:string[]}} */
  function interpret(text, state) {
    var s = cloneState(state), notes = [], ids = [], variants = 0, t = String(text || '');
    var unsupported = UNSUPPORTED.test(t) && !/(vuot|vuota)/i.test(t) ? 'Per ora lavoro sulla base intera, non su singole parti come il secondo ritornello. Applico la modifica a tutta la base.' : null;
    var pre = 0;
    for (var pi = 0; pi < PRE.length; pi++) {
      var pr = PRE[pi]; if (!pr.re.test(t)) continue;
      var po = pr.run(s, t); if (!po) continue;
      ids.push(pr.id); (po.notes || []).forEach(function (n) { notes.push(n); }); pre++;
      if (pr.id === 'style' || pr.id === 'solo' || pr.id === 'inst' || pr.id === 'hatdense' || pr.id === 'hatsparse') break;
    }
    if (pre && ids.some(function (x) { return x === 'style' || x === 'solo' || x === 'inst' || x === 'hatdense' || x === 'hatsparse'; })) return { understood: true, state: s, notes: notes, variants: 0, unsupported: null, ids: ids };
    if (pre) return { understood: true, state: s, notes: notes, variants: 0, unsupported: null, ids: ids };
    for (var i = 0; i < RULES.length; i++) {
      var r = RULES[i];
      if (!r.re.test(t)) continue;
      var out = r.run(s) || {};
      ids.push(r.id);
      (out.notes || []).forEach(function (n) { notes.push(n); });
      if (out.variants) variants = out.variants;
      if (r.id === 'cinema' || r.id === 'variants') break; // regole esclusive
    }
    return { understood: ids.length > 0, state: s, notes: notes, variants: variants, unsupported: ids.length ? unsupported : null, ids: ids };
  }

  return { interpret: interpret, HELP: HELP, LEVEL_KEYS: LEVEL_KEYS, cloneState: cloneState };
});
