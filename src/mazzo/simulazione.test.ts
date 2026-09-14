/**
 * La simulazione goldfish, verificata su mazzi costruiti perché l'esito sia
 * **ovvio prima di lanciarla**.
 *
 * È la richiesta esplicita di `spec.md` e del ticket 09: sessanta terre non
 * fanno mai danno e non chiudono mai, ventiquattro Montagne e trentasei
 * creature da un mana che picchiano per venti chiudono al secondo turno. Se un
 * giorno la politica di gioco cambierà idea, questi numeri se ne accorgeranno.
 *
 * I test entrano solo dalla cucitura pubblica: `simulaGoldfish`.
 */

import { describe, expect, it } from "vitest";

import type { Carta, ColoreMana } from "../dati/pool.js";
import type { CopieDiCarta } from "./base-di-terre.js";
import { leggiTettoDiCopie } from "./copie.js";
import { simulaGoldfish } from "./simulazione.js";
import { PARTITE_SIMULATE } from "./taratura.js";

const SEME = 20260903;

function magia(abbozzo: {
  nome: string;
  costoDiMana: string;
  valoreDiMana: number;
  forza?: number | string | null;
  tipi?: string[];
}): Carta {
  return {
    id: `finta-${abbozzo.nome}`,
    nome: abbozzo.nome,
    costoDiMana: abbozzo.costoDiMana,
    valoreDiMana: abbozzo.valoreDiMana,
    identitaDiColore: [],
    tipi: abbozzo.tipi ?? ["Creature"],
    sottotipi: [],
    testo: "",
    forza: abbozzo.forza === undefined || abbozzo.forza === null ? null : String(abbozzo.forza),
    costituzione: "1",
    immagine: null,
    rarita: "common",
    riservata: false,
    nomeItaliano: null,
    edizione: "prova",
    numeroDiCollezione: "1",
    linguaDellaStampa: "en",
    prezzo: {
      euro: 0.1,
      aggiornatoIl: "2026-09-02",
      stampa: { edizione: "prova", numeroDiCollezione: "1", lingua: "en" },
    },
    tag: [],
    tagScryfall: [],
    facce: null,
    terra: null,
    tettoDiCopie: leggiTettoDiCopie("", abbozzo.tipi ?? ["Creature"]),
  };
}

function terra(nome: string, coloriProdotti: ColoreMana[], entraGirata = false): Carta {
  return {
    ...magia({ nome, costoDiMana: "", valoreDiMana: 0, tipi: ["Land"] }),
    terra: { coloriProdotti, entraGirata, condizione: null },
  };
}

const MONTAGNA = terra("Mountain", ["R"]);
const FORESTA = terra("Forest", ["G"]);
const MONTAGNA_GIRATA = terra("Cinder Barrens", ["R"], true);
const DOPPIA_RG = terra("Karplusan Forest", ["R", "G"]);

/** Una creatura da un mana rosso che chiude la partita da sola. */
const COLOSSO = magia({ nome: "Colosso", costoDiMana: "{R}", valoreDiMana: 1, forza: 20 });

const BRUTALE: CopieDiCarta[] = [
  { carta: MONTAGNA, copie: 24 },
  { carta: COLOSSO, copie: 36 },
];

/** Un mazzo qualunque ma plausibile, per i confronti fra semi. */
const PLAUSIBILE: CopieDiCarta[] = [
  { carta: MONTAGNA, copie: 24 },
  { carta: magia({ nome: "Bruto", costoDiMana: "{1}{R}", valoreDiMana: 2, forza: 3 }), copie: 20 },
  { carta: magia({ nome: "Gigante", costoDiMana: "{4}{R}", valoreDiMana: 5, forza: 6 }), copie: 16 },
];

function simula(mazzo: CopieDiCarta[], partite = 200) {
  return simulaGoldfish(mazzo, { seme: SEME, partite });
}

