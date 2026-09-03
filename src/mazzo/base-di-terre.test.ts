/**
 * La cucitura della schermata: si dà un gruppo di carte non-terra, si riceve la
 * base di terre e la probabilità reale di lanciare ognuna al suo turno.
 *
 * I test entrano solo da qui, come vuole `spec.md`: nomi di funzioni interne e
 * ordine dei passaggi non compaiono, perché cambieranno.
 */

import { describe, expect, it } from "vitest";

import { TERRE_FINTE } from "../catalogo/pool-finto.js";
import type { Carta } from "../dati/pool.js";
import { analizzaBaseDiTerre, type CopieDiCarta } from "./base-di-terre.js";
import { PERDITA_MASSIMA_PER_I_COLORI } from "./taratura.js";

/** Una carta non-terra inventata sul momento: conta solo il suo costo. */
function magia(nome: string, costoDiMana: string, valoreDiMana: number): Carta {
  return {
    id: `finta-${nome}`,
    nome,
    costoDiMana,
    valoreDiMana,
    identitaDiColore: [],
    tipi: ["Creature"],
    sottotipi: [],
    testo: "",
    forza: null,
    costituzione: null,
    immagine: null,
    rarita: "common",
    legalitaStandard: "legal",
    prezzo: { euro: 0.1, aggiornatoIl: "2026-09-02" },
    tag: [],
    tagScryfall: [],
    facce: null,
    terra: null,
  };
}

function mazzo(...voci: [string, string, number, number][]): CopieDiCarta[] {
  return voci.map(([nome, costo, valore, copie]) => ({
    carta: magia(nome, costo, valore),
    copie,
  }));
}

/** C(n, k) esatto: i numeri attesi si scrivono come formule, non si copiano. */
function combinazioni(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  let risultato = 1n;
  for (let i = 0n; i < BigInt(k); i++) {
    risultato = (risultato * BigInt(n - Number(i))) / (i + 1n);
  }
  return risultato;
}

function copie(base: { terre: readonly CopieDiCarta[] }, nome: string): number {
  return base.terre.find((voce) => voce.carta.nome === nome)?.copie ?? 0;
}

describe("quante terre", () => {
  it("un mazzo che costa poco ne vuole meno di uno che costa molto", () => {
    const leggero = analizzaBaseDiTerre(
      mazzo(["Uno", "{R}", 1, 20], ["Due", "{1}{R}", 2, 18]),
      TERRE_FINTE,
      { terreVolute: null },
    );
    const pesante = analizzaBaseDiTerre(
      mazzo(["Cinque", "{4}{R}", 5, 20], ["Sei", "{5}{R}", 6, 18]),
      TERRE_FINTE,
      { terreVolute: null },
    );

    expect(leggero.numeroTerre).toBeLessThan(pesante.numeroTerre);
  });

  it("il numero deciso dall'app si può scavalcare a mano", () => {
    const carte = mazzo(["Due", "{1}{R}", 2, 24]);
    const dallApp = analizzaBaseDiTerre(carte, TERRE_FINTE, { terreVolute: null });
    const aMano = analizzaBaseDiTerre(carte, TERRE_FINTE, { terreVolute: 26 });

    expect(aMano.numeroTerre).toBe(26);
    expect(aMano.numeroTerreDallaCurva).toBe(dallApp.numeroTerre);
    // Più terre, più probabilità di poterla lanciare: è il compromesso che
    // l'utente deve poter vedere muoversi.
    expect(aMano.righe[0]!.probabilita).toBeGreaterThan(dallApp.righe[0]!.probabilita);
  });

  it("mette in tavola sempre sessanta carte, anche se il mazzo non è finito", () => {
    const base = analizzaBaseDiTerre(mazzo(["Due", "{1}{R}", 2, 4]), TERRE_FINTE, {
      terreVolute: null,
    });

    expect(base.dimensioneMazzo).toBe(60);
    expect(base.copieNonTerra).toBe(4);
  });
});

