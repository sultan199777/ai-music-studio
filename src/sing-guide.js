/*
 * Guida al canto: dal testo + base (mappa della canzone) a un foglio di istruzioni riga per riga.
 * Per ogni riga: quando entrare (battuta e secondi), come dirla (rap parlato / cantato / tenuto), quanto tenere
 * l'ultima parola, dove respirare, dove lasciare pausa, dove puoi mettere un ad-lib.
 * Misurato: tempi della mappa (BPM, battute, sillabe). Ipotesi: soglie di velocità/respiro (valori tipici, non regole).
 * Dopo la registrazione: check() confronta quando hai davvero cantato con la finestra di ogni riga.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SingGuide = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var FAST = 7.5, SLOW = 1.2;       // sillabe al secondo: oltre è troppo veloce da articolare (Ipotesi)
  var BREATH_AFTER = 4.2;           // secondi di canto continuo oltre i quali serve un respiro (Ipotesi)

  function r1(x) { return Math.round(x * 10) / 10; }
  function build(map) {
    if (!map || !map.lines || !map.lines.length) return null;
    var L = map.lines, out = [], sinceBreath = 0;
    L.forEach(function (ln, i) {
      var ws = ln.words, first = ws[0].start, last = ws[ws.length - 1].end, sing = Math.max(0.1, last - first), nextStart = L[i + 1] ? L[i + 1].start : ln.end + map.barSec;
      var tail = Math.max(0, nextStart - last), lead = first - ln.start, rate = ln.syllables / sing;
      var secEnd = !L[i + 1] || L[i + 1].section !== ln.section, notes = [], mid = null;
      if (ln.mode === 'parla') notes.push('parlato ritmico, sillabe secche sul tempo');
      else if (ln.mode === 'allunga') notes.push('canto lungo, vocali aperte');
      else notes.push('cantato');
      var hold = 0;
      if (ln.mode !== 'parla' && tail >= 0.8) { hold = r1(Math.min(tail * 0.75, ln.mode === 'allunga' ? 4 : 2.5)); notes.push('tieni l\'ultima parola «' + ws[ws.length - 1].w.replace(/[^\wàèéìòù'-]/gi, '') + '» ' + hold + ' s'); }
      var rest = r1(Math.max(0, tail - hold));
      sinceBreath += sing + lead;
      var breath = false;
      if (sing > BREATH_AFTER && ws.length > 5) { var k = Math.floor(ws.length / 2); mid = ws[k - 1].w.replace(/[^\wàèéìòù'-]/gi, ''); notes.push('respira a metà, dopo «' + mid + '»'); }
      if (rest >= 0.5 || sinceBreath > BREATH_AFTER * 1.6 || secEnd) { breath = true; sinceBreath = 0; notes.push(secEnd ? 'respira e fai pausa: cambia sezione' : 'respira nella pausa (' + (rest || 0.5) + ' s)'); }
      if (ln.mode === 'parla' && tail >= 1.2) notes.push('spazio per un ad-lib o un eco');
      var warn = null;
      if (rate > FAST) warn = 'troppo veloce (' + r1(rate) + ' sillabe/s): dai più battute alla riga o accorciala';
      else if (rate < SLOW && ln.mode === 'parla') warn = 'troppo lenta per il parlato: segnala "canta" o aggiungi parole';
      out.push({ index: i, text: ln.text, section: ln.section, mode: ln.mode, entryBar: ln.startBar + 1, entrySec: r1(first), endSec: r1(last), singSec: r1(sing), windowSec: r1(ln.end - ln.start), syllables: ln.syllables, rate: r1(rate), holdSec: hold, restSec: rest, breath: breath, midBreathAfter: mid, notes: notes, warn: warn, cue: notes.slice(1).join(' · ') });
    });
    return { lines: out, barSec: map.barSec, warnings: out.filter(function (l) { return l.warn; }).length };
  }

  /* Frasi attive della ripresa: [{a,b}] in secondi */
  function activity(x, sr) {
    var hop = Math.round(sr * 0.02), n = Math.floor(x.length / hop), e = [], i, j, mx = 0;
    for (i = 0; i < n; i++) { var s = 0; for (j = 0; j < hop; j++) { var v = x[i * hop + j]; s += v * v; } e.push(Math.sqrt(s / hop)); if (e[i] > mx) mx = e[i]; }
    var thr = mx * 0.08, act = e.map(function (v) { return v > thr; }), segs = [], st = -1, gap = 0;
    for (i = 0; i < n; i++) {
      if (act[i]) { if (st < 0) st = i; gap = 0; } else if (st >= 0 && ++gap > 12) { segs.push({ a: st * 0.02, b: (i - gap + 1) * 0.02 }); st = -1; gap = 0; }
    }
    if (st >= 0) segs.push({ a: st * 0.02, b: n * 0.02 });
    return segs;
  }
  /* Confronto ripresa/guida: per ogni riga quanto hai cantato dentro la sua finestra e di quanto sfori. */
  function check(x, sr, guide, map) {
    if (!guide || !map) return null;
    var segs = activity(x, sr), res = [], bad = 0;
    guide.lines.forEach(function (g, i) {
      var ln = map.lines[i], w0 = ln.start, w1 = ln.end, voiced = 0, over = 0, firstOn = null;
      segs.forEach(function (s) { var a = Math.max(s.a, w0), b = Math.min(s.b, w1); if (b > a) { voiced += b - a; if (firstOn == null) firstOn = a; } });
      var nxt = map.lines[i + 1], spill = 0; if (nxt) segs.forEach(function (s) { if (s.a < nxt.start - 0.05 && s.b > nxt.start) spill = Math.max(spill, s.b - nxt.start); });
      var status = voiced < 0.25 * g.singSec ? 'vuota' : (spill > 0.35 ? 'sfora' : (firstOn != null && firstOn - ln.start > 0.45 * (ln.end - ln.start) ? 'tardi' : 'ok'));
      if (status !== 'ok') bad++;
      res.push({ index: i, status: status, voicedSec: r1(voiced), plannedSec: g.singSec, spillSec: r1(spill), onsetDelaySec: firstOn == null ? null : r1(firstOn - g.entrySec) });
    });
    return { lines: res, bad: bad };
  }
  return { build: build, check: check, activity: activity, FAST: FAST };
});
