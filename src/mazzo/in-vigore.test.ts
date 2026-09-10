import { describe, expect, it } from "vitest";

import { temaInVigore, tettoInVigore } from "./in-vigore.js";
import { FILTRO_TEMA_VUOTO, type Tema } from "../tema/tema.js";

const copie = (voci: Record<string, number>) => new Map(Object.entries(voci));

const SENZA_NERO: Tema = {
  inclusioni: FILTRO_TEMA_VUOTO,
  seme: null,
  esclusioni: { ...FILTRO_TEMA_VUOTO, colori: ["W", "U", "R", "G"] },
  allargamenti: [],
};

const CONSEGNATO = {
  tetto: 30,
  tema: SENZA_NERO,
  copie: copie({ "Serra Angel": 4, "Swords to Plowshares": 3 }),
};

describe("tettoInVigore", () => {
  it("il mazzo appena consegnato dal motore porta il suo tetto", () => {
    expect(tettoInVigore(CONSEGNATO, copie({ "Serra Angel": 4, "Swords to Plowshares": 3 }))).toBe(
      30,
    );
  });

  it("l'ordine delle carte non è il mazzo: lo stesso mazzo scritto al contrario tiene il tetto", () => {
    expect(tettoInVigore(CONSEGNATO, copie({ "Swords to Plowshares": 3, "Serra Angel": 4 }))).toBe(
      30,
    );
  });

  it("una copia tolta a mano stacca il tetto", () => {
    expect(
      tettoInVigore(CONSEGNATO, copie({ "Serra Angel": 3, "Swords to Plowshares": 3 })),
    ).toBeNull();
  });

  it("una carta aggiunta a mano stacca il tetto", () => {
    expect(
      tettoInVigore(
        CONSEGNATO,
        copie({ "Serra Angel": 4, "Swords to Plowshares": 3, "Black Lotus": 1 }),
      ),
    ).toBeNull();
  });

  it("una carta tolta del tutto stacca il tetto", () => {
    expect(tettoInVigore(CONSEGNATO, copie({ "Serra Angel": 4 }))).toBeNull();
  });

  it("una carta portata a zero copie è una carta che non c'è, non un mazzo diverso", () => {
    // Chi tiene le copie cancella la voce quando arriva a zero, ma un mazzo che
    // arrivasse qui con uno zero scritto direbbe la stessa cosa: nessuna copia.
    expect(
      tettoInVigore(
        { ...CONSEGNATO, copie: copie({ "Serra Angel": 4, "Black Lotus": 0 }) },
        copie({ "Serra Angel": 4 }),
      ),
    ).toBe(30);
  });

  it("la copia tolta e rimessa rende il mazzo quello di prima, tetto compreso", () => {
    // La domanda non è «l'utente ha toccato qualcosa», è «quel che ha in mano è
    // il mazzo che il motore gli ha dato». Se lo è di nuovo, lo è.
    const pentito = copie({ "Serra Angel": 3, "Swords to Plowshares": 3 });
    expect(tettoInVigore(CONSEGNATO, pentito)).toBeNull();
    expect(tettoInVigore(CONSEGNATO, copie({ "Serra Angel": 4, "Swords to Plowshares": 3 }))).toBe(
      30,
    );
  });

  it("un mazzo che nessun motore ha consegnato non ha tetto", () => {
    expect(tettoInVigore(null, copie({ "Serra Angel": 4 }))).toBeNull();
  });

  it("il tetto zero è un tetto, e vale come gli altri", () => {
    // Zero euro è una richiesta legittima — «solo carte senza prezzo» — e
    // leggerlo come «nessun tetto» la tradirebbe in silenzio.
    expect(
      tettoInVigore({ ...CONSEGNATO, tetto: 0, copie: copie({ "Serra Angel": 4 }) }, copie({ "Serra Angel": 4 })),
    ).toBe(0);
  });

  it("un mazzo riaperto senza tetto non ne prende uno dal suo tema", () => {
    // Un mazzo salvato prima del ticket 31, o costruito senza tetto: porta il
    // tema e nessuna cifra, e nessuna cifra deve comparire dal nulla.
    expect(
      tettoInVigore(
        { tetto: null, tema: SENZA_NERO, copie: copie({ "Serra Angel": 4 }) },
        copie({ "Serra Angel": 4 }),
      ),
    ).toBeNull();
  });
});

/**
 * Ticket 31: il tema viaggia col mazzo esattamente come il tetto, e per la
 * stessa ragione — la base di terre si rifà dalle **esclusioni** del tema, e
 * quelle di allora non sono quelle di adesso. Un mazzo riaperto deve ritrovare
 * le sue, e deve smettere di averle nello stesso istante in cui smette di
 * essere quel mazzo.
 */
describe("temaInVigore", () => {
  it("il mazzo che si ha in mano intatto tiene il tema con cui è nato", () => {
    expect(temaInVigore(CONSEGNATO, copie({ "Serra Angel": 4, "Swords to Plowshares": 3 }))).toEqual(
      SENZA_NERO,
    );
  });

  it("una carta cambiata a mano stacca il tema, come stacca il tetto", () => {
    expect(temaInVigore(CONSEGNATO, copie({ "Serra Angel": 3, "Swords to Plowshares": 3 }))).toBeNull();
  });

  it("un mazzo messo insieme a mano non ha nessun tema che ne decida le terre", () => {
    expect(temaInVigore(null, copie({ "Serra Angel": 4 }))).toBeNull();
  });

  it("un mazzo consegnato senza tema — nessun vincolo dichiarato — non ne inventa uno", () => {
    expect(
      temaInVigore(
        { tetto: 30, tema: null, copie: copie({ "Serra Angel": 4 }) },
        copie({ "Serra Angel": 4 }),
      ),
    ).toBeNull();
  });

  it("tema e tetto si staccano insieme: sono lo stesso fatto, non due", () => {
    // Se si staccassero a momenti diversi ci sarebbe uno stato in cui la base
    // è filtrata da metà della richiesta di allora e da metà di quella di
    // adesso — cioè una base che non è mai stata chiesta da nessuno.
    const toccato = copie({ "Serra Angel": 4 });
    expect(tettoInVigore(CONSEGNATO, toccato)).toBeNull();
    expect(temaInVigore(CONSEGNATO, toccato)).toBeNull();
  });
});
