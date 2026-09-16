# Ripresa del lavoro — stato al 4 settembre 2026

Documento di passaggio: aprendo un nuovo terminale, leggi questo per primo,
poi `PROGETTO.md`.

---

## Dove siamo

L'intervista di progettazione è **chiusa**: 32 decisioni prese, tutte scritte in
`PROGETTO.md`. La configurazione delle skill di sviluppo è fatta. Il design
esiste, è pubblicato, ed è stato corretto sui dati reali di Scryfall.

La specifica e i quattordici ticket delle tappe 1-2 sono scritti, sotto
`.scratch/fondamenta-e-motore/`. **I ticket dal 01 al 12 sono implementati**:
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
lista da consegnare all'arbitro. E la tappa del motore è cominciata: l'utente
**dichiara il suo tema** — un sottotipo, dei colori, una cosa che le carte
sanno fare, una carta da cui partire, e quel che non vuole giocare — e l'app
gli dice subito, mentre lo costruisce, se con quelle carte un mazzo si fa. Se
non si fa, o se le carte bastano appena, propone di allargarlo: una strada per
volta, ciascuna con quante carte porterebbe dentro, e nessuna applicata finché
non la accetta. E adesso un mazzo **si prova**: la simulazione goldfish lo fa
giocare da solo per qualche centinaio di partite e ne ricava in quanti turni
chiude, quante mani rimescolerebbe, quante volte parte impiantato. Il caso è
governato da un seme che arriva da fuori: stessa richiesta, stesso risultato,
sempre. E adesso l'app sa dire **quanto è forte** un mazzo — non con un numero
solo, che non spiegherebbe niente, ma con cinque componenti tenute separate:
velocità e affidabilità, forma della curva, salute dei colori, densità di
sinergia, qualità delle singole carte. Ognuna porta con sé i valori grezzi che
la giustificano, perché saranno le spiegazioni a citarli. E adesso **l'app
costruisce**: si dichiara il tema, si preme un tasto, e in qualche secondo esce
un mazzo legale da sessanta carte con la sua base di terre. La ricerca parte da
un mazzo ragionevole, prova a cambiare una carta alla volta, tiene lo scambio se
il punteggio sale, e si rifà da tre partenze diverse tenendo la migliore.
Gira in un web worker, dice a che punto è, e ha un tetto di tempo: superato,
torna il meglio che ha trovato dichiarando di essersi fermata prima. E adesso
non ne costruisce uno ma **quattro o cinque**: la stessa ricerca ripetuta con
pesi diversi dati al tema, dal peso che lo rende inviolabile a quello che lo
ignora quasi del tutto, e i mazzi affiancati dal più fedele al più forte. Per
ognuno si legge quanto tema ha ceduto e quanta potenza ha guadagnato rispetto al
precedente: è il **tasso di cambio**, che è il fulcro dichiarato del progetto, e
dove fermarsi lo sceglie l'utente. E adesso l'app **spiega**: ogni carta del
mazzo si apre e dice perché è lì e perché in tante copie, sotto le terre c'è
com'è stata scelta la base, chiude l'elenco delle carte del tema rimaste fuori
col loro motivo, e fra un mazzo e il precedente c'è scritto in parole che cosa
si è comprato cedendo tema. Sono modelli di frase riempiti con numeri già
calcolati — nessun testo inventato, nessun modello linguistico — e stanno tutti
in un file solo, che si legge come si legge una pagina. Il prossimo è il
ticket 14: la **sosta e prova reale**, dove le tarature provvisorie si misurano
sui dati veri — e la prima misura è già stata fatta. Sul pool vero la frontiera
intera costava **centoquattro secondi** contro i quindici che l'app concedeva:
si apriva la schermata e si trovava un mazzo solo e una riga di scuse, cioè
l'app senza il suo fulcro. La causa non era la ricerca ma lo stesso conto esatto
rifatto migliaia di volte; ora le risposte si ricordano, e la frontiera è **sei
volte più veloce senza cedere un decimale**. E l'app **ha un nome**: si chiama
**Fucina**. E dal 4 settembre l'utente può **nominare una combo**: le carte che
secondo lui vincono se stanno insieme entrano nel mazzo al massimo delle copie,
la ricerca non le scambia via mai, e l'app dice la probabilità esatta di averle
in mano tutte al quinto turno — dichiarando per iscritto che non giudica se
quelle carte vincano, perché a dirlo è stato l'utente.

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

1. ~~Il nome dell'app.~~ **Fatto: si chiama «Fucina»** (`src/identita.ts`).
   ~~L'indirizzo web.~~ **Fatto: `https://oldpz.github.io/fucina/`.** Resta tuo
   il nome della **cartella** sul disco, e un dominio tuo se lo vorrai.
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

