import { describe, expect, it } from "vitest";

import { tettoInVigore } from "./tetto-in-vigore.js";

const copie = (voci: Record<string, number>) => new Map(Object.entries(voci));

const CONSEGNATO = { tetto: 30, copie: copie({ "Serra Angel": 4, "Swords to Plowshares": 3 }) };

describe("tettoInVigore", () => {
  it("il mazzo appena consegnato dal motore porta il suo tetto", () => {
    expect(tettoInVigore(CONSEGNATO, copie({ "Serra Angel": 4, "Swords to Plowshares": 3 }))).toBe(
      30,
    );
  });

  it("l'ordine delle carte non è il mazzo: lo stesso mazzo scritto al contrario tiene il tetto", () => {
    expect(tettoInVigore(CONSEGNATO, copie({ "Swords to Plowshares": 3, "Serra Angel": 4 }))).toBe(
      30,
    );
  });

  it("una copia tolta a mano stacca il tetto", () => {
    expect(
      tettoInVigore(CONSEGNATO, copie({ "Serra Angel": 3, "Swords to Plowshares": 3 })),
    ).toBeNull();
  });

  it("una carta aggiunta a mano stacca il tetto", () => {
    expect(
      tettoInVigore(
        CONSEGNATO,
        copie({ "Serra Angel": 4, "Swords to Plowshares": 3, "Black Lotus": 1 }),
      ),
    ).toBeNull();
  });

  it("una carta tolta del tutto stacca il tetto", () => {
    expect(tettoInVigore(CONSEGNATO, copie({ "Serra Angel": 4 }))).toBeNull();
  });

  it("una carta portata a zero copie è una carta che non c'è, non un mazzo diverso", () => {
    // Chi tiene le copie cancella la voce quando arriva a zero, ma un mazzo che
    // arrivasse qui con uno zero scritto direbbe la stessa cosa: nessuna copia.
    expect(
      tettoInVigore(
        { tetto: 30, copie: copie({ "Serra Angel": 4, "Black Lotus": 0 }) },
        copie({ "Serra Angel": 4 }),
      ),
    ).toBe(30);
  });

  it("la copia tolta e rimessa rende il mazzo quello di prima, tetto compreso", () => {
    // La domanda non è «l'utente ha toccato qualcosa», è «quel che ha in mano è
    // il mazzo che il motore gli ha dato». Se lo è di nuovo, lo è.
    const pentito = copie({ "Serra Angel": 3, "Swords to Plowshares": 3 });
    expect(tettoInVigore(CONSEGNATO, pentito)).toBeNull();
    expect(tettoInVigore(CONSEGNATO, copie({ "Serra Angel": 4, "Swords to Plowshares": 3 }))).toBe(
      30,
    );
  });

  it("un mazzo che nessun motore ha consegnato non ha tetto", () => {
    expect(tettoInVigore(null, copie({ "Serra Angel": 4 }))).toBeNull();
  });

  it("il tetto zero è un tetto, e vale come gli altri", () => {
    // Zero euro è una richiesta legittima — «solo carte senza prezzo» — e
    // leggerlo come «nessun tetto» la tradirebbe in silenzio.
    expect(tettoInVigore({ tetto: 0, copie: copie({ "Serra Angel": 4 }) }, copie({ "Serra Angel": 4 }))).toBe(0);
  });
});
