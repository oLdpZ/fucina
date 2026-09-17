/**
 * Le spiegazioni, verificate **dalla loro cucitura**:
 * `spiegaFrontiera(frontiera, tema, pool)`.
 *
 * Quel che si prova è la promessa del ticket 13, e non il testo delle frasi:
 * che esista una spiegazione per ogni carta e per il suo numero di copie, per
 * le carte del tema rimaste fuori, per la base di terre e per il passo che
 * separa un mazzo della frontiera dal precedente; che **ogni frase porti un
 * numero**; e che quel numero sia lo stesso che il punteggio ha calcolato — non
 * un numero rifatto qui, che potrebbe divergere senza che nessuno se ne accorga.
 *
 * Le frasi si guardano solo per il numero che contengono: asserire il testo
 * intero vorrebbe dire riscrivere `frasi.ts` dentro il test, e ogni virgola
 * spostata romperebbe una suite che del testo non deve occuparsi.
 */

import { describe, expect, it } from "vitest";

import { POOL_DEL_MOTORE, TERRE_FINTE } from "../catalogo/pool-finto.js";
import { COMBO_VUOTA } from "../combo/combo.js";
import type { Carta } from "../dati/pool.js";
import {
  costruisciMazzo,
  type Frontiera,
  type Opzioni,
  type Richiesta,
} from "../ricerca/costruisci.js";
import { appartiene, FILTRO_TEMA_VUOTO, risolviTema, TEMA_VUOTO, type Tema } from "../tema/tema.js";
import { percento, percentoDiUnaParte } from "./frasi.js";
import { spiegaFrontiera, spiegaMazzo, type SpiegazioniDelMazzo } from "./spiegazioni.js";

const POOL: readonly Carta[] = [...POOL_DEL_MOTORE, ...TERRE_FINTE];

/** Le stesse manopole stringate della suite della ricerca: qui non si misura. */
const SVELTA: Opzioni = {
  orologio: () => 0,
  taratura: {
    partenze: 2,
    partiteInRicerca: 12,
    valutazioniMassimePerPartenza: 60,
    candidatiMassimi: 40,
  },
};

function tema(parti: Partial<Tema>): Tema {
  return { ...TEMA_VUOTO, ...parti };
}

