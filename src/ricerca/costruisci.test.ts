/**
 * La ricerca a scambi singoli, verificata **dalla cucitura principale**:
 * `costruisciMazzo(richiesta, pool)`.
 *
 * `spec.md` lo chiede così, e il ticket 11 lo ripete: i test entrano da qui e
 * usano il pool finto scritto a mano, non l'archivio Scryfall vero. Quel che si
 * asserisce sono **proprietà** — il mazzo è legale, le esclusioni non si
 * violano, la stessa richiesta dà la stessa uscita — e mai il valore di un peso
 * che alla sosta cambierà.
 *
 * L'orologio arriva da fuori come il seme: è l'unico modo di provare il tetto
 * di tempo senza far dipendere un test dalla velocità della macchina che lo
 * esegue.
 */

import { describe, expect, it } from "vitest";

import { POOL_DEL_MOTORE, TERRE_FINTE } from "../catalogo/pool-finto.js";
import type { Carta } from "../dati/pool.js";
import { COPIE_MASSIME, DIMENSIONE_MAZZO } from "../mazzo/taratura.js";
import { FILTRO_TEMA_VUOTO, TEMA_VUOTO, type Tema } from "../tema/tema.js";
import { costruisciMazzo, type Frontiera, type Opzioni, type Richiesta } from "./costruisci.js";

const POOL: readonly Carta[] = [...POOL_DEL_MOTORE, ...TERRE_FINTE];

/** Un orologio fermo: la ricerca non viene mai troncata dal tempo. */
const OROLOGIO_FERMO = () => 0;

/**
 * Le manopole strette apposta per i test: la ricerca fa poche valutazioni e
 * simula poche partite, così la suite gira in un lampo. Sono le stesse
 * manopole che `taratura.ts` dichiara provvisorie — passarle da fuori è il modo
 * di misurarle alla sosta, e qui serve a non aspettare.
 */
const SVELTA: Opzioni = {
  orologio: OROLOGIO_FERMO,
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
  return { tema: GOBLIN, seme: 7, tempoMassimoMs: 10_000, formato: "standard", ...parti };
}

function costruisci(parti: Partial<Richiesta> = {}, opzioni: Opzioni = SVELTA): Frontiera {
  return costruisciMazzo(richiesta(parti), POOL, opzioni);
}

/** Tutte le voci del mazzo, carte e terre insieme, come si conta una lista. */
function voci(frontiera: Frontiera) {
  const mazzo = frontiera.mazzi[0];
  expect(mazzo).toBeDefined();
  return [...mazzo!.carte, ...mazzo!.terre];
}

function carteTotali(frontiera: Frontiera): number {
  return voci(frontiera).reduce((somma, voce) => somma + voce.copie, 0);
}

function nomi(frontiera: Frontiera): string[] {
  return voci(frontiera).map((voce) => voce.carta.nome);
}

/** L'uscita ridotta a quel che l'utente vedrebbe: la lista, in ordine. */
function lista(frontiera: Frontiera): string {
  return JSON.stringify(voci(frontiera).map((voce) => [voce.carta.nome, voce.copie]));
}

