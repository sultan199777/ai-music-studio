# Suoni di batteria (campioni)
Cassa, rullante, clap e hi-hat vengono dal pacchetto "stargate-sample-pack" (https://github.com/stargatedaw/stargate-sample-pack), licenza CC0 1.0 (pubblico dominio, uso libero anche commerciale, nessuna attribuzione obbligatoria).
- Casse e hi-hat: cartella `stargate` (sintetizzati dal team Stargate DAW).
- Rulli e clap: cartella `freesound` (README: tutti CC0; autori nei nomi file: yellowtree, alexthegr81, sami-kullstrom, toxicfilmzsrsounds, bastianpusch).
Convertiti in mono 22,05 kHz, accorciati e normalizzati (src/samples-data.js).

## Beat Lab: strumenti e batterie (campioni CC0)

Tutti i suoni elencati qui sotto sono distribuiti con licenza **CC0 1.0** (pubblico dominio: uso libero anche commerciale, nessuna attribuzione obbligatoria; i crediti sono scritti per correttezza). Controllo fatto sul file LICENSE di ogni repository (CC0 1.0 Universal in tutti e tre) e sui file di descrizione delle cartelle usate (Info.txt, Origin.txt, README). Nessun suono GPL/AGPL/CC-BY e' incluso.

Repository di origine:
- VSCO-2-CE (Versilian Studios, Sam Gossner e Simon Dalzell): https://github.com/sgossner/VSCO-2-CE - CC0-1.0
- VCSL (Versilian Community Sample Library): https://github.com/sgossner/VCSL - CC0-1.0
- stargate-sample-pack (cartella fugue-state-audio, Fugue State Audio, "completely free, public domain"): https://github.com/stargatedaw/stargate-sample-pack - CC0-1.0

Note di cartella da ricordare: il pianoforte e' il "Grand Piano, Steinway B" di VCSL; l'organo a canne e' di Simon Dalzell (Ivy Audio), ridistribuibile per concessione di Versilian Studios (Info.txt) e coperto da CC0 nel repository; il piano elettrico FM e la tastiera pizzicata sono patch TX81Z create dagli autori di VCSL e campionate dall'hardware (Origin.txt: credito consigliato).

Cosa e' stato fatto ai file (tools/beatlab-samples.py): un campione ogni 3-4 semitoni, convertito in mono 32 kHz e MP3 80 kbit/s (batterie: 44,1 kHz 96 kbit/s), silenzio iniziale tolto, accorciato, volume uniformato (-20 dBFS RMS), loop con dissolvenza incrociata per gli strumenti tenuti, altezza reale MISURATA con autocorrelazione (i nomi dei file usano ottave diverse: la misura decide). Le note dove la misura non era affidabile sono elencate nello script di conversione e assunte coerenti con il resto dello strumento (strumenti con suono campanato o note molto gravi: basso, campane, vibrafono, carillon).

| Strumento nel Beat Lab | Origine | Campioni | Peso |
|---|---|---|---|
| Pianoforte | VCSL: Pianoforte a coda Steinway B (VCSL), senza pedale, forza media | 22 | 820 KB |
| Piano elettrico (FM) | VCSL: Sintetizzatore FM Yamaha TX81Z campionato (VCSL): suono tipo Rhodes/DX7 | 22 | 692 KB |
| Clavisynth (tastiera pizzicata) | VCSL: TX81Z Clavisynth (VCSL) | 19 | 368 KB |
| Organo a canne | VCSL: Organo a canne (VCSL), registro piano | 21 | 850 KB |
| Arpa | VCSL: Arpa da concerto (VCSL) | 22 | 740 KB |
| Strumstick (simile a chitarra) | VCSL: Strumstick a 3 corde pizzicata con le dita (VCSL). Non e' una chitarra: e' lo strumento a corde pizzicate piu' vicino presente nei pacchetti CC0 | 10 | 267 KB |
| Basso (contrabbasso pizzicato) | VSCO-2-CE: Contrabbasso solista pizzicato (VSCO 2 CE) | 10 | 222 KB |
| Archi (violini sezione) | VSCO-2-CE: Sezione di violini, tenuto con vibrato (VSCO 2 CE) | 10 | 426 KB |
| Archi gravi (violoncelli sezione) | VSCO-2-CE: Sezione di violoncelli, tenuto con vibrato (VSCO 2 CE) | 13 | 554 KB |
| Ottoni: corno francese | VSCO-2-CE: Corno francese tenuto (VSCO 2 CE) | 11 | 403 KB |
| Ottoni: tromba | VSCO-2-CE: Tromba tenuta (VSCO 2 CE) | 10 | 327 KB |
| Ottoni: trombone | VSCO-2-CE: Trombone tenore tenuto (VSCO 2 CE) | 9 | 329 KB |
| Fiati: flauto | VSCO-2-CE: Flauto traverso tenuto con vibrato (VSCO 2 CE) | 10 | 348 KB |
| Fiati: clarinetto | VSCO-2-CE: Clarinetto tenuto (VSCO 2 CE) | 11 | 403 KB |
| Vibrafono | VCSL: Vibrafono, mazze morbide (VCSL) | 11 | 387 KB |
| Marimba | VCSL: Marimba (VCSL) | 10 | 214 KB |
| Campane tubolari | VCSL: Campane tubolari (VCSL): buone per atmosfere cupe e cinematografiche | 5 | 223 KB |
| Carillon (glockenspiel) | VCSL: Glockenspiel (VCSL) | 6 | 178 KB |
| Campanelle a mano | VCSL: Hand chimes (VCSL) | 10 | 352 KB |
| 808 (campione intonato) | stargate-sample-pack: Sub bass di una cassa sintetica (Fugue State Audio, stargate-sample-pack) intonato con la velocita' di lettura | 1 | 16 KB |

| Kit di batteria | Origine | Suoni | Peso |
|---|---|---|---|
| Kit Synth (pulito) | stargate-sample-pack / fugue-state-audio / drums / synthkit (sintetizzati) | kick, snare, clap, hat, ohat, perc | 35 KB |
| Kit Distorto | stargate-sample-pack / fugue-state-audio / drums / distkit (sintetizzati) | kick, snare, clap, hat, ohat, perc | 36 KB |
| Kit Pesante (SDB) | stargate-sample-pack / fugue-state-audio / drums / sdbkit (sintetizzati) | kick, snare, clap, hat, ohat, perc | 31 KB |
| Kit Analogico 1 | stargate-sample-pack / fugue-state-audio / drums / x0xproc1 (sintetizzati) | kick, snare, clap, hat, ohat, perc | 35 KB |
| Kit Analogico 2 | stargate-sample-pack / fugue-state-audio / drums / x0xproc2 (sintetizzati) | kick, snare, clap, hat, ohat, perc | 39 KB |

Totale docs/samples: 8.10 MB (limite che mi ero dato: circa 40 MB).

Non sono presenti in questi pacchetti: una vera chitarra e un coro cantato. La "Chitarra" e il "Coro" del Beat Lab sono sintetizzatori calcolati dal programma (non campioni); lo Strumstick e' il piu' vicino alla chitarra tra i campioni liberi trovati.

Se aggiungi altri suoni: controlla la licenza di OGNI cartella prima di copiarli (nel pacchetto stargate le cartelle karoryfer e microlag non sono state usate perche' la loro licenza non e' scritta nella cartella stessa).
# Strumenti melodici (campioni)
29 strumenti da VSCO 2 Community Edition (https://github.com/sgossner/VSCO-2-CE) e VCSL (https://github.com/sgossner/VCSL) di Versilian Studios, licenza CC0 1.0. Note scelte ogni 3-6 semitoni, mono 22 050 Hz, ADPCM IMA 4 bit, in assets/inst/<id>.json (sito: docs/inst/). Generati con tools/build-instruments.py (altezza di ogni nota misurata).
Chitarre (acustica, classica, elettrica pulita): sintetizzate (Karplus-Strong), nessun campione.

## Aggiunti il 26/11 (chat B)
Da VCSL e VSCO-2-CE (Versilian Studios, **CC0 1.0**, nessun credito obbligatorio), convertiti con tools/build-instruments.py:
harpsi (clavicembalo), kawai (gran coda), pipeorgan, xylo, vibbow, mbira, psaltbow, psaltpluck, vlnspic, cellospic, vlntrem, cellotrem, violin, bassarco, tuba, hornmute, tbnstac, bassoon.
Più 39 nuovi suoni Synth Pro sintetizzati da zero (nessuna licenza di terzi).

## Spazio di separazione (space/, 25/11)
audio-separator (MIT), htdemucs (Meta, MIT), Mel-Band RoFormer vocals di Kimberley Jensen (MIT secondo la scheda huggingface.co/KimberleyJSN/melbandroformer), faster-whisper (MIT) + Whisper small (MIT), gradio (Apache 2.0), @gradio/client (ISC).

## Canto IA (26/11)
ACE-Step 1.5 (codice e pesi MIT, scheda huggingface.co/ACE-Step/Ace-Step1.5), usato tramite lo spazio pubblico ufficiale ACE-Step/Ace-Step-v1.5 (GPU gratuite con limite giornaliero). La voce generata è IA: per provare melodie, non da pubblicare come voce dell'utente.
