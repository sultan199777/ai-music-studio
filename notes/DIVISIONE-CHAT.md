# Divisione del lavoro tra le due chat (24/11/2026) — leggere prima di iniziare

Prima di ogni lavoro: `git pull origin main`. Dopo: test (`node build.js`), commit, push. Conflitti solo in docs/index.html e docs/sw.js: `git checkout --ours` e ricostruire.

## Chat A (voce / cervello) — NON toccare da B
src/sultan-brain.js, artist-lab.js, ear.js, word-bank.js, timing.js, sing-guide.js, local-ai.js, autotune.js, realtime-tune.js, voice-chain.js, voice-lab.js, melodie in arranger.js (makePhrase, melSeed, heavy).
Prossimi: melodie legate alle sillabe, doppie/ad-lib sull'ultima parola, punchline, AI locale (WebLLM+Qwen, opzionale, da provare su iPhone).

## Chat B (studio / suono / basi / schermata) — NON toccare da A
Mixer, piano roll, designer suoni, mastering, comandi in italiano, accordi dalle basi, separazione voce/base (v2), imparare da basi e video, **nuova schermata (grafica più chiara)**.
Regola per la nuova schermata: NON cambiare gli id esistenti (#sb-make, #sb-style, #sb-mood, #b-play, #b-mel, #b-new, #sg-go, #sg-check, #ai-on, #rh-go, #rec-go, #rec-live ecc.) e i `data-` usati da app.js; si possono spostare, raggruppare e ridisegnare. Esegui `node tools/mappa.js` dopo.

## Il collegamento cervello <-> basi (da fare insieme, B guida)
Quando B impara una base (struttura, BPM, accordi), deve salvare SOLO numeri (come artist-lab: nessun audio, nessun testo) e A li usa come `profile` in SultanBrain.plan(). Nessuna copia di opere: si misurano caratteristiche, non si riproducono melodie.

## Licenze
Solo MIT / Apache / BSD / CC0. Niente GPL/AGPL né dati share-alike (CC BY-SA): l'app deve poter essere venduta.