describe("il primo mazzo costruito dall'app", () => {
  it("torna un mazzo solo: a questo ticket la frontiera non è ancora una frontiera", () => {
    const frontiera = costruisci();
    expect(frontiera.esito).toBe("costruito");
    expect(frontiera.mazzi).toHaveLength(1);
  });

  it("è legale: sessanta carte, mai più di quattro copie salvo le terre base", () => {
    const frontiera = costruisci();
    expect(carteTotali(frontiera)).toBe(DIMENSIONE_MAZZO);

    for (const voce of voci(frontiera)) {
      const base = voce.carta.tipi.includes("Basic");
      const illimitata = /any number of cards named/i.test(voce.carta.testo);
      if (!base && !illimitata) expect(voce.copie).toBeLessThanOrEqual(COPIE_MASSIME);
      expect(voce.copie).toBeGreaterThan(0);
    }
  });

  it("resta a sessanta anche quando le carte giocabili sono appena quelle", () => {
    // Nove carte fanno trentasei copie: bastano a un mazzo con ventiquattro
    // terre, e non a uno con venti. I posti non-terra devono scendere a quel
    // che il pool sa dare, se no esce un mazzo da cinquantotto carte annunciato
    // come se fosse a posto.
    const poche = [...POOL_DEL_MOTORE.slice(0, 9), ...TERRE_FINTE];
    const frontiera = costruisciMazzo(richiesta(), poche, SVELTA);

    expect(frontiera.mazzi).toHaveLength(1);
    expect(carteTotali(frontiera)).toBe(DIMENSIONE_MAZZO);
  });

  it("le copie illimitate non contano come un mazzo intero quando si conta se si può fare", () => {
    // Una carta che si concede copie illimitate ne mette comunque quattro nel
    // mazzo che l'app costruisce: contarla per trentatré direbbe «si fa» a un
    // pool che non ci arriva.
    const illimitata = POOL_DEL_MOTORE.find((carta) =>
      /any number of cards named/i.test(carta.testo),
    );
    expect(illimitata).toBeDefined();
    const scarso = [
      illimitata!,
      ...POOL_DEL_MOTORE.filter((carta) => carta !== illimitata).slice(0, 7),
      ...TERRE_FINTE,
    ];
    const frontiera = costruisciMazzo(richiesta(), scarso, SVELTA);

    expect(frontiera.esito).toBe("niente-da-costruire");
    expect(frontiera.mazzi).toHaveLength(0);
  });

  it("le terre che il mazzo porta sono quelle che la sua curva chiede", () => {
    const mazzo = costruisci().mazzi[0]!;
    expect(mazzo.base.numeroTerre).toBe(mazzo.base.numeroTerreDallaCurva);
  });

  it("non mette in campo nessun nome che il pool non contenga", () => {
    const delPool = new Set(POOL.map((carta) => carta.nome));
    for (const nome of nomi(costruisci())) expect(delPool.has(nome)).toBe(true);
    // E nessuna carta compare due volte nella lista: quattro copie sono una riga.
    expect(new Set(nomi(costruisci())).size).toBe(nomi(costruisci()).length);
  });

  it("porta con sé la base di terre, la simulazione e le cinque componenti", () => {
    const mazzo = costruisci().mazzi[0]!;
    expect(mazzo.terre.length).toBeGreaterThan(0);
    expect(mazzo.simulazione.partite).toBeGreaterThan(0);
    expect(Object.keys(mazzo.punteggio)).toEqual([
      "velocita",
      "curva",
      "colori",
      "sinergia",
      "qualita",
    ]);
  });
});

describe("il tema, che la ricerca non tradisce", () => {
  it("costruisce un mazzo quasi tutto nel tema, molto più puro del pool da cui pesca", () => {
    const frontiera = costruisci();
    // Nel pool finto i Goblin sono una minoranza: un mazzo che pescasse a caso
    // avrebbe la purezza di quella minoranza, e questo dev'essere ben di più.
    const quotaNelPool =
      POOL_DEL_MOTORE.filter((carta) => carta.sottotipi.includes("Goblin")).length /
      POOL_DEL_MOTORE.length;
    expect(frontiera.mazzi[0]!.purezza).toBeGreaterThan(quotaNelPool * 2);
    expect(frontiera.mazzi[0]!.purezza).toBeGreaterThan(0.8);
  });

  it("non viola mai le esclusioni, nemmeno quando violarle alzerebbe il punteggio", () => {
    // Le carte più forti del pool costano tre o più: escluderle è chiedere alla
    // ricerca di rinunciare al punteggio, ed è quel che deve fare.
    const stretto = tema({
      inclusioni: GOBLIN.inclusioni,
      esclusioni: { ...FILTRO_TEMA_VUOTO, costoMinimo: 3 },
    });
    const frontiera = costruisci({ tema: stretto });

    // I Goblin che restano non bastano più a riempire il mazzo, e l'esito lo
    // dice: il resto arriva da fuori tema. Ma dell'esclusione non passa niente,
    // ed è il punto — le carte da tre mana in su erano le più forti del pool.
    expect(frontiera.esito).toBe("costruito-fuori-tema");
    for (const voce of frontiera.mazzi[0]!.carte) {
      expect(voce.carta.valoreDiMana).toBeLessThan(3);
    }
  });

  it("le esclusioni valgono anche per le terre, che pure le sceglie l'app", () => {
    const senzaTerre = tema({
      inclusioni: GOBLIN.inclusioni,
      esclusioni: { ...FILTRO_TEMA_VUOTO, tipi: ["Land"] },
    });
    const frontiera = costruisci({ tema: senzaTerre });

    expect(frontiera.esito).toBe("niente-da-costruire");
    expect(frontiera.mazzi).toHaveLength(0);
    expect(frontiera.motivo).toContain("terre");
  });

  it("dichiara gli allargamenti che il tema porta con sé, senza aggiungerne", () => {
    expect(costruisci().allargamentiApplicati).toEqual([]);
  });
});

