# Ripresa del lavoro — stato al 2 settembre 2026

Documento di passaggio: aprendo un nuovo terminale, leggi questo per primo,
poi `PROGETTO.md`.

---

## Dove siamo

L'intervista di progettazione è **chiusa**: 32 decisioni prese, tutte scritte in
`PROGETTO.md`. La configurazione delle skill di sviluppo è fatta. Il design
esiste, è pubblicato, ed è stato corretto sui dati reali di Scryfall.

La specifica e i quattordici ticket delle tappe 1-2 sono scritti, sotto
`.scratch/fondamenta-e-motore/`. **Il ticket 01 (scheletro PWA e note legali) è
implementato**: l'app si apre, si installa, funziona senza rete e mostra le note
legali. Il prossimo è il ticket 02, la preparazione dei dati da Scryfall.

Comandi: `npm run dev` per sviluppare, `npm run build` per compilare,
`npm test` per i test, `npm run tipi` per il solo controllo dei tipi.

## Cosa costruiamo, in una frase

App web installabile sul telefono (PWA), interamente lato browser, che dato un
tema scelto dall'utente e un tetto di spesa in euro costruisce il mazzo Standard
cartaceo più forte possibile dentro quel vincolo, spiega ogni scelta a parole, e
produce la lista della spesa. Il fulcro è il **tasso di cambio fra originalità e
potenza**.

Destinatario: un amico dell'utente, giocatore non esperto, serate al negozio.

## Vincoli non negoziabili

Sono in `CLAUDE.md` e vanno riletti prima di ogni sessione:
nessuna IA a runtime, nessun server, gratuita, legalità letta dai dati,
spiegazioni mai inventate.

## Cosa manca per partire — tre cose, tutte dell'utente

1. **Il nome dell'app.** Serve per cartella, pacchetto e indirizzo web. Nei
   mockup compare come segnaposto `[NOME APP]`.
2. **La direzione visiva.** Quattro candidate, tutte già disegnate e visibili
   nella tela pubblicata:
   - lo stile **chiaro e blu** dell'artboard importato da Claude Design (attuale);
   - **Taverna** — legno scuro, ottone, luce di candela;
   - **Grimorio** — quasi nero, oro, tipografia da libro antico;
   - **Braci** — carbone e arancio, caratteri grossi, nessun ornamento.
   L'utente ha bocciato due volte lo stile freddo, ma l'artboard importato (che
   ha fatto lui) è di nuovo chiaro: la scelta è ancora aperta.
3. **L'approvazione di `PROGETTO.md`**, o le righe da cambiare.

## Prossimi comandi, in ordine

1. `/clear`, poi `/mattpocock-skills:implement` sul ticket 02
   (`.scratch/fondamenta-e-motore/issues/02-preparazione-dati-pool.md`), e così
   via un ticket alla volta.

Ordine di realizzazione deciso (da `PROGETTO.md` §4): fondamenta → motore →
**sosta e prova reale** → galleria e budget → ciclo iterativo → meta → sideboard.

## Fatti verificati da non ri-cercare

Verificati il 2026-09-02 contro fonti vive. Dettagli in `PROGETTO.md` §3.

- Standard: 18 set legali, da *Wilds of Eldraine* a *The Hobbit*. Nessuna
  rotazione nel 2026; la prossima col primo set 2027, **data non confermata da
  Wizards** — la legalità si legge dai dati, mai da una data nel codice.
- 13 carte bandite. **Prossimo annuncio bandi: 12 ottobre 2026.**
- Scryfall: gratis, senza chiave, e un'app hobbistica non commerciale rientra
  nei termini d'uso. Prezzi in **euro già inclusi** (origine Cardmarket,
  aggiornati una volta al giorno, inaffidabili dopo 24 ore).
- API Cardmarket **chiusa** a nuove richieste — non ci serve.
- Fonti decklist: melee.gg, MTGGoldfish e i siti Wizards **vietano lo scraping**.
  Legittime: Topdeck.gg (con attribuzione) e l'archivio fbettega. Ma la scelta
  presa è **file del meta compilato a mano** (Q31).
- Non esiste alcun ottimizzatore di mazzi open source mantenuto e con licenza
  pulita. Quello che costruiamo non esiste già.
- **In Standard ci sono 95 Goblin giocabili**, non quattordici come diceva il
  mockup iniziale. Conseguenza: l'esempio della schermata "tema troppo stretto"
  va ritarato su un vincolo davvero stretto, e quale sia lo si scoprirà solo
  facendo girare il motore sui dati veri.

## Mappa dei file

```
PROGETTO.md              documento d'intesa, le 32 decisioni
index.html               guscio della pagina
src/identita.ts          il nome dell'app: il solo punto in cui cambiarlo
src/stili/tema.css       colori e caratteri: le quattro direzioni, in un file
src/stili/direzione.ts   quale direzione è attiva
src/sw.js                service worker (elenco risorse scritto dalla build)
strumenti/               manifest e icone, generati a ogni compilazione
CLAUDE.md                contesto + vincoli non negoziabili + config skill
HANDOFF.md               questo file
docs/agents/             dove vivono ticket, etichette, documenti di dominio
docs/adr/                vuota, si riempirà da sola
design/                  la tela di design (15 artboard)
  Mazzi.dc.html          artboard interattivo importato da Claude Design,
                         con carte e prezzi corretti su Scryfall
  imported/              copia grezza come scaricata, non modificata
  Home/Vincoli/...       i primi mockup, stile pergamena
  Taverna/Grimorio/Braci le tre direzioni calde da scegliere
  canvas.json            impaginazione della tela, 4 pagine
```

Il design pubblicato (stesso indirizzo a ogni aggiornamento):
https://claude.ai/code/artifact/82f52d3f-f620-42af-8686-0bc18afd6e05

Progetto Claude Design di origine: `62a2692d-6762-47e9-972b-830111fe79f9`
("Magic card design improvement"). Per rileggerlo serve `/design-login`.

Per ricostruire il file pubblicato dopo aver modificato un artboard: ri-seminare
la tela con `seed-canvas.mjs` della skill `design` passando tutti gli artboard e
`canvas.json`, poi ripubblicare lo stesso percorso. Il file
`design/mazzi-fuori-meta.html` è un prodotto di compilazione ed è escluso da git.
