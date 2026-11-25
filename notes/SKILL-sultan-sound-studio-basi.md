---
name: sultan-sound-studio-basi
description: Mappa veloce della parte «STUDIO E BASI» di Sultan Sound (ai-music-studio): dove stanno basi, varianti, atmosfere, effetti e voci di produzione, mixer, separazione, Impara da una base e Beat This!, più i comandi già pronti per provare e pubblicare. Usare all'inizio di ogni lavoro di questa chat al posto di rileggere i sorgenti.
---

# Sultan Sound: STUDIO E BASI (chat B), partire da qui senza rileggere il progetto

## Comandi pronti (non riscriverli)
- Pubblicare: `bash tools/pubblica.sh "messaggio" "Co-Authored-By: ..." "Claude-Session: ..."` (commit, unione con main, build con test, push, verifica).
- Provare su iPhone simulato: `node tools/prova-iphone.js /tmp/a.png "codice JS nella pagina" 5` (stampa errori + screenshot).
- Un solo test: `node --test tests/<nome>.test.js`. Build completa (oltre 2 min): in background.
- Mappa di tutti i file: `notes/MAPPA.md` (rigenerare con `node tools/mappa.js`).

## Dove sta cosa (moduli di B)
- `src/arranger.js`: genera la base (STYLES, hook p.notes/drumPat/prog/groove/tune/extraFx…). Melodie (makePhrase, melSeed, heavy) sono di A.
- `src/style-presets.js` (StylePresets): 39 atmosfere «Tipo …», PROGS, `variant`, `pickMany`.
- `src/prod-fx.js` (ProdFx): 29 effetti sintetizzati, `plan(map)` dal testo, `renderSfx`, `renderVox` (eco, risposta, coro, scura, reverse, ad-lib). Tracce `sfx` e `vox`.
- `src/beat-this.js` (BeatThis): rete Beat This! (MIT, small0-v2.onnx 10 MB, HF ashudesai/songbird-models). `track()` → beats, downbeats, bpm, conf. Mel verificato con torchaudio.
- `src/beat-learn.js`: `learn(x, sr, {grid})` usa la griglia Beat This! se conf ≥ 0,5.
- `src/ai-separator.js`: SCNet / Mel-RoFormer a pezzi di 40 s.
- `src/mixer.js`, `src/synth-design.js` (KITS, PRO, 808), `src/instruments.js` (RECIPES), `src/master-pro.js`, `src/clips.js`, `src/studio-agent.js`, `src/studio-ai.js`.
- `src/app.js` (B solo nelle sue parti): varianti `varMake/varSpec/varClick`, `textWeights` + `pfImageWeights`, pannello Produzione `pfPlan/pfRender`, Studio `LANES/dwBuffers/dwGraph`, Impara `btGrid` + `#dw-learn-file`.

## Misure già fatte (non rifarle)
- Separazione SDR (MUSDB): SCNet voce 12,7–14,4 dB; RoFormer 14,8–17,5 dB.
- Beat This! su 16 basi: BPM giusti 14/16 (regole 7/16); downbeat entro ~10 ms. Sbaglia ancora la drill (terzine).
- Varianti: 24 basi in ~8 s, ~18 atmosfere diverse.
