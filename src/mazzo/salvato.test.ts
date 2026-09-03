import { describe, expect, it } from "vitest";

import {
  interpretaMazzoSalvato,
  nomePulito,
  nuovoId,
  type MazzoSalvato,
} from "./salvato.js";

/**
 * Ticket 07: un mazzo salvato porta con sé **la richiesta che lo ha generato**,
 * non solo la lista. E quel che si rilegge dal deposito va ri-controllato: fra
 * una sessione e l'altra il browser può aver troncato i dati per recuperare
 * spazio, e un mazzo a metà svuoterebbe la schermata in silenzio.
 */

const SALVATO: MazzoSalvato = {
  id: "abc",
  nome: "Il mazzo dell'amico",
  salvatoIl: "2026-09-03T10:00:00.000Z",
  datiDel: "2026-09-02T09:05:48.145+00:00",
  richiesta: { origine: "a-mano", terreVolute: 22 },
  carte: [
    { nome: "Prima Carta", copie: 4 },
    { nome: "Seconda Carta", copie: 2 },
  ],
};

describe("il mazzo salvato", () => {
  it("si rilegge intero, con la richiesta che l'ha prodotto", () => {
    const letto = interpretaMazzoSalvato(structuredClone(SALVATO));
    expect(letto).toEqual(SALVATO);
  });

  it("accetta un mazzo le cui terre le decide la curva", () => {
    const letto = interpretaMazzoSalvato({
      ...structuredClone(SALVATO),
      richiesta: { origine: "a-mano", terreVolute: null },
    });
    expect(letto.richiesta.terreVolute).toBeNull();
  });

  it("rifiuta a voce alta quel che non è un mazzo salvato", () => {
    expect(() => interpretaMazzoSalvato(null)).toThrow(/mazzo/i);
    expect(() => interpretaMazzoSalvato({ ...SALVATO, id: "" })).toThrow(/mazzo/i);
    expect(() => interpretaMazzoSalvato({ ...SALVATO, nome: "" })).toThrow(/nome/i);
    expect(() => interpretaMazzoSalvato({ ...SALVATO, carte: [] })).toThrow(/carte/i);
    expect(() => interpretaMazzoSalvato({ ...SALVATO, carte: "quattro" })).toThrow(/carte/i);
  });

  it("rifiuta una carta con un numero di copie che non è un numero di copie", () => {
    for (const copie of [0, -1, 2.5, "quattro"]) {
      expect(() =>
        interpretaMazzoSalvato({ ...SALVATO, carte: [{ nome: "Una Carta", copie }] }),
      ).toThrow(/copie/i);
    }
  });

  it("rifiuta una richiesta che non sa dire da dove viene il mazzo", () => {
    expect(() => interpretaMazzoSalvato({ ...SALVATO, richiesta: undefined })).toThrow(
      /richiesta/i,
    );
    expect(() =>
      interpretaMazzoSalvato({ ...SALVATO, richiesta: { origine: "dal-motore" } }),
    ).toThrow(/richiesta/i);
    for (const terreVolute of ["ventidue", 0, -3, 22.5]) {
      expect(() =>
        interpretaMazzoSalvato({ ...SALVATO, richiesta: { origine: "a-mano", terreVolute } }),
      ).toThrow(/terre/i);
    }
  });
});

describe("il nome che sceglie l'utente", () => {
  it("perde gli spazi di troppo, che non si vedono e confondono l'elenco", () => {
    expect(nomePulito("  Draghi   poveri \n")).toBe("Draghi poveri");
  });

  it("non è mai così lungo da rompere l'elenco", () => {
    expect(nomePulito("a".repeat(500)).length).toBeLessThanOrEqual(60);
  });
});

describe("il nome interno di un mazzo", () => {
  it("è diverso a ogni mazzo, così due mazzi non si sovrascrivono", () => {
    const nomi = new Set(Array.from({ length: 50 }, () => nuovoId()));
    expect(nomi.size).toBe(50);
  });
});
