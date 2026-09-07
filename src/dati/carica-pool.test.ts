import { describe, expect, it } from "vitest";

import { COPIE_MASSIME } from "../mazzo/taratura.js";
import { dataInItaliano, interpretaPool } from "./carica-pool.js";

/**
 * Storia 17: l'utente vede la data dei dati che sta guardando. La data viene
 * **dal pool**, mai dall'orologio del telefono — un'app aperta senza rete al
 * negozio deve dire di quando sono i suoi prezzi, non che ore sono.
 *
 * E il pool arriva da un file su disco: se quel file è rotto o vecchio, l'app
 * deve dirlo con parole, non mostrare una lista vuota senza spiegazioni.
 */

const POOL_VALIDO = {
  generatoIl: "2026-09-02T09:05:48.145+00:00",
  carte: [{ nome: "Goblin Chieftain" }],
};

describe("lettura del pool", () => {
  it("accetta un pool con la sua data e le sue carte", () => {
    const pool = interpretaPool(POOL_VALIDO);
    expect(pool.generatoIl).toBe("2026-09-02T09:05:48.145+00:00");
    expect(pool.carte).toHaveLength(1);
  });

  it("legge il registro dei tag di Scryfall quando c'è", () => {
    const pool = interpretaPool({
      ...POOL_VALIDO,
      registroTagScryfall: [{ id: "9f2c", nome: "counterspell" }],
    });

    expect(pool.registroTagScryfall).toEqual([{ id: "9f2c", nome: "counterspell" }]);
  });

  it("non cade su un pool che il registro dei tag non ce l'ha", () => {
    // I pool scritti prima di ADR-0003 non l'hanno, e nemmeno ce l'avrebbe uno
    // scaricato da una versione più vecchia dell'app: l'assenza è uno stato.
    expect(interpretaPool(POOL_VALIDO).registroTagScryfall).toEqual([]);
    expect(interpretaPool({ ...POOL_VALIDO, registroTagScryfall: "molti" }).registroTagScryfall).toEqual([]);
  });

  it("dà un elenco di tag anche alle carte di un pool scritto prima che i tag esistessero", () => {
    // Un pool vecchio non ha né il registro né il campo sulle carte. Chi legge
    // il pool non deve doverlo sapere: `carta.tagScryfall.length` è la forma
    // ovvia in cui lo si leggerà, e su `undefined` non cadrebbe, cadrebbe male.
    const pool = interpretaPool({
      generatoIl: "2026-09-02T09:05:48.145+00:00",
      carte: [{ nome: "Goblin Chieftain" }, { nome: "Negate" }],
    });

    expect(pool.carte.map((c) => c.tagScryfall)).toEqual([[], []]);
  });

  it("guarda il tetto carta per carta, e non solo sulla prima", () => {
    // Un pool a cui il campo manca **in mezzo** passerebbe intero se lo si
    // decidesse dalla prima carta, e quelle carte resterebbero senza tetto —
    // che `copieMassime` legge come «nessun tetto», cioè sessanta copie.
    const pool = interpretaPool({
      generatoIl: "2026-09-02T09:05:48.145+00:00",
      carte: [
        { nome: "Goblin Chieftain", testo: "", tipi: ["Creature"], tettoDiCopie: COPIE_MASSIME },
        { nome: "Negate", testo: "", tipi: ["Instant"] },
      ],
    });

    expect(pool.carte.map((c) => c.tettoDiCopie)).toEqual([COPIE_MASSIME, COPIE_MASSIME]);
  });

  it("dà un tetto di copie alle carte di un pool scritto prima che fosse un dato", () => {
    // Un pool conservato sul dispositivo da una versione precedente dell'app
    // non ha il campo, e all'apertura vince su quello incluso se è più fresco
    // (`aggiornamento.ts`). Senza rattoppo un tetto assente varrebbe «nessun
    // tetto», e il mazzo uscirebbe con sessanta copie della stessa carta.
    const pool = interpretaPool({
      generatoIl: "2026-09-02T09:05:48.145+00:00",
      carte: [
        { nome: "Goblin Chieftain", testo: "Haste.", tipi: ["Creature"] },
        { nome: "Plains", testo: "({T}: Add {W}.)", tipi: ["Basic", "Land"] },
        {
          nome: "Hare Apparent",
          testo: "A deck can have any number of cards named Hare Apparent.",
          tipi: ["Creature"],
        },
      ],
    });

    expect(pool.carte.map((c) => c.tettoDiCopie)).toEqual([COPIE_MASSIME, null, null]);
  });

  it("dice «non lo so» invece di lasciare vuoti i campi che un pool vecchio non ha", () => {
    // Un pool scritto prima che il formato cambiasse non sa da quale stampa
    // venisse una carta, e quel che si sa non lo sa più nessuno: la risposta
    // onesta è la stringa vuota, che si mostra come niente, e non `undefined`,
    // che a chi legge il tipo sembra una stampa che c'è.
    const pool = interpretaPool({
      generatoIl: "2026-09-03T09:05:32.000+00:00",
      registroTagScryfall: [],
      carte: [{ nome: "Negate", tagScryfall: [], tettoDiCopie: 4 }],
    });

    expect(pool.carte[0]?.edizione).toBe("");
    expect(pool.carte[0]?.numeroDiCollezione).toBe("");
    expect(pool.carte[0]?.linguaDellaStampa).toBe("");
    expect(pool.carte[0]?.nomeItaliano).toBeNull();
  });

  it("non dichiara riservata una carta di un pool che la Reserved List non la sapeva", () => {
    // La Reserved List è nata col tetto di spesa, cioè dopo. Un pool che non la
    // porta deve far tacere l'app su quel punto, non farle dire che ogni carta
    // sarà ristampata o che nessuna lo sarà: `false` è il silenzio, perché è la
    // condizione in cui l'app non aggiunge la frase.
    const pool = interpretaPool({
      generatoIl: "2026-09-03T09:05:32.000+00:00",
      registroTagScryfall: [],
      carte: [{ nome: "Negate", tagScryfall: [], tettoDiCopie: 4 }],
    });

    expect(pool.carte[0]?.riservata).toBe(false);
  });

  it("rattoppa anche il pool che ha una metà dei campi nuovi e non l'altra", () => {
    // I campi nuovi non sono arrivati tutti insieme, e non arriveranno tutti
    // insieme la prossima volta: la scorciatoia che salta il rattoppo va chiesta
    // a **tutti** i campi che il rattoppo scrive, o ne lascia passare uno a
    // `undefined`. Un `nomeItaliano` a `undefined` non è un campo vuoto in una
    // scheda: la ricerca per nome lo legge a ogni battuta, e il catalogo
    // morirebbe alla prima lettera scritta.
    const pool = interpretaPool({
      generatoIl: "2026-09-03T09:05:32.000+00:00",
      registroTagScryfall: [{ id: "9f2c", nome: "counterspell" }],
      carte: [
        {
          nome: "Negate",
          edizione: "xa",
          numeroDiCollezione: "7",
          linguaDellaStampa: "en",
          tagScryfall: ["counterspell"],
          tettoDiCopie: 1,
        },
      ],
    });

    expect(pool.carte[0]?.nomeItaliano).toBeNull();
  });

  it("non rimette mano alle carte di un pool che ha già tutto", () => {
    const carte = [
      {
        nome: "Negate",
        nomeItaliano: null,
        edizione: "xa",
        numeroDiCollezione: "7",
        linguaDellaStampa: "en",
        riservata: false,
        prezzo: {
          euro: 0.1,
          aggiornatoIl: "2026-09-03T09:05:32.000+00:00",
          stampa: { edizione: "xa", numeroDiCollezione: "7", lingua: "en" },
        },
        tagScryfall: ["counterspell"],
        tettoDiCopie: 1,
      },
    ];
    const pool = interpretaPool({
      generatoIl: "2026-09-03T09:05:32.000+00:00",
      registroTagScryfall: [{ id: "9f2c", nome: "counterspell" }],
      carte,
    });

    expect(pool.carte[0]?.tagScryfall).toEqual(["counterspell"]);
    // Il tetto scritto nel pool resta quello: è il pool a dire quante copie
    // stanno in un mazzo, e un uno vale quanto un quattro.
    expect(pool.carte[0]?.tettoDiCopie).toBe(1);
    expect(pool.carte[0]).toBe(carte[0]);
  });

  it("dice da quale stampa è il prezzo di un pool che il prezzo lo legava alla stampa mostrata", () => {
    // Prima che il prezzo si staccasse, l'invariante era «il prezzo è di quella
    // stampa e di nessun'altra»: qui non si inventa niente, si scrive quel che
    // quel pool diceva. Un pool più fresco di quello incluso resta nel deposito
    // del dispositivo e vince all'apertura, anche dopo un aggiornamento
    // dell'app: succede per davvero.
    const pool = interpretaPool({
      generatoIl: "2026-09-03T09:05:32.000+00:00",
      registroTagScryfall: [],
      carte: [
        {
          nome: "Negate",
          nomeItaliano: null,
          edizione: "xa",
          numeroDiCollezione: "7",
          linguaDellaStampa: "en",
          riservata: false,
          prezzo: { euro: 0.1, aggiornatoIl: "2026-09-03T09:05:32.000+00:00" },
          tagScryfall: [],
          tettoDiCopie: 4,
        },
      ],
    });

    expect(pool.carte[0]?.prezzo.stampa).toEqual({
      edizione: "xa",
      numeroDiCollezione: "7",
      lingua: "en",
    });
  });

  it("non attacca una provenienza a un prezzo che quel pool non aveva", () => {
    // Euro e provenienza vanno a coppia: dire di quale copia è un prezzo che
    // nessuno ha sarebbe una mezza verità, e la carta senza listino ne
    // uscirebbe con l'aria di averne uno.
    const pool = interpretaPool({
      generatoIl: "2026-09-03T09:05:32.000+00:00",
      registroTagScryfall: [],
      carte: [
        {
          nome: "Negate",
          edizione: "xa",
          numeroDiCollezione: "7",
          linguaDellaStampa: "en",
          prezzo: { euro: null, aggiornatoIl: "2026-09-03T09:05:32.000+00:00" },
          tagScryfall: [],
          tettoDiCopie: 4,
        },
      ],
    });

    expect(pool.carte[0]?.prezzo.stampa).toBeNull();
  });

  it("rifiuta a voce alta un file che non è un pool", () => {
    expect(() => interpretaPool(null)).toThrow(/pool/i);
    expect(() => interpretaPool({ carte: [] })).toThrow(/data/i);
    expect(() => interpretaPool({ generatoIl: "2026-09-02", carte: "molte" })).toThrow(/carte/i);
  });

  it("rifiuta un pool senza carte: sarebbe un'app muta senza dire perché", () => {
    expect(() => interpretaPool({ generatoIl: "2026-09-02", carte: [] })).toThrow(/vuoto/i);
  });
});

describe("la data dei dati", () => {
  it("si legge in italiano, come si direbbe a voce", () => {
    expect(dataInItaliano("2026-09-02T09:05:48.145+00:00")).toBe("2 settembre 2026");
    expect(dataInItaliano("2026-12-25T23:30:00.000+00:00")).toBe("25 dicembre 2026");
  });

  it("non cambia giorno col fuso di chi guarda", () => {
    // Mezzanotte e mezza a Greenwich resta il 2 settembre anche a New York.
    expect(dataInItaliano("2026-09-02T00:30:00.000+00:00")).toBe("2 settembre 2026");
  });

  it("una data che non si capisce non fa cadere l'app", () => {
    expect(dataInItaliano("chissà")).toBe("data sconosciuta");
  });
});
