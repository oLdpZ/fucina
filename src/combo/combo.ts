/**
 * **La combo dichiarata** (ticket 05 della tappa 3).
 *
 * L'utente nomina le carte che secondo lui vincono se stanno insieme. L'app
 * **non capisce la combo: ci crede**. Non giudica se quelle carte vincano
 * davvero — saperlo vorrebbe dire leggere cosa fanno, cioè far rientrare dalla
 * finestra il motore di regole che
 * [ADR-0002](../../docs/adr/0002-avversario-come-orologio-motore-di-regole-rimandato.md)
 * rimanda — e fa invece le due sole cose che sa fare senza inventare:
 *
 * - **le mette nel mazzo al massimo delle copie**, e non le scambia via;
 * - **calcola la probabilità esatta** di averle in mano tutte entro un turno,
 *   con `probabilitaDiAssemblarne`, che è un conto ipergeometrico e non una
 *   simulazione.
 *
 * È un **vincolo duro**, non un peso, per la stessa ragione per cui lo è la
 * strategia ([ADR-0001](../../docs/adr/0001-strategia-dichiarata-verificata-per-comportamento.md)):
 * un peso farebbe contrattare la combo contro la potenza senza dirlo, cioè
 * creerebbe un secondo tasso di cambio invisibile accanto all'unico che la
 * frontiera esiste per mostrare. Al massimo delle copie, invece, la
 * probabilità è **la più alta che un mazzo da sessanta carte permetta**, e
 * quel che costa si legge dove si leggono tutti i costi: la potenza scende, e
 * la frontiera lo mostra.
 *
 * Le carte si dichiarano **per nome**, come il `seme` del tema e per la stessa
 * ragione: i pool si aggiornano da soli (ticket 05 della tappa 1), e una combo
 * che avesse memorizzato gli oggetti del pool di ieri si svuoterebbe da sé.
 */

import type { Carta } from "../dati/pool.js";
import type { CopieDiCarta } from "../mazzo/base-di-terre.js";
import { probabilitaDiAssemblarne } from "../mazzo/probabilita.js";
import { escluso, eTerra, type Tema } from "../tema/tema.js";
import { TURNO_DELLA_COMBO } from "./taratura.js";

/**
 * La combo come l'utente la dichiara: **i nomi delle carte**, mai gli oggetti.
 * L'ordine è quello in cui le ha dette, e si conserva: è la sua combo.
 */
export type Combo = readonly string[];

export const COMBO_VUOTA: Combo = [];

/** Se l'utente ha nominato almeno una carta. Se no, non c'è nessuna combo. */
export function comboDichiarata(combo: Combo): boolean {
  return combo.length > 0;
}

/**
 * Perché un pezzo dichiarato non è finito nel mazzo. Sono i tre modi in cui la
 * combo di ieri può non essere più quella di oggi, e nessuno dei tre si tace.
 */
export type GuaioDellaCombo = {
  nome: string;
  /**
   * - `sparita`: il pool di oggi non ha più quella carta — una rotazione, un
   *   bando. È lo stesso caso del seme sparito, e si dice allo stesso modo.
   * - `esclusa`: il tema la butta fuori, e **le esclusioni vincono sempre**
   *   (`tema.ts`), anche su una carta che l'utente ha nominato lui.
   * - `terra`: la base di terre la sceglie l'app dalla curva (ticket 06 della
   *   tappa 1), e forzarci dentro una terra nominata è un lavoro che l'app non
   *   sa ancora fare. Meglio dirlo che farlo male in silenzio.
   */
  tipo: "sparita" | "esclusa" | "terra";
};

/**
 * La combo con i suoi pezzi già trovati nel pool di oggi, e i guai in chiaro.
 *
 * Risolvere una volta sola serve alle stesse due cose del tema: non ricercare
 * i nomi per ogni mazzo provato — la ricerca ne prova migliaia — e dare una
 * risposta onesta quando un pezzo non c'è più.
 */
export type ComboRisolta = {
  /** Le carte trovate, senza ripetizioni, nell'ordine in cui sono state dette. */
  readonly pezzi: readonly Carta[];
  readonly guai: readonly GuaioDellaCombo[];
};

