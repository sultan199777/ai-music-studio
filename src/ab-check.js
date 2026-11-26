/* Verifica prima/dopo: confronta due ascolti dell'Orecchio (Ear.listen) e dice se la modifica ha migliorato la base.
   I numeri sono Misurati; il verdetto si basa sulle regole di mestiere dell'Orecchio (Ipotesi): l'ultima parola resta all'orecchio di chi ascolta. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(require('./ear.js')); else root.AbCheck = factory(root.Ear); })(typeof self !== 'undefined' ? self : this, function (Ear) {
  'use strict';
  function score(r) {
    if (!r || !r.findings) return 0;
    var s = 100; r.findings.forEach(function (f) { s -= f.level === 'errore' ? 30 : (f.level === 'avviso' ? 10 : 2); });
    return Math.max(0, s);
  }
  var LAB = [['rmsDb', 'Livello medio', 'dB', 0.5], ['peakDb', 'Picco', 'dB', 0.5], ['crestDb', 'Dinamica (crest)', 'dB', 0.5], ['lufs', 'Volume (LUFS)', '', 0.5], ['lowShare', 'Grave', '%', 0.03], ['centroidHz', 'Centro di gravità', 'Hz', 100]];
  function fmt(k, v) { return k === 'lowShare' ? Math.round(v * 100) + '%' : (k === 'centroidHz' ? Math.round(v) + ' Hz' : (Math.round(v * 10) / 10) + (k === 'lufs' ? '' : ' dB')); }
  /* rb, ra: risultati di Ear.listen prima e dopo */
  function compare(rb, ra) {
    var sb = score(rb), sa = score(ra), ib = {}, ia = {}, fixed = [], added = [], lines = [];
    (rb.findings || []).forEach(function (f) { ib[f.id] = f; }); (ra.findings || []).forEach(function (f) { ia[f.id] = f; });
    Object.keys(ib).forEach(function (k) { if (!ia[k]) fixed.push(ib[k].text.split(':')[0]); });
    Object.keys(ia).forEach(function (k) { if (!ib[k]) added.push(ia[k].text.split(':')[0]); });
    LAB.forEach(function (l) { var a = rb.metrics[l[0]], b = ra.metrics[l[0]]; if (a == null || b == null || !isFinite(a) || !isFinite(b)) return; if (Math.abs(b - a) >= l[3]) lines.push(l[1] + ': ' + fmt(l[0], a) + ' → ' + fmt(l[0], b)); });
    var newErr = (ra.findings || []).some(function (f) { return f.level === 'errore' && !ib[f.id]; });
    var d = sa - sb, v = newErr ? 'peggiorato' : (d >= 5 ? 'migliorato' : (d <= -5 ? 'peggiorato' : 'uguale'));
    return { verdict: v, before: sb, after: sa, delta: d, fixed: fixed, added: added, lines: lines,
      text: 'Punteggio di mestiere ' + sb + ' → ' + sa + ' (' + v + ').' + (fixed.length ? ' Risolto: ' + fixed.join('; ') + '.' : '') + (added.length ? ' Nuovo problema: ' + added.join('; ') + '.' : '') };
  }
  function fromAudio(xb, xa, sr, o) { return compare(Ear.listen(xb, sr, o), Ear.listen(xa, sr, o)); }
  return { score: score, compare: compare, fromAudio: fromAudio };
});
