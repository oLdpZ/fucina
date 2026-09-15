import { describe, expect, it } from "vitest";

import { notaDelRifiuto } from "./note-dell-aggiornamento.js";

/**
 * «Si tiene il vecchio e lo si dice» (ticket 11): la frase nomina quel che è
 * arrivato, il perché vero, e la data di quel che resta.
 */

const IN_USO = { documentoDel: "2026-09-07", prezziDel: "2026-09-14T09:17:26.509+00:00" };

describe("la nota di un aggiornamento rifiutato", () => {
  it("per il documento dice il motivo e la data del documento che resta", () => {
    const nota = notaDelRifiuto(
      { cosa: "documento", motivo: "Il documento di formato non si legge." },
      IN_USO,
    );
    expect(nota).toBe(
      "È arrivato un documento di formato che non si può usare. " +
        "Il documento di formato non si legge. Resta quello del 7 settembre 2026.",
    );
  });

  it("per i prezzi dice il motivo e la data dei prezzi che restano", () => {
    const nota = notaDelRifiuto(
      { cosa: "listino", motivo: "Il listino dei prezzi è incompleto: mancano i prezzi di 3 carte." },
      IN_USO,
    );
    expect(nota).toContain("mancano i prezzi di 3 carte.");
    expect(nota).toMatch(/Restano quelli del 14 settembre 2026\.$/);
  });
});
