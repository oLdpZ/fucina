/**
 * La corsa, provata come una funzione pura: simulazione dentro, esito fuori.
 *
 * Qui non si prova che i numeri siano **giusti** — non lo sono, e non possono
 * esserlo: l'avversario è una caricatura e i pesi sono provvisori fino alla
 * sosta. Si prova che siano **coerenti**: che chi chiude prima vinca la corsa,
 * che le rimozioni non mordano dove non c'è da mordere, e che azzerare un peso
 * tolga di mezzo quel numero — che è la via per cui ADR-0002 chiede di
 * aggiungere i tre numeri dell'orologio uno alla volta.
 */

import { describe, expect, it } from "vitest";

import { POOL_DEL_MOTORE } from "../catalogo/pool-finto.js";
import type { Tag } from "../dati/pool.js";
import type { CopieDiCarta } from "../mazzo/base-di-terre.js";
import type { EsitoDellaSimulazione } from "../mazzo/simulazione.js";
import { corriControUnOrologio } from "./corsa.js";
import type { Orologio } from "./orologio.js";

const SIMULAZIONE: EsitoDellaSimulazione = {
  partite: 40,
  turnoMedioDiChiusura: 5,
  quotaPartiteChiuse: 1,
  quotaManiTenibili: 0.9,
  mulliganMedi: 0.2,
  quotaPartenzeImpiantate: 0.05,
  dannoMedio: 20,
  turnoMassimo: 12,
};

const OROLOGIO: Orologio = {
  nome: "Mono rosso",
  perche: "",
  turnoDiChiusura: 6,
  rimozioni: 0,
  contromagie: 0,
};

/**
 * Le stesse copie con i tag riscritti. Quel che il mio mazzo fa all'avversario
 * lo dicono i tag, e il pool finto ne mette dove gli serve: i test della corsa
 * li decidono da sé, perché un tag aggiunto al pool finto non sposti un conto
 * che qui non c'entra.
 */
function conTag(voci: readonly CopieDiCarta[], tag: Tag[]): CopieDiCarta[] {
  return voci.map((voce) => ({ ...voce, carta: { ...voce.carta, tag } }));
}

const CREATURE: CopieDiCarta[] = conTag(
  POOL_DEL_MOTORE.filter((carta) => carta.tipi.some((tipo) => tipo.toLowerCase() === "creature"))
    .slice(0, 6)
    .map((carta) => ({ carta, copie: 4 })),
  [],
);

const MAGIE: CopieDiCarta[] = conTag(
  POOL_DEL_MOTORE.filter(
    (carta) =>
      carta.terra === null && !carta.tipi.some((tipo) => tipo.toLowerCase() === "creature"),
  )
    .slice(0, 6)
    .map((carta) => ({ carta, copie: 4 })),
  [],
);

