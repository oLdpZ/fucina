/**
 * Il deposito dei dati sul dispositivo: dove finisce il pool scaricato in
 * sottofondo, perché la prossima apertura parta già fresca, e dove stanno i
 * mazzi che l'utente ha salvato (ticket 07).
 *
 * IndexedDB e non `localStorage`: il pool pesa qualche megabyte, cioè più di
 * quanto `localStorage` conceda, e ci si scrive senza fermare l'interfaccia.
 *
 * **Le operazioni si fanno una alla volta, nell'ordine in cui partono.** Ci
 * pensa la fila (`fila.ts`): IndexedDB ordina le transazioni dentro una
 * connessione, e qui le connessioni sono una per operazione, quindi senza fila
 * due tasti premuti in fretta atterrano come capita — e una cancellazione già
 * annunciata all'utente si fa disfare dalla scrittura che l'ha preceduta
 * (ticket 55).
 *
 * **Nessuna di queste funzioni può fallire rumorosamente.** Modo privato,
 * spazio esaurito, permessi negati, database aperto da un'altra scheda: sono
 * tutti casi normali, e in tutti l'app deve restare intera coi dati che ha già
 * (storia 19). Chi chiama riceve `null` o `false`, mai un'eccezione.
 */

import { orologiCheSiLeggono, type Orologio } from "../avversario/orologio.js";
import { interpretaPool } from "./carica-pool.js";
import { creaFila } from "./fila.js";
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

/**
 * La fila davanti al deposito: **una**, e ci passa tutto.
 *
 * Ci passano anche le letture, e non solo le scritture che il ticket 55
 * nomina. Una lettura che scavalca la scrittura partita prima di lei legge il
 * deposito com'era un istante fa e lo riferisce come se fosse adesso — la
 * stessa inversione, con la bugia dalla parte di chi guarda invece che di chi
 * scrive. Costa qualche millisecondo di attesa su operazioni che ne durano
 * pochi, ed è il prezzo per cui l'ordine in cui l'app fa le cose è l'ordine in
 * cui succedono.
 */
const inFila = creaFila();

/**
 * Perché il deposito non si è aperto — e serve a una domanda sola: **se là
 * dentro possa esserci roba dell'utente**.
 *
 * `non-c-e` è un dispositivo dove IndexedDB non si usa affatto: l'oggetto non
 * esiste, o aprirlo solleva (Firefox in navigazione privata). Nessuno ci ha
 * mai scritto niente, perché nessuno ci poteva scrivere, e questo si può
 * affermare. `non-si-vede` è un deposito che c'è e non si è lasciato aprire —
 * un'altra scheda che tiene aperta una versione vecchia, un errore
 * dell'apertura — e là dentro può esserci tutto quel che l'utente ha salvato.
 *
 * La differenza non cambia niente a chi scrive: in tutti e due i casi non ha
 * scritto. Cambia tutto a chi legge, che senza di essa leggerebbe «non si è
 * potuto guardare» come «non c'è niente» (ticket 54).
 */
type PortaChiusa = "non-c-e" | "non-si-vede";

/**
 * Apre il deposito, creando gli scaffali che mancano. Se non si può, **perché**.
 */
