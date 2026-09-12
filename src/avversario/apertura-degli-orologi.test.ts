/**
 * La cucitura che decide che cosa succede agli orologi all'apertura, provata
 * dove decide: com'è andata la lettura entra, la decisione esce.
 *
 * Il browser non serve. Quel che il ticket 54 chiede — che «non ne hai» e «non
 * si è potuto leggere» non finiscano nella stessa risposta, e che dopo una
 * lettura fallita nessuno scriva sopra quel che sta sul dispositivo — è una
 * domanda su questa funzione, e si prova qui.
 */

import { describe, expect, it } from "vitest";

import { aperturaDegliOrologi } from "./apertura-degli-orologi.js";

describe("l'apertura degli orologi", () => {
  it("mostra i suoi, quando i suoi si sono letti", () => {
    const apertura = aperturaDegliOrologi("letti");
    expect(apertura.mostra).toBe("i-suoi");
    expect(apertura.siPuoScrivere).toBe(true);
  });

  it("mostra il file del manutentore a chi non ha mai salvato niente", () => {
    const apertura = aperturaDegliOrologi("mai-salvati");
    expect(apertura.mostra).toBe("quelli-del-manutentore");
    expect(apertura.siPuoScrivere).toBe(true);
  });

  /**
   * Il ticket 54 per intero. Una lettura che non è riuscita non dice che il
   * dispositivo sia vuoto: dietro un `onblocked` ci sono tutti i mazzi
   * dell'utente. Mettergli davanti quelli del manutentore sarebbe metà del
   * danno; lasciare che il tasto successivo li salvi sopra i suoi è l'altra
   * metà, ed è la perdita vera.
   */
  it("dopo una lettura che non è riuscita non sostituisce niente e non scrive", () => {
    const apertura = aperturaDegliOrologi("non-si-e-letto");
    expect(apertura.mostra).toBe("niente");
    expect(apertura.siPuoScrivere).toBe(false);
  });

  it("tiene «non ne hai» e «non si è letto» su due risposte diverse", () => {
    expect(aperturaDegliOrologi("mai-salvati")).not.toEqual(
      aperturaDegliOrologi("non-si-e-letto"),
    );
  });
});