**Il fronte è fermo, e per una ragione sola: la sosta.** Al 4 settembre 2026 i
sei ticket della tappa 3 stanno così — `01` (i tag di Scryfall nel pool) e `05`
(la combo dichiarata) sono **fatti**, ed erano gli unici due che non
dipendevano da una taratura; `02`, `03`, `04` e `06` sono **bloccati**, tutti a
valle del ticket 14. La catena è
`sosta → 02 orologio e corsa → 03 archetipo misurato → 04 la strategia come
vincolo`, e non si può accorciare: il «controllo» non è misurabile senza
l'orologio, e il peso della corsa — sesta componente — va messo in mezzo ai
cinque che la sosta sta per ritarare.

**Che cosa un agente ha già apparecchiato** (4 settembre, in `.scratch/`, fuori
da git):

- `la-sosta.md` **rigenerato sul pool del 3 settembre** — quello sul disco
  veniva dal pool del 2, e diversi numeri si erano mossi;
- `guida-alla-sosta.md`, **nuovo**: l'ordine in cui guardare le tarature e
  perché quell'ordine, dove abita ogni numero (file e riga), e la domanda a cui
  la lettura deve rispondere. Non decide niente;
- il **punto 9** del ticket 14: il divario dei temi senza creature non si è
  mosso di un centesimo col pool nuovo, ma **il punto 3 va riletto** — le
  densità di sinergia non sono più accalcate sul tetto, e l'ipotesi che il tetto
  *plasmi* le liste va verificata prima di sceglierci sopra un numero.

Quel che resta è di una persona: leggere le liste con l'occhio di chi gioca al
negozio, leggere le spiegazioni a voce alta, e **cronometrare sul telefono
vero** — la sola misura che nessuno ha ancora fatto.

Il ticket 13 è chiuso. **Il 14 non è per un agente**: porta scritto
`Status: ready-for-human` ed è un giudizio — *questo mazzo lo porterei al
negozio?*, *le spiegazioni si capiscono lette a voce alta?*. Un agente può
apparecchiarlo (generare le frontiere di cinque temi veri in un file da leggere)
ma non risponderci.

**Il ticket 14 porta una casella nuova, ed è la più grossa: la potenza oggi è
una misura da aggro.** Il ticket sta in `.scratch/`, che è fuori da git, quindi
il riassunto va tenuto qui — è l'unico posto pubblico dove si legge.

La simulazione goldfish, di ogni carta, legge **quattro cose**: se è una terra,
il costo, la forza, il valore di mana. **Il testo non lo legge**, e nemmeno i
tag. Dentro la simulazione un mazzo che vince a fulmini fa zero danno, una carta
che pesca non pesca, un controllo risulta lentissimo, un combo è invisibile. E
la simulazione non è un angolo del punteggio: è la velocità (peso **0,30**) ed è
il turno di chiusura da cui la curva (0,15) ricava la sua forma attesa — cioè
**quarantacinque centesimi** del punteggio che, fuori dall'aggro a creature,
misurano la cosa sbagliata. Non è un guasto ma una conseguenza di Q4 (niente
motore di regole) che nessuno aveva ancora scritto per intero.

Regge il resto, e limita quanto c'è da aggiustare: la curva **non impone un
archetipo** (si confronta con la forma attesa per la velocità misurata di *quel*
mazzo), la qualità (0,20) premia già rimozione e vantaggio in carte per tag, la
sinergia (0,15) dice qualcosa di come il mazzo vuole funzionare. Un controllo
prende credito parziale su 0,35 ed è penalizzato in struttura sullo 0,45: non è
ignorato, è **sottovalutato in modo sistematico**, che è peggio — la ricerca a
scambi singoli ottimizza contro quella sottovalutazione e va a cercarsi le
creature.

Perché è roba da sosta e non da adesso: se i cinque temi provati sono tutti temi
a creature, **la sosta passa senza accorgersene**. Per questo il ticket ora
chiede un tema che non vinca con le creature. Le tre strade — dichiararlo e
basta; dare un danno alle magie per tag; togliere la velocità dal conto quando
il mazzo non chiude — stanno scritte nel ticket coi loro costi. Nessuna va
implementata prima della sosta, ma **la prima va fatta comunque**: oggi l'app
darebbe a quel mazzo una lista peggiore di quella che poteva dargli senza
dirlo, e le spiegazioni citerebbero numeri veri su una misura che non c'entra.

Il discorso aperto quando la sessione si è chiusa era **dove pubblicare l'app**:
è fatto. Fucina sta su **https://oldpz.github.io/fucina/**, repo pubblico
`oLdpZ/fucina`, e si ripubblica da sola a ogni spinta su `main` — ma solo se i
test passano e i tipi tornano (`.github/workflows/pubblica.yml`).

Ordine di realizzazione deciso (da `PROGETTO.md` §4): fondamenta → motore →
**sosta e prova reale** → galleria e budget → ciclo iterativo → meta → sideboard.

## La tappa 3, decisa il 3 settembre 2026 — strategia e avversario

