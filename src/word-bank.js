/*
 * Dizionario personale per le rime: nessun dizionario di terzi, quindi nessun problema di licenza.
 * Le parole arrivano da tre posti: un piccolo elenco scritto per questo progetto (parole comuni del rap),
 * le parole dei TUOI testi, e le parole delle cartelle artista (solo parole singole con il numero di volte:
 * l'ordine e le frasi non si conservano, quindi non si può ricostruire nessun testo).
 * Le rime si trovano con le stesse regole del motore dei testi (rima piena e assonanza). Sono approssimazioni:
 * l'accento italiano non è scritto, quindi qualche suggerimento può non rimare "a orecchio".
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./lyrics-engine.js'), require('./sultan-brain.js'));
  else root.WordBank = factory(root.LyricsEngine, root.SultanBrain);
})(typeof self !== 'undefined' ? self : this, function (LE, SB) {
  'use strict';

  var SEED = ('notte giorno vita morte amore cuore dolore valore colore sapore rumore calore errore tremore sudore pallore fiore ' +
    'strada città realtà libertà verità ' + 'faccia traccia minaccia caccia braccia ghiaccia ' + 'sogno bisogno ' + 'anima prima clima rima cima stima ' +
    'volare parlare cantare sognare ballare passare lasciare restare tornare portare salire uscire dire fare stare andare ' +
    'passato stato fiato fato mercato peccato soldato sbagliato bruciato lasciato scappato cambiato nato ' + 'cambiata fata data ' +
    'mia via follia malinconia polizia gelosia energia armonia famiglia ' + 'sera era vera guerra terra ferro cielo ' +
    'soldi ricordi fuori forti morti porti sorti torti ' + 'fame nome come ' + 'paura cura dura sicura oscura misura ' +
    'ragazza piazza pazza ' + 'dentro centro ' + 'casa ' + 'mondo fondo profondo secondo tondo ' + 'luna fortuna una ' +
    'fuoco gioco poco luogo ' + 'tempo vento momento sentimento lamento ' + 'nome come ' + 'oro tesoro lavoro coro ' +
    'sangue langue ' + 'pioggia ' + 'dio addio mio io ' + 'macchina cantina ' + 'testa festa resta ' + 'giro tiro respiro ' +
    'male reale normale mortale ' + 'mare amare ' + 'pace tace piace tace ' + 'occhi sogni ' + 'schiena catena pena sera ' + 'ombra ' +
    'fratello coltello bello quello cervello ' + 'mano lontano piano vano ' + 'solo volo ' + 'buio ' + 'lacrime ' + 'vuoto ' + 'silenzio ' +
    'palazzo ' + 'quartiere ' + 'ghetto ' + 'banda ' + 'giro ' + 'catene ' + 'collane ' + 'macchine ' + 'strade ' + 'notti ' + 'giorni ' + 'vite ' + 'amici nemici ' + 'sbirri ' +
    'fumo ' + 'erba ' + 'cash ' + 'gang ' + 'flow ' + 'rap ' + 'trap ' + 'rime ' + 'barre ' + 'palco ' + 'microfono ' + 'cuffie ' + 'studio ' + 'disco ' + 'fama ' + 'fame ' + 'vero falso ' + 'serio ' + 'mistero ' + 'impero ' + 'pensiero ' + 'straniero ' + 'sentiero ' + 'cimitero ' + 'sincero').split(/\s+/);

  function clean(w) { return String(w || '').toLowerCase().replace(/[^a-zàèéìíòóùú]/g, ''); }
  function newBank() { return { v: 1, w: {} }; }
  function add(bank, word, n) { var c = clean(word); if (c.length < 3 || c.length > 18) return; bank.w[c] = (bank.w[c] || 0) + (n || 1); }
  function learn(bank, text) {
    bank = bank || newBank();
    SB.words(text).forEach(function (w) { add(bank, w, 1); });
    var keys = Object.keys(bank.w);
    if (keys.length > 15000) { keys.sort(function (a, b) { return bank.w[a] - bank.w[b]; }).slice(0, keys.length - 15000).forEach(function (k) { delete bank.w[k]; }); }
    return bank;
  }
  function seeded(bank) {
    var b = { v: 1, w: {} }; SEED.forEach(function (w) { add(b, w, 1); });
    Object.keys(SB.LEX).forEach(function (k) { SB.LEX[k].forEach(function (w) { add(b, w, 1); }); });
    Object.keys((bank && bank.w) || {}).forEach(function (w) { b.w[w] = (b.w[w] || 0) + bank.w[w]; });
    return b;
  }
  /** Rime di una parola: { rhyme: [...], assonance: [...] } ordinate per quanto la parola è usata nei tuoi testi. */
  function rhymes(bank, word, o) {
    o = o || {}; var w = clean(word), max = o.max || 24, all = seeded(bank), rh = [], as = [];
    if (w.length < 2) return { word: w, rhyme: [], assonance: [] };
    var okKey = function (x) { return LE.rhymeKey(x).length >= 2 || /[àèéìíòóùú]$/.test(x); }, kw = okKey(w);
    Object.keys(all.w).forEach(function (c) {
      if (c === w) return;
      var rel = LE.rhymeRelation(w, c);
      if (rel === 'perfect') { if (kw && okKey(c)) rh.push(c); } else if (rel === 'assonance') as.push(c);
    });
    var by = function (a, b) { return (all.w[b] - all.w[a]) || (a < b ? -1 : 1); };
    var info = function (c) { return { word: c, syll: LE.countSyllables(c), mine: !!(bank && bank.w && bank.w[c]) }; };
    return { word: w, syll: LE.countSyllables(w), rhyme: rh.sort(by).slice(0, max).map(info), assonance: as.sort(by).slice(0, max).map(info) };
  }
  return { newBank: newBank, learn: learn, rhymes: rhymes, seeded: seeded, SEED: SEED };
});
