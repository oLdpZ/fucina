import { describe, expect, it } from "vitest";

import { simboliDiColore } from "./costo.js";

describe("simboliDiColore", () => {
  it("tiene i simboli colorati e butta il mana generico", () => {
    expect(simboliDiColore("{1}{R}")).toEqual([["R"]]);
    expect(simboliDiColore("{3}")).toEqual([]);
    expect(simboliDiColore("")).toEqual([]);
  });

  it("conta due volte lo stesso colore chiesto due volte", () => {
    expect(simboliDiColore("{1}{R}{R}")).toEqual([["R"], ["R"]]);
  });

  it("un simbolo ibrido accetta l'uno o l'altro colore", () => {
    expect(simboliDiColore("{R/G}")).toEqual([["R", "G"]]);
  });

  it("un ibrido con il generico non chiede nessun colore: si paga lo stesso", () => {
    // `{2/W}` si paga con due mana qualsiasi. Pretendere il bianco sarebbe
    // dire all'utente che la carta è più difficile di com'è.
    expect(simboliDiColore("{2/W}")).toEqual([]);
  });

  it("un simbolo Phyrexiano non chiede colore: lo pagano i punti vita", () => {
    expect(simboliDiColore("{U/P}")).toEqual([]);
  });

  it("il mana incolore è una richiesta come le altre", () => {
    // `{C}` vuole una terra che produca mana incolore: una Montagna non basta.
    expect(simboliDiColore("{C}{C}")).toEqual([["C"], ["C"]]);
  });

  it("la X non è un colore", () => {
    expect(simboliDiColore("{X}{U}")).toEqual([["U"]]);
  });
});
