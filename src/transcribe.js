/*
 * Trascrizione delle parole cantate: Whisper (OpenAI, licenza MIT) eseguito sul dispositivo con
 * transformers.js (Hugging Face, Apache-2.0). Gratis, niente server: il modello si scarica una volta.
 * Serve per STUDIARE il metodo dei testi (righe, sillabe, rime, ritornello): l'app salva le misure, non le parole.
 * Modelli: 'onnx-community/whisper-base' (~ 120 MB, telefono) · 'onnx-community/whisper-small' (~ 300 MB, computer: più preciso).
 * Limiti onesti: sul rap veloce e con voce sporca sbaglia parole; con la voce separata funziona meglio che sul brano intero.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Transcribe = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var G = typeof self !== 'undefined' ? self : globalThis;
  var S = { lib: null, asr: {}, base: './' };
  var MODELS = { base: { id: 'onnx-community/whisper-base', nome: 'Whisper base (telefono)', mb: 120 }, small: { id: 'onnx-community/whisper-small', nome: 'Whisper small (computer, più preciso)', mb: 300 } };
  function dir(sub) { return new URL(S.base + sub, location.href).href; }
  async function load(size, onProgress) {
    size = MODELS[size] ? size : 'base';
    if (S.asr[size]) return S.asr[size];
    // la libreria si carica dalla CDN pubblica di npm (versione fissa): non è nel repository perché GitHub la scambia per una chiave segreta
    if (!S.lib) S.lib = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js');
    var T = S.lib; T.env.allowLocalModels = false;
    T.env.backends.onnx.wasm.wasmPaths = dir('tf/');
    T.env.backends.onnx.wasm.numThreads = G.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
    var gpu = false; try { gpu = !!(navigator.gpu && await navigator.gpu.requestAdapter()); } catch (e) {}
    var files = {};
    var asr = await T.pipeline('automatic-speech-recognition', MODELS[size].id, {
      device: gpu ? 'webgpu' : 'wasm', dtype: gpu ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
      progress_callback: function (p) { if (p && p.status === 'progress' && p.file) { files[p.file] = [p.loaded || 0, p.total || 0]; var a = 0, b = 0; for (var k in files) { a += files[k][0]; b += files[k][1]; } if (onProgress) onProgress(a, b); } }
    });
    S.asr[size] = asr; return asr;
  }
  /** x: Float32Array mono, sr. Ritorna {text, lines:[{t0, t1, text}]}. */
  async function run(x, sr, opt) {
    opt = opt || {};
    var asr = await load(opt.size, opt.onProgress), n = Math.floor(x.length * 16000 / sr), y = new Float32Array(n), r = sr / 16000;
    for (var i = 0; i < n; i++) { var p = i * r, k = Math.floor(p), f = p - k; y[i] = (x[k] || 0) * (1 - f) + (x[k + 1] || 0) * f; }
    var out = await asr(y, { language: opt.language || 'italian', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
    var lines = (out.chunks || []).map(function (c) { return { t0: c.timestamp[0], t1: c.timestamp[1], text: String(c.text || '').trim() }; }).filter(function (l) { return l.text; });
    return { text: String(out.text || '').trim(), lines: lines };
  }
  return { MODELS: MODELS, load: load, run: run, setBase: function (b) { S.base = b; } };
});
