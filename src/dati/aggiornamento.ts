/**
 * L'aggiornamento dei dati in sottofondo (storie 18 e 19, decisione Q29).
 *
 * La forma è **ibrida**, ed è quella che regge anche se il progetto viene
 * abbandonato (Q27): i dati stanno dentro l'app e bastano da soli; se c'è rete,
 * l'app guarda in sottofondo se ne esistono di più freschi e se li tiene sul
 * dispositivo. Nessun passaggio di questa storia può impedire all'app di
 * aprirsi: la rete che manca, la risposta rotta, lo spazio finito sono casi
 * normali, non guasti.
 *
 * Qui c'è la **decisione** — quale pool si apre, e cosa si fa di quel che
 * arriva dalla rete. Il tubo (il file su disco, il deposito del dispositivo)
 * sta altrove ed entra da fuori, così i casi che contano si provano senza rete.
 */

import { caricaPool, interpretaPool, scaricaPool } from "./carica-pool.js";
import { conservaPool, dimenticaPool, leggiPoolConservato } from "./deposito.js";
import type { Pool } from "./pool.js";

/**
 * Com'è andato il controllo di freschezza. Nessuno dei quattro casi è un guasto.
 *
 * `di-un-altro-documento` non è `nulla-di-nuovo`: di nuovo qualcosa c'è, ma è
 * fatto per un documento di formato che l'app non ha ancora in mano, e arriverà
 * insieme a lui.
 */
export type Esito =
  | { tipo: "preso"; pool: Pool }
  | { tipo: "nulla-di-nuovo" }
  | { tipo: "di-un-altro-documento" }
  | { tipo: "non-riuscito"; motivo: string };

/**
 * Se il candidato porta dati più recenti di quelli in uso.
 *
 * Le date si confrontano come istanti e non come stringhe: due pool possono
 * scrivere lo stesso momento con fusi diversi, e l'ordine alfabetico li
 * metterebbe al contrario. A parità vince chi è già in uso — sostituire dati
 * identici sarebbe lavoro per niente.
 */
export function piuFresco(candidato: Pool, inUso: Pool): boolean {
  const quandoCandidato = Date.parse(candidato.generatoIl);
  if (Number.isNaN(quandoCandidato)) return false;

  const quandoInUso = Date.parse(inUso.generatoIl);
  // Dati in uso senza data leggibile: qualunque data vera è un passo avanti.
  if (Number.isNaN(quandoInUso)) return true;

  return quandoCandidato > quandoInUso;
}

/**
 * Se un pool può stare accanto al documento di formato che l'app ha in mano.
 *
 * Il pool incluso ci sta per costruzione — lo garantisce la compilazione
 * (ticket 26). Quello che arriva dalla rete no: lo si chiede scavalcando il
 * service worker, mentre il documento l'app se lo legge dalla cache del guscio,
 * e fra i due momenti in cui cambiano c'è una finestra (ticket 32). Un pool di
 * un altro documento lì dentro è il catalogo di un gioco con l'impronta
 * dell'ambito di un altro, e un mazzo salvato in quel momento se la porterebbe
 * dietro.
 *
 * Un pool che non dice da dove viene passa: è stato scritto prima che il legame
 * esistesse, e rifiutarlo vorrebbe dire togliere l'aggiornamento in sottofondo a
 * chiunque abbia l'app da prima. «Non lo so» qui non basta a dire di no.
 */
export function puoStareAccanto(pool: Pool, improntaInMano: string): boolean {
  return pool.improntaDelDocumento === "" || pool.improntaDelDocumento === improntaInMano;
}

/**
 * Fra i dati inclusi nell'app e quelli conservati sul dispositivo, quali aprire.
 *
 * `dimentica` è vero quando la copia conservata non serve più: succede quando
 * l'app stessa è stata aggiornata con dati altrettanto freschi o più, e tenerla
 * sarebbe occupare quattro megabyte per niente. Succede anche quando la copia
 * viene da un altro documento di formato: non si apre, e al giro dopo — col
 * guscio nuovo attivo — l'aggiornamento in sottofondo la riprende.
 */
export function scegliPool(
  incluso: Pool | null,
  conservato: Pool | null,
  improntaInMano: string,
): { pool: Pool | null; dimentica: boolean } {
  if (conservato === null) return { pool: incluso, dimentica: false };
  // Prima delle date, e prima del ripiego sui dati inclusi che mancano: un pool
  // di un altro documento non è una copia buona di niente, e aprirlo al posto
  // di un guasto sarebbe mostrare le carte di un gioco sotto il nome di un altro.
  if (!puoStareAccanto(conservato, improntaInMano)) return { pool: incluso, dimentica: true };
  // I dati inclusi possono mancare: file arrivato a metà, cache svuotata a
  // mano. La copia sul dispositivo, che viene dallo stesso documento, è
  // comunque un pool buono, e va aperta — perdere dati che l'app aveva è
  // proprio il caso che il ticket vieta.
  if (incluso === null) return { pool: conservato, dimentica: false };
  if (piuFresco(conservato, incluso)) return { pool: conservato, dimentica: false };
  return { pool: incluso, dimentica: true };
}

