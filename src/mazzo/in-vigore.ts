/**
 * Quando un mazzo smette di essere «quello che il motore ha costruito», e con
 * quello smette di portarsi dietro **il tetto di spesa e il tema** con cui è
 * nato (ticket 21, poi ticket 31).
 *
 * Il tetto viaggia col mazzo e non con l'interruttore — chi costruisce a 30 € e
 * poi spegne l'interruttore non deve vedersi cambiare la base sotto le mani — e
 * finché non c'era questo modulo non si staccava mai: si poteva sostituire a
 * mano tutte e sessanta le carte e continuare a leggere che «per stare dentro
 * 30,00 € la base ha lasciato fuori…», per un tetto che nessuno aveva chiesto
 * per quel mazzo.
 *
 * La regola è la più stretta delle tre che il ticket metteva in fila, ed è
 * scelta per quel che non ha: **nessun numero da tarare**. Il tetto vale finché
 * il mazzo in mano è, carta per carta, quello che il motore ha consegnato; alla
 * prima copia cambiata a mano non lo è più, e il tetto se ne va. Severa, ma
 * dicibile in una frase — e all'utente non si toglie niente di nascosto,
 * perché finché il tetto è in vigore la schermata del mazzo lo **dice** e gli
 * dà il modo di levarlo prima ancora di toccare una carta.
 *
 * Il confronto si rifà **ogni volta**, e non si tiene da parte un «questo mazzo
 * è stato toccato»: chi toglie una copia e la rimette si ritrova il tetto, e le
 * terre che aveva prima. È la conseguenza voluta della domanda a cui questo
 * modulo risponde, che non è «l'utente ha toccato qualcosa» ma «quel che ha in
 * mano è il mazzo che il motore gli ha dato». Se lo è di nuovo, lo è: un tetto
 * che restasse staccato dopo un ripensamento starebbe rispondendo alla prima
 * domanda mentre ne dichiara un'altra.
 *
 * Il tetto non si deduce mai dall'interruttore della costruzione: quello dice
 * che cosa l'utente sta chiedendo **adesso** al motore, non con che cifra il
 * mazzo che ha in mano è stato costruito.
 *
 * ## Perché anche il tema (ticket 31)
 *
 * Il tetto era metà della risposta. La base di terre si filtra con due cose —
 * le esclusioni del tema, poi il prezzo (`terre-candidate.ts`) — e finché solo
 * la seconda viaggiava col mazzo, la prima continuava a essere letta
 * dall'interruttore: dalla manopola del tema, cioè da quel che l'utente sta
 * chiedendo adesso. Fra due schermate della stessa sessione non si vedeva. Fra
 * due sessioni sì, ed era il guasto del ticket 31: un mazzo salvato dicendo
 * «niente nero» si riapriva pieno di paludi, senza un avviso.
 *
 * Il tema si mette dunque **qui** e non nella manopola, e questa è la decisione
 * del ticket: riaprire un mazzo non riscrive la schermata dei Vincoli sotto le
 * mani di chi stava guardando altro. Il tema di allora resta attaccato a quel
 * mazzo, gli rifà le sue terre, viene **detto**, e si può levare — e alla prima
 * carta cambiata a mano se ne va da solo, insieme al tetto, perché quel mazzo
 * non è più quel mazzo.
 *
 * Tema e tetto si staccano **insieme** e dallo stesso confronto: se cadessero a
 * momenti diversi esisterebbe uno stato in cui la base è filtrata da metà della
 * richiesta di allora e da metà di quella di adesso, cioè una base che non è
 * mai stata chiesta da nessuno.
 */

import type { Tema } from "../tema/tema.js";
import type { Richiesta } from "./salvato.js";

/**
 * Il mazzo come è stato consegnato: sotto quali vincoli le sue terre sono state
 * decise, e le carte che ci stavano dentro.
 *
 * Le carte stanno insieme ai vincoli perché senza di esse i vincoli non si
 * possono più mettere in discussione: un tetto da solo è una cifra che non sa
 * più a quale mazzo apparteneva, e un tema da solo lo stesso.
 *
 * «Consegnato» dal motore o **riaperto** dai mazzi salvati: sono la stessa cosa
 * per chi guarda di qui, e devono esserlo — in tutti e due i casi c'è un mazzo
 * che è la risposta a una richiesta, e quella richiesta ne decide le terre
 * finché il mazzo è ancora quello.
 *
 * Le terre non ci sono, e non è una dimenticanza: la schermata del mazzo le
 * rifà dalle carte, quindi non sono una scelta dell'utente da confrontare.
 * Cambiare **quante** terre si vogliono non rifà il mazzo, lo rilegge.
 */
export type MazzoConsegnato = {
  /**
   * Il tetto con cui è stato costruito, in euro; `null` quando nessun tetto lo
   * ha prodotto — un mazzo costruito a interruttore spento, o salvato prima che
   * l'app scrivesse il tetto.
   *
   * Zero è un tetto e non l'assenza di uno: «solo carte senza prezzo» è una
   * richiesta legittima.
   */
  tetto: number | null;
  /**
   * Il tema sotto cui le sue terre sono state scelte; `null` quando nessun tema
   * era dichiarato, o quando il mazzo è stato salvato prima del ticket 31.
   *
   * `null` non vuol dire «tema vuoto»: vuol dire che questo mazzo non dichiara
   * come sono state scelte le sue terre, e che si rifanno con quel che c'è
   * adesso — come facevano tutti i mazzi prima di questo ticket.
   */
  tema: Tema | null;
  /** Le copie per nome al momento della consegna. */
  copie: ReadonlyMap<string, number>;
};

