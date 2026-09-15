/**
 * L'aggiornamento dei dati in sottofondo (storie 18 e 19, decisione Q29 com'è
 * dopo il cambio di formato: `PROGETTO.md` §7).
 *
 * **Si è ristretto** (ticket 11). Le carte sono del 1994 e non cambiano: il pool
 * si congela nell'app, arriva col pacchetto e non si riscarica mai. Quel che
 * invecchia davvero sono due cose sole, e sono le sole che l'app va a chiedere:
 *
 * - il **documento di formato**, perché il gruppo limita e bandisce;
 * - il **listino dei prezzi**, perché Cardmarket cambia ogni giorno.
 *
 * È il caso raro in cui il codice si semplifica invece di complicarsi, e rende
 * vero alla lettera il «degrada bene se abbandonata» (Q27): senza rete l'app
 * resta **corretta**, non degradata — ha il suo pool, il suo documento e i
 * prezzi del giorno in cui è stata pubblicata, e li dice con la loro data.
 *
 * Qui c'è la **decisione**: quali dati si aprono, e cosa si fa di quel che
 * arriva dalla rete. Il tubo — il `fetch`, il deposito del dispositivo — entra da
 * fuori, così i casi che contano si provano senza rete e senza browser.
 *
 * ## Quel che arriva rotto
 *
 * Un aggiornamento che arriva rotto o incompleto non peggiora quel che l'app ha
 * già: si tiene il vecchio **e lo si dice**. Un file che non arriva affatto,
 * invece, non si dice: al negozio senza rete è il caso normale, e l'app è
 * corretta coi dati che ha. La differenza la fa `Arrivo`.
 */

import { caricaFormato, interpretaFormato, scaricaFormato } from "./carica-formato.js";
import { caricaPool } from "./carica-pool.js";
import {
  conservaFormato,
  conservaListino,
  dimenticaFormato,
  dimenticaListino,
  dimenticaPoolDiIeri,
  leggiFormatoConservato,
  leggiListinoConservato,
} from "./deposito.js";
import type { Formato } from "./formato.js";
import { interpretaListino, percorsoDelListino, type Listino } from "./listino.js";
import { applicaIlFormato, applicaIlListino } from "./pool-in-vigore.js";
import type { Pool } from "./pool.js";
import { scaricaFresco, type Arrivo } from "./scarica.js";

/** I dati con cui l'app sta lavorando: il pool congelato, e quel che ci si applica sopra. */
export type DatiAperti = {
  /** Il pool **congelato**, come arriva col pacchetto: le bandite ci sono ancora. */
  pool: Pool;
  formato: Formato;
  /** `null` finché i prezzi in uso sono quelli del pool. */
  listino: Listino | null;
};

/** Un aggiornamento arrivato e non preso, con la frase che dice perché. */
export type Rifiuto = { cosa: "documento" | "listino"; motivo: string };

/** Come si giudica un file arrivato dalla rete. */
export type Valutazione<T> =
  | { tipo: "preso"; dato: T }
  | { tipo: "nulla-di-nuovo" }
  | { tipo: "rifiutato"; motivo: string };

/**
 * Se una data è più recente di quella in uso.
 *
 * Le date si confrontano come istanti e non come stringhe: due file possono
 * scrivere lo stesso momento con fusi diversi, e l'ordine alfabetico li
 * metterebbe al contrario. A parità vince chi è già in uso — sostituire dati
 * identici sarebbe lavoro per niente, e un documento corretto senza cambiarne la
 * data non si distingue da quello di prima.
 */
export function piuFresca(candidata: string, inUso: string): boolean {
  const quandoCandidata = Date.parse(candidata);
  if (Number.isNaN(quandoCandidata)) return false;

  const quandoInUso = Date.parse(inUso);
  // Dati in uso senza data leggibile: qualunque data vera è un passo avanti.
  if (Number.isNaN(quandoInUso)) return true;

  return quandoCandidata > quandoInUso;
}

/** La data dei prezzi in uso: quella del listino, o quella del pool se non ce n'è. */
export function dataDeiPrezzi(pool: Pool, listino: Listino | null): string {
  return listino?.generatoIl ?? pool.generatoIl;
}

