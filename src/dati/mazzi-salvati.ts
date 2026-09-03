/**
 * I mazzi salvati sul dispositivo (ticket 07).
 *
 * Stanno nello stesso deposito del pool, in uno scaffale loro: nessun account,
 * nessun server, nessuna sincronizzazione (Q19, Q22). Quel che l'utente salva
 * resta sul suo telefono, e per farlo arrivare a un amico si passa da un file
 * di testo, non da noi.
 *
 * Come tutto il deposito, **niente qui fallisce rumorosamente**: chi chiama
 * riceve un elenco vuoto o `null`, e l'app resta intera. Un mazzo che si
 * rilegge rotto — spazio recuperato dal browser, scrittura interrotta — viene
 * lasciato fuori dall'elenco invece di comparire a metà.
 */

import { interpretaMazzoSalvato, nuovoId, type ContenutoMazzo, type MazzoSalvato } from "../mazzo/salvato.js";
import { SCAFFALE_MAZZI, transazione } from "./deposito.js";

/** I mazzi salvati, dal più recente al più vecchio: è l'ordine dell'elenco. */
export async function elencaMazziSalvati(): Promise<MazzoSalvato[]> {
  const letti = await transazione<unknown[]>(SCAFFALE_MAZZI, "readonly", (scaffale) =>
    scaffale.getAll(),
  );
  if (letti === null) return [];

  const mazzi: MazzoSalvato[] = [];
  for (const letto of letti) {
    try {
      mazzi.push(interpretaMazzoSalvato(letto));
    } catch {
      // Un mazzo illeggibile non è una ragione per nascondere gli altri.
    }
  }
  return mazzi.sort((a, b) => b.salvatoIl.localeCompare(a.salvatoIl));
}

/**
 * Salva un mazzo e restituisce com'è rimasto sul dispositivo.
 *
 * Senza `id` è un mazzo nuovo — due mazzi con lo stesso nome sono due mazzi, e
 * il secondo non cancella il primo. Con l'`id` di un mazzo che c'è già, lo
 * riscrive: è il caso di chi riapre un mazzo, lo cambia e lo risalva.
 *
 * `null` quando il deposito non si lascia scrivere: spazio esaurito, modo
 * privato. Chi chiama lo dice all'utente, che almeno non crede di aver salvato.
 */
export async function salvaMazzo(
  contenuto: ContenutoMazzo,
  id: string = nuovoId(),
): Promise<MazzoSalvato | null> {
  const mazzo: MazzoSalvato = { id, ...contenuto };
  // Si scrive l'oggetto com'è: nomi, numeri e liste, cioè esattamente quel che
  // IndexedDB sa serializzare da sé. Nessuna copia di mezzo — una copia in più
  // sarebbe un'altra funzione del browser che può mancare, e mancando direbbe
  // all'utente «manca spazio», che è la diagnosi sbagliata.
  const esito = await transazione(SCAFFALE_MAZZI, "readwrite", (scaffale) =>
    scaffale.put(mazzo),
  );
  return esito === null ? null : mazzo;
}

/** Cancella un mazzo salvato. Se non c'era, non è successo niente. */
export async function dimenticaMazzo(id: string): Promise<void> {
  await transazione(SCAFFALE_MAZZI, "readwrite", (scaffale) => scaffale.delete(id));
}
