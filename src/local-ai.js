/*
 * Assistente testi con AI locale (opzionale). Usa WebLLM (Apache 2.0) con modelli Qwen2.5 (Apache 2.0):
 * il modello si scarica UNA volta sul telefono e gira lì (WebGPU). Nessun testo parte verso server.
 * Il cervello Sultan (regole + misure) resta il maestro: l'AI scrive solo bozze di righe, guidate da genere, umore,
 * rime del dizionario personale e modello artisti (solo numeri). Mai testi di altri: si chiede sempre parole nuove.
 * Qui c'è la parte testabile (prompt e pulizia). Il caricamento vero richiede WebGPU: non verificabile fuori dal telefono.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LocalAI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var LIB_URL = 'https://esm.run/@mlc-ai/web-llm@0.2.79';
  var MODELS = [
    { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Leggero (circa 300 MB)', note: 'Veloce, italiano così così' },
    { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Più forte (circa 1 GB)', note: 'Italiano migliore, pesa e scalda di più' },
    { id: 'Qwen3-1.7B-q4f16_1-MLC', label: 'Nuovo Qwen3 (circa 1,2 GB)', note: 'Apache 2.0, 100+ lingue; NON ancora provato sul telefono' },
    { id: 'Qwen3-0.6B-q4f16_1-MLC', label: 'Nuovo Qwen3 piccolo (circa 450 MB)', note: 'Apache 2.0; NON ancora provato sul telefono' }
  ];
  var TASKS = {
    versioni: 'Riscrivi la riga in 3 versioni diverse, con lo stesso numero di sillabe (circa {syll}) e lo stesso significato, parole nuove.',
    punchline: 'Scrivi 3 punchline (frase a effetto, doppio senso o immagine forte) che possano chiudere questa riga o seguirla. Massimo {syll} sillabe ciascuna.',
    continua: 'Scrivi 3 possibili righe successive (circa {syll} sillabe) che portino avanti la storia e finiscano con una di queste rime: {rime}.',
    migliora: 'Migliora la riga in 3 modi: immagine più forte e concreta, niente parole generiche, stesse sillabe (circa {syll}) e, se puoi, stessa rima finale.',
    ritornello: 'Scrivi UN ritornello di 4 righe corte (massimo {syll} sillabe ciascuna), orecchiabile, con una frase gancio che torna due volte. Parti dai temi e dalle parole delle strofe qui sopra, senza ripeterle uguali.'
  };
  var MAXTOK = { versioni: 90, punchline: 90, migliora: 90, continua: 110, ritornello: 150 };
  /* Quale modello Ollama consigliare in base alla RAM del computer (stime da guide 2026: RAM totale meno 3-4 GB per il sistema; Ipotesi) */
  function recommend(ramGb) {
    ramGb = +ramGb || 8;
    if (ramGb <= 8) return { model: 'qwen2.5:3b', note: 'Con 8 GB stai stretto: modelli piccoli (3B). Il 7B parte ma rallenta.' };
    if (ramGb <= 16) return { model: 'qwen2.5:7b', note: 'Con 16 GB il 7B va bene (italiano buono).' };
    if (ramGb <= 24) return { model: 'qwen2.5:14b', note: 'Con 24 GB va il 14B (italiano molto migliore).' };
    return { model: 'qwen2.5:32b', note: 'Con 32 GB o più va anche il 32B (il migliore).' };
  }
  function supported() { return typeof navigator !== 'undefined' && !!navigator.gpu; }

  function buildPrompt(task, c) {
    c = c || {};
    var t = (TASKS[task] || TASKS.versioni).replace('{syll}', c.syll || 10).replace('{rime}', (c.rhymes && c.rhymes.length ? c.rhymes.slice(0, 8).join(', ') : 'quelle che vuoi'));
    var sys = 'Sei Sultan, un autore di testi rap e trap italiani. Scrivi in italiano, in gergo di strada credibile, senza copiare canzoni esistenti. ' +
      'Genere: ' + (c.genre || 'trap') + '. Umore: ' + (c.mood || 'dark') + '. ' + (c.artistNote ? 'Stile misurato: ' + c.artistNote + '. ' : '') +
      'Rispondi SOLO con 3 righe, una per riga, senza numeri, senza spiegazioni, senza virgolette.';
    if (task === 'ritornello') sys = sys.replace('Rispondi SOLO con 3 righe, una per riga', 'Rispondi SOLO con 4 righe, una per riga');
    if (c.taste) sys += ' Gusti dell\'utente (misurati dai suoi voti): ' + c.taste + '.';
    if (c.scenes) sys += ' Temi del testo: ' + c.scenes + '.';
    var user = (c.context ? 'Testo finora:\n' + c.context + '\n\n' : '') + (c.line ? 'Riga: «' + c.line + '»\n' : '') + t;
    if (/^qwen3/i.test(c.model || '')) user += ' /no_think'; /* Qwen3 ragiona a voce alta: così risponde subito */
    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
  }
  /* Toglie numeri, elenchi, virgolette, righe vuote o in altre lingue evidenti; tiene al massimo 3 righe. */
  function clean(text, line, max) {
    var out = [], seen = {};
    text = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<\/?think>/gi, '');
    String(text || '').split(/\r?\n/).forEach(function (l) {
      l = l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^["«»“”']+|["«»“”']+$/g, '').trim();
      if (l.length < 6 || l.length > 140) return;
      if (/^(ecco|certo|sure|here|riga|versione)/i.test(l)) return;
      if (/[一-鿿぀-ヿЀ-ӿ]/.test(l)) return; // cinese/giapponese/cirillico: i modelli piccoli ogni tanto escono di lingua
      var k = l.toLowerCase(); if (seen[k] || (line && k === String(line).toLowerCase().trim())) return;
      seen[k] = 1; out.push(l);
    });
    return out.slice(0, max || 3);
  }
  function finish(task, text, line) { if (task === 'ritornello') { var r = clean(text, line, 4); return r.length >= 2 ? [r.join('\n')] : []; } return clean(text, line, 3); }
  /* Ollama (gratuito, sul tuo computer, http://localhost:11434): modelli più grandi = italiano migliore. Nessuna chiave. */
  var OLLAMA = 'http://localhost:11434', ollamaModel = null;
  async function pingOllama(url) {
    try { var r = await fetch((url || OLLAMA) + '/api/tags'); if (!r.ok) return null; var j = await r.json(), names = (j.models || []).map(function (m) { return m.name; });
      var best = null; ['qwen2\\.5', 'qwen3', 'gemma', 'llama3', 'mistral'].some(function (k) { var f = names.filter(function (n) { return new RegExp(k, 'i').test(n); }); if (f.length) { best = f[0]; return true; } return false; }); return { models: names, best: best || names[0] || null }; } catch (e) { return null; }
  }
  async function useOllama(model) { var p = await pingOllama(); if (!p || !p.models.length) throw new Error('Ollama non risponde su questo computer (serve avviarlo con OLLAMA_ORIGINS impostato al sito) o non ha modelli.'); ollamaModel = model || p.best; return ollamaModel; }
  var engine = null, loadedId = null;
  async function load(modelId, onProgress) {
    if (!supported()) throw new Error('Questo telefono/browser non ha WebGPU: l\'assistente AI non può partire. Il cervello Sultan resta attivo.');
    if (engine && loadedId === modelId) return engine;
    var mod = await import(LIB_URL);
    engine = await mod.CreateMLCEngine(modelId, { initProgressCallback: function (p) { if (onProgress) onProgress(p); } });
    loadedId = modelId; return engine;
  }
  async function ask(task, ctx) {
    if (ollamaModel) {
      var rr = await fetch(OLLAMA + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: ollamaModel, stream: false, messages: buildPrompt(task, Object.assign({}, ctx, { model: ollamaModel })), options: { temperature: 0.9, top_p: 0.92, num_predict: (MAXTOK[task] || 120) + 60 } }) });
      if (!rr.ok) throw new Error('Ollama ha risposto ' + rr.status); var jj = await rr.json(); return finish(task, jj.message && jj.message.content, ctx && ctx.line);
    }
    if (!engine) throw new Error('Assistente non attivo');
    var r = await engine.chat.completions.create({ messages: buildPrompt(task, Object.assign({}, ctx, { model: loadedId })), temperature: 0.85, top_p: 0.9, max_tokens: MAXTOK[task] || 100 });
    return finish(task, r.choices[0].message.content, ctx && ctx.line);
  }
  return { recommend: recommend, pingOllama: pingOllama, useOllama: useOllama, MODELS: MODELS, TASKS: TASKS, supported: supported, buildPrompt: buildPrompt, clean: clean, load: load, ask: ask, LIB_URL: LIB_URL };
});
