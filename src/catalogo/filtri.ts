/**
 * I filtri del catalogo, e la sola funzione che li applica (storie 7-14).
 *
 * `cerca(carte, filtri)` è la cucitura di questa schermata: l'utente muove i
 * filtri e guarda la lista, e questa funzione è esattamente quel passaggio. Il
 * conteggio vivo non ha un calcolo suo — è la lunghezza di questa lista — così
 * non può capitare che il numero mostrato dica una cosa e la lista un'altra.
 *
 * Nessun filtro è un caso speciale: un insieme vuoto vuol dire «non mi importa»,
 * e i filtri diversi si restringono a vicenda mentre le voci dello stesso filtro
 * si sommano (tre costi selezionati sono tre punti della curva, non le carte che
 * costano tre cose insieme).
 */

import type { Carta, Colore } from "../dati/pool.js";
import { cercaPerNome, normalizza } from "./ricerca.js";

/**
 * L'ultimo scalino del filtro sui costi raccoglie tutto ciò che costa **almeno**
 * tanto: le carte da otto mana esistono, e uno scalino per ciascuna sarebbe una
 * fila di bottoni vuoti.
 */
export const COSTO_MASSIMO_SEPARATO = 7;

/** Gli scalini della curva offerti dal filtro: 0, 1, … 6, e «7 o più». */
export const SCALINI_DI_COSTO: readonly number[] = [0, 1, 2, 3, 4, 5, 6, COSTO_MASSIMO_SEPARATO];

export type Filtri = {
  /** Quel che si è scritto nella ricerca per nome; tollera i refusi. */
  readonly nome: string;
  /**
   * La combinazione di colori che si vuole giocare. Una carta passa se la sua
   * identità di colore ci sta dentro: scegliere il rosso mostra le carte rosse
   * e quelle senza colore, non le rosso-nere, perché in un mazzo mono-rosso
   * quelle non si possono giocare (storia 7).
   */
  readonly colori: readonly Colore[];
  /** Tipi di carta, come stanno nei dati: `Creature`, `Instant`, `Land`… */
  readonly tipi: readonly string[];
  /** Sottotipi di creatura: `Goblin`, `Zombie`, `Dragon`… */
  readonly sottotipi: readonly string[];
  /** Scalini della curva selezionati; l'ultimo vale «o più». */
  readonly costi: readonly number[];
  /** Una parola nel testo delle regole (storia 11). */
  readonly testo: string;
};

export const FILTRI_VUOTI: Filtri = {
  nome: "",
  colori: [],
  tipi: [],
  sottotipi: [],
  costi: [],
  testo: "",
};

/**
 * Quanti filtri sono attivi: serve al bottone che li azzera tutti, che deve
 * comparire solo quando c'è qualcosa da azzerare, e dire quanto.
 */
export function contaFiltriAttivi(filtri: Filtri): number {
  // Vuoto secondo `normalizza`, non secondo `trim`: chi scrive solo un
  // apostrofo non ha filtrato niente, e il bottone «Azzera (1)» direbbe il
  // contrario di quel che mostra la lista.
  return (
    (normalizza(filtri.nome) === "" ? 0 : 1) +
    (normalizza(filtri.testo) === "" ? 0 : 1) +
    (filtri.colori.length === 0 ? 0 : 1) +
    (filtri.tipi.length === 0 ? 0 : 1) +
    (filtri.sottotipi.length === 0 ? 0 : 1) +
    (filtri.costi.length === 0 ? 0 : 1)
  );
}

function costoNelloScalino(valoreDiMana: number, scalino: number): boolean {
  return scalino >= COSTO_MASSIMO_SEPARATO
    ? valoreDiMana >= COSTO_MASSIMO_SEPARATO
    : valoreDiMana === scalino;
}

/**
 * Il testo delle regole normalizzato, calcolato una volta per carta.
 *
 * Senza questa memoria, cercare una parola nel testo rinormalizzerebbe quasi un
 * megabyte di regole a ogni tasto premuto — sul telefono si sentirebbe. La
 * mappa è debole: se un giorno il pool venisse sostituito, il vecchio se ne va
 * da solo.
 */
const testiNormalizzati = new WeakMap<Carta, string>();

function testoNormalizzato(carta: Carta): string {
  let pronto = testiNormalizzati.get(carta);
  if (pronto === undefined) {
    pronto = normalizza(carta.testo);
    testiNormalizzati.set(carta, pronto);
  }
  return pronto;
}

/** Le carte che soddisfano i filtri, nell'ordine in cui vanno mostrate. */
export function cerca(carte: readonly Carta[], filtri: Filtri): Carta[] {
  const testoCercato = normalizza(filtri.testo);
  const colori = filtri.colori;
  const tipi = filtri.tipi;
  const sottotipi = filtri.sottotipi;
  const costi = filtri.costi;

  const passate = carte.filter((carta) => {
    if (colori.length > 0 && !carta.identitaDiColore.every((c) => colori.includes(c))) {
      return false;
    }
    if (tipi.length > 0 && !tipi.some((tipo) => carta.tipi.includes(tipo))) return false;
    if (sottotipi.length > 0 && !sottotipi.some((s) => carta.sottotipi.includes(s))) {
      return false;
    }
    if (costi.length > 0 && !costi.some((s) => costoNelloScalino(carta.valoreDiMana, s))) {
      return false;
    }
    if (testoCercato !== "" && !testoNormalizzato(carta).includes(testoCercato)) return false;
    return true;
  });

  // La ricerca per nome viene per ultima: ordina, e ordinare le poche carte
  // rimaste costa meno che ordinarle tutte per poi buttarne via la maggior parte.
  return cercaPerNome(passate, filtri.nome);
}
