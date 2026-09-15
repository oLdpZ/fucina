/**
 * Il ripensamento, provato dove il ticket 46 lo mette al lavoro: la ricerca
 * fermata perché la domanda è cambiata mentre lavorava lo dice, e dice quale
 * parte della domanda.
 */

import { describe, expect, it } from "vitest";

import { fraseDellaRicercaFermata, ingressiCambiati } from "./ripensamento.js";

const PRIMA = { tema: {}, combo: {}, tettoDiSpesa: null, corsa: "[]" };

describe("gli ingressi cambiati", () => {
  it("sono quelli che non sono più gli stessi, e solo quelli", () => {
    expect(ingressiCambiati(PRIMA, { ...PRIMA, corsa: '[["Mono rosso",5,8,0]]' })).toEqual([
      "orologi",
    ]);
    expect(ingressiCambiati(PRIMA, { ...PRIMA, tema: {}, tettoDiSpesa: 40 })).toEqual([
      "tema",
      "tetto",
    ]);
  });

  it("si confrontano come li confronta l'effetto: per identità, non per contenuto", () => {
    // L'effetto che chiama `dimentica` scatta su un oggetto nuovo anche uguale
    // al vecchio: se la frase lo tacesse, direbbe «è cambiato» su niente.
    expect(ingressiCambiati(PRIMA, { ...PRIMA, combo: {} })).toEqual(["combo"]);
    expect(ingressiCambiati(PRIMA, { ...PRIMA })).toEqual([]);
  });
});

describe("la frase della ricerca fermata", () => {
  it("dice quel che è successo, nominando l'ingresso cambiato", () => {
    expect(fraseDellaRicercaFermata(["orologi"])).toBe(
      "La ricerca si è fermata: i mazzi che incontri sono cambiati mentre lavorava.",
    );
    expect(fraseDellaRicercaFermata(["tema"])).toBe(
      "La ricerca si è fermata: il tema è cambiato mentre lavorava.",
    );
    expect(fraseDellaRicercaFermata(["combo"])).toBe(
      "La ricerca si è fermata: la combo è cambiata mentre lavorava.",
    );
    expect(fraseDellaRicercaFermata(["tetto"])).toBe(
      "La ricerca si è fermata: il tetto di spesa è cambiato mentre lavorava.",
    );
  });

  it("con più ingressi li elenca, e il verbo va al plurale", () => {
    expect(fraseDellaRicercaFermata(["tema", "combo"])).toBe(
      "La ricerca si è fermata: il tema e la combo sono cambiati mentre lavorava.",
    );
    expect(fraseDellaRicercaFermata(["tema", "combo", "tetto"])).toBe(
      "La ricerca si è fermata: il tema, la combo e il tetto di spesa sono cambiati mentre lavorava.",
    );
  });

  it("senza un ingresso da nominare dice la richiesta, e non inventa quale parte", () => {
    expect(fraseDellaRicercaFermata([])).toBe(
      "La ricerca si è fermata: la richiesta è cambiata mentre lavorava.",
    );
  });

  it("non parla come un guasto e non chiede niente", () => {
    for (const cambiati of [["tema"], ["orologi"], []] as const) {
      const frase = fraseDellaRicercaFermata(cambiati);
      expect(frase).not.toMatch(/guasto|errore|prova|riprova|\?/iu);
    }
  });
});
