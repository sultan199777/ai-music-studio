/*
 * Beat Lab - sampler intonato a piu' campioni (Tappa 2).
 * - Catalogo degli strumenti (sempre presente, anche senza file): nome, gruppo, spiegazione e SINTETIZZATORE DI RIPIEGO.
 * - I campioni (MP3 mono) stanno in samples/ accanto alla pagina e si scaricano SOLO quando uno strumento serve (fetch).
 * - Ogni campione ha la sua nota di partenza ("radice"): per suonare una nota si prende il campione piu' vicino e lo si
 *   accorda cambiando la velocita' di lettura. Gli strumenti "tenuti" (archi, ottoni, organo...) hanno un loop senza click.
 * - Se i file non ci sono (versione dentro Claude, offline mai usata, errore di rete) la pagina suona con i sintetizzatori
 *   e lo dice: lo strumento resta utilizzabile.
 * Licenze: tutti i campioni sono CC0 (vedi notes/LICENZE-SUONI.md e samples/manifest.json).
 */
(function (root, factory) {
  var E = (typeof module === 'object' && module.exports) ? require('./beatlab-engine.js') : root.BeatEngine;
  if (typeof module === 'object' && module.exports) module.exports = factory(E, root);
  else root.BeatSampler = factory(E, root);
})(typeof self !== 'undefined' ? self : this, function (E, root) {
  'use strict';
  var V = E.Voices;

  // id: nome, gruppo, ripiego sintetico (id in Voices.INSTRUMENTS), parametri del ripiego, estensione utile, mono, descrizione semplice
  var CATALOG = {
    piano: { name: 'Pianoforte', group: 'Tastiere', fb: 'fm', fbp: { ratio: 1, index: 0.8 }, range: [36, 96], desc: 'Pianoforte a coda. Va bene per accordi e melodie malinconiche, anche nel rap melodico.' },
    epiano: { name: 'Piano elettrico', group: 'Tastiere', fb: 'fm', fbp: { ratio: 2, index: 1.6 }, range: [36, 96], desc: 'Suono morbido e "caldo" tipo Rhodes: R&B, pop, melodie rilassate.' },
    clavi: { name: 'Tastiera pizzicata', group: 'Tastiere', fb: 'pluck', range: [36, 84], desc: 'Tastiera sintetica pizzicata: ritmica, adatta a motivi corti che si ripetono.' },
    organo: { name: 'Organo a canne', group: 'Tastiere', fb: 'pad', range: [36, 84], desc: 'Suono pieno e solenne: atmosfere epiche, chiesa, dark.' },
    arpa: { name: 'Arpa', group: 'Corde', fb: 'pluck', range: [36, 100], desc: 'Note pizzicate chiare e lunghe: arpeggi e intro delicate.' },
    strum: { name: 'Strumstick (corde pizzicate)', group: 'Corde', fb: 'guitar', range: [48, 83], desc: 'Strumento a tre corde, il piu\' simile a una chitarra tra i suoni liberi. Per una vera chitarra c\'e\' quella sintetica.' },
    guitar: { name: 'Chitarra (sintetica)', group: 'Corde', fb: 'guitar', range: [40, 76], synthOnly: true, desc: 'Corda pizzicata calcolata dal programma (non e\' un campione): arpeggi e riff.' },
    basso: { name: 'Basso (contrabbasso)', group: 'Bassi', fb: 'sub', range: [28, 55], mono: true, desc: 'Contrabbasso pizzicato: linea di basso morbida per R&B, boom bap, pop.' },
    sub808s: { name: '808 (campione intonato)', group: 'Bassi', fb: 'sub808', range: [27, 45], mono: true, desc: '808 da campione, accordato sulla nota. Usa "scivola" per il glide.' },
    archi: { name: 'Archi (violini)', group: 'Archi', fb: 'strings', range: [52, 90], desc: 'Sezione di violini: tappeti epici, tensione e melodie in alto.' },
    celli: { name: 'Archi gravi (celli)', group: 'Archi', fb: 'strings', range: [36, 72], desc: 'Violoncelli: note lunghe, calde e scure; ottimi per il drill e il cinematografico.' },
    corno: { name: 'Corno francese', group: 'Ottoni', fb: 'brass', range: [34, 72], desc: 'Ottone morbido e nobile: note lunghe e momenti epici.' },
    tromba: { name: 'Tromba', group: 'Ottoni', fb: 'brass', range: [52, 84], desc: 'Ottone brillante: stacchi e annunci, stile cinematografico.' },
    trombone: { name: 'Trombone', group: 'Ottoni', fb: 'brass', range: [34, 65], desc: 'Ottone grave e potente: note lunghe, "colpi" di drammaticità.' },
    flauto: { name: 'Flauto', group: 'Fiati', fb: 'lead', range: [58, 96], desc: 'Fiato leggero e aereo: melodie delicate e atmosfere.' },
    clarinetto: { name: 'Clarinetto', group: 'Fiati', fb: 'lead', range: [50, 90], desc: 'Fiato scuro e caldo: melodie morbide, jazz e R&B.' },
    vibra: { name: 'Vibrafono', group: 'Mallet', fb: 'fm', fbp: { ratio: 4, index: 0.5 }, range: [53, 89], desc: 'Lamelle metalliche dolci: suono notturno e rilassato.' },
    marimba: { name: 'Marimba', group: 'Mallet', fb: 'fm', fbp: { ratio: 3, index: 0.3 }, range: [41, 96], desc: 'Legno suonato con mazze: ritmico e caldo, bello per motivi corti.' },
    campane: { name: 'Campane tubolari', group: 'Mallet', fb: 'fm', fbp: { ratio: 3.5, index: 1.5 }, range: [55, 80], desc: 'Campane lunghe e cupe: tipiche del dark trap e del drill.' },
    carillon: { name: 'Carillon (glockenspiel)', group: 'Mallet', fb: 'fm', fbp: { ratio: 5, index: 0.6 }, range: [74, 108], desc: 'Note acute e cristalline come un carillon: tipico delle melodie trap.' },
    chimes: { name: 'Campanelle', group: 'Mallet', fb: 'fm', fbp: { ratio: 4, index: 0.7 }, range: [57, 99], desc: 'Campanelle a mano, suono magico e brillante.' }
  };
  var ORDER = ['sub808', 'sub808s', 'sub', 'basso', 'piano', 'epiano', 'clavi', 'organo', 'arpa', 'strum', 'guitar', 'archi', 'celli', 'strings', 'corno', 'tromba', 'trombone', 'brass', 'flauto', 'clarinetto', 'vibra', 'marimba', 'campane', 'carillon', 'chimes', 'pad', 'choir', 'lead', 'pluck', 'fm'];

  // registra gli strumenti nel motore (con ripiego sintetico)
  Object.keys(CATALOG).forEach(function (id) {
    var c = CATALOG[id], fb = V.INSTRUMENTS[c.fb];
    if (V.INSTRUMENTS[id]) return;
    V.INSTRUMENTS[id] = { name: c.name, mono: !!c.mono, range: c.range, sampled: !c.synthOnly, fallback: c.fb, fallbackParams: c.fbp || null, fn: function (ctx, dest, o) { var oo = {}; for (var k in o) oo[k] = o[k]; oo.p = c.fbp || o.p; return fb.fn(ctx, dest, oo); } };
  });
  // gruppi per il selettore (sintetizzatori inclusi)
  var SYNTH_GROUPS = { sub808: 'Bassi', sub: 'Bassi', pad: 'Sintetizzatori', lead: 'Sintetizzatori', pluck: 'Sintetizzatori', fm: 'Sintetizzatori', choir: 'Sintetizzatori', brass: 'Sintetizzatori', strings: 'Sintetizzatori' };
  function groupOf(id) { return CATALOG[id] ? CATALOG[id].group : (SYNTH_GROUPS[id] || 'Altro'); }
  function instrumentList() {
    var out = []; ORDER.forEach(function (id) { if (V.INSTRUMENTS[id]) out.push({ id: id, name: V.INSTRUMENTS[id].name, group: groupOf(id), sampled: !!(CATALOG[id] && !CATALOG[id].synthOnly) }); });
    Object.keys(V.INSTRUMENTS).forEach(function (id) { if (ORDER.indexOf(id) < 0) out.push({ id: id, name: V.INSTRUMENTS[id].name, group: groupOf(id), sampled: false }); });
    return out;
  }

  /* ---------- scelta del campione e altezza ---------- */
  function pickSample(samples, midi) {
    var best = null, bd = 1e9;
    for (var i = 0; i < samples.length; i++) { var d = Math.abs(samples[i].m - midi) + (samples[i].m > midi ? 0.01 : 0); if (d < bd) { bd = d; best = samples[i]; } }
    return best;
  }
  function rateFor(sample, midi) { return Math.pow(2, (midi - sample.m) / 12 - (sample.c || 0) / 1200); } // c = quanto il campione e' sopra la sua nota (centesimi): si compensa
  function firstAbove(data, thr) { for (var i = 0; i < data.length; i++) if (Math.abs(data[i]) > thr) return i; return 0; }

  /* ---------- il sampler ---------- */
  function Sampler(opts) {
    opts = opts || {};
    this.base = opts.base == null ? 'samples/' : opts.base; this.fetch = opts.fetch || (root.fetch ? root.fetch.bind(root) : null);
    this.manifest = null; this.inst = {}; this.kits = {}; this.loading = {}; this.available = false; this.error = '';
    this.decoder = opts.decoder || null; this.maxLoaded = opts.maxLoaded || 8; this.useClock = 0;
  }
  Sampler.prototype.init = function () {
    var self = this;
    if (this.initP) return this.initP;
    if (!this.fetch || (root.location && root.location.protocol === 'file:')) { this.error = 'la pagina e\' aperta come file, senza sito'; this.initP = Promise.resolve(false); return this.initP; }
    this.initP = this.fetch(this.base + 'manifest.json').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (m) {
      if (!m || !m.instruments) throw new Error('manifest non valido'); self.manifest = m; self.available = true; return true;
    }).catch(function (e) { self.available = false; self.error = 'file dei suoni non raggiungibili: ' + e.message; return false; });
    return this.initP;
  };
  Sampler.prototype.getDecoder = function (sr) {
    sr = sr || (this.manifest && this.manifest.sr) || 32000; this.decoders = this.decoders || {};
    if (this.decoder) return this.decoder;
    if (this.decoders[sr]) return this.decoders[sr];
    var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext; if (!OAC) return null;
    return (this.decoders[sr] = new OAC(1, 1, sr));
  };
  Sampler.prototype.decode = function (ab, sr) {
    var d = this.getDecoder(sr); if (!d) return Promise.reject(new Error('Web Audio non disponibile'));
    return new Promise(function (res, rej) { var p = d.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
  };
  Sampler.prototype.entry = function (id) { return this.manifest && this.manifest.instruments[id]; };
  Sampler.prototype.isKnown = function (id) { return !!this.entry(id); };
  Sampler.prototype.has = function (id) { return !!(this.inst[id] && this.inst[id].ready); };
  Sampler.prototype.state = function (id) { if (this.has(id)) return 'pronto'; if (this.loading[id]) return 'in caricamento'; if (this.inst[id] && this.inst[id].failed) return 'errore'; return this.isKnown(id) ? 'da caricare' : 'solo sintetizzatore'; };
  Sampler.prototype.fetchBuf = function (rel, sr) {
    var self = this;
    return this.fetch(this.base + rel).then(function (r) { if (!r.ok) throw new Error(rel + ' HTTP ' + r.status); return r.arrayBuffer(); }).then(function (ab) { return self.decode(ab, sr); });
  };
  // Carica tutti i campioni di uno strumento (a gruppi di 6 in parallelo). onProgress(frazione 0-1).
  Sampler.prototype.load = function (id, onProgress) {
    var self = this;
    if (this.has(id)) return Promise.resolve(true);
    if (this.loading[id]) return this.loading[id];
    var p = this.init().then(function (ok) {
      var en = ok && self.entry(id); if (!en) return false;
      var list = en.samples, done = 0, out = new Array(list.length), idx = 0;
      function worker() {
        if (idx >= list.length) return Promise.resolve();
        var i = idx++, s = list[i];
        return self.fetchBuf(s.f).then(function (buf) {
          var off = Math.max(0, firstAbove(buf.getChannelData(0), 0.0006) / buf.sampleRate - 0.003); // se il decoder ha lasciato silenzio all'inizio
          out[i] = { m: s.m, c: s.c || 0, buf: buf, ls: s.ls != null ? s.ls : null, le: s.le != null ? s.le : null, off: off < 0.004 ? 0 : off };
          done++; if (onProgress) onProgress(done / list.length);
        }).then(worker);
      }
      var ws = []; for (var k = 0; k < 6; k++) ws.push(worker());
      return Promise.all(ws).then(function () {
        self.inst[id] = { ready: true, samples: out.sort(function (a, b) { return a.m - b.m; }), rel: en.rel, gain: en.gain || 1, sustain: !!en.sustain, mono: !!en.mono, last: ++self.useClock };
        return true;
      });
    }).catch(function (e) { self.inst[id] = { failed: true, error: e.message }; self.error = 'Caricamento di ' + id + ' non riuscito: ' + e.message; return false; }).then(function (r) { delete self.loading[id]; return r; });
    this.loading[id] = p; return p;
  };
  // libera la memoria degli strumenti non usati da un po' (iPhone), tenendo quelli indicati
  Sampler.prototype.trim = function (keep) {
    var ids = Object.keys(this.inst).filter(function (k) { return this.inst[k].ready && (keep || []).indexOf(k) < 0; }, this);
    ids.sort(function (a, b) { return this.inst[a].last - this.inst[b].last; }.bind(this));
    var loaded = Object.keys(this.inst).filter(function (k) { return this.inst[k].ready; }, this).length;
    while (loaded > this.maxLoaded && ids.length) { delete this.inst[ids.shift()]; loaded--; }
  };
  Sampler.prototype.play = function (ctx, dest, id, o) {
    var I = this.inst[id]; I.last = ++this.useClock;
    var s = pickSample(I.samples, o.midi), src = ctx.createBufferSource(), g = ctx.createGain(), t = o.when, v = V.velGain(o.vel);
    src.buffer = s.buf; var r1 = rateFor(s, o.midi);
    if (o.glideFrom != null) { src.playbackRate.setValueAtTime(rateFor(s, o.glideFrom), t); src.playbackRate.exponentialRampToValueAtTime(r1, t + ((o.p && o.p.glide) || 0.07)); } else src.playbackRate.value = r1;
    var rel = I.rel || 0.2, end = t + Math.max(0.03, o.dur);
    if (s.ls != null && I.sustain) { src.loop = true; src.loopStart = s.ls + s.off; src.loopEnd = s.le + s.off; }
    var amp = 1.3 * v * I.gain;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(amp, t + 0.004);
    g.gain.setValueAtTime(amp, end); g.gain.setTargetAtTime(0, end, rel / 3);
    src.connect(g); g.connect(dest); src.start(t, s.off); src.stop(end + rel * 2 + 0.1);
    return { stop: function (tt) { try { g.gain.cancelScheduledValues(tt); g.gain.setTargetAtTime(0, tt, 0.012); } catch (e) {} } };
  };
  Sampler.prototype.loadKit = function (kitId) {
    var self = this;
    if (this.kits[kitId]) return Promise.resolve(true);
    return this.init().then(function (ok) {
      var k = ok && self.manifest.kits && self.manifest.kits[kitId]; if (!k) return false;
      var lanes = Object.keys(k.files), out = {};
      return Promise.all(lanes.map(function (l) { return self.fetchBuf(k.files[l], 44100).then(function (b) { out[l] = b; }); })).then(function () { self.kits[kitId] = out; return true; });
    }).catch(function (e) { self.error = 'Kit non caricato: ' + e.message; return false; });
  };
  Sampler.prototype.kitBuffers = function (kitId) { return this.kits[kitId] || null; };
  Sampler.prototype.kitList = function () { var m = this.manifest; return m && m.kits ? Object.keys(m.kits).map(function (k) { return { id: k, name: m.kits[k].name, loaded: !!this.kits[k] }; }, this) : []; };

  return { CATALOG: CATALOG, ORDER: ORDER, instrumentList: instrumentList, groupOf: groupOf, Sampler: Sampler, pickSample: pickSample, rateFor: rateFor, firstAbove: firstAbove };
});
