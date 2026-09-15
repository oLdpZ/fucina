import { describe, expect, it, vi } from "vitest";

import { POOL_FINTO } from "../catalogo/pool-finto.js";
import {
  TETTO_DEPOSITO,
  aggiornaInSottofondo,
  datiDaAprire,
  piuFresca,
  valutaFormato,
  valutaListino,
  type DatiAperti,
  type LettureDellApertura,
  type TubiDelSottofondo,
} from "./aggiornamento.js";
import type { Formato } from "./formato.js";
import { improntaDelDocumento } from "./impronta-del-documento.js";
import { listinoDelPool, type ListinoScritto } from "./listino.js";
import type { Pool } from "./pool.js";

/**
 * Il ticket 11: l'aggiornamento in sottofondo si restringe. Il pool si congela
 * nell'app, e l'app chiede alla rete due cose sole — il documento di formato e i
 * prezzi. Senza rete resta corretta; un aggiornamento rotto non peggiora quel
 * che ha, e lo dice.
 *
 * Qui si prova la decisione, non il tubo: la rete e il deposito entrano come
 * funzioni, così i casi che contano si provano senza rete e senza aspettare.
 * Il documento è inventato e nomina carte del pool finto: quali carte siano
 * limitate o bandite davvero lo sa solo il documento vero (ADR-0004).
 */

const voce = (carta: string) => ({ carta, perché: "Per prova.", divergenza: null, daConfermare: null });

const FORMATO: Formato = {
  nome: "Formato di prova",
  daConfermare: null,
  aggiornatoIl: "2026-09-07",
  fonte: "Il gruppo del giovedì",
  regolamentoDiRiferimento: "",
  criterio: { regola: "solo-edizioni", descrizione: "Tutto quel che sta lì.", daConfermare: null },
  edizioni: [{ codice: "prova", nome: "Prova", perché: "È l'era.", lingue: ["en"], daConfermare: null }],
  edizioniEscluse: [],
  limitate: { perché: "Troppo forti.", daConfermare: null, carte: [voce("Goblin Chieftain")] },
  bandite: { perché: "La posta.", daConfermare: null, carte: [voce("Lightning Strike")] },
};

/** Lo stesso documento, più fresco, con un bando in più e un nome nuovo. */
const PIU_FRESCO: Formato = {
  ...FORMATO,
  nome: "Il nome deciso al tavolo",
  aggiornatoIl: "2026-10-01",
  bandite: { ...FORMATO.bandite, carte: [...FORMATO.bandite.carte, voce("Skirk Prospector")] },
};

/** Un documento più fresco, ma di un altro gioco: altre edizioni. */
const DI_UN_ALTRO_GIOCO: Formato = {
  ...PIU_FRESCO,
  edizioni: [...FORMATO.edizioni, { ...FORMATO.edizioni[0]!, codice: "altra" }],
};

const POOL: Pool = {
  generatoIl: "2026-09-02T09:05:48.145+00:00",
  improntaDelDocumento: improntaDelDocumento(FORMATO),
  registroTagScryfall: [],
  carte: [...POOL_FINTO],
};

/** Il listino come arriverebbe dalla rete: JSON, con la data scelta. */
function listino(giorno: string, taglia = 0): ListinoScritto {
  const scritto = listinoDelPool(POOL);
  return { ...scritto, generatoIl: giorno, prezzi: scritto.prezzi.slice(taglia) };
}

const FRESCO = "2026-09-15T09:00:00.000+00:00";
const PIU_FRESCO_ANCORA = "2026-09-20T09:00:00.000+00:00";

/** Il documento come arriverebbe dalla rete o dal deposito: JSON. */
const grezzo = (formato: Formato): unknown => JSON.parse(JSON.stringify(formato));

