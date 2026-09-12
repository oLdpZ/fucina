/**
 * La cucitura che decide se la schermata degli orologi porta una nota sul
 * deposito, provata dove decide: un esito di scrittura entra, una parola esce.
 *
 * Il browser non serve. Quel che il ticket 45 chiede — che la nota compaia al
 * primo rifiuto, resti finché una scrittura non riesce, e non arrivi mai quando
 * il deposito funziona — è una domanda su questa funzione, e si prova qui.
 */

import { describe, expect, it } from "vitest";

import type { EsitoDellaScrittura } from "../dati/deposito.js";
import { notaDelDeposito } from "./nota-del-deposito.js";

/** Come l'app la usa: ogni esito riscrive la nota, e l'ultima è quella in vista. */
function dopoGliEsiti(
  quale: "salvataggio" | "ripristino",
  esiti: readonly EsitoDellaScrittura[],
) {
  let nota: string | null = null;
  for (const esito of esiti) nota = notaDelDeposito(quale, esito);
  return nota;
}

describe("la nota sul deposito degli orologi", () => {
  it("non dice niente quando il deposito accetta", () => {
    expect(notaDelDeposito("salvataggio", "fatta")).toBe(null);
    expect(notaDelDeposito("ripristino", "fatta")).toBe(null);
  });

  it("dice che cosa si perde quando il deposito rifiuta la scrittura", () => {
    const nota = notaDelDeposito("salvataggio", "rifiutata");
    expect(nota).not.toBe(null);
    // Quel che l'utente perde, non il nome della funzione che ha risposto no.
    expect(nota).toContain("sessione");
    expect(nota).not.toContain("salvaOrologi");
    expect(nota).not.toContain("IndexedDB");
  });

  it("dice che cosa si perde quando il deposito rifiuta di dimenticare", () => {
    const nota = notaDelDeposito("ripristino", "rifiutata");
    expect(nota).not.toBe(null);
    expect(nota).toContain("apertura");
    expect(nota).not.toBe(notaDelDeposito("salvataggio", "rifiutata"));
  });

  /**
   * L'asimmetria, ed è tutta la ragione per cui i tre esiti non sono due.
   *
   * Un deposito che non si apre — navigazione privata, `indexedDB` che non
   * c'è, un'altra scheda che tiene aperta una versione vecchia — non ha
   * scritto: quel che l'utente ha battuto lo perde, e la nota del salvataggio
   * è vera lì come altrove.
   *
   * Della cancellazione invece non si sa niente. In navigazione privata non
   * c'era niente da cancellare e non si perde niente; con un'altra scheda
   * aperta i suoi mazzi sono ancora lì. Una nota serve a **nominare una
   * perdita**, e una perdita che non si sa nominare non si inventa.
   */
  it("su un deposito che non si apre il salvataggio parla e il ripristino tace", () => {
    expect(notaDelDeposito("salvataggio", "nessun-deposito")).toBe(
      notaDelDeposito("salvataggio", "rifiutata"),
    );
    expect(notaDelDeposito("ripristino", "nessun-deposito")).toBe(null);
  });

  it("resta la stessa parola a ogni carattere battuto, e non se ne aggiunge una", () => {
    // Dieci tasti premuti in modo privato: la nota è una, identica, non dieci.
    const dieciRifiuti = dopoGliEsiti(
      "salvataggio",
      Array<EsitoDellaScrittura>(10).fill("nessun-deposito"),
    );
    expect(dieciRifiuti).toBe(notaDelDeposito("salvataggio", "rifiutata"));
  });

  it("se ne va quando una scrittura riesce, e non prima", () => {
    expect(dopoGliEsiti("salvataggio", ["rifiutata", "rifiutata"])).not.toBe(null);
    expect(dopoGliEsiti("salvataggio", ["rifiutata", "rifiutata", "fatta"])).toBe(null);
    expect(dopoGliEsiti("salvataggio", ["rifiutata", "fatta", "rifiutata"])).not.toBe(null);
  });
});
