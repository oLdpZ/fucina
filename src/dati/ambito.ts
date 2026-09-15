/**
 * L'**ambito** dell'app: quale gioco si sta giocando.
 *
 * Fino a ieri era una costante del sorgente — una stringa scritta accanto al
 * nome dell'app — e questo modulo è il posto dove smette di esserlo. L'ambito
 * si legge dal documento di formato, come tutto il resto della verità di
 * formato ([ADR-0004](../../docs/adr/0004-nessuna-verita-di-formato-nel-sorgente.md)):
 * qui non c'è nessun nome di formato, nessun codice di edizione, nessuna data.
 *
 * Serve a due cose diverse, ed è per questo che l'identità ha due campi:
 *
 * - il **nome** è quel che l'utente legge — in testata, sulla lista da
 *   consegnare all'arbitro, nel testo che manda a un amico. Si mostra;
 * - l'**impronta** è quel che due app confrontano per sapere se stanno giocando
 *   allo stesso gioco. Si confronta, e non si mostra da sola.
 *
 * Tenerli separati è la decisione di questo modulo, e la ragione è nel
 * documento stesso: il nome del formato è **dichiarato da confermare** — nessuno
 * sa ancora come lo chiama il gruppo al tavolo. Se i mazzi salvati si
 * confrontassero per nome, il giorno in cui il gruppo risponde si chiuderebbero
 * tutti in una volta, per un gioco che non è cambiato di una carta.
 *
 * ## Che cosa fa un formato diverso
 *
 * L'impronta guarda il **criterio** e le **edizioni ammesse**, e nient'altro.
 * Sono le due voci che decidono *quali carte esistono*: cambiarle è cambiare il
 * gioco, e un mazzo di prima non è più giocabile.
 *
 * Le limitate e le bandite invece **non** entrano. Una carta che il gruppo mette
 * a una copia non fa un formato nuovo: fa lo stesso formato con una riga in più,
 * e il mazzo salvato resta un mazzo di questo gioco — al più con dentro una
 * carta da togliere, che è una cosa che si vede aprendolo. Se entrassero, ogni
 * ripensamento del gruppo chiuderebbe in silenzio tutti i mazzi salvati.
 *
 * Le **lingue ammesse** stanno con le limitate e le bandite, per la stessa
 * ragione e per una in più: dicono quale copia si porta al tavolo, non quali
 * carte esistono. Il giorno che il gruppo rispondesse che la Quarta inglese non
 * si gioca, l'app cambierebbe la copia da cui prende il prezzo per centinaia di
 * carte — e non cambierebbe un solo nome. Deciso in ADR-0006.
 */

import type { Formato } from "./formato.js";

/**
 * Il formato che ha prodotto un mazzo, come il mazzo se lo porta dietro.
 *
 * È la forma che viaggia: sta nel mazzo salvato sul dispositivo e nel testo che
 * si manda a un amico. Due campi e due stringhe, perché è una cosa che deve
 * poter essere riletta fra un anno da un'app che nel frattempo è cambiata.
 */
export type IdentitaDiFormato = {
  /** Come si chiamava il formato quando il mazzo è stato fatto. Si mostra. */
  nome: string;
  /** Il gioco a cui il mazzo appartiene, in una forma che si confronta. */
  impronta: string;
};

/** L'identità del formato che l'app sta giocando adesso. */
export function identitaDelFormato(formato: Formato): IdentitaDiFormato {
  return { nome: formato.nome, impronta: improntaDelFormato(formato) };
}

/**
 * L'impronta: il criterio, e i codici delle edizioni ammesse.
 *
 * In ordine e senza ripetizioni, perché il documento lo scrive una mano: due
 * righe scambiate di posto sono una correzione di stile, non un formato nuovo.
 * Ripulita e in minuscolo per la stessa ragione — uno spazio in coda a un
 * codice non si vede, e non deve chiudere i mazzi di nessuno.
 *
 * Resta **leggibile**: finisce dentro un testo che passa per messaggi, e chi lo
 * guarda deve poter capire da sé perché due mazzi non sono dello stesso gioco.
 */
function improntaDelFormato(formato: Formato): string {
  const edizioni = [
    ...new Set(formato.edizioni.map((edizione) => edizione.codice.trim().toLowerCase())),
  ].sort();
  return `${formato.criterio.regola}/${edizioni.join("+")}`;
}

/**
 * L'identità riletta da fuori: dal deposito del dispositivo, o da un testo
 * arrivato da un amico.
 *
 * Assente non è un guasto: è il mazzo salvato prima che l'app scrivesse il
 * formato, e quel mazzo si deve continuare a leggere. Storta invece sì: un
 * mazzo che dice di che formato è in un modo che non si capisce non va preso
 * per un mazzo senza formato — quello sarebbe indovinare al posto suo.
 */
export function interpretaIdentita(dati: unknown): IdentitaDiFormato | undefined {
  if (dati === undefined || dati === null) return undefined;

  if (typeof dati !== "object") {
    throw new Error("Questo mazzo dice di che formato è in un modo che non si capisce.");
  }

  const { nome, impronta } = dati as { nome?: unknown; impronta?: unknown };
  if (typeof nome !== "string" || nome.trim() === "") {
    throw new Error("Questo mazzo non dice come si chiama il formato che l'ha prodotto.");
  }
  if (typeof impronta !== "string" || impronta.trim() === "") {
    throw new Error("Questo mazzo non dice a quale formato appartiene.");
  }

  return { nome: nome.trim(), impronta: impronta.trim() };
}

/**
 * Come `interpretaIdentita`, ma un'identità storta vale come assente.
 *
 * È la lettura giusta per il **deposito del dispositivo**, dove un mazzo è già
 * dell'utente. Là dentro un campo scritto a metà — una scrittura interrotta,
 * spazio recuperato dal browser — non deve poter far sparire un mazzo
 * dall'elenco: il formato è il campo meno importante della scheda, e sarebbe
 * l'unico capace di portarsi via tutto il resto. Un mazzo che non si sa di che
 * gioco sia è un mazzo che si vede e si può cancellare; un mazzo scomparso in
 * silenzio è la cosa che il progetto ha promesso di non fare.
 *
 * Per un testo arrivato da fuori vale l'altra, quella severa: là il mazzo non è
 * ancora di nessuno, ed è il momento di dire che il testo non torna.
 */
export function identitaSeSiLegge(dati: unknown): IdentitaDiFormato | undefined {
  try {
    return interpretaIdentita(dati);
  } catch {
    return undefined;
  }
}

/**
 * Due mazzi sono dello stesso gioco?
 *
 * Un'identità assente non è mai lo stesso formato di nessuno, nemmeno di
 * un'altra assente: «non si sa» non è «è il mio», e prenderlo per sì aprirebbe
 * mazzi di un gioco che non si gioca più.
 *
 * Lo fanno due porte, per il ticket 10: l'elenco dei mazzi salvati, dove un
 * mazzo di un altro gioco si legge e si cancella ma non si apre, e
 * l'importazione, che il testo di un altro gioco lo rifiuta con la sua ragione.
 */
export function stessoFormato(
  uno: IdentitaDiFormato | undefined,
  altro: IdentitaDiFormato | undefined,
): boolean {
  if (uno === undefined || altro === undefined) return false;
  return uno.impronta === altro.impronta;
}