describe("quali terre", () => {
  it("un mazzo di un colore solo gioca solo la sua terra base", () => {
    const base = analizzaBaseDiTerre(mazzo(["Uno", "{R}", 1, 30]), TERRE_FINTE, {
      terreVolute: 24,
    });

    expect(copie(base, "Mountain")).toBe(24);
    expect(base.terre).toHaveLength(1);
    expect(base.terreCheEntranoGirate).toBe(0);
  });

  it("un mazzo a due colori prende le terre doppie che fanno quei due colori", () => {
    const base = analizzaBaseDiTerre(
      mazzo(["Nera", "{1}{B}", 2, 16], ["Rossa", "{1}{R}", 2, 16]),
      TERRE_FINTE,
      { terreVolute: 24 },
    );

    // La terra doppia che entra dritta viene prima di quelle che entrano
    // girate, e in quattro copie: è il massimo consentito.
    expect(copie(base, "Cinder Crossing")).toBe(4);
    // Non prende terre doppie di colori che il mazzo non gioca.
    expect(copie(base, "Tideglass Steps")).toBe(0);
    // E resta comunque una base di ventiquattro terre.
    const totale = base.terre.reduce((somma, voce) => somma + voce.copie, 0);
    expect(totale).toBe(24);
  });

  it("dichiara quante terre entrano girate, e quante solo a volte", () => {
    const base = analizzaBaseDiTerre(
      mazzo(["Nera", "{1}{B}", 2, 16], ["Rossa", "{1}{R}", 2, 16]),
      TERRE_FINTE,
      { terreVolute: 24 },
    );

    const girate = base.terre
      .filter((voce) => voce.carta.terra?.entraGirata === true)
      .reduce((somma, voce) => somma + voce.copie, 0);
    expect(base.terreCheEntranoGirate).toBe(girate);
    expect(base.terreCheEntranoGirate).toBeGreaterThan(0);
  });

  it("le terre messe sono sempre esattamente quante promesse", () => {
    // Se il numero in cima dicesse 24 e le terre elencate fossero 23, tutte le
    // probabilità sotto sarebbero calcolate su un mazzo che non esiste.
    const mazzi = [
      mazzo(["Uno", "{R}", 1, 30]),
      mazzo(["Nera", "{1}{B}", 2, 16], ["Rossa", "{1}{R}", 2, 16]),
      mazzo(["Nera", "{B}", 1, 12], ["Rossa", "{R}", 1, 12], ["Blu", "{U}", 1, 12]),
      // Un colore che nessuna terra base del pool finto produce non deve far
      // sparire terre dal conto.
      mazzo(["Incolore", "{C}", 1, 12], ["Rossa", "{R}", 1, 12]),
    ];

    // E lo stesso con un pool a cui manca la terra base di un colore chiesto:
    // il pool arriva dai dati, e i dati possono sempre sorprendere.
    const senzaIncolore = TERRE_FINTE.filter((carta) => carta.nome !== "Wastes");

    for (const carte of mazzi) {
      for (const pool of [TERRE_FINTE, senzaIncolore]) {
        for (let volute = 20; volute <= 27; volute++) {
          const base = analizzaBaseDiTerre(carte, pool, { terreVolute: volute });
          const totale = base.terre.reduce((somma, voce) => somma + voce.copie, 0);
          expect(totale).toBe(volute);
        }
      }
    }
  });

  it("non mette mai più di quattro copie di una terra non base", () => {
    const base = analizzaBaseDiTerre(
      mazzo(["Nera", "{1}{B}", 2, 16], ["Rossa", "{1}{R}", 2, 16]),
      TERRE_FINTE,
      { terreVolute: 26 },
    );

    for (const voce of base.terre) {
      if (voce.carta.tipi.includes("Basic")) continue;
      expect(voce.copie).toBeLessThanOrEqual(4);
    }
  });
});