describe("quale data è più fresca", () => {
  it("riconosce una data più recente, anche scritta in un altro modo", () => {
    expect(piuFresca("2026-10-01", "2026-09-07")).toBe(true);
    expect(piuFresca(FRESCO, POOL.generatoIl)).toBe(true);
  });

  it("a parità di data non cambia nulla, e non torna indietro nel tempo", () => {
    expect(piuFresca("2026-09-07", "2026-09-07")).toBe(false);
    expect(piuFresca(POOL.generatoIl, FRESCO)).toBe(false);
  });

  it("una data che non si capisce non vince mai, ma una buona la batte", () => {
    expect(piuFresca("chissà", "2026-09-07")).toBe(false);
    expect(piuFresca("2026-09-07", "chissà")).toBe(true);
  });
});

describe("un documento di formato arrivato dalla rete", () => {
  it("si prende se è più fresco e si applica al pool", () => {
    expect(valutaFormato(grezzo(PIU_FRESCO), FORMATO, POOL)).toEqual({
      tipo: "preso",
      dato: PIU_FRESCO,
    });
  });

  it("non cambia niente se è quello in uso", () => {
    expect(valutaFormato(grezzo(FORMATO), FORMATO, POOL).tipo).toBe("nulla-di-nuovo");
  });

  it("si rifiuta, con la sua ragione, se arriva rotto", () => {
    for (const rotto of [undefined, "<!doctype html>", {}, { ...grezzo(PIU_FRESCO) as object, bandite: 7 }]) {
      const valutato = valutaFormato(rotto, FORMATO, POOL);
      expect(valutato.tipo).toBe("rifiutato");
      expect(valutato).toHaveProperty("motivo", expect.stringMatching(/documento di formato|elenco/));
    }
  });

  it("si rifiuta se nomina una carta che il pool non ha, e la nomina", () => {
    const storto = { ...PIU_FRESCO, bandite: { ...PIU_FRESCO.bandite, carte: [voce("Skirk Prospectr")] } };
    expect(valutaFormato(grezzo(storto), FORMATO, POOL)).toEqual({
      tipo: "rifiutato",
      motivo: expect.stringContaining("Skirk Prospectr"),
    });
  });

  it("si rifiuta se è di un altro gioco: serve un'app aggiornata", () => {
    expect(valutaFormato(grezzo(DI_UN_ALTRO_GIOCO), FORMATO, POOL)).toEqual({
      tipo: "rifiutato",
      motivo: expect.stringContaining("app aggiornata"),
    });
  });

  it("si rifiuta se porta una data che non si legge, invece di vincere per sempre", () => {
    expect(valutaFormato(grezzo({ ...PIU_FRESCO, aggiornatoIl: "autunno" }), FORMATO, POOL).tipo).toBe(
      "rifiutato",
    );
  });
});

describe("un listino arrivato dalla rete", () => {
  it("si prende se è più fresco dei prezzi in uso", () => {
    const valutato = valutaListino(listino(FRESCO), POOL.generatoIl, POOL);
    expect(valutato.tipo).toBe("preso");
  });

  it("non cambia niente se è del giorno dei prezzi in uso", () => {
    expect(valutaListino(listino(POOL.generatoIl), POOL.generatoIl, POOL).tipo).toBe("nulla-di-nuovo");
  });

  it("si confronta coi prezzi in uso, non con quelli del pool", () => {
    expect(valutaListino(listino(FRESCO), PIU_FRESCO_ANCORA, POOL).tipo).toBe("nulla-di-nuovo");
  });

  it("si rifiuta se è incompleto, anche quando è più fresco", () => {
    expect(valutaListino(listino(FRESCO, 3), POOL.generatoIl, POOL)).toEqual({
      tipo: "rifiutato",
      motivo: expect.stringContaining("incompleto"),
    });
  });

  it("si rifiuta se arriva rotto", () => {
    expect(valutaListino("<!doctype html>", POOL.generatoIl, POOL).tipo).toBe("rifiutato");
  });
});

