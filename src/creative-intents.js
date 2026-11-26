/*
 * Intenzioni creative: «più aggressiva», «più malinconica», «più potente», «più commerciale», «più dolce»,
 * «più energica», «più cupa». Ogni intenzione è una RICETTA DA PRODUTTORE: più scelte musicali insieme
 * (scala, giro di accordi, velocità, batteria, 808, mix, master, struttura), ognuna con il suo «perché».
 * Le scelte che hai annullato più volte (memoria delle decisioni) vengono saltate e lo dice.
 *   match(testo) → id intenzione o null
 *   apply(id, prod, ctx) → {nome, fatti:[{k, txt, why}], saltati:[txt]}   (modifica prod)
 *   ctx = {plan, sections:[{name,startBar}], styleBpm, refused:{chiave: volte}}
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CreativeIntents = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function mixOf(p, lane) { p.mix = p.mix || {}; return (p.mix[lane] = Object.assign({ low: 0, mid: 0, midHz: 1200, high: 0, comp: 0, sat: 0, pan: 0, rev: 0, dly: 0, duck: 0 }, p.mix[lane] || {})); }
  function lv(p, k, d) { p.levels = p.levels || {}; var v = p.levels[k] == null ? 1 : p.levels[k]; p.levels[k] = Math.max(0, Math.min(2, Math.round((v + d) * 100) / 100)); return Math.round(p.levels[k] * 100); }
  function cl(v, a, b) { return Math.max(a, Math.min(b, Math.round(v * 100) / 100)); }
  function b808(p) { p.b808 = Object.assign({ decay: 1.2, punch: 0.6, drive: 0.5, tone: 0.6, click: 0.3 }, p.b808 || {}); p.bassStyle = '808'; return p.b808; }
  function pickProg(p, list) { var c = JSON.stringify(p.prog || []), ok = list.filter(function (x) { return JSON.stringify(x) !== c; }); return ok[((p.seed || 1) + (p.melSeed || 0)) % ok.length] || list[0]; }
  function deg(pr) { var R = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']; return pr.map(function (d) { return R[d]; }).join('-'); }
  var I = {
    aggressiva: { nome: 'Più aggressiva', re: /aggressiv|cattiv|violent|più dur[ao]|più rabbios|incazzat|minaccios/, steps: [
      ['808drive', function (p) { var b = b808(p); b.drive = cl(b.drive + 0.25, 0, 1); b.punch = cl(b.punch + 0.2, 0, 1); return '808 più sporco e con più colpo'; }, 'la distorsione aggiunge armoniche: l\'808 si sente anche sulle casse piccole e suona minaccioso'],
      ['kit', function (p) { if (p.kit === 'drill') return null; p.kit = 'drill'; return 'batteria drill (colpi secchi)'; }, 'rullante e hi-hat più duri e corti tagliano il mix'],
      ['drumsat', function (p) { var m = mixOf(p, 'drums'); m.sat = cl(m.sat + 0.25, 0, 1); m.high = cl(m.high + 2, -12, 12); return 'batteria saturata e più brillante'; }, 'saturazione = transienti più aggressivi, alti = più presenza'],
      ['minore', function (p) { if (p.mode === 'minore') return null; p.mode = 'minore'; return 'scala minore'; }, 'la scala minore porta tensione'],
      ['bpm', function (p) { if (p.bpm >= 150) return null; p.bpm = Math.min(160, p.bpm + 6); return 'velocità ' + p.bpm + ' BPM'; }, 'un po\' più veloce = più urgenza'],
      ['heavy', function (p) { if (p.heavy) return null; p.heavy = true; return 'arrangiamento pesante'; }, 'più colpi e più basso nelle parti forti']] },
    malinconica: { nome: 'Più malinconica', re: /malinconic|malinconia|nostalgic|più trist|struggent|commovent|emozionant/, steps: [
      ['minore', function (p) { if (p.mode === 'minore') return null; p.mode = 'minore'; return 'scala minore'; }, 'il minore è il colore della tristezza nella musica occidentale'],
      ['prog', function (p) { var pr = pickProg(p, p.mode === 'minore' ? [[0, 5, 2, 6], [0, 3, 6, 5], [5, 6, 0, 0], [0, 5, 3, 4]] : [[5, 3, 0, 4], [0, 4, 5, 3]]); p.prog = pr.slice(); p.chordBars = null; return 'giro ' + deg(pr); }, 'giri che passano dal VI grado sospendono e «non risolvono»: suonano nostalgici'],
      ['bpm', function (p) { if (p.bpm <= 70) return null; p.bpm = Math.max(60, p.bpm - 8); return 'più lenta: ' + p.bpm + ' BPM'; }, 'più spazio tra le note = più respiro e malinconia'],
      ['pad', function (p) { return 'atmosfera al ' + lv(p, 'pad', 0.2) + '%'; }, 'gli archi/pad lunghi creano il «letto» emotivo'],
      ['drumsdown', function (p) { return 'batteria al ' + lv(p, 'batteria', -0.15) + '%'; }, 'meno batteria lascia più spazio alla voce e all\'armonia'],
      ['leadrev', function (p) { var m = mixOf(p, 'lead'); m.rev = cl(m.rev + 0.2, 0, 1); return 'melodia con più riverbero'; }, 'il riverbero allontana la melodia: suona come un ricordo'],
      ['piano', function (p) { p.inst = Object.assign({}, p.inst || {}); if (p.inst.melodia === 'piano') return null; p.inst.melodia = 'piano'; return 'melodia al pianoforte'; }, 'il pianoforte è lo strumento più usato nelle ballate tristi']] },
    potente: { nome: 'Più potente', re: /potent|potenza|epic[ao]|grandios|esplosiv|più grand|più pien[ao]|più impatto/, steps: [
      ['drumsup', function (p) { return 'batteria al ' + lv(p, 'batteria', 0.15) + '%'; }, 'la batteria è il motore dell\'energia'],
      ['bassup', function (p) { var v = lv(p, 'basso', 0.15), m = mixOf(p, 'bass'); m.low = cl(m.low + 2, -12, 12); return '808/basso al ' + v + '% con più sub'; }, 'il sub-basso si sente nel petto: dà potenza fisica'],
      ['chorusfull', function (p) { p.secMix = Object.assign({}, p.secMix || {}); p.secMix.ritornello = Object.assign({}, p.secMix.ritornello || {}, { pad: 1, chords: 0.85, arp: 0.9 }); return 'ritornello più pieno (pad, accordi, arpeggio)'; }, 'il ritornello deve essere la parte più densa: contrasto con la strofa'],
      ['impact', function (p, c) { var r = (c.sections || []).filter(function (s) { return s.name === 'ritornello'; }); if (!r.length) return null; var have = (p.fxList || []).filter(function (f) { return f.type === 'impact'; }).length; if (have) return null; p.fxList = (p.fxList || []).concat(r.map(function (s) { return { type: 'impact', bar: s.startBar }; })); return 'impatto all\'inizio di ' + r.length + ' ritornell' + (r.length > 1 ? 'i' : 'o'); }, 'un colpo forte sull\'entrata del ritornello segna il cambio di energia'],
      ['master', function (p) { p.mpro = Object.assign({ target: 'forte', width: 1.1, sat: 0.25, comp: 0.35, match: false }, p.mpro || {}); p.mpro.target = 'forte'; p.mpro.width = cl(Math.max(p.mpro.width, 1.35), 0, 2); return 'master forte e più largo'; }, 'volume finale più alto e stereo più ampio = suono più grande']] },
    commerciale: { nome: 'Più commerciale', re: /commercial|radiofonic|orecchiabil|da classifica|mainstream|più pop\b|hit|tormentone/, steps: [
      ['prog', function (p) { var pr = pickProg(p, p.mode === 'minore' ? [[0, 5, 2, 6], [0, 5, 3, 4]] : [[0, 4, 5, 3], [5, 3, 0, 4]]); p.prog = pr.slice(); p.chordBars = null; return 'giro ' + deg(pr); }, 'sono i giri più usati nelle hit: l\'orecchio li riconosce subito'],
      ['hook', function (p) { return 'melodia (gancio) al ' + lv(p, 'melodia', 0.15) + '%'; }, 'il gancio melodico deve sentirsi chiaro'],
      ['intro', function (p, c) { var pl = c.plan || []; if (!pl.length || pl[0][0] !== 'intro' || pl[0][1] <= 1) return null; p.form = (p.form || []).concat([{ op: 'bars', i: 0, bars: 1 }]); return 'intro corta (1 battuta)'; }, 'nelle hit la voce entra presto: chi ascolta non salta il brano'],
      ['bpm', function (p, c) { var t = c.styleBpm; if (!t || Math.abs(p.bpm - t) <= 4) return null; p.bpm = Math.round((p.bpm + t * 2) / 3); return 'velocità ' + p.bpm + ' BPM (tipica del genere)'; }, 'il tempo tipico del genere è quello che il pubblico si aspetta'],
      ['voice', function (p) { var m = mixOf(p, 'voice'); m.comp = cl(m.comp + 0.2, 0, 1); m.high = cl(m.high + 2, -12, 12); return 'voce compressa e brillante'; }, 'nelle produzioni commerciali la voce è sempre davanti e chiara'],
      ['master', function (p) { p.mpro = Object.assign({ target: 'forte', width: 1.1, sat: 0.25, comp: 0.35, match: false }, p.mpro || {}); p.mpro.target = 'streaming'; return 'master per Spotify/streaming'; }, 'volume giusto per le piattaforme (niente schiacciamento)']] },
    dolce: { nome: 'Più dolce', re: /più dolc|rilassat|morbid|tranquill|chill|soft|delicat/, steps: [
      ['bpm', function (p) { if (p.bpm <= 70) return null; p.bpm = Math.max(60, p.bpm - 6); return 'più lenta: ' + p.bpm + ' BPM'; }, 'meno fretta = più calma'],
      ['kit', function (p) { if (p.kit === 'lofi') return null; p.kit = 'lofi'; return 'batteria lo-fi morbida'; }, 'colpi smussati e meno aggressivi'],
      ['drumsoft', function (p) { var m = mixOf(p, 'drums'); m.sat = cl(m.sat - 0.2, 0, 1); m.high = cl(m.high - 2, -12, 12); return 'batteria più scura e pulita (' + lv(p, 'batteria', -0.2) + '%)'; }, 'meno alti e meno distorsione = suono gentile'],
      ['pad', function (p) { return 'atmosfera al ' + lv(p, 'pad', 0.15) + '%'; }, 'suoni lunghi e morbidi avvolgono'],
      ['leadrev', function (p) { var m = mixOf(p, 'lead'); m.rev = cl(m.rev + 0.15, 0, 1); return 'melodia con più riverbero'; }, 'spazio e morbidezza']] },
    energica: { nome: 'Più energica', re: /energic|più carica|movimentat|ballabil|più ritm|più vivac|più spinta/, steps: [
      ['bpm', function (p) { if (p.bpm >= 160) return null; p.bpm = Math.min(165, p.bpm + 8); return 'più veloce: ' + p.bpm + ' BPM'; }, 'più battiti al minuto = più energia'],
      ['duck', function (p) { var m = mixOf(p, 'bass'); m.duck = cl(m.duck + 0.25, 0, 1); var a = mixOf(p, 'pad'); a.duck = cl(a.duck + 0.25, 0, 1); return 'sidechain su 808 e pad (effetto «pompa»)'; }, 'il suono che respira con la cassa fa muovere'],
      ['drumsup', function (p) { return 'batteria al ' + lv(p, 'batteria', 0.1) + '%'; }, 'il ritmo davanti'],
      ['straight', function (p) { if (!p.groove || !p.groove.swing) return null; p.groove = Object.assign({}, p.groove, { swing: 0 }); return 'ritmo dritto (niente swing)'; }, 'il ritmo dritto spinge di più']] },
    cupa: { nome: 'Più cupa', re: /cup[ao]|più scur[ao]|dark|tenebros|inquietant|oscur/, steps: [
      ['minore', function (p) { if (p.mode === 'minore') return null; p.mode = 'minore'; return 'scala minore'; }, 'il minore scurisce subito'],
      ['low', function (p) { p.tonic = ((p.tonic || 0) + 10) % 12; return 'tonalità più bassa di un tono'; }, 'note più basse = colore più scuro'],
      ['dark', function (p) { mixOf(p, 'chords').high = cl(mixOf(p, 'chords').high - 3, -12, 12); mixOf(p, 'lead').high = cl(mixOf(p, 'lead').high - 2, -12, 12); return 'accordi e melodia meno brillanti'; }, 'togliere gli alti rende il suono chiuso e misterioso'],
      ['pad', function (p) { return 'atmosfera al ' + lv(p, 'pad', 0.1) + '%'; }, 'un tappeto scuro sotto tutto']] }
  };
  function match(t) { t = ' ' + String(t || '').toLowerCase() + ' '; for (var k in I) if (I[k].re.test(t)) return k; return null; }
  function apply(id, p, ctx) {
    var it = I[id]; if (!it) return null; ctx = ctx || {}; var ref = ctx.refused || {}, fatti = [], saltati = [];
    it.steps.forEach(function (s) {
      if ((ref[id + ':' + s[0]] || 0) >= 2) { saltati.push(s[0]); return; }
      var r = s[1](p, ctx); if (r) fatti.push({ k: id + ':' + s[0], txt: r, why: s[2] });
    });
    return { nome: it.nome, fatti: fatti, saltati: saltati };
  }
  return { match: match, apply: apply, LIST: Object.keys(I).map(function (k) { return { id: k, nome: I[k].nome }; }) };
});