/**
 * Un documento di formato arrivato dalla rete: si prende, non c'è niente di
 * nuovo, o si rifiuta.
 *
 * Si **legge prima** e si guarda la data **dopo**: un documento rotto è un
 * aggiornamento rotto anche quando porta la data di quello in uso, e va detto.
 *
 * Si rifiuta anche il documento che si legge benissimo ma non si applica al pool
 * — un altro criterio, altre edizioni, una carta scritta storta. Il primo caso è
 * quello di un'app vecchia davanti a un documento nuovo: arriverà col suo pool
 * alla prossima apertura, e fino ad allora la frase dice che serve un'app
 * aggiornata.
 */
export function valutaFormato(grezzo: unknown, inUso: Formato, pool: Pool): Valutazione<Formato> {
  const candidato = formatoApplicabile(grezzo, pool);
  if (candidato instanceof Error) return { tipo: "rifiutato", motivo: candidato.message };
  // Una data che non si legge non si confronta, e prenderlo lo stesso vorrebbe
  // dire che nessun documento potrà mai più sostituirlo.
  if (Number.isNaN(Date.parse(candidato.aggiornatoIl))) {
    return {
      tipo: "rifiutato",
      motivo: `Il documento di formato porta una data che non si legge: «${candidato.aggiornatoIl}».`,
    };
  }
  if (!piuFresca(candidato.aggiornatoIl, inUso.aggiornatoIl)) return { tipo: "nulla-di-nuovo" };
  return { tipo: "preso", dato: candidato };
}

/**
 * Un listino arrivato dalla rete, confrontato coi prezzi in uso — che sono
 * quelli di un listino preso prima, o quelli del pool.
 *
 * Come per il documento, si legge prima e si guarda la data dopo: un listino
 * incompleto va detto anche quando è del giorno di quello in uso.
 */
export function valutaListino(
  grezzo: unknown,
  prezziDel: string,
  pool: Pool,
): Valutazione<Listino> {
  let candidato: Listino;
  try {
    candidato = interpretaListino(grezzo);
    applicaIlListino(pool, candidato);
  } catch (errore: unknown) {
    return { tipo: "rifiutato", motivo: comeErrore(errore).message };
  }
  if (!piuFresca(candidato.generatoIl, prezziDel)) return { tipo: "nulla-di-nuovo" };
  return { tipo: "preso", dato: candidato };
}

/**
 * Fra il documento incluso nell'app e quello conservato sul dispositivo, quale
 * aprire.
 *
 * Il conservato vince solo se è **più fresco** e si applica al pool: un'app
 * aggiornata porta con sé un documento altrettanto nuovo, e allora la copia sul
 * dispositivo non serve più e si dimentica. Si dimentica anche quella che non si
 * applica — un altro criterio, dopo che l'app ha cambiato pool — perché non
 * tornerà mai buona.
 *
 * Se è l'incluso a non leggersi, il conservato che si applica al pool si apre al
 * suo posto: perdere dati che l'app aveva è proprio il caso che il ticket vieta.
 */
export function scegliFormato(
  incluso: Formato | Error,
  conservato: unknown,
  pool: Pool,
): { formato: Formato | Error; dimentica: boolean } {
  const conservatoCera = conservato !== null && conservato !== undefined;
  const letto = conservatoCera ? formatoApplicabile(conservato, pool) : null;
  const buono = letto instanceof Error ? null : letto;

  if (incluso instanceof Error) {
    return buono === null
      ? { formato: incluso, dimentica: conservatoCera }
      : { formato: buono, dimentica: false };
  }
  if (buono !== null && piuFresca(buono.aggiornatoIl, incluso.aggiornatoIl)) {
    return { formato: buono, dimentica: false };
  }
  return { formato: incluso, dimentica: conservatoCera };
}

/**
 * Il listino conservato sul dispositivo, se vale ancora: si legge, si applica al
 * pool, ed è più fresco dei prezzi che il pool porta. Altrimenti si aprono i
 * prezzi del pool e la copia si dimentica — un'app pubblicata dopo porta prezzi
 * altrettanto nuovi.
 */
