/**
 * L'archetipo misurato, provato dove decide: il comportamento entra, l'archetipo
 * esce coi numeri che lo giustificano.
 *
 * Nessun mazzo qui dentro, e non per comodità: `archetipoDi` non riceve carte da
 * guardare, e questo è il modo in cui il codice rende impossibile una regola
 * sulla composizione (ADR-0001). Entrano la simulazione e le corse, cioè
 * **come il mazzo si è comportato**.
 *
 * Le soglie sono provvisorie (`taratura.ts`) e qui si leggono da lì: i test
 * provano le frontiere fra le caselle, non il punto in cui oggi stanno.
 */

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { EsitoDellaCorsa } from "../avversario/corsa.js";
import type { EsitoDellaSimulazione } from "../mazzo/simulazione.js";
import { valutaMazzo } from "../punteggio/punteggio.js";
import { archetipoDi, type ComportamentoMisurato } from "./archetipo.js";
import {
  QUOTA_DI_CORSE_RETTE,
  QUOTA_CHE_CHIUDE,
  TURNO_MASSIMO_AGGRO,
  TURNO_MASSIMO_MIDRANGE,
} from "./taratura.js";

const SIMULAZIONE: EsitoDellaSimulazione = {
  partite: 500,
  turnoMedioDiChiusura: TURNO_MASSIMO_AGGRO,
  quotaPartiteChiuse: 1,
  quotaManiTenibili: 0.9,
  mulliganMedi: 0.2,
  quotaPartenzeImpiantate: 0.05,
  dannoMedio: 20,
  turnoMassimo: 20,
};

/** Una corsa, coi soli numeri che l'archetipo guarda davvero. */
function corsa(turnoMio: number | null, turnoSuo: number, inflitto: number): EsitoDellaCorsa {
  return {
    contro: `Orologio al ${turnoSuo}`,
    turnoMio,
    turnoSuo,
    ritardoInflittoConRimozioni: inflitto,
    ritardoInflittoConContromagie: 0,
    turnoSuoRitardato: turnoSuo + inflitto,
    ritardoDaRimozioni: 0,
    ritardoDaContromagie: 0,
    turnoMioRitardato: turnoMio,
    quotaPartiteChiuse: 1,
    voto: 0,
  };
}

function comportamento(
  simulazione: Partial<EsitoDellaSimulazione>,
  esiti: EsitoDellaCorsa[] | null = null,
): ComportamentoMisurato {
  return {
    simulazione: { ...SIMULAZIONE, ...simulazione },
    punteggio: {
      corsa:
        esiti === null
          ? null
          : {
              etichetta: "corsa",
              valore: 0,
              grezzi: { esiti, peggiore: esiti[0]! },
            },
    },
  };
}

const LENTO = TURNO_MASSIMO_MIDRANGE + 2;

