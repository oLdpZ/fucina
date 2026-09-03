/**
 * Il tema come vincolo: la cucitura di cui il motore si servirà in
 * continuazione (ticket 08).
 *
 * I test entrano da dove entrerà il motore — «questa carta appartiene al
 * tema?» e «quanto è puro questo mazzo?» — e mai da sotto. Il pool è quello
 * finto: poche carte scelte apposta, come vuole `spec.md`.
 */

import { describe, expect, it } from "vitest";

import { POOL_FINTO, TERRE_FINTE } from "../catalogo/pool-finto.js";
import type { Carta } from "../dati/pool.js";
import {
  FILTRO_TEMA_VUOTO,
  TEMA_VUOTO,
  appartiene,
  carteDelTema,
  purezza,
  risolviTema,
  temaDichiarato,
  type Tema,
} from "./tema.js";

const TUTTE: readonly Carta[] = [...POOL_FINTO, ...TERRE_FINTE];

function carta(nome: string): Carta {
  const trovata = TUTTE.find((c) => c.nome === nome);
  if (trovata === undefined) throw new Error(`Il pool finto non ha «${nome}»`);
  return trovata;
}

/** I nomi delle carte del tema, in ordine alfabetico: un elenco si legge. */
function nomiDelTema(tema: Tema): string[] {
  return carteDelTema(TUTTE, risolviTema(tema, TUTTE))
    .map((c) => c.nome)
    .sort((a, b) => a.localeCompare(b, "en"));
}

describe("un tema si dichiara in tre modi, e almeno uno serve", () => {
  it("il tema vuoto non è dichiarato: non c'è niente da costruirci dentro", () => {
    expect(temaDichiarato(TEMA_VUOTO)).toBe(false);
  });

  it("bastano le sole inclusioni", () => {
    const tema: Tema = {
      ...TEMA_VUOTO,
      inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Goblin"] },
    };
    expect(temaDichiarato(tema)).toBe(true);
  });

  it("basta la sola carta-seme", () => {
    expect(temaDichiarato({ ...TEMA_VUOTO, seme: "Skirk Prospector" })).toBe(true);
  });

  it("bastano le sole esclusioni: «tutto tranne» è un tema", () => {
    const tema: Tema = {
      ...TEMA_VUOTO,
      esclusioni: { ...FILTRO_TEMA_VUOTO, tag: ["rimozione-mirata"] },
    };
    expect(temaDichiarato(tema)).toBe(true);
  });
});

