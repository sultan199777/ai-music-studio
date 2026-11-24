/*
 * Effetti del videoclip a tempo di musica: calcolo puro, senza disegno.
 * Dato il tempo trascorso e i battiti al minuto, dice quanto ingrandire
 * l'immagine, quanto farla vibrare e quale riga del testo mostrare.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ClipFx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function beatState(t, bpm) {
    var beatLen = 60 / bpm, b = Math.max(0, t) / beatLen, beat = Math.floor(b), phase = b - beat;
    return { beat: beat, phase: phase, bar: Math.floor(beat / 4), beatInBar: beat % 4, pulse: Math.exp(-phase * 5) };
  }

  function lyricAt(lines, bar) {
    var l = (lines || []).filter(function (x) { return x && x.trim(); });
    return l.length ? l[((bar % l.length) + l.length) % l.length] : '';
  }

  // Hash semplice per vibrazioni ripetibili
  function noise(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  function frame(t, bpm) {
    var s = beatState(t, bpm), down = s.beatInBar === 0;
    var scale = 1 + 0.035 * s.pulse + (down ? 0.035 * s.pulse : 0);
    var glitch = down && s.phase < 0.15 ? (0.15 - s.phase) / 0.15 : 0;
    return {
      beat: s.beat, bar: s.bar, beatInBar: s.beatInBar, phase: s.phase,
      scale: scale,
      shakeX: (noise(s.beat * 3 + 1) - 0.5) * 14 * glitch,
      shakeY: (noise(s.beat * 3 + 2) - 0.5) * 10 * glitch,
      split: 7 * glitch + 1.5 * s.pulse,
      flash: down ? 0.25 * s.pulse : 0.08 * s.pulse
    };
  }

  return { beatState: beatState, lyricAt: lyricAt, frame: frame };
});