Da un'intervista con l'utente. **Le decisioni stanno in `docs/adr/` e il
vocabolario in `CONTEXT.md`, che sono in git**; i sei ticket stanno in
`.scratch/strategia-e-avversario/`, che non lo è.

L'utente ha chiesto tre cose: poter legare il mazzo a una **strategia di
vittoria** e non solo alle creature; **battere un mazzo del meta** con un mazzo
inedito; e che il sistema **capisca le regole del gioco**. Le ultime due sono la
stessa richiesta — per dire «questo mazzo batte il mono-rosso» bisogna far
giocare i due mazzi, cioè sapere cosa fa ogni carta — ed è un motore di regole.

Che cosa si è deciso, in breve:

- **La strategia si dichiara, l'archetipo si misura** (ADR-0001). Quattro
  etichette all'ingresso — aggro, controllo, midrange, combo — trattate come
  **vincolo duro**, mai come peso: un peso creerebbe un secondo tasso di cambio
  invisibile, e la frontiera esiste per rendere visibile l'unico che c'è. La
  verifica è **per comportamento misurato, mai per composizione**: il ticket 10
  **non è ribaltato**. Un conto grossolano — la **guardia** — parla prima di
  costruire, e solo quando è certo.
- **L'avversario è un orologio** (ADR-0002): tre numeri compilati a mano, e la
  **corsa** come sesta componente del punteggio. Gli orologi li scrive
  **l'utente**, perché il meta del suo negozio non è il meta di internet.
- **Il motore di regole è rimandato, non escluso.** Q4 resta in piedi, e l'ADR
  scrive a quali condizioni si riaprirebbe.
- **I tag di Scryfall si affiancano ai nove** (ADR-0003), congelati nel pool a
  compilazione: l'app non li interroga a runtime e il determinismo non si tocca.
- **La combo si dichiara nominando le carte** (ticket 05, fatto il 3 settembre
  2026). L'app non giudica se vincano: mette i pezzi nel mazzo al massimo delle
  copie, non li scambia via mai, e dice la probabilità **esatta** di averli in
  mano tutti al turno `TURNO_DELLA_COMBO`. Il patto — *non giudico, l'hai detto
  tu* — è scritto sullo schermo, non solo nel codice.
- **Il destinatario è un giocatore esperto** — Q7 di `PROGETTO.md` era sbagliata
  ed è corretta. La sua seconda metà regge: *ogni scelta va motivata a parole*
  non era una concessione ai principianti.

### Perché niente motore di regole — i numeri, da non ri-cercare

Verificati il 3 settembre 2026 contro fonti vive; per esteso in ADR-0002.

- **Magic è dimostrato indecidibile** (arXiv:1904.09828, LIPIcs FUN 2021):
  l'esito di una partita a mosse forzate equivale al problema della fermata.
- **Nessun motore maturo esiste in JavaScript.** L'unico percorso vivo verso il
  browser è **Manabrew** (Forge portato in Rust → WebAssembly): repo del 18
  maggio 2026, pre-release, copertura carte parziale, AGPL-3.0+.
- **Nessun port di Forge o XMage nel browser.** *Forge Web* è solo spettatore,
  col motore Java su un server.
- Il costo: XMage 19.200 carte in **quindici anni** di comunità; Argentum, una
  persona nel 2026, **41.000 righe di Kotlin + 12.000 di TypeScript** partendo
  da *Portal* e con copertura ancora parziale.
- **Non esiste alcun formato pubblico che dica cosa fa una carta**: Scryfall e
  MTGJSON danno metadati più `oracle_text` in inglese. Le sole approssimazioni
  sono gli script carta di Forge (DSL, GPL-3.0) e i tag di Scryfall Tagger.
- Il costo di calcolo: ~5 s per 300 partite con IA proxy (Q-DeckRec,
  arXiv:1806.09771) diventa **~43 minuti per una frontiera** contro i 17 secondi
  di oggi — ~150 volte più lento, e sul telefono peggio.
- **Quel che l'utente ha chiesto esiste già**: Grim.Cards fa giocare i mazzi
  contro un gauntlet del meta con una build custom di Forge **su un server**. La
  loro avvertenza: quel che si misura è *«AI engine behavior»*, non come gioca
  una persona.

## La pubblicazione — fatta il 3 settembre 2026

Fucina è online: **https://oldpz.github.io/fucina/**, repo pubblico
`oLdpZ/fucina`. È l'indirizzo da dare all'amico dell'utente, e da lì la PWA si
installa sul telefono.

Come sta messa:

- `.github/workflows/pubblica.yml` compila a ogni spinta su `main`, ma **solo se
  i test passano e i tipi tornano**. Quel che sta online non si può caricare a
  mano. Per ripubblicare senza un commit finto: `gh workflow run pubblica.yml`;
