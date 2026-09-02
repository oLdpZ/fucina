import { describe, expect, it } from "vitest";

import { dataInItaliano, interpretaPool } from "./carica-pool.js";

/**
 * Storia 17: l'utente vede la data dei dati che sta guardando. La data viene
 * **dal pool**, mai dall'orologio del telefono — un'app aperta senza rete al
 * negozio deve dire di quando sono i suoi prezzi, non che ore sono.
 *
 * E il pool arriva da un file su disco: se quel file è rotto o vecchio, l'app
 * deve dirlo con parole, non mostrare una lista vuota senza spiegazioni.
 */

const POOL_VALIDO = {
  generatoIl: "2026-09-02T09:05:48.145+00:00",
  carte: [{ nome: "Goblin Chieftain" }],
};

describe("lettura del pool", () => {
  it("accetta un pool con la sua data e le sue carte", () => {
    const pool = interpretaPool(POOL_VALIDO);
    expect(pool.generatoIl).toBe("2026-09-02T09:05:48.145+00:00");
    expect(pool.carte).toHaveLength(1);
  });

  it("rifiuta a voce alta un file che non è un pool", () => {
    expect(() => interpretaPool(null)).toThrow(/pool/i);
    expect(() => interpretaPool({ carte: [] })).toThrow(/data/i);
    expect(() => interpretaPool({ generatoIl: "2026-09-02", carte: "molte" })).toThrow(/carte/i);
  });

  it("rifiuta un pool senza carte: sarebbe un'app muta senza dire perché", () => {
    expect(() => interpretaPool({ generatoIl: "2026-09-02", carte: [] })).toThrow(/vuoto/i);
  });
});

describe("la data dei dati", () => {
  it("si legge in italiano, come si direbbe a voce", () => {
    expect(dataInItaliano("2026-09-02T09:05:48.145+00:00")).toBe("2 settembre 2026");
    expect(dataInItaliano("2026-12-25T23:30:00.000+00:00")).toBe("25 dicembre 2026");
  });

  it("non cambia giorno col fuso di chi guarda", () => {
    // Mezzanotte e mezza a Greenwich resta il 2 settembre anche a New York.
    expect(dataInItaliano("2026-09-02T00:30:00.000+00:00")).toBe("2 settembre 2026");
  });

  it("una data che non si capisce non fa cadere l'app", () => {
    expect(dataInItaliano("chissà")).toBe("data sconosciuta");
  });
});
