/**
 * **Quali terre un mazzo può usare, e quanto può spendere per esse.**
 *
 * Una domanda sola, e prima di questo file aveva tre risposte: la dava il
 * motore (`ricerca/costruisci.ts`), la dava la schermata del mazzo
 * (`componenti/Mazzo.tsx`), e la dava la schermata dei mazzi salvati
 * (`componenti/MazziSalvati.tsx`). Le prime due dicevano la stessa cosa; la
 * terza si era dimenticata due filtri su tre, e la lista da consegnare
 * all'arbitro elencava terre che il mazzo mostrato non conteneva — sul pool
 * vero, 59,58 € di terre sullo schermo contro 6 525,09 € sul foglio.
 *
 * ## Perché una funzione e non tre righe copiate bene
 *
 * `App.tsx` porta scritta, sotto `mettiInMano`, la ragione per cui la base di
 * terre **non si trasporta** ma si ricalcola: «la schermata del mazzo la
 * ricalcola dalle stesse carte, dallo stesso pool e dalle stesse esclusioni del
 * tema, e con lo stesso numero ritrova la stessa base». È un ragionamento
 * giusto che poggia su un «stesse» che nessuno garantiva. Questo file è quel
 * che lo garantisce: finché gli ingressi si scrivono in un posto solo, due
 * schermate che ricalcolano non possono divergere.
 *
 * ## E perché esiste come modulo invece che come metodo di qualcun altro
 *
 * Perché è la cucitura da cui i test entrano. Finché la decisione stava dentro
 * tre componenti, nessuna prova poteva raggiungerla: questo progetto non ha
 * test di componenti e non è questo il lavoro per introdurli. La verificabilità
 * è la ragione, non l'eleganza.
 */

import type { Carta } from "../dati/pool.js";
import type { CopieDiCarta } from "./base-di-terre.js";
import { comprabile, prezzoDelMazzo } from "./spesa.js";
import { escluso, type Tema } from "../tema/tema.js";

/**
 * Le terre che il **tema** permette: quelle che sono terre, e che nessuna
 * esclusione tocca.
 *
 * È un passo a sé e non un dettaglio di `terreCandidate`, perché il motore ha
 * bisogno di guardarlo da solo: per dire all'utente **quante** carte il tetto di
 * spesa ha lasciato fuori deve avere davanti quel che il tema aveva ammesso,
 * prima che il prezzo ne togliesse.
 */
export function terrePermesseDalTema(carte: readonly Carta[], tema: Tema): Carta[] {
  return carte.filter((carta) => carta.terra !== null && !escluso(carta, tema));
}

/**
 * Le terre che questo mazzo può davvero usare: quelle che il tema permette e
 * che il tetto di spesa lascia passare.
 *
 * L'ordine dei due filtri è dichiarato e non casuale, ed è lo stesso che il
 * motore applica alle carte: **il tema decide che mazzo si vuole, il prezzo
 * decide che cosa se ne può comprare.** Una terra senza listino resta fuori
 * appena un tetto c'è, perché col tetto acceso l'app promette un conto e non
 * può promettere quel che non sa contare.
 */
export function terreCandidate(
  carte: readonly Carta[],
  tema: Tema,
  tettoDiSpesa: number | null,
): Carta[] {
  return terrePermesseDalTema(carte, tema).filter((carta) => comprabile(carta, tettoDiSpesa));
}

/**
 * Quanti euro restano alla base di terre dopo le carte; `null` quando il tetto
 * di spesa è spento.
 *
 * È una sottrazione e non una quota decisa a priori: la base non deve
 * indovinare quanto le tocca, glielo si dice (ticket 20). Mai sotto zero — un
 * budget negativo è quel che rompeva la ricerca prima di quel ticket, e non
 * deve poter rientrare da questa porta.
 */
export function budgetPerLeTerre(
  mazzo: readonly CopieDiCarta[],
  tettoDiSpesa: number | null,
): number | null {
  if (tettoDiSpesa === null) return null;
  return Math.max(0, tettoDiSpesa - prezzoDelMazzo(mazzo));
}
