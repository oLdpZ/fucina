import { describe, expect, it } from "vitest";

import { codaDelConteggio } from "./conteggio.js";

/**
 * Ticket 07: il conteggio delle carte rimaste non nomina più lo Standard.
 *
 * Non lo nomina perché non nomina **nessun** formato di suo: dice quello che il
 * documento di formato dichiara, e il nome glielo passa chi lo ha letto. È la
 * forma che ADR-0004 chiede — nessuna verità di formato nel sorgente — vista da
 * un pezzo di interfaccia.
 */
describe("la coda del conteggio delle carte", () => {
  it("senza filtri dice di quale gioco si sta parlando", () => {
    expect(codaDelConteggio(0, "Old School italiano")).toBe("in Old School italiano");
  });

  it("il nome del gioco arriva da fuori, e non è scritto qui", () => {
    // Due nomi diversi, la stessa funzione: il giorno che il gruppo decide come
    // chiamare il proprio formato non si tocca una riga di codice.
    expect(codaDelConteggio(0, "Old School italiano")).toContain("Old School italiano");
    expect(codaDelConteggio(0, "Il venerdì da Marco")).toContain("Il venerdì da Marco");
  });

  it("con dei filtri dice che il numero è quello dei filtri, e non nomina il gioco", () => {
    expect(codaDelConteggio(1, "Old School italiano")).toBe("con questi filtri");
    expect(codaDelConteggio(4, "Old School italiano")).toBe("con questi filtri");
  });

  it("senza un nome del formato tace, invece di dire una riga monca", () => {
    // Un documento di formato senza nome oggi non si apre nemmeno. Se un giorno
    // si aprisse, «carte in» a metà frase sarebbe peggio di «carte».
    expect(codaDelConteggio(0, "")).toBe("");
    expect(codaDelConteggio(0, "   ")).toBe("");
  });
});
