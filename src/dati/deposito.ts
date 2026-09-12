/**
 * Il deposito dei dati sul dispositivo: dove finisce il pool scaricato in
 * sottofondo, perché la prossima apertura parta già fresca, e dove stanno i
 * mazzi che l'utente ha salvato (ticket 07).
 *
 * IndexedDB e non `localStorage`: il pool pesa qualche megabyte, cioè più di
 * quanto `localStorage` conceda, e ci si scrive senza fermare l'interfaccia.
 *
 * **Nessuna di queste funzioni può fallire rumorosamente.** Modo privato,
 * spazio esaurito, permessi negati, database aperto da un'altra scheda: sono
 * tutti casi normali, e in tutti l'app deve restare intera coi dati che ha già
 * (storia 19). Chi chiama riceve `null` o `false`, mai un'eccezione.
 */

import { orologiCheSiLeggono, type Orologio } from "../avversario/orologio.js";
import { interpretaPool } from "./carica-pool.js";
import type { Pool } from "./pool.js";

const DEPOSITO = "mazzi-fuori-meta";
/** Lo scaffale dei dati: una voce sola, il pool più fresco che si è preso. */
const SCAFFALE = "dati";
/**
 * Lo scaffale dei mazzi salvati, uno per mazzo, con la chiave dentro la voce.
 *
 * È arrivato con la versione 2 del deposito: chi aveva già un pool conservato
 * lo ritrova dov'era, perché una versione nuova aggiunge scaffali e non li
 * riscrive.
 */
export const SCAFFALE_MAZZI = "mazzi";
const VERSIONE = 2;
/** Una voce sola: il pool più fresco che si è riusciti a scaricare. */
const CHIAVE = "pool";
/**
 * Gli orologi dell'avversario scritti dall'utente, tutti in una voce.
 *
 * Stanno nello scaffale dei dati e non in uno loro: sono una manciata di
 * numeri, si leggono e si riscrivono sempre tutti insieme, e uno scaffale in
 * più vorrebbe dire una versione in più del deposito per niente.
 */
const CHIAVE_OROLOGI = "orologi";

/** Apre il deposito, creando gli scaffali che mancano. `null` se non si può. */
function apri(): Promise<IDBDatabase | null> {
  return new Promise((risolvi) => {
    if (typeof indexedDB === "undefined") return risolvi(null);

    let richiesta: IDBOpenDBRequest;
    try {
      richiesta = indexedDB.open(DEPOSITO, VERSIONE);
    } catch {
      // Firefox in navigazione privata lancia qui, invece di rispondere.
      return risolvi(null);
    }

    richiesta.onupgradeneeded = () => {
      const deposito = richiesta.result;
      if (!deposito.objectStoreNames.contains(SCAFFALE)) deposito.createObjectStore(SCAFFALE);
      if (!deposito.objectStoreNames.contains(SCAFFALE_MAZZI)) {
        deposito.createObjectStore(SCAFFALE_MAZZI, { keyPath: "id" });
      }
    };
    // Chi ha già rinunciato non torna indietro, ma il deposito che arriva dopo
    // va chiuso lo stesso: una connessione lasciata aperta e dimenticata
    // bloccherebbe ogni cambio di versione futuro, da qualunque scheda.
    let ceduto = false;

    richiesta.onsuccess = () => {
      if (ceduto) return richiesta.result.close();
      risolvi(richiesta.result);
    };
    richiesta.onerror = () => risolvi(null);
    // Un'altra scheda che tiene aperta una versione vecchia bloccherebbe per
    // sempre: meglio rinunciare e usare i dati inclusi.
    richiesta.onblocked = () => {
      ceduto = true;
      risolvi(null);
    };
  });
}

