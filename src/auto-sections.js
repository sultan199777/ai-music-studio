/*
 * Sezioni automatiche: se nel testo NON ci sono i titoli tra parentesi, l'app li mette da sola.
 *  - Titolo: la prima riga se è corta, da sola (riga vuota dopo) o è una data/numero ("25 maggio"). Non resta nel testo cantato.
 *  - Ritornello: blocchi che si ripetono uguali (anche una sola riga ripetuta in blocchi diversi); se nessun blocco si ripete,
 *    il primo blocco quando è più corto degli altri (si scrive di solito prima).
 *  - Dentro un blocco senza righe vuote: la sequenza di righe che ritorna più volte è il ritornello, il resto sono strofe.
 *  - Non indovina quando non sa: confidence 'bassa' e una nota. Se ci sono già i titoli [..], non tocca niente.
 * label(text) → { changed, title, text, sections:[{type,lines}], notes:[...], confidence }
 * Sono IPOTESI di mestiere: l'utente può sempre cambiare i titoli tra parentesi.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AutoSections = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function norm(l) { return String(l).toLowerCase().replace(/[^a-zàèéìíòóùú0-9' ]/g, '').replace(/\s+/g, ' ').trim(); }
  function hasTags(t) { return /^\s*\[[^\]]+\]\s*$/m.test(t); }
  function words(l) { return l.trim().split(/\s+/).filter(Boolean); }
  function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return s.length ? s[Math.floor(s.length / 2)] : 0; }

  function splitBlocks(lines) {
    var blocks = [], cur = [];
    lines.forEach(function (l) { if (!l.trim()) { if (cur.length) blocks.push(cur); cur = []; } else cur.push(l.trim()); });
    if (cur.length) blocks.push(cur); return blocks;
  }
  /* titolo: "Titolo: ...", oppure prima riga corta da sola o data */
  function takeTitle(rawLines) {
    var i = 0; while (i < rawLines.length && !rawLines[i].trim()) i++;
    if (i >= rawLines.length) return { title: '', rest: rawLines };
    var first = rawLines[i].trim(), m = first.match(/^(titolo|title)\s*[:\-–]\s*(.+)$/i);
    if (m) return { title: m[2].trim(), rest: rawLines.slice(i + 1) };
    var alone = i + 1 >= rawLines.length || !rawLines[i + 1].trim(), dateLike = /^\d{1,2}(\s|\/|\.|-)/.test(first) || /^\d+$/.test(first);
    var w = words(first);
    if (w.length <= 5 && first.length <= 40 && !/[,;:!?]$/.test(first) && (alone || (dateLike && w.length <= 3)) && rawLines.slice(i + 1).some(function (l) { return l.trim(); })) {
      var again = rawLines.slice(i + 1).some(function (l) { return norm(l) === norm(first); }); /* se la riga ritorna nel testo è un verso, non un titolo */
      if (!again) return { title: first, rest: rawLines.slice(i + 1) };
    }
    return { title: '', rest: rawLines.slice(i) };
  }
  /* un blocco unico: cerca la sequenza di righe (almeno 2) che ritorna */
  function splitSingle(lines) {
    var n = lines.map(norm), best = null, L, i, j;
    for (L = Math.floor(n.length / 2); L >= 2 && !best; L--) {
      for (i = 0; i + L <= n.length && !best; i++) {
        var seq = n.slice(i, i + L).join('|'); if (!seq.replace(/\|/g, '')) continue;
        for (j = i + L; j + L <= n.length; j++) { if (n.slice(j, j + L).join('|') === seq) { best = { L: L, start: i }; break; } }
      }
    }
    if (!best) return null;
    var seq2 = n.slice(best.start, best.start + best.L).join('|'), occ = [];
    for (i = 0; i + best.L <= n.length; i++) { if (n.slice(i, i + best.L).join('|') === seq2) { occ.push(i); i += best.L - 1; } }
    var out = [], pos = 0;
    occ.forEach(function (o) { if (o > pos) out.push({ type: 'strofa', lines: lines.slice(pos, o) }); out.push({ type: 'ritornello', lines: lines.slice(o, o + best.L) }); pos = o + best.L; });
    if (pos < lines.length) out.push({ type: 'strofa', lines: lines.slice(pos) });
    return out;
  }
  function labelBlocks(blocks, notes) {
    var count = {}; blocks.forEach(function (b) { b.forEach(function (l) { var k = norm(l); count[k] = (count[k] || 0) + 1; }); });
    var rep = blocks.map(function (b) { var r = 0; b.forEach(function (l) { var k = norm(l); if (k && count[k] >= 2) r++; }); return r / b.length; });
    var types = blocks.map(function (b, i) { return rep[i] >= 0.5 ? 'ritornello' : 'strofa'; }), conf = 'bassa';
    if (types.indexOf('ritornello') >= 0) { conf = 'alta'; notes.push('Ritornello: le righe che ritornano uguali.'); }
    else if (blocks.length >= 2) {
      var lens = blocks.map(function (b) { return b.length; }), rest = lens.slice(1), md = median(rest);
      if (lens[0] <= 6 && lens[0] <= 0.75 * md) { types[0] = 'ritornello'; conf = 'media'; notes.push('Ritornello: il primo blocco, più corto delle strofe (si scrive di solito prima).'); }
      else notes.push('Nessuna riga si ripete: non so dove sia il ritornello. Se c\'è, scrivi [Ritornello] sopra.');
    }
    return { types: types, conf: conf };
  }
  function label(text) {
    text = String(text || ''); var res = { changed: false, title: '', text: text, sections: [], notes: [], confidence: 'bassa' };
    if (!text.trim() || hasTags(text)) { if (hasTags(text)) res.notes.push('Ci sono già i titoli tra parentesi: non cambio niente.'); return res; }
    var t = takeTitle(text.split(/\r?\n/)); res.title = t.title;
    var blocks = splitBlocks(t.rest); if (!blocks.length) return res;
    var sections;
    if (blocks.length === 1) {
      sections = splitSingle(blocks[0]);
      if (sections) { res.confidence = 'media'; res.notes.push('Un blocco solo: ho separato la parte che ritorna (ritornello) dal resto.'); }
      else { sections = [{ type: 'strofa', lines: blocks[0] }]; res.notes.push('Un blocco senza ripetizioni: tutto strofa.'); }
    } else {
      var lb = labelBlocks(blocks, res.notes); res.confidence = lb.conf;
      sections = blocks.map(function (b, i) { return { type: lb.types[i], lines: b }; });
    }
    res.sections = sections;
    res.text = sections.map(function (s) { return '[' + (s.type === 'ritornello' ? 'Ritornello' : 'Strofa') + ']\n' + s.lines.join('\n'); }).join('\n\n');
    res.changed = true; return res;
  }
  function summary(r) {
    if (!r || !r.changed) return '';
    var rit = r.sections.filter(function (s) { return s.type === 'ritornello'; }).length, str = r.sections.length - rit;
    return (r.title ? 'Titolo «' + r.title + '». ' : '') + str + (str === 1 ? ' strofa, ' : ' strofe, ') + rit + (rit === 1 ? ' ritornello' : ' ritornelli') + '. ' + r.notes.join(' ');
  }
  return { label: label, summary: summary, hasTags: hasTags, takeTitle: takeTitle };
});