/** Letture finte dell'apertura: quelle vere, su dati inclusi buoni e deposito vuoto. */
function letture(cambi: Partial<LettureDellApertura> = {}): LettureDellApertura & {
  dimenticati: string[];
} {
  const dimenticati: string[] = [];
  return {
    pool: async () => POOL,
    formato: async () => FORMATO,
    formatoConservato: async () => null,
    listinoConservato: async () => null,
    dimenticaFormato: async () => void dimenticati.push("formato"),
    dimenticaListino: async () => void dimenticati.push("listino"),
    sgombera: async () => {},
    ...cambi,
    dimenticati,
  };
}

describe("l'apertura dell'app", () => {
  it("senza niente sul dispositivo apre i dati inclusi, coi prezzi del pool", async () => {
    expect(await datiDaAprire(letture())).toEqual({ pool: POOL, formato: FORMATO, listino: null });
  });

  it("apre il documento conservato, se è più fresco", async () => {
    const aperti = await datiDaAprire(letture({ formatoConservato: async () => grezzo(PIU_FRESCO) }));
    expect(aperti.formato).toEqual(PIU_FRESCO);
  });

  it("dimentica il documento conservato che un'app aggiornata ha superato", async () => {
    const lette = letture({
      formato: async () => PIU_FRESCO,
      formatoConservato: async () => grezzo(FORMATO),
    });
    const aperti = await datiDaAprire(lette);
    expect(aperti.formato).toEqual(PIU_FRESCO);
    expect(lette.dimenticati).toEqual(["formato"]);
  });

  it("dimentica il documento conservato che non si applica più al pool", async () => {
    const lette = letture({ formatoConservato: async () => grezzo(DI_UN_ALTRO_GIOCO) });
    expect((await datiDaAprire(lette)).formato).toEqual(FORMATO);
    expect(lette.dimenticati).toEqual(["formato"]);
  });

  it("se il documento incluso non si legge, apre quello conservato", async () => {
    const aperti = await datiDaAprire(
      letture({
        formato: async () => {
          throw new Error("Il documento di formato non si legge.");
        },
        formatoConservato: async () => grezzo(FORMATO),
      }),
    );
    expect(aperti.formato).toEqual(FORMATO);
  });

  it("se il documento incluso non si legge e non c'è altro, dice il suo guasto", async () => {
    await expect(
      datiDaAprire(
        letture({
          formato: async () => {
            throw new Error("Il documento di formato non si legge.");
          },
        }),
      ),
    ).rejects.toThrow(/documento di formato/);
  });

  it("se il pool incluso non si legge, dice il suo guasto: non c'è un altro pool", async () => {
    await expect(
      datiDaAprire(
        letture({
          pool: async () => {
            throw new Error("Il file del pool delle carte non si legge.");
          },
        }),
      ),
    ).rejects.toThrow(/pool delle carte/);
  });

  it("apre il listino conservato, se è più fresco dei prezzi del pool", async () => {
    const aperti = await datiDaAprire(letture({ listinoConservato: async () => listino(FRESCO) }));
    expect(aperti.listino?.generatoIl).toBe(FRESCO);
  });

  it("dimentica il listino conservato che non è più fresco, o che è incompleto", async () => {
    for (const vecchio of [listino(POOL.generatoIl), listino(FRESCO, 2)]) {
      const lette = letture({ listinoConservato: async () => vecchio });
      expect((await datiDaAprire(lette)).listino).toBeNull();
      expect(lette.dimenticati).toEqual(["listino"]);
    }
  });

  it("un deposito che non risponde mai non impedisce all'app di aprirsi", async () => {
    // Su alcuni browser `indexedDB.open()` resta muto per sempre in contesti
    // ristretti: aspettarlo vorrebbe dire una schermata «Carico le carte…» che
    // non finisce.
    vi.useFakeTimers();
    try {
      const apertura = datiDaAprire(
        letture({
          formatoConservato: () => new Promise(() => {}),
          listinoConservato: () => new Promise(() => {}),
        }),
      );
      await vi.advanceTimersByTimeAsync(TETTO_DEPOSITO + 1);
      await expect(apertura).resolves.toEqual({ pool: POOL, formato: FORMATO, listino: null });
    } finally {
      vi.useRealTimers();
    }
  });

  it("un deposito che si rompe non impedisce all'app di aprirsi", async () => {
    const rotto = async () => {
      throw new Error("deposito negato");
    };
    const aperti = await datiDaAprire(
      letture({ formatoConservato: rotto, listinoConservato: rotto, sgombera: rotto }),
    );
    expect(aperti.formato).toEqual(FORMATO);
  });
});