- GitHub Pages è configurato con sorgente **workflow**, non «da branch»: il
  ramo `main` non contiene `dist/`, che resta in `.gitignore`;
- il `README.md` porta con sé le **note legali** dell'app. Su un repo pubblico
  servono lì quanto dentro la schermata: sono la condizione che rende legittimo
  l'uso dei dati delle carte, e la gratuità è parte di quella condizione.

Verificato dal vivo sull'indirizzo pubblico, non dedotto:

- `pool.json` è 4,2 MB grezzi e GitHub Pages lo serve **compresso a 674 KB**: la
  stima di 640 KB reggeva. Dal 3 settembre 2026, coi tag di Scryfall dentro
  (ADR-0003), sono **5,1 MB grezzi e 865 KB compressi**: un quinto in più, che
  è il prezzo dichiarato di avere una parola per le contromagie;
- **il controllo di freschezza del ticket 05 funziona sull'host vero**, ed era
  la ragione dichiarata per scegliere Pages e non un altro: richiesta
  condizionale col suo ETag, risposta **304 con corpo di zero byte**. Non i
  4,2 MB. È il pezzo che decide se un'app installata continua a servire carte
  bandite;
- `sw.js` e `manifest.webmanifest` rispondono 200 dal sottopercorso: `base:
  "./"` fa il suo lavoro e l'app si installa.

Resta all'utente, se vorrà: un **dominio suo** (Pages lo regge, https compreso),
e il nome del repo, che oggi è `fucina` e determina l'indirizzo — cambiarlo dopo
che qualcuno ha installato l'app costa caro, perché la PWA si lega all'origine.

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
  *Superato:* il tetto si legge ancora dal testo, ma l'app di una carta così ne
  mette quattro — trentatré copie della stessa carta sono un mazzo legale che
  non è un mazzo (`copieAlMassimo` in `src/mazzo/copie.ts`). Dal ticket 29 di
  `old-school-italiano` vale anche per gli scambi della ricerca.
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
  mockup iniziale. Il pool vero lo conferma. Conseguenza: l'esempio della
  schermata "tema troppo stretto" va ritarato su un vincolo davvero stretto, e
  quale sia lo si scoprirà solo facendo girare il motore sui dati veri.
- Con le soglie provvisorie del ticket 08, sui dati veri: i Goblin (95 carte)
  sono un tema **ampio**; i Draghi (75) pure; i **Draghi rossi sono 30**, cioè
  «stretto», ed è il primo esempio vero di tema che sta appena in piedi.
  Accettando il primo allargamento proposto — le carte che fanno pedine Dragon —
  diventano 41 e il tema torna comodo. Un sottotipo che non esiste dà zero carte
  e verdetto «impossibile» (oggi «insufficiente», ticket 70), senza cadere.
- Il verdetto sul tema costa **circa 3 ms** sul pool vero quando il tema è
  ampio, e **una decina** quando ci sono anche gli allargamenti da proporre —
  ognuno è un passaggio in più sul pool. La primissima valutazione ne costa
  una sessantina, perché è lì che si costruiscono una volta sola le parole dei
  testi. Si rifà comunque a ogni tocco, ed è per questo che l'avviso arriva
  prima di generare e non dopo.
- I posti non-terra da riempire sono **33** (sessanta carte meno il *massimo*
  delle terre): è il conto che decide se un tema è *insufficiente*, e non è una
  taratura. Si prende il massimo perché è il caso più favorevole al tema —
  più terre, meno posti da riempire con le sue carte — e dire «insufficiente» a
  un tema che ce l'avrebbe fatta sarebbe un errore dell'app. La soglia di
  *stretto* — quaranta carte distinte — invece è una taratura, sta in
  `src/tema/taratura.ts` ed è da ritarare alla sosta.
- Il punteggio non restituisce **nessun totale**: le cinque componenti stanno
  separate, e chi ne vuole uno solo — la ricerca del ticket 11 — chiama
  `combina`. Non è pignoleria: sommarle nella risposta vorrebbe dire perdere
  proprio i numeri che le spiegazioni devono citare.
- **La forma attesa della curva non è una sola**: è quella della velocità del
  mazzo, e la velocità la dice la simulazione, non un archetipo scritto nel
  codice. Un mazzo che chiude al quarto turno si confronta con una curva bassa,
  uno che chiude al decimo con una alta.
- **La qualità di una carta non la punisce per il costo**, se non attraverso
  l'efficienza: un 8/8 da sette mana ha qualità piena, ed è la *forma della
  curva* a dire che un mazzo di soli 8/8 non sta in piedi. Le due componenti
  rispondono a due domande diverse, e sovrapporle vorrebbe dire contare due
  volte lo stesso difetto.
- La *salute dei colori* si misura come quota di probabilità **conservata**
  rispetto alla stessa carta senza simboli colorati: è la stessa lettura
  dell'avviso «carta difficile» del ticket 06, e per la stessa ragione — la
  probabilità assoluta parlerebbe del costo, non dei colori.
