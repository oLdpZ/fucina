/**
 * **Che cosa fare degli orologi all'apertura, deciso dalla sola lettura.**
 *
 * `leggiOrologiSalvati` risponde a due domande diverse con la stessa parola
 * finché non le si tiene separate: «l'utente non ha mai salvato niente» e «quel
 * che ha salvato non si è potuto leggere». La prima è una risposta: là non c'è
 * nessuna voce da rispettare, e il file di cortesia del manutentore è meglio di
 * una schermata vuota. La seconda non è una risposta: dietro un `onblocked` —
 * un'altra scheda che tiene aperta una versione vecchia del deposito — ci sono
 * tutti i mazzi dell'utente, ancora dove li aveva lasciati.
 *
 * Confonderle costa due volte (ticket 54). La prima è sullo schermo, e si
 * ripara riaprendo: al posto dei suoi mazzi ci sono quelli di cortesia. La
 * seconda non si ripara: la schermata degli orologi non ha un tasto salva e
 * scrive a ogni tasto premuto, quindi il primo carattere battuto manda la
 * sostituzione nel deposito, sopra gli originali. È la stessa perdita che
 * `EsitoDellaScrittura` è nato per impedire (ticket 45), dall'altra parte della
 * porta.
 *
 * Perciò di una lettura che non è riuscita si fa **niente**: non si sostituisce
 * quel che c'è sullo schermo, e non si scrive sul dispositivo. Quel che
 * l'utente batte in questa sessione resta in questa sessione — e glielo si dice
 * (`note-degli-orologi.ts`), perché un silenzio è esattamente quel che questo
 * ticket toglie di mezzo.
 */

import type { EsitoDellaLettura } from "../dati/deposito.js";

/** Che cosa l'app fa degli orologi all'apertura. */
export interface AperturaDegliOrologi {
  /**
   * Quali orologi vanno sullo schermo: i suoi, quelli del manutentore, oppure
   * **niente** — e allora si resta com'era, che è tutto il punto del terzo caso.
   */
  readonly mostra: "i-suoi" | "quelli-del-manutentore" | "niente";
  /**
   * Si può scrivere nel deposito? `false` quando là dentro potrebbe esserci
   * roba dell'utente che non si è saputa leggere: non si scrive sopra quel che
   * non si è potuto vedere.
   */
  readonly siPuoScrivere: boolean;
}

export function aperturaDegliOrologi(lettura: EsitoDellaLettura): AperturaDegliOrologi {
  if (lettura === "letti") return { mostra: "i-suoi", siPuoScrivere: true };
  if (lettura === "mai-salvati") {
    return { mostra: "quelli-del-manutentore", siPuoScrivere: true };
  }
  return { mostra: "niente", siPuoScrivere: false };
}
