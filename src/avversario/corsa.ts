/**
 * **La corsa: il mio mazzo contro un orologio.**
 *
 * Una domanda sola, e sul tempo: *chiudo prima io o lui?* La simulazione
 * goldfish il turno in cui chiudo lo produce già; l'orologio porta scritto il
 * turno in cui chiude lui. Il resto è quanto le sue rimozioni e le sue
 * contromagie mi rallentano.
 *
 * ## È una caricatura, e va detto
 *
 * Non c'è nessuna partita qui dentro. Nessuna sua rimozione uccide una mia
 * creatura scelta, nessuno blocca, nessuno tiene in mano la contromagia per il
 * turno giusto: [ADR-0002](../../docs/adr/0002-avversario-come-orologio-motore-di-regole-rimandato.md)
 * spiega perché quella strada è chiusa, e questa è quel che resta. Il numero
 * che ne esce **non è un tasso di vittoria**, e ogni schermata che lo mostra
 * deve dirlo: un numero che sembra un tasso di vittoria senza esserlo sarebbe
 * la bugia peggiore che quest'app possa dire.
 *
 * ## Perché il ritardo è fatto di due pezzi separati
 *
 * Le rimozioni e le contromagie mordono in modo diverso, e tenerle separate non
 * è pignoleria: è la disciplina che ADR-0002 impone. I tre numeri dell'orologio
 * entrano **uno alla volta**, e ognuno resta solo se alla sosta si vede che
 * cambia la classifica dei mazzi. Ognuno ha il suo peso in
 * `punteggio/taratura.ts`: messo a zero, quel numero smette di contare senza
 * che si tocchi una riga di qui, ed è così che alla sosta lo si misura.
 *
 * Le **rimozioni** mordono solo dove ci sono bersagli: contro un mazzo senza
 * creature otto rimozioni sono otto carte morte, e fingere che rallentino
 * qualcosa direbbe il falso su un mazzo che ha scelto apposta di non darne.
 * Le **contromagie** mordono tutti: contro di loro non esiste un mazzo senza
 * bersagli, perché il bersaglio è ogni magia che si lancia.
 */

import type { CopieDiCarta } from "../mazzo/base-di-terre.js";
import type { EsitoDellaSimulazione } from "../mazzo/simulazione.js";
import {
  COPIE_NON_TERRA_DI_RIFERIMENTO,
  TURNI_PERSI_PER_CONTROMAGIE,
  TURNI_PERSI_PER_RIMOZIONI,
} from "../punteggio/taratura.js";
import type { Orologio } from "./orologio.js";

/**
 * Com'è andata contro **un** orologio, coi valori grezzi che lo giustificano.
 *
 * Ci sono tutti e sei i numeri e non solo il voto, perché le spiegazioni li
 * citano: «chiudo al turno 5, lui al 6, ma le sue otto rimozioni mi costano un
 * turno e mezzo» è una frase che si può verificare contando. «Vali 0,42» no.
 */
export type EsitoDellaCorsa = {
  /** Contro chi: il nome che l'utente ha scritto nell'orologio. */
  contro: string;
  /** Il turno in cui chiudo io, dalla simulazione. `null` se non chiudo mai. */
  turnoMio: number | null;
  /** Il turno in cui chiude lui, scritto nell'orologio. */
  turnoSuo: number;
  /** I turni che le sue **rimozioni** mi costano. */
  ritardoDaRimozioni: number;
  /** I turni che le sue **contromagie** mi costano. */
  ritardoDaContromagie: number;
  /** Il mio turno più i due ritardi: quando arrivo davvero. `null` se non arrivo. */
  turnoMioRitardato: number | null;
  /**
   * La quota di partite in cui chiudo entro il tetto di turni. Sta qui perché
   * senza di lei il turno medio mente: chiudere al quarto turno una volta su
   * cinque non è arrivare primi.
   */
  quotaPartiteChiuse: number;
  /** Fra zero e uno: quanto bene questa corsa è andata. */
  voto: number;
};

