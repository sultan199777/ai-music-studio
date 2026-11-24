/*
 * Dal testo a una base consigliata: genere, scala e velocità.
 * È un'IPOTESI costruita sul tono emotivo (dizionario di parole) e sulla
 * lunghezza delle righe. Serve come punto di partenza, non come verità.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LyricsToBase = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAP = {
    rabbia: { genre: 'hiphop', mode: 'minore', bpm: 140, label: 'rabbia' },
    tristezza: { genre: 'lofi', mode: 'minore', bpm: 78, label: 'tristezza' },
    nostalgia: { genre: 'lofi', mode: 'minore', bpm: 84, label: 'nostalgia' },
    gioia: { genre: 'dance', mode: 'maggiore', bpm: 122, label: 'gioia' },
    amore: { genre: 'pop', mode: 'maggiore', bpm: 96, label: 'amore' },
    speranza: { genre: 'pop', mode: 'maggiore', bpm: 108, label: 'speranza' }
  };

  /**
   * @param analysis risultato di LyricsEngine.analyze
   * @param {{tonic?:number}} [opts]
   */
  function suggest(analysis, opts) {
    opts = opts || {};
    var out = { genre: 'pop', mode: 'maggiore', bpm: 100, tonic: opts.tonic == null ? 0 : opts.tonic, confident: false, why: [] };
    if (!analysis || !analysis.counts || !analysis.counts.lines) {
      out.why.push('Non c\'è ancora un testo: parto da una base pop neutra.');
      return out;
    }
    var e = analysis.emotions, top = e && e.sufficient ? e.items[0] : null;
    if (top && top.count > 0 && MAP[top.name]) {
      var m = MAP[top.name];
      out.genre = m.genre; out.mode = m.mode; out.bpm = m.bpm; out.confident = true;
      out.why.push('Nel testo prevale ' + m.label + ': scelgo ' + m.genre + ' in scala ' + m.mode + '.');
      if (top.name === 'amore' && e.valence === 'negativo') { out.mode = 'minore'; out.why.push('Il tono complessivo è negativo, quindi uso la scala minore.'); }
    } else {
      out.why.push('Nel testo ci sono poche parole che riconosco: parto da una base pop neutra.');
    }
    var avg = analysis.syllables.average;
    if (avg > 12) { out.bpm -= 8; out.why.push('Le righe sono lunghe (' + avg.toFixed(0) + ' sillabe): rallento un po\' per farle stare.'); }
    else if (avg > 0 && avg < 7) { out.bpm += 6; out.why.push('Le righe sono corte (' + avg.toFixed(0) + ' sillabe): accelero un po\'.'); }
    out.bpm = Math.max(70, Math.min(160, out.bpm));
    if (out.mode === 'minore' && opts.tonic == null) out.tonic = 9;
    return out;
  }

  return { suggest: suggest };
});
