/**
 * La cucitura che decide **che cosa si è letto** nel deposito degli orologi,
 * provata dove decide: la risposta del deposito entra, la lettura esce.
 *
 * IndexedDB non serve, ed è il motivo per cui questa regola sta in una
 * funzione sua invece che dentro `leggiOrologiSalvati`. Quel che il ticket 54
 * chiede — che «non ne hai» e «non si è potuto leggere» non finiscano nella
 * stessa risposta — si decide tutto qui.
 */

import { describe, expect, it } from "vitest";

import { letturaDegliOrologi } from "./deposito.js";

const UNO = {
  nome: "Il mazzo di Marco",
  perche: "Lo incontro ogni venerdì",
  turnoDiChiusura: 4,
  rimozioni: 2,
  contromagie: 0,
};

describe("la lettura degli orologi conservati", () => {
  it("torna le voci lette, quando il deposito le consegna", () => {
    const lettura = letturaDegliOrologi({ come: "fatta", porta: "aperta", esito: [UNO] });
    expect(lettura.come).toBe("letti");
    expect(lettura.come === "letti" && lettura.orologi).toHaveLength(1);
  });

  it("un elenco vuoto è una risposta, e resta una risposta", () => {
    // «Non voglio correre contro nessuno» non è «non ha mai deciso»: chi ha
    // cancellato tutto non se li deve ritrovare alla riapertura.
    const lettura = letturaDegliOrologi({ come: "fatta", porta: "aperta", esito: [] });
    expect(lettura.come).toBe("letti");
  });

  it("una voce che non c'è è un «non ha mai deciso»", () => {
    expect(letturaDegliOrologi({ come: "fatta", porta: "aperta", esito: undefined }).come)
      .toBe("mai-salvati");
    expect(letturaDegliOrologi({ come: "fatta", porta: "aperta", esito: null }).come)
      .toBe("mai-salvati");
    // Quel che elenco non è: là non c'è nessuna voce da tenere.
    expect(letturaDegliOrologi({ come: "fatta", porta: "aperta", esito: "roba" }).come)
      .toBe("mai-salvati");
  });

  /**
   * Il ticket 54. Un deposito che si è aperto e ha rifiutato la lettura, e uno
   * che non si è lasciato aprire pur esistendo, hanno dentro quel che l'utente
   * ci ha messo: dirlo vuoto gli mette davanti i mazzi del manutentore, e il
   * primo tasto premuto li salva sopra i suoi.
   */
  it("un deposito che c'è e non si è fatto leggere non è un deposito vuoto", () => {
    expect(letturaDegliOrologi({ come: "rifiutata", porta: "aperta", esito: null }).come)
      .toBe("non-si-e-letto");
    expect(
      letturaDegliOrologi({ come: "nessun-deposito", porta: "non-si-vede", esito: null }).come,
    ).toBe("non-si-e-letto");
  });

  /**
   * L'altra metà, che costa quanto la prima se la si sbaglia. Su un
   * dispositivo dove IndexedDB non si usa affatto — navigazione privata di
   * Firefox, dove aprire solleva — nessuno ha mai potuto salvare niente: là
   * dentro non c'è nessun mazzo da proteggere, e negare il file di cortesia
   * lascerebbe il pannello vuoto per sempre e per un pericolo che non esiste.
   */
  it("un dispositivo che non ha depositi è un vuoto che sa di essere vuoto", () => {
    expect(
      letturaDegliOrologi({ come: "nessun-deposito", porta: "non-c-e", esito: null }).come,
    ).toBe("mai-salvati");
  });
});