- La ricerca a scambi singoli sul pool vero, tema Goblin, misurata al ticket 11
  con le manopole di allora (quattro partenze da quattrocento valutazioni):
  **milleseicento scambi provati, un centinaio tenuti, sei secondi** su un
  computer da tavolo. Ne esce un mazzo da sessanta carte con purezza 1. Le
  manopole sono scese al ticket 12 e il numero va rimisurato alla sosta. Il tetto
  che si tocca per primo è quello delle **valutazioni**, non quello del tempo, ed
  è apposta: il tetto di tempo può solo fermare prima, e il determinismo regge
  solo finché a fermare è il conto delle valutazioni.
- **L'orologio della ricerca arriva da fuori**, come il seme. Non è pignoleria:
  un orologio letto di nascosto renderebbe il mazzo dipendente da quanto è
  veloce il telefono, e il vincolo di determinismo di `CLAUDE.md` sarebbe carta
  straccia. Il worker passa quello vero, i test ne passano uno fermo.
- Tutte le valutazioni di una ricerca usano **lo stesso seme**: due mazzi vanno
  confrontati sulle stesse partite, se no quel che si misura è la differenza fra
  due mescolate e non quella fra due mazzi.
- Durante la ricerca si simulano **quaranta** partite per mazzo provato, non le
  cinquecento della schermata: lì serve solo dire quale di due mazzi è meglio. Il
  vincitore si rivaluta per intero, ed è quello il numero che l'utente legge.
  Erano sessanta fino al ticket 11: dal 12 il tetto di tempo paga **cinque**
  ricerche invece di una, e le manopole sono scese di conseguenza (partenze 4→3,
  partite 60→40, valutazioni per partenza 400→260).
- **La frontiera si ottiene facendo scorrere un solo numero**: il peso dato alla
  purezza accanto alle cinque componenti. `PESI_DELLA_PUREZZA` ne elenca cinque,
  da 200 a 0,05. Duecento non è un peso ma un divieto: una copia in più nel tema
  vale circa tre centesimi di purezza, e tre centesimi per duecento battono
  qualunque guadagno di potenza esista — è così che il primo mazzo ha la purezza
  massima raggiungibile, senza che nessuna riga di codice la imponga.
- **Un mazzo che cede tema senza guadagnare potenza non entra nella frontiera.**
  Senza quel taglio la frontiera sarebbe l'elenco di quel che la ricerca ha
  trovato; con quel taglio è il tasso di cambio, e la promessa «purezza e
  potenza si muovono in direzioni opposte» è vera per costruzione e non per
  fortuna. Vale anche per i duplicati: due pesi che convergono sullo stesso
  mazzo lo mostrano una volta sola, se no la frontiera direbbe che c'è un passo
  dove non c'è.
- Ogni mazzo della frontiera si **rivaluta per intero dentro il suo passo**, non
  alla fine: purezza e potenza dei mazzi si confrontano fra loro, e confrontare
  una misura piena con una sbrigativa direbbe che un passo ha guadagnato quando
  invece ha solo misurato meglio.
- Le **candidate si riscelgono a ogni peso**: col tema inviolabile devono entrare
  nel giro le carte del tema, col tema quasi ignorato le più forti. Un elenco
  solo, scelto a un peso di mezzo, taglierebbe fuori proprio le carte su cui i
  due estremi della frontiera si giocano.
- Sul pool finto, tema Goblin, **seme 7**, con le manopole spedite: la frontiera
  intera costa **circa sette secondi** su un computer da tavolo e conta
  **quattro** mazzi — purezza 1,0000 → 0,9737 → 0,8684 → 0,6410, potenza
  0,7922 → 0,8067 → 0,8182 → 0,8296. La ricerca è tutta seminata: questi numeri
  si rifanno identici, e se un giorno non tornano è cambiato qualcosa.
- Il tetto di tempo predefinito è **sessanta secondi**, salito dagli otto del
  ticket 11 e dai quindici del 12. Il troncamento si dichiara sempre — è onesto
  — ma consegnare un pezzo di frontiera per difendere l'attesa vuol dire
  difendere la cosa sbagliata: la frontiera è il fulcro del progetto. E il
  pezzo che si perde non è la coda: i mazzi che sopravvivono ai tagli vengono
  dal peso 200 e dal peso 0,15, che è il **quarto** dei cinque, quindi una
  frontiera troncata a metà è quasi sempre un mazzo solo. Alzare il tetto non
  cambia nessun risultato — a fermare la ricerca è il tetto delle valutazioni —
  e l'attesa si sopporta perché **si vede**: la riga dell'avanzamento dice a che
  mazzo è arrivata, e il tasto «Ferma» c'è.

### La prima misura sul pool vero (3 settembre 2026)

