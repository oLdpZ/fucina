/**
 * Il caso con il seme: quel che i test devono garantire è una cosa sola, ma è
 * la più importante dell'app — **stesso seme, stessa sequenza**. Senza questo
 * ogni numero che la simulazione mostrerà all'utente diventa inverificabile.
 */

import { describe, expect, it } from "vitest";

import { caso, mescola } from "./caso.js";

function primi(seme: number, quanti: number): number[] {
  const generatore = caso(seme);
  return Array.from({ length: quanti }, () => generatore.frazione());
}

describe("caso", () => {
  it("dallo stesso seme dà la stessa sequenza, sempre", () => {
    expect(primi(20260903, 50)).toEqual(primi(20260903, 50));
  });

  it("da semi diversi dà sequenze diverse", () => {
    expect(primi(1, 20)).not.toEqual(primi(2, 20));
  });

  it("due generatori con lo stesso seme non si disturbano a vicenda", () => {
    const uno = caso(7);
    const altro = caso(7);
    uno.frazione();
    uno.frazione();
    expect(altro.frazione()).toBe(primi(7, 1)[0]);
  });

  it("le frazioni stanno in [0, 1)", () => {
    for (const valore of primi(99, 2000)) {
      expect(valore).toBeGreaterThanOrEqual(0);
      expect(valore).toBeLessThan(1);
    }
  });

  it("gli interi stanno in [0, limite) e li toccano tutti", () => {
    const generatore = caso(3);
    const visti = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const valore = generatore.intero(6);
      expect(Number.isInteger(valore)).toBe(true);
      expect(valore).toBeGreaterThanOrEqual(0);
      expect(valore).toBeLessThan(6);
      visti.add(valore);
    }
    expect(visti.size).toBe(6);
  });

  it("un limite non positivo è un errore, non un numero storto", () => {
    expect(() => caso(1).intero(0)).toThrow();
  });

  it("un seme che non è un intero fra 0 e 2^32 − 1 è un errore", () => {
    // Senza il controllo tutti questi finirebbero in silenzio sullo stesso
    // stato di un altro seme, e due esecuzioni che si credono indipendenti
    // ripeterebbero la stessa sequenza restando «deterministiche».
    for (const storto of [NaN, -1, 0.5, 2 ** 32, Infinity]) {
      expect(() => caso(storto)).toThrow();
    }
    expect(() => caso(0)).not.toThrow();
    expect(() => caso(2 ** 32 - 1)).not.toThrow();
  });
});

describe("mescola", () => {
  const carte = Array.from({ length: 60 }, (_, i) => i);

  it("restituisce una permutazione, senza toccare la lista di partenza", () => {
    const originale = [...carte];
    const mescolate = mescola(carte, caso(42));
    expect(carte).toEqual(originale);
    expect([...mescolate].sort((a, b) => a - b)).toEqual(originale);
  });

  it("dallo stesso seme mescola allo stesso modo", () => {
    expect(mescola(carte, caso(42))).toEqual(mescola(carte, caso(42)));
  });

  it("da semi diversi mescola in modo diverso", () => {
    expect(mescola(carte, caso(42))).not.toEqual(mescola(carte, caso(43)));
  });

  it("mescola davvero: non lascia la lista com'era", () => {
    expect(mescola(carte, caso(42))).not.toEqual(carte);
  });

  it("su liste di zero o un elemento non ha niente da fare", () => {
    expect(mescola([], caso(1))).toEqual([]);
    expect(mescola(["sola"], caso(1))).toEqual(["sola"]);
  });
});