/**
 * Quanti turni di vantaggio bastano perché la corsa si dica vinta, e quanti di
 * svantaggio perché si dica persa.
 *
 * Non sono una legge di Magic: sono la scala su cui il vantaggio si legge, e
 * come tutto il resto si ritarano alla sosta. Due turni avanti è una corsa che
 * si vince comodi; due indietro è una che si perde.
 */
const VANTAGGIO_CHE_BASTA = 2;

/**
 * La corsa contro un orologio.
 *
 * Pura e senza orologio di sistema, come tutto il motore: stessi argomenti,
 * stesso risultato. Il caso qui non entra affatto — è già entrato nella
 * simulazione, che arriva fatta.
 */
export function corriControUnOrologio(
  simulazione: EsitoDellaSimulazione,
  nonTerre: readonly CopieDiCarta[],
  orologio: Orologio,
): EsitoDellaCorsa {
  const copieNonTerra = nonTerre.reduce((somma, voce) => somma + voce.copie, 0);
  const copieDiCreatura = nonTerre.reduce(
    (somma, voce) => somma + (eCreatura(voce) ? voce.copie : 0),
    0,
  );
  // Quanto il mio mazzo offre da colpire. Zero creature, zero bersagli: le sue
  // rimozioni restano in mano, e questa è la sola cosa onesta da dirne senza
  // far giocare una partita.
  const quotaBersagli = copieNonTerra === 0 ? 0 : copieDiCreatura / copieNonTerra;

  const ritardoDaRimozioni =
    TURNI_PERSI_PER_RIMOZIONI * quotaBersagli * pressione(orologio.rimozioni);
  const ritardoDaContromagie = TURNI_PERSI_PER_CONTROMAGIE * pressione(orologio.contromagie);

  const turnoMio = simulazione.turnoMedioDiChiusura;
  const turnoMioRitardato =
    turnoMio === null ? null : turnoMio + ritardoDaRimozioni + ritardoDaContromagie;

  return {
    contro: orologio.nome,
    turnoMio,
    turnoSuo: orologio.turnoDiChiusura,
    ritardoDaRimozioni,
    ritardoDaContromagie,
    turnoMioRitardato,
    quotaPartiteChiuse: simulazione.quotaPartiteChiuse,
    voto: voto(turnoMioRitardato, orologio.turnoDiChiusura, simulazione.quotaPartiteChiuse),
  };
}

/**
 * Il voto della corsa: quanto arrivo prima, per quante volte arrivo.
 *
 * Il prodotto non è un dettaglio. Un mazzo che chiude al quarto turno una volta
 * su cinque, contro un avversario che chiude al sesto, «arriva prima» in un
 * senso che non serve a nessuno: le altre quattro volte non arriva affatto.
 * Moltiplicare per la quota di partite chiuse è il modo di dirlo senza
 * simulare una partita vera.
 *
 * Un mazzo che non chiude mai prende zero e non `null`: è un esito, non
 * un'assenza di dati, ed è l'esito peggiore.
 */
function voto(mio: number | null, suo: number, quotaChiuse: number): number {
  if (mio === null) return 0;
  const vantaggio = suo - mio;
  const scala = (vantaggio + VANTAGGIO_CHE_BASTA) / (2 * VANTAGGIO_CHE_BASTA);
  return Math.min(1, Math.max(0, scala)) * quotaChiuse;
}

/**
 * Quanto pesano, da zero a uno, le copie che un avversario dedica a una cosa
 * sola. Otto rimozioni su un mazzo tipico sono una pressione seria; una è
 * rumore.
 *
 * Si divide per una misura **di riferimento** e non per le copie vere di quel
 * mazzo, che l'app non conosce: dell'avversario si sanno tre numeri, e da tre
 * numeri non si ricava quanto sia grande la sua metà non-terra.
 */
function pressione(copie: number): number {
  return Math.min(1, copie / COPIE_NON_TERRA_DI_RIFERIMENTO);
}

function eCreatura(voce: CopieDiCarta): boolean {
  return voce.carta.tipi.some((tipo) => tipo.toLowerCase() === "creature");
}
