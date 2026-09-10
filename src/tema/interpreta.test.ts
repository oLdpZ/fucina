import { describe, expect, it } from "vitest";

import { interpretaTema, temaSeSiLegge } from "./interpreta.js";
import { FILTRO_TEMA_VUOTO, type Tema } from "./tema.js";

/**
 * Ticket 31: un mazzo salvato porta il tema con cui è stato costruito, e il
 * tema torna dentro l'app da fuori — dal deposito del dispositivo, o da un
 * testo arrivato da un amico. Quel che rientra va ricontrollato, e un tema
 * riletto male non deve produrre in silenzio una base di terre diversa.
 */

const TEMA: Tema = {
  inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Goblin"], colori: ["R"] },
  seme: "Goblin King",
  esclusioni: { ...FILTRO_TEMA_VUOTO, colori: ["B"] },
  allargamenti: [
    {
      criterio: { tipo: "nomina-il-sottotipo", sottotipo: "Goblin" },
      descrizione: "Le carte che nominano i Goblin: 12 in più.",
      carteAggiunte: 12,
    },
  ],
};

describe("il tema riletto da fuori", () => {
  it("torna esattamente com'era: è la promessa su cui poggiano le terre", () => {
    expect(interpretaTema(structuredClone(TEMA) as unknown)).toEqual(TEMA);
  });

  it("sopravvive al giro per JSON, che è la strada che fa davvero", () => {
    expect(interpretaTema(JSON.parse(JSON.stringify(TEMA)))).toEqual(TEMA);
  });

  it("manca, senza guasti, nei mazzi salvati prima che l'app lo scrivesse", () => {
    expect(interpretaTema(undefined)).toBeUndefined();
    expect(interpretaTema(null)).toBeUndefined();
  });

  it("un tema che non dichiara niente non è un tema", () => {
    // `temaDichiarato` dice che un tema vuoto è l'assenza di tema: riletto,
    // deve valere l'assenza e non un oggetto che non filtra niente.
    expect(interpretaTema({})).toBeUndefined();
    expect(interpretaTema(structuredClone({ ...TEMA, inclusioni: FILTRO_TEMA_VUOTO, seme: null, esclusioni: FILTRO_TEMA_VUOTO }))).toBeUndefined();
  });

  it("regge le voci che mancano, riempiendole di vuoto e non di indovinato", () => {
    const magro = interpretaTema({ esclusioni: { colori: ["G"] } });
    expect(magro).toEqual({
      inclusioni: FILTRO_TEMA_VUOTO,
      seme: null,
      esclusioni: { ...FILTRO_TEMA_VUOTO, colori: ["G"] },
      allargamenti: [],
    });
  });

  it("tiene un tag che il vocabolario di oggi non conosce più", () => {
    // Il vocabolario dei tag si riscrive col pool (PROGETTO.md §7, Q13), e un
    // mazzo salvato dura più a lungo di lui: un tag sparito deve rileggersi
    // come sé stesso e semplicemente non prendere niente, non far cadere il
    // mazzo che lo porta.
    const letto = interpretaTema({ esclusioni: { tag: ["synergy-sparito"] } });
    expect(letto?.esclusioni.tag).toEqual(["synergy-sparito"]);
  });

  it("rifiuta un oggetto della forma sbagliata invece di leggerlo come «nessun tema»", () => {
    // Il guaio che questo chiude: un JSON valido ma di forma sbagliata si
    // lasciava spogliare campo per campo fino a diventare un tema vuoto, cioè
    // «nessun vincolo» — e le terre si rifacevano in silenzio col tema di chi
    // importava. È il guasto del ticket 31, rientrato dalla porta di servizio.
    expect(() => interpretaTema([])).toThrow(/tema/i);
    expect(() => interpretaTema({ esclusioni: ["B"] })).toThrow(/esclusioni/i);
    expect(() => interpretaTema({ inclusioni: [] })).toThrow(/inclusioni/i);
  });

  it("un allargamento «colori-e-tipo» senza colori non diventa «solo le incolori»", () => {
    // `[].every(...)` è vero per una carta senza colori: un criterio a cui
    // manchi l'elenco prenderebbe di soppiatto tutte e sole le incolori, che
    // non è quel che l'utente aveva accettato.
    expect(() =>
      interpretaTema({
        ...structuredClone(TEMA),
        allargamenti: [
          {
            criterio: { tipo: "colori-e-tipo", tipoDiCarta: "Creature" },
            descrizione: "x",
            carteAggiunte: 1,
          },
        ],
      }),
    ).toThrow(/colori/i);
  });

  it("rifiuta a voce alta un tema che non è un tema", () => {
    expect(() => interpretaTema("niente nero")).toThrow(/tema/i);
    expect(() => interpretaTema({ esclusioni: "niente nero" })).toThrow(/tema/i);
    expect(() => interpretaTema({ esclusioni: { colori: "B" } })).toThrow(/colori/i);
    expect(() => interpretaTema({ esclusioni: { colori: ["Nero"] } })).toThrow(/colori/i);
    expect(() => interpretaTema({ esclusioni: { costoMinimo: "due" } })).toThrow(/costo/i);
    expect(() => interpretaTema({ inclusioni: { sottotipi: [""] } })).toThrow(/tema/i);
    expect(() => interpretaTema({ seme: 12 })).toThrow(/seme/i);
    expect(() => interpretaTema({ ...structuredClone(TEMA), allargamenti: "uno" })).toThrow(
      /allargament/i,
    );
    expect(() =>
      interpretaTema({
        ...structuredClone(TEMA),
        allargamenti: [{ criterio: { tipo: "inventato" }, descrizione: "x", carteAggiunte: 1 }],
      }),
    ).toThrow(/allargament/i);
  });
});

describe("il tema riletto dal deposito", () => {
  it("scritto storto vale assente, e non si porta via il mazzo intero", () => {
    // Stessa indulgenza del formato di gioco: nel deposito il mazzo è già
    // dell'utente, e il tema non deve essere il campo capace di farlo sparire
    // dall'elenco senza dirlo a nessuno.
    expect(temaSeSiLegge({ esclusioni: { colori: ["Nero"] } })).toBeUndefined();
    expect(temaSeSiLegge(structuredClone(TEMA) as unknown)).toEqual(TEMA);
  });
});