export function scegliListino(
  conservato: unknown,
  pool: Pool,
): { listino: Listino | null; dimentica: boolean } {
  if (conservato === null || conservato === undefined) return { listino: null, dimentica: false };
  const valutato = valutaListino(conservato, pool.generatoIl, pool);
  return valutato.tipo === "preso"
    ? { listino: valutato.dato, dimentica: false }
    : { listino: null, dimentica: true };
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
 * Tre secondi: il documento e il listino pesano poche decine di kilobyte, e chi
 * ci arriva sopra non sta rispondendo.
 */
export const TETTO_DEPOSITO = 3000;

/** Le letture dell'apertura. Entrano da fuori perché i casi che contano si provino senza browser. */
export type LettureDellApertura = {
  pool: () => Promise<Pool>;
  formato: () => Promise<Formato>;
  formatoConservato: () => Promise<unknown>;
  listinoConservato: () => Promise<unknown>;
  dimenticaFormato: () => Promise<void>;
  dimenticaListino: () => Promise<void>;
  /** Libera il posto del pool che l'app scaricava prima del ticket 11. */
  sgombera: () => Promise<void>;
};

const LETTURE: LettureDellApertura = {
  pool: caricaPool,
  formato: caricaFormato,
  formatoConservato: leggiFormatoConservato,
  listinoConservato: leggiListinoConservato,
  dimenticaFormato,
  dimenticaListino,
  sgombera: dimenticaPoolDiIeri,
};

/**
 * I dati da cui l'app parte all'apertura.
 *
 * Non aspetta mai la rete, e non aspetta il deposito oltre il tetto. Il pool è
 * quello incluso e nessun altro: se non si legge, è il guasto che si dice, e che
 * il manutentore può riparare. Il documento e il listino sono quelli inclusi, o
 * quelli più freschi presi in una sessione passata.
 *
 * Il documento incluso passa dalla stessa porta di quelli arrivati dalla rete:
 * che si applichi al pool lo garantisce la compilazione (ticket 26), e qui lo si
 * chiede lo stesso — la schermata del guasto dice una frase, un'eccezione in
 * mezzo al disegno no.
 *
 * Il posto dove l'app teneva il pool scaricato si sgombera qui, una volta per
 * apertura: erano quattro megabyte, e da questa versione nessuno li rilegge.
 */
export async function datiDaAprire(letture: LettureDellApertura = LETTURE): Promise<DatiAperti> {
  void letture.sgombera().catch(() => {});

  const [pool, incluso, formatoConservato, listinoConservato] = await Promise.all([
    letture.pool(),
    (async () => letture.formato())().catch(comeErrore),
    entroIlTetto(letture.formatoConservato),
    entroIlTetto(letture.listinoConservato),
  ]);

  const inclusoCheSiApplica = incluso instanceof Error ? incluso : formatoApplicabile(incluso, pool);
  const sceltaDelFormato = scegliFormato(inclusoCheSiApplica, formatoConservato, pool);
  if (sceltaDelFormato.dimentica) void letture.dimenticaFormato().catch(() => {});
  if (sceltaDelFormato.formato instanceof Error) throw sceltaDelFormato.formato;

  const sceltaDelListino = scegliListino(listinoConservato, pool);
  if (sceltaDelListino.dimentica) void letture.dimenticaListino().catch(() => {});

  return { pool, formato: sceltaDelFormato.formato, listino: sceltaDelListino.listino };
}

/** Quel che l'aggiornamento in sottofondo ha preso, e quel che ha rifiutato. */
export type Aggiornamento = {
  /** Il documento più fresco preso, o `null` se resta quello in uso. */
  formato: Formato | null;
  /** Il listino più fresco preso, o `null` se restano i prezzi in uso. */
  listino: Listino | null;
  rifiuti: Rifiuto[];
};

/** I tubi del sottofondo: la rete in andata, il deposito in ritorno. */
export type TubiDelSottofondo = {
  scaricaFormato: () => Promise<Arrivo>;
  scaricaListino: () => Promise<Arrivo>;
  conservaFormato: (grezzo: unknown) => Promise<boolean>;
  conservaListino: (grezzo: unknown) => Promise<boolean>;
};

const TUBI: TubiDelSottofondo = {
  scaricaFormato,
  scaricaListino: () => scaricaFresco(percorsoDelListino()),
  conservaFormato,
  conservaListino,
};

/**
 * Il controllo di freschezza vero e proprio, da lanciare dopo aver già mostrato
 * qualcosa: non blocca niente e non ha fretta.
 *
 * Scarica il documento di formato e il listino, **e non le carte**. Quel che è
 * più fresco si prende e si conserva **grezzo**, così come è arrivato: alla
 * prossima apertura si rilegge dalla stessa porta, contro il pool di allora.
 *
 * Se il dispositivo si dichiara scollegato non si tenta nemmeno: una richiesta
 * che non riceverà mai risposta costa batteria e non porta niente — e l'app
 * senza rete è corretta, quindi non c'è niente da dire.
 */
export async function aggiornaInSottofondo(
  inUso: DatiAperti,
  tubi: TubiDelSottofondo = TUBI,
): Promise<Aggiornamento> {
  const nessuno: Aggiornamento = { formato: null, listino: null, rifiuti: [] };
  if (typeof navigator !== "undefined" && navigator.onLine === false) return nessuno;

  const nonArrivato = (): Arrivo => ({ arrivato: false });
  const [arrivoDelFormato, arrivoDelListino] = await Promise.all([
    tubi.scaricaFormato().catch(nonArrivato),
    tubi.scaricaListino().catch(nonArrivato),
  ]);

  const esito: Aggiornamento = { ...nessuno, rifiuti: [] };

  if (arrivoDelFormato.arrivato) {
    const valutato = valutaFormato(arrivoDelFormato.dati, inUso.formato, inUso.pool);
    if (valutato.tipo === "preso") {
      esito.formato = valutato.dato;
      // Si mostra subito e si mette da parte con comodo: lo spazio esaurito non
      // annulla niente, i dati freschi valgono per questa sessione anche se non
      // si riesce a tenerli per la prossima.
      void tubi.conservaFormato(arrivoDelFormato.dati).catch(() => false);
    } else if (valutato.tipo === "rifiutato") {
      esito.rifiuti.push({ cosa: "documento", motivo: valutato.motivo });
    }
  }

  if (arrivoDelListino.arrivato) {
    const valutato = valutaListino(
      arrivoDelListino.dati,
      dataDeiPrezzi(inUso.pool, inUso.listino),
      inUso.pool,
    );
    if (valutato.tipo === "preso") {
      esito.listino = valutato.dato;
      void tubi.conservaListino(arrivoDelListino.dati).catch(() => false);
    } else if (valutato.tipo === "rifiutato") {
      esito.rifiuti.push({ cosa: "listino", motivo: valutato.motivo });
    }
  }

  return esito;
}

/**
 * Il documento letto, se si legge e si applica al pool; altrimenti il perché.
 *
 * È l'unica porta da cui passano tutti e tre i documenti — l'incluso, il
 * conservato e quello arrivato dalla rete — così nessuno dei tre si può
 * prendere per una strada più corta.
 */
function formatoApplicabile(grezzo: unknown, pool: Pool): Formato | Error {
  try {
    const formato = interpretaFormato(grezzo);
    applicaIlFormato(pool, formato);
    return formato;
  } catch (errore: unknown) {
    return comeErrore(errore);
  }
}

function comeErrore(errore: unknown): Error {
  return errore instanceof Error ? errore : new Error(String(errore));
}

/**
 * Aspetta il deposito, ma non all'infinito: scaduto il tetto si va avanti come
 * se non ci fosse niente conservato. Un deposito che si rompe vale un deposito
 * vuoto — non è un guasto dell'app.
 */
function entroIlTetto(leggi: () => Promise<unknown>): Promise<unknown> {
  return Promise.race([
    (async () => leggi())().catch(() => null),
    new Promise<null>((risolvi) => setTimeout(() => risolvi(null), TETTO_DEPOSITO)),
  ]);
}
