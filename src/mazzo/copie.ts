/**
 * Quante copie di una carta può contenere un mazzo.
 *
 * Sono quattro, tranne quando è la carta stessa a dire di no: esistono carte
 * che portano scritto «A deck can have any number of cards named …», e nel pool
 * di oggi ce ne sono quattro. Un mazzo costruito attorno a una di quelle è
 * esattamente il genere di mazzo fuori meta per cui questa app esiste, e
 * fermarlo a quattro copie sarebbe stato un errore dell'app, non una regola del
 * gioco.
 *
 * Il permesso si legge **dal testo della carta**, mai da un elenco di nomi
 * scritto nel codice: i nomi ruotano, la frase no. È lo stesso principio della
 * legalità in `CLAUDE.md`.
 */

import type { Carta } from "../dati/pool.js";
import { COPIE_MASSIME } from "./taratura.js";

/**
 * La frase con cui le carte si concedono l'eccezione. È inglese perché le carte
 * del pool sono in inglese (Q24), ed è cercata alla lettera perché è una
 * formula fissa del gioco.
 */
const PERMESSO = /a deck can have any number of cards named/i;

/**
 * Il tetto per una carta, in copie. Le carte che se lo concedono non hanno
 * tetto: `Infinity` è la risposta onesta, e chi la usa la tronca comunque alla
 * dimensione del mazzo.
 */
export function copieMassime(carta: Carta): number {
  return PERMESSO.test(carta.testo) ? Number.POSITIVE_INFINITY : COPIE_MASSIME;
}
