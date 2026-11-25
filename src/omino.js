/*
 * L'omino che canta: mostra COME e QUANDO cantare sulla base, a tempo con lo Studio.
 * Dalla mappa della canzone (righe e parole con inizio/fine in secondi) calcola in ogni istante:
 *  bocca (aperta sulle parole, più aperta sulle vocali lunghe), parola attuale, prossima entrata, "respira", "tieni".
 * Disegno su canvas (leggero, niente librerie). state() è puro e testabile; draw() disegna.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Omino = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  /** Stato a tempo t (secondi). map = SongMap. beatSec = durata di un battito. */
  function state(map, t, beatSec) {
    var L = (map && map.lines) || [], out = { open: 0, word: '', line: '', next: '', cue: '', lineIdx: -1, bounce: 0 };
    beatSec = beatSec || 0.5; out.bounce = Math.pow(Math.max(0, Math.cos(Math.PI * ((t / beatSec) % 1))), 6);
    for (var i = 0; i < L.length; i++) {
      var l = L[i], ws = l.words || [];
      if (!ws.length) continue;
      var a = ws[0].start, z = ws[ws.length - 1].end;
      if (t < a) { // prima della riga: conto alla rovescia
        var dt = a - t; out.next = l.text; out.lineIdx = i;
        out.cue = dt < beatSec * 4 ? 'Entra tra ' + Math.max(1, Math.ceil(dt / beatSec)) : (dt > 1.5 && i > 0 ? 'Respira' : 'Pronto…');
        return out;
      }
      if (t <= z + 0.05) {
        out.line = l.text; out.lineIdx = i; out.next = L[i + 1] ? L[i + 1].text : '';
        for (var k = 0; k < ws.length; k++) {
          var w = ws[k];
          if (t >= w.start && t <= w.end) {
            var d = Math.max(0.05, w.end - w.start), u = (t - w.start) / d, syl = Math.max(1, Math.round(d / 0.18));
            out.word = w.w; out.open = 0.35 + 0.65 * Math.abs(Math.sin(Math.PI * u * syl));
            if (k === ws.length - 1 && d > 0.6) { out.open = Math.max(out.open, 0.8); out.cue = 'Tieni «' + String(w.w).replace(/[^\wàèéìòù'-]/gi, '') + '»'; }
            return out;
          }
        }
        out.open = 0.08; return out; // tra due parole della stessa riga
      }
    }
    out.cue = L.length ? 'Fine' : 'Scrivi il testo per vedermi cantare';
    return out;
  }
  /** Disegna l'omino su un canvas 2D. mood → colore. */
  function draw(cv, st, mood) {
    var g = cv.getContext('2d'), W = cv.width, H = cv.height, dpr = W / (cv.clientWidth || W);
    var col = { aggressivo: '#ff5d5d', malinconico: '#6f9cff', dark: '#a77bff', euforico: '#ffb454', romantico: '#ff8fc8', nostalgico: '#4fd1c5' }[mood] || '#e3c48f';
    g.clearRect(0, 0, W, H);
    var cx = W * 0.27, by = H * 0.92 - st.bounce * 6 * dpr, s = H / 220;
    g.lineCap = 'round'; g.lineWidth = 7 * s; g.strokeStyle = col; g.fillStyle = col;
    // corpo e braccia (il braccio col microfono sale quando canta)
    g.beginPath(); g.moveTo(cx, by - 70 * s); g.lineTo(cx, by - 20 * s); g.stroke();
    g.beginPath(); g.moveTo(cx, by - 60 * s); g.lineTo(cx - 28 * s, by - 35 * s); g.stroke();
    var arm = 12 + st.open * 14; g.beginPath(); g.moveTo(cx, by - 60 * s); g.lineTo(cx + 22 * s, by - 60 * s - arm * s); g.stroke();
    g.beginPath(); g.arc(cx + 24 * s, by - 66 * s - arm * s, 6 * s, 0, 7); g.fill(); // microfono
    g.beginPath(); g.moveTo(cx, by - 20 * s); g.lineTo(cx - 18 * s, by); g.moveTo(cx, by - 20 * s); g.lineTo(cx + 18 * s, by); g.stroke();
    // testa
    var hy = by - 100 * s; g.lineWidth = 5 * s; g.beginPath(); g.arc(cx, hy, 28 * s, 0, 7); g.stroke();
    g.beginPath(); g.arc(cx - 10 * s, hy - 7 * s, 3 * s, 0, 7); g.arc(cx + 10 * s, hy - 7 * s, 3 * s, 0, 7); g.fill();
    g.beginPath(); g.ellipse(cx, hy + 11 * s, 9 * s, Math.max(1.5, 11 * st.open) * s, 0, 0, 7); g.fill(); // bocca
    if (st.open > 0.5) { g.globalAlpha = 0.5; for (var k = 1; k <= 3; k++) { g.beginPath(); g.arc(cx + 30 * s, hy + 8 * s, (8 + k * 9) * s, -0.5, 0.5); g.stroke(); } g.globalAlpha = 1; } // onde del suono
    // testi a destra
    var tx = W * 0.5, fs = Math.round(15 * s), mw = W - tx - 8 * dpr; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillStyle = col; g.font = '700 ' + Math.round(fs * 1.25) + 'px system-ui, sans-serif'; g.fillText(st.word || st.cue || '', tx, H * 0.12, mw);
    g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '500 ' + fs + 'px system-ui, sans-serif'; wrap(g, st.line || st.next || '', tx, H * 0.34, mw, fs * 1.3, 3);
    if (st.line && st.next) { g.fillStyle = 'rgba(255,255,255,.45)'; g.font = '400 ' + Math.round(fs * 0.85) + 'px system-ui, sans-serif'; wrap(g, 'Dopo: ' + st.next, tx, H * 0.72, mw, fs * 1.1, 2); }
  }
  function wrap(g, txt, x, y, mw, lh, max) {
    var ws = String(txt).split(/\s+/), line = '', n = 0;
    for (var i = 0; i < ws.length; i++) { var t2 = line ? line + ' ' + ws[i] : ws[i]; if (g.measureText(t2).width > mw && line) { g.fillText(line, x, y + n * lh); n++; line = ws[i]; if (n >= max) return; } else line = t2; }
    if (line && n < max) g.fillText(line, x, y + n * lh);
  }
  return { state: state, draw: draw };
});
