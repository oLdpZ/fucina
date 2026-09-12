/**
 * **Quando il deposito rifiuta gli orologi, la schermata lo dice.**
 *
 * `deposito.ts` promette in cima a sé di non fallire rumorosamente: modo
 * privato, spazio esaurito, permessi negati, database aperto da un'altra
 * scheda sono casi **normali**, e restituisce un esito invece di sollevare
 * perché chi chiama se ne occupi. Questa è la funzione che se ne occupa per gli
 * orologi (ticket 45): l'esito entra, la parola da mostrare esce.
 *
 * Le porte sono due, e le note anche. `notaDelDeposito` è quella delle
 * scritture — il salvataggio a ogni tasto, il ripristino. `notaDellaLettura`,
 * in fondo, è quella dell'apertura: gli orologi conservati che non si sono
 * potuti leggere (ticket 54). Stessa regola per tutt'e due.
 *
 * Gli orologi sono l'unica cosa che l'app conserva e che nessuno può
 * ricostruire al posto dell'utente, e la loro schermata è l'unica **senza un
 * tasto salva** — si salvano a ogni tasto premuto. Non c'è quindi il momento in
 * cui uno si aspetterebbe una conferma o un guasto: chi scrive dieci mazzi in
 * navigazione privata li vede tutti e dieci, li perde chiudendo la scheda, e
 * prima di questo codice nessuno gliel'aveva detto.
 *
 * Due regole, e sono tutta la ragione per cui questa decisione sta qui e non
 * dentro il componente:
 *
 * - **Che cosa perde l'utente**, non che cosa ha risposto il deposito. Il nome
 *   della funzione che ha detto `false` non è un'informazione per chi legge.
 * - **Solo quel che si sa.** Un deposito che non si è nemmeno aperto non ha
 *   scritto — e questo si sa dire — ma di quel che sta sul dispositivo non
 *   dice niente, e allora la nota del ripristino tace invece di promettere.
 * - **Una volta, non a ogni tasto.** Un guasto del deposito non cambia da un
 *   carattere all'altro: la nota è *la stessa parola* a ogni rifiuto — la
 *   schermata la riscrive identica e non ne impila una nuova — e se ne va solo
 *   quando una scrittura riesce. Niente finestre che interrompono: il modo
 *   privato è una scelta legittima, e l'app ne dice la conseguenza una volta
 *   sola invece di mettersi in mezzo.
 */

import type { EsitoDellaLettura, EsitoDellaScrittura } from "../dati/deposito.js";

/** Quale scrittura il deposito ha accettato o rifiutato. */
export type ScritturaDegliOrologi = "salvataggio" | "ripristino";

const NOTE: Record<ScritturaDegliOrologi, string> = {
  salvataggio:
    "I mazzi che incontri non si sono potuti salvare su questo dispositivo: " +
    "manca lo spazio, o il browser è in navigazione privata. Restano per questa " +
    "sessione e non oltre: chiudendo la scheda li perdi.",
  ripristino:
    "I mazzi di partenza sono tornati sullo schermo, ma quel che avevi scritto " +
    "non si è potuto cancellare da questo dispositivo. Alla prossima apertura " +
    "ritroverai i tuoi, non questi.",
};

/**
 * La nota dopo un tentativo di scrittura: `null` quando non c'è niente da
 * dire, e allora la schermata non guadagna nessun messaggio nuovo.
 *
 * Il deposito che ha accettato non è l'unico caso in cui si tace. L'altro è il
 * **ripristino su un deposito che non si è aperto**, e sta qui perché è la
 * decisione che l'asimmetria dei due verbi impone:
 *
 * - Chi **scrive** su un deposito che non si apre ha perso quel che ha
 *   battuto, e lo si può dire in tutti e tre i casi che portano lì —
 *   navigazione privata, `indexedDB` assente, versione bloccata da un'altra
 *   scheda. La nota del salvataggio è vera sempre.
 * - Chi **cancella** su un deposito che non si apre non sa che cosa resti sul
 *   dispositivo: in navigazione privata non c'era niente, e non si perde
 *   niente; dietro un `onblocked` c'era tutto, e torna alla riapertura.
 *   Affermare l'uno o l'altro sarebbe inventare, e una nota esiste per nominare
 *   una perdita, non per riempire un silenzio. Chi ha scritto qualcosa in quella
 *   sessione ha comunque già davanti la nota del salvataggio, che quel caso lo
 *   racconta per intero.
 */
export function notaDelDeposito(
  quale: ScritturaDegliOrologi,
  esito: EsitoDellaScrittura,
): string | null {
  if (esito === "fatta") return null;
  if (esito === "nessun-deposito" && quale === "ripristino") return null;
  return NOTE[quale];
}

/**
 * La nota **prima** di ogni scrittura: quando gli orologi conservati non si
 * sono potuti leggere (ticket 54).
 *
 * Stessa regola delle altre — che cosa perde l'utente, e solo quel che si sa —
 * applicata a una porta diversa. Qui quel che si sa è poco e va detto tutto
 * intero: sullo schermo i suoi mazzi non ci sono, e per non scrivere sopra un
 * deposito che non si è saputo guardare l'app da adesso non salva più.
 *
 * Quel che **non** si sa non si dice. Non si promette che i suoi mazzi siano
 * ancora là — dietro una lettura fallita ci può essere tutto come ci può
 * essere un deposito rovinato —, che è la stessa ragione per cui la nota del
 * ripristino tace invece di rassicurare. E non si suggerisce il rimedio di uno
 * solo dei casi possibili: chiudere le altre schede serve quando è un'altra
 * scheda a tenere il deposito, e dirlo a chi ha un guasto diverso è mandarlo a
 * fare una cosa inutile.
 *
 * I mazzi di cui parla sono **quelli che incontri**, come li chiama la nota
 * del salvataggio: l'app ne conserva anche di altri — i mazzi che l'utente ha
 * salvato, in un altro scaffale (ticket 07) — e quelli qui non c'entrano.
 *
 * Senza questa nota la schermata mostrerebbe un pannello vuoto senza dire
 * perché, e un elenco vuoto in questa app è una risposta dell'utente: sarebbe
 * un guasto travestito da sua decisione.
 */
export function notaDellaLettura(lettura: EsitoDellaLettura): string | null {
  if (lettura !== "non-si-e-letto") return null;
  return (
    "I mazzi che incontri, quelli salvati su questo dispositivo, non si sono " +
    "potuti leggere: qui sotto non ci sono. Per non scriverci sopra senza " +
    "averli visti, l'app da adesso non li salva: quel che scrivi vale per " +
    "questa sessione e non oltre. Riprova a riaprire l'app più tardi."
  );
}
