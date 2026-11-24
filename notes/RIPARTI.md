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
Fatto (provato con test e nel browser, NON ascoltato: il suono lo giudica l'utente):
- Basi: arrangiatore 5 stili (808 glide, hi-hat rullate, groove per stile); **Strumentario** (#strumenti: 29 strumenti CC0 + 3 chitarre, guida, ricette); **Laboratorio suoni** (12 strumenti originali, 5 generi da inventare, editor con strati/morph/11 caratteri, Sorprendimi, strumenti dell'utente salvati); testo→base dalle emozioni con strumenti veri (niente flauto automatico).
- **Beat Lab** (#beatlab, da altra chat): motore in tempo reale, batteria a step, 20 strumenti CC0 in docs/samples, piano roll, mixer con effetti, export WAV/MIDI.
- **Voice Lab** (pagina Voce, da altra chat): autotune con retune speed/humanize/flex-tune/formanti, catena vocale, 13 caratteri.
- Microfono con MediaRecorder (contro lo "sgretolio"); testo che scorre a sillabe con parola evidenziata.
- **Coach** (Studio): impara dai gesti (anche per emozione del testo), "Crea con il Coach", "Controlla il mio lavoro" con correzioni, 8 abilità e livelli.
Non fatto: autotune adattivo al testo e agli accordi, correzione del timing, percussioni del mondo, cori, assistente con modello di linguaggio (l'utente NON vuole servizi a pagamento ora; se servirà, dire prima il costo), video, social, AI locale (serve un computer).

## Prossimo passo concordato
1. L'utente prova su iPhone microfono, testo che scorre, Laboratorio, Coach, Beat Lab, Voice Lab: correggere in base a cosa sente.
2. Autotune NUOVO: ricerca su come sono costruiti, poi autotune che segue gli accordi della base e si adatta al testo ("più così").
3. Collegare Coach e Laboratorio al Beat Lab. Le chat nuove partono da main aggiornato (`git pull origin main`).

## Direzione decisa dall'utente (24/11/2026)
Lo studio più completo possibile, ORIGINALE (non copie: i campioni sono materia prima da trasformare), facile e spiegato, che impara e insegna, perché l'utente diventi producer autonomo. Base e voce si adattano al testo e alle emozioni. Situazione economica difficile: obiettivo alto, ma promettere solo ciò che si misura. Gli "agenti" che imparano devono funzionare davvero sul telefono, gratis.

## Piano tecnico dello studio professionale
Documento con ricerca, fonti, licenze, architettura e fasi: https://claude.ai/artifact/QH4k4tg4uf8kRHfPYMpvD2 (leggerlo con Artifact read, solo se serve).
