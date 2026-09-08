import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { COMBO_VUOTA } from "../combo/combo.js";
import { interpretaPool } from "../dati/carica-pool.js";
import type { Carta } from "../dati/pool.js";
import { DIMENSIONE_MAZZO } from "../mazzo/taratura.js";
import { costruisciMazzo, type Opzioni, type Richiesta } from "../ricerca/costruisci.js";
import { valutaTema } from "./ampiezza.js";
import { GALLERIA, galleriaContata } from "./galleria.js";
import { carteDelTema, eTerra, risolviTema, temaDichiarato } from "./tema.js";

/**
 * La galleria provata **sul pool vero**, e non su un pool inventato.
 *
 * Qui il pool finto non servirebbe a niente, e non per pigrizia: la galleria è
 * una promessa fatta su **queste** ottocento carte — «questi otto temi nel tuo
 * pool esistono davvero» — e provarla altrove proverebbe una promessa che
 * nessuno ha fatto. Il ticket 13 lo dice come un guasto: «un tema in galleria
 * che non sta in piedi è un guasto», e il solo posto dove quel guasto si vede è
 * il pool che l'app apre.
 *
 * Le attese non fissano nessun numero e nessun nome: si ricavano dalla corsa,
 * come in `catalogo/pool-vero.test.ts` e per la stessa ragione (ADR-0004). Il
 * giorno che il documento di formato cambia una riga, questi test devono
 * diventare rossi solo se una voce ha smesso di reggere — non perché un numero
 * copiato a mano è invecchiato.
 */

const CARTE: readonly Carta[] = interpretaPool(
  JSON.parse(
    readFileSync(fileURLToPath(new URL("../../public/dati/pool.json", import.meta.url)), "utf8"),
  ),
).carte;

/**
 * Le manopole strette: qui si prova che un mazzo **esce**, non quanto sia bello.
 * Sono le stesse di `ricerca/tetto-di-spesa-sul-pool-vero.test.ts`, perché la
 * domanda è la stessa — otto corse vere costano secondi veri.
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

const QUANTE_VOCI = 8;

describe("il pool su cui la galleria promette", () => {
  it("è quello vero, e non un file vuoto o di prova", () => {
    // Senza questo, «ogni tema sta in piedi» sarebbe vero anche su zero temi
    // contati su zero carte: il modo in cui un file di test smette di
    // proteggere qualcosa restando verde.
    expect(CARTE.length).toBeGreaterThan(500);
  });
});

describe("la galleria dei temi", () => {
  it("ne porta otto, come il ticket chiede", () => {
    expect(GALLERIA).toHaveLength(QUANTE_VOCI);
  });

  it("ogni voce ha un nome e una promessa, e nessuno si ripete", () => {
    for (const voce of GALLERIA) {
      expect(voce.nome.trim()).not.toBe("");
      expect(voce.promessa.trim()).not.toBe("");
    }
    expect(new Set(GALLERIA.map((voce) => voce.nome)).size).toBe(QUANTE_VOCI);
    expect(new Set(GALLERIA.map((voce) => voce.promessa)).size).toBe(QUANTE_VOCI);
  });

  it("ogni voce è un tema dichiarato: toccarla dice davvero qualcosa", () => {
    for (const voce of GALLERIA) {
      expect(temaDichiarato(voce.tema), voce.nome).toBe(true);
    }
  });

  it("nessuna voce parte da una carta-seme, che sarebbe un nome di carta nel sorgente", () => {
    // ADR-0004: i nomi delle carte stanno nei dati. Un tema di galleria che
    // nascesse da una carta si svuoterebbe da sé il giorno che quella carta
    // esce dal documento di formato, e nel frattempo avrebbe scritto il suo
    // nome in un file `.ts`.
    for (const voce of GALLERIA) {
      expect(voce.tema.seme, voce.nome).toBeNull();
    }
  });

  it("nessuna voce arriva già allargata: un allargamento lo accetta l'utente", () => {
    for (const voce of GALLERIA) {
      expect(voce.tema.allargamenti, voce.nome).toEqual([]);
    }
  });

  it("le otto voci non sono la stessa selezione scritta in otto modi", () => {
    // Due voci che prendono le stesse carte sarebbero due volte lo stesso mazzo
    // nella schermata che esiste per mostrare otto strade diverse.
    const impronte = GALLERIA.map((voce) =>
      carteDelTema(
        CARTE.filter((carta) => !eTerra(carta)),
        risolviTema(voce.tema, CARTE),
      )
        .map((carta) => carta.nome)
        .sort()
        .join("|"),
    );
    expect(new Set(impronte).size).toBe(QUANTE_VOCI);
  });
});

describe("ogni tema della galleria sta in piedi sul pool vero", () => {
  it.each(GALLERIA.map((voce) => [voce.nome, voce] as const))(
    "«%s» non fa scattare nessun avviso: il verdetto è ampio",
    (_nome, voce) => {
      const ampiezza = valutaTema(CARTE, voce.tema);
      // «Ampio» e non solo «non impossibile»: un tema stretto in galleria
      // aprirebbe l'app con l'avviso già acceso, che è il guasto che questa
      // schermata esiste per togliere. E un tema ampio non ha allargamenti da
      // proporre, perché non ne ha bisogno.
      expect(ampiezza.verdetto).toBe("ampio");
      expect(ampiezza.allargamenti).toEqual([]);
      expect(ampiezza.carteDisponibili).toBeGreaterThanOrEqual(ampiezza.carteComode);
    },
  );

  it.each(GALLERIA.map((voce) => [voce.nome, voce] as const))(
    "«%s» consegna davvero un mazzo legale",
    (_nome, voce) => {
      const richiesta: Richiesta = {
        tema: voce.tema,
        combo: COMBO_VUOTA,
        seme: 13,
        tempoMassimoMs: 120_000,
        tettoDiSpesa: null,
      };
      const frontiera = costruisciMazzo(richiesta, CARTE, SVELTA);

      expect(frontiera.mazzi.length).toBeGreaterThan(0);
      for (const mazzo of frontiera.mazzi) {
        const copie = [...mazzo.carte, ...mazzo.terre].reduce(
          (somma, voce) => somma + voce.copie,
          0,
        );
        expect(copie).toBe(DIMENSIONE_MAZZO);
      }
    },
    30_000,
  );
});

describe("il conto delle carte", () => {
  it("viene dal pool e non dal sorgente: cambia il pool, cambia il conto", () => {
    const contata = galleriaContata(CARTE);
    expect(contata).toHaveLength(QUANTE_VOCI);
    for (const { voce, ampiezza } of contata) {
      expect(ampiezza, voce.nome).toEqual(valutaTema(CARTE, voce.tema));
    }

    // Su un pool di due carte nessuna voce regge, e la galleria lo dice invece
    // di continuare a promettere il numero di ieri.
    const briciole = galleriaContata(CARTE.slice(0, 2));
    for (const { voce, ampiezza } of briciole) {
      expect(ampiezza.verdetto, voce.nome).toBe("impossibile");
    }
  });
});
