import { describe, expect, it } from "vitest";

import {
  interpretaMazzoSalvato,
  nomePulito,
  nuovoId,
  type MazzoSalvato,
} from "./salvato.js";
import { FILTRO_TEMA_VUOTO, TEMA_VUOTO } from "../tema/tema.js";

/**
 * Ticket 07: un mazzo salvato porta con sé **la richiesta che lo ha generato**,
 * non solo la lista. E quel che si rilegge dal deposito va ri-controllato: fra
 * una sessione e l'altra il browser può aver troncato i dati per recuperare
 * spazio, e un mazzo a metà svuoterebbe la schermata in silenzio.
 */

const SALVATO: MazzoSalvato = {
  id: "abc",
  nome: "Il mazzo dell'amico",
  salvatoIl: "2026-09-03T10:00:00.000Z",
  datiDel: "2026-09-02T09:05:48.145+00:00",
  richiesta: { origine: "a-mano", terreVolute: 22 },
  carte: [
    { nome: "Prima Carta", copie: 4 },
    { nome: "Seconda Carta", copie: 2 },
  ],
};

describe("il mazzo salvato", () => {
  it("si rilegge intero, con la richiesta che l'ha prodotto", () => {
    const letto = interpretaMazzoSalvato(structuredClone(SALVATO));
    expect(letto).toEqual(SALVATO);
  });

  it("accetta un mazzo le cui terre le decide la curva", () => {
    const letto = interpretaMazzoSalvato({
      ...structuredClone(SALVATO),
      richiesta: { origine: "a-mano", terreVolute: null },
    });
    expect(letto.richiesta.terreVolute).toBeNull();
  });

  it("rifiuta a voce alta quel che non è un mazzo salvato", () => {
    expect(() => interpretaMazzoSalvato(null)).toThrow(/mazzo/i);
    expect(() => interpretaMazzoSalvato({ ...SALVATO, id: "" })).toThrow(/mazzo/i);
    expect(() => interpretaMazzoSalvato({ ...SALVATO, nome: "" })).toThrow(/nome/i);
    expect(() => interpretaMazzoSalvato({ ...SALVATO, carte: [] })).toThrow(/carte/i);
    expect(() => interpretaMazzoSalvato({ ...SALVATO, carte: "quattro" })).toThrow(/carte/i);
  });

  it("rifiuta una carta con un numero di copie che non è un numero di copie", () => {
    for (const copie of [0, -1, 2.5, "quattro"]) {
      expect(() =>
        interpretaMazzoSalvato({ ...SALVATO, carte: [{ nome: "Una Carta", copie }] }),
      ).toThrow(/copie/i);
    }
  });

  it("rifiuta una richiesta che non sa dire da dove viene il mazzo", () => {
    expect(() => interpretaMazzoSalvato({ ...SALVATO, richiesta: undefined })).toThrow(
      /richiesta/i,
    );
    expect(() =>
      interpretaMazzoSalvato({ ...SALVATO, richiesta: { origine: "dal-motore" } }),
    ).toThrow(/richiesta/i);
    for (const terreVolute of ["ventidue", 0, -3, 22.5]) {
      expect(() =>
        interpretaMazzoSalvato({ ...SALVATO, richiesta: { origine: "a-mano", terreVolute } }),
      ).toThrow(/terre/i);
    }
  });
});

describe("il nome che sceglie l'utente", () => {
  it("perde gli spazi di troppo, che non si vedono e confondono l'elenco", () => {
    expect(nomePulito("  Draghi   poveri \n")).toBe("Draghi poveri");
  });

  it("non è mai così lungo da rompere l'elenco", () => {
    expect(nomePulito("a".repeat(500)).length).toBeLessThanOrEqual(60);
  });
});

describe("il nome interno di un mazzo", () => {
  it("è diverso a ogni mazzo, così due mazzi non si sovrascrivono", () => {
    const nomi = new Set(Array.from({ length: 50 }, () => nuovoId()));
    expect(nomi.size).toBe(50);
  });
});

