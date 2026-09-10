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
import { comprabile, contoDelMazzo } from "./spesa.js";
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
  // Il solo minimo, e una carta senza listino conta zero: dentro la ricerca è
  // innocuo — un mazzo che non si sa contare non si consegna comunque
  // (`Richiesta.tettoDiSpesa`), e prima di arrivare qui è già stato rifiutato.
  //
  // **Fuori dalla ricerca no**, e va detto invece che lasciato credere: le due
  // schermate che riaprono un mazzo salvato chiamano di qui senza che nessuna
  // ricerca giri più, e su un mazzo che il pool di oggi non sa più prezzare
  // tutto darebbero alle terre un budget più largo del vero — sotto una riga
  // che dice che il tetto vale ancora. È lo stesso guasto del ticket 34 sulla
  // strada che quel ticket non guardava, ed è la sua coda: chiede di decidere
  // che cosa sia un tetto «ancora in vigore» sopra un mazzo diventato
  // incontabile, che è una domanda sul mazzo salvato e non sulla ricerca.
  return Math.max(0, tettoDiSpesa - contoDelMazzo(mazzo).minimo);
}

/**
 * Quanto due temi differiscono **sulle terre**: quello con cui un mazzo è stato
 * costruito e quello dichiarato adesso nei Vincoli (ticket 31).
 *
 * Sta qui e non nelle due schermate che lo mostrano per la ragione per cui esiste
 * questo file: la stessa domanda a cui rispondevano tre posti diversi si scrive
 * una volta sola. Il conto era già stato copiato in `Mazzo.tsx` e in
 * `MazziSalvati.tsx`, che è esattamente la strada da cui, dopo il ticket 19, la
 * lista per l'arbitro elencava terre che il mazzo mostrato non conteneva.
 *
 * `stessaBase` è la domanda vera — «cambia qualcosa, a rifarle col tema di
 * adesso?» — e si risponde sull'**insieme** delle terre, non sul loro numero:
 * due temi che ne ammettono altrettante ma non le stesse scelgono basi diverse.
 * I conti accanto sono quelli che la frase mette dentro di sé, perché una frase
 * senza numeri è un'opinione.
 *
 * Il prezzo qui non entra: la domanda è che cosa il **tema** lascia passare, e
 * del tetto parla la frase accanto.
 */
export type ConfrontoFraTemi = {
  /** Quante terre ammette il tema con cui il mazzo è stato costruito. */
  terreAmmesse: number;
  /** Quante terre ha il formato in tutto, prima di qualunque esclusione. */
  terreDelFormato: number;
  /** Quante ne ammetterebbe il tema dichiarato adesso. */
  terreColTemaDiAdesso: number;
  /** Quante ne ammette il primo che il secondo non ammette. */
  terreSoloSue: number;
  /** Se i due temi ammettono esattamente le stesse terre. */
  stessaBase: boolean;
};

export function confrontoFraTemiSulleTerre(
  carte: readonly Carta[],
  temaDelMazzo: Tema,
  temaDeiVincoli: Tema,
): ConfrontoFraTemi {
  const sue = terrePermesseDalTema(carte, temaDelMazzo);
  const adesso = terrePermesseDalTema(carte, temaDeiVincoli);
  const nomiDiAdesso = new Set(adesso.map((carta) => carta.nome));
  const terreSoloSue = sue.filter((carta) => !nomiDiAdesso.has(carta.nome)).length;
  return {
    terreAmmesse: sue.length,
    terreDelFormato: carte.filter((carta) => carta.terra !== null).length,
    terreColTemaDiAdesso: adesso.length,
    terreSoloSue,
    // Stesso numero **e** nessuna che stia solo di qua: due insiemi finiti di
    // pari cardinalità in cui il primo non ha estranei sono lo stesso insieme.
    stessaBase: sue.length === adesso.length && terreSoloSue === 0,
  };
}
