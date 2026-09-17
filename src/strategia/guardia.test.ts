/**
 * **La guardia**, provata sulle due cose che deve garantire: che non sbagli
 * quando dice «impossibile», e che taccia in tutti gli altri casi.
 *
 * L'asimmetria non è pigrizia del test, è la regola del ticket: una guardia che
 * dica impossibile a un tema che ce l'avrebbe fatta è un guasto dell'app; una
 * che tace troppo è solo timida. Perciò il test più importante qui dentro è
 * quello che confronta il verdetto con la **simulazione vera** — se la guardia
 * esclude un aggro, nessuna partita di quel mazzo chiude in tempo.
 */

import { describe, expect, it } from "vitest";

import { POOL_DEL_MOTORE, TERRE_FINTE } from "../catalogo/pool-finto.js";
import type { Carta } from "../dati/pool.js";
import { simulaGoldfish } from "../mazzo/simulazione.js";
import { copieAlMassimo } from "../mazzo/copie.js";
import { TURNO_MASSIMO, VITE_AVVERSARIO } from "../mazzo/taratura.js";
import { guardiaDellaStrategia } from "./guardia.js";
import { TURNO_MASSIMO_AGGRO } from "./taratura.js";

const OROLOGIO = { nome: "Rossi", turnoDiChiusura: 6, rimozioni: 4, contromagie: 0, perche: "" };

function eCreatura(carta: Carta): boolean {
  return carta.tipi.some((tipo) => tipo.toLowerCase() === "creature");
}

const SENZA_CREATURE = POOL_DEL_MOTORE.filter((carta) => !eCreatura(carta));
const CON_CREATURE = POOL_DEL_MOTORE;

describe("la guardia della strategia", () => {
  it("non dice impossibile a un aggro su carte che di creature ne hanno", () => {
    for (const strategia of ["aggro", "midrange"] as const) {
      expect(
        guardiaDellaStrategia({ strategia, carte: CON_CREATURE, orologi: [] }).verdetto,
      ).toBe("tace");
    }
  });

  it("dice impossibile quando fra le carte non c'è niente che faccia danno", () => {
    // Nella simulazione il danno lo fanno **solo** le creature, per la loro
    // forza: senza nemmeno una, nessun mazzo chiude una partita, e questo vale
    // per tutt'e tre le caselle — anche il controllo, che chiude tardi ma deve
    // chiudere.
    for (const strategia of ["aggro", "midrange", "controllo"] as const) {
      const verdetto = guardiaDellaStrategia({
        strategia,
        carte: SENZA_CREATURE,
        orologi: [OROLOGIO],
      });
      expect(verdetto.verdetto).toBe("impossibile");
      if (verdetto.verdetto !== "impossibile") return;
      expect(verdetto.motivo).toBe("danno-fuori-tempo");
      expect(verdetto.grezzi.dannoMassimo).toBe(0);
      expect(verdetto.grezzi.vite).toBe(VITE_AVVERSARIO);
    }
  });

  it("esclude il controllo finché non esiste una corsa da reggere", () => {
    const verdetto = guardiaDellaStrategia({
      strategia: "controllo",
      carte: CON_CREATURE,
      orologi: [],
    });

    expect(verdetto.verdetto).toBe("impossibile");
    if (verdetto.verdetto !== "impossibile") return;
    expect(verdetto.motivo).toBe("controllo-senza-orologi");
    // Non è un conto sulle carte, e il verdetto non ne porta nessuno: quel che
    // manca è l'avversario.
    expect(verdetto.grezzi.turno).toBeNull();
    expect(verdetto.grezzi.dannoMassimo).toBeNull();
  });

  it("non esclude l'aggro e il midrange per la mancanza di avversari", () => {
    // Aggro e midrange si misurano dalla sola simulazione: chiedere un
    // avversario per dirli sarebbe una guardia che esclude quel che potrebbe
    // misurare.
    for (const strategia of ["aggro", "midrange"] as const) {
      expect(
        guardiaDellaStrategia({ strategia, carte: CON_CREATURE, orologi: [] }).verdetto,
      ).toBe("tace");
    }
  });

  it("quando dice impossibile, la simulazione vera non la smentisce", () => {
    // La prova che conta. Si prende un mazzo fatto con le carte più forti che
    // la guardia ha guardato — il caso migliore che quelle carte permettano —
    // si fa giocare per davvero, e si guarda che non chiuda mai entro il turno
    // che la guardia ha escluso. Se lo facesse, la guardia avrebbe mentito.
    const carte = [...SENZA_CREATURE.slice(0, 12), ...TERRE_FINTE.slice(0, 3)];
    const verdetto = guardiaDellaStrategia({ strategia: "aggro", carte, orologi: [] });
    expect(verdetto.verdetto).toBe("impossibile");

    const mazzo = mazzoDa(carte);
    const esito = simulaGoldfish(mazzo, { seme: 11, partite: 60 });
    // Non chiude affatto, che è il caso estremo del «non chiude in tempo».
    expect(esito.quotaPartiteChiuse).toBe(0);
    expect(esito.turnoMedioDiChiusura).toBeNull();
  });

  it("il conto guarda il turno che l'archetipo chiesto chiede, non uno a caso", () => {
    // Una creatura sola, minuscola, e un turno lungo: entro il sesto turno non
    // arriva a venti, entro il ventesimo sì. La guardia esclude il primo e tace
    // sul secondo, che è la sola differenza fra le tre caselle.
    const piccola = POOL_DEL_MOTORE.find(
      (carta) => eCreatura(carta) && Number(carta.forza) === 1,
    );
    expect(piccola).toBeDefined();

    const carte = [piccola!];
    const aggro = guardiaDellaStrategia({ strategia: "aggro", carte, orologi: [] });
    const controllo = guardiaDellaStrategia({
      strategia: "controllo",
      carte,
      orologi: [OROLOGIO],
    });

    expect(aggro.verdetto).toBe("impossibile");
    if (aggro.verdetto === "impossibile") {
      expect(aggro.grezzi.turno).toBe(TURNO_MASSIMO_AGGRO);
      expect(aggro.grezzi.dannoMassimo).toBeLessThan(VITE_AVVERSARIO);
    }
    // Vent'anni di turni con una creatura da uno bastano e avanzano: la guardia
    // tace, e a dire se quel mazzo sia un controllo ci pensa la misura.
    expect(controllo.verdetto).toBe("tace");
    expect(TURNO_MASSIMO).toBeGreaterThan(TURNO_MASSIMO_AGGRO);
  });
});

/** Un mazzo da sessanta copie con queste carte, al massimo delle copie. */
function mazzoDa(carte: readonly Carta[]) {
  const mazzo = [];
  let copie = 0;
  for (const carta of carte) {
    const quante = Math.min(copieAlMassimo(carta), 60 - copie);
    if (quante <= 0) break;
    mazzo.push({ carta, copie: quante });
    copie += quante;
  }
  return mazzo;
}
