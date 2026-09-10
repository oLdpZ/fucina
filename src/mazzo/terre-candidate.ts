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
 * Quel che resta alla base di terre dopo le carte — e **che cosa il numero non
 * racconta** (ticket 20, poi ticket 38).
 *
 * È un tipo e non un numero per la stessa ragione per cui `contoDelMazzo` lo è
 * diventato: perché la sottrazione qui sotto parte da un **minimo**, e chi
 * riceveva un numero nudo non aveva modo di saperlo. Con le carte incontabili
 * accanto, chi vuole gli euro deve nominarli, e nominandoli si ricorda su che
 * cosa poggiano.
 */
export type BudgetDelleTerre = {
  /**
   * Gli euro che restano al netto delle carte che **un prezzo ce l'hanno**.
   * Mai sotto zero — un budget negativo è quel che rompeva la ricerca prima del
   * ticket 20, e non deve poter rientrare da questa porta. È il resto vero solo
   * quando `incontabili` è vuoto; altrimenti è un massimo, e il resto vero può
   * essere qualunque cifra più bassa, zero compreso.
   */
  euro: number;
  /**
   * Le carte del mazzo di cui nessuna copia ammessa ha listino, come le nomina
   * `contoDelMazzo`. Vuoto è la notizia buona.
   */
  incontabili: readonly Carta[];
};

/**
 * Quanto la base di terre può spendere; `null` quando il tetto di spesa è
 * spento.
 *
 * È una sottrazione e non una quota decisa a priori: la base non deve
 * indovinare quanto le tocca, glielo si dice (ticket 20).
 *
 * ## Perché il numero si accompagna alle carte che non si sanno contare
 *
 * Il minimo conta zero una carta senza listino. **Dentro la ricerca** è
 * innocuo: un mazzo che non si sa contare non si consegna
 * (`Richiesta.tettoDiSpesa`, ticket 34), e prima di arrivare qui è già stato
 * rifiutato. **Fuori** no, e i due chiamanti che restano — le schermate che
 * riaprono un mazzo salvato — con la ricerca non c'entrano: là nessun mazzo è
 * stato rifiutato da nessuno, perché il mazzo c'era già quando il pool sapeva
 * prezzarlo tutto, e il listino è sparito dopo.
 *
 * La decisione del ticket 38 è che in quel caso **cade la promessa, non il
 * mazzo**. Il mazzo esiste e l'utente ce l'ha in mano: non gli si fa sparire la
 * carta, e non gli si rifà la base — un listino ritirato da Cardmarket non è
 * una buona ragione per riscrivergli il mazzo sotto le mani. E i vincoli non
 * decadono: le carte non sono cambiate, quindi è ancora quello che il motore ha
 * consegnato (`in-vigore.ts`) — e farli decadere qui porterebbe via **anche il
 * tema**, che si stacca insieme al tetto, riempiendo di paludi un mazzo nato
 * «niente nero» per via di un prezzo mancante.
 *
 * Quel che cade è la riga che dichiara che le terre sono scelte per stare
 * dentro il tetto: `frasePerIlTettoInVigore` la ritira e nomina la carta, e può
 * farlo perché quel che le arriva di qui non è più un numero solo.
 */
export function budgetPerLeTerre(
  mazzo: readonly CopieDiCarta[],
  tettoDiSpesa: number | null,
): BudgetDelleTerre | null {
  if (tettoDiSpesa === null) return null;
  const conto = contoDelMazzo(mazzo);
  return { euro: Math.max(0, tettoDiSpesa - conto.minimo), incontabili: conto.incontabili };
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
