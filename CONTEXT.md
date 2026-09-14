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

## Promessa

**La riga in italiano che una voce della galleria mostra prima che la si
tocchi** — che cosa fa questo mazzo, come lo direbbe un giocatore a un altro.
Non porta numeri: le carte che il tema porta dentro stanno accanto e vengono dal
pool, contate a ogni apertura.

Una promessa non è una descrizione: è un **impegno che il tema deve poter
mantenere**, e da qui viene la regola che la governa — *il tag più numeroso di
una voce dev'essere uno di quelli che la sua promessa nomina.*

Non è una regola sulla cardinalità. Una voce può essere dominata da un tag
solo e stare benissimo: «Reggere l'urto» lo è al 76% da `previene-il-danno`,
che **è** la sua promessa. Quel che rompe una promessa è che a comandare sia
un tag che la promessa **non nomina**: è il guasto che il ticket 71 ha trovato
su «Controllare», dove `rimozione-mirata` valeva il 54% dell'unione e la riga
parlava di dire di no, spazzare e pescare. Il mazzo che ne usciva aveva purezza
1,000 e non una contromagia: perfettamente dentro il tema e perfettamente fuori
dalla promessa.

Una promessa non si aggiusta **riscrivendo la frase** per farla combaciare con
quel che il tema seleziona: a quel punto è il tema a dettare la promessa, e la
galleria smette di essere fatta di risposte scelte. Si aggiusta il tema.

E non si aggiusta nemmeno **stringendo il tema** fin sotto la soglia di
«comodo»: una voce che fa scattare il verdetto *stretto* è l'esatto guasto che
la galleria esiste per togliere — aprire l'app su un tema che avvisa. Fra le
due, si tiene il tema largo e si accetta che il primo mazzo della frontiera sia
un compromesso: è quel che la frontiera è lì per mostrare.

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

Sono anche **l'unica cosa che l'utente scrive a mano e che l'app conserva**, e
quindi l'unica che nessuno può ricostruire al posto suo. Per questo si leggono
in due modi: severo per un file arrivato da fuori — che dice quale riga
guardare — e **indulgente** per il deposito del dispositivo, dove una voce
storta cade da sola e le altre restano. Un orologio senza nome non entra nella
corsa in nessuno dei due (ADR-0002), ma nel deposito non si porta più via
l'elenco.

## Corsa

**Il confronto fra il mazzo e un orologio**: chi chiude per primo, e che cosa
resta del mazzo dopo le rimozioni dell'avversario.

L'esito della corsa è la **sesta componente del punteggio**, accanto alle
cinque. Sta nel punteggio e non accanto al mazzo perché altrimenti l'app
saprebbe dirti che perdi senza costruire per non perdere.

Chi arriva primo si decide **al decimo di turno**, che è la cifra in cui la
corsa si racconta. Il turno di chiusura è una media su cinquecento partite
simulate contro una caricatura (ADR-0002): oltre il decimo non c'è una misura,
c'è il rumore della simulazione, e due turni che si mostrano uguali non hanno un
vincitore. Vale per tutto quel che la corsa scrive — un ritardo che si mostra
«0,0» non si nomina, e una coda che non sposta il turno mostrato non si scrive.

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

Vengono da due parti, e vanno tenuti distinti:

- i **quindici nostri**, ricavati da regole meccaniche deterministiche scritte
  in `strumenti/tag-di-sinergia.ts`, correggibili a mano una riga per volta;
- quelli di **Scryfall Tagger**, scaricati a compilazione e congelati dentro
  `pool.json`.

L'app non interroga Scryfall a runtime: il determinismo non si tocca. Il perché
di entrambi sta in
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

Di impronte però ce ne sono **due**, e la seconda risponde a un'altra domanda:
l'**impronta del documento** (`dati/impronta-del-documento.ts`) dice da quale
documento di formato viene il pool. Guarda tutto quel che decide il contenuto
del pool — limitate e bandite comprese, cioè proprio le voci che l'altra lascia
fuori apposta — perché quelle entrano nel file quando lo si genera e a runtime
non le rilegge nessuno. Non si mostra e non viaggia dentro i mazzi: la
confronta la compilazione, che si ferma quando i due file di dati non sono
stati fatti insieme.

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
distinguerle; qui la distinzione è dappertutto, perché il criterio guarda le
edizioni mentre quale copia si porti al tavolo è una domanda a parte — e quel
che si mostra e quel che si prezza vengono da due stampe diverse.