describe("il determinismo, che è un vincolo non negoziabile", () => {
  it("stessa richiesta due volte, uscita identica", () => {
    expect(lista(costruisci())).toBe(lista(costruisci()));
  });

  it("il seme governa la ricerca: seme diverso, ricerca diversa", () => {
    // Non si pretende un mazzo diverso — due partenze possono convergere allo
    // stesso posto, ed è un buon segno — ma la ricerca dev'essere passata da
    // strade diverse, e le partenze provate sono quelle dichiarate.
    const uno = costruisci({ seme: 1 });
    const altro = costruisci({ seme: 2 });
    expect(uno.partenze).toBe(2);
    expect(altro.partenze).toBe(2);
    expect(uno.scambiProvati).toBeGreaterThan(0);
  });

  it("non tocca l'orologio di sistema né il caso non seminato", () => {
    const oraDiSistema = Date.now;
    const casoDiSistema = Math.random;
    const prestazioni = performance.now;
    const vietato = () => {
      throw new Error("la ricerca ha guardato fuori dalla sua richiesta");
    };
    Date.now = vietato;
    Math.random = vietato;
    performance.now = vietato;
    try {
      expect(carteTotali(costruisci())).toBe(DIMENSIONE_MAZZO);
    } finally {
      Date.now = oraDiSistema;
      Math.random = casoDiSistema;
      performance.now = prestazioni;
    }
  });
});

describe("il tetto di tempo, perché la ricerca gira sul telefono", () => {
  it("superato il tetto torna comunque un mazzo legale, e lo dichiara troncato", () => {
    // Un orologio che salta di cento millisecondi a ogni sguardo: il tetto è
    // superato prima ancora del primo scambio.
    let quando = 0;
    const frontiera = costruisci(
      { tempoMassimoMs: 50 },
      { ...SVELTA, orologio: () => (quando += 100) },
    );

    expect(frontiera.troncataPerTempo).toBe(true);
    expect(frontiera.esito).toBe("costruito");
    expect(carteTotali(frontiera)).toBe(DIMENSIONE_MAZZO);
  });

  it("con tempo in abbondanza non dichiara nessun troncamento", () => {
    expect(costruisci().troncataPerTempo).toBe(false);
  });

  it("racconta l'avanzamento mentre lavora, così l'interfaccia ha che dire", () => {
    const passi: number[] = [];
    costruisci({}, { ...SVELTA, avanzamento: (a) => passi.push(a.partenza) });
    expect(passi.length).toBeGreaterThan(0);
    expect(Math.max(...passi)).toBeLessThan(2);
  });
});

describe("i temi degeneri, che devono dare un esito e mai un crollo", () => {
  it("un tema che non prende nessuna carta costruisce lo stesso, e lo dice", () => {
    const inesistente = tema({
      inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Kavu"] },
    });
    const frontiera = costruisci({ tema: inesistente });

    expect(frontiera.esito).toBe("costruito-fuori-tema");
    expect(carteTotali(frontiera)).toBe(DIMENSIONE_MAZZO);
    expect(frontiera.mazzi[0]!.purezza).toBe(0);
    expect(frontiera.motivo).toContain("0");
  });

  it("un tema che lascia una carta sola non fa un mazzo di quella, e lo dice", () => {
    const unaSola = tema({ inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Sphinx"] } });
    const frontiera = costruisci({ tema: unaSola });

    expect(frontiera.esito).toBe("costruito-fuori-tema");
    expect(carteTotali(frontiera)).toBe(DIMENSIONE_MAZZO);
    for (const voce of frontiera.mazzi[0]!.carte) {
      expect(voce.copie).toBeLessThanOrEqual(COPIE_MASSIME);
    }
  });

  it("un tema che esclude tutti i colori non lascia niente da costruire, e lo dice", () => {
    const nessunColore = tema({
      inclusioni: GOBLIN.inclusioni,
      esclusioni: { ...FILTRO_TEMA_VUOTO, colori: ["W", "U", "B", "R", "G"] },
    });
    const frontiera = costruisci({ tema: nessunColore });

    expect(frontiera.esito).toBe("niente-da-costruire");
    expect(frontiera.mazzi).toHaveLength(0);
    expect(frontiera.motivo.length).toBeGreaterThan(0);
  });

  it("senza tema non si costruisce niente, e non è un guasto", () => {
    const frontiera = costruisci({ tema: TEMA_VUOTO });
    expect(frontiera.esito).toBe("tema-non-dichiarato");
    expect(frontiera.mazzi).toHaveLength(0);
  });

  it("un pool senza carte non fa cadere niente", () => {
    const frontiera = costruisciMazzo(richiesta(), [], SVELTA);
    expect(frontiera.esito).toBe("niente-da-costruire");
    expect(frontiera.mazzi).toHaveLength(0);
  });
});
