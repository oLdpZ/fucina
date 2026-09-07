# Il vocabolario di Fucina

Le parole con cui questo progetto parla di sé. Chi scrive codice, ticket o
spiegazioni usa **queste**, non i loro sinonimi: metà dei pasticci di questo
dominio nascono da tre parole che sembrano intercambiabili e non lo sono.

Le decisioni difficili da tornare indietro stanno in `docs/adr/`; qui ci sono
solo i termini.

---

## Tema

**Quel che l'utente vuole giocare.** Un sottotipo, dei colori, una cosa che le
carte sanno fare, una carta da cui partire, e quel che non vuole vedere nel
mazzo. È il vincolo che l'utente si dà da sé, ed è la ragione per cui l'app
esiste: senza tema, la risposta migliore sarebbe copiare una decklist dal meta.

Vive in `src/tema/tema.ts` come `Tema`: `inclusioni`, `esclusioni`, `seme`
(il **nome** di una carta, mai l'oggetto), `allargamenti` accettati.

Il tema **non dice come si vince**. Dice cosa c'è dentro.

## Purezza

**Quanta parte del mazzo appartiene al tema**, fra zero e uno. È uno dei due
assi della frontiera. Non è una percentuale di gradimento: è un conto sulle
copie.

## Strategia

**Come l'utente intende vincere.** Il secondo ingresso, accanto al tema, e
facoltativo: senza, l'app costruisce come ha sempre costruito.

Ne esistono quattro: **aggro**, **controllo**, **midrange**, **combo**.

La strategia è un **vincolo duro**, mai un peso. L'app costruisce solo mazzi che
la soddisfano; se col tema dato non si può, lo dice. Il perché sta in
[ADR-0001](docs/adr/0001-strategia-dichiarata-verificata-per-comportamento.md):
un peso creerebbe un secondo tasso di cambio invisibile, e la frontiera esiste
per rendere visibile l'unico che c'è.

Attenzione a non confonderla col tema: *«Goblin»* è un tema, *«aggro»* è una
strategia, e **si scelgono separatamente**. Un tema Goblin può fare un aggro o
un midrange; un tema di draghi giganti non farà mai un aggro, e l'app lo dice.

## Archetipo

**Il comportamento che il mazzo mostra davvero quando lo si fa giocare.**

Strategia e archetipo sono la stessa parola vista dalle due parti: la strategia
è quel che l'utente **dichiara**, l'archetipo è quel che l'app **misura**. Non
sono sinonimi e non vanno usati l'uno per l'altro: la distanza fra i due è
esattamente ciò che l'app verifica.

L'archetipo si ricava **dal comportamento misurato, mai dalla composizione del
mazzo**. Nessun elenco di archetipi è scritto nel codice come regola su cosa un
mazzo debba contenere — è la stessa ragione per cui la forma attesa della curva
viene dalla velocità misurata e non da un archetipo scritto a mano.

## Guardia

**Il conto grossolano che parla prima di costruire, e solo quando è certo.**

Serve a dire *«con questo tema un aggro non si fa»* senza dover prima costruire
— cosa che con l'archetipo misurato sarebbe impossibile. La guardia guarda la
composizione, ma **non definisce l'archetipo**: lo esclude quando è ovvio, e
tace in ogni altro caso.

È il principio già scritto in testa ai tag di sinergia — *le regole preferiscono
tacere che sbagliare* — applicato a un problema nuovo. Una guardia che sbaglia
dicendo «impossibile» a un tema che ce l'avrebbe fatta è un guasto dell'app; una
guardia che tace troppo spesso è solo una guardia timida.

## Orologio

**Un mazzo avversario ridotto a pochi numeri**, compilati a mano: il turno in
cui chiude, quante rimozioni porta, quante contromagie.

L'app **non conosce nessuna carta dell'avversario** e non la vuole conoscere:
saperlo richiederebbe un motore di regole, che
[ADR-0002](docs/adr/0002-avversario-come-orologio-motore-di-regole-rimandato.md)
rimanda. L'orologio è una caricatura dichiarata, non un avversario.

Gli orologi li scrive **soprattutto l'utente**: il meta del suo negozio non è il
meta di internet, e chi ci gioca il venerdì sa quali mazzi incontra. Il file del
manutentore serve solo perché la prima schermata non sia vuota.

## Corsa

**Il confronto fra il mazzo e un orologio**: chi chiude per primo, e che cosa
resta del mazzo dopo le rimozioni dell'avversario.

L'esito della corsa è la **sesta componente del punteggio**, accanto alle
cinque. Sta nel punteggio e non accanto al mazzo perché altrimenti l'app
saprebbe dirti che perdi senza costruire per non perdere.

## Potenza

**Le componenti del punteggio messe insieme**, e mai un numero che l'app
restituisce da sé: `valutaMazzo` tiene le componenti separate, e chi vuole un
totale chiama `combina`. Le spiegazioni citano le componenti, non il totale.

## Frontiera

**I mazzi affiancati dal più fedele al tema al più forte**, e il tasso di cambio
fra i due. È il fulcro dichiarato del progetto.

Ha **un asse solo** — il peso dato alla purezza — e resta a un asse anche con la
strategia, perché la strategia è un vincolo e non un secondo asse. Con una
strategia dichiarata, la frontiera è quella *dentro* quell'archetipo, e può
essere più corta: se a un peso nessun mazzo valido esiste, quel passo sparisce.
Una frontiera corta non è un guasto — dice che lì il margine di scambio è
piccolo.

## Combo dichiarata

**Le carte che l'utente afferma vincano se stanno insieme.**

L'app **non capisce la combo: ci crede.** Non giudica se quelle carte vincano
davvero — saperlo richiederebbe un motore di regole. Calcola la probabilità
esatta di averle assemblate entro un certo turno, e costruisce per alzarla.

È la stessa forma del `seme` che il tema già ha: carte nominate, mai oggetti.

Vive in `src/combo/combo.ts` come `Combo` — i soli nomi — e arriva al motore
dentro la `Richiesta`, accanto al tema.

«Costruisce per alzarla» ha un significato preciso, ed è un **vincolo duro**
come la strategia: i pezzi entrano nel mazzo **al massimo delle copie** e la
ricerca non li scambia via mai, nemmeno quando il punteggio salirebbe. Quella è
la probabilità più alta che un mazzo da sessanta carte permetta, e quel che
costa si legge dove si leggono tutti i costi: la potenza scende, e la frontiera
lo mostra. Un peso, invece, avrebbe contrattato la combo contro la potenza senza
dirlo — il secondo tasso di cambio invisibile che
[ADR-0001](docs/adr/0001-strategia-dichiarata-verificata-per-comportamento.md)
rifiuta.

## Tag

**Quel che una carta sa fare**, in poche parole meccaniche.

Ce ne sono di due razze, e vanno tenute distinte:

- i **quindici nostri**, ricavati da regole meccaniche deterministiche scritte
  in `strumenti/tag-di-sinergia.ts`, correggibili a mano una riga per volta;
- quelli di **Scryfall Tagger**, scaricati a compilazione e congelati dentro
  `pool.json`.

L'app non interroga Scryfall a runtime: il determinismo non si tocca. Il perché
di entrambe le razze sta in
[ADR-0003](docs/adr/0003-tag-di-scryfall-affiancati-ai-nove.md), che parla di
**nove** perché è del 3 settembre 2026: il vocabolario è stato riscritto col
cambio di formato (ticket 06), la sostanza dell'ADR regge intera e solo il
numero è cambiato.

I quindici, nell'ordine in cui compaiono su una carta:

    danno-diretto           rimozione-mirata       spazza-via
    attacca-le-terre        colpisce-gli-artefatti controincantesimo
    scarta                  imbriglia              previene-il-danno
    potenzia                evasione               pesca
    accelerazione-di-mana   si-cura-del-cimitero   rigenera

Non sono i nove dello Standard con sei aggiunte: sono un elenco nuovo, scelto
guardando le 778 carte una per una. Ne sono cadute tre — `produce-pedine`,
`conta-le-creature` e `sacrifica` — perché nel 1994 valgono nove carte, nove
carte e un costo che le carte pagano su se stesse. Insieme i quindici raccontano
gli archetipi che questo formato produce davvero: l'aggressione, il controllo,
la prigione, gli artefatti, il recupero e la difesa.

---

## Tetto di copie

**Quante copie di una carta un mazzo può contenere**, scritto sulla carta stessa
dalla preparazione del pool.

Non è «quattro tranne eccezioni»: è un numero che la carta porta con sé, e
`null` quando tetto non ce n'è — le terre base, e le carte che si concedono il
permesso nel proprio testo.

Vale **uno** per le carte che il documento di formato dichiara limitate, e il
formato ha l'ultima parola anche sul permesso scritto nel testo.

Sta nel pool e non in una funzione del motore perché è così che chi costruisce
un mazzo non ha bisogno di conoscere il formato: legge un numero. Il giorno che
il gruppo limita una carta in più, cambia quel numero e nient'altro.

---

## Terra di utilità

**Una terra che non serve a fare colori ma a fare qualcosa**: picchiare,
prevenire un danno, distruggere la terra dell'avversario.

Su questo formato sono una fetta grossa delle terre, e nessun mazzo serio le
ignora. Fino al ticket 08 non potevano entrare in un mazzo per nessuna strada —
la ricerca escludeva ogni terra dagli incantesimi candidati, il catalogo non ne
faceva aggiungere a mano, e la base di terre chiedeva due colori di identità.

Entrano dalla **base di terre** (`src/mazzo/base-di-terre.ts`), che è chi le
terre le sceglie. **Quali** entrino non lo dice un elenco di nomi — sarebbe
verità di formato nel sorgente — ma i **tag** che la carta porta: una terra entra
se fa qualcosa che il mazzo già fa, **contato in copie** e non in carte. Una
terra di utilità costa un posto alla base di mana, e una carta sola che per caso
porti quel tag non lo paga: sotto la soglia dichiarata in `taratura.ts` la terra
resta fuori. Resta fuori anche la terra senza nessun tag: l'app non legge il
testo delle carte, e di quella non sa dire niente.

Il loro budget è dichiarato in `taratura.ts` e **non dipende dai colori**, al
contrario di quello delle terre doppie: se ne dipendesse, un mazzo monocolore
non ne vedrebbe mai una, e sono proprio i monocolore a giocarle di più.

Quelle che **non fanno mana affatto** hanno un tetto più stretto e stanno fuori
dalle fonti in ogni conto che segue — la probabilità di lanciare e la
simulazione. Nel mazzo ci sono: sono un posto che non lancia niente, ed è
esattamente quel che sono.

---

## Formato

**Il documento di dati che dice quale gioco si sta giocando**, e non il concetto
vago di «formato».

Sta in `public/dati/formato.json`, lo scrive una persona a mano ed entra in git.
Contiene il nome del formato, la data e la fonte da cui la lista è stata presa,
il criterio del pool, le edizioni ammesse per codice, le carte limitate a una
copia e le carte bandite — ognuna col proprio **perché** scritto a parole, e con
il segno della **divergenza** dove il gruppo si scosta dal regolamento
pubblicato di riferimento.

È l'opposto del pool, che è prodotto di compilazione: questo si apre e si
corregge una riga per volta, senza toccare il codice. Il perché sta in
[ADR-0004](docs/adr/0004-nessuna-verita-di-formato-nel-sorgente.md).

Le voci ancora non confermate col gruppo portano scritta **la domanda da
fargli**: un dato incerto dichiarato incerto è un dato; scritto senza dirlo è un
errore che aspetta.

---

## Ambito

**Quale gioco si sta giocando**, e da dove l'app lo sa.

È la riga che l'utente legge sotto il nome dell'app, e non è una costante del
sorgente: è il **nome** che il documento di formato dichiara. Da lì passa in
interfaccia, in testa alla lista da consegnare all'arbitro, e dentro ogni mazzo
che si salva o si esporta.

Il nome però si mostra e non si confronta. Per sapere se due mazzi appartengono
allo stesso gioco c'è l'**impronta del formato**: il criterio del pool e i
codici delle edizioni ammesse, in ordine. È quel che un mazzo salvato si porta
dietro insieme al nome, e la ragione dei due campi è che cambiano per motivi
diversi — il nome del formato è dichiarato *da confermare*, e un mazzo salvato
non deve chiudersi il giorno che il gruppo decide come chiamare il proprio
gioco.

Cambiano le edizioni o il criterio, l'impronta cambia: è un altro gioco, e i
mazzi di prima non si giocano più. Cambiano le limitate o le bandite, no: è lo
stesso gioco con una riga in più, al più con una carta da togliere dal mazzo.

Un mazzo che **non** dichiara il formato — salvato prima che l'app lo scrivesse
— non è del formato corrente: «non si sa» non è «è il mio».

---

## Criterio del pool

**La regola che decide quali carte esistono**, contrapposta all'elenco.

Il formato non dice «queste ottocento carte»: dice «le carte che stanno in queste
edizioni». È una regola, e vale anche per le carte che nessuno ha ancora
guardato. Il codice sa eseguire i criteri, il documento sceglie quale vale.

I criteri che il codice sa eseguire sono due, e il documento ne indica uno:
`solo-edizioni`, che guarda l'edizione e basta, e `stampa-italiana`, che chiede
in più che di quella carta esista una stampa italiana. Il formato ha eseguito il
secondo fino al 2026-09-07, quando il gruppo ha detto che vale l'edizione — il
perché sta in [ADR-0006](docs/adr/0006-il-criterio-diventa-l-edizione-e-la-lingua-e-una-regola-sulle-copie.md).

**La lingua non è un criterio.** Quali lingue di un'edizione si possano portare
al tavolo è una regola sulle **copie**, non sulle carte: non toglie nessun nome
dal formato, e infatti è stato misurato invece che supposto — le stampe straniere
delle edizioni ammesse sono complete. Vive sull'edizione, e governa un
meccanismo solo: quale **stampa** descrive e prezza una carta.

---

## Stampa

**La carta e la sua edizione sono due cose diverse.** In Standard non serviva mai
distinguerle; qui la distinzione è dappertutto, perché il criterio guarda la
stampa **italiana** mentre quel che si mostra viene da un'altra stampa.

Il conto di quali carte esistono si fa sempre **per nome** e mai per stampa:
sottrarre insiemi di stampe dà risposte sbagliate, perché la stampa di
un'edizione non è la stampa di un'altra anche quando la carta è la stessa.

Ogni carta del pool porta scritte **due** stampe, perché sono due mestieri
diversi.

La stampa che **descrive** la carta — edizione, numero di collezione, lingua e
immagine — è quella che il giocatore vedrà e che verosimilmente comprerà: la
più economica in inglese fra le ammesse, e l'italiana quando in inglese, dentro
quelle edizioni, la carta non è mai stata stampata. Sono quarantasette carte,
tutte di Terza: quell'edizione in inglese non esiste. Il nome e il testo restano
inglesi lo stesso, perché Scryfall li scrive in inglese su ogni stampa.

La stampa che **prezza** la carta è la copia più economica, fra quelle delle
edizioni ammesse, che su Cardmarket un listino ce l'abbia davvero — di
qualunque lingua sia. Non è detto sia la stessa che descrive, e quando non lo è
il prezzo se la porta dietro e l'app lo dice: senza, chi confronta su
Cardmarket starebbe guardando un altro cartoncino senza accorgersene. Quando
nessuna copia ammessa ha listino il prezzo non c'è, e la provenienza nemmeno:
una copia **non** ammessa non si usa mai per tappare quel buco.

---

## Chiave di ricerca

**Il nome italiano di una carta: quello con cui la si cerca, mai quello con cui
la si mostra.**

Il formato è definito dalle stampe italiane, e chi ci gioca alle carte pensa col
nome che ha letto sul cartoncino: chi scrive *«Labirinto di Ith»* deve trovare
*Maze of Ith*, con la stessa tolleranza ai refusi che ha l'inglese. Il nome
italiano sta nel pool per questo, e per niente altro.

Non è una lingua d'interfaccia a metà: mostrarlo darebbe nome italiano,
immagine a volte inglese e testo di regole sempre inglese — tre lingue in una
scheda — e un numero di collezione che parla di una stampa diversa da
quella nominata. Il
perché per esteso, coi numeri, sta in `PROGETTO.md` §7 sotto Q24.

Chi legge «ricerca» in questo progetto guardi il contesto: qui è la ricerca del
**catalogo** — trovare una carta — e in `src/ricerca/` è la ricerca del
**motore**, che cerca un mazzo. Sono due mestieri diversi con lo stesso nome, ed
è l'unica coppia di parole di questo vocabolario che si ripete.

---

## Tetto di spesa

**Quanto il giocatore è disposto a spendere, in euro, per comprare il mazzo — e
**parte spento**.**

Spento non è una dimenticanza, è la decisione. Il fulcro dell'app è il **tasso
di cambio** fra tema e potenza, e la **frontiera** esiste per mostrarne uno.
Un budget acceso di suo ne metterebbe accanto un secondo — quanto costa in euro
quel che costa in tema — e i due prezzi si confonderebbero: la prima risposta
che il giocatore riceve dev'essere sul tema, non sul portafoglio. Lo accende lui,
quando sta per comprare (`PROGETTO.md` §7, sotto Q9).

Acceso, è un vincolo **duro** e non morbido come il tema: nessun mazzo
consegnato lo supera. Vale sulle carte e **sulle terre**, che in questo formato
non sono un contorno da pochi centesimi. Tiene fuori due specie di carte, e
l'app dice quante sono di ciascuna: quelle che da sole costano più del tetto, e
quelle che un **listino non ce l'hanno** — col tetto acceso l'app promette un
conto, e non può promettere quel che non sa contare.

Il budget come **secondo asse** della frontiera, accanto alla purezza, è la
versione ambiziosa e sta fuori: vedi `spec.md`, «Out of Scope».

---

## Stima al ribasso

**Ogni prezzo che l'app mostra è un pavimento, mai un prezzo.**

I prezzi vengono da Cardmarket attraverso Scryfall e sono quelli della copia più
economica, **fra quelle che il formato ammette**, che un listino ce l'abbia. È un
pavimento vero: sotto quella cifra la carta non si compra in nessuna copia che al
tavolo passi.

Resta un pavimento e non un prezzo per due ragioni. La copia che il giocatore
troverà da comprare può essere **un'altra** fra quelle ammesse, e costare di più;
e i prezzi di Cardmarket sono di ieri. La distanza nessuno la conosce, e per
questo non si stima: si dichiara che c'è, ovunque un prezzo compaia — insieme a
**da quale copia** il numero viene, che è l'unico modo di renderla verificabile.

La **Reserved List** è l'altra metà della stessa onestà: 118 carte del pool non
saranno mai ristampate, e il loro prezzo non scenderà aspettando. Quando il
tetto di spesa le lascia fuori, le lascia fuori per sempre — alzare il tetto è
l'unica strada, e va detto invece di lasciarlo scoprire fra un anno.

---

## Parole che questo progetto non usa

- **«tier», «competitivo», «buono»** per dire potenza. La potenza qui ha
  componenti con dei numeri; quelle parole ne nascondono la provenienza.
- **«archetipo» al posto di «strategia»** (e viceversa). Vedi sopra: la
  differenza fra dichiarato e misurato è il lavoro dell'app.
- **«matchup»** al posto di **corsa**, finché l'avversario è un orologio: un
  matchup vero richiede due mazzi che giocano, e qui non succede.
- **«IA», «intelligente», «impara»**. Non c'è nessun modello linguistico a
  runtime e nessun peso appreso: è un vincolo non negoziabile di `CLAUDE.md`, e
  le parole che lo lasciano credere sono false.