describe("le probabilità", () => {
  it("su una base di sole terre base sono l'ipergeometrica scritta a penna", () => {
    // Ventiquattro Montagne dritte in sessanta carte. Per una carta da {R} al
    // turno 1 servono 7 carte viste e almeno una Montagna: 1 − C(36,7)/C(60,7).
    const attesa = 1 - Number(combinazioni(36, 7)) / Number(combinazioni(60, 7));

    const base = analizzaBaseDiTerre(mazzo(["Uno", "{R}", 1, 4]), TERRE_FINTE, {
      terreVolute: 24,
    });

    expect(base.righe[0]!.probabilita).toBeCloseTo(attesa, 12);
    expect(base.righe[0]!.turno).toBe(1);
  });

  it("scendono man mano che una carta chiede più simboli dello stesso colore", () => {
    const base = analizzaBaseDiTerre(
      mazzo(["Uno", "{R}", 1, 4], ["Doppia", "{R}{R}", 2, 4], ["Tripla", "{R}{R}{R}", 3, 4]),
      TERRE_FINTE,
      { terreVolute: 24 },
    );

    const [uno, doppia, tripla] = base.righe;
    expect(uno!.probabilita).toBeGreaterThan(doppia!.probabilita);
    expect(doppia!.probabilita).toBeGreaterThan(tripla!.probabilita);
  });

  it("segnalano le carte che questa base non regge, per colpa dei colori", () => {
    // «Dura» chiede due simboli per ciascuno dei due colori allo stesso turno:
    // è la carta che una base a due colori non regge. «Facile» costa uguale ma
    // chiede un solo simbolo, e non va segnalata: se lo fosse, l'avviso non
    // direbbe più niente.
    const base = analizzaBaseDiTerre(
      mazzo(["Facile", "{3}{B}", 4, 20], ["Dura", "{B}{B}{R}{R}", 4, 4]),
      TERRE_FINTE,
      { terreVolute: 24 },
    );

    const dura = base.righe.find((riga) => riga.carta.nome === "Dura")!;
    expect(dura.probabilitaSenzaColori - dura.probabilita).toBeGreaterThan(
      PERDITA_MASSIMA_PER_I_COLORI,
    );
    expect(dura.difficile).toBe(true);
    expect(base.difficili.map((riga) => riga.carta.nome)).toEqual(["Dura"]);
  });

  it("non segnalano una carta solo perché costa tanto", () => {
    // Al turno cinque nessun mazzo ha cinque terre più di un terzo delle volte:
    // è il costo, non la base. La probabilità resta bassa e in vista, ma
    // l'avviso non scatta, perché cambiare le terre non risolverebbe niente.
    const base = analizzaBaseDiTerre(mazzo(["Grossa", "{4}{R}", 5, 30]), TERRE_FINTE, {
      terreVolute: 24,
    });

    const grossa = base.righe[0]!;
    expect(grossa.probabilita).toBeLessThan(0.5);
    expect(grossa.difficile).toBe(false);
  });

  it("stesso mazzo, stessi numeri: il conto non ha nulla di casuale", () => {
    const carte = mazzo(["Nera", "{1}{B}", 2, 16], ["Rossa", "{1}{R}", 2, 16]);
    const prima = analizzaBaseDiTerre(carte, TERRE_FINTE, { terreVolute: null });
    const dopo = analizzaBaseDiTerre(carte, TERRE_FINTE, { terreVolute: null });

    expect(JSON.stringify(dopo)).toBe(JSON.stringify(prima));
  });

  it("un mazzo vuoto non fa cadere niente", () => {
    const base = analizzaBaseDiTerre([], TERRE_FINTE, { terreVolute: null });

    expect(base.righe).toHaveLength(0);
    expect(base.difficili).toHaveLength(0);
    expect(base.numeroTerre).toBeGreaterThan(0);
  });
});
