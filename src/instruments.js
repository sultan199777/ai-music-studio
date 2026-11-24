/*
 * Strumenti: catalogo spiegato + campionatore (sampler) + chitarre sintetizzate.
 *
 * - I campioni veri vengono da VSCO-2-CE e VCSL (Versilian Studios, licenza CC0):
 *   ogni strumento è un file assets/inst/<id>.json (nel sito: inst/<id>.json),
 *   caricato solo quando serve. Formato: mono 22050 Hz, ADPCM IMA 4 bit.
 * - Il campionatore prende la nota registrata più vicina e la intona alla nota
 *   voluta (come Sampler di Tone.js o i campionatori delle DAW).
 * - Le chitarre (nessuna libreria CC0 adatta trovata) sono sintetizzate con
 *   l'algoritmo Karplus-Strong: una corda simulata con una linea di ritardo.
 * - Il catalogo spiega a cosa serve ogni strumento, in che registro suona,
 *   con cosa combacia e in quali stili si usa. Sono indicazioni di mestiere
 *   (Analisi), non regole assolute: il giudizio finale è a orecchio.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Instruments = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------- catalogo ----------------
  // ruoli: melodia (la linea che si ricorda), accordi (armonia ritmica), pad (tappeto lungo), colore (piccoli tocchi)
  // tipo: 'corda' (pizzicato/percosso, si spegne da solo), 'sostenuto' (dura finché suoni), 'percosso' (lamine, campane)
  var FAMILIES = {
    tastiere: 'Tastiere', corde: 'Archi e corde', fiati: 'Fiati (legni)', ottoni: 'Ottoni', lamine: 'Percussioni intonate', mondo: 'Strumenti del mondo', chitarre: 'Chitarre'
  };
  var C = [
    { id: 'piano', nome: 'Pianoforte a coda', fam: 'tastiere', fonte: 'campione', tipo: 'corda', range: [36, 96], ruoli: ['melodia', 'accordi'],
      come: 'Accordi nel registro centrale (Do3-Do5), melodia un\'ottava sopra. Note lunghe e poche: il pianoforte riempie molto.', combina: ['violins', 'cellos', 'pizz', 'glock'],
      perche: 'Con gli archi sotto diventa emozionale; con il glockenspiel sopra brilla senza coprire la voce.', stili: ['trap', 'melodico', 'epico', 'rnb'] },
    { id: 'upright', nome: 'Pianoforte verticale', fam: 'tastiere', fonte: 'campione', tipo: 'corda', range: [36, 96], ruoli: ['accordi', 'melodia'],
      come: 'Più intimo e "di stanza" del gran coda: perfetto per basi lo-fi e malinconiche, accordi semplici a tempo lento.', combina: ['epiano', 'vibes', 'contrabass'],
      perche: 'Con contrabbasso e vibrafono dà un colore jazz notturno.', stili: ['lofi', 'melodico', 'rnb'] },
    { id: 'epiano', nome: 'Piano elettrico FM', fam: 'tastiere', fonte: 'campione', tipo: 'corda', range: [36, 90], ruoli: ['accordi', 'melodia'],
      come: 'Accordi con settime, suonati morbidi e lunghi. Lascia spazio: suona sul 1 e sul 3 della battuta.', combina: ['sax', 'contrabass', 'vibes'],
      perche: 'È il suono tipico di R&B e soul: caldo, non copre la voce perché ha poche frequenze acute.', stili: ['rnb', 'lofi', 'melodico'] },
    { id: 'clavi', nome: 'Clavisynth', fam: 'tastiere', fonte: 'campione', tipo: 'corda', range: [36, 90], ruoli: ['accordi', 'colore'],
      come: 'Colpi corti e ritmici in levare (tra un tempo e l\'altro), come una chitarra funk.', combina: ['epiano', 'trumpet'],
      perche: 'Aggiunge groove senza occupare i bassi.', stili: ['estate', 'rnb'] },
    { id: 'organ', nome: 'Organo', fam: 'tastiere', fonte: 'campione', tipo: 'sostenuto', range: [36, 90], ruoli: ['pad', 'accordi'],
      come: 'Accordi tenuti per tutta la battuta, volume basso: fa da tappeto.', combina: ['piano', 'violins'],
      perche: 'Con il coro dà un\'atmosfera gospel o solenne.', stili: ['epico', 'rnb'] },
    { id: 'harp', nome: 'Arpa', fam: 'corde', fonte: 'campione', tipo: 'corda', range: [36, 96], ruoli: ['accordi', 'melodia', 'colore'],
      come: 'Arpeggi (note dell\'accordo una alla volta) veloci e leggeri, registro medio-acuto.', combina: ['violins', 'flute', 'piano'],
      perche: 'Gli arpeggi d\'arpa sono una firma della trap melodica e delle basi sognanti: muovono senza disturbare.', stili: ['trap', 'melodico', 'epico'] },
    { id: 'violins', nome: 'Violini (sezione)', fam: 'corde', fonte: 'campione', tipo: 'sostenuto', range: [55, 96], ruoli: ['pad', 'melodia'],
      come: 'Note lunghe in alto, entrano nel ritornello. In sezione suonano larghi e morbidi.', combina: ['cellos', 'piano', 'horn'],
      perche: 'Violini sopra + violoncelli sotto = orchestra d\'archi completa: è la base del suono cinematico.', stili: ['epico', 'drill', 'trap', 'melodico'] },
    { id: 'violas', nome: 'Viole (sezione)', fam: 'corde', fonte: 'campione', tipo: 'sostenuto', range: [48, 84], ruoli: ['pad'],
      come: 'Riempiono il centro tra violini e violoncelli. Da sole suonano scure e malinconiche.', combina: ['violins', 'cellos'],
      perche: 'Completano gli accordi degli archi.', stili: ['epico', 'melodico'] },
    { id: 'cellos', nome: 'Violoncelli (sezione)', fam: 'corde', fonte: 'campione', tipo: 'sostenuto', range: [36, 76], ruoli: ['pad', 'melodia'],
      come: 'Note lunghe nel registro basso-medio; ottimi per una melodia triste.', combina: ['violins', 'piano', 'bells'],
      perche: 'Danno peso emotivo. Attenzione a non sovrapporli troppo all\'808.', stili: ['epico', 'drill', 'melodico'] },
    { id: 'pizz', nome: 'Violini pizzicati', fam: 'corde', fonte: 'campione', tipo: 'corda', range: [55, 96], ruoli: ['melodia', 'accordi', 'colore'],
      come: 'Note corte e ripetute, melodie saltellanti. Funziona molto in tempi veloci.', combina: ['flute', 'bells', 'violins'],
      perche: 'I pizzicati scuri sono un suono classico della drill: tensione e movimento.', stili: ['drill', 'epico'] },
    { id: 'contrabass', nome: 'Contrabbasso pizzicato', fam: 'corde', fonte: 'campione', tipo: 'corda', range: [28, 60], ruoli: ['melodia'],
      come: 'Linea di basso camminante; usalo al posto dell\'808 nelle basi jazz o lo-fi.', combina: ['upright', 'epiano', 'vibes'],
      perche: 'Basso acustico: suono caldo e organico.', stili: ['lofi', 'rnb'] },
    { id: 'dantranh', nome: 'Dan tranh (cetra vietnamita)', fam: 'mondo', fonte: 'campione', tipo: 'corda', range: [40, 90], ruoli: ['melodia', 'colore'],
      come: 'Melodie su scala pentatonica (5 note), con poche note e molto respiro.', combina: ['flute', 'kalimba'],
      perche: 'Colore orientale, originale in una base trap.', stili: ['trap', 'melodico'] },
    { id: 'flute', nome: 'Flauto', fam: 'fiati', fonte: 'campione', tipo: 'sostenuto', range: [60, 96], ruoli: ['melodia'],
      come: 'Melodia del ritornello in registro acuto; frasi brevi e ripetute (gancio).', combina: ['pizz', 'harp', 'bells'],
      perche: 'Il flauto è un timbro "gancio": si ricorda subito.', stili: ['trap', 'drill', 'melodico'] },
    { id: 'clarinet', nome: 'Clarinetto', fam: 'fiati', fonte: 'campione', tipo: 'sostenuto', range: [50, 90], ruoli: ['melodia', 'pad'],
      come: 'Melodie morbide nel registro medio; anche note tenute sotto la voce.', combina: ['flute', 'violas'],
      perche: 'Timbro caldo, meno brillante del flauto.', stili: ['melodico', 'lofi'] },
    { id: 'oboe', nome: 'Oboe', fam: 'fiati', fonte: 'campione', tipo: 'sostenuto', range: [58, 90], ruoli: ['melodia'],
      come: 'Melodie espressive e malinconiche, frasi lente.', combina: ['violins', 'harp'],
      perche: 'Suono nasale che "parla": ottimo per intro emotive.', stili: ['epico', 'melodico'] },
    { id: 'sax', nome: 'Sax tenore', fam: 'fiati', fonte: 'campione', tipo: 'sostenuto', range: [44, 80], ruoli: ['melodia'],
      come: 'Frasi brevi tra una riga e l\'altra del testo (risposta alla voce).', combina: ['epiano', 'contrabass'],
      perche: 'Il sax è il timbro dell\'R&B notturno e del jazz.', stili: ['rnb', 'lofi'] },
    { id: 'trumpet', nome: 'Tromba', fam: 'ottoni', fonte: 'campione', tipo: 'sostenuto', range: [54, 84], ruoli: ['melodia', 'colore'],
      come: 'Squilli nel ritornello o frasi celebrative; con poco volume diventa malinconica.', combina: ['horn', 'trombone'],
      perche: 'Ottoni insieme = potenza da stadio.', stili: ['epico', 'estate'] },
    { id: 'horn', nome: 'Corno francese', fam: 'ottoni', fonte: 'campione', tipo: 'sostenuto', range: [40, 77], ruoli: ['pad', 'melodia'],
      come: 'Note lunghe e larghe sotto gli archi; temi eroici.', combina: ['violins', 'cellos', 'bells'],
      perche: 'È il suono "colonna sonora": epico e nobile.', stili: ['epico', 'drill'] },
    { id: 'trombone', nome: 'Trombone', fam: 'ottoni', fonte: 'campione', tipo: 'sostenuto', range: [40, 72], ruoli: ['pad', 'colore'],
      come: 'Accordi gravi e pesanti nei momenti forti.', combina: ['horn', 'trumpet'],
      perche: 'Aggiunge peso agli ottoni.', stili: ['epico'] },
    { id: 'harmonica', nome: 'Armonica', fam: 'fiati', fonte: 'campione', tipo: 'sostenuto', range: [60, 90], ruoli: ['melodia', 'colore'],
      come: 'Frasi corte e lamentose, stile blues.', combina: ['guitar', 'upright'],
      perche: 'Colore country/blues, raro nel rap: ti distingue.', stili: ['lofi', 'melodico'] },
    { id: 'ocarina', nome: 'Ocarina', fam: 'mondo', fonte: 'campione', tipo: 'sostenuto', range: [57, 84], ruoli: ['melodia'],
      come: 'Melodie semplici e infantili, molto riverbero.', combina: ['kalimba', 'harp'],
      perche: 'Suono puro e nostalgico.', stili: ['melodico', 'trap'] },
    { id: 'vibes', nome: 'Vibrafono', fam: 'lamine', fonte: 'campione', tipo: 'percosso', range: [53, 89], ruoli: ['accordi', 'melodia'],
      come: 'Accordi morbidi o melodie lente; lascia risuonare.', combina: ['epiano', 'upright', 'contrabass'],
      perche: 'Colore jazz e lo-fi, notturno.', stili: ['lofi', 'rnb'] },
    { id: 'marimba', nome: 'Marimba', fam: 'lamine', fonte: 'campione', tipo: 'percosso', range: [40, 96], ruoli: ['melodia', 'accordi'],
      come: 'Melodie ritmiche e saltellanti, note corte.', combina: ['kalimba', 'balafon', 'clavi'],
      perche: 'È il suono dell\'estate e dell\'afro: allegro e caldo.', stili: ['estate', 'afro'] },
    { id: 'glock', nome: 'Glockenspiel', fam: 'lamine', fonte: 'campione', tipo: 'percosso', range: [67, 108], ruoli: ['melodia', 'colore'],
      come: 'Raddoppia la melodia un\'ottava sopra, volume basso.', combina: ['piano', 'harp', 'bells'],
      perche: 'Il "luccichio" delle basi trap melodiche: brilla sopra tutto.', stili: ['trap', 'melodico'] },
    { id: 'kalimba', nome: 'Kalimba', fam: 'mondo', fonte: 'campione', tipo: 'corda', range: [40, 90], ruoli: ['melodia', 'accordi'],
      come: 'Arpeggi corti e ripetuti, come un carillon.', combina: ['marimba', 'ocarina'],
      perche: 'Dolce e originale: molto usata nelle basi afro e melodiche.', stili: ['afro', 'melodico', 'estate'] },
    { id: 'balafon', nome: 'Balafon (Africa occidentale)', fam: 'mondo', fonte: 'campione', tipo: 'percosso', range: [48, 90], ruoli: ['melodia', 'colore'],
      come: 'Frasi ritmiche ripetute, come un riff.', combina: ['marimba', 'kalimba'],
      perche: 'Legno vero, suono afro autentico.', stili: ['afro', 'estate'] },
    { id: 'chimes', nome: 'Hand chimes (campanelle)', fam: 'lamine', fonte: 'campione', tipo: 'percosso', range: [48, 96], ruoli: ['colore', 'melodia'],
      come: 'Poche note lunghe nell\'intro o nei passaggi.', combina: ['piano', 'violins'],
      perche: 'Atmosfera magica e natalizia.', stili: ['melodico', 'epico'] },
    { id: 'bells', nome: 'Campane tubolari', fam: 'lamine', fonte: 'campione', tipo: 'percosso', range: [48, 84], ruoli: ['colore', 'melodia'],
      come: 'Un colpo sul primo tempo delle sezioni importanti.', combina: ['horn', 'cellos', 'organ'],
      perche: 'Suono solenne e cupo: molto usato nella drill e nell\'epico.', stili: ['drill', 'epico'] },
    { id: 'glass', nome: 'Bicchieri di cristallo', fam: 'lamine', fonte: 'campione', tipo: 'sostenuto', range: [60, 90], ruoli: ['pad', 'colore'],
      come: 'Note lunghe e lontane, molto riverbero.', combina: ['harp', 'chimes'],
      perche: 'Suono etereo, quasi irreale.', stili: ['melodico'] },
    { id: 'guitar', nome: 'Chitarra acustica (sintetizzata)', fam: 'chitarre', fonte: 'sintesi', tipo: 'corda', range: [40, 88], ruoli: ['accordi', 'melodia'],
      come: 'Arpeggi lenti o accordi pennati leggeri, registro medio.', combina: ['piano', 'violins', 'glock'],
      perche: 'La chitarra malinconica è il cuore della trap melodica ed emo.', stili: ['trap', 'melodico', 'emo'] },
    { id: 'eguitar', nome: 'Chitarra elettrica pulita (sintetizzata)', fam: 'chitarre', fonte: 'sintesi', tipo: 'corda', range: [40, 88], ruoli: ['accordi', 'melodia'],
      come: 'Arpeggi con riverbero, note che si sovrappongono.', combina: ['guitar', 'glock', 'violins'],
      perche: 'Suono emo/rock: rende la base più "sporca" e vera.', stili: ['emo', 'trap'] },
    { id: 'nylon', nome: 'Chitarra classica (sintetizzata)', fam: 'chitarre', fonte: 'sintesi', tipo: 'corda', range: [40, 84], ruoli: ['accordi', 'melodia'],
      come: 'Melodie latine o flamenco, arpeggi caldi.', combina: ['marimba', 'clavi'],
      perche: 'Il colore del reggaeton e del pop latino.', stili: ['estate', 'melodico'] }
  ];
  // Sintetizzatori già presenti nell'arrangiatore (descritti qui per la guida).
  var SYNTH = [
    { id: 'keys', nome: 'Tastiera FM (sintesi)', ruoli: ['melodia'], come: 'Melodia morbida e calda.' },
    { id: 'synth', nome: 'Synth lead (sintesi)', ruoli: ['melodia'], come: 'Melodia moderna, brillante.' },
    { id: 'dark', nome: 'Synth scuro (sintesi)', ruoli: ['melodia'], come: 'Melodia cupa per drill e trap scura.' },
    { id: 'bell', nome: 'Campanella FM (sintesi)', ruoli: ['melodia'], come: 'Melodia trap classica.' },
    { id: 'pluck', nome: 'Pluck (sintesi)', ruoli: ['melodia'], come: 'Note corte, pop.' },
    { id: 'strings', nome: 'Archi sintetici', ruoli: ['melodia'], come: 'Archi elettronici.' }
  ];
  C.forEach(function (c) { c.famiglia = FAMILIES[c.fam]; });

  // Ricette per stile: quali strumenti per ruolo e perché (caratteristiche generiche di genere, non imitazioni).
  var RECIPES = {
    trap: { nome: 'Trap melodica', melodia: ['harp', 'piano', 'glock', 'pizz'], accordi: ['piano', 'guitar', 'harp'], pad: ['violins', 'glass'],
      spiega: 'Melodia malinconica in minore (arpa, piano o chitarra), archi lunghi nel ritornello, glockenspiel per brillare. 808 lungo con scivolate, hi-hat con rullate. La voce resta al centro: la melodia della base suona soprattutto quando non canti.' },
    drill: { nome: 'Drill', melodia: ['pizz', 'bells', 'piano'], accordi: ['pizz', 'piano'], pad: ['violins', 'cellos', 'organ'],
      spiega: 'Atmosfera cupa: pizzicati, campane, cori e archi scuri. Ritmo a terzine sugli hi-hat, 808 che scivola molto e salta d\'ottava.' },
    epico: { nome: 'Epico / cinematico', melodia: ['horn', 'violins', 'oboe'], accordi: ['harp', 'pizz'], pad: ['violins', 'cellos', 'horn'],
      spiega: 'Orchestra: archi in sezione, corni, campane, tamburi grandi. Le dinamiche crescono verso il ritornello.' },
    melodico: { nome: 'Melodico / pop', melodia: ['piano', 'guitar', 'kalimba'], accordi: ['piano', 'guitar', 'epiano'], pad: ['violins', 'organ'],
      spiega: 'Accordi chiari e caldi, melodia semplice e cantabile, pochi strumenti ben scelti.' },
    estate: { nome: 'Estate / latino / afro', melodia: ['marimba', 'nylon', 'kalimba'], accordi: ['nylon', 'clavi', 'marimba'], pad: ['organ'],
      spiega: 'Ritmo in levare, legni e chitarra classica, colori allegri. Il basso è rotondo e segue la cassa.' }
  };

  // ---------------- banca dei campioni ----------------
  var STEP = [7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767];
  var IDX = [-1, -1, -1, -1, 2, 4, 6, 8];
  function b64(s) {
    if (typeof atob === 'function') { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
    return new Uint8Array(Buffer.from(s, 'base64'));
  }
  /** Decodifica ADPCM IMA (4 bit) in Float32. */
  function imaDecode(bytes, n) {
    var out = new Float32Array(n), pred = 0, idx = 0;
    for (var i = 0; i < n; i++) {
      var code = (bytes[i >> 1] >> ((i & 1) * 4)) & 15, step = STEP[idx], diff = step >> 3;
      if (code & 4) diff += step; if (code & 2) diff += step >> 1; if (code & 1) diff += step >> 2;
      pred += code & 8 ? -diff : diff; if (pred > 32767) pred = 32767; else if (pred < -32768) pred = -32768;
      idx += IDX[code & 7]; if (idx < 0) idx = 0; else if (idx > 88) idx = 88;
      out[i] = pred / 32768;
    }
    return out;
  }
  var bank = {}, pending = {};
  function register(json) {
    bank[json.id] = { sr: json.sr, notes: json.notes.map(function (n) { return { m: n.m, x: imaDecode(b64(n.d), n.n) }; }) };
    return bank[json.id];
  }
  // Strumenti personalizzati (Laboratorio suoni): id 'lab:...', con funzione di sintesi e dipendenze.
  var custom = {};
  function registerCustom(id, inf, fn, ready) { custom[id] = { info: inf, fn: fn, ready: ready || function () { return true; } }; cache = {}; }
  function has(id) { return !!bank[id] || synthIds.indexOf(id) >= 0 || (!!custom[id] && custom[id].ready()); }
  function info(id) { if (custom[id]) return custom[id].info; for (var i = 0; i < C.length; i++) if (C[i].id === id) return C[i]; return null; }
  /** Carica uno strumento (browser): base = cartella dei file (es. 'inst/'). */
  function load(id, base) {
    if (has(id)) return Promise.resolve(true);
    if (pending[id]) return pending[id];
    if (typeof fetch !== 'function') return Promise.resolve(false);
    pending[id] = fetch((base || 'inst/') + id + '.json').then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) { register(j); return true; }).catch(function () { delete pending[id]; return false; });
    return pending[id];
  }

  function repitch(src, ratio, len) {
    var out = new Float32Array(len), last = src.length - 1;
    for (var i = 0; i < len; i++) { var x = i * ratio, j = x | 0; if (j >= last) break; var f = x - j; out[i] = src[j] * (1 - f) + src[j + 1] * f; }
    return out;
  }
  // Allunga un suono tenuto ripetendo la parte centrale con dissolvenza incrociata.
  function sustainTo(x, len, sr) {
    if (x.length >= len) return x;
    var out = new Float32Array(len), a = Math.floor(x.length * 0.35), b = Math.floor(x.length * 0.8), seg = b - a, xf = Math.min(Math.floor(seg / 3), Math.round(0.08 * sr));
    out.set(x.subarray(0, b));
    var pos = b, k;
    while (pos < len) {
      for (k = 0; k < seg && pos + k < len; k++) {
        var v = x[a + k];
        if (k < xf) { var t = k / xf; out[pos + k - xf] = out[pos + k - xf] * (1 - t) + v * t; } else out[pos + k - xf] = v;
      }
      pos += seg - xf;
    }
    return out;
  }
  var cache = {};
  /**
   * Suona una nota: restituisce un Float32Array a frequenza sr.
   * opt.vel 0-1, opt.attack (s) per un ingresso morbido, opt.hold true per tenere tutta la durata.
   */
  function render(id, midi, dur, sr, opt) {
    opt = opt || {};
    var vel = opt.vel == null ? 1 : opt.vel, key = id + '|' + midi + '|' + dur.toFixed(2) + '|' + sr + '|' + vel.toFixed(2) + '|' + (opt.attack || 0) + (opt.hold ? 'h' : '');
    if (cache[key]) return cache[key];
    var out;
    if (custom[id]) { if (!custom[id].ready()) return null; out = custom[id].fn(midi, dur, sr, opt); }
    else if (synthIds.indexOf(id) >= 0) out = synthGuitar(id, midi, dur, sr);
    else {
      var b = bank[id]; if (!b) return null;
      var best = b.notes[0];
      b.notes.forEach(function (n) { if (Math.abs(n.m - midi) < Math.abs(best.m - midi)) best = n; });
      var ratio = Math.pow(2, (midi - best.m) / 12) * b.sr / sr, inf = info(id) || {}, tipo = inf.tipo || 'corda';
      var natural = Math.floor((best.x.length - 1) / ratio), rel = Math.round((tipo === 'sostenuto' ? 0.12 : 0.25) * sr);
      var want = tipo === 'sostenuto' || opt.hold ? Math.round(dur * sr) + rel : Math.min(natural, Math.round((dur + 0.8) * sr));
      out = repitch(best.x, ratio, Math.min(natural, want));
      if (want > out.length && (tipo === 'sostenuto' || opt.hold)) out = sustainTo(out, want, sr);
      var n = out.length, r0 = Math.max(0, n - rel), A = Math.round((opt.attack || 0) * sr);
      for (var i = 0; i < n; i++) {
        var g = vel;
        if (i < A) g *= i / A;
        if (i >= r0) g *= (n - i) / (n - r0);
        out[i] *= g;
      }
    }
    if (Object.keys(cache).length > 600) cache = {};
    return (cache[key] = out);
  }

  // ---------------- chitarre sintetizzate (Karplus-Strong) ----------------
  var synthIds = ['guitar', 'eguitar', 'nylon'];
  var seedG = 12345;
  function rnd() { seedG = (Math.imul(seedG, 1664525) + 1013904223) >>> 0; return seedG / 4294967296 * 2 - 1; }
  function synthGuitar(id, midi, dur, sr) {
    var f = 440 * Math.pow(2, (midi - 69) / 12), P = sr / f, N = Math.floor(P), frac = P - N;
    var len = Math.round(Math.min(dur + 1.2, 3.5) * sr), out = new Float32Array(len), buf = new Float32Array(N + 2), i;
    var bright = id === 'eguitar' ? 0.75 : (id === 'nylon' ? 0.35 : 0.55), decay = id === 'nylon' ? 0.994 : 0.997;
    // eccitazione: rumore filtrato (plettro) - più morbido per la classica
    var prev = 0;
    var mean = 0;
    for (i = 0; i < N; i++) { var v = rnd(); prev = prev + (v - prev) * bright; buf[i] = prev; mean += prev / N; }
    for (i = 0; i < N; i++) buf[i] -= mean; // niente corrente continua
    var p = 0, last = 0, pickPos = Math.max(1, Math.round(N * 0.18));
    for (i = 0; i < len; i++) {
      var a = buf[p], b = buf[(p + 1) % N], y = (a * (1 - frac) + b * frac);
      var nv = decay * (0.5 * (y + last)); last = y;
      buf[p] = nv; p = (p + 1) % N;
      out[i] = y - 0.6 * buf[(p + pickPos) % N] * 0.3;
    }
    // corpo della chitarra: piccola risonanza + uscita
    var y1 = 0, y2 = 0, w = 2 * Math.PI * (id === 'eguitar' ? 900 : 180) / sr, r = 0.97, c1 = 2 * r * Math.cos(w), c2 = -r * r;
    var rel = Math.round(0.15 * sr), stop = Math.min(len, Math.round((dur + 0.15) * sr) + rel), dcx = 0, dcy = 0, pk = 0;
    for (i = 0; i < len; i++) { var dv = out[i] - dcx + 0.995 * dcy; dcx = out[i]; dcy = dv; out[i] = dv; }
    for (i = 0; i < len; i++) {
      var body = out[i] + c1 * y1 + c2 * y2; y2 = y1; y1 = body;
      var s = out[i] * 0.85 + body * 0.012;
      if (id === 'eguitar') s = Math.tanh(s * 1.6) / 1.2;
      if (i > stop - rel) s *= Math.max(0, (stop - i) / rel);
      out[i] = s; if (Math.abs(s) > pk) pk = Math.abs(s);
    }
    var g = pk > 0 ? 0.8 / pk : 1;
    for (i = 0; i < stop; i++) out[i] *= g;
    return out.subarray(0, stop);
  }

  return {
    CATALOG: C, SYNTH: SYNTH, FAMILIES: FAMILIES, RECIPES: RECIPES,
    register: register, load: load, has: has, info: info, render: render, imaDecode: imaDecode, sustainTo: sustainTo,
    registerCustom: registerCustom, customIds: function () { return Object.keys(custom); }, renderRaw: function (id, midi, dur, sr, opt) { return render(id, midi, dur, sr, opt); },
    loaded: function () { return Object.keys(bank).concat(synthIds); }
  };
});
