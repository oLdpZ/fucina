# Ripresa del lavoro — stato al 3 settembre 2026

Documento di passaggio: aprendo un nuovo terminale, leggi questo per primo,
poi `PROGETTO.md`.

---

## Dove siamo

L'intervista di progettazione è **chiusa**: 32 decisioni prese, tutte scritte in
`PROGETTO.md`. La configurazione delle skill di sviluppo è fatta. Il design
esiste, è pubblicato, ed è stato corretto sui dati reali di Scryfall.

La specifica e i quattordici ticket delle tappe 1-2 sono scritti, sotto
`.scratch/fondamenta-e-motore/`. **I ticket dal 01 al 07 sono implementati**:
l'app si apre, si installa, funziona senza rete e mostra le note legali; il pool
delle carte esiste, costruito dai dati veri di Scryfall; ogni carta porta i suoi
tag di sinergia; e l'app ora **serve a qualcosa** — si cercano le carte per nome
anche sbagliando a scriverlo, si filtrano per colore, tipo, sottotipo, costo e
parola nel testo, si vede l'immagine di ognuna e quante ne restano. E i dati si
aggiornano da soli: l'app parte sempre da quelli che ha, e in sottofondo chiede
al server se ne esistono di più freschi. E adesso l'app **calcola**: si mette
insieme un gruppo di carte dal catalogo, e la schermata «Mazzo» dice quante
terre servono, quali, e con che probabilità reale ogni carta parte al suo turno.
E il mazzo **non si perde più**: si salva sul dispositivo con un nome, si
riapre, si cancella; si esporta in un testo che porta con sé anche la richiesta
che l'ha prodotto, e chi lo importa ritrova il mazzo com'era; e se ne esce la
lista da consegnare all'arbitro. Il prossimo è il ticket 08, il tema come
vincolo: comincia la tappa del motore.

Comandi: `npm run dev` per sviluppare, `npm run build` per compilare,
`npm test` per i test, `npm run tipi` per il solo controllo dei tipi,
`npm run dati` per riscaricare le carte da Scryfall e riscrivere il pool.

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

1. `/clear`, poi `/mattpocock-skills:implement` sul ticket 08
   (`.scratch/fondamenta-e-motore/issues/08-il-tema-come-vincolo.md`),
   e così via un ticket alla volta.

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
- Il pool costruito il 2026-09-02 conta **4.886 carte** legali in Standard
  cartaceo, ricavate da 17.494 stampe. Le 13 bandite non ci sono. Sono 292
  terre, di cui 195 entrano girate e 48 solo a una condizione; 239 carte hanno
  più di una faccia; 3 carte non hanno ancora un prezzo in euro.
- I tag di sinergia sul pool vero: produce pedine 762, pesca 758, si cura del
  cimitero 703, rimozione mirata 604, guadagna punti vita 501, sacrifica 433,
  accelerazione di mana 309, conta le creature 66, spazza via 63. 1.943 carte non
  hanno nessun tag, ed è giusto. Le regole preferiscono tacere che sbagliare: i
  buchi si tappano una riga alla volta in `strumenti/correzioni-tag.txt`.
- Il catalogo sul pool vero: **4.886 carte**, 2.780 creature, 586 istantanei,
  561 stregonerie, 624 artefatti, 452 incantesimi, 292 terre, 21 planeswalker.
  I sottotipi di creatura più numerosi: Human 782, Warrior 182, Soldier 159,
  Wizard 149. Filtrando rosso più creature restano 495 carte.
- **`Goblin Chieftain` non è in Standard**, e nemmeno nessun'altra carta col
  «Chieftain» nel nome: era il nome d'esempio dei mockup. Nessun nome di carta
  va scritto nel codice come esempio — ruotano.
- Le immagini di Scryfall arrivano con `Access-Control-Allow-Origin: *`. Serve:
  un `<img>` verso un altro dominio riceve una risposta **opaca**, che in cache
  sarebbe indistinguibile da un 404, e il service worker richiede quindi la
  stessa immagine in modalità normale per poterla controllare prima di tenerla.
- Il controllo di freschezza (ticket 05) costa **circa 300 byte** quando non c'è
  niente di nuovo, non i 4,2 MB del pool: la richiesta parte con `cache:
  "no-cache"`, il server risponde 304 e il corpo lo mette il browser. Verificato
  su `vite preview`, che manda ETag e Last-Modified come li manda GitHub Pages.
  Il service worker riconosce quella richiesta proprio dal `no-cache` e la lascia
  passare: se rispondesse dalla sua cache, direbbe «non è cambiato» per sempre.
- Con il server spento l'app si apre lo stesso, mostra le 4.886 carte del pool
  tenuto in IndexedDB e la sua data, e non mostra nessuna schermata di guasto.
  In console il browser scrive comunque la sua riga sulla richiesta di rete
  fallita: è del browser, non dell'app, e non si può zittire da codice.
- La base di terre sui dati veri, per un mazzo nero-rosso da 28 carte: 22 terre,
  di cui 4 + 4 delle due sole terre doppie nero-rosse che **entrano dritte**, e
  14 terre base divise secondo i simboli chiesti. Nessuna terra girata: ce n'era
  abbastanza di dritte per riempire il posto.