Fatta sul computer da tavolo, dalla schermata e dal motore. **Quanto ci metta un
telefono vero resta da misurare**, ed è la casella aperta del ticket 14.

- Il costo di una valutazione **esplode coi colori**, perché il conto delle
  probabilità è esatto: 3,2 ms su un mazzo monocolore, 7,1 a tre colori, **24,7
  a quattro**, 30,5 a cinque. E i pesi bassi della frontiera — quelli che
  ignorano il tema — producono proprio le pile a quattro colori: lì se ne andava
  quasi tutto il tempo.
- La stessa domanda veniva rifatta migliaia di volte. Ricordare le risposte
  (`GIA_CALCOLATE` in `mazzo/probabilita.ts`) ha reso la frontiera **sei volte
  più veloce senza cambiare un decimale**: Goblin 104 s → 17 s, Draghi rossi
  99 s → 13 s, tutto il rosso 39 s → 8 s, con mazzi e numeri identici. Un test
  lo tiene fermo: ogni domanda deve dare la risposta che avrebbe avuto da sola.
- Con le risposte ricordate una valutazione costa **2,8 ms** anche a quattro
  colori, e i due terzi sono la **simulazione goldfish**. Quel che resta da
  guadagnare sta lì, e non è più spreco: è lavoro vero.
- La frontiera sul pool vero: **Goblin 2 mazzi** (tema 100% potenza 86,8 → tema
  48,6 potenza 87,2), **Draghi rossi 4 mazzi**, **tutto il rosso 2 mazzi**.
- Il peso **0,05** sembrava da togliere — da solo costava il 70% del tempo, e su
  tre temi su quattro il suo mazzo veniva scartato comunque. Ma sul tema
  **stretto** è l'unico che arriva in fondo: sui Draghi rossi porta il quarto
  mazzo, da 45,5% di tema e 85,9 di potenza a 28,6 e 87,1. Toglierlo avrebbe
  risparmiato tempo proprio sui temi per cui l'app esiste. Resta.
- Il peso **1** non è sopravvissuto ai tagli in nessuna delle quattro prove: è
  il primo indiziato della prossima sosta, ma quattro misure non bastano.
- Il merito delle carte si calcolava **dentro il confronto** dell'ordinamento
  delle candidate: cinquanta millesimi di secondo per peso invece di cinque, su
  quattromilaottocento carte. Ora si calcola una volta per carta.
- La probabilità che il punteggio calcola per ogni carta è quella di **avere il
  mana** per lanciarla al suo turno, e **non dipende da quante copie** ce ne
  sono: due copie o quattro, il numero è lo stesso. Spiegare «perché quattro
  copie e non due» con quel numero sarebbe falso, ed è per questo che
  `mazzo/probabilita.ts` ha anche `probabilitaDiPescarne` — la probabilità
  esatta di averne pescata almeno una entro un turno. Quattro copie su sessanta
  carte al primo turno: **39,9%**, il numero che ogni giocatore conosce.
- Sul pool vero, tema Goblin, seme 7, la frontiera conta **due** mazzi: il primo
  con 40 carte non-terra tutte del tema e 20 terre, il secondo che cede 13 copie
  al tema (fedeltà dal 100% al 62,9%) per guadagnare un punto di potenza
  (86,0% → 87,0%) e che chiude **più tardi**, al turno 6,5 invece che al 5,8. Il
  baratto non è sempre «più veloce»: è «più forte».
- Due mazzi vicini della frontiera possono chiudere **allo stesso turno medio**
  una volta arrotondato. La frase del passo sceglie perciò il numero che dice
  qualcosa — turno medio, poi quota di partite chiuse, poi nessuno dei due — e
  non scrive mai «al turno 5,7 invece che al turno 5,7».
- **La misura da aggro non è più un sospetto, è misurata** (2026-09-03, sei temi
  sul pool vero, seme 7). Un mazzo **senza creature** prende **metà** del voto
  di velocità di uno di creature — 0,42 contro 0,83 — e non chiude **mai**, non
  «tardi»: mai, in 500 partite su 500. La potenza cala di **due decimi**. E la
  sua frontiera è **piatta**: tre millesimi di potenza comprati cedendo il 18%
  del tema, cioè il tasso di cambio che non dice niente proprio dove servirebbe.
- **Le carte a due facce mascheravano il difetto.** Un tema «istantanei e
  stregonerie» senza escludere le creature dà un mazzo con potenza 0,81 che
  chiude al turno 7,5 e sembra sano: è pieno di carte a due facce, che nei dati
  hanno **entrambi i tipi** e la forza della faccia creatura. Purezza 1,0000 —
  l'app dichiara «100% del tema» per quello che in partita è un mazzo di
  creature. Dai numeri non si vede: si vede solo leggendo la lista.
