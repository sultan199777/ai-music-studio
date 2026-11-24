/*
 * Generatore di basi musicali ORIGINALI (batteria, basso, accordi, pad, melodia).
 *
 * Tutto è sintetizzato dal programma con onde semplici: non usa registrazioni,
 * campioni o brani di altri. Il risultato è una bozza utile per cantarci sopra;
 * non ha il suono di strumenti reali registrati in studio.
 * Con lo stesso "seme" si ottiene sempre la stessa base.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Backing = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
  var STEPS = { maggiore: [0, 2, 4, 5, 7, 9, 11], minore: [0, 2, 3, 5, 7, 8, 10] };
  var PROG = { maggiore: [0, 4, 5, 3], minore: [0, 5, 2, 6] }; // I V vi IV  /  i VI III VII

  // Schemi su 16 passi (una battuta). Numeri = forza del colpo.
  var GENRES = {
    pop: {
      label: 'Pop', bpm: 100, swing: 0,
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [0.6, 0, 0.4, 0, 0.6, 0, 0.4, 0, 0.6, 0, 0.4, 0, 0.6, 0, 0.4, 0.3],
      bass: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      chord: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], padLevel: 0.5, bassStyle: 'round'
    },
    hiphop: {
      label: 'Hip-hop', bpm: 140, swing: 0,
      kick: [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      hat: [0.7, 0.3, 0.5, 0.3, 0.7, 0.3, 0.5, 0.3, 0.7, 0.3, 0.5, 0.3, 0.7, 0.5, 0.7, 0.5],
      bass: [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
      chord: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], padLevel: 0.35, bassStyle: '808'
    },
    lofi: {
      label: 'Lo-fi', bpm: 78, swing: 0.18,
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [0.5, 0, 0.3, 0, 0.5, 0, 0.3, 0, 0.5, 0, 0.3, 0, 0.5, 0, 0.3, 0],
      bass: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      chord: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0], padLevel: 0.6, bassStyle: 'round'
    },
    dance: {
      label: 'Dance', bpm: 124, swing: 0,
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [0, 0, 0.7, 0, 0, 0, 0.7, 0, 0, 0, 0.7, 0, 0, 0, 0.7, 0],
      bass: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
      chord: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0], padLevel: 0.7, bassStyle: 'round'
    }
  };

  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function scaleNote(tonic, mode, degree, octaveBase) {
    var st = STEPS[mode], oct = Math.floor(degree / 7), d = ((degree % 7) + 7) % 7;
    return octaveBase + tonic + st[d] + 12 * oct;
  }

  function chordName(tonic, mode, degree) {
    var root = scaleNote(tonic, mode, degree, 0), third = scaleNote(tonic, mode, degree + 2, 0), fifth = scaleNote(tonic, mode, degree + 4, 0);
    var t = third - root, f = fifth - root;
    var suffix = t === 3 ? (f === 6 ? 'dim' : 'm') : '';
    return NAMES[((root % 12) + 12) % 12] + suffix;
  }

  /**
   * @param {{sampleRate?:number,bpm?:number,tonic?:number,mode?:string,bars?:number,genre?:string,seed?:number}} p
   */
  function generate(p) {
    p = p || {};
    var genre = GENRES[p.genre] || GENRES.pop;
    var sr = p.sampleRate || 44100;
    var bpm = p.bpm || genre.bpm;
    var tonic = ((p.tonic || 0) % 12 + 12) % 12;
    var mode = p.mode === 'minore' ? 'minore' : 'maggiore';
    var bars = Math.max(1, Math.min(32, p.bars || 8));
    var rand = rng(p.seed || 1);
    var stepSec = 60 / bpm / 4;
    var stepLen = Math.round(stepSec * sr);
    var N = stepLen * 16 * bars;
    var tracks = { kick: new Float32Array(N), snare: new Float32Array(N), hat: new Float32Array(N), bass: new Float32Array(N), chords: new Float32Array(N), pad: new Float32Array(N), lead: new Float32Array(N) };
    var events = { bass: [], chords: [], lead: [] };

    function startOf(bar, step) {
      var swing = (step % 2 === 1) ? genre.swing * stepLen : 0;
      return Math.round((bar * 16 + step) * stepLen + swing);
    }
    function add(track, start, buf, gain) {
      for (var i = 0; i < buf.length && start + i < N; i++) tracks[track][start + i] += buf[i] * gain;
    }

    // --- Strumenti ---
    function kickHit() {
      var len = Math.round(0.35 * sr), b = new Float32Array(len), ph = 0;
      for (var i = 0; i < len; i++) {
        var t = i / sr, f = 45 + 90 * Math.exp(-t * 35);
        ph += 2 * Math.PI * f / sr;
        b[i] = Math.sin(ph) * Math.exp(-t * 11) * (i < 40 ? i / 40 : 1);
      }
      return b;
    }
    function snareHit() {
      var len = Math.round(0.22 * sr), b = new Float32Array(len);
      for (var i = 0; i < len; i++) {
        var t = i / sr;
        b[i] = (rand() * 2 - 1) * Math.exp(-t * 22) * 0.55 + Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 30) * 0.4;
      }
      return b;
    }
    function hatHit(open) {
      var len = Math.round((open ? 0.18 : 0.05) * sr), b = new Float32Array(len), prev = 0;
      for (var i = 0; i < len; i++) {
        var t = i / sr, n = rand() * 2 - 1;
        b[i] = (n - prev) * Math.exp(-t * (open ? 22 : 80)) * 0.5; prev = n;
      }
      return b;
    }
    var cache = {};
    function memo(key, fn) { return cache[key] || (cache[key] = fn()); }
    function pluckRaw(midi, dur) {
      var len = Math.round(dur * sr), b = new Float32Array(len), f = mtof(midi), amps = [1, 0.5, 0.25, 0.12];
      for (var i = 0; i < len; i++) {
        var t = i / sr, v = 0;
        for (var h = 0; h < amps.length; h++) v += amps[h] * Math.sin(2 * Math.PI * f * (h + 1) * t + h) * Math.exp(-t * (2.5 + h * 1.5));
        b[i] = v * Math.min(1, i / 120) * Math.min(1, (len - i) / 400);
      }
      return b;
    }
    function bassRaw(midi, dur, style) {
      var len = Math.round(dur * sr), b = new Float32Array(len), f = mtof(midi), ph = 0;
      for (var i = 0; i < len; i++) {
        var t = i / sr, fr = style === '808' ? f * (1 + 0.6 * Math.exp(-t * 40)) : f;
        ph += 2 * Math.PI * fr / sr;
        var env = style === '808' ? Math.exp(-t * 2.2) : Math.exp(-t * 3.5);
        var v = Math.sin(ph) + (style === '808' ? 0 : 0.3 * Math.sin(2 * ph));
        if (style === '808') v = Math.tanh(v * 1.8) / 1.2;
        b[i] = v * env * Math.min(1, i / 200) * Math.min(1, (len - i) / 400);
      }
      return b;
    }
    function padRaw(midis, dur) {
      var len = Math.round(dur * sr), b = new Float32Array(len), atk = 0.35 * sr, rel = 0.4 * sr;
      midis.forEach(function (m) {
        [0.997, 1.003].forEach(function (det) {
          var f = mtof(m) * det;
          for (var i = 0; i < len; i++) {
            var t = i / sr, v = 0;
            for (var h = 1; h <= 3; h++) v += Math.sin(2 * Math.PI * f * h * t) / (h * h);
            var env = Math.min(1, i / atk) * Math.min(1, (len - i) / rel);
            b[i] += v * env / 6;
          }
        });
      });
      return b;
    }
    function leadRaw(midi, dur) {
      var len = Math.round(dur * sr), b = new Float32Array(len), f = mtof(midi), ph = 0;
      for (var i = 0; i < len; i++) {
        var t = i / sr, vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.2 * t) * Math.min(1, t * 3);
        ph += 2 * Math.PI * f * vib / sr;
        var tri = (2 / Math.PI) * Math.asin(Math.sin(ph));
        b[i] = (tri * 0.8 + Math.sin(ph) * 0.2) * Math.min(1, i / 300) * Math.min(1, (len - i) / 1500) * Math.exp(-t * 0.8);
      }
      return b;
    }

    function pluck(m, d) { return memo('p' + m + '_' + d, function () { return pluckRaw(m, d); }); }
    function bassNote(m, d, st) { return memo('b' + m + '_' + d.toFixed(3) + st, function () { return bassRaw(m, d, st); }); }
    function padChord(ms, d) { return memo('d' + ms.join(',') + '_' + d.toFixed(3), function () { return padRaw(ms, d); }); }
    function leadNote(m, d) { return memo('l' + m + '_' + d.toFixed(3), function () { return leadRaw(m, d); }); }

    var kick = kickHit(), degrees = PROG[mode], leadPrev = scaleNote(tonic, mode, 14, 60) - 60 + 60;
    var scaleMidis = [];
    for (var d = 7; d <= 14; d++) scaleMidis.push(scaleNote(tonic, mode, d, 48));
    var leadIdx = 2;

    for (var bar = 0; bar < bars; bar++) {
      var deg = degrees[bar % 4];
      var root = scaleNote(tonic, mode, deg, 36);
      var chordMidis = [scaleNote(tonic, mode, deg, 48), scaleNote(tonic, mode, deg + 2, 48), scaleNote(tonic, mode, deg + 4, 48)];
      var barLen = stepLen * 16;
      events.chords.push({ bar: bar, name: chordName(tonic, mode, deg), midis: chordMidis });

      for (var s = 0; s < 16; s++) {
        var at = startOf(bar, s);
        if (genre.kick[s]) add('kick', at, kick, 0.9);
        if (genre.snare[s]) add('snare', at, snareHit(), 0.8);
        if (genre.hat[s]) add('hat', at, hatHit(s === 14 && genre.label !== 'Lo-fi'), 0.5 * genre.hat[s]);
        if (genre.bass[s]) {
          var nextOn = 16; for (var q = s + 1; q < 16; q++) if (genre.bass[q]) { nextOn = q; break; }
          var dur = Math.min((nextOn - s) * stepSec, 1.2);
          add('bass', at, bassNote(root, dur, p.bassStyle || genre.bassStyle), 0.7);
          events.bass.push({ start: at / sr, midi: root, dur: dur });
        }
        if (genre.chord[s]) {
          chordMidis.forEach(function (m, k) { add('chords', at + k * 90, pluck(m, 1.6), 0.22); });
        }
      }
      add('pad', bar * barLen, padChord(chordMidis.map(function (m) { return m; }), barLen / sr * 1.04), 0.5 * genre.padLevel);

      // Melodia: passi vicini nella scala, con preferenza per le note dell'accordo sui tempi forti
      var s2 = 0;
      while (s2 < 16) {
        var len16 = [2, 2, 3, 4][Math.floor(rand() * 4)];
        if (rand() < 0.28) { s2 += len16; continue; } // pausa
        var strong = s2 % 4 === 0;
        var move = Math.floor(rand() * 5) - 2;
        leadIdx = Math.max(0, Math.min(scaleMidis.length - 1, leadIdx + move));
        var midi = scaleMidis[leadIdx] + 12;
        if (strong) {
          var tones = chordMidis.map(function (m) { return m + 12; });
          var nearest = tones.reduce(function (a, c) { return Math.abs(c - midi) < Math.abs(a - midi) ? c : a; }, tones[0]);
          if (Math.abs(nearest - midi) <= 3) midi = nearest;
        }
        var dsec = Math.min(len16, 16 - s2) * stepSec * 0.92;
        add('lead', startOf(bar, s2), leadNote(midi, dsec), 0.35);
        events.lead.push({ start: startOf(bar, s2) / sr, midi: midi, dur: dsec });
        s2 += len16;
      }
    }

    return { sampleRate: sr, bpm: bpm, tonic: tonic, mode: mode, bars: bars, genre: p.genre || 'pop', length: N, duration: N / sr, tracks: tracks, events: events,
      progression: events.chords.slice(0, 4).map(function (c) { return c.name; }) };
  }

  /** Somma le tracce con i volumi dati (0-1) e normalizza il picco. */
  function mix(base, gains, sec) {
    gains = gains || {};
    var N = base.length, out = new Float32Array(N), names = Object.keys(base.tracks);
    var groups = { batteria: ['kick', 'snare', 'hat'], basso: ['bass'], accordi: ['chords'], pad: ['pad', 'fx'], melodia: ['lead'] };
    names.forEach(function (n) {
      var g = gains[n];
      if (g == null) {
        var grp = Object.keys(groups).filter(function (k) { return groups[k].indexOf(n) !== -1; })[0];
        g = gains[grp] == null ? 1 : gains[grp];
      }
      if (!g) return;
      var t = base.tracks[n], i;
      var env = null;
      if (sec && base.sections) {
        base.sections.forEach(function (sc) {
          var m = sec[sc.name] && sec[sc.name][n]; if (m == null || m === 1) return;
          if (!env) { env = new Float32Array(N); for (var q = 0; q < N; q++) env[q] = 1; }
          var a = Math.round(sc.startSec * base.sampleRate), z = Math.min(N, Math.round(sc.endSec * base.sampleRate));
          for (var j = a; j < z; j++) env[j] = m;
        });
      }
      if (env) { var sm = 0, k2 = 1 - Math.exp(-1 / (0.006 * base.sampleRate)); for (i = 0; i < N; i++) { sm += (env[i] - sm) * k2; out[i] += t[i] * g * sm; } }
      else for (i = 0; i < N; i++) out[i] += t[i] * g;
    });
    var peak = 0, i2;
    for (i2 = 0; i2 < N; i2++) { var a = Math.abs(out[i2]); if (a > peak) peak = a; }
    if (peak > 0) { var k = 0.8 / peak; for (i2 = 0; i2 < N; i2++) out[i2] *= k; }
    return out;
  }

  function resampleLinear(x, srIn, srOut) {
    if (srIn === srOut) return x;
    var n = Math.floor(x.length * srOut / srIn), out = new Float32Array(n), ratio = srIn / srOut;
    for (var i = 0; i < n; i++) {
      var p = i * ratio, i0 = Math.floor(p), f = p - i0;
      out[i] = x[i0] * (1 - f) + (x[Math.min(x.length - 1, i0 + 1)] * f);
    }
    return out;
  }

  /** Mette la voce sopra la base (la voce viene portata alla stessa frequenza di campionamento). */
  function withVoice(baseMix, baseSr, voice, voiceSr, voiceGain, offsetSec) {
    var v = resampleLinear(voice, voiceSr, baseSr);
    var off = Math.round((offsetSec || 0) * baseSr);
    if (off > 0) { var shifted = new Float32Array(v.length + off); shifted.set(v, off); v = shifted; }
    else if (off < 0) v = v.subarray(Math.min(v.length, -off));
    var N = Math.max(baseMix.length, v.length), out = new Float32Array(N);
    var g = voiceGain == null ? 1 : voiceGain;
    for (var i = 0; i < N; i++) out[i] = (i < baseMix.length ? baseMix[i] * 0.7 : 0) + (i < v.length ? v[i] * g : 0);
    var peak = 0; for (i = 0; i < N; i++) { var a = Math.abs(out[i]); if (a > peak) peak = a; }
    if (peak > 0.95) { var k = 0.95 / peak; for (i = 0; i < N; i++) out[i] *= k; }
    return out;
  }

  return { generate: generate, mix: mix, withVoice: withVoice, resampleLinear: resampleLinear, GENRES: GENRES, chordName: chordName, NAMES: NAMES };
});
