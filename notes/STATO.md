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
