# RIPARTI DA QUI (leggere SOLO questo file all'inizio di una chat nuova)

Progetto: studio musicale personale (italiano), PWA per iPhone. Sito: https://sultan199777.github.io/ai-music-studio/ (aprire da Safari: dentro Claude il microfono è bloccato). Repo: sultan199777/ai-music-studio, ramo di lavoro della chat attuale (ultimo: `claude/continua-riparti-10liad`), pubblicato anche su `main` (cartella docs/ = sito). Artifact in Claude: https://claude.ai/artifact/BVEPXEXUwGWmYYTK78rDKK (stesso file `dist/index.html`).

## Come lavorare (regole dell'utente)
- Italiano, risposte corte, un passo alla volta, spiegare le decisioni. Non rianalizzare tutto, non sprecare token: leggere `notes/MAPPA.md` (mappa) e, solo se serve, il file interessato.
- Non inventare funzioni; non dire "fatto" senza codice e test. Etichette: Misurato / Analisi / Ipotesi. Io non ascolto l'audio: il suono lo giudica lui.
- Niente acquisti, abbonamenti o pubblicazioni sui social senza approvazione. Niente chiavi API nel codice (repo pubblico). Mai chiedere password o codici.
- Solo la sua voce; stile = caratteristiche misurate, mai copiare testi o imitare voci.
- È su iPhone, senza Mac né computer per ora; Claude Pro attivo.

## Comandi
- Test + build: `node build.js` (esegue `node --test tests/*.test.js`, crea `dist/index.html` e `docs/`).
- Mappa: `node tools/mappa.js`. Pubblicare: Artifact sullo stesso file `dist/index.html` (url sopra) + commit/push su ramo e su main.
- Falsi allarmi: l'avviso "commit non inviati" dell'hook è sbagliato; verificare con `git fetch` e `git rev-list --count origin/<ramo>..HEAD`.

## Stato (dettagli in notes/STATO.md)
Fatto (provato con test, NON ascoltato): analisi testi, registrazione dal microfono (Voce), scheda di stile, arrangiatore 5 stili con 808 glide/hi-hat rullate/groove per stile, Producer con comandi per strumento e per sezione, tema Cosmo.
NUOVO 24/11: **Beat Lab** (pagina #beatlab: motore in tempo reale, batteria a step con rullate, 20 strumenti CC0 in docs/samples, tastiera sulla scala, accordi, piano roll, livello "Impara", mixer con EQ/compressore/sidechain/riverbero/delay, export WAV e MIDI, salvataggio progetti) e **Voice Lab** (pagina Voce: autotune con retune speed/humanize/flex-tune/classico/vibrato/formanti, catena vocale, 13 caratteri, Auto, A/B, monitor in cuffia sperimentale). Moduli: src/beatlab-*.js, src/voice-*.js, formant.js, realtime-tune.js. Limiti dichiarati nelle sezioni di STATO.md.
Non fatto: correzione del tempo (timing), stereo voce, vocoder, import basi (Basic Pitch), Coach, assistente con modello di linguaggio, video anime reale, social, AI locale (serve un computer), analisi matematica dei testi degli artisti caricati dall'utente.

## Prossimo passo concordato
Far provare all'utente Beat Lab e Voice Lab su iPhone e correggere in base a cosa sente; poi collegare il Producer al Beat Lab (comandi che modificano le tracce del Beat Lab), analisi testi da file, Coach. Le chat nuove devono partire da main aggiornato (`git pull origin main`).

## Piano tecnico dello studio professionale (nuovo, 24/11/2026)
Documento con ricerca, fonti, licenze, architettura e fasi: https://claude.ai/artifact/QH4k4tg4uf8kRHfPYMpvD2 (leggerlo con Artifact read, solo se serve). Due studi distinti: Beat Studio e Voice Studio. Fase 0 = progetto in dati + motore Tone.js + mixer per traccia + export WAV. Il codice NON è ancora stato cambiato per questo piano; l'utente deve confermare da quale fase partire.
Strumenti melodici con campioni CC0 (piano/keys, pluck, archi). Poi mix per traccia, piano roll/MIDI, Voice Lab. Chiedere conferma "vai" solo se cambia la direzione.
