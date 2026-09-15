/**
 * La cucitura che decide che cosa dice la schermata dei mazzi salvati dopo
 * «Cancella», provata dove decide: l'esito del deposito entra, la notizia esce.
 *
 * Il browser non serve. Quel che il ticket 50 chiede — niente «è stato
 * cancellato» quando il deposito rifiuta, una frase che dica il mazzo ancora lì,
 * e nessun messaggio nuovo nel caso normale — è una domanda su questa funzione.
 */

import { describe, expect, it } from "vitest";

import { notaDellaCancellazione } from "./nota-della-cancellazione.js";

describe("quel che si dice dopo una cancellazione", () => {
  it("cancellato davvero, lo dice come prima e toglie il mazzo", () => {
    expect(notaDellaCancellazione("Goblin", "fatta")).toEqual({
      fatto: "«Goblin» è stato cancellato.",
      male: null,
      tolto: true,
    });
  });

  it("un deposito che rifiuta dice, fra i guasti, che il mazzo è ancora lì", () => {
    expect(notaDellaCancellazione("Goblin", "rifiutata")).toEqual({
      fatto: null,
      male: "«Goblin» non si è potuto cancellare, ed è ancora nell'elenco.",
      tolto: false,
    });
  });

  /**
   * Un deposito che non si apre **può** arrivare dopo un elenco mostrato:
   * un'altra scheda che porta il deposito a una versione più nuova fa fallire
   * le aperture di questa. Non ha cancellato niente, e il mazzo che l'utente ha
   * appena visto nell'elenco lì resta: la frase è la stessa del rifiuto, perché
   * dice solo quel che si sa in tutti e due i casi.
   */
  it("un deposito che non si apre dice la stessa cosa del rifiuto", () => {
    expect(notaDellaCancellazione("Goblin", "nessun-deposito")).toEqual(
      notaDellaCancellazione("Goblin", "rifiutata"),
    );
  });
});