describe("il caso è governato dal seme", () => {
  it("la stessa richiesta lanciata due volte dà lo stesso risultato", () => {
    expect(simulaGoldfish(PLAUSIBILE, { seme: 7, partite: 120 })).toEqual(
      simulaGoldfish(PLAUSIBILE, { seme: 7, partite: 120 }),
    );
  });

  it("semi diversi danno partite diverse", () => {
    const uno = simulaGoldfish(PLAUSIBILE, { seme: 1, partite: 200 });
    const altro = simulaGoldfish(PLAUSIBILE, { seme: 2, partite: 200 });
    expect(uno).not.toEqual(altro);
  });

  it("non tocca mai il caso di sistema né l'orologio", () => {
    // Se la simulazione usasse `Math.random` o `Date.now`, questo test la
    // coglierebbe sul fatto: qui sotto tutt'e due esplodono.
    const casoVero = Math.random;
    const oraVera = Date.now;
    Math.random = () => {
      throw new Error("La simulazione ha usato Math.random.");
    };
    Date.now = () => {
      throw new Error("La simulazione ha usato Date.now.");
    };
    try {
      expect(() => simulaGoldfish(PLAUSIBILE, { seme: 3, partite: 20 })).not.toThrow();
    } finally {
      Math.random = casoVero;
      Date.now = oraVera;
    }
  });
});

describe("sessanta terre", () => {
  const soloTerre: CopieDiCarta[] = [{ carta: MONTAGNA, copie: 60 }];

  it("non fanno mai danno e non chiudono mai", () => {
    const esito = simula(soloTerre);
    expect(esito.quotaPartiteChiuse).toBe(0);
    expect(esito.turnoMedioDiChiusura).toBeNull();
    expect(esito.dannoMedio).toBe(0);
  });

  it("rimescolano ogni mano: sette terre non si tengono mai", () => {
    const esito = simula(soloTerre);
    expect(esito.quotaManiTenibili).toBe(0);
    expect(esito.mulliganMedi).toBe(2);
  });

  it("partono impiantate tutte le volte: non lanciano niente", () => {
    expect(simula(soloTerre).quotaPartenzeImpiantate).toBe(1);
  });
});

describe("sessanta magie senza una terra", () => {
  const soloMagie: CopieDiCarta[] = [{ carta: COLOSSO, copie: 60 }];

  it("non si tengono mai e non lanciano mai niente", () => {
    const esito = simula(soloMagie);
    expect(esito.quotaManiTenibili).toBe(0);
    expect(esito.quotaPartiteChiuse).toBe(0);
    expect(esito.quotaPartenzeImpiantate).toBe(1);
  });
});

describe("un mazzo costruito perché chiuda subito", () => {
  it("chiude ogni partita, e quasi sempre al secondo turno", () => {
    // Turno 1: una Montagna e il Colosso. Turno 2: attacca per venti. Il
    // secondo turno è il primo possibile — una creatura non attacca il turno in
    // cui entra — e la media può solo starci sopra.
    const esito = simula(BRUTALE, 300);
    expect(esito.quotaPartiteChiuse).toBe(1);
    expect(esito.turnoMedioDiChiusura).toBeGreaterThanOrEqual(2);
    expect(esito.turnoMedioDiChiusura).toBeLessThan(2.3);
  });

  it("quasi nessuna partenza è impiantata", () => {
    expect(simula(BRUTALE, 300).quotaPartenzeImpiantate).toBeLessThan(0.1);
  });
});

describe("la partenza si guarda al terzo turno, non a fine partita", () => {
  it("un mazzo di sole magie da sette parte impiantato sempre, anche se poi chiude", () => {
    // Con ventiquattro Montagne e trentasei creature da sette mana non si può
    // lanciare niente prima del settimo turno: **ogni** partenza è impiantata,
    // per definizione. Quasi tutte queste partite però chiudono, prima o poi,
    // e finiscono per lanciare parecchie magie: se il conto delle magie
    // guardasse tutta la partita invece che i primi tre turni, questo mazzo si
    // direbbe scattante.
    const settedrop: CopieDiCarta[] = [
      { carta: MONTAGNA, copie: 24 },
      { carta: magia({ nome: "Titano", costoDiMana: "{6}{R}", valoreDiMana: 7, forza: 8 }), copie: 36 },
    ];
    const esito = simula(settedrop, 300);
    expect(esito.quotaPartenzeImpiantate).toBe(1);
    expect(esito.quotaPartiteChiuse).toBeGreaterThan(0.9);
  });

  it("una magia lanciata dopo il terzo turno non salva una partenza lenta", () => {
    // Quattro magie da un mana e trentadue da sei. Entro il terzo turno si
    // vedono nove o dieci carte: pescarne **due** delle quattro capita attorno
    // a una volta su otto, e in tutte le altre la partenza è impiantata anche
    // se dal sesto turno in poi il mazzo lancia a raffica.
    const lenta: CopieDiCarta[] = [
      { carta: MONTAGNA, copie: 24 },
      { carta: magia({ nome: "Scaglia", costoDiMana: "{R}", valoreDiMana: 1, forza: 1 }), copie: 4 },
      { carta: magia({ nome: "Bestione", costoDiMana: "{5}{R}", valoreDiMana: 6, forza: 7 }), copie: 32 },
    ];
    expect(simula(lenta, 300).quotaPartenzeImpiantate).toBeGreaterThan(0.8);
  });
});