- **La densità di sinergia vale 1,000 su nove mazzi da sei temi diversi**, e i
  grezzi dicono perché: le densità vere sono 0,1508 · 0,1606 · 0,1636 · 0,1711 ·
  0,1765 · 0,1987 · 0,2168 · 0,2773 · 0,2773 contro un tetto di **0,15**. Cinque
  su nove si accalcano **appena sopra** il tetto — la più bassa otto
  diecimillesimi sopra — perché oltre non paga più: la ricerca ci arriva e si
  ferma. Il tetto non misura i mazzi, li **plasma**, e alzarlo cambierebbe le
  liste e non solo i voti. Quindici centesimi di punteggio che oggi non
  distinguono niente.
- **Dentro un `FiltroTema` le categorie si sommano in *and*.** Escludere
  «Creature» e «produce-pedine» insieme esclude le sole creature che fanno
  pedine, non le creature. Per le esclusioni è probabilmente la semantica
  sbagliata: chi le scrive intende un *or*.
- **La simulazione non legge il testo delle carte.** `leggi()` in
  `mazzo/simulazione.ts` ricava di ogni carta quattro cose sole: terra o no,
  costo di mana, forza, valore di mana. Nessun tag, nessuna riga di oracolo. È
  la ragione per cui la potenza è oggi una misura da aggro, ed è la casella
  aperta più grossa del ticket 14 — vedi «Prossimi comandi» qui sopra.
- Sul repo pubblico **`.scratch/` non c'è**: i quattordici ticket vivono solo su
  questo computer. Quel che deve sopravvivere a un clone va scritto qui dentro.
- Le coppie di tag che «si attivano a vicenda» sono **quattro**, e l'elenco è
  corto di proposito come le regole dei tag: `accelerazione-di-mana` non
  compare perché accelera le carte care, che non sono un tag, e `spazza-via`
  non compare perché con le pedine litiga invece di collaborare.

## Mappa dei file

