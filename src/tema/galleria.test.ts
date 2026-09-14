import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { TAG_IN_ORDINE } from "../catalogo/vocabolario.js";
import { COMBO_VUOTA } from "../combo/combo.js";
import { interpretaPool } from "../dati/carica-pool.js";
import type { Carta, Tag } from "../dati/pool.js";
import { DIMENSIONE_MAZZO } from "../mazzo/taratura.js";
import { costruisciMazzo, type Opzioni, type Richiesta } from "../ricerca/costruisci.js";
import { valutaTema } from "./ampiezza.js";
import { GALLERIA, galleriaContata, type VoceDiGalleria } from "./galleria.js";
import {
  carteDelTema,
  eTerra,
  FILTRO_TEMA_VUOTO,
  risolviTema,
  temaDichiarato,
  TEMA_VUOTO,
  type Tema,
} from "./tema.js";

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

/**
 * Quante carte del pool una voce porta dentro **per un tag solo dei suoi**,
 * contate come le conta il motore.
 *
 * Il conto si fa rifacendo il tema della voce con quell'unico tag, e non
 * filtrando le carte a mano: le categorie di un `FiltroTema` si sommano in and,
 * e «Prosciugare» è nera. Contare `rimozione-mirata` sul pool intero darebbe 69
 * dove la voce ne vede 19, e su un numero sbagliato di cinquanta carte non si
 * regge nessun criterio.
 */
function carteDellaVocePerTag(voce: VoceDiGalleria, tag: Tag): number {
  const soloQuello: Tema = {
    ...voce.tema,
    inclusioni: { ...voce.tema.inclusioni, tag: [tag] },
  };
  return carteDelTema(CARTE, risolviTema(soloQuello, CARTE)).length;
}

/** Le carte che un tag porta dentro **su tutto il pool**, senza nessuna restrizione. */
function carteDelPoolPerTag(tag: Tag): number {
  const nudo: Tema = { ...TEMA_VUOTO, inclusioni: { ...FILTRO_TEMA_VUOTO, tag: [tag] } };
  return carteDelTema(CARTE, risolviTema(nudo, CARTE)).length;
}

describe("ogni voce seleziona quel che la sua promessa nomina", () => {
  /**
   * **Il criterio del ticket 71**, e la ragione per cui è un test e non un
   * commento.
   *
   * «Controllare» univa quattro tag e il più numeroso era `rimozione-mirata` —
   * l'unico dei quattro che la promessa non nomina. Il mazzo che ne usciva aveva
   * purezza 1,000 e non una contromagia: perfettamente dentro il tema e
   * perfettamente fuori dalla promessa.
   *
   * Non è una regola sulla cardinalità. Una voce può essere dominata da un tag
   * solo e stare benissimo — «Reggere l'urto» lo è al 76% da `previene-il-danno`,
   * che **è** la sua promessa. Quel che rompe una promessa è che a comandare sia
   * un tag che la promessa non nomina.
   *
   * Quel che deve reggere non è la cifra ma **l'ordine**, ed è per questo che qui
   * non c'è scritto nessun numero: i conti si rifanno sul pool a ogni corsa.
   * Sono già cambiati due volte in una settimana (ticket 73 e 75), e i margini
   * sono sottili — tre carte su «Prosciugare», quattro su «Controllare».
   */
  it.each(GALLERIA.map((voce) => [voce.nome, voce] as const))(
    "«%s» è comandata da un tag che la sua promessa nomina",
    (_nome, voce) => {
      const tag = voce.tema.inclusioni.tag;
      // Una voce senza tag non ha un tag più numeroso, e il criterio su di lei
      // non dice niente: «Gli artefatti» seleziona per tipo. Non è un caso
      // fallito, è un caso vuoto, e passa senza chiedere niente.
      if (tag.length === 0) return;

      const conti = tag.map((t) => ({ tag: t, carte: carteDellaVocePerTag(voce, t) }));
      const piuNumerose = Math.max(...conti.map((c) => c.carte));
      // A pari merito comandano tutti: basta che uno di quelli in testa sia
      // nominato, perché a comandare c'è allora un tag che la promessa nomina.
      const inTesta = conti.filter((c) => c.carte === piuNumerose);

      expect(
        inTesta.some((c) => voce.nominati.includes(c.tag)),
        `${voce.nome}: in testa ${inTesta.map((c) => `${c.tag} (${c.carte})`).join(", ")}, ` +
          `ma la promessa nomina ${voce.nominati.join(", ") || "niente"}`,
      ).toBe(true);
    },
  );

  it("conta dentro le restrizioni della voce, non sul pool intero", () => {
    // Senza questo niente terrebbe il conto dentro il tema: contare i tag sul
    // pool intero lascerebbe il criterio verde e lo farebbe rispondere di una
    // voce che non esiste. «Prosciugare» è nera, e la sua rimozione mirata è
    // una parte di quella del pool — il numero giusto è il più piccolo.
    const conRestrizioni = GALLERIA.filter(
      (voce) =>
        voce.tema.inclusioni.tag.length > 0 &&
        (voce.tema.inclusioni.colori.length > 0 ||
          voce.tema.inclusioni.tipi.length > 0 ||
          voce.tema.inclusioni.sottotipi.length > 0),
    );
    // Se un giorno nessuna voce restringesse più niente, questo test passerebbe
    // a vuoto senza dirlo: meglio rosso e da riscrivere.
    expect(conRestrizioni.length).toBeGreaterThan(0);

    const strette = conRestrizioni.flatMap((voce) =>
      voce.tema.inclusioni.tag.map((tag) => ({
        voce: voce.nome,
        tag,
        nella: carteDellaVocePerTag(voce, tag),
        nelPool: carteDelPoolPerTag(tag),
      })),
    );

    // Questa è la proprietà del **codice**, e vale per ogni tag di ogni voce:
    // restringere non può far crescere un conto.
    for (const { voce, tag, nella, nelPool } of strette) {
      expect(nella, `${voce}/${tag}`).toBeLessThanOrEqual(nelPool);
    }

    // E questa è il canarino, chiesto **una volta sola** su tutta la galleria e
    // non voce per voce. La differenza conta: che una restrizione tolga davvero
    // delle carte dipende dal pool, non dal codice. Una voce rossa che chiedesse
    // `danno-diretto` — tutte carte già rosse — avrebbe `nella === nelPool` sul
    // suo unico tag pur contando benissimo, e chiederglielo la farebbe rossa per
    // un fatto del pool invece che per un guasto.
    expect(
      strette.some(({ nella, nelPool }) => nella < nelPool),
      "nessuna restrizione della galleria toglie niente a nessun tag: il conto non le sta guardando",
    ).toBe(true);
  });

  it("nessuna voce nomina un tag che non esiste nel vocabolario", () => {
    // Un refuso in `nominati` renderebbe il criterio verde per la ragione
    // peggiore: un tag che non si chiama così non comanda mai niente.
    for (const voce of GALLERIA) {
      for (const tag of voce.nominati) {
        expect(TAG_IN_ORDINE, `${voce.nome}: ${tag}`).toContain(tag);
      }
    }
  });

  it("nessuna voce nomina due volte lo stesso tag", () => {
    for (const voce of GALLERIA) {
      expect(new Set(voce.nominati).size, voce.nome).toBe(voce.nominati.length);
    }
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