describe("le regole che la politica di gioco dichiara", () => {
  it("una creatura non attacca il turno in cui entra", () => {
    // Un solo Colosso in tutto il mazzo, e cinquantanove Montagne: quando
    // arriva chiude il turno dopo, mai lo stesso turno.
    const esito = simula(
      [
        { carta: MONTAGNA, copie: 59 },
        { carta: COLOSSO, copie: 1 },
      ],
      300,
    );
    expect(esito.turnoMedioDiChiusura).toBeGreaterThanOrEqual(2);
  });

  it("una terra che entra girata non produce mana il turno in cui la si gioca", () => {
    // Con Montagne dritte il Colosso entra al turno 1 e chiude al 2. Con le
    // stesse Montagne girate entra al turno 2 e chiude al 3.
    const dritte = simula(BRUTALE);
    const girate = simula([
      { carta: MONTAGNA_GIRATA, copie: 24 },
      { carta: COLOSSO, copie: 36 },
    ]);
    expect(dritte.turnoMedioDiChiusura).toBeLessThan(2.3);
    expect(girate.turnoMedioDiChiusura).toBeGreaterThanOrEqual(3);
    expect(girate.turnoMedioDiChiusura).toBeLessThan(3.3);
  });

  it("solo le creature fanno danno", () => {
    const stregonerie: CopieDiCarta[] = [
      { carta: MONTAGNA, copie: 24 },
      {
        carta: magia({
          nome: "Lampo",
          costoDiMana: "{R}",
          valoreDiMana: 1,
          tipi: ["Instant"],
        }),
        copie: 36,
      },
    ];
    const esito = simula(stregonerie);
    expect(esito.dannoMedio).toBe(0);
    expect(esito.quotaPartiteChiuse).toBe(0);
    // Le magie però si lanciano: la partenza non è impiantata.
    expect(esito.quotaPartenzeImpiantate).toBeLessThan(0.1);
  });

  it("una creatura senza forza scritta a numero non fa danno", () => {
    const asterischi: CopieDiCarta[] = [
      { carta: MONTAGNA, copie: 24 },
      {
        carta: magia({ nome: "Ombra", costoDiMana: "{R}", valoreDiMana: 1, forza: "*" }),
        copie: 36,
      },
    ];
    expect(simula(asterischi).dannoMedio).toBe(0);
  });
});

describe("i colori si pagano davvero", () => {
  it("un mazzo di Montagne non lancia le magie verdi", () => {
    const sbagliato: CopieDiCarta[] = [
      { carta: MONTAGNA, copie: 24 },
      {
        carta: magia({ nome: "Bestia", costoDiMana: "{G}", valoreDiMana: 1, forza: 20 }),
        copie: 36,
      },
    ];
    const esito = simula(sbagliato);
    expect(esito.quotaPartiteChiuse).toBe(0);
    expect(esito.quotaPartenzeImpiantate).toBe(1);
  });

  it("una stessa terra non paga due simboli colorati", () => {
    // {R}{G} con sole Montagne è impossibile, per quanti mana si abbiano.
    const impossibile: CopieDiCarta[] = [
      { carta: MONTAGNA, copie: 30 },
      {
        carta: magia({ nome: "Chimera", costoDiMana: "{R}{G}", valoreDiMana: 2, forza: 20 }),
        copie: 30,
      },
    ];
    expect(simula(impossibile).quotaPartiteChiuse).toBe(0);
  });

  it("due terre doppie pagano un costo a due colori", () => {
    const doppie: CopieDiCarta[] = [
      { carta: DOPPIA_RG, copie: 24 },
      {
        carta: magia({ nome: "Chimera", costoDiMana: "{R}{G}", valoreDiMana: 2, forza: 20 }),
        copie: 36,
      },
    ];
    const esito = simula(doppie);
    expect(esito.quotaPartiteChiuse).toBe(1);
    expect(esito.turnoMedioDiChiusura).toBeGreaterThanOrEqual(3);
    expect(esito.turnoMedioDiChiusura).toBeLessThan(3.4);
  });

  it("una Montagna e una Foresta pagano lo stesso costo", () => {
    const bicolore: CopieDiCarta[] = [
      { carta: MONTAGNA, copie: 12 },
      { carta: FORESTA, copie: 12 },
      {
        carta: magia({ nome: "Chimera", costoDiMana: "{R}{G}", valoreDiMana: 2, forza: 20 }),
        copie: 36,
      },
    ];
    expect(simula(bicolore).quotaPartiteChiuse).toBeGreaterThan(0.8);
  });
});

