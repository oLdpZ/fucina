/**
 * **La strategia dichiarata** (ADR-0001, ticket 04 della tappa 3).
 *
 * La strategia è quel che l'utente **dichiara**; l'archetipo è quel che l'app
 * **misura** (`archetipo.ts`). Sono la stessa parola vista dalle due parti, e
 * la distanza fra le due è precisamente il lavoro che l'app fa: qui dentro non
 * si misura niente — si dice soltanto che cosa è stato chiesto, e quando una
 * misura lo soddisfa.
 *
 * ## Un vincolo, mai un peso
 *
 * L'app costruisce **solo** mazzi che la strategia soddisfano. Un peso accanto
 * alle componenti del punteggio avrebbe fatto contrattare la strategia contro
 * la potenza senza dirlo, cioè avrebbe messo un secondo tasso di cambio
 * invisibile accanto all'unico che la frontiera esiste per mostrare
 * ([ADR-0001](../../docs/adr/0001-strategia-dichiarata-verificata-per-comportamento.md)).
 * È la stessa scelta della combo dichiarata, e per la stessa ragione.
 *
 * ## La combo non è qui
 *
 * Le strategie del vocabolario classico sono quattro, e la quarta — la combo —
 * non è una casella di questo tipo: **si dichiara nominando le carte**
 * (`combo/combo.ts`, ticket 05), perché dedurre che due carte vincano insieme
 * vorrebbe dire leggere cosa fanno. Qui stanno le tre che si **misurano**, e
 * sono le stesse tre di `Archetipo`: una strategia che l'app non sappia
 * verificare non sarebbe un vincolo, sarebbe una promessa.
 *
 * ## La distanza, che non è un secondo punteggio
 *
 * `distanzaDallaStrategia` serve a una cosa sola e dentro un posto solo: la
 * ricerca parte da un mazzo che la strategia può non soddisfare, e senza una
 * pendenza verso la casella chiesta non saprebbe da che parte muoversi — come
 * la penalità di spesa, che non è il tetto ma la discesa che ci riporta dentro
 * (`ricerca/costruisci.ts`). Non entra **mai** nel punteggio e non si mostra
 * all'utente: fra due mazzi che la strategia soddisfano non dice niente, perché
 * là il vincolo è già soddisfatto e a ordinare torna la sola potenza.
 */

import { archetipoDi, type Archetipo, type ComportamentoMisurato } from "./archetipo.js";
import {
  QUOTA_CHE_CHIUDE,
  QUOTA_DI_CORSE_RETTE,
  QUOTA_MINIMA_DEL_CONTROLLO,
  TURNO_MASSIMO_AGGRO,
  TURNO_MASSIMO_MIDRANGE,
} from "./taratura.js";
import { TURNO_MASSIMO } from "../mazzo/taratura.js";

/**
 * Le strategie che si dichiarano e che l'app sa verificare. Sono le tre che si
 * misurano; la quarta del vocabolario classico — la combo — si dichiara
 * nominando le carte, e non sta qui.
 */
export type Strategia = Archetipo;

/** Le tre, nell'ordine in cui una schermata le mette in fila: dal più veloce. */
export const STRATEGIE: readonly Strategia[] = ["aggro", "midrange", "controllo"];

/** Come si chiama ogni strategia quando una frase la nomina. */
export const NOME_DELLA_STRATEGIA: Record<Strategia, string> = {
  aggro: "aggro",
  midrange: "midrange",
  controllo: "controllo",
};

/** Se quel che si è letto da fuori è una delle tre. */
export function eUnaStrategia(valore: unknown): valore is Strategia {
  return typeof valore === "string" && (STRATEGIE as readonly string[]).includes(valore);
}

/**
 * Se un mazzo misurato soddisfa la strategia dichiarata.
 *
 * La domanda si fa con `archetipoDi` e con nient'altro: è **la stessa misura**
 * che l'app mostra all'utente, e un secondo giudizio scritto qui sarebbe un
 * secondo modo di dire che cosa è un aggro — cioè la cosa che ADR-0001 vieta.
 */
export function soddisfaLaStrategia(
  strategia: Strategia,
  comportamento: ComportamentoMisurato,
): boolean {
  return archetipoDi(comportamento).archetipo === strategia;
}

/**
 * Quanto manca a un mazzo per cadere nella casella chiesta: zero quando non
 * manca niente, e un numero positivo che scende avvicinandosi.
 *
 * Non è una misura di qualità e non è un punteggio: è una **pendenza**, e la
 * usa solo la ricerca per non restare ferma su un mazzo che la strategia non
 * soddisfa. I pezzi sono quelli delle soglie di `taratura.ts`, ognuno preso
 * come scarto in eccesso o in difetto:
 *
 * - i **turni** si dividono per `TURNO_MASSIMO`, che è la scala su cui un turno
 *   di chiusura vive: così un turno di troppo e una quota di partite chiuse
 *   sbagliata di un decimo pesano l'uno accanto all'altro;
 * - un mazzo che **non chiude mai** paga un turno intero di scala, cioè più di
 *   qualunque mazzo che chiuda: è il più lontano che si possa stare.
 *
 * Il caso del controllo è l'unico con tre pezzi, ed è la conseguenza di com'è
 * definito: chiude tardi, chiude abbastanza spesso, e regge le corse **grazie
 * al ritardo che infligge**. Senza corse dichiarate quella casella non si
 * misura affatto, e la distanza lo dice restando alta — a parlarne prima di
 * cercare c'è la guardia (`guardia.ts`).
 */
export function distanzaDallaStrategia(
  strategia: Strategia,
  comportamento: ComportamentoMisurato,
): number {
  const { grezzi } = archetipoDi(comportamento);
  const turno = grezzi.turnoMedioDiChiusura;
  /** Un mazzo che non chiude non ha un turno: paga la scala intera. */
  const scartoDiTurno = (quanto: number): number => Math.max(0, quanto) / TURNO_MASSIMO;
  const senzaTurno = turno === null ? 1 : 0;

  if (strategia === "aggro") {
    return (
      senzaTurno +
      (turno === null ? 0 : scartoDiTurno(turno - TURNO_MASSIMO_AGGRO)) +
      Math.max(0, QUOTA_CHE_CHIUDE - grezzi.quotaPartiteChiuse)
    );
  }

  if (strategia === "midrange") {
    return (
      senzaTurno +
      (turno === null
        ? 0
        : // Le due parti della finestra: troppo tardi non è midrange, e troppo
          // presto è un aggro — che è un'altra casella, non un midrange
          // riuscito meglio.
          scartoDiTurno(turno - TURNO_MASSIMO_MIDRANGE) +
          scartoDiTurno(TURNO_MASSIMO_AGGRO - turno)) +
      Math.max(0, QUOTA_CHE_CHIUDE - grezzi.quotaPartiteChiuse)
    );
  }

  const corseRette =
    grezzi.corse === 0 ? 0 : grezzi.corseRetteGrazieAlRitardo / grezzi.corse;
  return (
    senzaTurno +
    (turno === null ? 0 : scartoDiTurno(TURNO_MASSIMO_MIDRANGE - turno)) +
    Math.max(0, QUOTA_MINIMA_DEL_CONTROLLO - grezzi.quotaPartiteChiuse) +
    Math.max(0, QUOTA_DI_CORSE_RETTE - corseRette)
  );
}