describe("il formato che ha prodotto il mazzo", () => {
  const FORMATO = { nome: "Formato di prova", impronta: "una-regola/aaa+bbb" };

  it("si rilegge com'era, così un'app futura sa con che gioco confrontarlo", () => {
    const letto = interpretaMazzoSalvato(structuredClone({ ...SALVATO, formato: FORMATO }));

    expect(letto.formato).toEqual(FORMATO);
  });

  it("manca, senza guasti, nei mazzi salvati prima che l'app lo scrivesse", () => {
    // È la promessa di non distruggere niente alle spalle di chi ha già dei
    // mazzi sul telefono: si aprono, e chi li apre sa che il formato non lo
    // dichiarano.
    expect(interpretaMazzoSalvato(structuredClone(SALVATO)).formato).toBeUndefined();
  });

  it("scritto storto vale assente, e non si porta via il mazzo intero", () => {
    // Una scrittura interrotta, il browser che recupera spazio: il formato è il
    // campo meno importante della scheda, e non deve essere l'unico capace di
    // far sparire un mazzo dall'elenco — chi rilegge il deposito lascia fuori i
    // mazzi che non si leggono, e questo si deve continuare a leggere.
    const storto = interpretaMazzoSalvato({ ...SALVATO, formato: { nome: "Un formato" } });

    expect(storto.formato).toBeUndefined();
    expect(storto.carte).toEqual(SALVATO.carte);
  });
});

describe("il tema e il tetto con cui il mazzo è stato costruito", () => {
  const TEMA = {
    inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Goblin"] },
    seme: null,
    esclusioni: { ...FILTRO_TEMA_VUOTO, colori: ["B"] as const },
    allargamenti: [],
  };

  it("si rileggono com'erano: sono quel che rifà le stesse terre di allora", () => {
    const letto = interpretaMazzoSalvato(
      structuredClone({ ...SALVATO, richiesta: { ...SALVATO.richiesta, tema: TEMA, tetto: 30 } }),
    );

    expect(letto.richiesta.tema).toEqual(TEMA);
    expect(letto.richiesta.tetto).toBe(30);
  });

  it("mancano, senza guasti, nei mazzi salvati prima di questo cambio", () => {
    // La casella del ticket 31: chi ha già dei mazzi sul telefono se li ritrova
    // tutti, e l'assenza di questi due campi non è un guasto — è un mazzo che
    // non dichiara come sono state scelte le sue terre, e si dice a chi lo apre.
    const letto = interpretaMazzoSalvato(structuredClone(SALVATO));

    expect(letto.richiesta.tema).toBeUndefined();
    expect(letto.richiesta.tetto).toBeUndefined();
    expect(letto.carte).toEqual(SALVATO.carte);
  });

  it("scritti storti valgono assenti, e non si portano via il mazzo intero", () => {
    const storto = interpretaMazzoSalvato({
      ...structuredClone(SALVATO),
      richiesta: {
        ...SALVATO.richiesta,
        tema: { esclusioni: { colori: ["Nero"] } },
        tetto: "trenta euro",
      },
    });

    expect(storto.richiesta.tema).toBeUndefined();
    expect(storto.richiesta.tetto).toBeUndefined();
    expect(storto.carte).toEqual(SALVATO.carte);
  });

  it("un tetto che non è una cifra da spendere vale assente", () => {
    for (const tetto of [-5, Number.NaN, "trenta"]) {
      const letto = interpretaMazzoSalvato({
        ...structuredClone(SALVATO),
        richiesta: { ...SALVATO.richiesta, tetto },
      });
      expect(letto.richiesta.tetto).toBeUndefined();
    }
  });

  it("il tetto zero si rilegge come tetto: è «solo carte senza prezzo», non «nessun tetto»", () => {
    const letto = interpretaMazzoSalvato({
      ...structuredClone(SALVATO),
      richiesta: { ...SALVATO.richiesta, tetto: 0 },
    });

    expect(letto.richiesta.tetto).toBe(0);
  });

  it("un tema che non dichiara niente non è un tema, e non si rilegge come tale", () => {
    const letto = interpretaMazzoSalvato({
      ...structuredClone(SALVATO),
      richiesta: { ...SALVATO.richiesta, tema: TEMA_VUOTO },
    });

    expect(letto.richiesta.tema).toBeUndefined();
  });
});