/** Tubi finti del sottofondo, che ricordano quel che si è conservato. */
function tubi(
  formato: unknown | "non-arriva",
  prezzi: unknown | "non-arriva",
): TubiDelSottofondo & { conservati: string[] } {
  const conservati: string[] = [];
  const arrivo = (dati: unknown) =>
    dati === "non-arriva" ? { arrivato: false as const } : { arrivato: true as const, dati };
  return {
    scaricaFormato: async () => arrivo(formato),
    scaricaListino: async () => arrivo(prezzi),
    conservaFormato: async () => (conservati.push("formato"), true),
    conservaListino: async () => (conservati.push("listino"), true),
    conservati,
  };
}

const IN_USO: DatiAperti = { pool: POOL, formato: FORMATO, listino: null };

describe("l'aggiornamento in sottofondo", () => {
  it("senza rete non cambia niente e non dice niente: l'app è corretta così", async () => {
    const tubo = tubi("non-arriva", "non-arriva");
    expect(await aggiornaInSottofondo(IN_USO, tubo)).toEqual({
      formato: null,
      listino: null,
      rifiuti: [],
    });
    expect(tubo.conservati).toEqual([]);
  });

  it("chiede il documento e i prezzi, e non le carte", async () => {
    // I tubi sono due e nessuno riguarda il pool: è la forma stessa del tipo a
    // dirlo, e qui lo si guarda da fuori.
    const tubo = tubi("non-arriva", "non-arriva");
    expect(Object.keys(tubo).filter((nome) => nome.startsWith("scarica")).sort()).toEqual([
      "scaricaFormato",
      "scaricaListino",
    ]);
  });

  it("prende il documento più fresco, e lo conserva per la prossima apertura", async () => {
    const tubo = tubi(grezzo(PIU_FRESCO), "non-arriva");
    const esito = await aggiornaInSottofondo(IN_USO, tubo);
    expect(esito.formato).toEqual(PIU_FRESCO);
    expect(tubo.conservati).toEqual(["formato"]);
  });

  it("prende i prezzi più freschi, e li conserva", async () => {
    const tubo = tubi("non-arriva", listino(FRESCO));
    const esito = await aggiornaInSottofondo(IN_USO, tubo);
    expect(esito.listino?.generatoIl).toBe(FRESCO);
    expect(tubo.conservati).toEqual(["listino"]);
  });

  it("un aggiornamento rotto non si prende e non si conserva, ma si dice", async () => {
    const tubo = tubi("<!doctype html>", listino(FRESCO, 5));
    const esito = await aggiornaInSottofondo(IN_USO, tubo);
    expect(esito.formato).toBeNull();
    expect(esito.listino).toBeNull();
    expect(esito.rifiuti.map((rifiuto) => rifiuto.cosa)).toEqual(["documento", "listino"]);
    expect(tubo.conservati).toEqual([]);
  });

  it("i prezzi si confrontano con quelli già presi, non con quelli del pool", async () => {
    const giaPresi = await aggiornaInSottofondo(IN_USO, tubi("non-arriva", listino(PIU_FRESCO_ANCORA)));
    const esito = await aggiornaInSottofondo(
      { ...IN_USO, listino: giaPresi.listino },
      tubi("non-arriva", listino(FRESCO)),
    );
    expect(esito.listino).toBeNull();
    expect(esito.rifiuti).toEqual([]);
  });

  it("un tubo che solleva vale un file che non arriva", async () => {
    const esito = await aggiornaInSottofondo(IN_USO, {
      ...tubi("non-arriva", "non-arriva"),
      scaricaFormato: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(esito).toEqual({ formato: null, listino: null, rifiuti: [] });
  });
});