/** Le copie che ci sono davvero: una voce a zero è una carta che non c'è. */
function presenti(copie: ReadonlyMap<string, number>): Map<string, number> {
  return new Map([...copie].filter(([, quante]) => quante > 0));
}

/** Se due elenchi di copie sono lo stesso mazzo. L'ordine non conta. */
function stessoMazzo(uno: ReadonlyMap<string, number>, altro: ReadonlyMap<string, number>): boolean {
  const primo = presenti(uno);
  const secondo = presenti(altro);
  if (primo.size !== secondo.size) return false;
  for (const [nome, quante] of primo) {
    if (secondo.get(nome) !== quante) return false;
  }
  return true;
}

/**
 * La richiesta che vale **adesso** sul mazzo in mano: quella sotto cui è stato
 * costruito finché è ancora quel mazzo, `null` appena non lo è più.
 *
 * È **la stessa regola** per il tetto e per il tema qui sotto, scritta una volta
 * sola: non che il confronto giri una volta per render — ognuno dei due lo
 * chiama per sé, e la mappa si percorre due volte — ma che non esista un secondo
 * posto in cui la risposta si possa scrivere diversa. Il confronto è puro e
 * costa quanto il mazzo è lungo, cioè niente: pagarlo due volte è il prezzo di
 * non poterlo sbagliare in due modi.
 *
 * `null` per i mazzi messi insieme a mano dal catalogo, che qui arrivano senza
 * nessun mazzo consegnato: nessuna richiesta li ha prodotti, e nessuna se ne
 * applica — le loro terre le decidono il tema e il tetto di adesso.
 */
function richiestaInVigore(
  consegnato: MazzoConsegnato | null,
  inMano: ReadonlyMap<string, number>,
): MazzoConsegnato | null {
  if (consegnato === null) return null;
  return stessoMazzo(consegnato.copie, inMano) ? consegnato : null;
}

/**
 * Il tetto che vale **adesso** sul mazzo in mano, `null` quando non ce n'è uno
 * — perché il mazzo non è più quello, perché nessun tetto lo ha prodotto, o
 * perché nessuna richiesta lo ha prodotto affatto.
 */
export function tettoInVigore(
  consegnato: MazzoConsegnato | null,
  inMano: ReadonlyMap<string, number>,
): number | null {
  return richiestaInVigore(consegnato, inMano)?.tetto ?? null;
}

/**
 * Il tema che decide **adesso** le terre del mazzo in mano, `null` quando le
 * decide quello dichiarato nei Vincoli.
 *
 * Chi lo riceve non lo mette nella manopola: lo passa a `terreCandidate` al
 * posto del tema dell'app, e quando è `null` passa quello dell'app. È tutta la
 * differenza fra rimettere l'app com'era e rimettere in mano il mazzo com'era,
 * e il ticket 31 ha scelto la seconda.
 */
export function temaInVigore(
  consegnato: MazzoConsegnato | null,
  inMano: ReadonlyMap<string, number>,
): Tema | null {
  return richiestaInVigore(consegnato, inMano)?.tema ?? null;
}

/**
 * I vincoli che un mazzo **riaperto** si riporta dietro, dalla richiesta con cui
 * era stato salvato (ticket 31).
 *
 * Sta qui e non dentro `App` per la ragione di sempre in questo progetto: è la
 * cucitura da cui i test entrano. Il guasto del ticket 31 non viveva in nessuno
 * dei pezzi ma **fra** i pezzi — `salvato.ts` sa rileggere il tema ma non sa che
 * terre scelga, `terre-candidate.ts` non sa da dove venga il tema che riceve — e
 * una regola scritta dentro un componente sarebbe rimasta fuori dalla portata di
 * qualunque prova, che è esattamente com'era prima.
 *
 * `null` quando la richiesta non dichiara nessun vincolo: un mazzo salvato prima
 * di questo ticket. Le sue terre si rifanno con quel che c'è adesso, e la
 * schermata non dice niente su come sono state scelte perché non lo sa.
 */
export function vincoliDiUnMazzoRiaperto(
  richiesta: Richiesta,
  copie: ReadonlyMap<string, number>,
): MazzoConsegnato | null {
  const { tema, tetto } = richiesta;
  if (tema === undefined && tetto === undefined) return null;
  // Le copie si fotografano in una mappa **sua**: quella di chi chiama può
  // cambiare padrone, e una fotografia che fosse lo stesso oggetto
  // confronterebbe il mazzo con se stesso — cioè non staccherebbe i vincoli mai
  // più, che è il difetto per cui questo modulo esiste.
  return { tetto: tetto ?? null, tema: tema ?? null, copie: new Map(copie) };
}