/**
 * Chiede alla rete se esistono dati più freschi, e li interpreta.
 *
 * Qualunque cosa vada storta — rete assente, server che risponde con la pagina
 * dell'app al posto del file, pool arrivato vuoto — finisce in `non-riuscito`:
 * i dati in uso non si toccano mai, e l'app va avanti come se niente fosse.
 *
 * Un pool fresco fatto da un altro documento di formato non si prende, e non si
 * conserva: alla prossima apertura il guscio nuovo porta con sé il documento e
 * un pool incluso altrettanto fresco, e quattro megabyte scritti ora nel
 * deposito si dimenticherebbero lì.
 */
export async function cercaAggiornamento(
  inUso: Pool,
  improntaInMano: string,
  scarica: () => Promise<unknown>,
): Promise<Esito> {
  let candidato: Pool;
  try {
    candidato = interpretaPool(await scarica());
  } catch (errore: unknown) {
    return { tipo: "non-riuscito", motivo: errore instanceof Error ? errore.message : String(errore) };
  }

  if (!piuFresco(candidato, inUso)) return { tipo: "nulla-di-nuovo" };
  if (!puoStareAccanto(candidato, improntaInMano)) return { tipo: "di-un-altro-documento" };
  return { tipo: "preso", pool: candidato };
}

/**
 * Quanto si aspetta il deposito del dispositivo prima di aprire l'app coi soli
 * dati inclusi.
 *
 * Serve perché `indexedDB.open()` può restare muto per sempre: non risponde né
 * sì né no, in contesti che certi browser trattano come ristretti. Senza un
 * tetto, l'attesa di una risposta che non arriva diventa una schermata «Carico
 * le carte…» che non finisce mai, con i dati inclusi già pronti a un passo.
 *
 * Tre secondi: leggere quattro megabyte dal deposito ne prende qualche decimo
 * anche su un telefono lento, e chi ci arriva sopra non sta rispondendo.
 */
export const TETTO_DEPOSITO = 3000;

/**
 * Il pool da cui l'app parte all'apertura: quello incluso, o quello più fresco
 * scaricato in una sessione passata.
 *
 * Non aspetta mai la rete, e non aspetta il deposito oltre il tetto. Se il
 * deposito non risponde — modo privato, spazio finito, permessi negati, o
 * silenzio — si aprono i dati inclusi. Se sono i dati inclusi a non leggersi,
 * si apre la copia sul dispositivo, purché venga dal documento di formato in
 * mano. Solo quando non resta niente da aprire si parla di guasto, e si dice
 * quello del file incluso, che è il guasto che il manutentore può riparare.
 *
 * Le due letture entrano da fuori perché i casi che contano — il deposito muto,
 * il file incluso rotto — si possano provare senza un browser.
 *
 * L'impronta in mano può arrivare ancora per strada: il documento si legge da
 * un file anche lui, e aspettarlo prima di cominciare vorrebbe dire far partire
 * i quattro megabyte del pool solo dopo. Le tre letture corrono insieme, e se è
 * il documento a non leggersi il suo guasto è quello che si dice.
 */
export async function poolDaAprire(
  improntaInMano: string | Promise<string>,
  leggiIncluso: () => Promise<Pool> = caricaPool,
  leggiConservato: () => Promise<Pool | null> = leggiPoolConservato,
): Promise<Pool> {
  const [incluso, conservato, impronta] = await Promise.all([
    (async () => leggiIncluso())().catch((errore: unknown) => errore as Error),
    entroIlTetto(leggiConservato),
    improntaInMano,
  ]);

  const scelta = scegliPool(incluso instanceof Error ? null : incluso, conservato, impronta);
  if (scelta.dimentica) void dimenticaPool();
  if (scelta.pool === null) {
    throw incluso instanceof Error ? incluso : new Error("Il pool delle carte non c'è.");
  }
  return scelta.pool;
}

/**
 * Il controllo di freschezza vero e proprio, da lanciare dopo aver già mostrato
 * qualcosa: non blocca niente e non ha fretta.
 *
 * Se il dispositivo si dichiara scollegato non si tenta nemmeno: una richiesta
 * che non riceverà mai risposta costa batteria e non porta niente.
 */
export async function aggiornaInSottofondo(inUso: Pool, improntaInMano: string): Promise<Esito> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { tipo: "non-riuscito", motivo: "Il dispositivo è senza rete." };
  }

  const esito = await cercaAggiornamento(inUso, improntaInMano, scaricaPool);
  // Le carte fresche si mostrano subito e si mettono da parte con comodo:
  // copiare quattro megabyte nel deposito impegna il filo dell'interfaccia, e
  // aspettarlo qui vorrebbe dire un'app ferma proprio mentre si aggiorna. Lo
  // spazio esaurito, poi, non annulla niente: i dati freschi valgono per questa
  // sessione anche se non si riesce a tenerli per la prossima.
  if (esito.tipo === "preso") void conservaPool(esito.pool);
  return esito;
}

/**
 * Aspetta il deposito, ma non all'infinito: scaduto il tetto si va avanti come
 * se non ci fosse niente conservato. Un deposito che si rompe vale un deposito
 * vuoto — non è un guasto dell'app.
 */
function entroIlTetto(leggi: () => Promise<Pool | null>): Promise<Pool | null> {
  return Promise.race([
    (async () => leggi())().catch(() => null),
    new Promise<null>((risolvi) => setTimeout(() => risolvi(null), TETTO_DEPOSITO)),
  ]);
}