/** Una transazione sola, chiusa da sola, con l'esito promesso. */
export function transazione<T>(
  scaffale: string,
  modo: IDBTransactionMode,
  lavoro: (scaffale: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return eseguita(scaffale, modo, lavoro).then(({ esito }) => esito);
}

/**
 * La stessa transazione, che dice anche **se si è chiusa**.
 *
 * `transazione` risponde col risultato della richiesta, e ci sono scritture che
 * un risultato non ce l'hanno: una `delete` riuscita e una rifiutata
 * arriverebbero entrambe come `null`, cioè una cancellazione non avvenuta
 * annunciata come fatta. Chi deve dire all'utente che il deposito ha rifiutato
 * (ticket 45) ha bisogno di distinguerle.
 */
function eseguita<T>(
  scaffale: string,
  modo: IDBTransactionMode,
  lavoro: (scaffale: IDBObjectStore) => IDBRequest<T>,
): Promise<{ fatta: boolean; esito: T | null }> {
  return apri().then(
    (deposito) =>
      new Promise<{ fatta: boolean; esito: T | null }>((risolvi) => {
        const rinuncia = { fatta: false, esito: null };
        if (deposito === null) return risolvi(rinuncia);

        let esito: T | null = null;
        try {
          const trans = deposito.transaction(scaffale, modo);
          const richiesta = lavoro(trans.objectStore(scaffale));
          richiesta.onsuccess = () => {
            esito = richiesta.result ?? null;
          };
          // Si aspetta il **completamento** della transazione, non la singola
          // richiesta: è lì che lo spazio esaurito si fa vivo, e una scrittura
          // dichiarata riuscita e poi annullata sarebbe una bugia.
          trans.oncomplete = () => {
            deposito.close();
            risolvi({ fatta: true, esito });
          };
          trans.onerror = () => {
            deposito.close();
            risolvi(rinuncia);
          };
          trans.onabort = () => {
            deposito.close();
            risolvi(rinuncia);
          };
        } catch {
          deposito.close();
          risolvi(rinuncia);
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
  const letto = await transazione<unknown>(SCAFFALE, "readonly", (scaffale) =>
    scaffale.get(CHIAVE),
  );
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
  const esito = await transazione(SCAFFALE, "readwrite", (scaffale) =>
    scaffale.put(pool, CHIAVE),
  );
  return esito !== null;
}

/** Libera lo spazio quando la copia conservata non serve più. */
export async function dimenticaPool(): Promise<void> {
  await transazione(SCAFFALE, "readwrite", (scaffale) => scaffale.delete(CHIAVE));
}

/* --- Gli orologi dell'avversario ----------------------------------------- */

/**
 * Gli orologi che l'utente ha scritto, o `null` se non ne ha mai salvati.
 *
 * `null` e un elenco **vuoto** dicono cose diverse, e tenerli distinti è tutto
 * il senso di questa funzione: `null` è «non ha ancora deciso», e allora l'app
 * mostra il file di partenza del manutentore; l'elenco vuoto è «non voglio
 * correre contro nessuno», ed è una risposta da rispettare. Con un solo valore
 * per i due casi, chi cancella tutti gli orologi se li ritroverebbe alla
 * riapertura.
 *
 * Si ri-controlla quel che si rilegge, come per il pool: un elenco troncato dal
 * browser che recupera spazio metterebbe nel punteggio una corsa contro un
 * avversario mezzo scritto.
 *
 * Ma si ri-controlla **voce per voce**, col lettore indulgente. Questi sono
 * gli unici dati che l'app conserva e che nessuno può ricostruire al posto
 * dell'utente, e prima del ticket 35 una riga storta se li portava via tutti:
 * il lettore severo sollevava, il `catch` chiamava `dimenticaOrologi()`, e chi
 * aveva premuto «Aggiungi un mazzo» senza dare un nome al terzo riapriva l'app
 * trovandoci i mazzi del manutentore. Adesso si perde quella voce e restano le
 * altre — e non si cancella niente: dati che non si sono saputi leggere restano
 * dove sono, perché cancellarli è la decisione più drastica che questo codice
 * possa prendere e non la prende in silenzio.
 */
export async function leggiOrologiSalvati(): Promise<Orologio[] | null> {
  const letto = await transazione<unknown>(SCAFFALE, "readonly", (scaffale) =>
    scaffale.get(CHIAVE_OROLOGI),
  );
  if (letto === null || letto === undefined) return null;
  // Quel che elenco non è vale come «non ha mai deciso»: là non c'è nessuna
  // voce da tenere, e il file del manutentore è meglio di una schermata vuota.
  return orologiCheSiLeggono(letto) ?? null;
}

/** Tiene da parte gli orologi dell'utente. `false` se non si è potuto. */
export async function salvaOrologi(orologi: readonly Orologio[]): Promise<boolean> {
  const { fatta } = await eseguita(SCAFFALE, "readwrite", (scaffale) =>
    // Una copia semplice: IndexedDB non sa scrivere un array di sola lettura
    // così com'è, e vuole oggetti nudi.
    scaffale.put(orologi.map((orologio) => ({ ...orologio })), CHIAVE_OROLOGI),
  );
  return fatta;
}

/**
 * Torna al file di partenza: dimentica quel che l'utente aveva scritto.
 * `false` se non si è potuto, e allora alla riapertura i suoi sono ancora lì.
 */
export async function dimenticaOrologi(): Promise<boolean> {
  const { fatta } = await eseguita(SCAFFALE, "readwrite", (scaffale) =>
    scaffale.delete(CHIAVE_OROLOGI),
  );
  return fatta;
}
