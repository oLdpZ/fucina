/**
 * La cucitura che decide se la schermata degli orologi porta una nota sul
 * deposito, provata dove decide: un esito di scrittura entra, una parola esce.
 *
 * Il browser non serve. Quel che il ticket 45 chiede — che la nota compaia al
 * primo rifiuto, resti finché una scrittura non riesce, e non arrivi mai quando
 * il deposito funziona — è una domanda su questa funzione, e si prova qui.
 */

import { describe, expect, it } from "vitest";

import { notaDelDeposito } from "./nota-del-deposito.js";

/** Come l'app la usa: ogni esito riscrive la nota, e l'ultima è quella in vista. */
function dopoGliEsiti(quale: "salvataggio" | "ripristino", esiti: readonly boolean[]) {
  let nota: string | null = null;
  for (const riuscita of esiti) nota = notaDelDeposito(quale, riuscita);
  return nota;
}

describe("la nota sul deposito degli orologi", () => {
  it("non dice niente quando il deposito accetta", () => {
    expect(notaDelDeposito("salvataggio", true)).toBe(null);
    expect(notaDelDeposito("ripristino", true)).toBe(null);
  });

  it("dice che cosa si perde quando il deposito rifiuta la scrittura", () => {
    const nota = notaDelDeposito("salvataggio", false);
    expect(nota).not.toBe(null);
    // Quel che l'utente perde, non il nome della funzione che ha risposto no.
    expect(nota).toContain("sessione");
    expect(nota).not.toContain("salvaOrologi");
    expect(nota).not.toContain("IndexedDB");
  });

  it("dice che cosa si perde quando il deposito rifiuta di dimenticare", () => {
    const nota = notaDelDeposito("ripristino", false);
    expect(nota).not.toBe(null);
    expect(nota).toContain("apertura");
    expect(nota).not.toBe(notaDelDeposito("salvataggio", false));
  });

  it("resta la stessa parola a ogni carattere battuto, e non se ne aggiunge una", () => {
    // Dieci tasti premuti in modo privato: la nota è una, identica, non dieci.
    const dieciRifiuti = dopoGliEsiti("salvataggio", Array<boolean>(10).fill(false));
    expect(dieciRifiuti).toBe(notaDelDeposito("salvataggio", false));
  });

  it("se ne va quando una scrittura riesce, e non prima", () => {
    expect(dopoGliEsiti("salvataggio", [false, false])).not.toBe(null);
    expect(dopoGliEsiti("salvataggio", [false, false, true])).toBe(null);
    expect(dopoGliEsiti("salvataggio", [false, true, false])).not.toBe(null);
  });
});
