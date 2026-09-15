import { describe, expect, it } from "vitest";

import { notaDelFuoriTema } from "./nota-del-fuori-tema.js";

/**
 * La frase che dice perché il mazzo più fedele ha carte fuori tema (ticket 52).
 *
 * Quel che si prova qui è che la frase non incolpi il tema di quel che ha tolto
 * il prezzo, che i numeri che nomina vengano da una popolazione sola, e che le
 * due ragioni per cui il prezzo toglie una carta — costa troppo, oppure un
 * listino non ce l'ha — non si confondano fra loro.
 */

const CONTO = {
  carte: 10,
  capienza: 40,
  posti: 39,
  troppoCare: 0,
  senzaPrezzo: 0,
  tetto: null,
} as const;

describe("la nota del fuori tema", () => {
  it("a tetto spento nomina le carte del tema e i due numeri, e del prezzo non parla", () => {
    const nota = notaDelFuoriTema(CONTO);

    expect(nota).toContain("10 carte");
    expect(nota).toContain("40 posti");
    expect(nota).toContain("39");
    expect(nota).not.toMatch(/tetto|€|listino/);
  });

  it("col tetto acceso che non ha tolto nessuna carta del tema, il tetto non si nomina", () => {
    // Il tetto c'è ma sul tema non ha pesato: incolparlo sarebbe falso quanto
    // incolpare il tema di quel che ha tolto lui.
    const nota = notaDelFuoriTema({ ...CONTO, tetto: 20 });

    expect(nota).not.toMatch(/tetto|€|listino/);
  });

  it("quando il tetto ha lasciato fuori carte troppo care, lo dice e conta quante", () => {
    // È il caso del ticket: «Il tema prende 10 carte, buone per 36 posti» dove
    // le 10 carte bastavano per 40, e la differenza era un Goblin troppo caro.
    const nota = notaDelFuoriTema({
      ...CONTO,
      capienza: 36,
      troppoCare: 1,
      tetto: 20,
    });

    expect(nota).toMatch(/tetto/);
    expect(nota).toContain("20,00");
    expect(nota).toContain("10 carte");
    expect(nota).toContain("36 posti");
    expect(nota).not.toMatch(/listino/);
  });

  it("una carta del tema senza listino non si conta fra quelle che costano troppo", () => {
    // `comprabile` dice no tanto a chi sfonda il tetto quanto a chi un prezzo
    // non ce l'ha, e le due cose non si rimediano allo stesso modo: alzare il
    // tetto non farà mai entrare una carta di cui non si sa il prezzo. Metterle
    // nello stesso conto sarebbe la stessa mescolanza che il ticket toglie.
    const nota = notaDelFuoriTema({
      ...CONTO,
      capienza: 36,
      senzaPrezzo: 1,
      tetto: 20,
    });

    expect(nota).toMatch(/listino/);
    expect(nota).not.toMatch(/costa più del tetto|costano più del tetto/);
  });

  it("quando il prezzo toglie per tutte e due le ragioni, le tiene separate", () => {
    const nota = notaDelFuoriTema({
      ...CONTO,
      carte: 8,
      capienza: 32,
      troppoCare: 3,
      senzaPrezzo: 2,
      tetto: 40,
    });

    // Le tolte dal prezzo non si sommano alle otto che restano, e non si
    // sommano nemmeno fra loro: sono tre conti distinti.
    expect(nota).toContain("8 carte");
    expect(nota).toMatch(/3 carte del tema/);
    expect(nota).toMatch(/2 carte del tema/);
    expect(nota).not.toMatch(/5 carte del tema/);
  });

  it("distingue quel che il tema non ha da quel che il prezzo ha tolto", () => {
    const nota = notaDelFuoriTema({
      ...CONTO,
      carte: 8,
      capienza: 32,
      troppoCare: 3,
      tetto: 40,
    });

    expect(nota).toContain("8 carte");
    expect(nota).toMatch(/3 carte del tema/);
  });

  it("al singolare parla di una carta sola, e non di «1 carte»", () => {
    const una = notaDelFuoriTema({
      ...CONTO,
      carte: 1,
      capienza: 4,
      troppoCare: 1,
      tetto: 20,
    });

    expect(una).toContain("1 carta ");
    expect(una).not.toMatch(/1 carte/);
  });
});