const GOBLIN = tema({ inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Goblin"] } });

function richiesta(parti: Partial<Richiesta> = {}): Richiesta {
  return {
    tema: GOBLIN,
    combo: COMBO_VUOTA,
    seme: 7,
    tempoMassimoMs: 10_000,
    tettoDiSpesa: null,
    ...parti,
  };
}

const FRONTIERA: Frontiera = costruisciMazzo(richiesta(), POOL, SVELTA);
const SPIEGATE: SpiegazioniDelMazzo[] = spiegaFrontiera(FRONTIERA, GOBLIN, POOL);

/** Tutte le frasi di un mazzo, in un elenco solo: è così che si controllano. */
function frasi(spiegazioni: SpiegazioniDelMazzo): string[] {
  return [
    ...spiegazioni.carte.flatMap((carta) => [carta.perche.frase, carta.quante.frase]),
    ...spiegazioni.esclusioni.map((esclusione) => esclusione.frase),
    spiegazioni.terre.frase,
    ...(spiegazioni.passo === null ? [] : [spiegazioni.passo.frase]),
    ...(spiegazioni.combo === null ? [] : [spiegazioni.combo.frase]),
    spiegazioni.archetipo.frase,
  ];
}


describe("le spiegazioni della frontiera", () => {
  it("ne dà una per ogni mazzo della frontiera", () => {
    expect(FRONTIERA.mazzi.length).toBeGreaterThan(0);
    expect(SPIEGATE).toHaveLength(FRONTIERA.mazzi.length);
  });

  it("non dice niente quando non c'è niente da costruire", () => {
    const vuota = costruisciMazzo(richiesta({ tema: TEMA_VUOTO }), POOL, SVELTA);
    expect(vuota.mazzi).toHaveLength(0);
    expect(spiegaFrontiera(vuota, TEMA_VUOTO, POOL)).toEqual([]);
  });

  it("dà la stessa risposta due volte di fila", () => {
    const altra = spiegaFrontiera(FRONTIERA, GOBLIN, POOL);
    expect(JSON.stringify(altra)).toBe(JSON.stringify(SPIEGATE));
  });

  it("non scrive nessuna frase senza un numero dentro", () => {
    for (const spiegazioni of SPIEGATE) {
      for (const frase of frasi(spiegazioni)) {
        expect(frase, frase).toMatch(/\d/);
      }
    }
  });

  it("scrive frasi intere, che cominciano e finiscono", () => {
    for (const spiegazioni of SPIEGATE) {
      for (const frase of frasi(spiegazioni)) {
        expect(frase.trim(), frase).toBe(frase);
        expect(frase, frase).toMatch(/[.!]$/);
        expect(frase.length, frase).toBeGreaterThan(20);
      }
    }
  });
});

describe("la spiegazione di ogni carta", () => {
  it("copre tutte le carte non-terra del mazzo, nell'ordine del mazzo", () => {
    for (const [indice, spiegazioni] of SPIEGATE.entries()) {
      const mazzo = FRONTIERA.mazzi[indice]!;
      expect(spiegazioni.carte.map((carta) => carta.nome)).toEqual(
        mazzo.carte.map((voce) => voce.carta.nome),
      );
    }
  });

  it("dice quante copie, e il numero è quello del mazzo", () => {
    const mazzo = FRONTIERA.mazzi[0]!;
    for (const [indice, carta] of SPIEGATE[0]!.carte.entries()) {
      const voce = mazzo.carte[indice]!;
      expect(carta.copie).toBe(voce.copie);
      expect(carta.quante.grezzi.copie).toBe(voce.copie);
      expect(carta.quante.frase).toContain(String(voce.copie));
    }
  });

  it("cita la probabilità che il punteggio ha calcolato, non una rifatta qui", () => {
    for (const [indice, spiegazioni] of SPIEGATE.entries()) {
      const mazzo = FRONTIERA.mazzi[indice]!;
      for (const carta of spiegazioni.carte) {
        const riga = mazzo.punteggio.colori.grezzi.perCarta.find((r) => r.nome === carta.nome);
        expect(riga, carta.nome).toBeDefined();
        expect(carta.quante.grezzi.probabilitaDiMana).toBe(riga!.probabilita);
        expect(carta.quante.grezzi.turno).toBe(riga!.turno);
        // Con la stessa funzione della frase, non con una copia: una copia tonda
        // si smentirebbe al primo mazzo con una quota vicino al tutto (ticket 49).
        expect(carta.quante.frase).toContain(percentoDiUnaParte(riga!.probabilita));
      }
    }
  });

  it("lega le copie alla probabilità di pescarla, che è il numero che dalle copie dipende", () => {
    // Più copie, più spesso te ne capita una: è la ragione per cui l'app ne
    // mette quattro invece di due, ed è il numero che la frase deve dire.
    const mazzo = FRONTIERA.mazzi[0]!;
    for (const carta of SPIEGATE[0]!.carte) {
      const grezzi = carta.quante.grezzi;
      expect(grezzi.probabilitaDiPescarla).toBeGreaterThan(0);
      expect(grezzi.probabilitaDiPescarla).toBeLessThanOrEqual(1);
      expect(carta.quante.frase).toContain(percentoDiUnaParte(grezzi.probabilitaDiPescarla));
      expect(grezzi.dimensioneMazzo).toBe(mazzo.base.dimensioneMazzo);
    }

    const quattro = SPIEGATE[0]!.carte.filter((carta) => carta.copie === 4);
    const meno = SPIEGATE[0]!.carte.filter((carta) => carta.copie < 4);
    for (const tante of quattro) {
      for (const poche of meno) {
        if (tante.quante.grezzi.turno !== poche.quante.grezzi.turno) continue;
        expect(tante.quante.grezzi.probabilitaDiPescarla).toBeGreaterThan(
          poche.quante.grezzi.probabilitaDiPescarla,
        );
      }
    }
  });

  it("dice se la carta è del tema, e il conto torna con la purezza", () => {
    const mazzo = FRONTIERA.mazzi[0]!;
    const risolto = risolviTema(GOBLIN, POOL);
    for (const [indice, carta] of SPIEGATE[0]!.carte.entries()) {
      const voce = mazzo.carte[indice]!;
      expect(carta.perche.grezzi.nelTema).toBe(appartiene(voce.carta, risolto));
    }
    const grezzi = SPIEGATE[0]!.carte[0]!.perche.grezzi;
    expect(grezzi.copieNelTema / grezzi.copieNonTerra).toBeCloseTo(mazzo.purezza, 10);
  });
});

describe("le esclusioni notevoli", () => {
  it("parlano solo di carte del tema che nel mazzo non ci sono", () => {
    const risolto = risolviTema(GOBLIN, POOL);
    for (const [indice, spiegazioni] of SPIEGATE.entries()) {
      const mazzo = FRONTIERA.mazzi[indice]!;
      const dentro = new Set(mazzo.carte.map((voce) => voce.carta.nome));
      for (const esclusione of spiegazioni.esclusioni) {
        const carta = POOL.find((c) => c.nome === esclusione.grezzi.nome)!;
        expect(appartiene(carta, risolto), esclusione.grezzi.nome).toBe(true);
        expect(dentro.has(esclusione.grezzi.nome), esclusione.grezzi.nome).toBe(false);
      }
    }
  });

  /**
   * Sul pool finto le carte del tema stanno tutte nel mazzo: tredici Goblin per
   * trentasette posti ci entrano tutti, e non è un difetto delle spiegazioni.
   * La strada delle esclusioni si prova quindi da `spiegaMazzo`, con un pool
   * che ha una carta del tema in più — che è la situazione del pool vero, dove
   * i Goblin sono novantacinque e i posti restano trentasette.
   */
  it("spiega la carta del tema che nel mazzo non è entrata", () => {
    const goblin = POOL_DEL_MOTORE.find((carta) => carta.sottotipi.includes("Goblin"))!;
    const rimastaFuori: Carta = {
      ...goblin,
      id: "finta-goblin-rimasta-fuori",
      nome: "Goblin Rimasta Fuori",
      forza: "0",
      costituzione: "1",
    };
    const poolPiuUno = [...POOL, rimastaFuori];
    const spiegato = spiegaMazzo(FRONTIERA.mazzi[0]!, null, {
      risolto: risolviTema(GOBLIN, poolPiuUno),
      pool: poolPiuUno,
    });

    const esclusione = spiegato.esclusioni.find(
      (voce) => voce.grezzi.nome === rimastaFuori.nome,
    );
    expect(esclusione).toBeDefined();
    expect(esclusione!.frase).toContain(rimastaFuori.nome);
    expect(esclusione!.frase).toMatch(/\d/);
  });
});


describe("la spiegazione della base di terre", () => {
  it("cita il numero di terre che il mazzo ha davvero", () => {
    for (const [indice, spiegazioni] of SPIEGATE.entries()) {
      const mazzo = FRONTIERA.mazzi[indice]!;
      expect(spiegazioni.terre.grezzi.numeroTerre).toBe(mazzo.base.numeroTerre);
      expect(spiegazioni.terre.frase).toContain(String(mazzo.base.numeroTerre));
    }
  });

  it("cita il costo medio e le fonti di colore della base", () => {
    const mazzo = FRONTIERA.mazzi[0]!;
    const grezzi = SPIEGATE[0]!.terre.grezzi;
    expect(grezzi.costoMedio).toBe(mazzo.base.costoMedio);
    expect(grezzi.numeroTerreDallaCurva).toBe(mazzo.base.numeroTerreDallaCurva);
    expect(grezzi.colori).toEqual(mazzo.base.coloriRichiesti);
  });
});

describe("la spiegazione del passo", () => {
  it("non c'è sul primo mazzo, che un precedente non ce l'ha", () => {
    expect(SPIEGATE[0]!.passo).toBeNull();
  });

  it("dice il baratto già calcolato dalla ricerca, senza rifarlo", () => {
    for (let indice = 1; indice < SPIEGATE.length; indice++) {
      const mazzo = FRONTIERA.mazzi[indice]!;
      const passo = SPIEGATE[indice]!.passo;
      expect(passo, `mazzo ${indice}`).not.toBeNull();
      expect(passo!.grezzi.purezzaPrima - passo!.grezzi.purezzaDopo).toBeCloseTo(
        mazzo.passo!.purezzaCeduta,
        10,
      );
      expect(passo!.grezzi.potenzaDopo - passo!.grezzi.potenzaPrima).toBeCloseTo(
        mazzo.passo!.potenzaGuadagnata,
        10,
      );
      expect(passo!.grezzi.potenzaDopo).toBe(mazzo.potenza);
      expect(passo!.grezzi.purezzaDopo).toBe(mazzo.purezza);
    }
  });

  it("conta le copie fuori tema, e sono almeno quante quelle del mazzo precedente", () => {
    for (let indice = 1; indice < SPIEGATE.length; indice++) {
      const passo = SPIEGATE[indice]!.passo!;
      expect(passo.grezzi.copieFuoriTemaDopo).toBeGreaterThanOrEqual(
        passo.grezzi.copieFuoriTemaPrima,
      );
    }
  });
});

describe("la spiegazione della combo dichiarata", () => {
  const PEZZI = ["Lone Sphinx", "Iron Sentinel"];
  const CON_COMBO = costruisciMazzo(richiesta({ combo: PEZZI }), POOL, SVELTA);
  const SPIEGATA = spiegaFrontiera(CON_COMBO, GOBLIN, POOL)[0];

  it("non dice niente quando l'utente non ha dichiarato nessuna combo", () => {
    for (const spiegazione of SPIEGATE) expect(spiegazione.combo).toBeNull();
  });

  it("cita la probabilità che il mazzo porta, e non una rifatta qui", () => {
    const combo = CON_COMBO.mazzi[0]?.combo;
    expect(combo).toBeDefined();
    expect(SPIEGATA?.combo).not.toBeNull();
    expect(SPIEGATA?.combo?.grezzi.probabilita).toBe(combo?.probabilita);
    // I due pezzi ci sono tutti e due: la probabilità esiste, e la frase la dice.
    expect(combo!.probabilita).not.toBeNull();
    expect(SPIEGATA?.combo?.frase).toContain(percento(combo!.probabilita as number));
  });

  it("cita il turno della taratura e i pezzi con le loro copie", () => {
    expect(SPIEGATA?.combo?.grezzi.pezzi).toEqual(CON_COMBO.mazzi[0]?.combo?.pezzi);
    for (const pezzo of PEZZI) expect(SPIEGATA?.combo?.frase).toContain(pezzo);
  });

  it("dice il patto: chi ha deciso che quella combo vince", () => {
    expect(SPIEGATA?.combo?.frase).toContain("l'hai detto tu");
  });
});

/**
 * Ticket 06 della tappa 3: l'archetipo misurato si dice a parole, e coi numeri
 * che il mazzo porta — non con una misura rifatta qui, che potrebbe divergere.
 */
describe("la spiegazione dell'archetipo misurato", () => {
  it("ce n'è una per ogni mazzo della frontiera", () => {
    for (const spiegazione of SPIEGATE) {
      expect(spiegazione.archetipo.frase).not.toBe("");
    }
  });

  it("cita i numeri che il mazzo ha misurato, e non dei suoi", () => {
    const mazzo = FRONTIERA.mazzi[0]!;
    const spiegata = SPIEGATE[0]!;
    expect(spiegata.archetipo.grezzi).toEqual(mazzo.archetipo);
    const turno = mazzo.archetipo.grezzi.turnoMedioDiChiusura;
    if (turno !== null) {
      expect(spiegata.archetipo.frase).toContain(turno.toFixed(1).replace(".", ","));
    }
  });
});
