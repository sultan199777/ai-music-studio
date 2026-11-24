/*
 * Idee per il videoclip, costruite sul brano: concetto visivo, struttura a battute
 * (con i secondi calcolati dal tempo), inquadrature da girare con l'iPhone,
 * montaggio e cose da evitare.
 * Sono SUGGERIMENTI da un piccolo archivio di regole (umore e genere), non una
 * garanzia di risultato: ascolta la canzone e adatta le idee a te.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VideoIdeas = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MOODS = {
    amore: { style: 'Intimo e caldo', palette: ['oro', 'rosa', 'arancio tenue'], light: 'luce calda di fine pomeriggio o lampade da tavolo', shots: ['Primo piano di te che canti, sguardo in camera', 'Mani che si cercano o oggetti legati a una persona', 'Camminata lenta in controluce', 'Dettaglio di una finestra con luce dorata'] },
    tristezza: { style: 'Malinconico e raccolto', palette: ['blu', 'grigio freddo', 'viola spento'], light: 'luce fredda di giorno nuvoloso o una sola lampada di notte', shots: ['Te davanti a una finestra con pioggia o vapore', 'Camminata da solo in una strada vuota', 'Dettaglio di una stanza con un oggetto fuori posto', 'Primo piano con poca luce, quasi fermo'] },
    nostalgia: { style: 'Ricordi e vecchie foto', palette: ['seppia', 'verde sbiadito', 'arancio'], light: 'luce naturale morbida', shots: ['Vecchie foto o oggetti d\'infanzia sul tavolo', 'Te nello stesso posto di allora, oggi', 'Passaggio in auto o in treno con il paesaggio che scorre', 'Dettaglio di mani che sfogliano ricordi'] },
    rabbia: { style: 'Duro e ad alto contrasto', palette: ['rosso', 'nero grafite', 'bianco'], light: 'luce laterale forte, ombre nette', shots: ['Primo piano frontale, immobile, poi scatto verso la camera', 'Inquadrature dal basso in un parcheggio o sotto un ponte', 'Dettagli di pugni, scarpe, catene o ruote', 'Camminata veloce verso la camera'] },
    gioia: { style: 'Luminoso e in movimento', palette: ['giallo', 'turchese', 'rosa acceso'], light: 'luce piena del giorno, colori vivi', shots: ['Te che balli o salti in un posto aperto', 'Amici che entrano nell\'inquadratura a tempo', 'Giravolta con camera in mano', 'Dettagli di cose colorate che si muovono'] },
    speranza: { style: 'Aperto e in crescita', palette: ['azzurro', 'oro', 'bianco'], light: 'alba o tramonto, controluce', shots: ['Inquadrature larghe di te verso l\'orizzonte', 'Salita di una scala o di una collina', 'Primo piano con il sole che sale alle spalle', 'Apertura di una finestra o di una porta'] },
    neutro: { style: 'Pulito e moderno', palette: ['viola', 'azzurro', 'bianco'], light: 'luce morbida laterale vicino a una finestra', shots: ['Primo piano di te che canti', 'Mezza figura mentre cammini', 'Dettagli di strumenti, cuffie o telefono', 'Un luogo che ti rappresenta'] }
  };
  var CUTS = { hiphop: 2, dance: 2, pop: 1, lofi: 0.5 };
  var CUT_TEXT = { hiphop: 'tagli veloci, circa due a battuta, con piccoli zoom sul colpo di cassa', dance: 'tagli veloci e lampi di luce sul primo tempo di ogni battuta', pop: 'un taglio a battuta e un cambio di inquadratura al ritornello', lofi: 'inquadrature lunghe e lente, un taglio ogni due battute' };

  function cleanLines(l) { return String(l || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(function (x) { return x && !/^\[.*\]$/.test(x); }); }
  function chorusLines(lyrics) {
    var m = /\[\s*ritornello[^\]]*\]\s*\n([\s\S]*?)(\n\s*\n|\[|$)/i.exec(String(lyrics || ''));
    var c = m ? cleanLines(m[1]) : [], all = cleanLines(lyrics);
    return { chorus: c.length ? c : all.slice(0, 2), all: all };
  }

  /**
   * @param {{title?:string, lyrics?:string, genre?:string, mood?:string, bpm?:number, bars?:number, hasPhoto?:boolean}} s
   */
  function generate(s) {
    s = s || {};
    var mood = MOODS[(s.mood || '').toLowerCase()] ? (s.mood || '').toLowerCase() : 'neutro', M = MOODS[mood];
    var bpm = Math.max(60, Math.min(180, s.bpm || 100)), bars = Math.max(4, Math.min(32, Math.round(s.bars || 16)));
    var barSec = 240 / bpm, genre = CUTS[s.genre] ? s.genre : 'pop';
    var L = chorusLines(s.lyrics), title = (s.title || 'la canzone').trim() || 'la canzone';

    var intro = Math.max(1, Math.round(bars * 0.12)), outro = Math.max(1, Math.round(bars * 0.12));
    var rest = bars - intro - outro, verse = Math.max(1, Math.round(rest * 0.5)), chorus = Math.max(1, rest - verse);
    if (intro + verse + chorus + outro !== bars) outro = Math.max(1, bars - intro - verse - chorus);
    var sections = [
      { name: 'Apertura', bars: intro, scene: 'Titolo "' + title + '" e un\'inquadratura forte di te o della tua foto in stile cartone. Nessuna parola cantata ancora.', text: title.toUpperCase() },
      { name: 'Strofa', bars: verse, scene: M.shots[0] + '. Alterna con: ' + M.shots[1] + '.', text: L.all[0] || '' },
      { name: 'Ritornello', bars: chorus, scene: 'La parte più energica: ' + M.shots[2] + '. Scrivi sullo schermo le parole del ritornello, grandi, una riga alla volta a ogni battuta.', text: L.chorus[0] || '' },
      { name: 'Chiusura', bars: outro, scene: M.shots[3] + ', poi nome d\'arte e invito ad ascoltare per intero.', text: L.chorus[L.chorus.length - 1] || '' }
    ];
    var at = 0;
    sections.forEach(function (x) { x.fromBar = at + 1; x.toBar = at + x.bars; x.seconds = Math.round(x.bars * barSec * 10) / 10; at += x.bars; });

    return {
      kind: 'ipotesi', mood: mood,
      concept: { style: M.style, palette: M.palette, light: M.light, summary: 'Stile ' + M.style.toLowerCase() + ' con toni ' + M.palette.join(', ') + '. ' + (CUT_TEXT[genre] || '') + '.' },
      totalSeconds: Math.round(bars * barSec), sections: sections,
      shots: M.shots,
      formats: [
        { platform: 'TikTok / Reel / Short', length: '9:16, 15-30 s', use: 'Il ritornello con le parole in sovrimpressione: è il pezzo che gira meglio da solo.' },
        { platform: 'YouTube', length: '16:9 o 9:16, durata del brano', use: 'Il clip completo con le quattro parti qui sopra.' },
        { platform: 'Storie', length: '9:16, 10-15 s', use: 'Anteprima e conto alla rovescia.' }
      ],
      editing: [
        'Taglia a tempo: ' + (CUT_TEXT[genre] || CUT_TEXT.pop) + '.',
        'Usa la stessa tavolozza ('+ M.palette.join(', ') + ') in tutte le scene, così il clip sembra un\'unica cosa.',
        'Metti il testo sullo schermo solo per il ritornello: troppe scritte stancano.',
        'Il primo secondo decide se si guarda: apri con l\'inquadratura più forte, non con il titolo lungo.'
      ],
      phone: [
        'Gira in verticale a 4K 30 fps (Impostazioni → Fotocamera → Registra video).',
        'Luce: ' + M.light + '. Evita il flash e la luce dall\'alto.',
        'Tieni l\'iPhone fermo con le due mani o appoggialo: il tremolio si nota di più del rumore.',
        'Canta in playback sulla base mentre giri: la bocca deve andare a tempo con la voce registrata.',
        'Registra ogni scena 2-3 volte e scegli la migliore.'
      ],
      avoid: [
        'Non usare video, immagini o musica di altri senza permesso: la piattaforma può bloccare o rimuovere il contenuto.',
        'Non ripetere la stessa inquadratura più di due volte di seguito.'
      ]
    };
  }

  return { generate: generate, MOODS: MOODS };
});
