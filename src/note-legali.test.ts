import { describe, expect, it } from "vitest";

import { NOTE_LEGALI, type IdNotaLegale } from "./note-legali.js";

/**
 * `PROGETTO.md` §5 elenca le note che devono essere visibili nell'app. Sono una
 * condizione di legittimità, non un dettaglio: se spariscono, l'app non è più in
 * regola. Il test le tiene inchiodate.
 */
const NOTE_RICHIESTE: readonly IdNotaLegale[] = [
  "politica-contenuti-fan",
  "copyright-wizards",
  "non-approvata-wizards",
  "non-approvata-scryfall",
  "prezzi",
];

describe("note legali", () => {
  it("contiene tutte le note richieste da PROGETTO.md §5", () => {
    const presenti = NOTE_LEGALI.map((nota) => nota.id);
    for (const richiesta of NOTE_RICHIESTE) {
      expect(presenti).toContain(richiesta);
    }
  });

  it("non ha note vuote né identificativi ripetuti", () => {
    const identificativi = new Set<string>();
    for (const nota of NOTE_LEGALI) {
      expect(nota.testo.trim().length).toBeGreaterThan(0);
      expect(identificativi.has(nota.id)).toBe(false);
      identificativi.add(nota.id);
    }
  });

  it("dice a parole che l'app non è prodotta né approvata da Wizards", () => {
    const nota = NOTE_LEGALI.find((n) => n.id === "non-approvata-wizards");
    expect(nota?.testo).toMatch(/non è prodotta né approvata da Wizards of the Coast/i);
  });

  it("dice a parole che Scryfall non produce né approva l'app", () => {
    const nota = NOTE_LEGALI.find((n) => n.id === "non-approvata-scryfall");
    expect(nota?.testo).toMatch(/Scryfall/);
    expect(nota?.testo).toMatch(/non\s+produce/i);
  });

  it("attribuisce a Wizards il copyright sulle carte", () => {
    const nota = NOTE_LEGALI.find((n) => n.id === "copyright-wizards");
    expect(nota?.testo).toMatch(/©/);
    expect(nota?.testo).toMatch(/Wizards of the Coast/);
  });

  it("dice da dove vengono i prezzi, e di quali stampe sono", () => {
    // `PROGETTO.md` §5 chiede i prezzi «a titolo informativo, con data di
    // aggiornamento», e il ticket 09 aggiunge le due cose che il giocatore non
    // può indovinare: la catena Cardmarket-Scryfall, e che il listino è quello
    // delle stampe inglesi.
    const nota = NOTE_LEGALI.find((n) => n.id === "prezzi");

    expect(nota?.testo).toMatch(/Cardmarket/);
    expect(nota?.testo).toMatch(/Scryfall/);
    expect(nota?.testo).toMatch(/data/i);
    expect(nota?.testo).toMatch(/inglesi/i);
  });

  it("rimanda alla politica sui contenuti dei fan", () => {
    const nota = NOTE_LEGALI.find((n) => n.id === "politica-contenuti-fan");
    expect(nota?.collegamento?.url).toMatch(/^https:\/\/company\.wizards\.com\//);
  });
});
