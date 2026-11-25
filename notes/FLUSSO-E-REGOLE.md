# Flusso e regole per Sultan Sound (valgono per ENTRAMBE le chat) — leggere a inizio chat, non rianalizzare il progetto
(Copia delle due skill "sultan-sound-flusso-lavoro" e "sultan-sound-regole-utente" salvate sull'account dell'utente. Se la chat le vede, usarle; se no, questo file.)

## Flusso
1. `git pull --no-rebase --no-edit origin main`. Leggere notes/DIVISIONE-CHAT.md e notes/RIPARTI.md.
2. A = voce, cervello, orecchio, rime, guida al canto, melodie, firme sonore (sig-fx), AI locale. B = studio, mixer, strumenti, schermata, imparare dalle basi, separazione. Non toccare i file dell'altra. Non cambiare gli id HTML esistenti.
3. Moduli UMD in `src/`, test in `tests/`. Nuovo modulo: chiave in build.js + segnaposto `/*__NOME__*/` in src/app.shell.html.
4. `node build.js` esegue tutti i test (oltre 2 minuti): lanciarlo in BACKGROUND e controllare il log, niente sleep lunghi. Per un solo modulo: `node --test tests/x.test.js`.
5. Prova nel browser con Playwright su dist/index.html (errori di pagina + screenshot iPhone).
6. Commit con le righe Co-Authored-By e Claude-Session. Conflitti solo in docs/index.html e docs/sw.js: `git checkout --ours`, ricostruire, commit. Push `git push origin HEAD:main` e verificare con `git ls-remote origin main`.
7. Risposte all'utente: italiano semplice, brevi, un passo alla volta. Etichette Misurato / Analisi / Ipotesi. Mai "fatto" senza codice e test; dire cosa non è provato (iPhone vero, ascolto, modelli scaricati).

## Regole
- Utente: principiante, solo iPhone, nessun budget, vuole vendere l'app. Stile: trap/drill/rap, malinconico/dark/euforico. Voce propria soltanto.
- Mai acquisti, abbonamenti o pubblicazioni social senza approvazione. Mai chiavi API nel codice, mai password/codici/token.
- Non copiare testi, melodie o basi altrui: solo misure (numeri). Non aggirare licenze: spiegare e dare l'alternativa legale.
- Licenze: solo MIT/Apache/BSD/CC0 (CC BY con credito). No GPL/AGPL, CC BY-SA, CC BY-NC, soglie di fatturato, licenze non chiare o non lette.
- Vuole che Claude "senta" con misure (Orecchio di Sultan). Basi diverse per ogni testo, pesanti, mai da bambini; melodie che cambiano davvero.

## Due abitudini in più (valgono per entrambe le chat)
Ispirate a idee di obra/superpowers (MIT), scritte con parole nostre.

### Trova la causa vera (quando un test fallisce o qualcosa non va)
1. Riproduci il problema (passo esatto o test). Senza riprodurlo, non toccare il codice.
2. Leggi l'errore intero: messaggio, file, riga. Non indovinare.
3. Restringi: cosa è cambiato per ultimo? Controlla solo il modulo coinvolto.
4. Una ipotesi alla volta, provata con un test o un log.
5. Correggi la causa, non il sintomo, con la modifica più piccola.
6. Aggiungi un test che prima falliva e ora passa.
7. Dopo 3 tentativi senza esito: fermati e spiega all'utente cosa hai provato.

### Verifica prima di dire "fatto"
1. Esegui `node --test tests/*.test.js` e leggi il risultato vero.
2. Se hai toccato l'app: build in background con log, senza errori.
3. Dopo il push: `git ls-remote origin main` uguale a `git rev-parse HEAD`.
4. Etichetta ciò che dici: Misurato / Analisi / Ipotesi.
5. Ciò che non puoi provare (ascolto su iPhone, gusto, WebGPU sul telefono) va detto come non verificato.
