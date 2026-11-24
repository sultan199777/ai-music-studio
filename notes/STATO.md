# STATO DEL PROGETTO (leggere questo file prima di lavorare; NON rifare analisi complete)

Regola della persona: andare avanti un passo alla volta, senza rianalizzare tutto a ogni richiesta (consuma i limiti d'uso).

## Dove siamo (23 nov 2026)
- App pubblicata come pagina (Artifact) con 10 sezioni. 91 test automatici superati. Build: `node build.js`.
- Funziona: analisi testi, base sintetica (bozza), analisi voce, autotune con editor delle note, mix voce+base, clip con filtro foto, piano social 30 giorni, idee video, cartelle testi, guida voce (canta/parla/allunga), colori ambient che seguono l'emozione.
- Limiti noti: nessun microfono nella pagina (Memo Vocali + import); basi sintetiche e ripetute (un solo giro, suono "flauto"); video = filtro, non anime; nessun collegamento ai social; mai provata su un iPhone vero; qualità audio mai ascoltata.

## Decisioni
- Piano gratuito fino a fine mese; poi Claude Pro (~22 €/mese) + account GitHub gratuito.
- Dopo il Pro: nuova web app propria (PWA) con microfono vero, riusando i motori in `src/`.
- Servizi AI esterni (musica, video anime, voce cantata): da confrontare e provare prima di collegarli. Nessun acquisto senza approvazione.

## Prossimi passi (in ordine)
1. Basi serie: batteria trap/hip hop con 808 e hi-hat sintetizzati meglio, struttura strofa/ritornello/ponte, 3-4 direzioni diverse per genere.
2. Registrazione vera (richiede web app propria).
3. Autotune automatico guidato dalla guida voce (le righe "parla" non si correggono).
4. Video anime via servizio esterno (da valutare).
5. Collegamento YouTube/Instagram con statistiche (serve piccolo server).


## Aggiornamento 24/11 - Basi serie (fatto, testato)
- `src/arranger.js`: 5 direzioni (Trap, Drill, Epico, Melodico, Estate) con struttura intro/strofa/pre/ritornello/bridge/outro, 808 con slide, hi-hat con rullate, clap, taiko, archi/coro (sega polyBLEP + filtri), riser e impatto, respiro prima del drop, pompaggio cassa. Gancio del ritornello uguale tra i ritornelli, melodia assente in strofa (spazio per la voce).
- 102 test passano. Verificato in Chromium iPhone emulato; NON ascoltato su telefono: la qualita' va giudicata dall'orecchio dell'utente.
- Limiti: suoni sintetici; struttura fissa (ripartita in proporzione alle battute); non ancora legata alle righe del testo con il nuovo arrangiatore.
- Prossimo: scheda di stile da canzoni di riferimento, poi grafica Cosmo.

## Aggiornamento 24/11 - Scheda di stile da riferimenti (fatto, testato)
- `src/style-card.js`: misura da file audio caricati dall'utente (max 3): tempo, peso del basso, luminosita', colpi per battuta, crescita del ritornello; `blend` mescola con pesi; `toParams` sceglie lo stile dell'arrangiatore e i parametri `tune` (hat, basso, cassa, crescita).
- Nessuna copia di melodie, testi, voci o suoni; nomi di artisti/produttori non usati come "fonte": solo i file dell'utente, misurati.
- 110 test passano. Verificato in Chromium iPhone con due file di prova sintetici (i valori colpi/crescita erano 1,0 perche' sintetici). Da provare con canzoni vere.
- Limiti: stime da audio gia' mixato; non separa voce e strumenti; non riconosce sezioni, solo la crescita di energia.

## Aggiornamento 24/11 - Registrazione con microfono e versione app (fatto, testato in emulazione)
- Studio > "Registra con il microfono": parte la base, scorre la riga del testo (parla/canta/allunga), indicatore di livello, fine registrazione -> prova in Voce con latenza compensata (stima). Prove salvate in IndexedDB e ripristinate al riavvio.
- Salvataggio: nella versione app scarica WAV a qualita' piena; dentro Claude resta il vecchio metodo.
- `docs/` (generata da build.js, servita da GitHub Pages): index.html, manifest, sw.js (offline), icone. Va servita in HTTPS (richiesto dal microfono su iPhone).
- Repo GitHub privato sultan199777/ai-music-studio, ramo claude/app-con-microfono (clone di lavoro: /home/claude/ams-repo).
- NON verificato: microfono su iPhone reale (Safari), latenza reale, installazione sulla Home. Test fatti con microfono finto in Chromium.
- Da decidere: dove pubblicare (GitHub Pages richiede repo pubblico o piano a pagamento).

## Aggiornamento 24/11 - Catena di master (fatto, testato)
- `src/master.js`: highpass, EQ leggero, compressore "colla", saturazione, volume medio al bersaglio (Morbido -17, Standard -14, Forte -11 dBFS RMS), limitatore con anticipo (tetto -1 dBFS). Applicata a base e mix con voce; selettore in Studio.
- 116 test passano; verificato in Chromium iPhone emulato. Valori misurati; il giudizio sul suono resta all'orecchio dell'utente.

## Aggiornamento 24/11 - Grafica Cosmo (fatto, controllato con screenshot)
- Tema Cosmo (notte) di default: sfondo #07070f, neon ciano/magenta/viola, vetro. Sfera nella scheda di registrazione: colori dall'emozione del testo, pulsa col livello del microfono. Karaoke su vetro scuro con bordo neon.
- Il tema Chiaro resta disponibile in Impostazioni. Da fare: sfera anche in Home, piano roll in stile Cosmo, schermata Libreria.

## 24/11 - Pubblicazione
- L'app compilata sta in `docs/` (GitHub Pages serve /docs). Le note stanno in `notes/`. Per attivarla: repo pubblico, Settings > Pages > ramo main, cartella /docs. Richiede HTTPS: il microfono lo esige.

## 2026-11-24 Suoni veri (campioni CC0)
- Cassa/rullante/clap/hi-hat ora da campioni registrati (11 suoni, 263 KB), selettore "Suoni batteria" nella sezione base; il basso 808, accordi, pad, melodia restano sintetizzati.
- Test: 117/117. NON ascoltato da me: va giudicato a orecchio.

## 2026-11-24 Producer: comandi per strumento e per parte
- Nuovi comandi: BPM esatti, tonalità, stile (trap/drill/epico/melodico/estate), alza/abbassa/togli/rimetti per strumento, "solo X", per sezione (strofa, ritornello…), hi-hat più fitti/radi. Mix per sezione in Backing.mix. Test 119/119.
- Limite: un comando con due richieste diverse ne esegue una sola (es. stile + togli 808).

## 2026-11-24 Risparmio di token
- `notes/MAPPA.md` (generata con `node tools/mappa.js`): mappa di file, scopo e funzioni. Leggerla prima dei sorgenti. Rigenerare dopo cambi grandi.
- Graphify e Ponytail non installati (rete per pacchetti spenta; Ponytail non verificato).

## 2026-11-24 Voice Lab (autotune migliorato, catena vocale, interfaccia semplice, monitor sperimentale)
Fatto e provato (test Node 148/148 + prova Playwright con microfono finto in Chromium 390x844, 0 errori in console a parte i font Google non raggiungibili nel sandbox):
- `src/autotune.js` esteso (compatibile con i test vecchi): tracciatore fine (~6 ms), Retune Speed in ms, Humanize, Flex-Tune (zona morta + scivolate), modo Classico, vibrato naturale/artificiale e deriva lenta (separazione centro nota / deriva / oscillazione veloce), formant shift (cepstrum, `src/formant.js`), tonalità automatica con KeyDetect (se incerta usa "tutte le note" e lo segnala), armonie anche verso il basso. Test numerici in `tests/autotune-voice.test.js`.
- `src/voice-chain.js`: pulizia, de-esser (ripiano alto dinamico), compressore a 2 stadi, saturazione, distorsione, EQ, filtri, armonie (ritardo casuale 10-30 ms), doppie ADT, delay, riverbero, limitatore; 13 caratteri combinabili e salvabili; 5 cursori; analisi e regolazioni "Auto"; Prima/Dopo a volume pareggiato. Test in `tests/voice-chain.test.js`.
- `src/realtime-tune.js` + `src/voice-lab.js` + `src/voice-lab.css`: interfaccia nella pagina Voce (Auto, chip, cursori, curva prima/dopo, Avanzato con 60 parametri, preset salvati in localStorage) e monitor in cuffia sperimentale (AudioWorklet, riserva ScriptProcessor).
Limiti onesti: nessun ascolto umano (misurati cent, picchi, spettro, ritardi); valori dei caratteri NON verificati; uscita mono; monitor non provato su iPhone reale (solo Chromium), latenza di sistema solo "dichiarata dal browser" (Safari non espone outputLatency); suono del monitor granuloso; elaborazione sul file: ~4 s per 5 s di voce nel browser di prova, su iPhone da misurare; formant shift oltre +-4 semitoni artificiale; la tonalità maggiore/minore relativa si confonde; tracciatore con qualche picco isolato sulla curva. Non fatto: stereo, timing/allineamento, vocoder, Worker (il calcolo blocca un poco la pagina, con pause tra le fasi).
Cablaggio minimo: blocchi "VOICE LAB" in app.js (4 righe + init), app.body.html (2 contenitori), app.shell.html, build.js.
## Beat Lab (chat "work-beat", 24/11/2026) - in corso

### Tappa 1 - motore in tempo reale + batteria: FATTA e provata
- File nuovi: `src/beatlab-voices.js` (batteria e sintetizzatori Web Audio), `src/beatlab-engine.js` (progetto, tick/swing/rullate, scheduler con lookahead, grafo tracce con volume/pan/mute/solo/misuratori, Player, esportazione WAV con OfflineAudioContext), `src/beatlab-patterns.js` (7 stili originali + "casuale ma sensato"), `src/beatlab-ui.js`, `src/beatlab-boot.js`, `src/beatlab.css`.
- Scelta motore: Web Audio puro (non Tone.js): niente file esterni, stessa catena in tempo reale e offline, tempistica testabile in Node.
- Cablaggio minimo (blocchi commentati "Beat Lab"): `src/app.js` (VIEWS, MENU, SHOW.beatlab), `src/app.body.html` (vista `#v-beatlab`), `src/app.shell.html` (CSS e JS), `build.js` (BEATLAB_FILES).
- Test Node: `tests/beatlab-engine.test.js`, `tests/beatlab-patterns.test.js` (tempi esatti dello scheduler anche con jitter, swing, rullate, loop, cambio BPM al volo, resize, WAV, regole di genere su 30 semi x 7 stili).
- Test nel browser (non fanno parte di build.js): `tests/browser/audio-check.js` (render offline di 7 stili x 2 kit: picchi, silenzi, valori finiti) e `tests/browser/ui-check.js` (iPhone emulato, Chromium: tocco, play, misuratori, esporta WAV, nessun errore in console).
- NON ascoltato da me: misurati picchi (-0,4 / -2,4 dBFS dopo il limitatore di sicurezza), assenza di valori non finiti, suono presente. Il giudizio sul suono e sul groove resta all'orecchio dell'utente.

### Tappa 2 - campioni CC0 intonati: FATTA e provata
- `src/beatlab-sampler.js` + `docs/samples/` (manifest + 20 strumenti + 5 kit batteria + 808): 8,5 MB (MP3 mono 32 kHz, un campione ogni 3-4 semitoni, loop con dissolvenza per i suoni tenuti), caricati a richiesta con `fetch`. Fonti: VSCO-2-CE, VCSL, stargate-sample-pack, tutte CC0 (licenza controllata cartella per cartella; crediti in `notes/LICENZE-SUONI.md`, generati da `tools/beatlab-credits.js`). Conversione: `tools/beatlab-samples*.py` (servono i cloni dei repo).
- Altezza misurata con autocorrelazione: errore mediano 0-3 centesimi (campane/carillon ~35, non armoniche). Senza campioni (file:// o dentro Claude) ogni strumento ha un sintetizzatore di riserva e la pagina lo dice.
- Test: `tests/beatlab-sampler.test.js`, `tests/browser/samples-check.js`, `ui-inst-check.js`.

### Tappa 3 - tastiera, accordi, piano roll, Impara: FATTA e provata
- `src/beatlab-theory.js` (scale, blocco sulla scala, accordi, atmosfere cupa/malinconica/luminosa/epica/tesa, quantizzazione, operazioni sulle note), `src/beatlab-ui-edit.js`, `src/beatlab-ui-inst.js`. Test: `tests/beatlab-theory.test.js`, `tests/browser/ui-edit-check.js`.

### Tappa 4 - mixer/effetti, misura, MIDI, progetti: FATTA e provata
- Catena per traccia: EQ 3 bande -> saturazione parallela -> compressore -> abbassamento sidechain -> pan -> volume -> mandate riverbero/delay -> master (collante -> limiter -> tetto regolabile). Stessa catena in ascolto e nel WAV.
- `src/beatlab-mix.js` (valori di partenza per stile/strumento, "punti di partenza" dalla ricerca C; LUFS BS.1770 con pesatura K e gate; picco reale stimato), `src/beatlab-midi.js` (SMF tipo 1, 96 PPQ, batteria canale 10, swing incluso), `src/beatlab-store.js` (IndexedDB + riparazione `sanitize`), `src/beatlab-ui-mix.js` (scheda "8. Effetti, master e progetti").
- Test: `tests/beatlab-mix.test.js` (LUFS di riferimento, picchi, preset, ducking, MIDI con parser, sanitize, store), `tests/browser/ui-mix-check.js` (effetti che cambiano davvero il render, sidechain misurato -16,0 -> -17,9 LUFS, limiter, MIDI scaricato valido, IndexedDB salva/riapri/ricarica).
- LIMITI ONESTI: il sidechain NON legge il segnale della cassa: abbassa a tempo dei colpi di cassa (stessa cosa in ascolto e nel file). Il picco reale e' una stima (interpolazione 4x). I valori di partenza di BPM/effetti sono punti di partenza, non verificati a orecchio.

### Sintesi finale Beat Lab
- FATTO e provato (Node 157/157 in build + prove Playwright iPhone 13 emulato): motore, batteria a passi con rullate/swing/kit, 7 stili + casuale sensato, WAV, 20 strumenti campionati + sintetizzatori, tastiera con blocco scala, accordi, piano roll, Impara, effetti, master, LUFS, MIDI, progetti.
- NON FATTO / LIMITI: audio mai ascoltato da me (solo misure di picchi, silenzi, valori finiti); mai provato su un iPhone vero; chitarra e coro non hanno campioni CC0 adatti (sintetici); campane approssimate; il corno ha un salto di 14 semitoni; iOS ferma l'audio a schermo bloccato; la versione `dist/index.html` (artifact Claude) non ha campioni, solo sintetizzatori; BPM predefiniti di boom bap/R&B/pop "non verificati".
## 2026-11-24 Basi: 808, hi-hat con rullate, groove per stile (fatto, testato)
- 808 (sintetizzato): glide logaritmico dalla nota precedente (trap 70 ms, drill 130 ms e più frequente), saturazione per avere armoniche (si sente anche dal telefono), coda fino a 2,2 s, salti d'ottava (drill di più). Misurato: fattore di cresta 1,31-1,36 contro 1,41 di una sinusoide pura.
- Hi-hat: rullate 1/32, terzine, 1/48, 1/64 con velocità crescente/calante e tono che sale/scende; rullata grande a fine sezione nei ritornelli. Trap e drill sì, melodico raramente, epico/estate no. "Hi-hat più fitti" aumenta anche le rullate.
- Cassa: pattern di 2 battute per stile (scelto dal seme, diverso tra strofa e ritornello) ripetuto, variazione ogni 4ª battuta. Prima era casuale battuta per battuta.
- Nuovi dati: events.kick, events.hat, events.bass[].slideFrom. Test 123/123.
- Ancora da fare: strumenti melodici con campioni CC0, 808 da campione vero, mix per traccia.

## 2026-11-24 Strumentario: 29 strumenti veri + 3 chitarre (fatto, testato)
- `src/instruments.js`: catalogo di 32 strumenti in 7 famiglie (tastiere, archi e corde, legni, ottoni, percussioni intonate, mondo, chitarre) con: come si usa, registro, ruoli, con cosa combacia e perché, stili. Ricette per 5 stili. Campionatore (nota più vicina + intonazione, suoni tenuti allungati con dissolvenza), chitarre Karplus-Strong.
- Campioni CC0 (VSCO-2-CE, VCSL), 6,1 MB in tutto, scaricati solo quando scegli lo strumento (poi restano nella cache dell'app). Misurato: altezza delle note entro ±0,3 semitoni (rilevatore inaffidabile su campane/kalimba/glock, armoniche irregolari).
- Arrangiatore: `inst: {melodia, accordi, pad}`; se lo strumento non è caricato usa la sintesi. 32 battute in ~0,3 s.
- App: in Studio > La base tre menu (Melodia, Accordi, Atmosfera) + "Consiglia per lo stile"; nuova pagina Strumentario (#strumenti): come si costruisce una base, ricette, tutti gli strumenti con Ascolta. Provato in Chromium: nessun errore.
- Limiti: nell'Artifact di Claude i campioni non si scaricano (solo sul sito). Niente percussioni del mondo, cori o voci campionate ancora. Velocità unica (niente dinamiche multiple).
- Prossimo: percussioni del mondo (conga, bongo, shaker, cajon…), ricerca e progetto dell'autotune nuovo.

## 2026-11-24 Microfono, testo→base, Laboratorio suoni, Coach (fatto, testato)
- Microfono: registrazione con MediaRecorder (registratore nativo, separato dalla grafica) invece di ScriptProcessor, che perdeva pezzi quando il testo scorreva (causa probabile dello "sgretolio": Analisi, da confermare sull'iPhone). Misuratore con Analyser. Provato con microfono simulato in Chromium.
- Testo→base: le emozioni scelgono uno stile dell'arrangiatore + strumenti veri (tristezza: trap con piano/chitarra/archi; rabbia: drill con pizzicati/violoncelli; gioia: estate con marimba/chitarra classica…). Canzoni vecchie migrate dal generatore vecchio (melodia simile a un flauto) al nuovo. Il flauto non è mai scelto in automatico.
- Testo che scorre: durata di ogni riga dalle sillabe e dal modo (parla 5,5 sill/s, canta 3, allunga 1,8), 1/2/4 battute, parola in corso evidenziata; la base può durare quanto il testo (fino a 64 battute).
- Laboratorio suoni (`src/sound-lab.js`): 12 strumenti originali (Piano di vetro, Arpa fantasma, Archi su nastro, 808 che canta, Campana di cenere, Kalimba liquida, Chitarra nella nebbia, Piano che diventa archi, Ottoni di cristallo, Pizzicato elettrico, Sax nel vuoto, Organo che respira), 5 generi da inventare, editor con 2 strati, morph e 11 caratteri (calore, brillantezza, sporco, nastro, lo-fi, movimento, luccichio, nebbia granulare, risucchio, doppio, attacco), "Sorprendimi", salvataggio dei tuoi strumenti (usabili nella base).
- Coach (`src/coach.js`): impara dai gesti (mi piace, non mi piace, salva, registra, ascolta fino in fondo, variante scartata, strumento cambiato), anche per emozione del testo; "Crea con il Coach" sceglie e spiega, esplora il 20% delle volte dichiarandolo; "Controlla il mio lavoro" misura distorsione, intonazione, tonalità voce/base, equilibrio voce/base, melodia sopra la voce, righe troppo piene, base corta, varietà, con "Correggi per me"; 8 abilità, imparata dopo 3 controlli giusti di fila, livelli da Principiante a Producer autonomo.
- Test 142/142. Nessun servizio a pagamento.

## 2026-11-24 Studio vero (DAW), testo a tempo, arpeggi, agenti (fatto, provato in Chromium come iPhone 13)
- Testo a tempo: causa misurata = il testo partiva dalla battuta 1 mentre la base aveva 1-2 battute di intro, e le righe corte prendevano 1 battuta. Ora `src/song-map.js`: il testo decide la struttura (titoli [Strofa]/[Ritornello]/[Bridge]… → sezioni), intro 2 battute, cantato minimo 2 battute per riga, sezioni pari, outro; la base usa la stessa mappa (`plan` nell'arrangiatore); il karaoke non gira in tondo e conta le battute d'intro.
- Arpeggi: nuova traccia `arp` in ogni stile (6 schemi: ottavi, spezzato, sedicesimi, terzine, levare, lento; leggero in strofa, fitto nel ritornello), strumento a scelta (ruolo "arpeggio"), livello nel mix.
- Studio (#daw, prima pagina): trasporto (play/stop/registra, tempo, battuta, sezione), stile/BPM/tonalità, 4 passi (Testo, Base, Voce, Mix), testo grande che segue la base, arrangiamento con parti colorate, righe del testo sulla timeline, 7 tracce con forma d'onda, muto/solo/volume dal vivo, cambio strumento con schede e anteprima, tocco sulla timeline per partire da lì, registrazione della voce dentro lo Studio, mix ed export WAV.
- Agenti (gratis, sul telefono, mentre l'app è aperta): Arrangiatore (3 varianti calcolate davvero, una esperimento; Ascolta/Usa/✕ = voto), Sound designer (2 strumenti inventati dai tuoi preferiti; Usa/Salva), Coach (lezioni con Correggi).
- Tema "Studio" elegante (grafite, oro, viola) predefinito; barra in basso: Studio, Testo, Voce, Suoni, Menu.
- Test 214/214.

## Studio: Microfono, Impara da una base, 2 agenti nuovi
- **Microfono nello Studio** (pannello sotto l'arrangiamento): Mic pulito / Mic autotune, caratteri (fino a 3), manopole (VoiceChain.MACROS). Dopo ogni registrazione con ● il microfono si applica da solo; l'autotune usa la tonalità della base. "Senti la voce originale" = A/B, l'originale non si perde.
- **Impara da una base** (`src/beat-learn.js`): separazione voce/base (STFT, maschere: centro stereo + armonico/percussivo + banda voce), pulizia (sottrazione spettrale + normalizza -1 dB), profilo misurato (BPM con scelta metà/doppio dagli hi-hat, cassa sui 16 passi, rullante metà tempo o 2-4, densità hi-hat, terzine, swing, sub, brillantezza). Si salvano SOLO i numeri (LIB.settings.learned). `blend` unisce i profili che piacciono ed evita quelli che non piacciono → `p.groove` (Arranger accetta `groove`: kickPats, snare, swing, rolls).
- **Agenti nuovi**: Ascoltatore (base dai tuoi gusti, pronta da ascoltare) e Tecnico voce (misura rumore, saturazione, intonazione, sibilanti e consiglia il microfono).
- Limiti (Ipotesi): la separazione non è una rete neurale; pad al centro finiscono un po' nella voce. Su iPhone ~3 s di calcolo per minuto sul PC di prova, probabilmente 2-3 volte di più sul telefono.
- Prossimo: "strumento dalla tua voce" (canti una nota → diventa strumento), autotune che segue gli accordi battuta per battuta.

## Fase 1-2 (piano a 7 fasi): video + separazione AI
- Backup prima delle fasi: branch `backup-2026-11-24`.
- Fase 1: "Impara da una base" accetta anche video (MP4/MOV dall'iPhone): l'audio si legge con decodeAudioData (provato con MP4 AAC).
- Fase 2: **Separazione AI** gratuita, open source, sul dispositivo: HTDemucs v4 (Meta, MIT) via onnxruntime-web 1.22 (MIT) e demucs-web 1.0.2 (MIT, `src/vendor-demucs.js`). Lavora in un worker (`assets/ort/sep-worker.js`), modello da Hugging Face (180 MB, una volta, Cache Storage `msa-models-v1`, protetta dal service worker). Il service worker aggiunge COOP/COEP: con la pagina isolata usa 4 processori (misurato: 10 s di audio in 25 s invece di 45 s, CPU del container). 4 tracce: voce, batteria, basso, resto; il ritmo si misura su batteria+basso. Se fallisce (memoria iPhone) passa da sola alla separazione veloce. Massimo 3 minuti a volta.
- Da verificare su iPhone (Ipotesi): velocità, memoria, WebGPU nel worker.

## Separazione v2 (misurata) + cartelle artista
- Motore nuovo: unblend 1.0.1 (MIT) + onnxruntime-web 1.26 (MIT) in `assets/unblend`, `assets/ort126` (solo l'import di ORT reso relativo in workers/onnx-worker.js). Tolto il vecchio demucs-web.
- Misure su MUSDB18 test (2 brani, 20 s, SDR in dB voce / base, CPU 4 thread):
  vecchio metodo semplice 0,2-0,9 / 6,8-7,6 · HTDemucs 11,9-13,5 / 17,9-20,9 (~40 s) · **SCNet small 12,7-14,4 / 18,7-21,8 (~37 s, 27 MB) = Rapida** · **Mel-Band RoFormer 14,8-17,5 / 20,8-24,8 (~300 s su CPU, 474 MB) = Studio** (voce RoFormer, base = brano − voce divisa da SCNet).
- Tolto il filtro anti-fruscio dopo la separazione (era la causa dell'effetto "sgranato"); solo normalizzazione.
- Se l'AI fallisce l'app lo scrive chiaramente e usa il metodo semplice solo per il ritmo.
- Cartelle artista/genere: ogni canzone salvata in una cartella; "Crea una base nello stile X" usa solo quella cartella, seme nuovo a ogni pressione.
- Il service worker non cancella più le cache dei modelli (cancella solo `studio-*`).
- Licenze pesi: unblend dichiara Mel-Band RoFormer MIT; SCNet e HTDemucs "senza licenza esplicita" (uso per analisi personale).
- Da verificare su iPhone: Rapida (memoria, tempo). Studio: pensata per il Mac.

## Punto 1 del nuovo piano: Mixer a canali (fatto, testato)
- `src/mixer.js`: per ogni traccia EQ 3 bande (120 Hz / medi regolabili / 8 kHz), compressore, saturazione, sidechain dalla cassa (curva di volume calcolata dal file della cassa), panoramica, mandate riverbero (stanza generata) ed eco a tempo. Preset per stile.
- Lo Studio suona attraverso il mixer (`dwGraph`); il salvataggio usa la STESSA catena in OfflineAudioContext → WAV stereo + master. Provato: file stereo, e il file cambia quando cambi una manopola.
- Impostazioni salvate in `prod.mix`; cambiando stile si riparte dal preset dello stile.
- Prossimo: punto 2 (clip audio, tagli, più prove e comping).

## Piano a 7 punti dello studio (tutti fatti e testati nel browser simulato iPhone)
1. Mixer a canali (`mixer.js`): EQ, compressore, saturazione, sidechain, pan, riverbero, eco; WAV stereo con la stessa catena.
2. Prove e montaggio (`clips.js`): ogni registrazione è una prova; comping per righe del testo; clip con taglio al cursore, spostamento, volume, dissolvenze.
3. Piano roll nello Studio: melodia e basso 808 nota per nota (aggiungi, sposta, allunga, ottava, glide 808, solo note della scala); l'arrangiatore usa `p.notes` e lascia identica la batteria.
4. Voce: autotune che segue gli accordi della base (`chordPull`), vocoder sugli accordi / metallico / radio (`voice-fx.js`), preset voce personali, correzioni nota per nota del Voce passate anche allo Studio.
5. Designer suoni (`synth-design.js`): synth wavetable salvabile come strumento, 808 designer usato nella base (`p.b808` → `bassRender`), riser/downlifter/impact/reverse sulle battute (`p.fxList` → `extraFx`).
6. Mastering (`master-pro.js`): multibanda LR4 3 bande, larghezza M/S con bassi mono, saturazione, LUFS bersaglio e limitatore true peak, correlazione di fase, riferimento A/B allo stesso volume, spettro a 10 bande con consigli, "avvicina al riferimento" (EQ max ±3 dB), tracce separate in WAV.
7. Parla con lo Studio (`studio-agent.js` + ProducerActions): frasi → modifiche vere, Accetta/Annulla, niente modifiche se non capisce.
Ancora da fare (non fatti): automazioni nel tempo, chorus/flanger/phaser, gate, piano roll per accordi e arpeggio, trascrizione parole (Whisper).

## Lista "cosa manca" (fatta, testata)
- Effetti voce: chorus, flanger, phaser, gate, exciter (`voice-fx.js`).
- Automazioni per sezione (volume e filtro per traccia, rampe morbide) nel mixer e nel file salvato; versioni del progetto (salva/apri, max 20).
- Basi caricate: accordi per battuta, tonalità dagli accordi, giro più usato in gradi → `p.prog` nell'arrangiatore.
- Suoni: 808 pronti, percussioni del mondo (conga, bongo, cajón, shaker, tabla) per sezione, strumento dalla voce (vocal chop) da prova o voce separata.
- Whisper (transformers.js 4.3.2 dalla CDN jsdelivr, versione fissa: NON nel repo perché il push protection di GitHub vede una falsa chiave Mistral nel file; wasm ORT 1.31-dev in assets/tf) → metodo del testo (sillabe/s, rime, ripetizioni) + misura autotune dell'artista + medie per cartella.
- Batteria a passi (cassa, rullante, hi-hat, rullate on/off) nel piano roll → `p.drumPat`.
Ancora da fare: piano roll accordi/arpeggio, trascinare note voce (stile Melodyne), autotune dal vivo di qualità, conversazione libera (modello locale su Mac o Claude a pagamento).
