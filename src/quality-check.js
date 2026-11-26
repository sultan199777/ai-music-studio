/*
 * Controllo qualità musicale (Agente Analista + Produttore): dopo ogni base misura cosa c'è davvero dentro.
 * Solo controlli MISURABILI sugli eventi dell'Arrangiatore (note, accordi, cassa, hi-hat, 808, sezioni) e sull'audio;
 * il gusto (groove, emozione, "suona bene") resta DA ASCOLTARE e viene detto come tale.
 *  - fingerprint(b): impronta compatta di una base (tonalità, giro, cassa per battuta, contorno della melodia, 808, strumenti, forma).
 *  - similarity(a, b): 0-1, quanto due basi si somigliano (serve a scartare le copie).
 *  - check(b, opt): elenco di controlli {id, nome, ok, valore, tipo:'misurato'|'ascolto', consiglio, fix}.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QualityCheck = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
  var SCALE = { maggiore: [0, 2, 4, 5, 7, 9, 11], minore: [0, 2, 3, 5, 7, 8, 10] };
  function rootOf(name) { var m = String(name || '').match(/^(Do#?|Re#?|Mi|Fa#?|Sol#?|La#?|Si)/); return m ? NAMES.indexOf(m[1]) : -1; }
  function grams(arr, n) { var g = {}; for (var i = 0; i + n <= arr.length; i++) g[arr.slice(i, i + n).join(',')] = 1; return g; }
  function jac(a, b) { var ka = Object.keys(a), kb = Object.keys(b), inter = 0; if (!ka.length && !kb.length) return 1; ka.forEach(function (k) { if (b[k]) inter++; }); return inter / (ka.length + kb.length - inter || 1); }

  function fingerprint(b) {
    var E = b.events || {}, t = b.tonic || 0, bars = b.bars || 8;
    var chords = (E.chords || []).map(function (c) { var r = rootOf(c.name); return r < 0 ? '?' : ((r - t + 12) % 12) + (/m$/.test(c.name) ? 'm' : ''); });
    var kick = []; for (var i = 0; i < bars; i++) kick.push(0); (E.kick || []).forEach(function (k) { if (k.bar < bars) kick[k.bar] |= 1 << (k.step | 0); });
    var lead = (E.lead || []).map(function (n) { return n.midi; }), contour = []; for (i = 1; i < lead.length; i++) contour.push(Math.max(-5, Math.min(5, lead[i] - lead[i - 1])));
    var bass = (E.bass || []).map(function (n) { return (n.midi - t + 120) % 12; });
    return { key: t + (b.mode || ''), bpm: b.bpm, genre: b.genre, chords: chords, kick: kick.filter(function (v) { return v; }), contour: contour, bass: bass, inst: b.inst ? Object.keys(b.inst).map(function (r) { return b.inst[r]; }).filter(Boolean) : [], form: (b.sections || []).map(function (s) { return s.name + s.bars; }).join('-') };
  }
  /** 0 = tutto diverso, 1 = identiche. Pesi: giro 0.2, cassa 0.2, melodia 0.2, 808 0.1, strumenti 0.1, tonalità 0.1, velocità 0.05, forma 0.05. */
  function similarity(a, b) {
    if (!a || !b) return 0; var s = 0;
    s += 0.2 * jac(grams(a.chords, 4), grams(b.chords, 4));
    s += 0.2 * jac(grams(a.kick.map(String), 1), grams(b.kick.map(String), 1));
    s += 0.2 * jac(grams(a.contour, 4), grams(b.contour, 4));
    s += 0.1 * jac(grams(a.bass, 3), grams(b.bass, 3));
    var ia = {}, ib = {}; a.inst.forEach(function (x) { ia[x] = 1; }); b.inst.forEach(function (x) { ib[x] = 1; }); s += 0.1 * jac(ia, ib);
    s += 0.1 * (a.key === b.key ? 1 : 0) + 0.05 * Math.max(0, 1 - Math.abs((a.bpm || 0) - (b.bpm || 0)) / 20) + 0.05 * (a.form === b.form ? 1 : 0);
    return Math.round(s * 100) / 100;
  }
  function energyBySection(b) {
    var E = b.events || {}, out = {}; (b.sections || []).forEach(function (s) { var n = 0; ['kick', 'hat', 'bass', 'lead', 'arp'].forEach(function (k) { (E[k] || []).forEach(function (e) { if (e.bar >= s.startBar && e.bar < s.startBar + s.bars) n++; }); }); var d = n / Math.max(1, s.bars); if (!out[s.name] || d > out[s.name]) out[s.name] = d; }); return out;
  }
  /** opt: {recent:[fingerprint], mix: Float32Array (facoltativo), hasLyrics, lyricSections:[nomi]} */
  function check(b, opt) {
    opt = opt || {}; var E = b.events || {}, fp = fingerprint(b), C = [], t = b.tonic || 0, sc = SCALE[b.mode] || SCALE.minore, HEAVY = /trap|drill|brooklyn|street|rage|phonk|plugg|jersey|club/.test(b.genre || '');
    function add(id, nome, ok, valore, consiglio, fix, tipo) { C.push({ id: id, nome: nome, ok: !!ok, valore: valore, consiglio: ok ? '' : consiglio, fix: ok ? null : fix, tipo: tipo || 'misurato' }); }
    // 1) diversa dalle precedenti
    var simMax = 0; (opt.recent || []).forEach(function (r) { simMax = Math.max(simMax, similarity(fp, r)); });
    add('diversa', 'Diversa dalle basi precedenti', simMax < 0.6, 'somiglianza massima ' + Math.round(simMax * 100) + '%', 'Troppo simile a una base di prima: cambio giro, melodia, ritmo e tonalità.', 'nuova');
    // 2) accordi coerenti con la tonalità
    var dia = (E.chords || []).filter(function (c) { var r = rootOf(c.name); return r >= 0 && sc.indexOf((r - t + 12) % 12) >= 0; }).length, nc = (E.chords || []).length;
    add('accordi', 'Accordi nella tonalità', !nc || dia / nc >= 0.75, nc ? Math.round(dia / nc * 100) + '% degli accordi nella scala' : 'nessun accordo', 'Molti accordi fuori scala: suonano storti senza un motivo.', 'giro');
    var distinctCh = {}; fp.chords.forEach(function (c) { distinctCh[c] = 1; });
    add('giro', 'Giro armonico con movimento', Object.keys(distinctCh).length >= 3, Object.keys(distinctCh).length + ' accordi diversi', 'Il giro usa meno di 3 accordi: poco movimento armonico.', 'giro');
    // 3) melodia sensata: estensione, varietà, salti
    var L = (E.lead || []).map(function (n) { return n.midi; }), rng = L.length ? Math.max.apply(null, L) - Math.min.apply(null, L) : 0, distinct = {}; L.forEach(function (m) { distinct[m] = 1; });
    var jumps = 0; for (var i = 1; i < L.length; i++) if (Math.abs(L[i] - L[i - 1]) > 9) jumps++;
    add('melodia', 'Melodia cantabile', L.length >= 8 && rng >= 5 && rng <= 22 && Object.keys(distinct).length >= 4 && jumps / Math.max(1, L.length) < 0.25, L.length + ' note, estensione ' + rng + ' semitoni, ' + Object.keys(distinct).length + ' note diverse, salti grandi ' + jumps, 'Melodia troppo piatta, troppo larga o con troppi salti: la rigenero.', 'melodia');
    // 4) ripetizione eccessiva della melodia (battute identiche)
    var byBar = {}; (E.lead || []).forEach(function (n) { (byBar[n.bar] = byBar[n.bar] || []).push(n.midi + ':' + n.step); }); var seen = {}, rep = 0, nb = 0; Object.keys(byBar).forEach(function (k) { var s = byBar[k].join(' '); nb++; if (seen[s]) rep++; seen[s] = 1; });
    add('ripetizione', 'Non troppo ripetitiva', !nb || rep / nb <= 0.6, nb ? Math.round(rep / nb * 100) + '% di battute di melodia identiche' : 'nessuna melodia', 'La melodia ripete sempre la stessa battuta: aggiungo variazioni.', 'melodia');
    // 5) batteria con movimento: schemi di cassa diversi, rullate di hi-hat nei generi trap/drill
    var kd = {}; fp.kick.forEach(function (v) { kd[v] = 1; }); var rolls = (E.hat || []).filter(function (h) { return h.roll; }).length;
    add('batteria', 'Batteria con movimento', Object.keys(kd).length >= 2 && (!HEAVY || rolls > 0), Object.keys(kd).length + ' schemi di cassa, ' + rolls + ' colpi in rullata', 'La batteria ripete un solo schema: aggiungo variazioni, fill e rullate.', 'batteria');
    // 6) 808 legata alla cassa (trap/drill)
    var ks = {}; (E.kick || []).forEach(function (k) { ks[k.bar * 16 + k.step] = 1; }); var bassOn = (E.bass || []).filter(function (n) { return n.bar != null; }), hit = bassOn.filter(function (n) { var p = n.bar * 16 + (n.step | 0); return ks[p] || ks[p - 1] || ks[p + 1]; }).length;
    add('808', '808 legata alla cassa', !HEAVY || !bassOn.length || hit / bassOn.length >= 0.45, bassOn.length ? Math.round(hit / bassOn.length * 100) + '% delle note di basso cadono con la cassa' : 'nessun basso', 'Il basso non segue la cassa: nei generi trap/drill le 808 partono insieme al kick.', 'batteria');
    // 7) struttura che evolve: il ritornello ha più energia della strofa
    var en = energyBySection(b), sv = en.strofa || 0, rv = en.ritornello || 0;
    add('struttura', 'Ritornello più pieno della strofa', !(en.ritornello != null && en.strofa != null) || rv > sv * 1.05, en.ritornello != null ? 'densità ritornello ' + Math.round(rv) + ' / strofa ' + Math.round(sv) + ' eventi per battuta' : 'forma senza ritornello', 'Il ritornello non cresce: aumento energia (hi-hat, pad, arpeggio).', 'energia');
    add('forma', 'Forma completa (almeno 3 parti)', (b.sections || []).length >= 3, (b.sections || []).map(function (s) { return s.name; }).join(' → '), 'La base ha meno di 3 parti: manca un\'evoluzione.', null);
    // 8) testo interpretato: le parti della base seguono quelle del testo
    if (opt.lyricSections && opt.lyricSections.length) { var bs = (b.sections || []).map(function (s) { return s.name; }), miss = opt.lyricSections.filter(function (n) { return bs.indexOf(n) < 0; });
      add('testo', 'Parti del testo rispettate', !miss.length, miss.length ? 'mancano: ' + miss.join(', ') : 'tutte le parti del testo hanno la loro sezione', 'Alcune parti del testo non hanno una sezione nella base.', null); }
    // 9) audio: clipping, silenzio
    if (opt.mix) { var x = opt.mix, pk = 0, clip = 0, ss = 0; for (i = 0; i < x.length; i += 2) { var v = x[i] < 0 ? -x[i] : x[i]; if (v > pk) pk = v; if (v > 0.995) clip++; ss += v * v; } var rms = Math.sqrt(ss / Math.max(1, x.length / 2));
      add('audio', 'Audio pulito (niente distorsione o silenzio)', clip < 20 && rms > 0.01, 'picco ' + pk.toFixed(2) + ', campioni al limite ' + clip + ', livello medio ' + (20 * Math.log10(rms + 1e-9)).toFixed(1) + ' dB', 'Problema di livello: troppo forte (distorce) o troppo bassa.', null); }
    add('gusto', 'Groove, emozione e suono', true, 'non misurabile', '', null, 'ascolto');
    var mis = C.filter(function (c) { return c.tipo === 'misurato'; }), ok = mis.filter(function (c) { return c.ok; }).length;
    return { checks: C, fingerprint: fp, similarity: simMax, score: Math.round(ok / Math.max(1, mis.length) * 100), weak: mis.filter(function (c) { return !c.ok; }) };
  }
  return { fingerprint: fingerprint, similarity: similarity, check: check, energyBySection: energyBySection };
});