describe("l'archetipo misurato dal comportamento", () => {
  it("chi chiude presto e quasi sempre è un aggro", () => {
    expect(archetipoDi(comportamento({})).archetipo).toBe("aggro");
  });

  it("chi chiude quasi sempre ma più tardi è un midrange", () => {
    expect(
      archetipoDi(comportamento({ turnoMedioDiChiusura: TURNO_MASSIMO_AGGRO + 0.5 })).archetipo,
    ).toBe("midrange");
    expect(
      archetipoDi(comportamento({ turnoMedioDiChiusura: TURNO_MASSIMO_MIDRANGE })).archetipo,
    ).toBe("midrange");
  });

  /**
   * Il turno medio si prende sulle sole partite chiuse, e da solo mente: un
   * mazzo che chiude al quarto turno una volta su cinque non è un aggro. La
   * quota di partite chiuse è metà della misura.
   */
  it("chiudere presto di rado non fa un aggro, né un midrange", () => {
    const raro = archetipoDi(comportamento({ quotaPartiteChiuse: QUOTA_CHE_CHIUDE - 0.1 }));
    expect(raro.archetipo).toBe("nessuno-dei-tre");
  });

  /**
   * Il cuore del ticket. Chiudere tardi non basta a fare un controllo — lo fa
   * anche un mazzo lento che non fa niente. Il controllo è quello che chiude
   * tardi e **regge la corsa grazie a quel che fa all'avversario**: senza il
   * ritardo che gli infligge arriverebbe dopo di lui, con quel ritardo no.
   */
  it("chi chiude tardi e regge la corsa grazie al ritardo che infligge è un controllo", () => {
    const misurato = archetipoDi(
      comportamento({ turnoMedioDiChiusura: LENTO }, [corsa(LENTO, LENTO - 1, 3)]),
    );
    expect(misurato.archetipo).toBe("controllo");
  });

  it("chi chiude tardi senza tenere lontano nessuno non è un controllo: è nessuno dei tre", () => {
    const misurato = archetipoDi(
      comportamento({ turnoMedioDiChiusura: LENTO }, [corsa(LENTO, LENTO - 1, 0)]),
    );
    expect(misurato.archetipo).toBe("nessuno-dei-tre");
  });

  /**
   * Chi regge la corsa **senza** bisogno del ritardo non la regge grazie al
   * controllo: arriverebbe prima comunque. Contarla lo farebbe diventare
   * controllo per il solo fatto di avere avversari lenti.
   */
  it("una corsa che si regge anche senza il ritardo inflitto non conta per il controllo", () => {
    const misurato = archetipoDi(
      comportamento({ turnoMedioDiChiusura: LENTO }, [corsa(LENTO, LENTO + 1, 3)]),
    );
    expect(misurato.archetipo).toBe("nessuno-dei-tre");
    expect(misurato.grezzi.corseRetteGrazieAlRitardo).toBe(0);
  });

  /**
   * Trovato dalla revisione: un mazzo che chiude presto ma non abbastanza
   * spesso salta aggro e midrange, e con qualche rimozione contro un orologio
   * velocissimo reggeva la corsa «grazie al ritardo». Ma il controllo è quello
   * che chiude **tardi**: un aggro incostante è nessuno dei tre.
   */
  it("chi chiude presto ma di rado non diventa un controllo per via della corsa", () => {
    const presto = TURNO_MASSIMO_AGGRO - 1;
    const misurato = archetipoDi(
      comportamento({ turnoMedioDiChiusura: presto, quotaPartiteChiuse: QUOTA_CHE_CHIUDE - 0.1 }, [
        corsa(presto, presto - 1, 2),
      ]),
    );
    expect(misurato.archetipo).toBe("nessuno-dei-tre");
  });

  it("il controllo deve reggere abbastanza corse, non una su tante", () => {
    const esiti = [
      corsa(LENTO, LENTO - 1, 3),
      corsa(LENTO, LENTO - 1, 0),
      corsa(LENTO, LENTO - 1, 0),
      corsa(LENTO, LENTO - 1, 0),
    ];
    expect(1 / esiti.length).toBeLessThan(QUOTA_DI_CORSE_RETTE);
    expect(archetipoDi(comportamento({ turnoMedioDiChiusura: LENTO }, esiti)).archetipo).toBe(
      "nessuno-dei-tre",
    );
  });

  /**
   * Senza orologi il controllo non si misura: la metà della corsa che lo
   * distingue da un mazzo lento non c'è. Si tace invece di scegliere.
   */
  it("senza orologi un mazzo lento è nessuno dei tre, non un controllo per esclusione", () => {
    const misurato = archetipoDi(comportamento({ turnoMedioDiChiusura: LENTO }));
    expect(misurato.archetipo).toBe("nessuno-dei-tre");
    expect(misurato.grezzi.corse).toBe(0);
  });

  it("un mazzo che non chiude mai non fa cadere niente", () => {
    const misurato = archetipoDi(
      comportamento({ turnoMedioDiChiusura: null, quotaPartiteChiuse: 0 }, [corsa(null, 6, 3)]),
    );
    expect(misurato.archetipo).toBe("nessuno-dei-tre");
  });

  /**
   * Il controllo deve pur chiudere: un mazzo che tiene lontano l'avversario e
   * poi non vince quasi mai non ha una strategia, ha un'attesa.
   */
  it("un controllo che chiude troppo di rado non è un controllo", () => {
    const misurato = archetipoDi(
      comportamento({ turnoMedioDiChiusura: LENTO, quotaPartiteChiuse: 0.05 }, [
        corsa(LENTO, LENTO - 1, 3),
      ]),
    );
    expect(misurato.archetipo).toBe("nessuno-dei-tre");
  });

  it("porta con sé i numeri che la giustificano", () => {
    const misurato = archetipoDi(
      comportamento({ turnoMedioDiChiusura: LENTO, quotaPartiteChiuse: 0.7 }, [
        corsa(LENTO, LENTO - 1, 3),
        corsa(LENTO, LENTO - 1, 0),
      ]),
    );
    expect(misurato.grezzi).toEqual({
      turnoMedioDiChiusura: LENTO,
      quotaPartiteChiuse: 0.7,
      corse: 2,
      corseRetteGrazieAlRitardo: 1,
    });
  });

  it("si chiede a un mazzo valutato così com'è", () => {
    // `ComportamentoMisurato` è un pezzo di `MazzoValutato`, non un tipo da
    // riempire a mano: chi ha valutato un mazzo ne chiede l'archetipo e basta.
    const valutato = valutaMazzo([], [], { seme: 1, partite: 10 });
    expect(archetipoDi(valutato).archetipo).toBe("nessuno-dei-tre");
  });

  it("tiene le soglie in un punto solo: nel codice dell'archetipo non c'è un numero", () => {
    const sorgente = readFileSync(new URL("./archetipo.ts", import.meta.url), "utf8");
    const codice = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(codice.match(/\d+(\.\d+)?/g) ?? []).toEqual(["0"]);
  });
});
