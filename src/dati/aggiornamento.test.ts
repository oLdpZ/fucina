import { describe, expect, it, vi } from "vitest";

import { POOL_FINTO } from "../catalogo/pool-finto.js";
import {
  TETTO_DEPOSITO,
  cercaAggiornamento,
  piuFresco,
  poolDaAprire,
  scegliPool,
} from "./aggiornamento.js";
import type { Pool } from "./pool.js";

/**
 * Storie 18 e 19, e la decisione Q29: i dati stanno dentro l'app, e se c'è rete
 * l'app ne cerca di più freschi **in sottofondo**. Se non li trova — rete
 * assente, risposta rotta, nessuno che pubblica più niente per un anno — quel
 * che l'app ha già resta buono e intero.
 *
 * Qui si prova la decisione, non il tubo: quale pool si apre, e cosa si fa di
 * quello che arriva dalla rete. Lo scaricamento entra come funzione, così i
 * casi che contano — la rete che non c'è, la risposta malformata — si provano
 * senza rete e senza aspettare.
 */

/** L'impronta del documento di formato che l'app ha in mano. */
const DOCUMENTO = "documento-in-mano";

/**
 * Un pool datato, con carte vere del pool finto. Viene dal documento in mano,
 * se non si dice altro: così la data resta l'unica cosa in gioco.
 */
function poolDel(giorno: string, impronta: string = DOCUMENTO): Pool {
  return {
    generatoIl: giorno,
    improntaDelDocumento: impronta,
    registroTagScryfall: [],
    carte: [...POOL_FINTO],
  };
}

const VECCHIO = poolDel("2026-08-01T00:00:00.000+00:00");
const NUOVO = poolDel("2026-09-02T09:05:48.145+00:00");
/** Il pool più fresco di tutti, ma prodotto da un documento che l'app non ha ancora. */
const DI_UN_ALTRO_DOCUMENTO = poolDel("2026-09-10T00:00:00.000+00:00", "documento-che-verrà");
/** Un pool scritto prima che il legame col documento esistesse. */
const SENZA_IMPRONTA = poolDel("2026-09-10T00:00:00.000+00:00", "");

describe("quale pool è più fresco", () => {
  it("riconosce una data più recente", () => {
    expect(piuFresco(NUOVO, VECCHIO)).toBe(true);
  });

  it("a parità di data non cambia nulla: scaricare due volte lo stesso non è un aggiornamento", () => {
    expect(piuFresco(NUOVO, NUOVO)).toBe(false);
  });

  it("non torna mai indietro nel tempo", () => {
    expect(piuFresco(VECCHIO, NUOVO)).toBe(false);
  });

  it("una data che non si capisce non vince mai", () => {
    expect(piuFresco(poolDel("chissà"), VECCHIO)).toBe(false);
  });

  it("ma una data buona batte una data che non si capisce", () => {
    expect(piuFresco(NUOVO, poolDel("chissà"))).toBe(true);
  });
});

