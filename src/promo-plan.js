/*
 * Piano di promozione di una canzone (30 giorni), costruito dai dati del brano.
 *
 * Non usa servizi esterni e non pubblica nulla: produce un calendario di contenuti
 * con piattaforma, formato, data, orario suggerito, didascalia e hashtag.
 * Le didascalie sono costruite con le righe del TUO testo e frasi modello.
 * Gli orari sono ipotesi da confermare con le statistiche reali dei tuoi profili.
 * Gli hashtag sono suggerimenti di pertinenza, non garantiscono più visualizzazioni.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PromoPlan = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GENRE_TAGS = { pop: ['#pop', '#popitaliano'], hiphop: ['#hiphop', '#rapitaliano'], lofi: ['#lofi', '#chill'], dance: ['#dance', '#edm'] };
  var MOOD_TAGS = {
    amore: ['#amore', '#lovesong'], gioia: ['#felicita', '#goodvibes'], tristezza: ['#malinconia', '#sadsong'],
    rabbia: ['#rabbia', '#energia'], speranza: ['#speranza', '#motivazione'], nostalgia: ['#nostalgia', '#ricordi']
  };
  var BASE_TAGS = ['#musicaitaliana', '#nuovamusica', '#cantautore'];
  var PLATFORM_TAGS = { instagram: ['#reels', '#musicreels'], tiktok: ['#fyp', '#musictok'], youtube: ['#shorts', '#youtubeshorts'] };
  var MAX_TAGS = { instagram: 8, tiktok: 5, youtube: 4 };

  var TEMPLATE = [
    { day: 1, type: 'teaser', platform: 'tiktok', format: 'video verticale 9-15 s', time: '18:30', title: 'Primo teaser', what: 'Anteprima di 10 secondi della base con una riga del testo' },
    { day: 1, type: 'teaser', platform: 'instagram', format: 'Reel 9-15 s', time: '19:00', title: 'Primo teaser', what: 'Lo stesso teaser, con la copertina in apertura' },
    { day: 3, type: 'dietro-le-quinte', platform: 'instagram', format: 'Storia o Reel', time: '12:30', title: 'Dietro le quinte', what: 'Mentre scrivi o registri: mostra il testo e la voce' },
    { day: 5, type: 'estratto', platform: 'tiktok', format: 'video verticale 15-30 s', time: '18:30', title: 'Estratto del ritornello', what: 'Il ritornello con il testo in sovrimpressione' },
    { day: 5, type: 'estratto', platform: 'youtube', format: 'Short 15-30 s', time: '19:30', title: 'Estratto del ritornello', what: 'Stesso estratto per YouTube Shorts' },
    { day: 7, type: 'copertina', platform: 'instagram', format: 'Post immagine', time: '20:00', title: 'Svelamento copertina', what: 'La copertina del brano con data di uscita' },
    { day: 9, type: 'lyric-video', platform: 'instagram', format: 'Reel 20-30 s', time: '19:00', title: 'Video con il testo', what: 'Clip con le righe del testo a tempo' },
    { day: 9, type: 'lyric-video', platform: 'tiktok', format: 'video verticale 20-30 s', time: '19:00', title: 'Video con il testo', what: 'Clip con le righe del testo a tempo' },
    { day: 12, type: 'conto-alla-rovescia', platform: 'instagram', format: 'Storia', time: '20:00', title: 'Conto alla rovescia', what: 'Mancano due giorni: breve audio e promemoria' },
    { day: 14, type: 'uscita', platform: 'youtube', format: 'Short o video', time: '18:00', title: 'Videoclip ufficiale', what: 'Esce il brano: videoclip o clip animata completa' },
    { day: 14, type: 'uscita', platform: 'instagram', format: 'Reel + Storia', time: '18:30', title: 'Il brano è uscito', what: 'Annuncio con estratto e link' },
    { day: 14, type: 'uscita', platform: 'tiktok', format: 'video verticale', time: '19:00', title: 'Il brano è uscito', what: 'Annuncio con il ritornello' },
    { day: 17, type: 'alternativo', platform: 'tiktok', format: 'video verticale', time: '18:30', title: 'Versione alternativa', what: 'Altra base o versione lenta dello stesso brano' },
    { day: 19, type: 'frase', platform: 'instagram', format: 'Post immagine', time: '20:00', title: 'Frase del testo', what: 'Una riga del testo su immagine' },
    { day: 21, type: 'dietro-le-quinte', platform: 'youtube', format: 'Short', time: '19:00', title: 'Come è nata la canzone', what: 'La storia dietro al brano in 30 secondi' },
    { day: 23, type: 'sfida', platform: 'tiktok', format: 'video verticale', time: '18:30', title: 'Invito a cantare', what: 'Chiedi di cantare il ritornello e taggarti' },
    { day: 26, type: 'frase', platform: 'tiktok', format: 'video verticale', time: '19:00', title: 'Frase del testo', what: 'Altra riga con la voce' },
    { day: 28, type: 'ringraziamento', platform: 'instagram', format: 'Reel o Storia', time: '20:00', title: 'Grazie', what: 'Ringrazia chi ha ascoltato e mostra qualche reazione' },
    { day: 30, type: 'riepilogo', platform: 'youtube', format: 'Short', time: '19:00', title: 'Riepilogo del mese', what: 'Il meglio del mese e invito a seguirti' }
  ];

  function parseDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) { var n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); }
    return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  }
  function fmtDate(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }

  function cleanLines(lyrics) {
    return String(lyrics || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l && !/^\[.*\]$/.test(l); });
  }

  // Righe del ritornello: la strofa etichettata "Ritornello", altrimenti le prime righe.
  function pickLines(lyrics) {
    var m = /\[\s*ritornello[^\]]*\]\s*\n([\s\S]*?)(\n\s*\n|\[|$)/i.exec(String(lyrics || ''));
    var chorus = m ? cleanLines(m[1]) : [];
    var all = cleanLines(lyrics);
    return { chorus: chorus.length ? chorus : all.slice(0, 4), all: all };
  }

  function tagsFor(platform, genre, moods) {
    var list = [].concat(GENRE_TAGS[genre] || [], (moods || []).reduce(function (a, m) { return a.concat(MOOD_TAGS[m] || []); }, []), BASE_TAGS, PLATFORM_TAGS[platform] || []);
    var seen = {}, out = [];
    list.forEach(function (t) { if (!seen[t]) { seen[t] = 1; out.push(t); } });
    return out.slice(0, MAX_TAGS[platform] || 5);
  }

  function captionFor(item, ctx) {
    var L = ctx.lines, title = ctx.title, artist = ctx.artist ? ' di ' + ctx.artist : '';
    var line = function (i) { return L.chorus.length ? L.chorus[i % L.chorus.length] : ''; };
    var any = function (i) { return L.all.length ? L.all[i % L.all.length] : ''; };
    var q = function (s) { return s ? '«' + s + '»' : ''; };
    switch (item.type) {
      case 'teaser': return ('Sta per arrivare "' + title + '"' + artist + '. ' + q(line(0))).trim();
      case 'dietro-le-quinte': return item.day < 10 ? 'Dietro le quinte di "' + title + '". Ecco come prende forma. ' + q(any(1)) : 'La storia dietro "' + title + '": perché l\'ho scritta e cosa significa per me.';
      case 'estratto': return ('Il ritornello di "' + title + '". ' + q(line(1))).trim();
      case 'copertina': return 'Ecco la copertina di "' + title + '". Esce il ' + ctx.releaseLabel + '.';
      case 'lyric-video': return ('"' + title + '" con il testo. Canta con me: ' + q(line(2))).trim();
      case 'conto-alla-rovescia': return 'Tra due giorni esce "' + title + '". Salva il promemoria.';
      case 'uscita': return '"' + title + '" è fuori ora' + artist + '. ' + q(line(0)) + ' Ascoltala e dimmi cosa ne pensi.';
      case 'alternativo': return 'Un\'altra versione di "' + title + '". Quale preferisci, questa o l\'originale?';
      case 'frase': return q(any(item.day)) + ' — da "' + title + '".';
      case 'sfida': return 'Canta il ritornello di "' + title + '" e taggami: condivido i migliori. ' + q(line(3));
      case 'ringraziamento': return 'Grazie a chi ha ascoltato "' + title + '" in questo mese.';
      case 'riepilogo': return 'Un mese di "' + title + '". Se non l\'hai ancora ascoltata, è il momento.';
      default: return '"' + title + '"';
    }
  }

  /**
   * @param {{title?:string, artist?:string, lyrics?:string, genre?:string, moods?:string[], startDate?:string}} song  startDate = giorno 1 (AAAA-MM-GG); l'uscita è il giorno 14.
   * @returns {{startDate:string, releaseDate:string, items:object[]}}
   */
  function generate(song) {
    song = song || {};
    var start = parseDate(song.startDate), releaseMs = start + 13 * 86400000;
    var ctx = { title: (song.title || 'la nuova canzone').trim() || 'la nuova canzone', artist: (song.artist || '').trim(), lines: pickLines(song.lyrics), releaseLabel: '' };
    var rd = new Date(releaseMs);
    ctx.releaseLabel = rd.getUTCDate() + '/' + (rd.getUTCMonth() + 1);
    var items = TEMPLATE.map(function (t, i) {
      var it = { id: 'p' + (i + 1), day: t.day, date: fmtDate(start + (t.day - 1) * 86400000), time: t.time, platform: t.platform, type: t.type, title: t.title, format: t.format, what: t.what, status: 'da fare' };
      it.caption = captionFor(it, ctx);
      it.hashtags = tagsFor(t.platform, song.genre, song.moods);
      return it;
    });
    items.sort(function (a, b) { return a.day - b.day || (a.time < b.time ? -1 : 1); });
    return { startDate: fmtDate(start), releaseDate: fmtDate(releaseMs), items: items };
  }

  function csvCell(v) { var s = String(v == null ? '' : v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

  function toCsv(items) {
    var head = ['data', 'ora', 'piattaforma', 'formato', 'titolo', 'didascalia', 'hashtag', 'stato'];
    var rows = items.map(function (i) { return [i.date, i.time, i.platform, i.format, i.title, i.caption, i.hashtags.join(' '), i.status]; });
    return [head].concat(rows).map(function (r) { return r.map(csvCell).join(','); }).join('\n');
  }

  return { generate: generate, toCsv: toCsv, TEMPLATE: TEMPLATE };
});