```
PROGETTO.md              documento d'intesa, le 32 decisioni
CONTEXT.md               il vocabolario: tema, strategia, archetipo, guardia,
                         orologio, corsa, purezza — e le parole da non usare
docs/adr/                le decisioni difficili da tornare indietro, ognuna con
                         le sue condizioni di riapertura
README.md                la porta del repo pubblico, e le note legali con lui
.github/workflows/pubblica.yml  compila e pubblica su Pages, ma solo se i test
                         passano: quel che sta online non si carica a mano
index.html               guscio della pagina
src/identita.ts          il nome dell'app: il solo punto in cui cambiarlo
src/dati/pool.ts         la forma del pool: solo tipi, nessun peso a runtime
src/dati/carica-pool.ts  la lettura del pool e la data dei dati, in italiano
src/dati/formato.ts      la forma del documento di formato: solo tipi
src/dati/carica-formato.ts la lettura del documento di formato, le voci ancora
                         da confermare, e il controllo che i nomi di carta che
                         nomina esistano davvero
src/dati/aggiornamento.ts quale pool si apre e cosa si fa di quel che arriva
src/dati/deposito.ts     IndexedDB: il pool fresco tenuto sul dispositivo,
                         e nessuna funzione che possa fallire rumorosamente
src/catalogo/filtri.ts   `cerca(carte, filtri)`: la cucitura del catalogo
src/catalogo/ricerca.ts  la ricerca per nome che perdona i refusi
src/catalogo/vocabolario.ts tipi e sottotipi ricavati dal pool, mai scritti
src/catalogo/pool-finto.ts il pool finto condiviso dai test
src/tema/tema.ts         il tema come oggetto: appartenenza e purezza, e le
                         esclusioni che vincono sempre
src/tema/allargamenti.ts le proposte per allargare un tema stretto, con le
                         frasi che le dicono ad alta voce
src/tema/ampiezza.ts     `valutaTema(...)`: insufficiente, stretto o ampio
src/tema/taratura.ts     le soglie del tema, dichiarate provvisorie
src/combo/combo.ts       la combo dichiarata: i nomi che l'utente afferma
                         vincano insieme, risolti sul pool di oggi. L'app non la
                         capisce, ci crede — vincolo duro, mai un peso
src/combo/taratura.ts    il turno della combo (taratura da sosta) e quante
                         carte al massimo si possono nominare
src/mazzo/probabilita.ts la probabilità di lanciare una carta al suo turno:
                         ipergeometrica multivariata esatta, condizione di Hall
                         sui colori, e le terre girate contate per quel che sono;
                         e la probabilità di avere in mano tutti i pezzi di una
                         combo dichiarata, per inclusione-esclusione
src/mazzo/costo.ts       il costo di mana letto come richiesta di colori
src/mazzo/base-di-terre.ts `analizzaBaseDiTerre(...)`: la cucitura del ticket 06
src/mazzo/taratura.ts    ogni numero scelto a occhio, in un posto solo
src/caso.ts              il generatore col seme, e il mescolare che ne discende
src/mazzo/simulazione.ts la simulazione goldfish, con le regole del gioco finto
                         scritte per intero in testa al file
src/punteggio/punteggio.ts `valutaMazzo(...)`: le cinque componenti tenute
                         separate, ognuna coi suoi valori grezzi
src/punteggio/taratura.ts tutti i pesi del punteggio, in un punto solo
src/spiegazioni/frasi.ts **tutti i modelli di frase**, in italiano e in un posto
                         solo: si leggono di seguito senza aprire altro, ed è
                         quel che il ticket 13 chiede
src/spiegazioni/spiegazioni.ts `spiegaFrontiera(...)`: sceglie i numeri —
                         sempre quelli già calcolati dal punteggio — e non
                         scrive nemmeno una parola di italiano
src/ricerca/costruisci.ts `costruisciMazzo(richiesta, pool)`: **la cucitura
                         principale** — la ricerca a scambi singoli e la
                         frontiera che ne nasce facendo scorrere il peso del
                         tema; pura, col caso e l'orologio che arrivano tutti e
                         due da fuori
src/ricerca/taratura.ts  le manopole della ricerca, sovrascrivibili da fuori
src/ricerca/protocollo.ts le poche frasi fra interfaccia e worker: solo tipi
src/ricerca/motore.worker.ts il motore in un thread suo: nessuna decisione,
                         solo il passaggio dei messaggi e l'orologio vero
src/ricerca/usa-motore.ts il worker visto dall'interfaccia. Vive nell'App e non
                         nella schermata, se no cambiare pagina ucciderebbe la
                         ricerca — cioè la cosa che il worker esiste per
                         permettere
src/mazzo/salvato.ts     la forma di un mazzo salvato: la lista **e la
                         richiesta** che l'ha prodotta, con la sua verifica
src/mazzo/scambio.ts     i due testi che escono dall'app: quello da scambiare
                         (che si rilegge) e la lista da torneo
src/dati/mazzi-salvati.ts i mazzi salvati in IndexedDB, e mai un'eccezione
src/componenti/          le schermate: Catalogo, PannelloFiltri, GrigliaCarte,
                         SchedaCarta, CostoDiMana, NoteLegali, Mazzo,
                         PassiDelleCopie, MazziSalvati, Vincoli, Combo,
                         Costruzione
src/stili/catalogo.css   lo stile del catalogo, tutto a variabili del tema
src/stili/mazzo.css      lo stile della schermata del mazzo, stesse variabili
src/stili/salvati.css    lo stile della schermata dei mazzi salvati
src/stili/vincoli.css    lo stile della schermata del tema, stesse variabili
src/stili/costruzione.css lo stile del tasto che costruisce, del suo esito e
                         della striscia dei mazzi affiancati
src/stili/combo.css      lo stile del riquadro della combo dichiarata
public/dati/pool.json    il pool: prodotto di compilazione, in git, mai a mano
public/dati/formato.json il documento di formato: l'opposto del pool — lo
                         scrive una persona, si corregge a mano, e nessun
                         comando lo rigenera (ADR-0004)
strumenti/prepara-pool.ts  da archivio Scryfall a pool — la cucitura di test 2.
                         Il formato entra come parametro: tre passi, chi entra
                         (il criterio, oggi l'edizione), cosa si mostra (la
                         prima lingua ammessa che esista) e quanto costa (la
                         copia ammessa più economica col listino)
strumenti/materiale-di-prova/frammento-scryfall.json  il frammento d'archivio
                         dei test, scritto sui casi difficili di questo pool
strumenti/materiale-di-prova/formato-finto.json  il documento di formato dei
                         test: la forma di quello vero, e nessun suo contenuto
strumenti/tag-di-sinergia.ts le nove regole meccaniche + le correzioni a mano
strumenti/correzioni-tag.txt le correzioni a mano: file dell'uomo, mai riscritto
strumenti/aggiorna-pool.ts il comando `npm run dati`: legge il documento di
                         formato, scarica `all-cards` (tutte le lingue), filtra,
                         racconta il diario e i buchi
strumenti/apparecchia-la-sosta.ts  fa girare il motore sui dati veri per sei
                         temi e ne scrive un documento da leggere. Apparecchia
                         il ticket 14, non lo risolve: i giudizi vogliono una
                         persona. Da rifare dopo ogni ritaratura
strumenti/risolvi-ts.mjs il gancio che fa risolvere a Node gli import di `src/`,
                         che finiscono in `.js`. Solo per gli strumenti
src/stili/tema.css       colori e caratteri: le quattro direzioni, in un file
src/stili/direzione.ts   quale direzione è attiva
src/sw.js                service worker (elenco risorse scritto dalla build)
strumenti/               manifest e icone, generati a ogni compilazione
CLAUDE.md                contesto + vincoli non negoziabili + config skill
HANDOFF.md               questo file
docs/agents/             dove vivono ticket, etichette, documenti di dominio
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
