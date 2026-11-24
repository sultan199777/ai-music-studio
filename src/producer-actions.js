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
    'fammi ascoltare tre alternative'
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
