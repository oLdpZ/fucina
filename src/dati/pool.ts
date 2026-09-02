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
  carte: Carta[];
};
