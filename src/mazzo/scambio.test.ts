import { describe, expect, it } from "vitest";

import type { ContenutoMazzo } from "./salvato.js";
import { leggiScambio, listaDaTorneo, scriviScambio } from "./scambio.js";

/**
 * Ticket 07: si esporta un mazzo in un testo, lo si manda a un amico, l'amico
 * lo importa e vede lo stesso mazzo — lista **e** richiesta che l'ha prodotto.
 *
 * Il testo passa per messaggi, appunti e programmi di posta: arriva tagliato,
 * arriva con righe in più, arriva incollato due volte. In tutti questi casi
 * l'app deve dire che cosa non va, mai cadere.
 */

const MAZZO: ContenutoMazzo = {
  nome: "Il mazzo dell'amico",
  salvatoIl: "2026-09-03T10:00:00.000Z",
  datiDel: "2026-09-02T09:05:48.145+00:00",
  richiesta: { origine: "a-mano", terreVolute: 22 },
  carte: [
    { nome: "Prima Carta", copie: 4 },
    { nome: "Seconda Carta", copie: 2 },
  ],
};

describe("il testo da scambiare", () => {
  it("si legge: c'è dentro il nome del mazzo e ogni carta con le sue copie", () => {
    const testo = scriviScambio(MAZZO);
    expect(testo).toContain("Il mazzo dell'amico");
    expect(testo).toContain("4 Prima Carta");
    expect(testo).toContain("2 Seconda Carta");
  });

  it("porta con sé la richiesta, non solo la lista", () => {
    expect(scriviScambio(MAZZO)).toMatch(/richiesta/i);
    expect(scriviScambio(MAZZO)).toMatch(/22/);
  });

  it("riletto, ricostruisce il mazzo così com'era", () => {
    expect(leggiScambio(scriviScambio(MAZZO))).toEqual(MAZZO);
  });

  it("ricostruisce anche un mazzo le cui terre le decide la curva", () => {
    const dallaCurva: ContenutoMazzo = {
      ...MAZZO,
      richiesta: { origine: "a-mano", terreVolute: null },
    };
    expect(leggiScambio(scriviScambio(dallaCurva))).toEqual(dallaCurva);
  });

  it("sopporta gli spazi e le righe vuote che i programmi di posta aggiungono", () => {
    const maltrattato = scriviScambio(MAZZO)
      .split("\n")
      .map((riga) => `  ${riga}  `)
      .join("\n\n");
    expect(leggiScambio(maltrattato)).toEqual(MAZZO);
  });

  it("sopporta le righe terminate come le termina Windows", () => {
    expect(leggiScambio(scriviScambio(MAZZO).replace(/\n/gu, "\r\n"))).toEqual(MAZZO);
  });
});

describe("un testo che non si può importare", () => {
  it("dice che non è un mazzo, se non lo è", () => {
    expect(() => leggiScambio("ciao come stai")).toThrow(/mazzo/i);
    expect(() => leggiScambio("")).toThrow(/mazzo/i);
  });

  it("dice che è troncato, se finisce a metà", () => {
    const meta = scriviScambio(MAZZO).split("\n").slice(0, 6).join("\n");
    expect(() => leggiScambio(meta)).toThrow(/tronc/i);
  });

  it("si accorge se manca una carta, anche se la riga finale c'è", () => {
    const senzaUnaCarta = scriviScambio(MAZZO)
      .split("\n")
      .filter((riga) => !riga.includes("Seconda Carta"))
      .join("\n");
    expect(() => leggiScambio(senzaUnaCarta)).toThrow(/(manca|incomplet|copie)/i);
  });

  it("non si fida di un testo che non dice quante carte contiene", () => {
    const senzaConta = scriviScambio(MAZZO)
      .split("\n")
      .filter((riga) => !riga.startsWith("Carte ("))
      .join("\n");
    expect(() => leggiScambio(senzaConta)).toThrow(/quante carte/i);
  });

  it("si accorge di un testo incollato due volte, e non lo chiama tagliato", () => {
    const doppio = `${scriviScambio(MAZZO)}\n${scriviScambio(MAZZO)}`;
    expect(() => leggiScambio(doppio)).toThrow(/due volte/i);
  });

  it("dice che viene da un'app più recente, se il formato è di là da venire", () => {
    const dalFuturo = scriviScambio(MAZZO).replace("formato 1", "formato 9");
    expect(() => leggiScambio(dalFuturo)).toThrow(/recente/i);
  });

  it("non accetta un mazzo senza carte", () => {
    const senzaCarte = scriviScambio(MAZZO)
      .split("\n")
      .filter((riga) => !/^\d+ /u.test(riga.trim()))
      .join("\n");
    expect(() => leggiScambio(senzaCarte)).toThrow(/carte/i);
  });
});

describe("la lista da consegnare all'arbitro", () => {
  const carte = [
    { nome: "Seconda Carta", copie: 2 },
    { nome: "Prima Carta", copie: 4 },
  ];
  const terre = [
    { nome: "Mountain", copie: 12 },
    { nome: "Blood Crypt", copie: 4 },
  ];

  it("è solo testo: nomi inglesi e copie, niente altro", () => {
    expect(listaDaTorneo(carte, terre)).toBe(
      ["4 Prima Carta", "2 Seconda Carta", "4 Blood Crypt", "12 Mountain"].join("\n"),
    );
  });

  it("mette le terre in fondo, come si scrive una lista", () => {
    const righe = listaDaTorneo(carte, terre).split("\n");
    expect(righe.indexOf("12 Mountain")).toBeGreaterThan(righe.indexOf("4 Prima Carta"));
  });

  it("regge un mazzo senza terre, che è il mazzo appena cominciato", () => {
    expect(listaDaTorneo(carte, [])).toBe(["4 Prima Carta", "2 Seconda Carta"].join("\n"));
  });
});
