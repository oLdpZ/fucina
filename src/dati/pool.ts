/**
 * La forma del pool: il file di dati che l'app **legge** e non produce mai.
 *
 * Il pool è un prodotto di compilazione versionato (`PROGETTO.md` §«Il pool
 * delle carte»): lo scrive il comando di preparazione dati sul computer del
 * manutentore, entra in git perché l'app deve funzionare appena clonata e
 * offline, e non si modifica a mano.
 *
 * Qui ci sono solo tipi: questo modulo non ha peso a runtime, e può essere
 * letto sia dall'app sia dagli strumenti del manutentore senza legarli fra loro.
 */

/** I cinque colori di Magic. `C` è il mana incolore, che le terre producono. */
export type Colore = "W" | "U" | "B" | "R" | "G";
export type ColoreMana = Colore | "C";

/**
 * I tag di sinergia: le quindici cose che una carta **fa** e che il motore sa
 * far lavorare insieme (`PROGETTO.md` Q13).
 *
 * Sono un elenco chiuso e scritto qui una volta sola: il motore ci ragiona
 * sopra, l'interfaccia li mostra, e la preparazione dati li calcola. Vengono da
 * due sorgenti e mai una terza — regole meccaniche lette dal testo e dai tipi,
 * e un file di correzioni a mano. **Mai** dedotti dalle decklist vincenti:
 * riporterebbero al meta, cioè all'opposto dello scopo dell'app.
 *
 * Questo vocabolario è stato **riscritto** col cambio di formato del 6 settembre
 * 2026 (`PROGETTO.md` §7, Q13) e non ereditato: i nove tag dello Standard
 * descrivevano un altro gioco. Le voci qui sotto sono state scelte guardando le
 * 778 carte del pool una per una — ognuna copre da una ventina di carte in su,
 * e insieme raccontano gli archetipi che questo formato produce davvero:
 * l'aggressione (`potenzia`, `evasione`, `danno-diretto`), il controllo
 * (`controincantesimo`, `pesca`, `rimozione-mirata`, `spazza-via`), la prigione
 * (`imbriglia`, `attacca-le-terre`), gli artefatti
 * (`colpisce-gli-artefatti`, `accelerazione-di-mana`), il recupero
 * (`si-cura-del-cimitero`, `scarta`) e la difesa (`previene-il-danno`,
 * `rigenera`).
 *
 * Tre voci dello Standard sono cadute e non sono state sostituite:
 * `produce-pedine` (nove carte in tutto), `conta-le-creature` (nove) e
 * `sacrifica`, che nel 1994 è quasi sempre il costo che una carta paga su se
 * stessa e non un tema. Un tag su nove carte è esattamente il difetto che
 * questo vocabolario doveva togliere.
 */
export type Tag =
  | "danno-diretto"
  | "rimozione-mirata"
  | "spazza-via"
  | "attacca-le-terre"
  | "colpisce-gli-artefatti"
  | "controincantesimo"
  | "scarta"
  | "imbriglia"
  | "previene-il-danno"
  | "potenzia"
  | "evasione"
  | "pesca"
  | "accelerazione-di-mana"
  | "si-cura-del-cimitero"
  | "rigenera";

/**
 * Un tag di **Scryfall Tagger**, la seconda razza (ADR-0003): quel che la
 * comunità dice che una carta faccia — `counterspell`, `removal`,
 * `win-condition` — dove i nove nostri non arrivano.
 *
 * Non è un elenco chiuso: sono migliaia e cambiano nel tempo, e per questo il
 * pool ne porta il **registro** invece di scriverli nel codice. Di ciascuno si
 * tiene l'`id` UUID stabile accanto al nome, come Scryfall consiglia: la
 * comunità rinomina, e il nome dice come si legge un tag oggi mentre l'id dice
 * chi è.
 *
 * Sull'app pesano come dati e non come rete: sono congelati nel pool, e nessuna
 * richiesta a Scryfall parte mai dal browser.
 */
export type TagDiScryfall = {
  /** L'identificativo stabile: quello che sopravvive a un rinominamento. */
  id: string;
  /** Lo slug, la parola con cui il tag si cerca su Tagger (`otag:removal`). */
  nome: string;
};

/** Gli indirizzi delle immagini: una per l'elenco, una per la carta aperta. */
export type Immagine = {
  piccola: string;
  normale: string;
};

/**
 * Il prezzo porta sempre con sé la sua data: i prezzi Scryfall vengono da
 * Cardmarket e sono aggiornati una volta al giorno (`PROGETTO.md` §3), quindi
 * mostrarli senza dire di quando sono sarebbe mentire.
 *
 * `euro` è `null` quando la stampa scelta non ha prezzo: capita, e non è un
 * errore. Su questo formato capita **spesso** — le stampe italiane non hanno
 * listino, e le carte che in inglese non esistono dentro le edizioni ammesse si
 * descrivono con la propria stampa italiana.
 */
export type Prezzo = {
  euro: number | null;
  aggiornatoIl: string;
};

/** Una faccia di una carta a più facce. Le carte normali non ne hanno. */
export type Faccia = {
  nome: string;
  costoDiMana: string;
  lineaDiTipo: string;
  tipi: string[];
  sottotipi: string[];
  testo: string;
  forza: string | null;
  costituzione: string | null;
  immagine: Immagine | null;
};

/**
 * Quel che serve sapere di una terra per costruirci sopra una base di mana
 * (ticket 06).
 *
 * `condizione` è il testo inglese di **ciò che la fa entrare dritta** quando
 * entra girata solo a volte — «you control a basic land», «As this land enters,
 * you may pay 2 life». È `null` quando entra girata sempre, e quando
 * `entraGirata` è falso.
 */
