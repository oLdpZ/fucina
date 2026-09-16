/**
 * **L'archetipo, misurato dal comportamento** (ADR-0001, ticket 03 della
 * tappa 3).
 *
 * La strategia la dichiara l'utente; l'archetipo lo misura l'app, e la
 * distanza fra i due è il lavoro che l'app fa. Qui si misura soltanto.
 *
 * ## Mai la composizione
 *
 * `archetipoDi` non riceve carte. Riceve **come il mazzo si è comportato**: la
 * simulazione e le corse contro gli orologi. Non è una disattenzione da
 * correggere passando il mazzo: è il modo in cui il codice rende impossibile la
 * regola che ADR-0001 vieta — «un aggro ha almeno N creature» — perché qui
 * dentro non c'è niente da contare.
 *
 * ## Le tre caselle, e la quarta
 *
 * - **aggro**: chiude quasi sempre, e presto;
 * - **midrange**: chiude quasi sempre, più tardi;
 * - **controllo**: chiude tardi, ma **regge la corsa grazie a quel che fa
 *   all'avversario** — contro abbastanza orologi arriverebbe dopo di lui, e il
 *   ritardo che gli infligge lo tiene più lontano del proprio arrivo. Chiudere
 *   tardi da solo non basta: lo fa anche un mazzo lento che non fa niente, ed è
 *   per distinguerli che la corsa guarda dalle due parti (`avversario/corsa.ts`).
 * - **nessuno dei tre**: tutto il resto. Un mazzo che non ricade in nessuna
 *   casella non si mette nella più vicina: meglio tacere che sbagliare. Senza
 *   orologi il controllo non si misura, e un mazzo lento è nessuno dei tre.
 *
 * Le caselle sono disgiunte per costruzione: aggro e midrange chiedono un turno
 * medio entro `TURNO_MASSIMO_MIDRANGE`, il controllo uno oltre. Un mazzo che ci
 * sta dentro ma chiude di rado è nessuno dei tre, qualunque corsa regga.
 *
 * La **combo** qui non c'è: non si misura, si dichiara (`combo/`).
 *
 * Le soglie stanno in `taratura.ts`, tutte provvisorie.
 */

import type { EsitoDellaCorsa } from "../avversario/corsa.js";
import type { EsitoDellaSimulazione } from "../mazzo/simulazione.js";
import type { Componente, GrezziDiCorsa } from "../punteggio/punteggio.js";
import {
  QUOTA_CHE_CHIUDE,
  QUOTA_DI_CORSE_RETTE,
  QUOTA_MINIMA_DEL_CONTROLLO,
  TURNO_MASSIMO_AGGRO,
  TURNO_MASSIMO_MIDRANGE,
} from "./taratura.js";

/** I tre archetipi che si misurano. La combo si dichiara, e non sta qui. */
export type Archetipo = "aggro" | "midrange" | "controllo";

/**
 * Quel che `archetipoDi` guarda di un mazzo valutato: come ha giocato, e come
 * ha corso. Un `MazzoValutato` lo è già.
 */
export type ComportamentoMisurato = {
  simulazione: EsitoDellaSimulazione;
  punteggio: { corsa: Componente<GrezziDiCorsa> | null };
};

/** I numeri che giustificano la casella, come ogni componente del punteggio. */
export type GrezziDellArchetipo = {
  /** Sulle sole partite chiuse; `null` se il mazzo non chiude mai. */
  turnoMedioDiChiusura: number | null;
  quotaPartiteChiuse: number;
  /** Contro quanti orologi si è corso. Zero senza orologi. */
  corse: number;
  /**
   * Quante di quelle corse il mazzo regge **solo** grazie al ritardo che
   * infligge: senza, arriverebbe dopo di lui; con, no.
   */
  corseRetteGrazieAlRitardo: number;
};

export type ArchetipoMisurato = {
  archetipo: Archetipo | "nessuno-dei-tre";
  grezzi: GrezziDellArchetipo;
};

export function archetipoDi({ simulazione, punteggio }: ComportamentoMisurato): ArchetipoMisurato {
  const esiti = punteggio.corsa?.grezzi.esiti ?? [];
  const grezzi: GrezziDellArchetipo = {
    turnoMedioDiChiusura: simulazione.turnoMedioDiChiusura,
    quotaPartiteChiuse: simulazione.quotaPartiteChiuse,
    corse: esiti.length,
    corseRetteGrazieAlRitardo: esiti.filter(rettaGrazieAlRitardo).length,
  };
  return { archetipo: casella(grezzi), grezzi };
}

function casella(grezzi: GrezziDellArchetipo): ArchetipoMisurato["archetipo"] {
  const turno = grezzi.turnoMedioDiChiusura;
  if (turno === null) return "nessuno-dei-tre";

  if (grezzi.quotaPartiteChiuse >= QUOTA_CHE_CHIUDE) {
    if (turno <= TURNO_MASSIMO_AGGRO) return "aggro";
    if (turno <= TURNO_MASSIMO_MIDRANGE) return "midrange";
  }

  // Il controllo chiude **tardi**. Un mazzo che chiude presto ma non abbastanza
  // spesso per dirsi aggro è un aggro incostante, non un controllo: con qualche
  // rimozione contro un orologio velocissimo reggerebbe la corsa «grazie al
  // ritardo», e la casella mentirebbe (trovato dalla revisione).
  if (turno <= TURNO_MASSIMO_MIDRANGE) return "nessuno-dei-tre";

  // Da qui il mazzo chiude tardi, e il turno non dice più che cosa sia. Lo dice
  // la corsa, se c'è.
  if (grezzi.corse === 0) return "nessuno-dei-tre";
  if (grezzi.quotaPartiteChiuse < QUOTA_MINIMA_DEL_CONTROLLO) return "nessuno-dei-tre";
  return grezzi.corseRetteGrazieAlRitardo / grezzi.corse >= QUOTA_DI_CORSE_RETTE
    ? "controllo"
    : "nessuno-dei-tre";
}

/**
 * Una corsa che il mazzo regge, e che senza il ritardo inflitto perderebbe.
 *
 * Tutt'e due le metà servono. Una corsa retta anche senza ritardo è contro un
 * avversario più lento, e contarla farebbe controllo chiunque abbia avversari
 * comodi; una corsa persa nonostante il ritardo non è retta.
 */
function rettaGrazieAlRitardo(esito: EsitoDellaCorsa): boolean {
  const mio = esito.turnoMioRitardato;
  if (mio === null) return false;
  return mio <= esito.turnoSuoRitardato && mio > esito.turnoSuo;
}
