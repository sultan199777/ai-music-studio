/*
 * Cervello Sultan: legge il TESTO e decide da solo come deve suonare la base.
 *
 * Non è un modello di linguaggio: è un sistema di regole misurabili, tutto sul telefono, tutto spiegabile.
 * 1. SCENE: conta nel testo parole di mondi diversi (strada, soldi, rabbia, dolore, amore, festa, nostalgia, epico).
 * 2. FORMA: sillabe medie per riga (spazio per le parole), ripetizioni (ritornello da cantare), lunghezza.
 * 3. SCELTA: ogni scena "vota" gli stili pesanti (boom bap, street, trap pesante, drill, club...). Vince il
 *    punteggio più alto; a parità decide l'impronta del testo (hash), quindi due testi diversi non danno la
 *    stessa base. Anche tonalità, velocità, seme e tipo di basso dipendono dal testo.
 * 4. IMPARA: la scelta degli strumenti passa dal Coach (che conosce i tuoi mi piace / non mi piace).
 * Sono IPOTESI di mestiere: il giudizio finale è del tuo orecchio. Lo stile degli artisti è solo
 * descritto con caratteristiche misurabili (velocità, densità, pesantezza), mai copiato.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SultanBrain = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LEX = {
    strada: 'strada strade quartiere quartieri fra frate bro gang piazza zona blocco polizia sbirri sbirro galera carcere droga fumo erba giro cella ghetto periferia palazzi marciapiede vicolo ragazzi banda clan zone strada sirene sirena ambulanza ambulanze spari sparo sparatoria cemento asfalto cappuccio città citta sotterranea periferie rione rioni sbarre'.split(' '),
    soldi: 'soldi euro oro rolex lusso gucci prada macchina macchine diamanti collana collane cash banca fama top classifica platino dollari milioni tasca tasche portafoglio ferrari lambo orologio catena catene'.split(' '),
    rabbia: 'guerra sangue odio nemici nemico falsi falso tradito tradimento pistola lama morte mitra mitragliatrice rabbia fuoco bruciare ammazzo uccidere vendetta cattivo lotta combatto nemmeno'.split(' '),
    dolore: 'solo sola buio lacrime vuoto perso persa dolore pianto ricordi manca mancare addio piango male ferite ferita cicatrici ombra ombre spento silenzio notti notte prega prega madre urlano urlo consuma consumano nero neri nera dark oscuro oscura fantasmi fantasma gelo freddo'.split(' '),
    amore: 'amore bacio baci cuore occhi baby labbra insieme tesoro stringo abbraccio ti amo passione pelle'.split(' '),
    festa: 'festa estate mare ballare ballo sera club drink ragazze sole vacanza discoteca shot balliamo salto musica luci tutti'.split(' '),
    nostalgia: 'ricordo ricordi infanzia vecchio vecchia anni tempo ieri casa mamma papà nonno nonna ragazzino bambino passato scuola'.split(' '),
    epico: 'dio cielo sogno sogni destino re impero leggenda vittoria vinco corona trono eterno immortale storia mondo futuro luce'.split(' ')
  };
  // quanto ogni scena "vota" ogni stile (0-3)
  var VOTE = {
    strada: { boombap: 2, street: 2.5, trapdark: 2, drill: 1.5, trap: 1, brooklyn: 2, detroit: 1.5, phonk: 1 },
    soldi: { street: 2.5, trapdark: 1.5, clubtrap: 2, trap: 1.5, rage: 2, plugg: 2, detroit: 1.5, afrotrap: 1 },
    rabbia: { drill: 3, trapdark: 2.5, street: 1.5, brooklyn: 2.5, rage: 2.5, phonk: 2 },
    dolore: { trap: 2.5, boombap: 2, melodico: 1.5, trapdark: 1, emorap: 3, cloud: 2, rnb: 2, lofi: 1.5 },
    amore: { melodico: 2.5, clubtrap: 1.5, trap: 1, rnb: 2.5, afrotrap: 2, reggaeton: 2, cloud: 1, lofi: 1 },
    festa: { clubtrap: 3, estate: 2.5, melodico: 0.5, reggaeton: 3, afrotrap: 2.5, jersey: 2, plugg: 1 },
    nostalgia: { boombap: 3, melodico: 2, trap: 0.5, lofi: 3, cloud: 2, rnb: 1.5 },
    epico: { epico: 3, street: 1.5, trapdark: 1, rage: 1, cloud: 1, brooklyn: 1 }
  };
  // Umori voluti: spingono stile, scala e velocità (Ipotesi di mestiere, da tarare a orecchio)
  var MOOD = {
    malinconico: { votes: { trap: 2, boombap: 1.2, melodico: 1, street: 0.4, emorap: 2.5, cloud: 1.5, rnb: 1.2, lofi: 1.2 }, mode: 'minore', bpm: -6 },
    dark: { votes: { trapdark: 2.5, drill: 1.5, street: 1, brooklyn: 2, phonk: 2, rage: 1 }, mode: 'minore', bpm: 0 },
    euforico: { votes: { clubtrap: 2.5, estate: 1.5, melodico: 1, reggaeton: 2, afrotrap: 2, jersey: 1.5, plugg: 1.5 }, mode: 'maggiore', bpm: 4 },
    aggressivo: { votes: { drill: 2.5, trapdark: 1.5, street: 1, brooklyn: 2, rage: 2.5, phonk: 1.5 }, mode: 'minore', bpm: 4 },
    romantico: { votes: { melodico: 2, clubtrap: 1, trap: 0.5, rnb: 2.5, afrotrap: 1.2, reggaeton: 1 }, mode: 'maggiore', bpm: -2 },
    nostalgico: { votes: { boombap: 2.5, melodico: 1.5, trap: 0.4, lofi: 2.5, cloud: 1.5 }, mode: 'minore', bpm: -6 },
    emo: { votes: { emorap: 3, cloud: 1.5, trap: 1.5, melodico: 1 }, mode: 'minore', bpm: -2 },
    horror: { votes: { phonk: 2.5, trapdark: 2, drill: 1.5, brooklyn: 1.5, rage: 1 }, mode: 'minore', bpm: -4 },
    sognante: { votes: { cloud: 3, rnb: 2, lofi: 1.5, melodico: 1.5 }, mode: 'minore', bpm: -10 },
    trionfale: { votes: { epico: 3, rage: 2, street: 1.5, trapdark: 1, detroit: 1.5 }, mode: 'maggiore', bpm: 2 }
  };
  var SCENE_MOOD = { strada: 'dark', rabbia: 'aggressivo', dolore: 'malinconico', festa: 'euforico', amore: 'romantico', nostalgia: 'nostalgico', soldi: 'euforico', epico: 'euforico' };
  var GENRES = ['boombap', 'street', 'trapdark', 'drill', 'trap', 'clubtrap', 'melodico', 'estate', 'epico', 'brooklyn', 'plugg', 'rage', 'jersey', 'afrotrap', 'reggaeton', 'phonk', 'emorap', 'rnb', 'cloud', 'detroit', 'lofi'];
  var BASE_BPM = { boombap: 90, street: 96, trapdark: 144, drill: 142, trap: 138, clubtrap: 98, melodico: 94, estate: 100, epico: 84, brooklyn: 143, plugg: 150, rage: 158, jersey: 145, afrotrap: 105, reggaeton: 95, phonk: 130, emorap: 144, rnb: 78, cloud: 70, detroit: 98, lofi: 82 };
  var MAJOR_OK = { melodico: 1, estate: 1, clubtrap: 1, afrotrap: 1, reggaeton: 1, plugg: 1, lofi: 1, jersey: 1 };
  var NAMES = { boombap: 'Boom bap pesante', street: 'Street 50 Cent', trapdark: 'Trap scura pesante', drill: 'Drill', trap: 'Trap', clubtrap: 'Club (dembow trap)', melodico: 'Melodico', estate: 'Estate latina', epico: 'Epico', brooklyn: 'Drill di Brooklyn', plugg: 'Plugg', rage: 'Rage', jersey: 'Jersey club', afrotrap: 'Afro trap', reggaeton: 'Reggaeton', phonk: 'Phonk', emorap: 'Emo rap', rnb: 'R&B lento', cloud: 'Cloud rap', detroit: 'Detroit', lofi: 'Lo-fi' };

  function hash(s) { var h = 2166136261 >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function words(text) { return (String(text || '').toLowerCase().replace(/\[[^\]]*\]/g, ' ').match(/[a-zàèéìíòóùú']+/g) || []); }
  function round(v) { return Math.round(v * 100) / 100; }

  /**
   * @param {string} text  il testo grezzo
   * @param {object} [an]  risultato di LyricsEngine.analyze (opzionale: sillabe e ripetizioni)
   * @param {{variant?:number}} [opt] variant: numero di "nuova versione" (cambia seme e dettagli)
   */
  /* Stile scritto a parole ("trap dark", "drill malinconica") -> genere, umore, pesantezza. */
  function parseStyle(t) {
    t = String(t || '').toLowerCase(); var o = { genre: null, mood: null, heavy: false };
    if (!t.trim()) return o;
    if (/boom\s*bap|boombap|old\s*school/.test(t)) o.genre = 'boombap';
    else if (/drill/.test(t)) o.genre = 'drill';
    else if (/club|dembow|tony/.test(t)) o.genre = 'clubtrap';
    else if (/street|50\s*cent|dogo/.test(t)) o.genre = 'street';
    else if (/trap/.test(t)) o.genre = /dark|scur|oscur|pesant|cattiv|duro|nero/.test(t) ? 'trapdark' : 'trap';
    else if (/melodic|rnb|r&b/.test(t)) o.genre = 'melodico';
    else if (/epic|orchestr|cinema/.test(t)) o.genre = 'epico';
    if (/malinconic|triste|nostalgi/.test(t)) o.mood = /nostalgi/.test(t) ? 'nostalgico' : 'malinconico';
    else if (/aggress|rabbi|cattiv|violent/.test(t)) o.mood = 'aggressivo';
    else if (/euforic|festa|carica/.test(t)) o.mood = 'euforico';
    else if (/romantic|amore/.test(t)) o.mood = 'romantico';
    else if (/dark|scur|oscur|nero|buio/.test(t)) o.mood = 'dark';
    o.heavy = /dark|scur|oscur|pesant|cattiv|duro|nero|buio|drill|aggress|rabbi/.test(t);
    return o;
  }
  function plan(text, an, opt) {
    opt = opt || {};
    var ws = words(text), n = ws.length, variant = opt.variant || 0;
    var h = hash(ws.join(' ') || 'vuoto'), why = [];
    var scenes = {}, total = 0;
    Object.keys(LEX).forEach(function (k) {
      var set = {}; LEX[k].forEach(function (w) { set[w] = 1; });
      var c = 0; ws.forEach(function (w) { if (set[w]) c++; });
      scenes[k] = c; total += c;
    });
    var score = {}; GENRES.forEach(function (g) { score[g] = 0; });
    Object.keys(scenes).forEach(function (k) {
      if (!scenes[k]) return;
      var share = scenes[k] / Math.max(1, total);
      Object.keys(VOTE[k]).forEach(function (g) { score[g] += share * VOTE[k][g] * Math.min(3, 1 + scenes[k] / 4); });
    });
    var top = Object.keys(scenes).filter(function (k) { return scenes[k] > 0; }).sort(function (a, b) { return scenes[b] - scenes[a]; });
    var scene = top[0] || null;
    if (top.length) why.push('Nel testo pesano le scene: ' + top.slice(0, 3).map(function (k) { return k + ' (' + scenes[k] + ')'; }).join(', ') + '.');
    else why.push('Poche parole riconosciute: lascio decidere l\'impronta del testo e la forma delle righe.');

    // forma del testo
    var avg = an && an.syllables ? an.syllables.average : (n && text ? n / Math.max(1, (String(text).split('\n').filter(function (l) { return l.trim() && !/^\[/.test(l.trim()); }).length)) * 1.8 : 9);
    var rep = an ? an.repetitionShare || 0 : 0;
    if (avg >= 12) { score.boombap += 1.2; score.street += 0.8; why.push('Righe lunghe (' + round(avg) + ' sillabe): servono battute larghe e tempo più basso, come nel boom bap.'); }
    else if (avg <= 8 && avg > 0) { score.drill += 0.6; score.clubtrap += 0.8; score.trap += 0.5; why.push('Righe corte (' + round(avg) + ' sillabe): ritmo più veloce e secco.'); }
    if (rep >= 0.25) { score.clubtrap += 1; score.trap += 0.5; why.push('Molte ripetizioni: ritornello da cantare tutti insieme.'); }

    // impronta del testo: piccolo spostamento deterministico, così testi diversi non danno lo stesso stile
    GENRES.forEach(function (g, i) { score[g] += ((((h >>> (i * 3)) & 7) / 7) * 0.9) + ((((variant * 2654435761) >>> (i * 2)) & 3) / 3) * (variant ? 1.3 : 0); });
    /* gusto di base dell'utente (trap, drill, dark): senza scene di festa/amore, gli stili solari restano indietro. Si vede in 'why'. */
    var bright0 = (scenes.festa || 0) + (scenes.amore || 0), wantsLight = bright0 > (scenes.dolore || 0) + (scenes.strada || 0) + (scenes.rabbia || 0) || opt.mood === 'euforico' || opt.mood === 'romantico';
    if (!wantsLight) { ['afrotrap', 'reggaeton', 'estate', 'jersey', 'clubtrap', 'melodico', 'lofi', 'rnb'].forEach(function (g) { score[g] -= 1.4; }); ['trapdark', 'drill', 'trap', 'brooklyn', 'street'].forEach(function (g) { score[g] += 0.8; }); why.push('Il tuo stile è trap/drill/dark: parto da lì, se il testo non chiede festa o amore.'); }
    var ps = parseStyle(opt.styleText); if (ps.mood && !opt.mood) opt = Object.assign({}, opt, { mood: ps.mood });
    if (opt.forceGenre && score[opt.forceGenre] != null) { score[opt.forceGenre] += 100; why.push('Stile scelto da te dalla lista.'); }
    if (ps.genre) { score[ps.genre] += 100; why.push('Stile che hai scritto: «' + String(opt.styleText).trim() + '».'); }
    var moodWanted = opt.mood && MOOD[opt.mood] ? opt.mood : null, moodAuto = top[0] ? SCENE_MOOD[top[0]] : null, moodTarget = moodWanted || moodAuto || null;
    if (moodWanted) {
      Object.keys(MOOD[moodWanted].votes).forEach(function (g) { score[g] += MOOD[moodWanted].votes[g] * 1.6; });
      why.push('Umore voluto: ' + moodWanted + ' → spingo verso ' + Object.keys(MOOD[moodWanted].votes).slice(0, 2).map(function (g) { return NAMES[g]; }).join(' e ') + '.');
    }
    if (opt.profile && opt.profile.styleScore) {
      GENRES.forEach(function (g) { score[g] += 2 * (opt.profile.styleScore[g] || 0); });
      why.push('Sto seguendo il tuo modello artisti (' + (opt.profile.names || 'profilo') + '): ' + opt.profile.mood);
    }
    if (opt.avoid && opt.avoid.length) opt.avoid.forEach(function (g) { if (score[g] != null) score[g] -= 6; });
    var order = GENRES.slice().sort(function (a, b) { return score[b] - score[a]; });
    var genre = order[0];
    /* ogni nuova versione passa a uno degli stili vicini al migliore: così «un'altra» è davvero un'altra, ma resta nel gusto del testo */
    if (variant > 0 && !ps.genre && !opt.forceGenre) { var near = order.filter(function (g) { return score[g] >= score[order[0]] - 3 && (wantsLight || ['cloud', 'lofi', 'rnb', 'melodico', 'estate'].indexOf(g) < 0); }).slice(0, 6); if (!near.length) near = order.filter(function (g) { return wantsLight || ['cloud', 'lofi', 'rnb', 'melodico', 'estate'].indexOf(g) < 0; }).slice(0, 6); if (!near.length) near = order.slice(0, 6); genre = near[(variant - 1 + (h % 3)) % near.length]; }
    why.push('Stile scelto: ' + NAMES[genre] + (order[1] ? ' (secondo: ' + NAMES[order[1]] + ')' : '') + '.');

    // velocità, scala, tonalità, seme
    var bpm = BASE_BPM[genre] + (avg >= 12 ? -6 : (avg > 0 && avg <= 8 ? 5 : 0)) + (((h >>> 5) % 9) - 4) + (variant ? ((variant * 3) % 5) - 2 : 0);
    var lo = Math.max(60, BASE_BPM[genre] - 12), hi = BASE_BPM[genre] + 12;
    bpm = Math.max(lo, Math.min(hi, Math.round(bpm)));
    var bright = scenes.festa + scenes.amore + scenes.epico > scenes.dolore + scenes.rabbia + scenes.strada;
    var mode = MAJOR_OK[genre] && bright ? 'maggiore' : 'minore';
    if (moodWanted) { var mm = MOOD[moodWanted].mode; mode = mm === 'maggiore' ? (MAJOR_OK[genre] ? 'maggiore' : 'minore') : 'minore'; bpm += MOOD[moodWanted].bpm; bpm = Math.max(lo, Math.min(hi, bpm)); }
    var tonic = (h >>> 9) % 12; if (variant) tonic = (tonic + variant * 5) % 12;
    var seed = ((h >>> 1) % 90000) + 1 + variant * 17;
    var bassStyle = /boombap|melodico|estate/.test(genre) ? null : '808';
    why.push('Velocità ' + bpm + ' BPM, ' + mode + ', tonalità ' + ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'][tonic] + ': nascono dall\'impronta di questo testo, un altro testo darà un\'altra base.');
    return { heavy: ps.heavy || ['dark', 'aggressivo'].indexOf(moodTarget) >= 0 || ['trapdark', 'drill'].indexOf(genre) >= 0, moodTarget: moodTarget, genre: genre, label: NAMES[genre], bpm: bpm, mode: mode, tonic: tonic, seed: seed, bassStyle: bassStyle, sounds: 'campioni', scene: scene, scenes: scenes, scores: score, why: why, second: order[1] };
  }

  /** Punteggio di stile da una distribuzione di scene (quote 0-1) e dalla forma: serve ai profili artista. */
  function styleScores(shares, avgSyll, rep) {
    var sc = {}; GENRES.forEach(function (g) { sc[g] = 0; });
    Object.keys(shares).forEach(function (k) { if (VOTE[k]) Object.keys(VOTE[k]).forEach(function (g) { sc[g] += shares[k] * VOTE[k][g]; }); });
    if (avgSyll >= 12) { sc.boombap += 0.4; sc.street += 0.3; } else if (avgSyll > 0 && avgSyll <= 8) { sc.drill += 0.3; sc.clubtrap += 0.3; sc.trap += 0.2; }
    if (rep >= 0.25) { sc.clubtrap += 0.3; sc.trap += 0.2; }
    var mx = 0; GENRES.forEach(function (g) { if (sc[g] > mx) mx = sc[g]; });
    if (mx > 0) GENRES.forEach(function (g) { sc[g] = Math.round(sc[g] / mx * 100) / 100; });
    return sc;
  }

  return { MOOD: MOOD, parseStyle: parseStyle, plan: plan, styleScores: styleScores, words: words, BASE_BPM: BASE_BPM, hash: hash, NAMES: NAMES, GENRES: GENRES, LEX: LEX };
});