describe("quale pool si apre", () => {
  it("senza niente sul dispositivo si aprono i dati inclusi nell'app", () => {
    expect(scegliPool(VECCHIO, null, DOCUMENTO)).toEqual({ pool: VECCHIO, dimentica: false });
  });

  it("i dati scaricati la volta scorsa vincono, se sono più freschi", () => {
    expect(scegliPool(VECCHIO, NUOVO, DOCUMENTO)).toEqual({ pool: NUOVO, dimentica: false });
  });

  it("un'app aggiornata rende inutili i dati conservati, e li dimentica", () => {
    // Capita davvero: l'utente reinstalla l'app dopo un aggiornamento del pool.
    // Tenersi la copia vecchia sarebbe occupare spazio per niente.
    expect(scegliPool(NUOVO, VECCHIO, DOCUMENTO)).toEqual({ pool: NUOVO, dimentica: true });
  });

  it("se i dati inclusi non si leggono, si aprono quelli sul dispositivo", () => {
    // Il file del pacchetto può mancare o essere arrivato a metà. Se sul
    // dispositivo c'è una copia buona, buttarla via per mostrare una schermata
    // di guasto sarebbe perdere dati che l'app aveva (ticket 05).
    expect(scegliPool(null, NUOVO, DOCUMENTO)).toEqual({ pool: NUOVO, dimentica: false });
  });

  it("senza nulla da nessuna delle due parti non si inventa un pool", () => {
    expect(scegliPool(null, null, DOCUMENTO)).toEqual({ pool: null, dimentica: false });
  });

  it("a parità di data si preferiscono i dati inclusi e si libera lo spazio", () => {
    expect(scegliPool(NUOVO, poolDel(NUOVO.generatoIl), DOCUMENTO)).toEqual({
      pool: NUOVO,
      dimentica: true,
    });
  });

  it("un pool conservato che viene da un altro documento non si apre, e si dimentica", () => {
    // Ticket 32: il pool scaricato entra nel deposito prima che il service
    // worker attivi il guscio col documento nuovo. Aperto accanto al documento
    // vecchio, un mazzo salvato in quel momento si porterebbe dietro l'identità
    // di un formato che non è quello delle sue carte. Al giro dopo, col guscio
    // nuovo, l'aggiornamento in sottofondo lo riprende.
    expect(scegliPool(VECCHIO, DI_UN_ALTRO_DOCUMENTO, DOCUMENTO)).toEqual({
      pool: VECCHIO,
      dimentica: true,
    });
  });

  it("nemmeno quando i dati inclusi mancano", () => {
    // Un pool di un altro documento nel deposito e un deploy che serve la
    // pagina dell'app al posto di `pool.json`: aprirlo vorrebbe dire le carte di
    // un gioco sotto il nome e l'impronta di un altro. Meglio il guasto del file
    // incluso, che è quello che il manutentore può riparare. Un pool che
    // l'impronta non ce l'ha affatto, invece, qui si apre ancora: vedi il test
    // sotto, e il commento del 2026-09-15 nel ticket.
    expect(scegliPool(null, DI_UN_ALTRO_DOCUMENTO, DOCUMENTO)).toEqual({
      pool: null,
      dimentica: true,
    });
  });

  it("un pool conservato che non dice da dove viene continua ad aprirsi", () => {
    // Chi ha l'app da prima del legame fra i due file non perde
    // l'aggiornamento in sottofondo che aveva già preso.
    expect(scegliPool(VECCHIO, SENZA_IMPRONTA, DOCUMENTO)).toEqual({
      pool: SENZA_IMPRONTA,
      dimentica: false,
    });
    expect(scegliPool(null, SENZA_IMPRONTA, DOCUMENTO)).toEqual({
      pool: SENZA_IMPRONTA,
      dimentica: false,
    });
  });
});

