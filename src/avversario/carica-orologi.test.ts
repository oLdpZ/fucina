/**
 * La cucitura che decide che cosa si è letto nel file di partenza, provata
 * dove decide: i dati del file entrano, l'elenco e quel che è caduto escono.
 *
 * La rete non serve. Quel che il ticket 57 chiede — che una voce storta non
 * porti via le altre, e che quel che cade non se ne vada in silenzio — è una
 * domanda su questa funzione.
 */

import { describe, expect, it } from "vitest";

import { letturaDelFileDiPartenza } from "./carica-orologi.js";

const BUONO = {
  nome: "Il mazzo di Marco",
  perche: "Lo incontro ogni venerdì da tre mesi",
  turnoDiChiusura: 4,
  rimozioni: 2,
  contromagie: 0,
};

/** Un orologio buono, con un nome suo. */
function unAltro(nome: string) {
  return { ...BUONO, nome };
}

describe("il file di partenza degli orologi", () => {
  it("consegna le voci che si leggono", () => {
    const lettura = letturaDelFileDiPartenza([BUONO, unAltro("Mono rosso")]);
    expect(lettura.come).toBe("letti");
    expect(lettura.come === "letti" && lettura.orologi).toHaveLength(2);
    expect(lettura.come === "letti" && lettura.scarti.size).toBe(0);
  });

  /**
   * Il ticket 57. Il file di cortesia esiste per una cosa sola — che la prima
   * schermata non sia vuota (ADR-0002) —, e la lettura severa gliela faceva
   * mancare proprio quando serviva: una riga storta e il pannello restava
   * vuoto, cioè il guasto peggiore che quel file possa produrre.
   */
  it("una voce storta non porta via le altre", () => {
    const lettura = letturaDelFileDiPartenza([
      BUONO,
      { nome: "Storto", turnoDiChiusura: "5" },
      unAltro("Mono rosso"),
    ]);
    expect(lettura.come).toBe("letti");
    expect(lettura.come === "letti" && lettura.orologi.map((o) => o.nome)).toEqual([
      "Il mazzo di Marco",
      "Mono rosso",
    ]);
  });

  it("dice quali righe sono cadute, e perché", () => {
    const lettura = letturaDelFileDiPartenza([BUONO, { nome: "Storto", turnoDiChiusura: "5" }]);
    if (lettura.come !== "letti") throw new Error("doveva leggersi");
    // Il file è del manutentore, e la ragione è per lui: quale riga guardare.
    expect(lettura.scarti.get(1)).toContain("turno di chiusura");
  });

  it("un file che elenco non è non si è letto affatto", () => {
    // Non è «un file vuoto»: di un file che non è un elenco non si sa dire
    // niente, e la prima schermata resta senza il suo file di cortesia.
    expect(letturaDelFileDiPartenza({ mazzi: [] }).come).toBe("non-si-e-letto");
    expect(letturaDelFileDiPartenza(null).come).toBe("non-si-e-letto");
  });

  it("un elenco vuoto si è letto, e non è un guasto", () => {
    const lettura = letturaDelFileDiPartenza([]);
    expect(lettura.come).toBe("letti");
    expect(lettura.come === "letti" && lettura.orologi).toEqual([]);
  });
});
