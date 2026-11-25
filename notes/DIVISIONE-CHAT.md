# Divisione del lavoro tra le due chat (24/11/2026) — leggere prima di iniziare

Prima di ogni lavoro: `git pull origin main`. Dopo: test (`node build.js`), commit, push. Conflitti solo in docs/index.html e docs/sw.js: `git checkout --ours` e ricostruire.

## Chat A = «VOCE E TESTI» (voce / cervello) — NON toccare da B
src/sultan-brain.js, artist-lab.js, ear.js, word-bank.js, timing.js, sing-guide.js, local-ai.js, autotune.js, realtime-tune.js, voice-chain.js, voice-lab.js, melodie in arranger.js (makePhrase, melSeed, heavy).
Prossimi: melodie legate alle sillabe, doppie/ad-lib sull'ultima parola, punchline, AI locale (WebLLM+Qwen, opzionale, da provare su iPhone).

## Chat B = «STUDIO E BASI» (studio / suono / basi / schermata) — NON toccare da A
Mixer, piano roll, designer suoni, mastering, comandi in italiano, accordi dalle basi, separazione voce/base (v2), imparare da basi e video, **nuova schermata (grafica più chiara)**.
Regola per la nuova schermata: NON cambiare gli id esistenti (#sb-make, #sb-style, #sb-mood, #b-play, #b-mel, #b-new, #sg-go, #sg-check, #ai-on, #rh-go, #rec-go, #rec-live ecc.) e i `data-` usati da app.js; si possono spostare, raggruppare e ridisegnare. Esegui `node tools/mappa.js` dopo.

## Il collegamento cervello <-> basi (da fare insieme, B guida)
Quando B impara una base (struttura, BPM, accordi), deve salvare SOLO numeri (come artist-lab: nessun audio, nessun testo) e A li usa come `profile` in SultanBrain.plan(). Nessuna copia di opere: si misurano caratteristiche, non si riproducono melodie.

## Licenze
Solo MIT / Apache / BSD / CC0. Niente GPL/AGPL né dati share-alike (CC BY-SA): l'app deve poter essere venduta.

## Aggiornamento 25/11 (B)
- B ha aggiunto `src/prod-fx.js` (ProdFx): libreria effetti da film sintetizzati + interventi sulla voce registrata (eco, risposta pitchata, cori, voce scura, reverse, ad-lib dell'utente) scelti dal testo e messi a tempo. Tracce nuove nello Studio: «Effetti» (sfx) e «Voci prod.» (vox). Pannello #dw-p-prod. È di B.
- `sig-fx.js` (A) resta di A; ProdFx lo usa solo per sirena/spari/raffica (non lo modifica).
- PER A: il Cervello (SultanBrain.plan) con un testo di strada (sirene, madre che prega, Lambo) ha scelto «Club dembow, maggiore»: andrebbe spinto verso drill/street/trap scura. B ora corregge solo le Varianti (pfImageWeights in app.js), non runBrain.
- Ad-lib (voce dell'utente registrata) e voci di produzione sono di B (sono mix/effetti); l'intonazione e le doppie cantate restano di A.
- Strumenti comuni per risparmiare token (usabili da entrambe): `tools/pubblica.sh` (pubblica e verifica), `tools/prova-iphone.js` (prova su iPhone simulato). Mappa di B: `notes/SKILL-sultan-sound-studio-basi.md`.

## Aggiornamento 25/11 (A) — Gusto e guida
- Nuovo `src/taste.js` (Taste, di A): ♥/✕ sulle basi generate dal Cervello, salva solo numeri in LIB.settings.taste e si somma al profilo (arModel). Le proposte «Ancora proposte» non finiscono mai e evitano gli stili che scarti.
- In app.body.html: 5 pannelli `.dw-guide` (uno per passo, data-ws) con la guida da produttore. B può ridisegnarli ma tenere il testo e i data-ws.
- Id nuovi da non cambiare: `sb-taste`, `data-taste`, `data-sb-like`, `data-sb-nope`.
