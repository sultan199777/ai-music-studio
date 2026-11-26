/*
 * Forma della canzone: montaggio delle PARTI (intro, strofa, pre, ritornello, bridge, outro).
 * Duplica, togli, sposta, copia, allunga/accorcia, aggiungi. Le righe del testo seguono la loro parte
 * (karaoke e guida restano a tempo). Le modifiche sono una lista di operazioni (prod.form) applicata
 * sopra la mappa del testo: si può annullare, ripetere e rifare da capo. Funzioni pure, testate.
 *   apply(map, ops) → nuova mappa {plan, lines, totalBars, barSec, firstLine}
 *   parse(testo, plan) → {op} oppure null (se la frase non è un'operazione sulle parti)
 *   describe(op, plan) → frase in italiano
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SongForm = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NAMES = ['intro', 'strofa', 'pre', 'ritornello', 'bridge', 'outro'];
  var LABEL = { intro: 'intro', strofa: 'strofa', pre: 'pre-ritornello', ritornello: 'ritornello', bridge: 'bridge', outro: 'outro' };
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function blocksOf(map) {
    var cur = 0, barSec = map.barSec || 2;
    return map.plan.map(function (s) {
      var b = { name: s[0], bars: s[1], lines: [] }, a = cur, z = cur + s[1];
      (map.lines || []).forEach(function (l) { if (l.startBar >= a && l.startBar < z) { var c = clone(l); c._rel = l.startBar - a; b.lines.push(c); } });
      cur = z; return b;
    });
  }
  function shiftLine(l, dBars, barSec) {
    var d = dBars * barSec; l.startBar += dBars; if (typeof l.start === 'number') l.start += d; if (typeof l.end === 'number') l.end += d;
    (l.words || []).forEach(function (w) { if (typeof w.start === 'number') w.start += d; if (typeof w.end === 'number') w.end += d; });
  }
  function rebuild(blocks, map) {
    var barSec = map.barSec || 2, cur = 0, plan = [], lines = [];
    blocks.forEach(function (b) {
      plan.push([b.name, b.bars]);
      b.lines.forEach(function (l) { if (l._rel >= b.bars) return; var c = clone(l), want = cur + l._rel; shiftLine(c, want - c.startBar, barSec); delete c._rel; c.section = b.name; lines.push(c); });
      cur += b.bars;
    });
    return { plan: plan, lines: lines, totalBars: cur, barSec: barSec, firstLine: lines.length ? lines[0].startBar : null };
  }
  function idxOk(bl, i) { return typeof i === 'number' && i >= 0 && i < bl.length; }
  function applyOne(bl, op) {
    var b;
    if (op.op === 'dup' && idxOk(bl, op.i)) { b = clone(bl[op.i]); bl.splice(op.i + 1, 0, b); }
    else if (op.op === 'del' && idxOk(bl, op.i) && bl.length > 1) bl.splice(op.i, 1);
    else if (op.op === 'move' && idxOk(bl, op.i)) { b = bl.splice(op.i, 1)[0]; var to = Math.max(0, Math.min(bl.length, op.to)); bl.splice(to, 0, b); }
    else if (op.op === 'copy' && idxOk(bl, op.i)) { b = clone(bl[op.i]); bl.splice(Math.max(0, Math.min(bl.length, op.to)), 0, b); }
    else if (op.op === 'bars' && idxOk(bl, op.i)) bl[op.i].bars = Math.max(1, Math.min(32, op.bars));
    else if (op.op === 'add' && NAMES.indexOf(op.name) >= 0) bl.splice(Math.max(0, Math.min(bl.length, op.at)), 0, { name: op.name, bars: Math.max(1, Math.min(16, op.bars || 4)), lines: [] });
    return bl;
  }
  function apply(map, ops) {
    if (!map || !map.plan) return map;
    var bl = blocksOf(map); (ops || []).forEach(function (op) { applyOne(bl, op); });
    var out = rebuild(bl, map); if (bl.length > 160) return map; return out;
  }
  /* ---- capire la frase ---- */
  var ORD = { prim: 1, '1': 1, second: 2, '2': 2, terz: 3, '3': 3, quart: 4, '4': 4, ultim: -1 };
  function secName(w) { if (!w) return null; if (/^ritornell|^chorus|^gancio/.test(w)) return 'ritornello'; if (/^strof/.test(w)) return 'strofa'; if (/^intro/.test(w)) return 'intro'; if (/^outro|^finale|^chiusura/.test(w)) return 'outro'; if (/^bridge|^ponte/.test(w)) return 'bridge'; if (/^pre/.test(w)) return 'pre'; return null; }
  var SEC_RE = '(intro|strofa|strofe|ritornello|ritornelli|pre(?:-?ritornello)?|bridge|ponte|outro|finale|chiusura)';
  function findRef(t, plan, after) {
    // «il secondo ritornello», «ritornello 2», «l'ultima strofa», «il ritornello»
    var re = new RegExp('(?:(prim|second|terz|quart|ultim)[oaie]\\s+)?' + SEC_RE + '(?:\\s+(\\d))?', 'g'), m, start = after || 0;
    re.lastIndex = start; m = re.exec(t); if (!m) return null;
    var name = secName(m[2]), occ = m[1] ? ORD[m[1]] : (m[3] ? +m[3] : 0), idx = [];
    plan.forEach(function (s, i) { if (s[0] === name) idx.push(i); });
    if (!idx.length) return { name: name, i: -1, end: re.lastIndex };
    var i = occ === -1 ? idx[idx.length - 1] : occ > 0 ? idx[occ - 1] : (/(dupl|copi|sposta)/.test(t) && name === 'ritornello' ? idx[idx.length - 1] : idx[0]);
    return { name: name, i: i == null ? -1 : i, end: re.lastIndex, occ: occ };
  }
  function whereTo(t, plan, from) {
    if (/all.?inizio|in apertura|per prim/.test(t)) return 0;
    if (/alla fine|in fondo|in chiusura/.test(t)) return plan.length;
    var m = t.match(/(prima|dopo)\s+(?:del|della|dello|dell|l)?\s*/);
    if (m) { var r = findRef(t, plan, t.indexOf(m[0]) + m[0].length); if (r && r.i >= 0) return m[1] === 'prima' ? r.i : r.i + 1; }
    return null;
  }
  function parse(text, plan) {
    var t = ' ' + String(text || '').toLowerCase().replace(/[’']/g, ' ').replace(/\s+/g, ' ') + ' ';
    if (!plan || !plan.length) return null;
    if (/(batteria|\b808\b|bass[oi]|melodi|accord|\bpad\b|\bvoc|arpegg|cassa|rullant|hi.?hat|piano|chitarr|archi|violin|synth|effett|riser|impact|reverse|riverb|\beco\b|delay|atmosfer)/.test(t)) return null;
    var verb = t.match(/\b(duplica|raddoppia|ripeti|togli|taglia|elimina|cancella|rimuovi|leva|sposta|metti|copia|incolla|allunga|accorcia|aggiungi|inserisci)\b/);
    if (!verb) return null; var v = verb[1], ref = findRef(t, plan, t.indexOf(v) + v.length);
    // aggiungi una parte nuova (senza testo): «aggiungi un bridge di 4 battute dopo il ritornello»
    if (/aggiungi|inserisci/.test(v)) {
      if (!ref) return null; var nb = (t.match(/(\d{1,2})\s*battut/) || [])[1], at = whereTo(t.slice(ref.end), plan) ;
      if (at == null) at = ref.name === 'intro' ? 0 : ref.name === 'outro' ? plan.length : (function () { var last = -1; plan.forEach(function (s, i) { if (s[0] === 'ritornello') last = i; }); return last >= 0 ? last + 1 : plan.length; })();
      return { op: 'add', name: ref.name, bars: nb ? +nb : (ref.name === 'intro' || ref.name === 'outro' ? 2 : 4), at: at };
    }
    if (!ref) return null;
    if (ref.i < 0) return { op: 'none', why: 'nella canzone non c\'è ' + (ref.occ ? 'quel ' : 'un ') + LABEL[ref.name] };
    if (/duplica|raddoppia|ripeti/.test(v)) return { op: 'dup', i: ref.i };
    if (/togli|taglia|elimina|cancella|rimuovi|leva/.test(v)) { if (/battut|più cort/.test(t)) return null; return { op: 'del', i: ref.i }; }
    if (/allunga|accorcia/.test(v)) { var n = +((t.match(/(\d{1,2})\s*battut/) || [])[1] || (v === 'allunga' ? 2 : 1)); return { op: 'bars', i: ref.i, bars: plan[ref.i][1] + (v === 'allunga' ? n : -n) }; }
    var to = whereTo(t.slice(ref.end), plan, ref.i);
    if (to == null) return null;
    if (/copia|incolla/.test(v)) return { op: 'copy', i: ref.i, to: to };
    if (/sposta|metti/.test(v)) { if (to > ref.i) to -= 1; return { op: 'move', i: ref.i, to: to }; }
    return null;
  }
  function nth(plan, i) { var n = 0; for (var k = 0; k <= i; k++) if (plan[k][0] === plan[i][0]) n++; var tot = plan.filter(function (s) { return s[0] === plan[i][0]; }).length; return LABEL[plan[i][0]] + (tot > 1 ? ' ' + n : ''); }
  function describe(op, plan) {
    if (!op) return ''; if (op.op === 'none') return '(' + op.why + ')';
    if (op.op === 'dup') return 'duplico ' + nth(plan, op.i) + ' (' + plan[op.i][1] + ' battute)';
    if (op.op === 'del') return 'tolgo ' + nth(plan, op.i);
    if (op.op === 'bars') return nth(plan, op.i) + ': ' + plan[op.i][1] + ' → ' + op.bars + ' battute';
    if (op.op === 'add') return 'aggiungo ' + LABEL[op.name] + ' di ' + op.bars + ' battute';
    var pos = op.to <= 0 ? 'all\'inizio' : op.to >= plan.length ? 'alla fine' : 'prima di ' + nth(plan, op.to);
    if (op.op === 'copy') return 'copio ' + nth(plan, op.i) + ' ' + pos;
    if (op.op === 'move') return 'sposto ' + nth(plan, op.i) + ' ' + (op.to === 0 ? 'all\'inizio' : 'in posizione ' + (op.to + 1));
    return '';
  }
  function summary(plan) { return plan.map(function (s, i) { return nth(plan, i) + ' (' + s[1] + ')'; }).join(' → '); }
  return { apply: apply, parse: parse, describe: describe, summary: summary, NAMES: NAMES };
});
