import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { COMBO_VUOTA } from "../combo/combo.js";
import { interpretaPool } from "../dati/carica-pool.js";
import type { Carta } from "../dati/pool.js";
import { analizzaBaseDiTerre } from "../mazzo/base-di-terre.js";
import { contoDelMazzo, PARI_IN_EURO } from "../mazzo/spesa.js";
import { FILTRO_TEMA_VUOTO, TEMA_VUOTO, type Tema } from "../tema/tema.js";
import { costruisciMazzo, type Opzioni, type Richiesta } from "./costruisci.js";

/**
 * Il tetto di spesa provato **sul pool vero**, e non sul pool finto.
 *
 * Gli altri test della ricerca girano su carte inventate, ed è giusto così:
 * provano che il motore fa quel che dice, e per quello un pool scritto a mano è
 * più chiaro di ottocento carte vere. Questo file prova una cosa che il pool
 * finto **non può** provare, e il ticket 20 lo chiede alla lettera: che alzare
 * il tetto non peggiori mai il mazzo.
 *
 * La ragione per cui serve il pool vero è che il guasto era fatto del prezzo di
 * **una carta**. Finché nessuna terra costava abbastanza da entrare fra le
 * comprabili, la riserva per le terre restava di otto euro e tutto funzionava;
 * appena una copia da 470,95 € ci stava dentro, la base di prova ne prendeva
 * quattro, la riserva diventava più grande del tetto intero e il budget per le
 * carte andava negativo. Un pool inventato con terre da pochi euro non ha
 * quella soglia, e questi test sarebbero verdi su un motore rotto.
 *
 * Le attese non fissano nessun euro e nessun nome: si ricavano dalla corsa. È
 * la stessa ragione di ADR-0004 applicata ai test — il pool si rigenera, e
 * questi devono restare veri senza che nessuno li riscriva.
 */

const CARTE: readonly Carta[] = interpretaPool(
  JSON.parse(
    readFileSync(fileURLToPath(new URL("../../public/dati/pool.json", import.meta.url)), "utf8"),
  ),
).carte;

/**
 * Le manopole strette: la ricerca fa poche valutazioni e simula poche partite,
 * perché qui si prova una **proprietà** e non la qualità del mazzo. Sono le
 * stesse che usa `costruisci.test.ts`, per la stessa ragione.
 */
const SVELTA: Opzioni = {
  orologio: () => 0,
  taratura: {
    partenze: 1,
    partiteInRicerca: 8,
    valutazioniMassimePerPartenza: 30,
    candidatiMassimi: 30,
  },
};

const GOBLIN: Tema = {
  ...TEMA_VUOTO,
  inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Goblin"] },
};

function conTetto(tettoDiSpesa: number) {
  const richiesta: Richiesta = {
    tema: GOBLIN,
    combo: COMBO_VUOTA,
    seme: 12345,
    tempoMassimoMs: 120_000,
    tettoDiSpesa,
  };
  return costruisciMazzo(richiesta, CARTE, SVELTA);
}

const costo = (mazzo: { carte: readonly { carta: Carta; copie: number }[]; terre: readonly { carta: Carta; copie: number }[] }) =>
  contoDelMazzo([...mazzo.carte, ...mazzo.terre]).minimo;

/**
 * I tetti provati stanno **a cavallo della soglia** che rompeva tutto: uno
 * sotto, uno appena sopra, uno molto sopra. Tre corse, perché ognuna costa
 * secondi veri.
 */
const TETTI = [400, 600, 1200] as const;

