// Scrive la sezione "Beat Lab" di notes/LICENZE-SUONI.md a partire da docs/samples/manifest.json (cosi' i crediti coincidono coi file).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), man = JSON.parse(fs.readFileSync(path.join(root, 'docs/samples/manifest.json'), 'utf8'));
const f = path.join(root, 'notes/LICENZE-SUONI.md'); let t = fs.readFileSync(f, 'utf8'); const mark = '\n## Beat Lab: strumenti e batterie (campioni CC0)\n';
if (t.includes(mark)) t = t.slice(0, t.indexOf(mark));
const kb = (n) => (n / 1024).toFixed(0) + ' KB';
let o = mark + `
Tutti i suoni elencati qui sotto sono distribuiti con licenza **CC0 1.0** (pubblico dominio: uso libero anche commerciale, nessuna attribuzione obbligatoria; i crediti sono scritti per correttezza). Controllo fatto sul file LICENSE di ogni repository (CC0 1.0 Universal in tutti e tre) e sui file di descrizione delle cartelle usate (Info.txt, Origin.txt, README). Nessun suono GPL/AGPL/CC-BY e' incluso.

Repository di origine:
- VSCO-2-CE (Versilian Studios, Sam Gossner e Simon Dalzell): ${man.sources['VSCO-2-CE'].url} - CC0-1.0
- VCSL (Versilian Community Sample Library): ${man.sources['VCSL'].url} - CC0-1.0
- stargate-sample-pack (cartella fugue-state-audio, Fugue State Audio, "completely free, public domain"): ${man.sources['stargate-sample-pack'].url} - CC0-1.0

Note di cartella da ricordare: il pianoforte e' il "Grand Piano, Steinway B" di VCSL; l'organo a canne e' di Simon Dalzell (Ivy Audio), ridistribuibile per concessione di Versilian Studios (Info.txt) e coperto da CC0 nel repository; il piano elettrico FM e la tastiera pizzicata sono patch TX81Z create dagli autori di VCSL e campionate dall'hardware (Origin.txt: credito consigliato).

Cosa e' stato fatto ai file (tools/beatlab-samples.py): un campione ogni 3-4 semitoni, convertito in mono 32 kHz e MP3 80 kbit/s (batterie: 44,1 kHz 96 kbit/s), silenzio iniziale tolto, accorciato, volume uniformato (-20 dBFS RMS), loop con dissolvenza incrociata per gli strumenti tenuti, altezza reale MISURATA con autocorrelazione (i nomi dei file usano ottave diverse: la misura decide). Le note dove la misura non era affidabile sono elencate nello script di conversione e assunte coerenti con il resto dello strumento (strumenti con suono campanato o note molto gravi: basso, campane, vibrafono, carillon).

| Strumento nel Beat Lab | Origine | Campioni | Peso |
|---|---|---|---|
`;
let tot = 0;
for (const [id, I] of Object.entries(man.instruments)) { const b = I.samples.reduce((a, s) => a + fs.statSync(path.join(root, 'docs/samples', s.f)).size, 0); tot += b; o += `| ${I.name} | ${I.source}: ${I.info} | ${I.samples.length} | ${kb(b)} |\n`; }
o += '\n| Kit di batteria | Origine | Suoni | Peso |\n|---|---|---|---|\n';
for (const [id, K] of Object.entries(man.kits)) { const b = Object.values(K.files).reduce((a, r) => a + fs.statSync(path.join(root, 'docs/samples', r)).size, 0); tot += b; o += `| ${K.name} | stargate-sample-pack / fugue-state-audio / drums / ${id} (sintetizzati) | ${Object.keys(K.files).join(', ')} | ${kb(b)} |\n`; }
o += `\nTotale docs/samples: ${(tot / 1048576).toFixed(2)} MB (limite che mi ero dato: circa 40 MB).\n\nNon sono presenti in questi pacchetti: una vera chitarra e un coro cantato. La "Chitarra" e il "Coro" del Beat Lab sono sintetizzatori calcolati dal programma (non campioni); lo Strumstick e' il piu' vicino alla chitarra tra i campioni liberi trovati.\n\nSe aggiungi altri suoni: controlla la licenza di OGNI cartella prima di copiarli (nel pacchetto stargate le cartelle karoryfer e microlag non sono state usate perche' la loro licenza non e' scritta nella cartella stessa).\n`;
fs.writeFileSync(f, t.replace(/\s*$/, '\n') + o); console.log('crediti scritti, totale', (tot / 1048576).toFixed(2), 'MB');
