/**
 * **Come si legge una casella numerica**: la regola, in un posto solo.
 *
 * La domanda che una casella pone a ogni tasto premuto non è «quanto vale
 * questo numero» ma «ho davanti un numero?». Sono due domande diverse, e
 * confonderle è il difetto del ticket 36: `Number("")` è `0`, e `0` è un
 * intero, così una casella svuotata per riscriverla dichiarava zero — e
 * l'orologio finiva in IndexedDB azzerato nello stesso istante.
 *
 * Perciò si guarda il **testo** prima del numero, e si guarda tutto: `Number`
 * accetta anche `" "`, `"1e3"` e `"0x10"`, e una casella di rimozioni non deve
 * poter dire mille copie perché qualcuno ha battuto una «e».
 *
 * Chi non legge un numero non riceve uno zero di ripiego ma **niente**, che è
 * la sola risposta onesta: mettere in bocca all'utente una cifra che non ha
 * scritto è quel che questa regola esiste per impedire.
 */

/** Un intero scritto a mano, dentro i suoi limiti, oppure niente. */
export function interoScritto(
  grezzo: string,
  limiti: { minimo: number; massimo: number },
): number | undefined {
  const scritto = grezzo.trim();
  // Solo cifre, con un segno davanti al più: tutto il resto — la casella vuota,
  // gli spazi, la notazione esponenziale, l'esadecimale, la virgola — non è
  // qualcosa che l'utente stia dichiarando.
  if (!/^[+-]?\d+$/.test(scritto)) return undefined;

  const letto = Number(scritto);
  if (letto < limiti.minimo || letto > limiti.massimo) return undefined;
  return letto;
}