describe("la base di terre dentro un budget, sul pool vero", () => {
  const terreDelPool = CARTE.filter((carta) => carta.terra !== null);

  /** La terra base che costa meno di tutte: è il prezzo di un rimpiazzo. */
  const baseMenoCara = Math.min(
    ...terreDelPool
      .filter((carta) => carta.tipi.includes("Basic"))
      .map((carta) => carta.prezzo.euro ?? Number.POSITIVE_INFINITY),
  );

  /**
   * Le terre **non base** che costano meno di qualunque terra base.
   *
   * Si pescano dai dati e non si nominano, come vuole ADR-0004. Sono la ragione
   * per cui questo test esiste: scambiarne una con una terra base alza il conto
   * invece di abbassarlo, e la prima stesura del ticket 20 lo faceva.
   */
  const piuEconomicheDiUnaBase = terreDelPool.filter(
    (carta) =>
      !carta.tipi.includes("Basic") &&
      carta.tag.length > 0 &&
      (carta.prezzo.euro ?? Number.POSITIVE_INFINITY) < baseMenoCara,
  );

  /**
   * Un mazzo costruito **apposta** perché la base voglia quella terra: quaranta
   * copie di carte che fanno quel che fa lei, così la soglia di sinergia è
   * passata e la terra entra fra le scelte.
   */
  function mazzoCheLaVuole(terra: Carta) {
    const affini = CARTE.filter(
      (carta) =>
        carta.terra === null &&
        carta.tag.some((tag) => terra.tag.includes(tag)) &&
        carta.identitaDiColore.length <= 1,
    ).slice(0, 10);
    return affini.map((carta) => ({ carta, copie: 4 }));
  }

  const costoDellaBase = (
    mazzo: readonly { carta: Carta; copie: number }[],
    budget: number | null,
  ) =>
    contoDelMazzo(
      analizzaBaseDiTerre(mazzo, terreDelPool, { terreVolute: 22, budget }).terre,
    ).minimo;

  it("nel pool esiste almeno una terra non base più economica di ogni terra base", () => {
    // Se un giorno non ci fosse più, il test qui sotto diventerebbe una
    // formalità verde: meglio saperlo da questa riga che scoprirlo per caso.
    expect(piuEconomicheDiUnaBase.length).toBeGreaterThan(0);
  });

  it("stringere il budget non fa mai salire il conto della base", () => {
    // Il caso che il pool finto non sa produrre e che qui c'è davvero. Togliere
    // la copia più cara e metterci una terra base sembra sempre un risparmio, e
    // non lo è quando la terra tolta costa **meno** del suo rimpiazzo: il conto
    // sale, la base peggiora, e l'app annuncia all'utente un risparmio che non
    // c'è.
    //
    // Il confronto è fra due budget, e non col conto senza budget: quello di un
    // mazzo che si compra le terre duali sta nelle migliaia di euro, e ogni
    // cifra gli starebbe sotto senza dire niente.
    for (const terra of piuEconomicheDiUnaBase) {
      const mazzo = mazzoCheLaVuole(terra);
      if (mazzo.length === 0) continue;

      // La finestra che conta sta **a cavallo** del prezzo delle sole terre
      // base: sopra, la terra da salvare non è ancora l'ultima cosa rimasta da
      // togliere; sotto, lo diventa, e togliendola il conto sale invece di
      // scendere. Il numero si ricava dai dati e non si scrive.
      const soloBasi = baseMenoCara * 22;
      const passi = [0, 0.5, 0.9, 0.98, 1, 1.02, 1.1, 1.2, 1.5, 2, 5, 50].map(
        (quanto) => soloBasi * quanto,
      );

      let precedente = -1;
      for (const budget of passi) {
        const quanto = costoDellaBase(mazzo, budget);
        expect(quanto, `${terra.nome} a ${budget.toFixed(2)} €`).toBeGreaterThanOrEqual(
          precedente,
        );
        precedente = quanto;
      }
    }
  });
});

describe("il tetto di spesa sul pool vero", () => {
  const corse = TETTI.map((tetto) => ({ tetto, esito: conTetto(tetto) }));

  it("costruisce a ogni tetto, anche molto sopra la soglia che lo rompeva", () => {
    // Prima del ticket 20, da 800 € in su l'app rispondeva «nessun mazzo sta
    // dentro» e consigliava di alzare a quattromila.
    for (const { tetto, esito } of corse) {
      expect(esito.esito, `tetto ${tetto}`).not.toBe("niente-da-costruire");
      expect(esito.mazzi.length, `tetto ${tetto}`).toBeGreaterThan(0);
    }
  });

  it("non consegna mai un mazzo sopra il tetto chiesto", () => {
    // La promessa dura, che reggeva già prima e deve continuare a reggere: è la
    // sola cosa che rende il tetto una risposta e non un suggerimento.
    for (const { tetto, esito } of corse) {
      for (const mazzo of esito.mazzi) {
        // Il mezzo centesimo del ticket 41: il tetto perdona quanto un
        // arrotondamento al centesimo può spostare, perché è al centesimo che
        // il prezzo si mostra e si riscrive. Un euro no, e quel che questa riga
        // continua a vietare è quello.
        expect(costo(mazzo), `tetto ${tetto}`).toBeLessThanOrEqual(tetto + PARI_IN_EURO);
      }
    }
  });

  it("alzare il tetto non dà mai un mazzo meno fedele al tema", () => {
    // È la proprietà che il ticket 20 chiede di inchiodare. Si guarda il mazzo
    // più fedele di ogni corsa — il primo della frontiera — perché è quello che
    // il crollo faceva sprofondare: a 470 € era a tema pieno, a 480 € scendeva
    // sotto la metà.
    const purezze = corse.map(({ esito }) => esito.mazzi[0]!.purezza);

    for (let i = 1; i < purezze.length; i++) {
      expect(purezze[i]!, `da ${TETTI[i - 1]} € a ${TETTI[i]} €`).toBeGreaterThanOrEqual(
        purezze[i - 1]!,
      );
    }
  });

  it("spende di più quando può spendere di più", () => {
    // L'altra faccia della stessa proprietà, e quella che si vede a occhio: col
    // motore rotto un tetto da 500 € produceva un mazzo da 13,80 €.
    const spese = corse.map(({ esito }) => costo(esito.mazzi[0]!));

    for (let i = 1; i < spese.length; i++) {
      expect(spese[i]!, `da ${TETTI[i - 1]} € a ${TETTI[i]} €`).toBeGreaterThanOrEqual(
        spese[i - 1]!,
      );
    }
  });
});
