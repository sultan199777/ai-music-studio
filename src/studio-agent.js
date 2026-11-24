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
    var t = ' ' + String(text || '').toLowerCase().replace(/[’']/g, ' ').replace(/\s+/g, ' ') + ' ', p = st.prod, changes = [], parts = t.split(/[,.;]| e poi | poi /);
    p.mix = p.mix || {}; p.levels = p.levels || {};
    parts.forEach(function (s) {
      var ls = lanesIn(s), hit = false;
      // 808 del designer
      if (/\b808\b/.test(s) && /(lung|cort|colpo|click)/.test(s)) {
        p.b808 = Object.assign({ decay: 1.2, punch: 0.6, drive: 0.5, tone: 0.6, click: 0.3 }, p.b808 || {}); p.bassStyle = '808';
        if (/lung/.test(s)) { p.b808.decay = Math.min(4, p.b808.decay + 0.6); changes.push('808 più lungo (durata ' + p.b808.decay.toFixed(1) + ' s)'); }
        if (/cort/.test(s)) { p.b808.decay = Math.max(0.2, p.b808.decay - 0.5); changes.push('808 più corto (durata ' + p.b808.decay.toFixed(1) + ' s)'); }
        if (/colpo|click/.test(s)) { p.b808.punch = Math.min(1, p.b808.punch + 0.25); p.b808.click = Math.min(1, p.b808.click + 0.2); changes.push('808 con più colpo'); }
        hit = true;
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
  var EXAMPLES = ['808 più lungo e più distorto', 'voce più riverbero e più brillante', 'abbassa gli accordi, alza la melodia', 'melodia un\'ottava sopra', 'riser prima del ritornello', 'voce con autotune robot', 'arpeggio a destra, pad più scuro', 'master per spotify'];
  return { interpret: interpret, EXAMPLES: EXAMPLES };
});
