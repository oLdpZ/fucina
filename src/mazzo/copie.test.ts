import { describe, expect, it } from "vitest";

import { POOL_FINTO } from "../catalogo/pool-finto.js";
import type { Carta } from "../dati/pool.js";
import { copieAlMassimo, copieMassime, leggiTettoDiCopie } from "./copie.js";
import { COPIE_MASSIME } from "./taratura.js";

const QUALUNQUE = POOL_FINTO[0]!;

function conTetto(tettoDiCopie: number | null): Carta {
  return { ...QUALUNQUE, tettoDiCopie };
}

describe("leggiTettoDiCopie", () => {
  it("di norma sono quattro", () => {
    expect(leggiTettoDiCopie("", ["Creature"])).toBe(COPIE_MASSIME);
  });

  it("non c'è tetto per la carta che se lo concede da sé", () => {
    // La frase è quella stampata sulle carte vere; il nome è inventato perché i
    // nomi cambiano e questo test deve sopravvivere al cambio.
    const testo = "A deck can have any number of cards named Warren Multiplier.";
    expect(leggiTettoDiCopie(testo, ["Creature"])).toBeNull();
  });

  it("non basta parlare di numeri per avere il permesso", () => {
    expect(leggiTettoDiCopie("Draw any number of cards.", ["Instant"])).toBe(COPIE_MASSIME);
  });

  it("non c'è tetto per le terre base", () => {
    expect(leggiTettoDiCopie("({T}: Add {W}.)", ["Basic", "Land"])).toBeNull();
  });

  it("le terre che base non sono hanno il tetto di tutti", () => {
    expect(leggiTettoDiCopie("", ["Land"])).toBe(COPIE_MASSIME);
  });
});

describe("copieMassime", () => {
  it("legge il tetto dalla carta, senza rifare il conto", () => {
    expect(copieMassime(conTetto(COPIE_MASSIME))).toBe(COPIE_MASSIME);
    // Il numero viene dal pool, quindi qualunque numero il pool scriva vale: è
    // così che le carte limitate a una copia entreranno senza toccare il motore.
    expect(copieMassime(conTetto(1))).toBe(1);
  });

  it("legge il «senza tetto» come un tetto che non ferma nessuno", () => {
    expect(copieMassime(conTetto(null))).toBe(Number.POSITIVE_INFINITY);
  });

  it("non guarda il testo della carta", () => {
    // Il permesso scritto nel testo è già stato letto dalla preparazione: se lo
    // rileggesse anche qui, il tetto avrebbe due padroni.
    const carta: Carta = {
      ...conTetto(COPIE_MASSIME),
      testo: "A deck can have any number of cards named Warren Multiplier.",
    };
    expect(copieMassime(carta)).toBe(COPIE_MASSIME);
  });
});

describe("copieAlMassimo", () => {
  it("di norma sono quattro", () => {
    expect(copieAlMassimo(conTetto(COPIE_MASSIME))).toBe(COPIE_MASSIME);
  });

  it("su una carta limitata è una, e non quattro", () => {
    // È il numero che il motore mette nel mazzo **e** quello che la schermata
    // della combo promette: se le due letture divergessero, l'app prometterebbe
    // quattro copie di una carta che poi ne mette una.
    expect(copieAlMassimo(conTetto(1))).toBe(1);
  });

  it("su una carta senza tetto si ferma comunque a quattro", () => {
    // Trentatré copie della stessa carta sono un mazzo legale che non è un
    // mazzo: di lì non si parte, e non si promette.
    expect(copieAlMassimo(conTetto(null))).toBe(COPIE_MASSIME);
  });
});