export type Terra = {
  coloriProdotti: ColoreMana[];
  entraGirata: boolean;
  condizione: string | null;
};

/**
 * Una carta del pool: **una voce per nome**, non per stampa.
 *
 * La distinzione fra la **carta** e la sua **stampa** qui è dappertutto, e non
 * lo era finché il formato era lo Standard. Il formato decide chi entra
 * guardando le stampe — una carta è nel gioco se ne esiste una stampa italiana
 * dentro le edizioni ammesse — mentre quel che si mostra viene da **un'altra
 * stampa**, la più economica in inglese fra quelle ammesse. Le due domande sono
 * distinte, e per questo la carta si porta dietro quale stampa la descrive.
 */
export type Carta = {
  /** Identificativo Scryfall della stampa scelta. */
  id: string;
  /** Il nome inglese, che è anche la chiave: solo inglese, per decisione Q24. */
  nome: string;
  /**
   * Il nome con cui la carta è stampata in italiano, quando una stampa italiana
   * c'è. Non si mostra: è una **chiave di ricerca** — chi scrive «Labirinto di
   * Ith» deve trovare *Maze of Ith*.
   *
   * `null` è uno stato legittimo: col criterio che ammette un'edizione intera a
   * prescindere dalla lingua, una carta può entrare senza stampa italiana.
   */
  nomeItaliano: string | null;
  /**
   * Il codice dell'edizione da cui viene la stampa scelta — lo stesso codice che
   * il documento di formato ammette.
   *
   * Insieme al numero di collezione è quel che si cerca su Cardmarket: il
   * prezzo qui sotto è di **questa** stampa e di nessun'altra, e dirlo è la
   * differenza fra una stima e un numero campato per aria (storia 14).
   */
  edizione: string;
  numeroDiCollezione: string;
  /**
   * La lingua della stampa scelta.
   *
   * Di norma è l'inglese, perché è di lì che vengono prezzo e immagine. Ma
   * esistono carte del formato che in inglese, **dentro le edizioni ammesse**,
   * non sono mai state stampate: per quelle la stampa che le descrive è la
   * italiana, e allora il prezzo non c'è. Chi mostra il prezzo deve poterlo
   * dire, invece di lasciar credere che la carta sia gratis.
   */
  linguaDellaStampa: string;
  /** Il costo della faccia giocabile per prima: è quello che conta per la curva. */
  costoDiMana: string;
  valoreDiMana: number;
  identitaDiColore: Colore[];
  /** Tipi e supertipi, uniti su tutte le facce, nell'ordine in cui compaiono. */
  tipi: string[];
  sottotipi: string[];
  /** Il testo delle regole; sulle carte a più facce, quello di tutte le facce. */
  testo: string;
  forza: string | null;
  costituzione: string | null;
  immagine: Immagine | null;
  rarita: string;
  prezzo: Prezzo;
  /**
   * I tag di sinergia, in ordine dichiarato e senza ripetizioni: regole
   * meccaniche più correzioni a mano, come vuole Q13.
   */
  tag: Tag[];
  /**
   * I nomi dei tag di **Scryfall Tagger** che la carta porta, in ordine
   * alfabetico. Sono un'altra razza dai quindici qui sopra, e stanno in un
   * campo diverso apposta: chi legge il pool deve sapere da dove viene un tag
   * senza indovinarlo. I loro id stanno nel registro del pool.
   *
   * Vuoto è uno stato legittimo, e non solo per le carte che Tagger non ha
   * ancora guardato. Su questo pool Tagger arriva quasi dappertutto — nove
   * carte su 778 non ne hanno nemmeno uno — ma quel che dice è materiale
   * grezzo: i tag nostri restano quelli calcolati qui e corretti a mano.
   */
  tagScryfall: string[];
  /** Le facce, annidate, quando la carta ne ha più di una. Altrimenti `null`. */
  facce: Faccia[] | null;
  /** Presente solo se la carta è una terra. */
  terra: Terra | null;
  /**
   * Quante copie di questa carta un mazzo può contenere: **un dato della
   * carta**, scritto dalla preparazione, non un conto che chi costruisce rifà.
   *
   * `null` vuol dire *senza tetto*, ed è lo stato di due specie di carte: le
   * terre base, che il gioco non limita, e quelle che si concedono il permesso
   * nel proprio testo. Nel JSON `null` è anche l'unico modo onesto di scrivere
   * «nessun limite»: `Infinity` non attraversa un file di dati.
   *
   * Vale **uno** per le carte che il documento di formato dichiara limitate. Sta
   * qui e non in una funzione perché è la sola cosa che tiene fuori dal motore
   * la conoscenza del formato: il giorno che il gruppo limita una carta in più,
   * cambia questo numero e nient'altro.
   */
  tettoDiCopie: number | null;
};

export type Pool = {
  /**
   * La data dei dati Scryfall da cui il pool è stato costruito: è la data che
   * l'app mostra all'utente (user story 17) ed è la stessa dei prezzi.
   */
  generatoIl: string;
  /**
   * I tag di Scryfall Tagger che almeno una carta del pool porta, col loro id
   * stabile, in ordine alfabetico.
   *
   * Sta qui e non su ogni carta perché un id è lungo trentasei caratteri e le
   * carte sono migliaia: scriverlo una volta per tag invece che una per
   * accoppiata risparmia al pool un paio di megabyte, che sono megabyte che
   * l'app scarica.
   *
   * Un tag che sparisce da Tagger fra due aggiornamenti sparisce di qui e dalle
   * carte, e non fa cadere niente.
   */
  registroTagScryfall: TagDiScryfall[];
  carte: Carta[];
};