function apri(): Promise<IDBDatabase | PortaChiusa> {
  return new Promise((risolvi) => {
    if (typeof indexedDB === "undefined") return risolvi("non-c-e");

    let richiesta: IDBOpenDBRequest;
    try {
      richiesta = indexedDB.open(DEPOSITO, VERSIONE);
    } catch {
      // Firefox in navigazione privata lancia qui, invece di rispondere. Un
      // deposito che rifiuta persino di aprirsi non ha mai conservato niente.
      return risolvi("non-c-e");
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
    // Un'apertura che risponde no è un deposito che esiste e non si fa
    // guardare: quel che ci sta dentro resta una domanda aperta.
    richiesta.onerror = () => risolvi("non-si-vede");
    // Un'altra scheda che tiene aperta una versione vecchia bloccherebbe per
    // sempre: meglio rinunciare e usare i dati inclusi. Là dentro, però, ci
    // sono tutti i dati dell'utente, e nessuno li sta cancellando.
    richiesta.onblocked = () => {
      ceduto = true;
      risolvi("non-si-vede");
    };
  });
}

/**
 * Com'è andata una scrittura, per chi deve dirlo all'utente.
 *
 * I tre casi non sono due perché **non dicono la stessa cosa a chi legge**.
 * `rifiutata` è un deposito che si è aperto e ha detto di no: quel che c'era
 * dentro è ancora lì, e lo si può affermare. `nessun-deposito` è un deposito
 * che non si è aperto affatto — navigazione privata, `indexedDB` che non c'è,
 * un'altra scheda che tiene aperta una versione vecchia — e di quel che sta
 * sul dispositivo non si sa niente: in navigazione privata non c'è niente,
 * dietro un `onblocked` c'è tutto. Chi scrive una nota per l'utente deve poter
 * distinguere il caso che sa raccontare da quello che non sa (ticket 45).
 */
export type EsitoDellaScrittura = "fatta" | "rifiutata" | "nessun-deposito";

/** Una transazione sola, chiusa da sola, con l'esito promesso. */
export function transazione<T>(
  scaffale: string,
  modo: IDBTransactionMode,
  lavoro: (scaffale: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return eseguita(scaffale, modo, lavoro).then(({ esito }) => esito);
}

/**
 * La stessa transazione, che dice anche **com'è andata**.
 *
 * `transazione` risponde col risultato della richiesta, e ci sono scritture che
 * un risultato non ce l'hanno: una `delete` riuscita e una rifiutata
 * arriverebbero entrambe come `null`, cioè una cancellazione non avvenuta
 * annunciata come fatta. Chi deve dire all'utente che il deposito ha rifiutato
 * (ticket 45) ha bisogno di distinguerle — e di distinguere l'una e l'altra da
 * un deposito che non si è aperto.
 */
export interface Eseguita<T> {
  readonly come: EsitoDellaScrittura;
  /**
   * Com'è andata **ad aprire**: `aperta`, o il perché no. Chi scrive non ne ha
   * bisogno — non ha scritto in nessuno dei tre casi —, chi legge sì
   * (ticket 54).
   */
  readonly porta: "aperta" | PortaChiusa;
  readonly esito: T | null;
}

function eseguita<T>(
  scaffale: string,
  modo: IDBTransactionMode,
  lavoro: (scaffale: IDBObjectStore) => IDBRequest<T>,
): Promise<Eseguita<T>> {
  return inFila(() => aperta(scaffale, modo, lavoro));
}

/** Il lavoro vero, una volta che la fila ha dato il turno. */
function aperta<T>(
  scaffale: string,
  modo: IDBTransactionMode,
  lavoro: (scaffale: IDBObjectStore) => IDBRequest<T>,
): Promise<Eseguita<T>> {
  return apri().then(
    (deposito) =>
      new Promise<Eseguita<T>>((risolvi) => {
        // Il deposito si è aperto: da qui in poi ogni rinuncia è un rifiuto suo,
        // e di quel che ci sta dentro si può parlare — c'è, e lo si è visto.
        const rifiuto = { come: "rifiutata", porta: "aperta", esito: null } as const;
        if (typeof deposito === "string") {
          return risolvi({ come: "nessun-deposito", porta: deposito, esito: null });
        }

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
            risolvi({ come: "fatta", porta: "aperta", esito });
          };
          trans.onerror = () => {
            deposito.close();
            risolvi(rifiuto);
          };
          trans.onabort = () => {
            deposito.close();
            risolvi(rifiuto);
          };
        } catch {
          deposito.close();
          risolvi(rifiuto);
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
 * Com'è andata la lettura degli orologi conservati.
 *
 * I tre casi non sono due per la stessa ragione per cui non lo sono quelli
 * della scrittura, dall'altra parte della porta (ticket 54). `mai-salvati` è un
 * deposito che si è aperto e ha risposto: là dentro non c'è niente dell'utente,
 * e lo si può affermare — e lo è anche il dispositivo dove IndexedDB non si usa
 * affatto, perché là dentro non ci è mai potuto entrare niente.
 * `non-si-e-letto` è un deposito che **c'è** e non si è lasciato guardare: si è
 * aperto e ha rifiutato la lettura, oppure non si è aperto pur esistendo —
 * un'altra scheda che ne tiene aperta una versione vecchia. Là dentro ci sono
 * tutti i mazzi dell'utente, e nessuno li ha visti. Chi legge deve poter
 * distinguere il vuoto che sa di essere vuoto da quello che non lo sa.
 */
export type EsitoDellaLettura = "letti" | "mai-salvati" | "non-si-e-letto";

/** Gli orologi conservati, e **com'è andata** a leggerli. */
export type LetturaDegliOrologi =
  | { readonly come: "letti"; readonly orologi: Orologio[] }
  | { readonly come: "mai-salvati" }
  | { readonly come: "non-si-e-letto" };

/**
 * Gli orologi che l'utente ha scritto, e se non ce ne sono **perché**.
 *
 * Un elenco letto e un elenco **vuoto** dicono cose diverse, e tenerli distinti
 * è metà del senso di questa funzione: `mai-salvati` è «non ha ancora deciso»,
 * e allora l'app mostra il file di partenza del manutentore; un `letti` con
 * zero voci è «non voglio correre contro nessuno», ed è una risposta da
 * rispettare. Con un solo valore per i due casi, chi cancella tutti gli
 * orologi se li ritroverebbe alla riapertura.
 *
 * L'altra metà è il terzo caso. Una lettura che non è riuscita non è un
 * deposito vuoto, e dirla come tale mette il file del manutentore al posto dei
 * suoi mazzi — che il primo tasto premuto poi salva sopra gli originali
 * (ticket 54). Chi chiama decide che farne: `aperturaDegliOrologi`.
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
export async function leggiOrologiSalvati(): Promise<LetturaDegliOrologi> {
  return letturaDegliOrologi(
    await eseguita<unknown>(SCAFFALE, "readonly", (scaffale) =>
      scaffale.get(CHIAVE_OROLOGI),
    ),
  );
}

/**
 * Che cosa dice la risposta del deposito, tradotta nei tre casi.
 *
 * Sta fuori da `leggiOrologiSalvati` perché è **la decisione**, e una decisione
 * si prova: IndexedDB qui non serve, e senza questa separazione la sola regola
 * che il ticket 54 scrive resterebbe l'unica cosa non coperta da un test.
 */
export function letturaDegliOrologi({
  come,
  porta,
  esito: letto,
}: Eseguita<unknown>): LetturaDegliOrologi {
  // Un dispositivo dove IndexedDB non si usa affatto non ha mai conservato
  // niente: là dentro non c'è nessun mazzo dell'utente perché non ce n'è mai
  // potuto entrare uno, e dirgli «non si è potuto leggere» gli toglierebbe il
  // file di cortesia per un pericolo che non esiste. È un vuoto che sa di
  // essere vuoto, e vale come «non ha mai deciso».
  if (porta === "non-c-e") return { come: "mai-salvati" };
  // Tutto il resto — il deposito che non si è fatto aprire, quello che ha
  // rifiutato la lettura — è quel che sta sul dispositivo rimasto invisibile.
  if (come !== "fatta") return { come: "non-si-e-letto" };
  if (letto === null || letto === undefined) return { come: "mai-salvati" };
  // Quel che elenco non è vale come «non ha mai deciso»: là non c'è nessuna
  // voce da tenere, e il file del manutentore è meglio di una schermata vuota.
  const orologi = orologiCheSiLeggono(letto);
  return orologi === undefined ? { come: "mai-salvati" } : { come: "letti", orologi };
}

/** Tiene da parte gli orologi dell'utente, e dice com'è andata. */
export async function salvaOrologi(
  orologi: readonly Orologio[],
): Promise<EsitoDellaScrittura> {
  const { come } = await eseguita(SCAFFALE, "readwrite", (scaffale) =>
    // Una copia semplice: IndexedDB non sa scrivere un array di sola lettura
    // così com'è, e vuole oggetti nudi.
    scaffale.put(orologi.map((orologio) => ({ ...orologio })), CHIAVE_OROLOGI),
  );
  return come;
}

/**
 * Torna al file di partenza: dimentica quel che l'utente aveva scritto.
 *
 * `rifiutata` vuol dire che i suoi sono ancora sul dispositivo e alla
 * riapertura torneranno; `nessun-deposito` che non si sa dire.
 */
export async function dimenticaOrologi(): Promise<EsitoDellaScrittura> {
  const { come } = await eseguita(SCAFFALE, "readwrite", (scaffale) =>
    scaffale.delete(CHIAVE_OROLOGI),
  );
  return come;
}
