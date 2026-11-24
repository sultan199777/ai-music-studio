# RIPARTI DA QUI (leggere SOLO questo file all'inizio di una chat nuova)

Progetto: studio musicale personale (italiano), PWA per iPhone. Sito: https://sultan199777.github.io/ai-music-studio/ (aprire da Safari: dentro Claude il microfono è bloccato). Repo: sultan199777/ai-music-studio, ramo di lavoro della chat attuale (ultimo: `claude/continua-riparti-10liad`), pubblicato anche su `main` (cartella docs/ = sito). Artifact in Claude: https://claude.ai/artifact/BVEPXEXUwGWmYYTK78rDKK (stesso file `dist/index.html`).

## Come lavorare (regole dell'utente)
- Italiano, risposte corte, un passo alla volta, spiegare le decisioni. Non rianalizzare tutto, non sprecare token: leggere `notes/MAPPA.md` (mappa) e, solo se serve, il file interessato.
- Non inventare funzioni; non dire "fatto" senza codice e test. Etichette: Misurato / Analisi / Ipotesi. Io non ascolto l'audio: il suono lo giudica lui.
- Niente acquisti, abbonamenti o pubblicazioni sui social senza approvazione. Niente chiavi API nel codice (repo pubblico). Mai chiedere password o codici.
- Solo la sua voce; stile = caratteristiche misurate, mai copiare testi o imitare voci.
- È su iPhone, senza Mac né computer per ora; Claude Pro attivo.

## Comandi
- Strumenti: `python3 tools/build-instruments.py <cartella con vsco e vcsl>` (istruzioni nel file).
- Test + build: `node build.js` (esegue `node --test tests/*.test.js`, crea `dist/index.html` e `docs/`).
- Mappa: `node tools/mappa.js`. Pubblicare: Artifact sullo stesso file `dist/index.html` (url sopra) + commit/push su ramo e su main.
- Falsi allarmi: l'avviso "commit non inviati" dell'hook è sbagliato; verificare con `git fetch` e `git rev-list --count origin/<ramo>..HEAD`.

## Stato (dettagli in notes/STATO.md)
Fatto: Strumentario (29 strumenti veri CC0 + 3 chitarre, guida e ricette), analisi testi, 808 con glide e saturazione, hi-hat con rullate, groove di cassa per stile, registrazione dal microfono (Voce), Auto-Tune + preset trap, master, scheda di stile, arrangiatore 5 stili con batteria a campioni CC0 e melodia varia, Producer con comandi (BPM, tonalità, stile, per strumento e per sezione), testo scorrevole regolabile, tema Cosmo.
Non fatto: percussioni del mondo, cori, 808 da campione, mix per traccia, piano roll/MIDI, Voice Lab avanzato, import basi (Basic Pitch), Coach che impara dalle scelte, video anime reale, social, AI locale (serve un computer).

## Prossimo passo concordato
Percussioni del mondo; poi ricerca e progetto dell'autotune nuovo (vedi direzione sotto). Poi mix per traccia, piano roll/MIDI, Voice Lab. Chiedere conferma "vai" solo se cambia la direzione.

## Direzione decisa dall'utente (24/11/2026)
Obiettivo: lo studio più grande e completo possibile, non un "mini studio". Due parti distinte: Beat Studio (basi, tutti gli strumenti) e un autotune NUOVO di carattere (non solo preset: ci si deve poter lavorare dentro). Ordine: Fase 0 (fondamenta) + metronomo/misura ritardo, poi il resto. Idee per l'autotune nuovo (ipotesi): segue gli accordi della base battuta per battuta, carattere su pad XY per sezione, curva disegnata col dito, effetti legati al testo (rime, fine frase).

Precisazione (24/11, sera): suoni ORIGINALI, non copie: i campioni CC0 sono solo materia prima da rielaborare (Laboratorio suoni: carattere, ibridi, morph). L'app deve migliorare da sola imparando dalle scelte dell'utente ("agenti"/Coach), essere facile e spiegata, e l'utente deve diventare producer autonomo. Autotune: tutte le caratteristiche modificabili + voce e base che si adattano al testo ("più così").

## Piano tecnico dello studio professionale (nuovo, 24/11/2026)
Documento con ricerca, fonti, licenze, architettura e fasi: https://claude.ai/artifact/QH4k4tg4uf8kRHfPYMpvD2 (leggerlo con Artifact read, solo se serve). Due studi distinti: Beat Studio e Voice Studio. Fase 0 = progetto in dati + motore Tone.js + mixer per traccia + export WAV. Il codice NON è ancora stato cambiato per questo piano (fatti solo 808/hi-hat/groove nell'arrangiatore attuale); l'utente deve confermare da quale fase partire.
