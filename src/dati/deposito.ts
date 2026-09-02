/**
 * Il deposito dei dati sul dispositivo: dove finisce il pool scaricato in
 * sottofondo, perché la prossima apertura parta già fresca.
 *
 * IndexedDB e non `localStorage`: il pool pesa qualche megabyte, cioè più di
 * quanto `localStorage` conceda, e ci si scrive senza fermare l'interfaccia.
 * È lo stesso deposito che la tappa dei mazzi salvati userà (spec, «Salvataggio»).
 *
 * **Nessuna di queste funzioni può fallire rumorosamente.** Modo privato,
 * spazio esaurito, permessi negati, database aperto da un'altra scheda: sono
 * tutti casi normali, e in tutti l'app deve restare intera coi dati che ha già
 * (storia 19). Chi chiama riceve `null` o `false`, mai un'eccezione.
 */

import { interpretaPool } from "./carica-pool.js";
import type { Pool } from "./pool.js";

const DEPOSITO = "mazzi-fuori-meta";
const SCAFFALE = "dati";
/** Una voce sola: il pool più fresco che si è riusciti a scaricare. */
const CHIAVE = "pool";

/** Apre il deposito, creando lo scaffale la prima volta. `null` se non si può. */
function apri(): Promise<IDBDatabase | null> {
  return new Promise((risolvi) => {
    if (typeof indexedDB === "undefined") return risolvi(null);

    let richiesta: IDBOpenDBRequest;
    try {
      richiesta = indexedDB.open(DEPOSITO, 1);
    } catch {
      // Firefox in navigazione privata lancia qui, invece di rispondere.
      return risolvi(null);
    }

    richiesta.onupgradeneeded = () => {
      const deposito = richiesta.result;
      if (!deposito.objectStoreNames.contains(SCAFFALE)) deposito.createObjectStore(SCAFFALE);
    };
    richiesta.onsuccess = () => risolvi(richiesta.result);
    richiesta.onerror = () => risolvi(null);
    // Un'altra scheda che tiene aperta una versione vecchia bloccherebbe per
    // sempre: meglio rinunciare e usare i dati inclusi.
    richiesta.onblocked = () => risolvi(null);
  });
}

/** Una transazione sola, chiusa da sola, con l'esito promesso. */
function transazione<T>(
  modo: IDBTransactionMode,
  lavoro: (scaffale: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return apri().then(
    (deposito) =>
      new Promise<T | null>((risolvi) => {
        if (deposito === null) return risolvi(null);

        let esito: T | null = null;
        try {
          const trans = deposito.transaction(SCAFFALE, modo);
          const richiesta = lavoro(trans.objectStore(SCAFFALE));
          richiesta.onsuccess = () => {
            esito = richiesta.result ?? null;
          };
          // Si aspetta il **completamento** della transazione, non la singola
          // richiesta: è lì che lo spazio esaurito si fa vivo, e una scrittura
          // dichiarata riuscita e poi annullata sarebbe una bugia.
          trans.oncomplete = () => {
            deposito.close();
            risolvi(esito);
          };
          trans.onerror = () => {
            deposito.close();
            risolvi(null);
          };
          trans.onabort = () => {
            deposito.close();
            risolvi(null);
          };
        } catch {
          deposito.close();
          risolvi(null);
        }
      }),
  );
}

/**
 * Il pool conservato, se c'è ed è ancora un pool.
 *
 * Si ri-controlla quel che si rilegge: fra una sessione e l'altra il deposito
 * può essere stato troncato dal browser che recupera spazio, e un pool a metà
 * svuoterebbe il catalogo in silenzio.
 */
export async function leggiPoolConservato(): Promise<Pool | null> {
  const letto = await transazione<unknown>("readonly", (scaffale) => scaffale.get(CHIAVE));
  if (letto === null || letto === undefined) return null;
  try {
    return interpretaPool(letto);
  } catch {
    void dimenticaPool();
    return null;
  }
}

/** Tiene da parte il pool per la prossima apertura. `false` se non c'è spazio. */
export async function conservaPool(pool: Pool): Promise<boolean> {
  const esito = await transazione("readwrite", (scaffale) => scaffale.put(pool, CHIAVE));
  return esito !== null;
}

/** Libera lo spazio quando la copia conservata non serve più. */
export async function dimenticaPool(): Promise<void> {
  await transazione("readwrite", (scaffale) => scaffale.delete(CHIAVE));
}
