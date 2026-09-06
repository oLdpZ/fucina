/**
 * Quante copie di una carta può contenere un mazzo.
 *
 * Il numero **non si deduce qui**: è un dato della carta, scritto dalla
 * preparazione del pool (`tettoDiCopie`), e questo modulo è il posto unico da
 * cui si legge. È la differenza che tiene il motore fuori dal formato: chi
 * costruisce e chi scambia non sa quali carte siano limitate, sa solo leggere
 * un numero.
 *
 * Qui resta però la **regola del gioco** che quel numero in parte decide,
 * perché è una regola del gioco e non del formato: esistono carte che portano
 * scritto «A deck can have any number of cards named …», e un mazzo costruito
 * attorno a una di quelle è esattamente il genere di mazzo fuori meta per cui
 * questa app esiste. Il permesso si legge **dal testo della carta**, mai da un
 * elenco di nomi scritto nel codice: i nomi cambiano, la frase no. È lo stesso
 * principio di `CLAUDE.md`.
 *
 * La preparazione chiama `leggiTettoDiCopie` una volta per carta; l'app chiama
 * `copieMassime` ogni volta che serve.
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
 * Quante copie ne ammette un mazzo quando il formato dichiara una carta
 * **limitata**. Non è verità di formato: è il significato della parola, e sta
 * qui accanto agli altri numeri di copie invece che sparso in preparazione.
 *
 * *Quali* carte siano limitate lo dice il documento di formato, e questo modulo
 * non lo sa né lo può sapere.
 */
export const COPIE_DI_UNA_LIMITATA = 1;

/**
 * Il tetto che il **gioco** mette a una carta, letto dal suo testo e dai suoi
 * tipi: `null` quando tetto non ce n'è.
 *
 * Le terre base non hanno tetto per regola del gioco, e non per gentilezza
 * dell'app: un mazzo può contenerne quante ne vuole.
 *
 * Prende testo e tipi invece della carta intera perché la preparazione la
 * chiama mentre la carta si sta ancora componendo.
 */
export function leggiTettoDiCopie(testo: string, tipi: readonly string[]): number | null {
  if (tipi.includes("Basic") && tipi.includes("Land")) return null;
  if (PERMESSO.test(testo)) return null;
  return COPIE_MASSIME;
}

/**
 * Il tetto di una carta del pool, in copie, nella forma con cui si fanno i
 * conti: `Infinity` dove il pool scrive `null`, così chi lo usa lo può
 * confrontare e troncare senza distinguere due casi.
 */
export function copieMassime(carta: Carta): number {
  return carta.tettoDiCopie ?? Number.POSITIVE_INFINITY;
}

/**
 * Le copie che l'app si concede davvero di una carta: il suo tetto, ma **mai
 * oltre le quattro**.
 *
 * Le due cose non coincidono nei due sensi opposti, ed è tutto il senso di
 * questa funzione. Sotto: una carta che il formato limita ne ammette una, e una
 * sola ne entra. Sopra: una carta che si concede copie illimitate potrebbe
 * riempire un mazzo intero, e trentatré copie della stessa carta sono un mazzo
 * legale che non è un mazzo — di lì non si parte.
 *
 * Sta qui, e non nel motore, perché la stessa risposta serve a chi costruisce e
 * a chi la **racconta** all'utente: la frase che promette «te ne metto tante»
 * deve leggere lo stesso numero che il mazzo poi contiene, se no promette
 * quattro copie di una carta che il formato limita a una.
 */
export function copieAlMassimo(carta: Carta): number {
  return Math.min(copieMassime(carta), COPIE_MASSIME);
}