describe("la forma della risposta", () => {
  it("dichiara quante partite ha giocato, e di suo ne gioca la costante tarata", () => {
    expect(simulaGoldfish(BRUTALE, { seme: SEME, partite: 33 }).partite).toBe(33);
    expect(simulaGoldfish(BRUTALE, { seme: SEME }).partite).toBe(PARTITE_SIMULATE);
  });

  it("un mazzo vuoto non fa crollare niente", () => {
    const esito = simulaGoldfish([], { seme: SEME, partite: 10 });
    expect(esito.quotaPartiteChiuse).toBe(0);
    expect(esito.turnoMedioDiChiusura).toBeNull();
    expect(esito.quotaManiTenibili).toBe(0);
  });

  it("chiedere zero partite è un errore, non una media inventata", () => {
    expect(() => simulaGoldfish(BRUTALE, { seme: 1, partite: 0 })).toThrow();
  });
});

describe("le terre che non fanno mana", () => {
  it("non pagano niente, né colorato né generico", () => {
    // Su questo formato ci sono terre che non producono mana affatto, e dal
    // ticket 08 entrano nei mazzi. Contarle fra le fonti farebbe lanciare in
    // simulazione magie che in partita restano in mano.
    const carte: CopieDiCarta[] = [
      { carta: magia({ nome: "Due", costoDiMana: "{1}{R}", valoreDiMana: 2, forza: 2 }), copie: 24 },
      { carta: terra("Passaggio Inerte", []), copie: 36 },
    ];
    const esito = simulaGoldfish(carte, { seme: 3, partite: 40 });

    // Trentasei terre inerti e nessuna fonte: non si lancia mai niente, il
    // danno resta zero e nessuna partita si chiude.
    expect(esito.dannoMedio).toBe(0);
    expect(esito.quotaPartiteChiuse).toBe(0);
  });

  it("non contano nemmeno per decidere se una mano si tiene", () => {
    // La regola di mulligan guarda le **fonti**, non le terre: una mano di tre
    // terre inerti non lancia niente, e chiamarla tenibile racconterebbe una
    // partenza che in partita non c'è.
    const carte: CopieDiCarta[] = [
      { carta: magia({ nome: "Due", costoDiMana: "{1}{R}", valoreDiMana: 2, forza: 2 }), copie: 36 },
      { carta: terra("Passaggio Inerte", []), copie: 24 },
    ];
    const esito = simulaGoldfish(carte, { seme: 5, partite: 60 });

    expect(esito.quotaManiTenibili).toBe(0);
  });

  it("entrare girate non le fa passare davanti a una terra che fa mana", () => {
    // A una terra che non produce niente entrare girata non costa nulla: il
    // mana che ritarda non c'è. Il voto con cui si sceglie la terra deve quindi
    // guardare prima se fa mana, e solo fra quelle se entra girata — se no una
    // terra inerte girata si cala al posto di una Montagna, e si perde un mana
    // che una terra inerte dritta non avrebbe fatto perdere. La stessa partita,
    // con le inerti girate o dritte, deve andare allo stesso modo.
    const conInerti = (entraGirata: boolean): CopieDiCarta[] => [
      { carta: MONTAGNA, copie: 20 },
      { carta: terra("Passaggio Inerte", [], entraGirata), copie: 16 },
      { carta: magia({ nome: "Tre", costoDiMana: "{2}{R}", valoreDiMana: 3, forza: 3 }), copie: 24 },
    ];

    expect(simula(conInerti(true), 300)).toEqual(simula(conInerti(false), 300));
  });
});
