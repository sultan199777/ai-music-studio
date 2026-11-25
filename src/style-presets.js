/*
 * Atmosfere "tipo …": caratteristiche di GENERE associate ad artisti e scene (velocità, strumenti, batteria, accordi, umore).
 * Non copiano nessuna base o melodia: sono punti di partenza per basi nuove e originali.
 * Ogni atmosfera si appoggia a uno stile dell'arrangiatore (base) e cambia strumenti, kit, tempo, modo e spinta.
 * PROGS: giri armonici (gradi della scala, 4 battute) per avere varianti davvero diverse.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StylePresets = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // gruppo, id, nome, base, bpm, modo, strumenti {melodia, accordi, pad, arpeggio}, kit, spinta {hat, lift, kickVar}, descrizione
  function P(gr, id, nome, base, bpm, mode, m, a, pd, ar, kit, tune, spiega, extra) { return Object.assign({ gruppo: gr, id: id, nome: nome, base: base, bpm: bpm, mode: mode, inst: { melodia: m, accordi: a, pad: pd, arpeggio: ar }, kit: kit, tune: tune || {}, spiega: spiega }, extra || {}); }
  var LIST = [
    // Italia
    P('Italia', 'sfera', 'Tipo Sfera Ebbasta', 'trap', 138, 'minore', ['pro:bell', 'pro:pluck', 'pro:glassbell'], ['pro:epfm', 'pro:pad'], ['pro:pad', 'glass'], ['pro:pluck', 'pro:glassbell'], 'trap', { hat: 1.2, lift: 1.2 }, 'Trap melodica: campane e pluck lucidi, 808 lungo, hi-hat veloci, ritornello che si apre.'),
    P('Italia', 'shiva', 'Tipo Shiva', 'street', 144, 'minore', ['piano', 'pro:bell', 'pizz'], ['pro:stab', 'piano'], ['pro:darkpad', 'cellos'], ['pizz'], 'drill', { hat: 1.1, kickVar: 1.3 }, 'Street pesante: piano scuro, colpi d\'ottoni, 808 duro e cassa spezzata.'),
    P('Italia', 'sangiovanni', 'Tipo Sangiovanni', 'reggaeton', 108, 'maggiore', ['pro:pluck', 'nylon', 'pro:lead'], ['nylon', 'guitar', 'pro:keys'], ['pro:pad'], ['pro:pluck', 'marimba'], 'club', { lift: 1.3 }, 'Pop urbano solare: chitarra, pluck, ritmo ballabile, ritornello cantabile.', { bassStyle: null }),
    P('Italia', 'ultimo', 'Tipo Ultimo (ballata)', 'melodico', 74, 'maggiore', ['piano', 'violins'], ['piano', 'upright'], ['violins', 'cellos'], ['piano', 'harp'], 'lofi', { hat: 0.6, lift: 1.4 }, 'Ballata col pianoforte: archi che crescono, batteria leggera, tanto spazio per la voce.', { bassStyle: null }),
    P('Italia', 'lazza', 'Tipo Lazza', 'trap', 146, 'minore', ['piano', 'pro:bell'], ['piano', 'pro:epfm'], ['violins', 'pro:darkpad'], ['piano', 'harp'], 'trap', { hat: 1.2 }, 'Trap col pianoforte protagonista, archi, 808 profondo, rullate fitte.'),
    P('Italia', 'geolier', 'Tipo Geolier (Napoli)', 'trap', 140, 'minore', ['harp', 'pro:pluck', 'dantranh'], ['nylon', 'pro:epfm'], ['pro:pad', 'violins'], ['harp', 'nylon'], 'trap', { lift: 1.2 }, 'Melodia mediterranea pizzicata, chitarra, 808 morbido e ritornello malinconico.'),
    P('Italia', 'tedua', 'Tipo Tedua', 'boombap', 90, 'minore', ['epiano', 'pro:keys', 'piano'], ['epiano', 'pro:epfm'], ['pro:pad', 'violas'], ['vibes', 'epiano'], 'boombap', { kickVar: 1.1 }, 'Rap introspettivo: piano elettrico, batteria polverosa, groove che respira.'),
    P('Italia', 'marracash', 'Tipo Marracash (cinematico)', 'epico', 86, 'minore', ['horn', 'violins', 'pro:choir'], ['pizz', 'piano'], ['cellos', 'pro:choir'], ['harp', 'pizz'], 'boombap', { lift: 1.3 }, 'Cinematico e serio: orchestra, cori, colpi grandi, tempo medio.'),
    P('Italia', 'kidyugi', 'Tipo Kid Yugi (scuro)', 'cloud', 84, 'minore', ['pro:choir', 'piano', 'bells'], ['pro:darkpad', 'piano'], ['pro:darkpad', 'cellos'], ['pro:glassbell'], 'boombap', { hat: 0.8 }, 'Atmosfera cupa e narrativa: cori, piano, poche note, tensione.'),
    P('Italia', 'capoplaza', 'Tipo Capo Plaza', 'trap', 142, 'minore', ['pro:bell', 'pro:lead'], ['pro:epfm', 'pro:pluck'], ['pro:pad'], ['pro:pluck'], 'trap', { hat: 1.3 }, 'Trap melodica veloce, campane, hi-hat a raffica, 808 che scivola.'),
    P('Italia', 'tonyeffe', 'Tipo Tony Effe (club)', 'clubtrap', 128, 'minore', ['pro:lead', 'pro:mallet'], ['pro:supersaw', 'pro:stab'], ['pro:pad'], ['pro:pluck'], 'club', { lift: 1.3, hat: 1.1 }, 'Club ruvido: synth grossi, cassa dritta, energia da festa.'),
    P('Italia', 'ghali', 'Tipo Ghali (afro pop)', 'afrotrap', 104, 'maggiore', ['marimba', 'kalimba', 'pro:mallet'], ['nylon', 'pro:keys'], ['pro:pad'], ['marimba'], 'club', {}, 'Afro pop: legni, chitarra, groove in levare, ritornello facile.'),
    P('Italia', 'mahmood', 'Tipo Mahmood (urban mediterraneo)', 'melodico', 100, 'minore', ['dantranh', 'pro:pluck', 'kalimba'], ['pro:epfm', 'nylon'], ['pro:pad', 'violins'], ['dantranh', 'harp'], 'club', { lift: 1.2 }, 'Urban pop con colori mediterranei e orientali, ritmo morbido.'),
    P('Italia', 'anna', 'Tipo Anna (jersey/club)', 'jersey', 145, 'minore', ['pro:lead', 'pro:mallet'], ['pro:stab', 'pro:supersaw'], ['pro:pad'], ['pro:pluck'], 'club', { hat: 1.2 }, 'Club veloce a rimbalzo, battimani, synth corti.'),
    P('Italia', 'tha', 'Tipo Tha Supreme (digitale)', 'plugg', 150, 'minore', ['pro:glassbell', 'pro:lead'], ['pro:pluck', 'pro:supersaw'], ['pro:pad'], ['pro:glassbell', 'pro:pluck'], 'trap', { hat: 1.3 }, 'Suoni digitali brillanti e strani, ritmo veloce, molta fantasia.'),
    // USA
    P('USA', 'drake', 'Tipo Drake (notturno)', 'rnb', 80, 'minore', ['pro:epfm', 'pro:keys'], ['pro:epfm', 'pro:pad'], ['pro:pad', 'pro:darkpad'], ['pro:keys'], 'lofi', { hat: 0.8 }, 'Rap melodico notturno: piano elettrico, pad sognanti, batteria morbida e filtrata.'),
    P('USA', 'drake2', 'Tipo Drake (trap scura)', 'trapdark', 140, 'minore', ['piano', 'pro:bell'], ['pro:epfm', 'piano'], ['pro:darkpad'], ['pro:glassbell'], 'trap', { hat: 0.9 }, 'Trap lenta e scura a metà tempo, piano e 808 enorme.'),
    P('USA', 'kanye', 'Tipo Kanye (soul)', 'boombap', 88, 'maggiore', ['piano', 'organ', 'pro:choir'], ['organ', 'piano', 'epiano'], ['pro:choir', 'organ'], ['piano'], 'boombap', { lift: 1.3 }, 'Soul e gospel: piano, organo, cori, batteria grossa e calda.', { bassStyle: null }),
    P('USA', 'travis', 'Tipo Travis Scott (psichedelico)', 'trapdark', 150, 'minore', ['pro:choir', 'pro:glassbell'], ['pro:darkpad', 'pro:supersaw'], ['pro:darkpad', 'pro:choir'], ['pro:glassbell'], 'trap', { hat: 1.1, lift: 1.3 }, 'Psichedelico: pad e cori lontani, molto riverbero, 808 distorto.'),
    P('USA', 'metro', 'Tipo Metro Boomin (orchestrale)', 'trapdark', 142, 'minore', ['violins', 'pro:bell', 'bells'], ['pizz', 'pro:stab'], ['cellos', 'pro:choir'], ['pizz', 'pro:bell'], 'trap', {}, 'Orchestra scura sopra la trap: archi, campane, cori, tensione da film.'),
    P('USA', 'future', 'Tipo Future / Atlanta', 'trap', 145, 'minore', ['pro:bell', 'pro:mallet'], ['pro:pluck', 'pro:epfm'], ['pro:pad'], ['pro:pluck', 'pro:bell'], 'trap', { hat: 1.3, kickVar: 1.2 }, 'Atlanta: campane, hi-hat a terzine, 808 che salta, molto ritmo.'),
    P('USA', 'lilbaby', 'Tipo Lil Baby (piano trap)', 'trap', 150, 'minore', ['piano', 'pro:pluck'], ['piano', 'pro:epfm'], ['pro:pad', 'violins'], ['piano'], 'trap', { hat: 1.2 }, 'Piano melodico veloce, 808 pulito e rotolante.'),
    P('USA', 'juice', 'Tipo Juice WRLD (emo)', 'emorap', 144, 'minore', ['guitar', 'pro:pluck'], ['guitar', 'nylon'], ['pro:pad'], ['guitar'], 'trap', {}, 'Chitarre tristi e accordi aperti, 808 profondo, ritornello emotivo.'),
    P('USA', 'carti', 'Tipo Playboi Carti (rage)', 'rage', 160, 'minore', ['pro:supersaw', 'pro:lead'], ['pro:supersaw', 'pro:stab'], ['pro:pad'], ['pro:pluck'], 'club', { hat: 1.3 }, 'Rage: synth enormi e distorti, energia aggressiva, hi-hat a raffica.'),
    P('USA', 'kendrick', 'Tipo Kendrick (jazz rap)', 'boombap', 92, 'minore', ['sax', 'epiano', 'upright'], ['epiano', 'upright'], ['pro:pad', 'violas'], ['vibes'], 'boombap', { kickVar: 1.2 }, 'Jazz rap: sax, piano elettrico, contrabbasso, groove sporco e vivo.', { bassStyle: null }),
    P('USA', 'weeknd', 'Tipo The Weeknd (anni 80)', 'melodico', 110, 'minore', ['pro:lead', 'pro:supersaw'], ['pro:supersaw', 'pro:pad'], ['pro:pad'], ['pro:pluck'], 'club', { lift: 1.3 }, 'Synth anni 80 notturni, cassa dritta, ritornello luminoso.'),
    P('USA', 'cudi', 'Tipo Kid Cudi (spaziale)', 'cloud', 76, 'minore', ['pro:choir', 'pro:glassbell'], ['pro:pad', 'pro:epfm'], ['pro:pad', 'pro:choir'], ['pro:glassbell'], 'lofi', {}, 'Spaziale e sognante, cori, molto spazio, voce che vola.'),
    // UK / NY / Latino
    P('UK e NY', 'popsmoke', 'Tipo Pop Smoke', 'brooklyn', 143, 'minore', ['pro:choir', 'violins', 'pro:bell'], ['pizz', 'pro:stab'], ['pro:choir', 'pro:darkpad'], ['pizz'], 'drill', {}, 'Drill di Brooklyn: 808 enormi che scivolano, cori e archi cupi.'),
    P('UK e NY', 'centralcee', 'Tipo Central Cee (UK drill)', 'drill', 142, 'minore', ['piano', 'violins', 'pro:pluck'], ['piano', 'pizz'], ['violins', 'pro:darkpad'], ['piano', 'pizz'], 'drill', {}, 'UK drill: piano e archi scivolati, hi-hat a terzine, 808 che salta.'),
    P('Latino', 'anuel', 'Tipo Anuel (trap latina)', 'trap', 135, 'minore', ['pro:bell', 'nylon', 'pro:pluck'], ['nylon', 'pro:epfm'], ['pro:darkpad'], ['nylon'], 'trap', {}, 'Trap latina: chitarra classica, campane, 808 scuro.'),
    P('Latino', 'badbunny', 'Tipo Bad Bunny (reggaeton)', 'reggaeton', 94, 'minore', ['pro:lead', 'marimba', 'pro:pluck'], ['pro:pluck', 'nylon'], ['pro:pad'], ['marimba'], 'club', {}, 'Reggaeton moderno: dembow, synth e legni, basso pieno.'),
    P('Latino', 'afrobeats', 'Afrobeats (Lagos)', 'afrotrap', 102, 'maggiore', ['kalimba', 'marimba', 'balafon'], ['nylon', 'pro:keys'], ['pro:pad'], ['marimba', 'balafon'], 'club', {}, 'Afrobeats: percussioni, legni, chitarra pulita, groove rilassato.')
  ];
  var PROGS = {
    minore: [[0, 5, 2, 6], [0, 3, 4, 0], [0, 5, 3, 4], [0, 6, 5, 6], [0, 3, 6, 5], [5, 6, 0, 0], [0, 2, 5, 6], [0, 4, 5, 3], [0, 0, 5, 6], [0, 5, 6, 4], [3, 0, 5, 6], [0, 3, 5, 4]],
    maggiore: [[0, 4, 5, 3], [0, 5, 3, 4], [3, 4, 0, 5], [0, 3, 4, 4], [5, 3, 0, 4], [0, 2, 3, 4], [0, 3, 0, 4], [3, 0, 4, 5], [0, 5, 1, 4], [0, 4, 3, 3]]
  };
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  function progName(pr, mode) { var minor = mode !== 'maggiore', q = minor ? [1, 0, 0, 1, 1, 0, 0] : [0, 1, 1, 0, 0, 1, 0]; return pr.map(function (d) { return q[d] ? ROMAN[d].toLowerCase() : ROMAN[d]; }).join('–'); }
  function byId(id) { for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i]; return null; }
  function rngOf(seed) { var s = (seed >>> 0) || 1; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  /** Una variante di un'atmosfera: strumenti, giro, arpeggio, kit, spinta e seme cambiano. */
  function variant(pr, seed, opt) {
    opt = opt || {}; var r = rngOf(seed), pick = function (a) { return a[Math.floor(r() * a.length)]; }, mode = opt.mode || pr.mode;
    var t = pr.tune || {}, j = function (v) { return Math.round((v == null ? 1 : v) * (0.85 + r() * 0.3) * 100) / 100; };
    return { preset: pr.id, nome: pr.nome, genre: pr.base, bpm: Math.max(60, Math.min(180, pr.bpm + Math.round((r() - 0.5) * 6))), mode: mode,
      inst: { melodia: pick(pr.inst.melodia), accordi: pick(pr.inst.accordi), pad: pick(pr.inst.pad), arpeggio: pick(pr.inst.arpeggio) },
      kit: r() < 0.8 ? pr.kit : pick(['trap', 'drill', 'boombap', 'club', 'lofi']), prog: pick(PROGS[mode] || PROGS.minore), arpPattern: pick(opt.arps || ['lento', 'terzine', 'ottavi', 'spezzato', 'sedicesimi', 'levare']),
      tune: { hat: j(t.hat), lift: j(t.lift), kickVar: j(t.kickVar), bass: j(t.bass) }, bassStyle: pr.bassStyle === null ? null : '808', seed: 1 + Math.floor(r() * 99999) };
  }
  /** Sceglie n varianti: pesi = quanto l'atmosfera si adatta (punteggi per stile base dal testo), più un po' di sorpresa; mai la stessa combinazione due volte. */
  function pickMany(n, weights, seed, onlyId) {
    var r = rngOf(seed), out = [], seen = {}, pool = onlyId ? [byId(onlyId)].filter(Boolean) : LIST;
    var w = pool.map(function (p) { return Math.max(0.2, (weights && weights[p.base]) || 1) * (0.6 + r()); });
    for (var tries = 0; out.length < n && tries < n * 20; tries++) {
      var tot = w.reduce(function (a, b) { return a + b; }, 0), x = r() * tot, k = 0; while (x > w[k] && k < w.length - 1) { x -= w[k]; k++; }
      var v = variant(pool[k], Math.floor(r() * 1e9)), sig = v.preset + v.inst.melodia + v.inst.accordi + v.prog.join('') + v.kit;
      if (seen[sig]) continue; seen[sig] = 1; out.push(v); if (!onlyId) w[k] *= 0.55; // la stessa atmosfera esce meno spesso
    }
    return out;
  }
  return { LIST: LIST, PROGS: PROGS, byId: byId, variant: variant, pickMany: pickMany, progName: progName };
});
