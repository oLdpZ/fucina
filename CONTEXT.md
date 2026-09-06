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

- i **nove nostri**, ricavati da regole meccaniche deterministiche scritte in
  `strumenti/tag-di-sinergia.ts`, correggibili a mano una riga per volta;
- quelli di **Scryfall Tagger**, scaricati a compilazione e congelati dentro
  `pool.json`.

L'app non interroga Scryfall a runtime: il determinismo non si tocca. Il perché
di entrambe le razze sta in
[ADR-0003](docs/adr/0003-tag-di-scryfall-affiancati-ai-nove.md).

---

## Tetto di copie

**Quante copie di una carta un mazzo può contenere**, scritto sulla carta stessa
dalla preparazione del pool.

Non è «quattro tranne eccezioni»: è un numero che la carta porta con sé, e
`null` quando tetto non ce n'è — le terre base, e le carte che si concedono il
permesso nel proprio testo.

Sta nel pool e non in una funzione del motore perché è così che chi costruisce
un mazzo non ha bisogno di conoscere il formato: legge un numero. Quando un
formato limiterà una carta a una copia, cambierà quel numero e nient'altro.

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

## Criterio del pool

**La regola che decide quali carte esistono**, contrapposta all'elenco.

Il formato non dice «queste ottocento carte»: dice «le carte che esistono
stampate in italiano dentro queste edizioni». È una regola, e vale anche per le
carte che nessuno ha ancora guardato. Il codice sa eseguire i criteri, il
documento sceglie quale vale.

---

## Stampa

**La carta e la sua edizione sono due cose diverse.** In Standard non serviva mai
distinguerle; qui la distinzione è dappertutto, perché il criterio guarda la
stampa **italiana** e quel che si mostra e si prezza viene dalla stampa
**inglese** più economica fra quelle ammesse.

Il conto di quali carte esistono si fa sempre **per nome** e mai per stampa:
sottrarre insiemi di stampe dà risposte sbagliate, perché la stampa di
un'edizione non è la stampa di un'altra anche quando la carta è la stessa.

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
