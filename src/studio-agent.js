/*
 * Agente dello Studio: capisce frasi in italiano e le trasforma in modifiche VERE al progetto
 * (mixer per traccia, 808 del designer, note della melodia, effetti di passaggio, microfono, master).
 * Funziona con regole (gratis, sul telefono): quello che non capisce lo dice, non finge.
 * Le richieste sulla base (BPM, tonalità, stile, livelli) passano a ProducerActions (già esistente).
 * interpret(text, st) → {understood, changes:[testo], unknown:[pezzi non capiti]} e modifica st (copia dello stato):
 *   st = {prod, mic, ctx:{sections:[{name,startBar}], leadNotes:[...]}}
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StudioAgent = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var LANES = [['voice', /\bvoc[ei]\b/], ['bass', /\b808\b|\bbass[oi]?\b/], ['drums', /batteria|\bcassa\b|rullant|hi.?hat/], ['chords', /accord/], ['arp', /arpegg/], ['lead', /melodi|\blead\b/], ['pad', /\bpad\b|atmosfer|archi/]];
  var LEVEL = { voice: 'voce', bass: 'basso', drums: 'batteria', chords: 'accordi', arp: 'arpeggio', lead: 'melodia', pad: 'pad' };
  var NAME = { voice: 'voce', bass: '808', drums: 'batteria', chords: 'accordi', arp: 'arpeggio', lead: 'melodia', pad: 'atmosfera' };
  var LIM = { low: [-12, 12], mid: [-12, 12], high: [-12, 12], comp: [0, 1], sat: [0, 1], pan: [-1, 1], rev: [0, 1], dly: [0, 1], duck: [0, 1] };
  function clamp(v, k) { return Math.max(LIM[k][0], Math.min(LIM[k][1], Math.round(v * 100) / 100)); }
  function lanesIn(t) { return LANES.filter(function (l) { return l[1].test(t); }).map(function (l) { return l[0]; }); }
  var MOVES = [
    [/più (riverbero|spazio|lontan)|più riverb/, 'rev', 0.15, 'più riverbero'], [/meno (riverbero|spazio)|più (secc|vicin)/, 'rev', -0.15, 'meno riverbero'],
    [/più (eco|delay)/, 'dly', 0.15, 'più eco'], [/meno (eco|delay)|senza (eco|delay)/, 'dly', -0.2, 'meno eco'],
    [/più (distort|sporc|satur|cattiv|aggressiv|grosso)/, 'sat', 0.2, 'più distorsione'], [/più pulit|meno distort/, 'sat', -0.2, 'meno distorsione'],
    [/più (brillant|chiar|aria)|più alti/, 'high', 3, 'alti +3 dB'], [/più (scur|cup|caldo)|meno alti/, 'high', -3, 'alti -3 dB'],
    [/più (pesant|corpo|profond)|più bassi\b/, 'low', 3, 'bassi +3 dB'], [/più leggero|meno bassi\b/, 'low', -3, 'bassi -3 dB'],
    [/più (davanti|compress|presente)/, 'comp', 0.2, 'più compressione'], [/meno compress|più dinamic/, 'comp', -0.2, 'meno compressione'],
    [/più (sidechain|pompa)|sidechain/, 'duck', 0.2, 'più sidechain dalla cassa'],
    [/a sinistra/, 'pan', -0.6, 'a sinistra', true], [/a destra/, 'pan', 0.6, 'a destra', true], [/al centro/, 'pan', 0, 'al centro', true]
  ];
  function interpret(text, st) {
    var t = ' ' + String(text || '').toLowerCase().replace(/[’']/g, ' ').replace(/\s+/g, ' ') + ' ', p = st.prod, changes = [], parts = [].concat.apply([], t.split(/[,.;]| e poi | poi /).map(function (x) { return x.split(/ e (?=(?:il |la |lo |l |i |gli |le |un |una )?(?:voce|voci|808|bass|batteria|melodi|accord|pad|arpegg|atmosfer|cassa|rullant|master))/); }));
    p.mix = p.mix || {}; p.levels = p.levels || {};
    parts.forEach(function (s) {
      var ls = lanesIn(s), hit = false;
      // stile Drill di Brooklyn (la scena di Pop Smoke): caratteristiche di genere, non copie
      if (/pop ?smoke|brooklyn|drill (di |de )?(new york|ny)|ny drill/.test(s)) { p.genre = 'brooklyn'; p.bpm = 143; p.mode = 'minore'; p.tune = null; p.groove = null; p.prog = null; changes.push('stile Drill di Brooklyn (143 BPM, minore, 808 che scivolano)'); hit = true; }
      // 808 del designer
      if (/\b808\b/.test(s) && /(lung|cort|colpo|click)/.test(s)) {
        p.b808 = Object.assign({ decay: 1.2, punch: 0.6, drive: 0.5, tone: 0.6, click: 0.3 }, p.b808 || {}); p.bassStyle = '808';
        if (/lung/.test(s)) { p.b808.decay = Math.min(4, p.b808.decay + 0.6); changes.push('808 più lungo (durata ' + p.b808.decay.toFixed(1) + ' s)'); }
        if (/cort/.test(s)) { p.b808.decay = Math.max(0.2, p.b808.decay - 0.5); changes.push('808 più corto (durata ' + p.b808.decay.toFixed(1) + ' s)'); }
        if (/colpo|click/.test(s)) { p.b808.punch = Math.min(1, p.b808.punch + 0.25); p.b808.click = Math.min(1, p.b808.click + 0.2); changes.push('808 con più colpo'); }
        hit = true;
      }
      // sidechain senza traccia: si fa sull'808 (lo spazio per la cassa)
      if (!ls.length && /sidechain|pompa/.test(s)) ls = ['bass'];
      /* ---- mani nuove (26/11): numeri, sezioni, giro, melodia, strumenti, swing ---- */
      var nb = s.match(/\b(\d{2,3})\s*bpm\b|\bbpm\s*(?:a\s*)?(\d{2,3})\b|velocità\s*(?:a\s*)?(\d{2,3})\b/);
      if (nb) { var v = +(nb[1] || nb[2] || nb[3]); if (v >= 50 && v <= 200) { p.bpm = v; changes.push('velocità ' + v + ' BPM'); hit = true; st.skipPA = true; } }
      var secM = s.match(/\b(?:nell?|nella|nelle|negli|in|durante (?:la|il|l|le)?)\s*(intro|strofe?|ritornell[oi]|pre|ponte|outro|finale)\b/);
      if (secM && ls.length && /(togli|leva|senza|spegni|muta|rimetti|riaccendi|torna)/.test(s)) {
        var w0 = secM[1], sk = /^ritornell/.test(w0) ? 'ritornello' : /^strof/.test(w0) ? 'strofa' : w0 === 'ponte' ? 'pre' : w0 === 'finale' ? 'outro' : w0, on = /(rimetti|riaccendi|torna)/.test(s);
        var KEYS = { drums: ['kick', 'snare', 'hat'], bass: ['bass'], chords: ['chords'], pad: ['pad'], lead: ['lead'], arp: ['arp'] };
        p.secMix = Object.assign({}, p.secMix || {}); p.secMix[sk] = Object.assign({}, p.secMix[sk] || {});
        ls.forEach(function (id) { (KEYS[id] || []).forEach(function (k) { if (on) delete p.secMix[sk][k]; else p.secMix[sk][k] = 0; }); });
        changes.push((on ? 'rimetto ' : 'tolgo ') + ls.map(function (id) { return NAME[id]; }).join(' e ') + ' solo nella parte «' + sk + '»'); hit = true; st.skipPA = true; return;
      }
      if (/(^|\s)(più|alza|alzare)(\s|$)/.test(s) && /\b808\b/.test(s) && !/(lung|cort|colpo|click|distort|sporc|riverb|eco)/.test(s)) {
        p.levels.basso = Math.min(2, Math.round(((p.levels.basso == null ? 1 : p.levels.basso) + 0.25) * 100) / 100);
        p.b808 = Object.assign({ decay: 1.2, punch: 0.6, drive: 0.5, tone: 0.6, click: 0.3 }, p.b808 || {}); p.b808.drive = Math.min(1, p.b808.drive + 0.15); p.bassStyle = '808';
        changes.push('808 più presente (volume ' + Math.round(p.levels.basso * 100) + '%, più spinta)'); hit = true; st.skipPA = true; return;
      }
      if (/(più|meno) (swing|groove|rimbalz|bounce)|più dritt|senza swing/.test(s)) {
        var sw = (p.groove && typeof p.groove.swing === 'number') ? p.groove.swing : 0, up2 = /più (swing|groove|rimbalz|bounce)/.test(s);
        p.groove = Object.assign({}, p.groove || {}, { swing: Math.max(0, Math.min(0.3, Math.round((sw + (up2 ? 0.08 : -0.1)) * 100) / 100)) });
        changes.push('swing ' + Math.round(p.groove.swing * 100) + '%'); hit = true;
      }
      if (/(cambia|altra|nuova|diversa) (la )?melodi|melodia (nuova|diversa)/.test(s)) {
        p.melSeed = (p.melSeed || 0) + 1; var hadOwn = !!(p.notes && p.notes.lead); if (hadOwn) { p.notes = Object.assign({}, p.notes); delete p.notes.lead; }
        changes.push('melodia nuova' + (hadOwn ? ' (tolgo quella scritta a mano)' : '')); hit = true; st.skipPA = true;
      }
      if (/(cambia|altr[oi]|nuov[oi]|divers[oi]) (gli |il )?(accordi|giro)|(accordi|giro) (nuov|divers)/.test(s) && st.ctx && st.ctx.progs && st.ctx.progs.length) {
        var cp = JSON.stringify(p.prog || []), cands = st.ctx.progs.filter(function (x) { return JSON.stringify(x) !== cp; }), np = cands[(((p.seed || 1) * 7) + (p.melSeed || 0)) % cands.length];
        if (np) { p.prog = np.slice(); p.chordBars = null; changes.push('giro di accordi nuovo (gradi ' + np.map(function (d) { return d + 1; }).join('-') + ')'); hit = true; st.skipPA = true; }
      }
      var sw2 = s.match(/(?:metti|usa)\s+(?:il |lo |la |l |un |una )?(.+?)\s+(?:al posto (?:del|della|dello|dell|degli|delle|di)|invece (?:del|della|dello|dell|di))\s+(?:l )?(.+?)\s*$/), sw3 = s.match(/(?:metti|usa)\s+(?:il |lo |la |l |un |una )?(.+?)\s+(?:per|sulla|sugli|nella|negli|come)\s+(?:la |gli |le |il )?(melodia|accordi|pad|atmosfera|arpeggio)\b/);
      if ((sw2 || sw3) && st.ctx && st.ctx.inst && st.ctx.inst.length) {
        var find = function (q) { q = q.trim(); var best = null; st.ctx.inst.forEach(function (c) { var n = c.nome.toLowerCase(); if (n.indexOf(q) >= 0 || q.indexOf(n.split(' ')[0]) >= 0) { if (!best || n.length < best.nome.length) best = c; } }); return best; };
        var ROLE = { melodia: 'melodia', accordi: 'accordi', pad: 'pad', atmosfera: 'pad', arpeggio: 'arpeggio' }, newI = find(sw2 ? sw2[1] : sw3[1]), roles = [];
        p.inst = Object.assign({}, p.inst || {});
        if (sw3) roles = [ROLE[sw3[2]]];
        else { var old = find(sw2[2]); Object.keys(p.inst).forEach(function (r) { if (old && p.inst[r] === old.id) roles.push(r); }); }
        if (newI && roles.length) { roles.forEach(function (r) { p.inst[r] = newI.id; }); changes.push(newI.nome.toLowerCase() + ' su ' + roles.join(' e ')); hit = true; st.skipPA = true; return; }
        if (newI && !roles.length) { changes.push('(non trovo «' + (sw2 ? sw2[2] : '') + '» nella base: gli strumenti ora sono ' + Object.keys(p.inst).map(function (r) { var c = st.ctx.inst.filter(function (x) { return x.id === p.inst[r]; })[0]; return r + ' = ' + (c ? c.nome.toLowerCase() : p.inst[r]); }).join(', ') + ')'); hit = true; st.skipPA = true; return; }
      }
      // mixer per traccia
      if (ls.length) MOVES.forEach(function (m) {
        if (!m[0].test(s)) return;
        ls.forEach(function (id) { var c = p.mix[id] = Object.assign({ low: 0, mid: 0, midHz: 1200, high: 0, comp: 0, sat: 0, pan: 0, rev: 0, dly: 0, duck: 0 }, p.mix[id] || {}); c[m[1]] = clamp(m[4] ? m[2] : c[m[1]] + m[2], m[1]); changes.push(NAME[id] + ': ' + m[3]); });
        hit = true;
      });
      // volume della traccia
      if (ls.length && /\b(alza|più alt[oa]|più forte|più volume)\b/.test(s) && !/master/.test(s)) { ls.forEach(function (id) { p.levels[LEVEL[id]] = Math.min(2, Math.round(((p.levels[LEVEL[id]] == null ? 1 : p.levels[LEVEL[id]]) * 1.25) * 100) / 100); changes.push(NAME[id] + ': volume più alto'); }); hit = true; }
      if (ls.length && /\b(abbassa|più bass[oa] di volume|più piano|meno volume)\b/.test(s)) { ls.forEach(function (id) { p.levels[LEVEL[id]] = Math.max(0, Math.round(((p.levels[LEVEL[id]] == null ? 1 : p.levels[LEVEL[id]]) * 0.8) * 100) / 100); changes.push(NAME[id] + ': volume più basso'); }); hit = true; }
      // note della melodia
      if (/melodi/.test(s) && /ottava (sopra|sotto|più (alta|bassa))/.test(s) && st.ctx && st.ctx.leadNotes && st.ctx.leadNotes.length) {
        var up = /sopra|alta/.test(s) ? 12 : -12; p.notes = Object.assign({}, p.notes || {});
        p.notes.lead = (p.notes.lead || st.ctx.leadNotes).map(function (n) { return Object.assign({}, n, { midi: n.midi + up }); }); changes.push('melodia un\'ottava ' + (up > 0 ? 'sopra' : 'sotto')); hit = true;
      }
      // effetti di passaggio sul ritornello
      var rit = st.ctx && st.ctx.sections ? st.ctx.sections.filter(function (x) { return x.name === 'ritornello'; }) : [];
      if (/(riser|salita|reverse|impact|botta)/.test(s)) {
        if (!rit.length) changes.push('(non c\'è un ritornello: scrivi [Ritornello] nel testo)');
        else { var type = /reverse/.test(s) ? 'reverse' : (/impact|botta/.test(s) ? 'impact' : 'riser'); p.fxList = (p.fxList || []).concat(rit.map(function (r) { return { type: type, bar: r.startBar }; })); changes.push(type + ' su ' + rit.length + ' ritornell' + (rit.length > 1 ? 'i' : 'o')); }
        hit = true;
      }
      // microfono
      var m2 = st.mic;
      if (m2 && /\bvoc/.test(s) && /(autotune|robot|intonat|natural|vocoder|metallic|radio|telefono)/.test(s)) {
        if (/robot|autotune (forte|duro|pesante)|più autotune/.test(s)) { m2.mode = 'autotune'; m2.ids = ['robotico']; m2.macros = {}; changes.push('voce: autotune duro (robot)'); }
        else if (/natural|meno autotune/.test(s)) { m2.mode = 'autotune'; m2.ids = ['naturale']; m2.macros = {}; changes.push('voce: autotune naturale'); }
        else if (/autotune|intonat/.test(s)) { m2.mode = 'autotune'; if (!m2.ids || !m2.ids.length) m2.ids = ['melodico']; changes.push('voce: autotune acceso'); }
        if (/vocoder/.test(s)) { m2.fx = 'vocoder'; changes.push('voce: vocoder sugli accordi'); }
        if (/metallic/.test(s)) { m2.fx = 'metallico'; changes.push('voce: metallica'); }
        if (/radio|telefono/.test(s)) { m2.fx = 'radio'; changes.push('voce: effetto radio'); }
        st.micChanged = true; hit = true;
      }
      // master
      if (/master|volume finale|spotify|streaming|club/.test(s)) {
        p.mpro = Object.assign({ target: 'forte', width: 1.1, sat: 0.25, comp: 0.35, match: false }, p.mpro || {});
        if (/spotify|streaming/.test(s)) p.mpro.target = 'streaming'; else if (/club|fortissim/.test(s)) p.mpro.target = 'club'; else if (/(più )?forte|alto/.test(s)) p.mpro.target = 'forte'; else if (/morbid|piano/.test(s)) p.mpro.target = 'morbido';
        if (/(più )?larg/.test(s)) p.mpro.width = Math.min(2, p.mpro.width + 0.3);
        changes.push('master: ' + p.mpro.target + (p.mpro.width > 1.1 ? ', più largo' : '')); hit = true;
      }
      st._hits = (st._hits || 0) + (hit ? 1 : 0);
    });
    return { understood: changes.length > 0, changes: changes };
  }
  var EXAMPLES = ['bpm 140', 'più 808', 'togli la batteria nell\'intro', 'cambia gli accordi', 'cambia la melodia', 'più swing', 'metti il piano al posto della chitarra', 'aggiungi sidechain', 'base tipo Pop Smoke', '808 più lungo e più distorto', 'voce più riverbero e più brillante', 'abbassa gli accordi, alza la melodia', 'melodia un\'ottava sopra', 'riser prima del ritornello', 'voce con autotune robot', 'arpeggio a destra, pad più scuro', 'master per spotify'];
  return { interpret: interpret, EXAMPLES: EXAMPLES };
});
