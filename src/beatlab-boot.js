/* Beat Lab - avvio: collega i moduli opzionali (campioni, teoria, mixer...) all'interfaccia quando sono presenti. */
(function (root) {
  'use strict';
  var UI = root.BeatLabUI; if (!UI) return;
  root.BeatLab = { version: 1, modules: ['voices', 'engine', 'patterns', 'ui'] };
})(typeof self !== 'undefined' ? self : this);
