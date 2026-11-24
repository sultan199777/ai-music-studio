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
- `pwa/` (generata da build.js): index.html, manifest, sw.js (offline), icone. Va servita in HTTPS (richiesto dal microfono su iPhone).
- Repo GitHub privato sultan199777/ai-music-studio, ramo claude/app-con-microfono (clone di lavoro: /home/claude/ams-repo).
- NON verificato: microfono su iPhone reale (Safari), latenza reale, installazione sulla Home. Test fatti con microfono finto in Chromium.
- Da decidere: dove pubblicare (GitHub Pages richiede repo pubblico o piano a pagamento).

## Aggiornamento 24/11 - Catena di master (fatto, testato)
- `src/master.js`: highpass, EQ leggero, compressore "colla", saturazione, volume medio al bersaglio (Morbido -17, Standard -14, Forte -11 dBFS RMS), limitatore con anticipo (tetto -1 dBFS). Applicata a base e mix con voce; selettore in Studio.
- 116 test passano; verificato in Chromium iPhone emulato. Valori misurati; il giudizio sul suono resta all'orecchio dell'utente.
