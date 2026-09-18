import { describe, expect, it } from "vitest";

import { POOL_FINTO, TERRE_FINTE } from "../catalogo/pool-finto.js";
import { COPIE_DI_UNA_LIMITATA } from "../mazzo/copie.js";
import { COPIE_MASSIME } from "../mazzo/taratura.js";
import type { Formato } from "./formato.js";
import { improntaDelDocumento } from "./impronta-del-documento.js";
import { interpretaListino, listinoDelPool, type Listino } from "./listino.js";
import type { Carta, Pool } from "./pool.js";
import { applicaIlFormato, applicaIlListino, poolInVigore } from "./pool-in-vigore.js";

/**
 * Il pool congelato, con sopra il documento di formato e il listino di adesso
 * (ticket 11, ADR-0008). È la promessa della casella che dice «un documento più
 * fresco cambia limitate, bandite e nome del formato senza ricompilare l'app»:
 * da qui si prova che basta cambiare il documento.
 *
 * Il documento è inventato, e nomina carte del pool finto: quali carte siano
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
  prezzoDelleTerreBase: null,
};

/** Una carta che nel testo si concede quante copie vuole. */
const SCIAME: Carta = { ...POOL_FINTO[0]!, nome: "Sciame Inventato", tettoDiCopie: null };

const POOL: Pool = {
  generatoIl: "2026-09-02T09:05:48.145+00:00",
  improntaDelDocumento: improntaDelDocumento(FORMATO),
  registroTagScryfall: [],
  // Le terre base ci sono perché il prezzo dichiarato tocca loro e nessun'altra
  // carta (ticket 83): un pool senza terre base renderebbe quei test verdi
  // senza provare niente.
  carte: [...POOL_FINTO, SCIAME, ...TERRE_FINTE],
};

const nomi = (pool: Pool) => pool.carte.map((carta) => carta.nome);
const carta = (pool: Pool, nome: string) => pool.carte.find((c) => c.nome === nome);

describe("il documento di formato sopra il pool", () => {
  it("toglie dal catalogo le carte che bandisce", () => {
    const inVigore = applicaIlFormato(POOL, FORMATO);
    expect(nomi(inVigore)).not.toContain("Lightning Strike");
    expect(inVigore.carte).toHaveLength(POOL.carte.length - 1);
  });

  it("mette a una copia le carte che limita", () => {
    expect(carta(applicaIlFormato(POOL, FORMATO), "Goblin Chieftain")?.tettoDiCopie).toBe(
      COPIE_DI_UNA_LIMITATA,
    );
  });

  it("lascia le altre col tetto del gioco", () => {
    expect(carta(applicaIlFormato(POOL, FORMATO), "Skirk Prospector")?.tettoDiCopie).toBe(
      COPIE_MASSIME,
    );
  });

  it("un documento più fresco cambia le liste senza toccare il pool", () => {
    // Il cuore del ticket: il gruppo sbandisce una carta e ne limita un'altra,
    // il manutentore cambia due righe, e l'app le applica.
    const piuFresco: Formato = {
      ...FORMATO,
      aggiornatoIl: "2026-10-01",
      limitate: { ...FORMATO.limitate, carte: [voce("Skirk Prospector")] },
      bandite: { ...FORMATO.bandite, carte: [] },
    };
    const inVigore = applicaIlFormato(POOL, piuFresco);

    expect(nomi(inVigore)).toContain("Lightning Strike");
    expect(carta(inVigore, "Skirk Prospector")?.tettoDiCopie).toBe(COPIE_DI_UNA_LIMITATA);
    expect(carta(inVigore, "Goblin Chieftain")?.tettoDiCopie).toBe(COPIE_MASSIME);
  });

  it("la limitata resta a una copia anche se il testo si concede il permesso", () => {
    // Il formato ha l'ultima parola: fra «il gioco dice quante ne vuoi» e «il
    // gruppo dice una», al tavolo del venerdì vince il gruppo.
    const conLoSciame: Formato = {
      ...FORMATO,
      limitate: { ...FORMATO.limitate, carte: [voce("Sciame Inventato")] },
    };
    expect(carta(applicaIlFormato(POOL, conLoSciame), "Sciame Inventato")?.tettoDiCopie).toBe(
      COPIE_DI_UNA_LIMITATA,
    );
  });

  it("non tocca il pool che riceve", () => {
    const prima = JSON.stringify(POOL);
    applicaIlFormato(POOL, FORMATO);
    expect(JSON.stringify(POOL)).toBe(prima);
  });

  it("rifiuta il documento che nomina una carta che il pool non ha, e la nomina", () => {
    const storto: Formato = {
      ...FORMATO,
      bandite: { ...FORMATO.bandite, carte: [voce("Lightning Strik")] },
    };
    expect(() => applicaIlFormato(POOL, storto)).toThrow(/Lightning Strik/);
  });

  it("rifiuta il documento di un altro criterio o di altre edizioni: serve un'app nuova", () => {
    const altreEdizioni: Formato = {
      ...FORMATO,
      edizioni: [...FORMATO.edizioni, { ...FORMATO.edizioni[0]!, codice: "altra" }],
    };
    expect(() => applicaIlFormato(POOL, altreEdizioni)).toThrow(/app aggiornata/);
  });
});