Il conto di quali carte esistono si fa sempre **per nome** e mai per stampa:
sottrarre insiemi di stampe dà risposte sbagliate, perché la stampa di
un'edizione non è la stampa di un'altra anche quando la carta è la stessa.

Ogni carta del pool porta scritte **due** stampe, perché sono due mestieri
diversi.

La stampa che **descrive** la carta — edizione, numero di collezione, lingua e
immagine — è quella che il giocatore vedrà e che verosimilmente comprerà: la
prima [lingua ammessa](#lingue-ammesse) che esista, nell'ordine in cui
l'edizione la dichiara. Nessun codice di lingua sta nel codice: l'ordine è dato,
e cambiarlo cambia il cartoncino che l'app indica. Il nome e il testo restano
**inglesi** comunque, perché Scryfall li scrive in inglese su ogni stampa.

A pari lingua — la stessa carta ristampata, l'italiana in due edizioni ammesse e
in nessuna delle due un listino — a scegliere l'edizione è **quella da cui viene
il prezzo**, e non la data di uscita: senza quel criterio decideva lo spareggio,
cioè l'edizione più vecchia, che qui è anche la più cara, e 326 carte su 753
portavano il prezzo di un cartoncino diverso da quello che la lista nominava. Il
perché sta in [ADR-0007](docs/adr/0007-a-pari-lingua-l-edizione-mostrata-la-sceglie-il-prezzo.md).
Non è una preferenza fra edizioni, e non va scritta nel documento come se lo
fosse: è la regola che tiene mostrata e prezzata sullo stesso cartoncino.

Quando la stampa mostrata per figura ha un **dorso** — capita a quasi tutta la
Quarta italiana — l'illustrazione arriva da un'altra copia ammessa della **stessa
edizione e dello stesso numero di collezione**: stesso cartoncino, stessa figura,
la scritta in un'altra lingua. L'identità della stampa non si sposta: è la sola
figura a essere presa in prestito, e mai da un'altra edizione, che sarebbe
un'altra illustrazione. Senza questo ripiego metà del catalogo resterebbe senza
figura.

La stampa che **prezza** la carta è la copia più economica, fra quelle ammesse,
che su Cardmarket un listino ce l'abbia davvero — di qualunque lingua ammessa
sia; qui la preferenza non conta, perché non si sceglie cosa mostrare ma il
pavimento più basso fra le copie giocabili. Non è detto sia la stessa che
descrive, e quando non lo è il prezzo se la porta dietro e l'app lo dice: senza,
chi confronta su Cardmarket starebbe guardando un altro cartoncino senza
accorgersene. Le divergenze si dicono con parole diverse, perché non sono la
stessa notizia: un'altra **lingua** dello stesso cartoncino è il caso normale e
costa press'a poco uguale; un altro **numero di collezione** dentro la stessa
edizione, e a maggior ragione un'altra **edizione**, sono un'altra carta da
comprare, e l'app le scrive come avvisi. Quando
nessuna copia ammessa ha listino il prezzo non c'è, e la provenienza nemmeno:
una copia **non** ammessa non si usa mai per tappare quel buco.

---

## Lingue ammesse

**Quali copie di una carta il gruppo accetta al tavolo. È una regola
sull'edizione, non sul formato, e non toglie nessun nome dal pool.**

Ogni edizione del documento di formato dichiara le lingue delle stampe che il
gruppo ammette — e l'elenco è obbligatorio: un'edizione che non lo scrive fa
rifiutare il documento. L'assenza **non** vale «tutte». Un valore predefinito
sarebbe verità di formato scritta nel sorgente sotto forma di comportamento
implicito, che è quel che ADR-0004 vieta: la regola la dichiara il documento
sempre, anche quando è generosa.

**L'ordine è la preferenza.** `["it", "en"]` dice due cose insieme: queste due
lingue si giocano, e fra le stampe che esistono si mostra l'italiana. Il campo
fa due mestieri di proposito — un secondo campo per la preferenza andrebbe
tenuto in accordo col primo, e nessuno lo leggerebbe mai come diverso.

La lingua **non è un criterio**: non decide quali carte esistono, decide quale
copia è legale portare al tavolo (ADR-0006, dove sta anche la misura su cui
questo poggia). Per la stessa ragione le lingue non entrano nell'[ambito](#ambito):
cambiarle non chiude nessun mazzo salvato.

Una carta di un'edizione ammessa che non avesse **nessuna** stampa in una lingua
ammessa entrerebbe lo stesso nel pool, e la preparazione la nominerebbe nel
resoconto: oggi non ne esiste nessuna, e il giorno che ne esistesse una la
decisione andrebbe rifatta invece che aggirata.

---

## Chiave di ricerca

**Il nome italiano di una carta: quello con cui la si cerca, mai quello con cui
la si mostra.**

Le copie che il gruppo porta al tavolo sono in gran parte italiane, e chi ci
gioca alle carte pensa col nome che ha letto sul cartoncino: chi scrive
*«Labirinto di Ith»* deve trovare *Maze of Ith*, con la stessa tolleranza ai
refusi che ha l'inglese. Il nome italiano sta nel pool per questo, e per niente
altro.

Non è una lingua d'interfaccia a metà: mostrarlo darebbe nome italiano e testo di
regole sempre inglese — due lingue in una scheda. Il perché per esteso, coi
numeri, sta in `PROGETTO.md` §7 sotto Q24, e **due terzi di quella motivazione
sono decaduti** da allora, tutti e due per opera di questa app e non del tempo.

Il primo: da quando le lingue ammesse le dichiara il documento (ADR-0006), il
numero di collezione mostrato non è più quello di una stampa inglese, ma quello
della copia che il giocatore avrà in mano. Il secondo: l'argomento del riquadro
vuoto — «per un sesto delle carte nessuna immagine» — non regge più, perché da
quando la figura si prende in prestito dentro l'edizione (ADR-0007) le carte
senza illustrazione sono **nove su 753** e non 129.

Resta in piedi l'argomento del testo di regole, che è il più grosso: su Scryfall
il testo italiano di queste carte non esiste. La decisione regge su quello, e su
quello soltanto: chi la riaprisse dovrà farlo sapendo che gli altri due
argomenti non sono più disponibili.

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

Duro al **centesimo**, che è la cifra in cui il tetto si scrive e si legge. Il
prezzo di un mazzo è la somma di sessanta decimali, un numero che in binario non
torna mai esatto, e all'app tocca mostrarlo arrotondato: chi rilegge «233,25 €»
e riscrive quella cifra nella casella sta chiedendo **quel mazzo lì**, e deve
riaverlo. Perciò il confronto perdona mezzo centesimo — quanto un arrotondamento
al centesimo può spostare — e non un soldo di più. La strada scartata era
arrotondare la spesa dentro il motore: darebbe due arrotondamenti che possono
divergere, cioè lo stesso difetto più difficile da vedere.

Anche la **base di terre** lo rispetta, e non lo subisce: le si dice quanto è
rimasto dopo le carte, e lei sceglie la base più forte che ci sta. Quando i
soldi finiscono se ne va la copia che costa di più — non prima le terre di
utilità né prima quelle a due colori: le due famiglie hanno punteggi su scale
diverse, e convertirle sarebbe inventare un cambio che nessuno ha misurato,
mentre il prezzo è la stessa cosa per entrambe. Quel che il tetto le è costato
l'app **lo dice**, con le copie e gli euro: una base peggiore senza una ragione
scritta sarebbe l'app che decide di nascosto.

Il tetto con cui un mazzo è stato costruito viaggia **col mazzo**, non con
l'interruttore: chi costruisce a 30 € e poi spegne l'interruttore non deve
vedersi cambiare la base sotto le mani. Ma vale finché il mazzo in mano è ancora
quello che il motore ha consegnato: alla **prima copia cambiata a mano** il tetto
si stacca da solo, perché quel mazzo non l'ha più costruito nessuno con quella
cifra — e chi quella copia la rimette si ritrova il tetto, perché la domanda non
è «ha toccato qualcosa» ma «quel che ha in mano è il mazzo che il motore gli ha
dato». La regola è severa apposta — l'alternativa era una quota di carte cambiate,
cioè un numero da tarare che nessun dato giustifica — e quel che la rende
accettabile è che finché il tetto vale l'app **lo dice**, con un tasto accanto per
levarlo senza toccare una carta. Un mazzo riaperto dai salvati e uno messo insieme
a mano non hanno tetto: nessuno li ha prodotti, e nessuno se ne applica.

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