export const COMBO_RISOLTA_VUOTA: ComboRisolta = { pezzi: [], guai: [] };

/** Se c'è qualcosa da raccontare all'utente su quel che ha dichiarato. */
export function guaiDellaCombo(risolta: ComboRisolta): boolean {
  return risolta.guai.length > 0;
}

/**
 * I nomi dichiarati, cercati nel pool di oggi e passati al vaglio del tema.
 *
 * L'ordine dei guai è quello dei nomi, non quello dei tipi: chi rilegge la
 * schermata ritrova le sue carte nell'ordine in cui le ha scritte.
 */
export function risolviCombo(combo: Combo, carte: readonly Carta[], tema: Tema): ComboRisolta {
  const pezzi: Carta[] = [];
  const guai: GuaioDellaCombo[] = [];
  const gia = new Set<string>();

  for (const nome of combo) {
    // Lo stesso nome detto due volte è un pezzo solo: quattro copie restano
    // quattro copie, e contarlo due volte gonfierebbe il conto delle probabilità.
    if (gia.has(nome)) continue;
    gia.add(nome);

    const carta = carte.find((voce) => voce.nome === nome);
    if (carta === undefined) {
      guai.push({ nome, tipo: "sparita" });
      continue;
    }
    if (eTerra(carta) || carta.terra !== null) {
      guai.push({ nome, tipo: "terra" });
      continue;
    }
    if (escluso(carta, tema)) {
      guai.push({ nome, tipo: "esclusa" });
      continue;
    }
    pezzi.push(carta);
  }

  return { pezzi, guai };
}

/** Quel che si può dire della combo su un mazzo già costruito. */
export type EsitoDellaCombo = {
  /** I pezzi come stanno nel mazzo: il nome e le copie che ci sono finite. */
  readonly pezzi: readonly { readonly nome: string; readonly copie: number }[];
  /** Il turno a cui si guarda: `TURNO_DELLA_COMBO`, che è una taratura. */
  readonly turno: number;
  /**
   * La probabilità esatta di averli in mano tutti entro quel turno, e `null`
   * quando i pezzi rimasti sono zero: di una combo che il pool di oggi non ha
   * più non esiste una probabilità. Uno — che è la risposta giusta alla
   * domanda «li ho tutti?» quando non ce n'è nessuno — letto da chiunque non
   * sappia questa storia diventerebbe «100% di assemblare la combo», cioè
   * esattamente la bugia che questo modulo esiste per non dire.
   */
  readonly probabilita: number | null;
  readonly dimensioneMazzo: number;
  readonly guai: readonly GuaioDellaCombo[];
};

/**
 * La combo misurata su un mazzo costruito: quante copie di ogni pezzo ci sono
 * finite davvero, e che probabilità danno.
 *
 * Le copie si contano **dal mazzo** e non da quante se ne erano volute: la
 * frase deve dire il mazzo che c'è, non quello che si sperava. Un pezzo che nel
 * mazzo non è entrato affatto vale zero copie, e la probabilità crolla a zero
 * da sé — senza nessun caso speciale, perché è la verità.
 *
 * L'unico caso speciale è **nessun pezzo**: lì il conto non si fa affatto, e la
 * probabilità è `null`. Vedi `EsitoDellaCombo.probabilita`.
 */
export function misuraLaCombo(
  risolta: ComboRisolta,
  mazzo: readonly CopieDiCarta[],
  dimensioneMazzo: number,
  turno: number = TURNO_DELLA_COMBO,
): EsitoDellaCombo {
  const pezzi = risolta.pezzi.map((carta) => ({
    nome: carta.nome,
    copie: mazzo.find((voce) => voce.carta.nome === carta.nome)?.copie ?? 0,
  }));

  return {
    pezzi,
    turno,
    probabilita:
      pezzi.length === 0
        ? null
        : probabilitaDiAssemblarne(
            dimensioneMazzo,
            pezzi.map((pezzo) => pezzo.copie),
            turno,
          ),
    dimensioneMazzo,
    guai: risolta.guai,
  };
}
