/**
 * La regola con cui si legge una casella numerica.
 *
 * Sta qui e non dentro il componente perché è **la** domanda che l'utente pone
 * col dito sulla tastiera — «ho scritto un numero?» — e perché una casella che
 * si legge storta scrive nel deposito una cosa che l'utente non ha detto
 * (ticket 36). Una funzione sul testo grezzo si prova senza un browser.
 */

import { describe, expect, it } from "vitest";

import { interoScritto } from "./casella-numerica.js";

const ZERO_A_SESSANTA = { minimo: 0, massimo: 60 };

describe("la lettura di una casella numerica", () => {
  it("legge un intero scritto", () => {
    expect(interoScritto("12", ZERO_A_SESSANTA)).toBe(12);
  });

  it("legge lo zero scritto apposta: zero rimozioni è un'affermazione", () => {
    expect(interoScritto("0", ZERO_A_SESSANTA)).toBe(0);
  });

  it("non legge niente da una casella svuotata", () => {
    // `Number("")` è `0`, ed è tutto il difetto del ticket 36: chi cancella il
    // «4» per riscrivere «12» si vedrebbe salvare zero sotto il cursore.
    expect(interoScritto("", ZERO_A_SESSANTA)).toBeUndefined();
    expect(interoScritto("   ", ZERO_A_SESSANTA)).toBeUndefined();
  });

  it("non legge niente da quel che numero intero non è", () => {
    // `Number` accetterebbe tutte e tre: una casella di rimozioni non deve
    // poter dire mille copie perché qualcuno ha scritto «1e3».
    expect(interoScritto("1e3", ZERO_A_SESSANTA)).toBeUndefined();
    expect(interoScritto("0x10", ZERO_A_SESSANTA)).toBeUndefined();
    expect(interoScritto("1.5", ZERO_A_SESSANTA)).toBeUndefined();
    expect(interoScritto("otto", ZERO_A_SESSANTA)).toBeUndefined();
  });

  it("non legge niente fuori dai limiti", () => {
    expect(interoScritto("61", ZERO_A_SESSANTA)).toBeUndefined();
    expect(interoScritto("-1", ZERO_A_SESSANTA)).toBeUndefined();
    expect(interoScritto("0", { minimo: 1, massimo: 20 })).toBeUndefined();
  });
});