describe("il listino sopra il pool", () => {
  /** Lo stesso listino del pool, con un prezzo cambiato e una data nuova. */
  function listinoDel(giorno: string, cambia: (euro: number | null) => number | null): Listino {
    const scritto = listinoDelPool(POOL);
    return interpretaListino({
      ...scritto,
      generatoIl: giorno,
      prezzi: scritto.prezzi.map((voce) =>
        voce.euro === null ? voce : { ...voce, euro: cambia(voce.euro) },
      ),
    });
  }

  it("dà a ogni carta il prezzo del listino, con la data del listino", () => {
    const listino = listinoDel("2026-09-15T09:00:00.000+00:00", (euro) => (euro ?? 0) * 2);
    const inVigore = applicaIlListino(POOL, listino);

    const goblin = carta(inVigore, "Goblin Chieftain")!;
    expect(goblin.prezzo.euro).toBe((carta(POOL, "Goblin Chieftain")!.prezzo.euro ?? 0) * 2);
    expect(goblin.prezzo.aggiornatoIl).toBe("2026-09-15T09:00:00.000+00:00");
  });

  it("rifiuta il listino incompleto, e dice quante carte mancano", () => {
    const scritto = listinoDelPool(POOL);
    const incompleto = interpretaListino({ ...scritto, prezzi: scritto.prezzi.slice(2) });
    expect(() => applicaIlListino(POOL, incompleto)).toThrow(/incompleto.*2 carte/);
  });

  it("rifiuta il listino di un altro criterio", () => {
    const scritto = listinoDelPool(POOL);
    const altro = interpretaListino({ ...scritto, improntaDelDocumento: "un-altro-gioco" });
    expect(() => applicaIlListino(POOL, altro)).toThrow(/criterio/);
  });

  it("ignora il prezzo di una carta che il pool non ha", () => {
    const scritto = listinoDelPool(POOL);
    const conUnaInPiu = interpretaListino({
      ...scritto,
      prezzi: [...scritto.prezzi, { nome: "Carta Che Non C'è", euro: 1, stampa: scritto.prezzi[0]!.stampa }],
    });
    expect(nomi(applicaIlListino(POOL, conUnaInPiu))).toEqual(nomi(POOL));
  });
});

describe("il pool in vigore", () => {
  it("si fa col listino prima del bando: un listino giusto non sembra incompleto per via di una bandita", () => {
    const listino = interpretaListino(listinoDelPool(POOL));
    expect(() => poolInVigore(POOL, FORMATO, listino)).not.toThrow();
    expect(nomi(poolInVigore(POOL, FORMATO, listino))).not.toContain("Lightning Strike");
  });

  it("senza listino tiene i prezzi del pool", () => {
    expect(carta(poolInVigore(POOL, FORMATO, null), "Goblin Chieftain")?.prezzo).toEqual(
      carta(POOL, "Goblin Chieftain")?.prezzo,
    );
  });
});

/**
 * Ticket 83: il prezzo che il gruppo dichiara per le terre base, applicato
 * sopra il pool come le limitate e le bandite.
 *
 * Il guasto da cui nasce: quattro terre base su cinque, nelle edizioni ammesse
 * dal 2026-09-17, non hanno nessun prezzo in euro — e col tetto di spesa acceso
 * l'app non mette in mazzo quel che non sa contare.
 */
describe("il prezzo dichiarato delle terre base sopra il pool", () => {
  const CON_PREZZO: Formato = {
    ...FORMATO,
    prezzoDelleTerreBase: {
      euro: 0,
      perché: "Al tavolo non le compra nessuno.",
      daConfermare: null,
    },
  };

  /** Le terre base del pool finto, che sono quelle con «Basic» fra i tipi. */
  const terreBase = (pool: Pool): Carta[] => pool.carte.filter((c) => c.tipi.includes("Basic"));

  it("dà a ogni terra base la cifra dichiarata, anche a quelle che un listino non ce l'hanno", () => {
    const senzaPrezzo: Pool = {
      ...POOL,
      carte: POOL.carte.map((c) =>
        c.tipi.includes("Basic") ? { ...c, prezzo: { ...c.prezzo, euro: null, stampa: null } } : c,
      ),
    };

    const inVigore = poolInVigore(senzaPrezzo, CON_PREZZO, null);

    expect(terreBase(inVigore).length).toBeGreaterThan(0);
    for (const terra of terreBase(inVigore)) expect(terra.prezzo.euro).toBe(0);
  });

  it("le tratta tutte allo stesso modo: una terra base col listino non resta più cara delle altre", () => {
    // È la ragione per cui il prezzo dichiarato vince sul listino. Nel pool vero
    // una sola terra base ha un prezzo in euro, e lasciarglielo vorrebbe dire
    // una base di terre in cui un colore costa e gli altri quattro no.
    const inVigore = poolInVigore(POOL, CON_PREZZO, null);

    for (const terra of terreBase(inVigore)) expect(terra.prezzo.euro).toBe(0);
  });

  it("non tocca nessuna carta che non sia una terra base", () => {
    const prima = POOL.carte.filter((c) => !c.tipi.includes("Basic"));
    const dopo = poolInVigore(POOL, CON_PREZZO, null).carte.filter(
      (c) => !c.tipi.includes("Basic"),
    );

    expect(dopo.map((c) => c.prezzo.euro)).toEqual(
      prima.filter((c) => !FORMATO.bandite.carte.some((v) => v.carta === c.nome)).map((c) => c.prezzo.euro),
    );
  });

  it("un documento che non lo dichiara lascia i prezzi come stanno", () => {
    const inVigore = poolInVigore(POOL, FORMATO, null);
    const prima = POOL.carte.filter((c) => c.tipi.includes("Basic")).map((c) => c.prezzo.euro);

    expect(terreBase(inVigore).map((c) => c.prezzo.euro)).toEqual(prima);
  });

  it("la cifra dichiarata non porta con sé nessuna stampa: non c'è una copia da cercare", () => {
    const inVigore = poolInVigore(POOL, CON_PREZZO, null);

    for (const terra of terreBase(inVigore)) expect(terra.prezzo.stampa).toBeNull();
  });
});

