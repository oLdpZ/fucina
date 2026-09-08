# ADR-0007 — A pari lingua, l'edizione mostrata la sceglie il prezzo

**Stato:** accettata · **Data:** 2026-09-08

## Contesto

[ADR-0006](0006-il-criterio-diventa-l-edizione-e-la-lingua-e-una-regola-sulle-copie.md)
ha sdoppiato la stampa: una **descrive** la carta — edizione, numero di
collezione, lingua, immagine — e un'altra la **prezza**. Ha deciso anche come si
sceglie quella che descrive: prima la lingua, nell'ordine che l'edizione
dichiara, e la più economica dentro quella lingua.

Quell'ordine, eseguito, ha un buco che nessuno aveva visto perché nessuno lo
aveva misurato.

Su Cardmarket **nessuna** stampa italiana delle quattro edizioni di questo
formato ha un listino. Quando una carta è stata ristampata, l'italiana esiste in
due edizioni ammesse e in nessuna delle due ha un prezzo: il primo criterio, la
lingua, le mette a pari merito, e il secondo, il prezzo, vale «infinito» per
entrambe e non decide niente. A decidere arrivava il terzo, lo spareggio sulla
**data**.

Quello spareggio era stato scritto per una ragione piccola e giusta: il pool
finisce in git, e due preparazioni sugli stessi dati devono scrivere lo stesso
file. Si è ritrovato a scegliere **quale cartoncino il giocatore compra**, e a
sceglierlo sempre allo stesso modo — l'edizione più vecchia, che in questo
formato è anche la più rara e la più cara.

### Il numero

Misurato sul `pool.json` in git il 2026-09-07: **326 carte su 753** portavano un
prezzo proveniente da un'edizione diversa da quella mostrata.

*Abomination* era il caso esemplare: mostrata come `leg 87, italiano`, prezzata
0,22 € da `4ed 117, inglese`. Una stampa di Leggende quotata al prezzo di una
Quarta. Chi avesse comprato le stampe che la lista nomina avrebbe pagato un
ordine di grandezza più del tetto che aveva chiesto — e il tetto di spesa, che è
la promessa più concreta che questa app faccia, sarebbe stato un numero senza
rapporto con la spesa vera.

### Le tre risposte possibili

Il ticket 30 le ha scritte tutte e tre, e sono davvero diverse.

1. **Mostrare la copia quotata** — la più economica fra le ammesse che un listino
   ce l'abbia — e dire che di quella carta esiste anche l'italiana.
2. **Mostrare l'italiana e dirlo forte**: che il prezzo è di un'altra edizione,
   scritto dove si legge e non sottovoce.
3. **Chiedere al gruppo** se al tavolo girino davvero le copie italiane di
   Leggende. È la domanda di fondo, ed è dato e non codice.

La prima ribalta ADR-0006: la stampa che descrive smetterebbe di essere quella
che il giocatore avrà in mano. La seconda lascia il difetto e ne dichiara
l'esistenza. La terza non è alternativa alle altre due — resta da fare comunque,
e non toglie il problema di oggi.

## Decisione

**Fra copie di pari lingua, la stampa che descrive è quella dell'edizione da cui
viene il prezzo.**

L'ordine di scelta diventa: rango di lingua → **edizione della stampa che
prezza** → prezzo → data di uscita → identificativo.

Le due stampe tornano così a essere la stessa carta nella stessa edizione, e per
746 carte su 753 a separarle resta la sola **lingua** — che è la divergenza che
ADR-0006 ha scelto consapevolmente, che l'interfaccia sa già dire, e che sul
prezzo pesa poco: copie della stessa edizione in lingue diverse costano press'a
poco uguale. Le sette che restano hanno stessa edizione e **numero di collezione
diverso**: le cinque terre base, che dentro un'edizione hanno più figure numerate
a parte, e due carte che la Quarta tedesca numera per conto suo.

**Quando la stampa mostrata per figura ha un dorso, la figura arriva da un'altra
copia ammessa della stessa edizione e dello stesso numero di collezione.**
L'identità della stampa non si sposta — edizione, numero e lingua restano quelli
della copia che si compra: è la sola illustrazione a essere presa in prestito.

**L'interfaccia distingue le tre divergenze di prezzo, perché sono tre notizie
diverse.** La lista della spesa e la scheda dicono `prezzo di FBB 139, francese`
quando a cambiare è la sola lingua, `prezzo di un'altra stampa: 4ED 377, inglese`
quando dentro la stessa edizione cambia il numero di collezione, e `prezzo di
un'altra edizione: 4ED 117, inglese` quando cambia l'edizione. Le ultime due sono
avvisi; la prima è una nota.

**La preparazione conta e dice a schermo** quante carte si mostrano su un
cartoncino e si prezzano su un altro — dove il cartoncino è edizione e numero di
collezione **insieme**, perché contarlo per sola edizione darebbe per coincidenti
copie che non lo sono — e quante figure sono prese in prestito.

## Perché così

**Perché la stampa che descrive resta quella che il giocatore avrà in mano.** È
la decisione di ADR-0006, e questo documento non la tocca: la lingua resta il
primo criterio, e l'edizione del prezzo parla soltanto dove la lingua ha lasciato
un pari merito. Nessuna carta si sposta su una copia che il gruppo preferisce
meno.

**Perché non è una preferenza fra edizioni, ed è la differenza che conta.** Un
ordine di edizioni dichiarato nel documento avrebbe tolto la data di mezzo lo
stesso, ma sarebbe stato una preferenza inventata: nessuno ha detto che la Quarta
si preferisce a Leggende, e scriverlo in `formato.json` avrebbe messo lì dentro
una cosa che il gruppo non ha detto — cioè l'opposto di quel che
[ADR-0004](0004-nessuna-verita-di-formato-nel-sorgente.md) chiede a quel file.
Seguire il prezzo non dichiara nessuna preferenza: dice soltanto che la carta
mostrata e la carta prezzata devono essere la stessa, e quale sia lo decidono i
listini di Cardmarket, che cambiano da soli.