describe("le inclusioni dicono che cosa sta dentro", () => {
  it("un sottotipo prende tutte le carte che ce l'hanno", () => {
    expect(nomiDelTema({ ...TEMA_VUOTO, inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Goblin"] } }))
      .toEqual(["Goblin Chieftain", "Rakdos Firestarter", "Skirk Prospector"]);
  });

  it("i colori si leggono come nel catalogo: ci sta dentro chi non sconfina", () => {
    const nomi = nomiDelTema({
      ...TEMA_VUOTO,
      inclusioni: { ...FILTRO_TEMA_VUOTO, colori: ["R"], tipi: ["Creature"] },
    });
    expect(nomi).toContain("Goblin Chieftain");
    // Nero-rossa: in un mazzo mono-rosso non si gioca.
    expect(nomi).not.toContain("Rakdos Firestarter");
  });

  it("un tetto di costo tiene fuori le carte lente", () => {
    const nomi = nomiDelTema({
      ...TEMA_VUOTO,
      inclusioni: { ...FILTRO_TEMA_VUOTO, costoMassimo: 3 },
    });
    expect(nomi).not.toContain("Ancient Colossus");
    expect(nomi).toContain("Goblin Chieftain");
  });

  it("un tag prende le carte che fanno quella cosa", () => {
    expect(nomiDelTema({ ...TEMA_VUOTO, inclusioni: { ...FILTRO_TEMA_VUOTO, tag: ["produce-pedine"] } }))
      .toEqual(["Krenko's Command"]);
  });

  it("filtri diversi si restringono a vicenda", () => {
    expect(
      nomiDelTema({
        ...TEMA_VUOTO,
        inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Goblin"], colori: ["R"] },
      }),
    ).toEqual(["Goblin Chieftain", "Skirk Prospector"]);
  });
});

describe("la carta-seme porta con sé il suo vicinato", () => {
  const tema: Tema = { ...TEMA_VUOTO, seme: "Skirk Prospector" };

  it("il seme appartiene al proprio tema", () => {
    expect(appartiene(carta("Skirk Prospector"), risolviTema(tema, TUTTE))).toBe(true);
  });

  it("chi condivide col seme un sottotipo o un tag è del tema", () => {
    expect(nomiDelTema(tema)).toEqual([
      "Goblin Chieftain",
      "Rakdos Firestarter",
      "Skirk Prospector",
    ]);
  });

  it("chi si limita a nominare il sottotipo del seme resta fuori finché non lo si dice", () => {
    // «Krenko's Command» fa pedine Goblin ma Goblin non è: entra solo con un
    // allargamento dichiarato, mai di nascosto.
    expect(nomiDelTema(tema)).not.toContain("Krenko's Command");
  });

  it("un seme che nel pool non c'è più non fa cadere niente", () => {
    const sparito: Tema = { ...TEMA_VUOTO, seme: "Carta Che Non Esiste" };
    expect(risolviTema(sparito, TUTTE).seme).toBe(null);
    expect(nomiDelTema(sparito)).toEqual([]);
  });
});

describe("le esclusioni vincono sempre", () => {
  it("una carta esclusa esce dal tema anche se le inclusioni la prendevano", () => {
    const tema: Tema = {
      ...TEMA_VUOTO,
      inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Goblin"] },
      esclusioni: { ...FILTRO_TEMA_VUOTO, tag: ["sacrifica"] },
    };
    expect(nomiDelTema(tema)).toEqual(["Goblin Chieftain", "Rakdos Firestarter"]);
  });

  it("una carta esclusa esce dal tema anche se è la carta-seme", () => {
    const tema: Tema = {
      ...TEMA_VUOTO,
      seme: "Skirk Prospector",
      esclusioni: { ...FILTRO_TEMA_VUOTO, tag: ["sacrifica"] },
    };
    expect(appartiene(carta("Skirk Prospector"), risolviTema(tema, TUTTE))).toBe(false);
  });

  it("con le sole esclusioni il tema è tutto il resto", () => {
    const tema: Tema = {
      ...TEMA_VUOTO,
      esclusioni: { ...FILTRO_TEMA_VUOTO, tipi: ["Instant"] },
    };
    const nomi = nomiDelTema(tema);
    expect(nomi).not.toContain("Lightning Strike");
    expect(nomi).toContain("Ancient Colossus");
    expect(nomi.length).toBe(TUTTE.length - 1);
  });
});

describe("la purezza è la quota di mazzo che sta dentro il tema", () => {
  const goblin: Tema = {
    ...TEMA_VUOTO,
    inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Goblin"] },
  };
  const risolto = risolviTema(goblin, TUTTE);
  const voci = (...righe: [string, number][]) =>
    righe.map(([nome, copie]) => ({ carta: carta(nome), copie }));

  it("un mazzo di solo tema è purissimo", () => {
    expect(purezza(voci(["Goblin Chieftain", 4], ["Skirk Prospector", 4]), risolto)).toBe(1);
  });

  it("le copie pesano: due carte fuori tema su quattro copie contano per le loro copie", () => {
    expect(purezza(voci(["Goblin Chieftain", 3], ["Lightning Strike", 1]), risolto)).toBe(0.75);
  });

  it("le terre non contano, né sopra né sotto la linea", () => {
    const conTerre = voci(["Goblin Chieftain", 4], ["Mountain", 20]);
    expect(purezza(conTerre, risolto)).toBe(1);
  });

  it("un mazzo senza carte non-terra non tradisce nessun tema", () => {
    expect(purezza([], risolto)).toBe(1);
    expect(purezza(voci(["Mountain", 20]), risolto)).toBe(1);
  });

  it("un mazzo senza niente del tema ha purezza zero", () => {
    expect(purezza(voci(["Lightning Strike", 4]), risolto)).toBe(0);
  });
});