describe("il controllo di freschezza", () => {
  it("prende i dati più freschi quando ci sono", async () => {
    const esito = await cercaAggiornamento(VECCHIO, DOCUMENTO, async () => NUOVO);
    expect(esito).toEqual({ tipo: "preso", pool: NUOVO });
  });

  it("non fa nulla quando in rete non c'è niente di più nuovo", async () => {
    const esito = await cercaAggiornamento(NUOVO, DOCUMENTO, async () => VECCHIO);
    expect(esito.tipo).toBe("nulla-di-nuovo");
  });

  it("non prende i dati di un documento che l'app non ha ancora in mano", async () => {
    // È la finestra del ticket 32 vista da dentro la sessione: il pool nuovo è
    // già in rete, il guscio col documento nuovo non è ancora attivo. Mostrarlo
    // subito vorrebbe dire il catalogo di un documento sotto il nome e
    // l'impronta di un altro; alla prossima apertura arriva insieme al suo.
    const esito = await cercaAggiornamento(VECCHIO, DOCUMENTO, async () => DI_UN_ALTRO_DOCUMENTO);
    expect(esito.tipo).toBe("di-un-altro-documento");
  });

  it("prende i dati freschi che non dicono da dove vengono", async () => {
    const esito = await cercaAggiornamento(VECCHIO, DOCUMENTO, async () => SENZA_IMPRONTA);
    expect(esito).toEqual({ tipo: "preso", pool: SENZA_IMPRONTA });
  });

  it("senza rete l'app resta intera: si dice che non è riuscito, e basta", async () => {
    const esito = await cercaAggiornamento(NUOVO, DOCUMENTO, async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(esito.tipo).toBe("non-riuscito");
    expect(esito).toHaveProperty("motivo");
  });

  it("una risposta malformata non fa cadere niente né sostituisce i dati buoni", async () => {
    for (const spazzatura of [null, "<!doctype html>", { carte: [] }, { generatoIl: 1 }]) {
      const esito = await cercaAggiornamento(NUOVO, DOCUMENTO, async () => spazzatura);
      expect(esito.tipo).toBe("non-riuscito");
    }
  });

  it("un pool arrivato vuoto non svuota il catalogo", async () => {
    const esito = await cercaAggiornamento(NUOVO, DOCUMENTO, async () => ({
      generatoIl: "2027-01-01T00:00:00.000+00:00",
      carte: [],
    }));
    expect(esito.tipo).toBe("non-riuscito");
  });
});

describe("l'apertura dell'app", () => {
  it("parte dai dati sul dispositivo quando sono i più freschi", async () => {
    const aperto = await poolDaAprire(
      DOCUMENTO,
      async () => VECCHIO,
      async () => NUOVO,
    );
    expect(aperto.generatoIl).toBe(NUOVO.generatoIl);
  });

  it("parte dai dati inclusi quando quelli sul dispositivo sono di un altro documento", async () => {
    const aperto = await poolDaAprire(
      DOCUMENTO,
      async () => VECCHIO,
      async () => DI_UN_ALTRO_DOCUMENTO,
    );
    expect(aperto).toEqual(VECCHIO);
  });

  it("senza dati inclusi, un pool di un altro documento non copre il guasto", async () => {
    await expect(
      poolDaAprire(
        DOCUMENTO,
        async () => {
          throw new Error("Il file del pool delle carte non si legge.");
        },
        async () => DI_UN_ALTRO_DOCUMENTO,
      ),
    ).rejects.toThrow(/non si legge/);
  });

  it("un deposito che non risponde mai non impedisce all'app di aprirsi", async () => {
    // Non è un caso di scuola: su alcuni browser `indexedDB.open()` resta muto
    // per sempre in contesti ristretti. Aspettarlo vorrebbe dire una schermata
    // «Carico le carte…» che non finisce, con i dati inclusi già pronti a un
    // passo di distanza.
    vi.useFakeTimers();
    try {
      const apertura = poolDaAprire(
        DOCUMENTO,
        async () => VECCHIO,
        () => new Promise<null>(() => {}),
      );
      await vi.advanceTimersByTimeAsync(TETTO_DEPOSITO + 1);
      await expect(apertura).resolves.toEqual(VECCHIO);
    } finally {
      vi.useRealTimers();
    }
  });

  it("un deposito che si rompe non impedisce all'app di aprirsi", async () => {
    const aperto = await poolDaAprire(
      DOCUMENTO,
      async () => VECCHIO,
      async () => {
        throw new Error("deposito negato");
      },
    );
    expect(aperto).toEqual(VECCHIO);
  });

  it("l'impronta del documento può arrivare dopo le letture dei pool", async () => {
    const aperto = await poolDaAprire(
      Promise.resolve(DOCUMENTO),
      async () => VECCHIO,
      async () => DI_UN_ALTRO_DOCUMENTO,
    );
    expect(aperto).toEqual(VECCHIO);
  });

  it("se il documento non si legge, il guasto che si dice è il suo", async () => {
    await expect(
      poolDaAprire(
        Promise.reject(new Error("Il documento di formato non si legge.")),
        async () => VECCHIO,
        async () => null,
      ),
    ).rejects.toThrow(/documento di formato/);
  });

  it("senza dati da nessuna delle due parti si dice il guasto del file incluso", async () => {
    await expect(
      poolDaAprire(
        DOCUMENTO,
        async () => {
          throw new Error("Il file del pool delle carte non si legge.");
        },
        async () => null,
      ),
    ).rejects.toThrow(/non si legge/);
  });
});