**Perché la data smette di decidere qualcosa di grosso senza smettere di
esistere.** Dove un prezzo non c'è affatto, l'edizione del prezzo non ha niente
da dire e la data torna a essere l'ultima parola. Va bene: lì non sta scegliendo
fra una copia cara e una economica, sta solo rendendo ripetibile una scelta che
nessun dato sa fare. Lo spareggio resta quel che era stato scritto per essere.

**Perché «un'altra edizione» non è la stessa notizia di «un'altra lingua».** Nel
pool vero la divergenza di lingua è il caso normale — 748 carte su 753 — e un
avviso che compare quasi sempre non avvisa di niente. La divergenza di edizione è
l'eccezione, e dopo questa decisione lo è ancora di più: dirla con parole diverse
è l'unico modo perché si legga.

**Perché la figura si prende in prestito, e solo dentro l'edizione.** È il costo
che questa decisione si è portata dietro, e non era previsto: rigenerato il pool,
246 carte si spostano sull'italiana di Quarta, di cui Scryfall ha per figura un
dorso, e le carte senza illustrazione salivano da 129 a **375** — metà del
catalogo. Due copie della stessa edizione con lo stesso numero di collezione sono
lo stesso cartoncino con un'altra scritta sopra: stessa illustrazione, stesso
bordo, stessa cornice. Un'altra edizione sarebbe un'altra figura, e la scheda
mostrerebbe una carta diversa da quella che il numero manda a comprare — per
questo il prestito si ferma al confine dell'edizione, e per questo la sola cosa
imprecisa che resta è la lingua della scritta sull'illustrazione. È dichiarata, e
la preparazione conta quante volte capita.

## Conseguenze

- **Le carte prezzate da un'altra edizione passano da 326 a zero**, e quelle
  prezzate da un altro cartoncino — il conto più largo, che tiene dentro anche il
  numero di collezione — da 326 a sette. Non è zero per costruzione: resta
  divergente la carta la cui stampa di primo rango di lingua sta in un'edizione e
  il cui unico listino sta in un'altra. Lì la lingua vince, ed è giusto che vinca.
  Il conto si legge a ogni preparazione.
- **Il pool cambia senza che cambi una carta.** Zero entrate, zero uscite: cambiano
  edizione, numero di collezione, lingua e immagine di 326 voci. Il diario delle
  differenze non mostra niente, perché conta i nomi; a mostrarlo è il conto dei
  buchi. **La spesa totale del pool non si sposta di un centesimo** — 19 861,14 €
  prima e dopo — perché a cambiare non è mai stato il prezzo, ma quale cartoncino
  quel prezzo descrivesse.
- **Il tetto di spesa diventa una promessa verificabile al negozio.** Era già un
  numero vero prima — il prezzo di una copia legale esisteva — ma era il prezzo di
  una copia diversa da quella che la lista mandava a comprare.
- **Le carte senza figura scendono da 129 a 9**, ed è la conseguenza che nessuno
  aveva cercato. Il prestito era nato per rimettere l'illustrazione alle 246 che
  l'avevano appena persa; recuperandole ha recuperato anche 120 carte che la
  figura non ce l'avevano **già prima** di questo ADR, e che restavano al buio
  soltanto perché il ripiego non usciva dalla stampa. Sono 366 le carte che oggi
  la figura se la fanno prestare.
- **La scheda di 366 carte mostra un'illustrazione con la scritta in un'altra
  lingua sotto una stampa dichiarata italiana.** È la parte imprecisa di questo
  documento, e sta qui perché l'alternativa era il riquadro vuoto su metà del
  catalogo. Non tocca né il prezzo né la legalità: tocca quel che si guarda.
- **La domanda al gruppo resta aperta**, e questa decisione non la chiude né la
  sostituisce: se al tavolo le copie italiane di Leggende non girano, l'ordine
  delle lingue di quell'edizione è un'altra cosa da correggere, e si corregge nel
  documento.

## Si riaprirebbe se

- **Le stampe italiane comparissero su Cardmarket.** Allora la stampa che descrive
  e quella che prezza tornerebbero a coincidere quasi sempre da sole, e questo
  spareggio non avrebbe più occasioni di scattare. Non farebbe danno restare, ma
  smetterebbe di guadagnarsi il posto.
- **Il gruppo dichiarasse una preferenza fra le edizioni.** Se dicesse «a parità
  di tutto compriamo la Quarta», quella sarebbe una preferenza vera, andrebbe nel
  documento come dato, e verrebbe **prima** dell'edizione del prezzo: la
  preferenza dichiarata batte quella dedotta.
- **Il prestito della figura crescesse ancora.** Oggi è quasi metà del pool — 366
  su 753 — ed è già più di quanto questa decisione avesse messo in conto: la riga
  nella scheda che dice da quale copia venga la figura è stata tenuta fuori
  perché il caso sembrava minoritario, e minoritario non lo è. Se cresce ancora,
  o se qualcuno al tavolo si accorge della scritta e non capisce, quella riga va
  scritta.
- **Il prezzo smettesse di essere una stima al ribasso.** Tutta questa decisione
  poggia sul fatto che l'euro mostrato debba essere il pavimento della copia che
  si compra. Se un giorno il prezzo diventasse altro — una media, una stima di
  mercato — l'edizione da cui viene conterebbe meno, e l'ordine andrebbe
  ripensato.
