/*
 * Cartelle artista: impara lo STILE da testi che carichi tu, con SOLO statistiche.
 *
 * Di ogni testo si misurano numeri (sillabe per riga, rime, ripetizioni, ricchezza delle parole, quali "mondi" ricorrono
 * e quali stanno insieme nella stessa riga). Il testo NON viene conservato: restano solo i conteggi.
 * Servono a tre cose: 1) capire l'umore dell'artista, 2) confrontare i TUOI testi e dirti cosa cambiare,
 * 3) orientare lo stile della base (Cervello Sultan). Non copia versi e non imita voci.
 * Sono misure (Misurato) e interpretazioni (Ipotesi): non garantiscono il successo di nessuno.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./lyrics-engine.js'), require('./sultan-brain.js'));
  else root.ArtistLab = factory(root.LyricsEngine, root.SultanBrain);
})(typeof self !== 'undefined' ? self : this, function (LE, SB) {
  'use strict';

  var SCENE_IT = { strada: 'strada', soldi: 'soldi e successo', rabbia: 'rabbia', dolore: 'dolore e solitudine', amore: 'amore', festa: 'festa e notte', nostalgia: 'nostalgia', epico: 'sogni e grandezza' };
  var SKEYS = Object.keys(SB.LEX), SET = {};
  SKEYS.forEach(function (k) { SET[k] = {}; SB.LEX[k].forEach(function (w) { SET[k][w] = 1; }); });
  function r2(v) { return Math.round(v * 100) / 100; }

  function newAcc() { return { songs: 0, lines: 0, syll: 0, rhymed: 0, repLines: 0, words: 0, types: 0, wlen: 0, scenes: {}, pairs: {}, sceneLines: 0 }; }

  /** Misura un testo (stringa). Restituisce solo numeri. */
  function measure(text) {
    var an = LE.analyze(text), lines = [], m = newAcc();
    String(text || '').split('\n').forEach(function (l) { l = l.trim(); if (l && !/^\[.*\]$/.test(l)) lines.push(l); });
    if (!lines.length || !an || !an.counts) return m;
    var ws = SB.words(text), seen = {};
    ws.forEach(function (w) { seen[w] = 1; m.wlen += w.length; });
    m.songs = 1; m.lines = lines.length; m.syll = an.syllables.average * lines.length;
    var rl = 0; an.stanzas.forEach(function (s) { rl += s.rhymedLines || 0; });
    m.rhymed = rl; m.repLines = (an.repetitionShare || 0) * lines.length;
    m.words = ws.length; m.types = Object.keys(seen).length;
    lines.forEach(function (l) {
      var lw = SB.words(l), hit = [];
      SKEYS.forEach(function (k) { if (lw.some(function (w) { return SET[k][w]; })) hit.push(k); });
      if (hit.length) m.sceneLines++;
      hit.forEach(function (k) { m.scenes[k] = (m.scenes[k] || 0) + 1; });
      for (var i = 0; i < hit.length; i++) for (var j = i + 1; j < hit.length; j++) { var key = [hit[i], hit[j]].sort().join('+'); m.pairs[key] = (m.pairs[key] || 0) + 1; }
    });
    return m;
  }
  function merge(acc, m) {
    acc = acc || newAcc();
    ['songs', 'lines', 'syll', 'rhymed', 'repLines', 'words', 'types', 'wlen', 'sceneLines'].forEach(function (k) { acc[k] += m[k] || 0; });
    ['scenes', 'pairs'].forEach(function (g) { Object.keys(m[g] || {}).forEach(function (k) { acc[g][k] = (acc[g][k] || 0) + m[g][k]; }); });
    return acc;
  }
  function describe(P) {
    var sc = P.top.slice(0, 3).map(function (t) { return SCENE_IT[t.scene] + ' ' + Math.round(t.share * 100) + '%'; });
    var tone = P.top.length ? 'umore: ' + sc.join(', ') : 'poche parole riconosciute, serve più materiale';
    var gen = SB.NAMES[P.styleTop] || '';
    return tone + (gen ? ' → base che gli sta meglio: ' + gen + ', circa ' + P.bpm + ' BPM' : '');
  }
  /** Da somme a profilo leggibile. */
  function finalize(acc) {
    if (!acc || !acc.lines) return null;
    var P = { songs: acc.songs, lines: acc.lines, avgSyll: r2(acc.syll / acc.lines), rhyme: r2(acc.rhymed / acc.lines), rep: r2(acc.repLines / acc.lines), richness: acc.words ? r2(acc.types / acc.words) : 0, wordLen: acc.words ? r2(acc.wlen / acc.words) : 0 };
    var tot = 0; SKEYS.forEach(function (k) { tot += acc.scenes[k] || 0; });
    P.sceneShare = {}; SKEYS.forEach(function (k) { P.sceneShare[k] = tot ? r2((acc.scenes[k] || 0) / tot) : 0; });
    P.top = SKEYS.filter(function (k) { return P.sceneShare[k] > 0; }).sort(function (a, b) { return P.sceneShare[b] - P.sceneShare[a]; }).map(function (k) { return { scene: k, share: P.sceneShare[k] }; });
    P.coverage = r2(acc.sceneLines / acc.lines);
    P.pairs = Object.keys(acc.pairs).map(function (k) { return { pair: k, lines: acc.pairs[k], share: r2(acc.pairs[k] / Math.max(1, acc.sceneLines)) }; }).sort(function (a, b) { return b.lines - a.lines; }).slice(0, 5);
    P.styleScore = SB.styleScores(P.sceneShare, P.avgSyll, P.rep);
    P.styleTop = SB.GENRES.slice().sort(function (a, b) { return P.styleScore[b] - P.styleScore[a]; })[0];
    P.bpm = Math.round(SB.BASE_BPM[P.styleTop] + (P.avgSyll >= 12 ? -6 : (P.avgSyll <= 8 ? 5 : 0)));
    P.mood = describe(P);
    P.enough = acc.lines >= 20;
    return P;
  }
  /** Media pesata (per righe) di più profili: "il nostro stile" nato da più artisti. */
  function blend(list, names) {
    list = (list || []).filter(Boolean); if (!list.length) return null;
    var W = 0, out = { avgSyll: 0, rhyme: 0, rep: 0, richness: 0, wordLen: 0, sceneShare: {}, lines: 0, songs: 0 };
    SKEYS.forEach(function (k) { out.sceneShare[k] = 0; });
    list.forEach(function (p) { var w = Math.max(1, Math.sqrt(p.lines)); W += w; ['avgSyll', 'rhyme', 'rep', 'richness', 'wordLen'].forEach(function (k) { out[k] += p[k] * w; }); SKEYS.forEach(function (k) { out.sceneShare[k] += p.sceneShare[k] * w; }); out.lines += p.lines; out.songs += p.songs; });
    ['avgSyll', 'rhyme', 'rep', 'richness', 'wordLen'].forEach(function (k) { out[k] = r2(out[k] / W); });
    SKEYS.forEach(function (k) { out.sceneShare[k] = r2(out.sceneShare[k] / W); });
    out.top = SKEYS.filter(function (k) { return out.sceneShare[k] > 0; }).sort(function (a, b) { return out.sceneShare[b] - out.sceneShare[a]; }).map(function (k) { return { scene: k, share: out.sceneShare[k] }; });
    out.pairs = [];
    out.styleScore = SB.styleScores(out.sceneShare, out.avgSyll, out.rep);
    out.styleTop = SB.GENRES.slice().sort(function (a, b) { return out.styleScore[b] - out.styleScore[a]; })[0];
    out.bpm = Math.round(SB.BASE_BPM[out.styleTop] + (out.avgSyll >= 12 ? -6 : (out.avgSyll <= 8 ? 5 : 0)));
    out.mood = describe(out); out.names = (names || []).join(' + ');
    return out;
  }
  /** Confronta un tuo testo con un profilo e dice cosa cambiare (con numeri). */
  function compare(text, P) {
    var m = finalize(measure(text)), out = [];
    if (!m) return [{ tag: 'Misurato', text: 'Scrivi prima almeno qualche riga di testo.' }];
    if (!P) return [{ tag: 'Misurato', text: 'Scegli prima un modello artisti.' }];
    var d = m.avgSyll - P.avgSyll;
    out.push({ tag: 'Misurato', text: 'Sillabe per riga: tu ' + m.avgSyll + ', modello ' + P.avgSyll + '. ' + (Math.abs(d) < 1.2 ? 'Siete vicini.' : (d < 0 ? 'Le tue righe sono più corte: prova a riempire di più il metro o a rallentare la base.' : 'Le tue righe sono più lunghe: taglia parole o parla più veloce (base più rapida).')) });
    var dr = m.rhyme - P.rhyme;
    out.push({ tag: 'Misurato', text: 'Righe in rima: tu ' + Math.round(m.rhyme * 100) + '%, modello ' + Math.round(P.rhyme * 100) + '%. ' + (Math.abs(dr) < 0.12 ? 'In linea.' : (dr < 0 ? 'Aggiungi rime o assonanze a fine riga e a metà riga.' : 'Hai più rime del modello: puoi lasciare qualche riga libera per respirare.')) });
    var dp = m.rep - P.rep;
    out.push({ tag: 'Misurato', text: 'Ripetizioni: tu ' + Math.round(m.rep * 100) + '%, modello ' + Math.round(P.rep * 100) + '%. ' + (Math.abs(dp) < 0.1 ? 'Gancio simile.' : (dp < 0 ? 'Il modello ripete di più: rendi il ritornello più ripetibile (frase corta che torna).' : 'Ripeti più del modello: varia qualche riga per non annoiare.')) });
    var dw = m.richness - P.richness;
    out.push({ tag: 'Misurato', text: 'Varietà di parole: tu ' + Math.round(m.richness * 100) + '%, modello ' + Math.round(P.richness * 100) + '%.' + (dw < -0.1 ? ' Prova sinonimi e immagini nuove.' : '') });
    var gaps = SKEYS.map(function (k) { return { k: k, d: (P.sceneShare[k] || 0) - (m.sceneShare[k] || 0) }; }).sort(function (a, b) { return b.d - a.d; });
    if (gaps[0].d > 0.12) out.push({ tag: 'Ipotesi', text: 'Il modello parla molto di ' + SCENE_IT[gaps[0].k] + ' (' + Math.round((P.sceneShare[gaps[0].k] || 0) * 100) + '%), nel tuo testo poco (' + Math.round((m.sceneShare[gaps[0].k] || 0) * 100) + '%). Se vuoi quell\'umore, aggiungi immagini di quel mondo.' });
    var tm = m.top[0];
    if (tm) out.push({ tag: 'Misurato', text: 'Il tuo testo ora ha soprattutto: ' + SCENE_IT[tm.scene] + ' (' + Math.round(tm.share * 100) + '%).' });
    out.push({ tag: 'Ipotesi', text: 'Con questo modello la base che gli sta meglio è ' + SB.NAMES[P.styleTop] + ' a circa ' + P.bpm + ' BPM.' });
    return out;
  }

  return { measure: measure, merge: merge, finalize: finalize, blend: blend, compare: compare, newAcc: newAcc, SCENE_IT: SCENE_IT };
});
