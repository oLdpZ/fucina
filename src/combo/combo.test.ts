/**
 * La combo dichiarata: le carte che l'utente **afferma** vincano se stanno
 * insieme (ticket 05 della tappa 3).
 *
 * Si prova quel che il ticket promette: si dichiara per nome come il seme del
 * tema, i pool si aggiornano e gli oggetti no, e quando un pezzo dal pool è
 * sparito l'app lo dice invece di far finta che la combo sia ancora quella.
 */

import { describe, expect, it } from "vitest";

import { POOL_DEL_MOTORE, TERRE_FINTE } from "../catalogo/pool-finto.js";
import type { Carta } from "../dati/pool.js";
import { FILTRO_TEMA_VUOTO, TEMA_VUOTO, type Tema } from "../tema/tema.js";
import { comboDichiarata, guaiDellaCombo, risolviCombo } from "./combo.js";

const POOL: readonly Carta[] = [...POOL_DEL_MOTORE, ...TERRE_FINTE];

const NIENTE_SPAZZA_VIA: Tema = {
  ...TEMA_VUOTO,
  esclusioni: { ...FILTRO_TEMA_VUOTO, tag: ["spazza-via"] },
};

/** Una carta del pool finto che porta il tag escluso qui sopra. */
const SPAZZA_VIA = "Wildfire Sweep";

describe("comboDichiarata", () => {
  it("nessun nome non è una combo", () => {
    expect(comboDichiarata([])).toBe(false);
    expect(comboDichiarata(["Emberhorde Captain"])).toBe(true);
  });
});

describe("risolviCombo", () => {
  it("trova nel pool di oggi le carte nominate, nell'ordine in cui sono state dette", () => {
    const risolta = risolviCombo(["Torchbearer Goblin", "Emberhorde Captain"], POOL, TEMA_VUOTO);

    expect(risolta.pezzi.map((carta) => carta.nome)).toEqual([
      "Torchbearer Goblin",
      "Emberhorde Captain",
    ]);
    expect(risolta.guai).toEqual([]);
  });

  it("lo stesso nome detto due volte è un pezzo solo", () => {
    const risolta = risolviCombo(["Emberhorde Captain", "Emberhorde Captain"], POOL, TEMA_VUOTO);

    expect(risolta.pezzi).toHaveLength(1);
  });

  it("un pezzo sparito dal pool si dice, e gli altri restano", () => {
    const risolta = risolviCombo(["Emberhorde Captain", "Splendore Rotato"], POOL, TEMA_VUOTO);

    expect(risolta.pezzi.map((carta) => carta.nome)).toEqual(["Emberhorde Captain"]);
    expect(risolta.guai).toEqual([{ nome: "Splendore Rotato", tipo: "sparita" }]);
  });

  it("un pezzo che il tema esclude non entra di nascosto: si dice", () => {
    const risolta = risolviCombo(["Emberhorde Captain", SPAZZA_VIA], POOL, NIENTE_SPAZZA_VIA);

    expect(risolta.pezzi.map((carta) => carta.nome)).toEqual(["Emberhorde Captain"]);
    expect(risolta.guai).toEqual([{ nome: SPAZZA_VIA, tipo: "esclusa" }]);
  });

  it("una terra nominata resta fuori, e l'app lo dice invece di tacere", () => {
    const risolta = risolviCombo(["Emberhorde Captain", "Cinder Crossing"], POOL, TEMA_VUOTO);

    expect(risolta.pezzi.map((carta) => carta.nome)).toEqual(["Emberhorde Captain"]);
    expect(risolta.guai).toEqual([{ nome: "Cinder Crossing", tipo: "terra" }]);
  });

  it("una combo non dichiarata non ha né pezzi né guai", () => {
    expect(risolviCombo([], POOL, TEMA_VUOTO)).toEqual({ pezzi: [], guai: [] });
  });
});

describe("guaiDellaCombo", () => {
  it("dice se c'è qualcosa da raccontare all'utente", () => {
    expect(guaiDellaCombo(risolviCombo(["Emberhorde Captain"], POOL, TEMA_VUOTO))).toBe(false);
    expect(guaiDellaCombo(risolviCombo(["Splendore Rotato"], POOL, TEMA_VUOTO))).toBe(true);
  });
});
