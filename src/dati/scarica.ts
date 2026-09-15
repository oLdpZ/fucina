/**
 * Il tubo dell'aggiornamento in sottofondo: chiede un file di dati al server, e
 * dice se è **arrivato**.
 *
 * I file sono due e nessun altro — il documento di formato e il listino dei
 * prezzi (ticket 11). Le carte non si chiedono più: sono del 1994, non cambiano,
 * e il pool arriva con l'app.
 *
 * Qui non si decide niente: la decisione sta in `aggiornamento.ts`, che riceve
 * questa funzione da fuori e così si prova senza rete.
 */

/**
 * Com'è andata la richiesta, per chi deve decidere se dirlo.
 *
 * I due casi non sono uno perché **non dicono la stessa cosa all'utente**. Un
 * file che non arriva — rete assente, server che non risponde, file che non
 * c'è — è il caso normale di un'app usata al negozio: l'app resta corretta coi
 * dati che ha, e non c'è niente da dire. Un file che arriva e non si legge è un
 * aggiornamento rotto, e quello si dice.
 *
 * `dati` è `undefined` quando la risposta è arrivata ma JSON non è: il server
 * che risponde con la pagina dell'app al posto del file è un file rotto, non un
 * file assente.
 */
export type Arrivo = { arrivato: false } | { arrivato: true; dati: unknown };

/**
 * Chiede un file al server, scavalcando le cache.
 *
 * `no-cache` e non `no-store`: si vuole che il server dica se il file è
 * cambiato, non che riscenda intero a ogni apertura. È anche il segnale con cui
 * il service worker riconosce questa richiesta e la lascia passare invece di
 * rispondere dalla sua cache: chiedere a sé stessi se si è aggiornati non
 * direbbe mai di no.
 */
export async function scaricaFresco(percorso: string): Promise<Arrivo> {
  let risposta: Response;
  try {
    risposta = await fetch(percorso, { cache: "no-cache" });
  } catch {
    return { arrivato: false };
  }
  if (!risposta.ok) return { arrivato: false };
  try {
    return { arrivato: true, dati: await risposta.json() };
  } catch {
    return { arrivato: true, dati: undefined };
  }
}
