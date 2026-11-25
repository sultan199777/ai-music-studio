/*
 * MUSICAL DNA ENGINE: ogni stile è un elenco di NUMERI (velocità, swing, densità cassa, rullante, hi-hat, 808, giro armonico…).
 *  - PROFILES: 24 profili di artisti e famiglie. Sono caratteristiche GENERALI di genere (ipotesi di mestiere), non copie di brani:
 *    nessuna melodia, nessun campione, nessuna base di nessuno.
 *  - fuse(parti): mescola più profili in uno nuovo (media pesata dei numeri; per le scelte a categoria vince il peso maggiore).
 *  - emotion(testo): legge il testo e dà un punteggio a 8 emozioni; applyEmotion() sposta i numeri (tempo, modo, buio, spinta…).
 *  - toProd(dna, seed): trasforma i numeri in parametri che l'Arrangiatore (Beat Composer) usa davvero → base ascoltabile.
 * Tutto locale, nessun costo, nessuna API.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./remix.js'));
  else root.DNA = factory(root.Remix);
})(typeof self !== 'undefined' ? self : this, function (Remix) {
  'use strict';
  /* campi numerici: min, max, nome in italiano, cosa cambia nel suono */
  var FIELDS = {
    bpm: [60, 175, 'Velocità (BPM)', 'tempo della base'],
    swing: [0, 0.16, 'Swing', 'quanto i colpi sono ritardati (groove "morbido")'],
    kick: [0, 1, 'Cassa: densità', 'quanti colpi di cassa per battuta'],
    snareHalf: [0, 1, 'Rullante a mezzo tempo', '1 = rullante sul 3 (trap), 0 = sul 2 e 4 (boom bap)'],
    hat: [0.5, 1.7, 'Hi-hat: volume e densità', 'forza degli hi-hat'],
    rolls: [0, 1, 'Rullate di hi-hat', 'quante rullate veloci'],
    slide: [0, 1, '808: scivolate', 'quanto il basso scivola tra le note'],
    drive: [0.8, 3.5, '808: distorsione', 'grinta del basso'],
    bass: [0.6, 1.6, 'Basso: volume', 'peso del basso'],
    lift: [0.6, 1.6, 'Dinamica: spinta', 'quanto cresce il ritornello'],
    rest: [0, 0.6, 'Melodia: pause', 'più pause = melodia più asciutta'],
    dark: [0, 1, 'Buio', 'sale: suoni scuri, note tese, 808 in primo piano'],
    duck: [0, 0.6, 'Respiro (sidechain)', 'gli accordi si abbassano a ogni cassa']
  };
  var ORDER = Object.keys(FIELDS);
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rd(v) { return Math.round(v * 100) / 100; }
  function rng(seed) { var a = (seed >>> 0) || 1; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* id, nome, gruppo, stile dell'arrangiatore, modo, hat, giri armonici (gradi), numeri */
  function D(id, nome, gruppo, fam, mode, hatKind, progs, n, presetId) {
    var o = { id: id, nome: nome, gruppo: gruppo, fam: fam, mode: mode, hatKind: hatKind, progs: progs, preset: presetId || null };
    ORDER.forEach(function (k) { o[k] = n[k] != null ? n[k] : (FIELDS[k][0] + FIELDS[k][1]) / 2; }); return o;
  }
  var MIN = [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6], [5, 6, 0, 0], [0, 5, 3, 4]], MAJ = [[0, 4, 5, 3], [5, 3, 0, 4], [0, 3, 4, 3], [0, 5, 3, 4]];
  var LIST = [
    // Italia
    D('sfera', 'Sfera Ebbasta', 'Italia', 'trap', 'minore', 'trap', [[0, 5, 2, 6], [0, 6, 5, 6], [0, 3, 5, 4]], { bpm: 140, swing: 0.01, kick: 0.5, snareHalf: 1, hat: 1.25, rolls: 0.7, slide: 0.35, drive: 1.9, bass: 1.1, lift: 1.2, rest: 0.18, dark: 0.55, duck: 0.35 }, 'sfera'),
    D('shiva', 'Shiva', 'Italia', 'street', 'minore', 'drill', [[0, 6, 5, 6], [5, 6, 0, 0], [0, 0, 3, 6]], { bpm: 144, swing: 0, kick: 0.65, snareHalf: 1, hat: 1.1, rolls: 0.5, slide: 0.6, drive: 2.5, bass: 1.25, lift: 1.1, rest: 0.28, dark: 0.8, duck: 0.3 }, 'shiva'),
    D('kidyugi', 'Kid Yugi', 'Italia', 'cloud', 'minore', 'soft', [[0, 5, 2, 6], [5, 6, 0, 0]], { bpm: 84, swing: 0.04, kick: 0.3, snareHalf: 0.6, hat: 0.8, rolls: 0.15, slide: 0.4, drive: 1.6, bass: 1, lift: 1, rest: 0.42, dark: 0.85, duck: 0.2 }, 'kidyugi'),
    D('ultimo', 'Ultimo (ballata)', 'Italia', 'melodico', 'maggiore', 'soft', [[0, 4, 5, 3], [0, 3, 4, 3], [5, 3, 0, 4]], { bpm: 74, swing: 0.04, kick: 0.2, snareHalf: 0, hat: 0.6, rolls: 0, slide: 0.05, drive: 1.1, bass: 0.8, lift: 1.5, rest: 0.1, dark: 0.15, duck: 0.15 }, 'ultimo'),
    D('geolier', 'Geolier', 'Italia', 'trap', 'minore', 'trap', [[0, 5, 2, 6], [0, 3, 5, 4]], { bpm: 140, swing: 0.03, kick: 0.5, snareHalf: 1, hat: 1.05, rolls: 0.45, slide: 0.3, drive: 1.7, bass: 1.05, lift: 1.2, rest: 0.2, dark: 0.5, duck: 0.35 }, 'geolier'),
    D('lazza', 'Lazza', 'Italia', 'trap', 'minore', 'trap', [[0, 5, 2, 6], [5, 6, 0, 0]], { bpm: 146, swing: 0, kick: 0.55, snareHalf: 1, hat: 1.2, rolls: 0.65, slide: 0.35, drive: 2, bass: 1.15, lift: 1.3, rest: 0.15, dark: 0.6, duck: 0.3 }, 'lazza'),
    D('anna', 'ANNA', 'Italia', 'reggaeton', 'minore', 'soft', [[0, 5, 3, 4], [0, 3, 5, 4]], { bpm: 100, swing: 0.06, kick: 0.45, snareHalf: 0.3, hat: 0.9, rolls: 0.2, slide: 0.2, drive: 1.4, bass: 1.1, lift: 1.3, rest: 0.2, dark: 0.3, duck: 0.3 }, 'sangiovanni'),
    D('rondo', 'Rondo', 'Italia', 'trap', 'minore', 'trap', [[0, 5, 2, 6], [0, 6, 5, 6]], { bpm: 140, swing: 0, kick: 0.6, snareHalf: 1, hat: 1.15, rolls: 0.6, slide: 0.4, drive: 2.1, bass: 1.2, lift: 1.1, rest: 0.22, dark: 0.65, duck: 0.35 }),
    // Estero
    D('drake', 'Drake', 'Estero', 'rnb', 'minore', 'soft', [[0, 5, 2, 6], [0, 3, 5, 4]], { bpm: 78, swing: 0.1, kick: 0.35, snareHalf: 1, hat: 0.85, rolls: 0.3, slide: 0.3, drive: 1.5, bass: 1, lift: 1, rest: 0.3, dark: 0.45, duck: 0.25 }),
    D('travis', 'Travis Scott', 'Estero', 'rage', 'minore', 'trap', [[0, 6, 5, 6], [0, 0, 3, 6]], { bpm: 140, swing: 0, kick: 0.55, snareHalf: 1, hat: 1.2, rolls: 0.6, slide: 0.55, drive: 2.6, bass: 1.3, lift: 1.4, rest: 0.25, dark: 0.75, duck: 0.35 }),
    D('future', 'Future', 'Estero', 'trapdark', 'minore', 'trap', [[0, 5, 2, 6], [5, 6, 0, 0]], { bpm: 130, swing: 0, kick: 0.5, snareHalf: 1, hat: 1.1, rolls: 0.65, slide: 0.5, drive: 2.3, bass: 1.3, lift: 1, rest: 0.3, dark: 0.75, duck: 0.35 }),
    D('badbunny', 'Bad Bunny', 'Estero', 'reggaeton', 'minore', 'soft', [[0, 5, 3, 4], [0, 3, 0, 3]], { bpm: 96, swing: 0.07, kick: 0.5, snareHalf: 0.2, hat: 0.9, rolls: 0.15, slide: 0.25, drive: 1.5, bass: 1.15, lift: 1.2, rest: 0.18, dark: 0.35, duck: 0.3 }),
    D('anuel', 'Anuel AA', 'Estero', 'trap', 'minore', 'trap', [[0, 5, 2, 6], [0, 3, 5, 4]], { bpm: 134, swing: 0.02, kick: 0.5, snareHalf: 1, hat: 1.1, rolls: 0.55, slide: 0.4, drive: 1.9, bass: 1.15, lift: 1.1, rest: 0.22, dark: 0.55, duck: 0.35 }),
    D('smoke', 'Pop Smoke (drill)', 'Estero', 'brooklyn', 'minore', 'drill', [[0, 6, 5, 6], [5, 6, 0, 0]], { bpm: 143, swing: 0, kick: 0.6, snareHalf: 1, hat: 1.05, rolls: 0.5, slide: 0.9, drive: 2.8, bass: 1.4, lift: 1.1, rest: 0.3, dark: 0.85, duck: 0.35 }),
    D('weeknd', 'The Weeknd', 'Estero', 'rnb', 'minore', 'soft', [[0, 5, 2, 6], [0, 3, 6, 5]], { bpm: 108, swing: 0.02, kick: 0.4, snareHalf: 0, hat: 0.9, rolls: 0.1, slide: 0.2, drive: 1.3, bass: 1, lift: 1.4, rest: 0.15, dark: 0.5, duck: 0.4 }),
    // Famiglie sonore
    D('f-trap', 'Trap', 'Famiglie', 'trap', 'minore', 'trap', MIN, { bpm: 140, swing: 0, kick: 0.5, snareHalf: 1, hat: 1.2, rolls: 0.7, slide: 0.3, drive: 1.8, bass: 1.1, lift: 1.1, rest: 0.18, dark: 0.5, duck: 0.35 }),
    D('f-drill', 'Drill', 'Famiglie', 'drill', 'minore', 'drill', MIN, { bpm: 142, swing: 0, kick: 0.6, snareHalf: 1, hat: 1.1, rolls: 0.55, slide: 0.7, drive: 2.4, bass: 1.3, lift: 1, rest: 0.3, dark: 0.85, duck: 0.3 }),
    D('f-boombap', 'Boom bap', 'Famiglie', 'boombap', 'minore', 'soft', MIN, { bpm: 90, swing: 0.12, kick: 0.35, snareHalf: 0, hat: 0.8, rolls: 0.05, slide: 0.1, drive: 1.2, bass: 0.9, lift: 1, rest: 0.25, dark: 0.4, duck: 0.2 }),
    D('f-cloud', 'Cloud rap', 'Famiglie', 'cloud', 'minore', 'soft', MIN, { bpm: 70, swing: 0.06, kick: 0.3, snareHalf: 1, hat: 0.7, rolls: 0.1, slide: 0.3, drive: 1.4, bass: 1, lift: 1.2, rest: 0.35, dark: 0.6, duck: 0.25 }),
    D('f-rnb', 'R&B lento', 'Famiglie', 'rnb', 'minore', 'soft', MIN, { bpm: 78, swing: 0.12, kick: 0.3, snareHalf: 1, hat: 0.8, rolls: 0.1, slide: 0.2, drive: 1.2, bass: 0.95, lift: 1.2, rest: 0.2, dark: 0.35, duck: 0.25 }),
    D('f-reggaeton', 'Reggaeton', 'Famiglie', 'reggaeton', 'minore', 'soft', MIN, { bpm: 96, swing: 0.07, kick: 0.5, snareHalf: 0.2, hat: 0.9, rolls: 0.15, slide: 0.2, drive: 1.5, bass: 1.1, lift: 1.2, rest: 0.18, dark: 0.3, duck: 0.3 }),
    D('f-ballata', 'Ballata pianoforte', 'Famiglie', 'melodico', 'maggiore', 'soft', MAJ, { bpm: 74, swing: 0.04, kick: 0.2, snareHalf: 0, hat: 0.6, rolls: 0, slide: 0.05, drive: 1.1, bass: 0.8, lift: 1.5, rest: 0.1, dark: 0.15, duck: 0.15 }),
    D('f-rage', 'Rage', 'Famiglie', 'rage', 'minore', 'trap', MIN, { bpm: 156, swing: 0, kick: 0.6, snareHalf: 1, hat: 1.3, rolls: 0.7, slide: 0.5, drive: 2.8, bass: 1.3, lift: 1.5, rest: 0.2, dark: 0.7, duck: 0.4 }),
    D('f-phonk', 'Phonk', 'Famiglie', 'phonk', 'minore', 'trap', MIN, { bpm: 130, swing: 0.03, kick: 0.55, snareHalf: 1, hat: 1.1, rolls: 0.4, slide: 0.6, drive: 3, bass: 1.35, lift: 1, rest: 0.25, dark: 0.8, duck: 0.35 })
  ];
  var BY = {}; LIST.forEach(function (p) { BY[p.id] = p; });
  function byId(id) { return BY[id] || null; }

  function neutral() { var o = { fam: 'trap', mode: 'minore', hatKind: 'trap', progs: MIN, name: 'Nuovo stile', parts: [] }; ORDER.forEach(function (k) { o[k] = (FIELDS[k][0] + FIELDS[k][1]) / 2; }); return o; }
  function sanitize(d) { var o = neutral(); if (!d) return o; ORDER.forEach(function (k) { if (typeof d[k] === 'number' && isFinite(d[k])) o[k] = rd(clamp(d[k], FIELDS[k][0], FIELDS[k][1])); }); if (d.fam) o.fam = d.fam; if (d.mode === 'maggiore') o.mode = 'maggiore'; if (d.hatKind) o.hatKind = d.hatKind; if (Array.isArray(d.progs) && d.progs.length) o.progs = d.progs; if (d.name) o.name = String(d.name).slice(0, 60); if (Array.isArray(d.parts)) o.parts = d.parts; return o; }

  /* GENRE FUSION: parts = [{id|dna, w}] → un DNA nuovo. Numeri: media pesata. Categorie: scelte a peso (ripetibile col seme). */
  function fuse(parts, seed) {
    var ps = (parts || []).map(function (x) { var d = x.dna || BY[x.id]; return d ? { d: d, w: Math.max(0, +x.w || 0), id: x.id || d.id } : null; }).filter(function (x) { return x && x.w > 0; });
    if (!ps.length) return neutral();
    var tot = ps.reduce(function (a, x) { return a + x.w; }, 0), r = rng((seed || 1) * 7919 + 13), out = neutral();
    ORDER.forEach(function (k) { out[k] = rd(clamp(ps.reduce(function (a, x) { return a + x.d[k] * x.w; }, 0) / tot, FIELDS[k][0], FIELDS[k][1])); });
    function vote(get) { var m = {}; ps.forEach(function (x) { var v = get(x.d); m[v] = (m[v] || 0) + x.w; }); var best = null; Object.keys(m).forEach(function (v) { if (best == null || m[v] > m[best] + 1e-9) best = v; }); return best; }
    out.fam = vote(function (d) { return d.fam; }); out.hatKind = vote(function (d) { return d.hatKind; });
    var maj = ps.reduce(function (a, x) { return a + (x.d.mode === 'maggiore' ? x.w : 0); }, 0) / tot; out.mode = maj > 0.5 ? 'maggiore' : 'minore';
    /* giro armonico: si pesca da un profilo a caso, in proporzione al peso, tra i suoi giri */
    var t = r() * tot, acc = 0, src = ps[0].d; for (var i = 0; i < ps.length; i++) { acc += ps[i].w; if (t <= acc) { src = ps[i].d; break; } }
    out.progs = src.progs.map(function (p) { return p.slice(); });
    out.parts = ps.map(function (x) { return { id: x.id, w: rd(x.w / tot) }; });
    out.name = ps.map(function (x) { return x.d.nome || x.d.name; }).join(' + ');
    return out;
  }

  /* ===== EMOTION ENGINE ===== */
  var LEX = {
    malinconia: 'malinconia triste tristezza pianto lacrime lacrima piango vuoto pioggia grigio spento perso perdere persa addio dolore male ferita ferite buio ombra',
    nostalgia: 'ricordo ricordi ricordare passato nostalgia infanzia ieri una volta vecchi vecchio tornare indietro foto anni quartiere rimpianto mancano manchi manca',
    rabbia: 'rabbia odio incazzato incazzata urlo urlare guerra sangue ammazzo ammazzare fuoco brucia brucio schifo bastardi nemici nemico vendetta rompo pugni',
    solitudine: 'solo sola solitudine nessuno silenzio notte deserto lontano abbandonato abbandonata isolato chiuso camera specchio vuota vuoto',
    speranza: 'speranza sogno sogni domani futuro luce alba credere credo spero rinascere rialzo rialzarmi fede forza resisto coraggio prima o poi',
    amore: 'amore amo ti amo cuore baci bacio abbraccio insieme occhi tua tuo mia mio stringimi bella bellissima perdutamente passione',
    euforia: 'festa ballo ballare ridere ridiamo notti club soldi oro lusso vincere vinto vittoria sopra top vola volare libero libertà estate sole champagne',
    tensione: 'paura ansia tremo trema pericolo sirene sirena ambulanza spari sparo polizia scappo scappare inseguito attesa nervi ombre minaccia stretto corro'
  };
  var LEXS = {}; Object.keys(LEX).forEach(function (e) { LEXS[e] = {}; LEX[e].split(/\s+/).forEach(function (w) { LEXS[e][w] = 1; }); });
  var EMOS = Object.keys(LEX);
  /* cosa cambia nei numeri per ciascuna emozione (a piena forza) */
  var EFFECT = {
    malinconia: { bpm: -16, dark: 0.2, lift: 0.1, rest: 0.1, hat: -0.2, minor: 1, why: 'più lenta, più buio, più pause nella melodia, hi-hat leggeri, tonalità minore' },
    nostalgia: { bpm: -10, swing: 0.04, lift: 0.15, rest: 0.05, hat: -0.15, minor: 0.6, why: 'più lenta e morbida (swing), crescita lenta' },
    rabbia: { bpm: 10, dark: 0.3, drive: 0.7, kick: 0.15, hat: 0.2, rolls: 0.2, bass: 0.2, minor: 1, why: 'più veloce, 808 distorto, più colpi di cassa, hi-hat aggressivi' },
    solitudine: { bpm: -12, dark: 0.15, rest: 0.18, kick: -0.1, hat: -0.25, bass: 0.1, minor: 1, why: 'poche note, tanto spazio, cassa rada' },
    speranza: { bpm: 2, dark: -0.2, lift: 0.3, rest: -0.05, minor: -0.5, why: 'cresce nel ritornello, meno buio, apre verso il maggiore' },
    amore: { bpm: -4, swing: 0.03, dark: -0.15, lift: 0.15, drive: -0.3, minor: -0.5, why: 'groove morbido, 808 meno duro, più caldo' },
    euforia: { bpm: 8, dark: -0.25, hat: 0.2, rolls: 0.1, lift: 0.3, kick: 0.1, minor: -0.4, why: 'più veloce, brillante, hi-hat vivi, grande ritornello' },
    tensione: { bpm: 4, dark: 0.25, rest: 0.1, slide: 0.15, drive: 0.4, rolls: 0.15, minor: 1, why: 'note tese, 808 che scivolano, rullate nervose' }
  };
  function emotion(text) {
    var words = String(text || '').toLowerCase().replace(/[^a-zàèéìíòóùú' ]/g, ' ').split(/\s+/).filter(Boolean), sc = {}, n = words.length || 1;
    EMOS.forEach(function (e) { sc[e] = 0; });
    words.forEach(function (w) { EMOS.forEach(function (e) { if (LEXS[e][w]) sc[e]++; }); });
    var sum = EMOS.reduce(function (a, e) { return a + sc[e]; }, 0), pct = {}; EMOS.forEach(function (e) { pct[e] = sum ? rd(sc[e] / sum) : 0; });
    var rank = EMOS.slice().sort(function (a, b) { return sc[b] - sc[a]; }).filter(function (e) { return sc[e] > 0; });
    return { scores: sc, share: pct, top: rank.slice(0, 3), words: n, found: sum };
  }
  /* sposta i numeri in base alle emozioni trovate. strength 0..1 = quanto lasciare decidere il testo */
  function applyEmotion(dna, em, strength) {
    var d = sanitize(dna), st = strength == null ? 1 : clamp(strength, 0, 1), why = [], mood = 0;
    var tops = (em && em.top || []).slice(0, 2); if (!tops.length || !em.found) return { dna: d, why: ['Nel testo non ho trovato parole di emozione: non cambio niente.'], emotions: [] };
    tops.forEach(function (e, i) {
      var w = (em.share[e] || 0) * (i === 0 ? 1 : 0.6) * st, f = EFFECT[e];
      Object.keys(f).forEach(function (k) {
        if (k === 'why' || k === 'minor') return;
        if (k === 'bpm') d.bpm += f.bpm * w * 1.6; else d[k] += f[k] * w * 1.6 * (FIELDS[k][1] - FIELDS[k][0]) / (k === 'hat' || k === 'bass' || k === 'lift' || k === 'drive' ? 1 : 1);
      });
      mood += (f.minor || 0) * w; why.push((e[0].toUpperCase() + e.slice(1)) + ' ' + Math.round((em.share[e] || 0) * 100) + '%: ' + f.why + '.');
    });
    if (mood < -0.25) d.mode = 'maggiore'; else if (mood > 0.15) d.mode = 'minore';
    ORDER.forEach(function (k) { d[k] = rd(clamp(d[k], FIELDS[k][0], FIELDS[k][1])); });
    return { dna: d, why: why, emotions: tops };
  }

  /* ===== dal DNA ai parametri del Beat Composer ===== */
  var SNARE_HALF = [[8], [8], [8, 14], [8, 11]], SNARE_FULL = [[4, 12], [4, 12], [4, 12, 15]];
  function kickPair(r, density) {
    var want = Math.round(2 + density * 4.5), K = Remix.KICKS.slice().sort(function (a, b) { return Math.abs(a.length - want) - Math.abs(b.length - want); }).slice(0, 6);
    var k = K[Math.floor(r() * K.length)], v = k.slice(), add = 1 + Math.floor(r() * 15); if (v.indexOf(add) < 0 && density > 0.3) v.push(add);
    v = v.filter(function (x, j) { return x >= 0 && x < 16 && v.indexOf(x) === j; }).sort(function (a, b) { return a - b; }); if (v.indexOf(0) < 0) v.unshift(0);
    return [k, v];
  }
  function toProd(dna, seed, opt) {
    var d = sanitize(dna), s = seed || 1, r = rng(s * 2654435761 + 31), o = opt || {};
    var half = r() < d.snareHalf, snare = (half ? SNARE_HALF : SNARE_FULL)[Math.floor(r() * (half ? SNARE_HALF : SNARE_FULL).length)];
    var progs = d.progs && d.progs.length ? d.progs : MIN, prog = progs[Math.floor(r() * progs.length)].slice();
    /* ogni versione è davvero un'altra: metà delle volte giro armonico da un archivio di 30+, tonalità e velocità cambiano */
    var pool = d.mode === 'maggiore' ? Remix.PROG_MAJ : Remix.PROG_MIN; if (r() < 0.55) prog = pool[Math.floor(r() * pool.length)].slice();
    var TON = [9, 0, 2, 4, 5, 7, 11, 1, 6, 3, 10, 8], tonic = TON[Math.floor(r() * TON.length)], bpm = Math.round(clamp(d.bpm * (1 + (r() - 0.5) * 0.16), 60, 175));
    var groove = { kickPats: [kickPair(r, d.kick), kickPair(r, d.kick)], snare: snare, rolls: d.rolls, swing: d.swing, slide: d.slide, drive: d.drive, duck: d.duck, hat: d.hatKind };
    return {
      genre: d.fam, bpm: bpm, tonic: tonic, mode: d.mode, groove: groove, prog: prog, heavy: d.dark >= 0.6, leadRest: d.rest,
      tune: { hat: d.hat, bass: d.bass, lift: d.lift, kickVar: rd(0.7 + d.kick * 0.8) }, melSeed: 1 + Math.floor(r() * 9999), name: d.name, preset: (d.parts && d.parts.length === 1 && BY[d.parts[0].id] && BY[d.parts[0].id].preset) || (BY[d.id] && BY[d.id].preset) || null
    };
  }
  function describe(dna) { var d = sanitize(dna); return ORDER.map(function (k) { return FIELDS[k][2] + ': ' + (k === 'bpm' ? Math.round(d[k]) : d[k]); }); }
  return { FIELDS: FIELDS, ORDER: ORDER, LIST: LIST, byId: byId, neutral: neutral, sanitize: sanitize, fuse: fuse, emotion: emotion, applyEmotion: applyEmotion, toProd: toProd, describe: describe, EMOS: EMOS };
});
