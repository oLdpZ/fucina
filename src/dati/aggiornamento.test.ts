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

/** Un pool datato, con carte vere del pool finto: la data è l'unica cosa in gioco. */
function poolDel(giorno: string): Pool {
  return { generatoIl: giorno, registroTagScryfall: [], carte: [...POOL_FINTO] };
}

const VECCHIO = poolDel("2026-08-01T00:00:00.000+00:00");
const NUOVO = poolDel("2026-09-02T09:05:48.145+00:00");

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
    expect(scegliPool(VECCHIO, null)).toEqual({ pool: VECCHIO, dimentica: false });
  });

  it("i dati scaricati la volta scorsa vincono, se sono più freschi", () => {
    expect(scegliPool(VECCHIO, NUOVO)).toEqual({ pool: NUOVO, dimentica: false });
  });

  it("un'app aggiornata rende inutili i dati conservati, e li dimentica", () => {
    // Capita davvero: l'utente reinstalla l'app dopo un aggiornamento del pool.
    // Tenersi la copia vecchia sarebbe occupare spazio per niente.
    expect(scegliPool(NUOVO, VECCHIO)).toEqual({ pool: NUOVO, dimentica: true });
  });

  it("se i dati inclusi non si leggono, si aprono quelli sul dispositivo", () => {
    // Il file del pacchetto può mancare o essere arrivato a metà. Se sul
    // dispositivo c'è una copia buona, buttarla via per mostrare una schermata
    // di guasto sarebbe perdere dati che l'app aveva (ticket 05).
    expect(scegliPool(null, NUOVO)).toEqual({ pool: NUOVO, dimentica: false });
  });

  it("senza nulla da nessuna delle due parti non si inventa un pool", () => {
    expect(scegliPool(null, null)).toEqual({ pool: null, dimentica: false });
  });

  it("a parità di data si preferiscono i dati inclusi e si libera lo spazio", () => {
    expect(scegliPool(NUOVO, poolDel(NUOVO.generatoIl))).toEqual({
      pool: NUOVO,
      dimentica: true,
    });
  });
});

describe("il controllo di freschezza", () => {
  it("prende i dati più freschi quando ci sono", async () => {
    const esito = await cercaAggiornamento(VECCHIO, async () => NUOVO);
    expect(esito).toEqual({ tipo: "preso", pool: NUOVO });
  });

  it("non fa nulla quando in rete non c'è niente di più nuovo", async () => {
    const esito = await cercaAggiornamento(NUOVO, async () => VECCHIO);
    expect(esito.tipo).toBe("nulla-di-nuovo");
  });

  it("senza rete l'app resta intera: si dice che non è riuscito, e basta", async () => {
    const esito = await cercaAggiornamento(NUOVO, async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(esito.tipo).toBe("non-riuscito");
    expect(esito).toHaveProperty("motivo");
  });

  it("una risposta malformata non fa cadere niente né sostituisce i dati buoni", async () => {
    for (const spazzatura of [null, "<!doctype html>", { carte: [] }, { generatoIl: 1 }]) {
      const esito = await cercaAggiornamento(NUOVO, async () => spazzatura);
      expect(esito.tipo).toBe("non-riuscito");
    }
  });

  it("un pool arrivato vuoto non svuota il catalogo", async () => {
    const esito = await cercaAggiornamento(NUOVO, async () => ({
      generatoIl: "2027-01-01T00:00:00.000+00:00",
      carte: [],
    }));
    expect(esito.tipo).toBe("non-riuscito");
  });
});

describe("l'apertura dell'app", () => {
  it("parte dai dati sul dispositivo quando sono i più freschi", async () => {
    const aperto = await poolDaAprire(
      async () => VECCHIO,
      async () => NUOVO,
    );
    expect(aperto.generatoIl).toBe(NUOVO.generatoIl);
  });

  it("un deposito che non risponde mai non impedisce all'app di aprirsi", async () => {
    // Non è un caso di scuola: su alcuni browser `indexedDB.open()` resta muto
    // per sempre in contesti ristretti. Aspettarlo vorrebbe dire una schermata
    // «Carico le carte…» che non finisce, con i dati inclusi già pronti a un
    // passo di distanza.
    vi.useFakeTimers();
    try {
      const apertura = poolDaAprire(
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
      async () => VECCHIO,
      async () => {
        throw new Error("deposito negato");
      },
    );
    expect(aperto).toEqual(VECCHIO);
  });

  it("senza dati da nessuna delle due parti si dice il guasto del file incluso", async () => {
    await expect(
      poolDaAprire(
        async () => {
          throw new Error("Il file del pool delle carte non si legge.");
        },
        async () => null,
      ),
    ).rejects.toThrow(/non si legge/);
  });
});
