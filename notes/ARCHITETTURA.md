# Architettura di AI Music Intelligence Studio

Stato: proposta di progetto, Fase 1. Solo il prototipo locale (cartella `src/`) è realizzato.
Le scelte tecnologiche qui sotto sono proposte con motivazione. Non ho verificato oggi disponibilità, diritti commerciali e prezzi di nessun servizio esterno: lo faccio prima di ogni fase e ti presento le opzioni. Non è stato acquistato né attivato nulla.

## Principi

1. **Un modulo alla volta.** Ogni modulo (voce, musica, testi, video, social, prodotto) è separato e comunica con gli altri solo tramite il servizio centrale. Si può sostituire un fornitore esterno senza toccare il resto.
2. **Niente funzioni inventate.** Ogni risultato dichiara se è *misurato*, *analisi* o *ipotesi*. Una funzione non è "pronta" finché non ha test che la dimostrano.
3. **Il consenso viene prima della voce.** Nessun modello vocale esiste senza una prova di consenso registrata.
4. **Il costo è un limite tecnico.** Ogni lavoro costa crediti e viene bloccato oltre la soglia, prima di chiamare un servizio a pagamento.
5. **Le chiavi non escono mai dal servizio centrale.**

## Livelli

| Livello | Cosa fa | Scelta proposta | Perché |
|---|---|---|---|
| App | Interfaccia per web, iOS, Android | App web installabile (React + TypeScript), poi impacchettata per gli store con Capacitor | Un solo codice per tre piattaforme. Adatto a un team piccolo e a chi inizia |
| Servizio centrale | Account, progetti, crediti, permessi, admin | Backend Python (FastAPI) | Python ha le librerie audio e AI migliori. Un solo linguaggio per servizio e lavoratori |
| Lavoratori | Analisi, separazione tracce, sintesi, video | Processi Python che leggono una coda di lavori | I lavori durano minuti: non devono bloccare l'app. Si scalano separatamente |
| Dati | Utenti, progetti, consensi, crediti | PostgreSQL | Affidabile, con transazioni per crediti e pagamenti |
| File | Audio, modelli vocali, esportazioni | Archivio compatibile S3, cifrato, con sede in Europa | Cifratura a riposo, URL firmati a scadenza, cancellazione per oggetto |
| Accesso | Registrazione e login | Servizio gestito di autenticazione | Non conservare password in proprio riduce molto il rischio |
| Pagamenti | Abbonamenti e fatture | Servizio di pagamento con abbonamenti (per esempio Stripe) | Gestisce carte, 3-D Secure, fatture. Da verificare commissioni e requisiti fiscali |

## Voce e consenso

1. L'utente legge una frase di consenso scelta dal sistema (diversa a ogni volta) e la registra.
2. Il servizio confronta la voce del consenso con i campioni caricati: se non sono della stessa persona, il modello non si crea.
3. Si salvano in un registro non modificabile: data, utente, frase, audio del consenso, versione dei termini.
4. Il modello vocale appartiene a un solo utente e non è condivisibile.
5. Cancellazione: elimina modello, campioni e derivati. Il registro del consenso resta solo per il tempo richiesto dalla legge.
6. Prima di dichiarare "voce fedele" servono test d'ascolto con ascoltatori che non sanno quale è l'originale. Fino ad allora l'interfaccia dice "bozza non verificata".

## Controllo dei costi

- Ogni tipo di lavoro ha un costo in crediti. Ogni piano ha crediti mensili e un tetto di sicurezza.
- Prima di un lavoro: controllo crediti e stima del costo reale del servizio esterno.
- Dopo il lavoro: registro del costo effettivo, per utente e per servizio, visibile nel pannello admin.
- Allarme se il costo reale supera il prezzo dei crediti consumati.

## Sicurezza e privacy

- Chiavi e segreti in un gestore di segreti, mai nel codice né nell'app.
- Tutto in HTTPS. File audio cifrati e raggiungibili solo con link a scadenza.
- Ogni utente vede solo i propri dati (controllo a livello di database).
- Limite di richieste per utente contro abusi.
- Informativa privacy, termini d'uso e registro dei trattamenti (GDPR). Va rivisto da un professionista prima del lancio.
- Registrazione dei consensi e cancellazione dei dati su richiesta, con test automatici.

## Test

- Calcoli (testo, audio): test automatici con casi noti. Già presenti: 84.
- Servizio centrale: test di ogni percorso (crediti, permessi, consenso, cancellazione).
- Integrazioni esterne: test con un finto servizio, più una prova manuale a costo contenuto prima di attivarle.
- Prima del lancio: prova di carico e controllo di sicurezza da una persona esterna.

## Cosa realizza la Fase 1 (questa)

- Interfaccia a schede, funzionante, che mostra stato reale dei moduli.
- Analisi dei testi: sillabe, rime, strofe, ripetizioni, ritornello, tono, suggerimenti motivati.
- Analisi della voce da file: altezza, estensione, scostamento dall'intonazione, livelli, dinamica.
- 84 test automatici.

Limiti dichiarati: sillabe approssimate, dizionario emotivo piccolo, pitch che può sbagliare di un'ottava, nessuna registrazione dal microfono, nessun salvataggio.

## Fasi successive

| Fase | Risultato verificabile | Servizi esterni |
|---|---|---|
| 2 Account e libreria | Registrazione, login, progetti salvati, cancellazione | Hosting, database, accesso |
| 3 Voce | Registrazione dal microfono, intonazione corretta, tonalità e velocità, confronto A/B | Nessuno |
| 4 Modello vocale | Flusso di consenso, un modello per utente, cancellazione | Sintesi vocale (da scegliere) |
| 5 Musica | Basi e melodie, versioni multiple, esportazione | Da verificare |
| 6 Testi e psicologia | Più criteri, confronto tra versioni | Nessuno |
| 7 Video | Visual sincronizzati, formati verticale e orizzontale | Da verificare |
| 8 Social | Collegamento account, calendario, pubblicazione con approvazione | API ufficiali |
| 9 Abbonamenti | Piani, crediti, pannello admin | Pagamenti |
| 10 Sicurezza e lancio | Test di carico, revisione sicurezza e legale, pubblicazione | Da definire |