describe("la corsa contro un orologio", () => {
  it("ha creature e magie fra cui distinguere, se no non prova niente", () => {
    expect(CREATURE.length).toBeGreaterThan(0);
    expect(MAGIE.length).toBeGreaterThan(0);
  });

  it("chi chiude prima vince la corsa", () => {
    const prima = corriControUnOrologio(SIMULAZIONE, CREATURE, { ...OROLOGIO, turnoDiChiusura: 8 });
    const dopo = corriControUnOrologio(SIMULAZIONE, CREATURE, { ...OROLOGIO, turnoDiChiusura: 3 });

    expect(prima.voto).toBeGreaterThan(dopo.voto);
    expect(prima.voto).toBe(1);
    expect(dopo.voto).toBe(0);
  });

  it("porta con sé i numeri che la spiegazione dovrà citare", () => {
    const esito = corriControUnOrologio(SIMULAZIONE, CREATURE, OROLOGIO);

    expect(esito.contro).toBe("Mono rosso");
    expect(esito.turnoMio).toBe(5);
    expect(esito.turnoSuo).toBe(6);
    expect(esito.turnoMioRitardato).toBe(5);
    expect(esito.turnoSuoRitardato).toBe(6);
    expect(esito.quotaPartiteChiuse).toBe(1);
  });

  it("le sue rimozioni mi rallentano, se gli do bersagli", () => {
    const senza = corriControUnOrologio(SIMULAZIONE, CREATURE, OROLOGIO);
    const con = corriControUnOrologio(SIMULAZIONE, CREATURE, { ...OROLOGIO, rimozioni: 12 });

    expect(con.ritardoDaRimozioni).toBeGreaterThan(0);
    expect(con.turnoMioRitardato!).toBeGreaterThan(senza.turnoMioRitardato!);
    expect(con.voto).toBeLessThan(senza.voto);
  });

  it("le sue rimozioni non mordono un mazzo che non dà bersagli", () => {
    // Otto rimozioni contro un mazzo senza creature sono otto carte morte.
    // Fingere che rallentino qualcosa direbbe il falso su un mazzo che ha
    // scelto apposta di non darne.
    const esito = corriControUnOrologio(SIMULAZIONE, MAGIE, { ...OROLOGIO, rimozioni: 12 });

    expect(esito.ritardoDaRimozioni).toBe(0);
    expect(esito.turnoMioRitardato).toBe(5);
  });

  it("le sue contromagie mordono anche un mazzo senza creature", () => {
    // Contro le contromagie non esiste un mazzo senza bersagli: il bersaglio è
    // ogni magia che si lancia.
    const esito = corriControUnOrologio(SIMULAZIONE, MAGIE, { ...OROLOGIO, contromagie: 8 });

    expect(esito.ritardoDaContromagie).toBeGreaterThan(0);
  });

  it("le due specie di ritardo restano separate, e si sommano al turno", () => {
    const esito = corriControUnOrologio(SIMULAZIONE, CREATURE, {
      ...OROLOGIO,
      rimozioni: 8,
      contromagie: 4,
    });

    expect(esito.ritardoDaRimozioni).toBeGreaterThan(0);
    expect(esito.ritardoDaContromagie).toBeGreaterThan(0);
    expect(esito.turnoMioRitardato).toBeCloseTo(
      5 + esito.ritardoDaRimozioni + esito.ritardoDaContromagie,
      9,
    );
  });

  /**
   * L'altra metà della corsa. Senza, un mazzo di controllo e un mazzo lento che
   * non fa niente si somigliano in tutto: tutt'e due chiudono tardi, e la corsa
   * guardava solo quel che l'avversario fa a me.
   */
  it("le mie rimozioni rallentano lui", () => {
    const esito = corriControUnOrologio(
      SIMULAZIONE,
      [...CREATURE, ...conTag(MAGIE.slice(0, 2), ["rimozione-mirata"])],
      OROLOGIO,
    );

    expect(esito.ritardoInflittoConRimozioni).toBeGreaterThan(0);
    expect(esito.ritardoInflittoConContromagie).toBe(0);
    expect(esito.turnoSuoRitardato).toBeCloseTo(6 + esito.ritardoInflittoConRimozioni, 9);
  });

  it("anche spazzare il campo è una rimozione, e le mie contromagie contano a parte", () => {
    const esito = corriControUnOrologio(
      SIMULAZIONE,
      [
        ...conTag(MAGIE.slice(0, 1), ["spazza-via"]),
        ...conTag(MAGIE.slice(1, 3), ["controincantesimo"]),
      ],
      OROLOGIO,
    );

    expect(esito.ritardoInflittoConRimozioni).toBeGreaterThan(0);
    expect(esito.ritardoInflittoConContromagie).toBeGreaterThan(0);
    expect(esito.turnoSuoRitardato).toBeCloseTo(
      6 + esito.ritardoInflittoConRimozioni + esito.ritardoInflittoConContromagie,
      9,
    );
  });

  it("una carta che fa tutt'e due le cose non rallenta due volte come rimozione", () => {
    const una = corriControUnOrologio(
      SIMULAZIONE,
      conTag(MAGIE.slice(0, 1), ["rimozione-mirata"]),
      OROLOGIO,
    );
    const doppia = corriControUnOrologio(
      SIMULAZIONE,
      conTag(MAGIE.slice(0, 1), ["rimozione-mirata", "spazza-via"]),
      OROLOGIO,
    );

    expect(doppia.ritardoInflittoConRimozioni).toBe(una.ritardoInflittoConRimozioni);
  });

  it("il ritardo che infliggo è quel che mi fa reggere una corsa che perderei", () => {
    const lento = { ...SIMULAZIONE, turnoMedioDiChiusura: 7 };
    const senza = corriControUnOrologio(lento, MAGIE, OROLOGIO);
    const con = corriControUnOrologio(
      lento,
      conTag(MAGIE, ["rimozione-mirata", "controincantesimo"]),
      OROLOGIO,
    );

    expect(senza.voto).toBeLessThan(con.voto);
    expect(con.turnoMioRitardato!).toBeLessThanOrEqual(con.turnoSuoRitardato);
  });

  it("un mazzo che non chiude mai perde la corsa, e non la salta", () => {
    // Zero e non `null`: è un esito, non un'assenza di dati, ed è il peggiore.
    const esito = corriControUnOrologio(
      { ...SIMULAZIONE, turnoMedioDiChiusura: null, quotaPartiteChiuse: 0 },
      CREATURE,
      OROLOGIO,
    );

    expect(esito.turnoMio).toBeNull();
    expect(esito.turnoMioRitardato).toBeNull();
    expect(esito.voto).toBe(0);
  });

  it("chiudere presto poche volte non è arrivare primi", () => {
    // Il prodotto per la quota di partite chiuse è il cuore del voto: un mazzo
    // che chiude al quarto turno una volta su cinque, le altre quattro non
    // arriva affatto.
    const sempre = corriControUnOrologio(SIMULAZIONE, CREATURE, {
      ...OROLOGIO,
      turnoDiChiusura: 9,
    });
    const raro = corriControUnOrologio({ ...SIMULAZIONE, quotaPartiteChiuse: 0.2 }, CREATURE, {
      ...OROLOGIO,
      turnoDiChiusura: 9,
    });

    expect(sempre.voto).toBe(1);
    expect(raro.voto).toBeCloseTo(0.2, 9);
  });

  it("resta pura: stessi argomenti, stesso esito", () => {
    expect(corriControUnOrologio(SIMULAZIONE, CREATURE, OROLOGIO)).toEqual(
      corriControUnOrologio(SIMULAZIONE, CREATURE, OROLOGIO),
    );
  });
});
