import { describe, expect, it } from "vitest";

import { POOL_FINTO } from "../catalogo/pool-finto.js";
import type { Carta } from "../dati/pool.js";
import { copieMassime } from "./copie.js";
import { COPIE_MASSIME } from "./taratura.js";

const QUALUNQUE = POOL_FINTO[0]!;

function conTesto(testo: string): Carta {
  return { ...QUALUNQUE, testo };
}

describe("copieMassime", () => {
  it("di norma sono quattro", () => {
    expect(copieMassime(QUALUNQUE)).toBe(COPIE_MASSIME);
  });

  it("non ha tetto la carta che se lo concede da sé", () => {
    // La frase è quella stampata sulle carte vere; il nome è inventato perché i
    // nomi ruotano e questo test deve sopravvivere alla rotazione.
    const carta = conTesto("A deck can have any number of cards named Warren Multiplier.");
    expect(copieMassime(carta)).toBe(Number.POSITIVE_INFINITY);
  });

  it("non basta parlare di numeri per avere il permesso", () => {
    expect(copieMassime(conTesto("Draw any number of cards."))).toBe(COPIE_MASSIME);
  });
});