- **Le terre che «producono un mana di un colore qualsiasi» non sono terre
  doppie**, anche se nei dati Scryfall risultano produrre tutti e cinque i
  colori: quel mana ha quasi sempre una condizione che i dati non raccontano.
  Si riconoscono dall'**identità di colore incolore**, ed è così che il codice
  le tiene fuori. Senza questo filtro, una base nero-rossa prendeva 28
  «terre doppie» fra cui parecchie che non fanno affatto quel che sembra.
- Avere tre terre al turno 3 giocando per primi, con 22 terre su 60, capita
  **circa il 72% delle volte**: è così per ogni mazzo, e non dipende dai
  colori. Per questo l'avviso «carta difficile» non guarda la probabilità
  assoluta — segnalerebbe ogni carta da tre mana in su — ma **quanto costano i
  colori**, cioè la distanza da una carta che costasse lo stesso senza simboli
  colorati. La soglia è in `src/mazzo/taratura.ts`, da ritarare alla sosta.
- **Quattro carte in Standard non hanno il limite delle quattro copie**: portano
  scritto «A deck can have any number of cards named …». Il limite si legge da
  quella frase, mai da un elenco di nomi nel codice — i nomi ruotano, la frase
  no. Un mazzo costruito attorno a una di quelle è esattamente il mazzo fuori
  meta per cui l'app esiste, e fermarlo a quattro sarebbe stato un errore
  dell'app, non una regola del gioco.
- La manopola delle terre è **limitata fra 16 e 30**, e il limite non è estetico:
  il conto delle probabilità è esatto, e il suo costo cresce in fretta. A 44
  terre su un mazzo a cinque colori si arriva a quasi un secondo per tocco, su
  un computer da scrivania.
- Il conto delle probabilità sul caso peggiore provato (mazzo a tre colori,
  quattordici costi diversi, pool vero) costa **circa 30 ms**: l'interfaccia lo
  rifà a ogni tocco sul numero di terre senza che si senta.
- Il **formato di scambio dei mazzi** porta un numero di formato in
  intestazione (`formato 1`) e dichiara quante carte contiene, con una riga
  finale di chiusura: è così che un testo tagliato da un programma di posta si
  riconosce come tagliato invece di importare mezzo mazzo in silenzio. Quando la
  richiesta crescerà col tema e il seme del motore, il numero di formato sale, e
  un'app vecchia sa dire «viene da una versione più recente».
- Il deposito IndexedDB è alla **versione 2**: due scaffali, il pool e i mazzi
  salvati. Una versione nuova aggiunge scaffali e non tocca quel che c'era.
- **In Standard ci sono 95 Goblin giocabili**, non quattordici come diceva il
  mockup iniziale. Il pool vero lo conferma. Conseguenza: l'esempio della schermata "tema troppo stretto"
  va ritarato su un vincolo davvero stretto, e quale sia lo si scoprirà solo
  facendo girare il motore sui dati veri.

## Mappa dei file

```
PROGETTO.md              documento d'intesa, le 32 decisioni
index.html               guscio della pagina
src/identita.ts          il nome dell'app: il solo punto in cui cambiarlo
src/dati/pool.ts         la forma del pool: solo tipi, nessun peso a runtime
src/dati/carica-pool.ts  la lettura del pool e la data dei dati, in italiano
src/dati/aggiornamento.ts quale pool si apre e cosa si fa di quel che arriva
src/dati/deposito.ts     IndexedDB: il pool fresco tenuto sul dispositivo,
                         e nessuna funzione che possa fallire rumorosamente
src/catalogo/filtri.ts   `cerca(carte, filtri)`: la cucitura del catalogo
src/catalogo/ricerca.ts  la ricerca per nome che perdona i refusi
src/catalogo/vocabolario.ts tipi e sottotipi ricavati dal pool, mai scritti
src/catalogo/pool-finto.ts il pool finto condiviso dai test
src/mazzo/probabilita.ts la probabilità di lanciare una carta al suo turno:
                         ipergeometrica multivariata esatta, condizione di Hall
                         sui colori, e le terre girate contate per quel che sono
src/mazzo/costo.ts       il costo di mana letto come richiesta di colori
src/mazzo/base-di-terre.ts `analizzaBaseDiTerre(...)`: la cucitura del ticket 06
src/mazzo/taratura.ts    ogni numero scelto a occhio, in un posto solo
src/mazzo/salvato.ts     la forma di un mazzo salvato: la lista **e la
                         richiesta** che l'ha prodotta, con la sua verifica
src/mazzo/scambio.ts     i due testi che escono dall'app: quello da scambiare
                         (che si rilegge) e la lista da torneo
src/dati/mazzi-salvati.ts i mazzi salvati in IndexedDB, e mai un'eccezione
src/componenti/          le schermate: Catalogo, PannelloFiltri, GrigliaCarte,
                         SchedaCarta, CostoDiMana, NoteLegali, Mazzo,
                         PassiDelleCopie, MazziSalvati
src/stili/catalogo.css   lo stile del catalogo, tutto a variabili del tema
src/stili/mazzo.css      lo stile della schermata del mazzo, stesse variabili
src/stili/salvati.css    lo stile della schermata dei mazzi salvati
public/dati/pool.json    il pool: prodotto di compilazione, in git, mai a mano
strumenti/prepara-pool.ts  da archivio Scryfall a pool — la cucitura di test 2
strumenti/tag-di-sinergia.ts le nove regole meccaniche + le correzioni a mano
strumenti/correzioni-tag.txt le correzioni a mano: file dell'uomo, mai riscritto
strumenti/aggiorna-pool.ts il comando `npm run dati`: scarica, filtra, racconta
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
