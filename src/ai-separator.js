/*
 * Separazione AI v2 (gratuita, open source, tutto sul dispositivo).
 * Motore: unblend (MIT) + onnxruntime-web 1.26 (MIT), file in unblend/ e ort126/ accanto alla pagina.
 * Modelli (scaricati UNA volta da Hugging Face e tenuti nel browser):
 *  - "scnet_small"  SCNet, 27 MB: voce, batteria, basso, resto. Misurato su MUSDB18 (2 brani, 20 s):
 *                   voce 12,7 / 14,4 dB, base 18,7 / 21,8 dB (HTDemucs: 11,9 / 13,5 e 17,9 / 20,9).
 *  - "melband_roformer_kim"  Mel-Band RoFormer, 474 MB: solo voce, la più pulita (vedi notes/STATO.md).
 * Modalità:
 *  - "rapida": SCNet sul brano → 4 tracce.
 *  - "studio": RoFormer estrae la voce; la base = brano − voce; SCNet divide la base in batteria/basso/resto.
 * Nessun filtro anti-fruscio dopo: le tracce escono come le dà il modello (il filtro creava l'effetto "sgranato").
 * Limiti onesti: su iPhone la modalità studio può finire la memoria; la rapida è pensata per il telefono.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AiSeparator = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var G = typeof self !== 'undefined' ? self : globalThis;
  var MODELS = {
    scnet_small: { nome: 'SCNet (veloce)', mb: 27 },
    melband_roformer_kim: { nome: 'Mel-Band RoFormer (voce pulitissima)', mb: 474 }
  };
  var S = { lib: null, seps: {}, base: './' };

  function dir(sub) { return new URL(S.base + sub, location.href).href; }
  async function lib() { if (!S.lib) S.lib = await import(dir('unblend/index.js')); return S.lib; }
  function testUrl(model) { return G.MSA_MODEL_DIR ? G.MSA_MODEL_DIR + model + '_fp16.onnx' : undefined; }

  /** Carica un modello (una volta). onDl(fase, scaricati, totale, daMemoria). */
  async function load(model, onDl) {
    if (S.seps[model]) return S.seps[model];
    var U = await lib(), threads = G.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
    var opt = { precision: 'fp16', wasmPaths: dir('ort126/'), numThreads: threads, cache: true,
      onProgress: function (phase, got, tot, src) { if (onDl) onDl(phase, got || 0, tot || MODELS[model].mb * 1048576, src === 'cache'); } };
    var u = testUrl(model); if (u) opt.modelUrl = u;
    var sep = null, err = null;
    try { sep = await U.Separator.load(model, opt); } catch (e) { err = e; }
    if (!sep) { opt.backend = 'wasm'; try { sep = await U.Separator.load(model, opt); } catch (e2) { throw e2 || err; } }
    S.seps[model] = sep; return sep;
  }
  function toBuf(L, R) {
    var b = new AudioBuffer({ numberOfChannels: 2, length: L.length, sampleRate: 44100 });
    b.copyToChannel(L, 0); b.copyToChannel(R || L, 1); return b;
  }
  function split(inter) { var n = inter.length >> 1, l = new Float32Array(n), r = new Float32Array(n); for (var i = 0; i < n; i++) { l[i] = inter[2 * i]; r[i] = inter[2 * i + 1]; } return { left: l, right: r }; }
  async function run(model, L, R, onProg) {
    var sep = S.seps[model];
    try { return await sep.separate(toBuf(L, R), { shifts: 0, onProgress: function (p) { if (onProg) onProg(p.fraction || 0); } }); }
    catch (e) { delete S.seps[model]; throw e; } // dopo un errore l'istanza non è più usabile
  }
  /**
   * Separa L, R (44100 Hz). mode 'rapida' | 'studio'. onProgress(0-1, testo).
   * Ritorna {vocals, drums, bass, other} ognuno {left, right}, e info {mode, backend}.
   */
  async function separate(L, R, mode, onProgress, onDl) {
    R = R || L;
    var prog = function (a, b, t) { return function (f) { if (onProgress) onProgress(a + (b - a) * f, t); }; };
    if (mode !== 'studio') {
      await load('scnet_small', onDl);
      var r = await run('scnet_small', L, R, prog(0, 1, 'Separo voce, batteria, basso e resto'));
      return { vocals: split(r.stems.vocals), drums: split(r.stems.drums), bass: split(r.stems.bass), other: split(r.stems.other), info: { mode: 'rapida', backend: S.seps.scnet_small ? S.seps.scnet_small.backend : '' } };
    }
    await load('melband_roformer_kim', onDl);
    var rv = await run('melband_roformer_kim', L, R, prog(0, 0.65, 'Estraggo la voce (modello grande)'));
    var voc = split(rv.stems.vocals), n = L.length, iL = new Float32Array(n), iR = new Float32Array(n);
    for (var i = 0; i < n; i++) { iL[i] = L[i] - voc.left[i]; iR[i] = R[i] - voc.right[i]; }
    var be = S.seps.melband_roformer_kim ? S.seps.melband_roformer_kim.backend : '';
    await load('scnet_small', onDl);
    var ri = await run('scnet_small', iL, iR, prog(0.65, 1, 'Divido la base in batteria, basso e resto'));
    // la voce rimasta nella base (residuo) va nel "resto": così batteria+basso+resto = base completa
    var res = split(ri.stems.vocals), oth = split(ri.stems.other);
    for (i = 0; i < n; i++) { oth.left[i] += res.left[i]; oth.right[i] += res.right[i]; }
    return { vocals: voc, drums: split(ri.stems.drums), bass: split(ri.stems.bass), other: oth, info: { mode: 'studio', backend: be } };
  }
  async function cached(model) {
    try { var U = await lib(); if (!U.MODEL_ARTIFACTS) return false; var a = U.MODEL_ARTIFACTS[model].fp16.url, keys = await caches.keys();
      for (var k = 0; k < keys.length; k++) { var c = await caches.open(keys[k]); if (await c.match(a)) return true; } } catch (e) {}
    return false;
  }
  return { MODELS: MODELS, SAMPLE_RATE: 44100, load: load, separate: separate, cached: cached, setBase: function (b) { S.base = b; } };
});
