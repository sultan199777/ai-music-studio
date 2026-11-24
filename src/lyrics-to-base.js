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

  // Emozione -> stile dell'arrangiatore e strumenti veri. Analisi di mestiere, non regole fisse.
  var MAP = {
    rabbia: { genre: 'drill', mode: 'minore', bpm: 142, label: 'rabbia', inst: { melodia: 'pizz', accordi: 'piano', pad: 'cellos' },
      why: 'drill: ritmo spezzato, pizzicati e violoncelli scuri danno tensione' },
    tristezza: { genre: 'trap', mode: 'minore', bpm: 130, label: 'tristezza', inst: { melodia: 'piano', accordi: 'guitar', pad: 'violins' },
      why: 'trap lenta e malinconica: piano e chitarra in minore, archi lunghi nel ritornello' },
    nostalgia: { genre: 'melodico', mode: 'minore', bpm: 86, label: 'nostalgia', inst: { melodia: 'upright', accordi: 'epiano', pad: 'violas' },
      why: 'melodico lento: pianoforte verticale e piano elettrico, suono "di ricordo"' },
    gioia: { genre: 'estate', mode: 'maggiore', bpm: 102, label: 'gioia', inst: { melodia: 'marimba', accordi: 'nylon', pad: 'organ' },
      why: 'ritmo latino in maggiore: marimba e chitarra classica, colori caldi' },
    amore: { genre: 'melodico', mode: 'maggiore', bpm: 92, label: 'amore', inst: { melodia: 'piano', accordi: 'guitar', pad: 'violins' },
      why: 'melodico in maggiore: piano e chitarra, archi morbidi' },
    speranza: { genre: 'epico', mode: 'maggiore', bpm: 88, label: 'speranza', inst: { melodia: 'horn', accordi: 'harp', pad: 'violins' },
      why: 'cinematico in maggiore: arpa, archi e corno che crescono verso il ritornello' }
  };

  /**
   * @param analysis risultato di LyricsEngine.analyze
   * @param {{tonic?:number}} [opts]
   */
  function suggest(analysis, opts) {
    opts = opts || {};
    var out = { genre: 'melodico', mode: 'maggiore', bpm: 96, inst: { melodia: 'piano', accordi: 'guitar', pad: 'violins' }, tonic: opts.tonic == null ? 0 : opts.tonic, confident: false, why: [] };
    if (!analysis || !analysis.counts || !analysis.counts.lines) {
      out.why.push('Non c\'è ancora un testo: parto da una base melodica neutra (piano, chitarra, archi).');
      return out;
    }
    var e = analysis.emotions, top = e && e.sufficient ? e.items[0] : null;
    if (top && top.count > 0 && MAP[top.name]) {
      var m = MAP[top.name];
      out.genre = m.genre; out.mode = m.mode; out.bpm = m.bpm; out.inst = Object.assign({}, m.inst); out.confident = true; out.emotion = top.name;
      out.why.push('Nel testo prevale ' + m.label + ': ' + m.why + '.');
      if (top.name === 'amore' && e.valence === 'negativo') { out.genre = 'trap'; out.mode = 'minore'; out.bpm = 128; out.inst = { melodia: 'harp', accordi: 'piano', pad: 'violins' }; out.why.push('Ma il tono complessivo è negativo (amore ferito): passo a una trap melodica in minore con arpa e piano.'); }
    } else {
      out.why.push('Nel testo ci sono poche parole che riconosco: parto da una base melodica neutra (piano, chitarra, archi).');
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
