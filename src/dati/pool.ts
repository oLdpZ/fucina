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
 * I tag di sinergia: le nove cose che una carta **fa** e che il motore sa far
 * lavorare insieme (`PROGETTO.md` Q13).
 *
 * Sono un elenco chiuso e scritto qui una volta sola: il motore ci ragiona
 * sopra, l'interfaccia li mostra, e la preparazione dati li calcola. Vengono da
 * due sorgenti e mai una terza — regole meccaniche lette dal testo e dai tipi,
 * e un file di correzioni a mano. **Mai** dedotti dalle decklist vincenti:
 * riporterebbero al meta, cioè all'opposto dello scopo dell'app.
 */
export type Tag =
  | "produce-pedine"
  | "sacrifica"
  | "guadagna-punti-vita"
  | "rimozione-mirata"
  | "spazza-via"
  | "pesca"
  | "accelerazione-di-mana"
  | "conta-le-creature"
  | "si-cura-del-cimitero";

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
 * errore.
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
 * Una carta del pool: **una voce per nome**, non per stampa. La stampa da cui
 * vengono identificativo, immagine, rarità e prezzo è la più economica fra
 * quelle legali in Standard cartaceo.
 */
export type Carta = {
  /** Identificativo Scryfall della stampa scelta. */
  id: string;
  /** Il nome inglese, che è anche la chiave: solo inglese, per decisione Q24. */
  nome: string;
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
  /**
   * La legalità **letta dai dati**, mai dedotta da una data o da un elenco di
   * set: è un vincolo non negoziabile di `CLAUDE.md`. Nel pool vale sempre
   * `"legal"`, ed è conservata proprio perché sia verificabile.
   */
  legalitaStandard: string;
  prezzo: Prezzo;
  /**
   * I tag di sinergia, in ordine dichiarato e senza ripetizioni: regole
   * meccaniche più correzioni a mano, come vuole Q13.
   */
  tag: Tag[];
  /**
   * I nomi dei tag di **Scryfall Tagger** che la carta porta, in ordine
   * alfabetico. Sono un'altra razza dai nove qui sopra, e stanno in un campo
   * diverso apposta: chi legge il pool deve sapere da dove viene un tag senza
   * indovinarlo. I loro id stanno nel registro del pool.
   *
   * Vuoto è uno stato legittimo, e non solo per le carte che Tagger non ha
   * ancora guardato: nel pool del 2 settembre 2026 sono senza nemmeno uno dei
   * nove 1.943 carte.
   */
  tagScryfall: string[];
  /** Le facce, annidate, quando la carta ne ha più di una. Altrimenti `null`. */
  facce: Faccia[] | null;
  /** Presente solo se la carta è una terra. */
  terra: Terra | null;
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
