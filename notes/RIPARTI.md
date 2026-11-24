# RIPARTI DA QUI (leggere SOLO questo file all'inizio di una chat nuova)

Progetto: studio musicale personale (italiano), PWA per iPhone. Sito: https://sultan199777.github.io/ai-music-studio/ (aprire da Safari: dentro Claude il microfono è bloccato). Repo: sultan199777/ai-music-studio, ramo di lavoro `claude/app-con-microfono`, pubblicato anche su `main` (cartella docs/ = sito). Artifact in Claude: https://claude.ai/artifact/BVEPXEXUwGWmYYTK78rDKK (stesso file `dist/index.html`).

## Come lavorare (regole dell'utente)
- Italiano, risposte corte, un passo alla volta, spiegare le decisioni. Non rianalizzare tutto, non sprecare token: leggere `notes/MAPPA.md` (mappa) e, solo se serve, il file interessato.
- Non inventare funzioni; non dire "fatto" senza codice e test. Etichette: Misurato / Analisi / Ipotesi. Io non ascolto l'audio: il suono lo giudica lui.
- Niente acquisti, abbonamenti o pubblicazioni sui social senza approvazione. Niente chiavi API nel codice (repo pubblico). Mai chiedere password o codici.
- Solo la sua voce; stile = caratteristiche misurate, mai copiare testi o imitare voci.
- È su iPhone, senza Mac né computer per ora; Claude Pro attivo.

## Comandi
- Test + build: `node build.js` (esegue `node --test tests/*.test.js`, crea `dist/index.html` e `docs/`).
- Mappa: `node tools/mappa.js`. Pubblicare: Artifact sullo stesso file `dist/index.html` (url sopra) + commit/push su ramo e su main.
- Falsi allarmi: l'avviso "commit non inviati" dell'hook è sbagliato; verificare con `git fetch` e `git rev-list --count origin/claude/app-con-microfono..HEAD`.

## Stato (dettagli in notes/STATO.md)
Fatto: analisi testi, registrazione dal microfono (Voce), Auto-Tune + preset trap, master, scheda di stile, arrangiatore 5 stili con batteria a campioni CC0 e melodia varia, Producer con comandi (BPM, tonalità, stile, per strumento e per sezione), testo scorrevole regolabile, tema Cosmo.
Non fatto: 808 e strumenti melodici con suoni veri, hi-hat con rullate, mix per traccia, piano roll/MIDI, Voice Lab avanzato, import basi (Basic Pitch), Coach che impara dalle scelte, video anime reale, social, AI locale (serve un computer).

## Prossimo passo concordato
Qualità delle basi: 808 vero con glide, strumenti melodici con campioni CC0, hi-hat con rullate, pattern per stile. Poi mix per traccia, piano roll/MIDI, Voice Lab. Chiedere conferma "vai" solo se cambia la direzione.
