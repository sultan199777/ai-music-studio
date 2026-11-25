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
