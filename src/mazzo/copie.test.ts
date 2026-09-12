import { describe, expect, it } from "vitest";

import { POOL_FINTO } from "../catalogo/pool-finto.js";
import type { Carta } from "../dati/pool.js";
import {
  copieAlMassimo,
  copieInMano,
  copieMassime,
  entraInMano,
  leggiTettoDiCopie,
  tettoInMano,
} from "./copie.js";
import { COPIE_MASSIME, DIMENSIONE_MAZZO } from "./taratura.js";

const QUALUNQUE = POOL_FINTO[0]!;

function conTetto(tettoDiCopie: number | null): Carta {
  return { ...QUALUNQUE, tettoDiCopie, terra: null };
}

const UNA_TERRA: Carta = {
  ...QUALUNQUE,
  tipi: ["Land"],
  tettoDiCopie: null,
  terra: { produce: ["R"], entraGirata: false },
} as unknown as Carta;

/**
 * Una terra che la preparazione non ha saputo leggere: il tipo dice Land, il
 * campo `terra` è vuoto. Non è un caso di scuola — `prepara-pool` riempie quel
 * campo solo se ci riesce, e un pool vecchio o scritto a mano arriva così.
 */
const TERRA_NON_LETTA: Carta = {
  ...QUALUNQUE,
  tipi: ["Land"],
  terra: null,
} as unknown as Carta;

describe("leggiTettoDiCopie", () => {
  it("di norma sono quattro", () => {
    expect(leggiTettoDiCopie("", ["Creature"])).toBe(COPIE_MASSIME);
  });

  it("non c'è tetto per la carta che se lo concede da sé", () => {
    // La frase è quella stampata sulle carte vere; il nome è inventato perché i
    // nomi cambiano e questo test deve sopravvivere al cambio.
    const testo =
      "A deck can have any number of cards named Warren Multiplier.";
    expect(leggiTettoDiCopie(testo, ["Creature"])).toBeNull();
  });

  it("non basta parlare di numeri per avere il permesso", () => {
    expect(leggiTettoDiCopie("Draw any number of cards.", ["Instant"])).toBe(
      COPIE_MASSIME,
    );
  });

  it("non c'è tetto per le terre base", () => {
    expect(leggiTettoDiCopie("({T}: Add {W}.)", ["Basic", "Land"])).toBeNull();
  });

  it("le terre che base non sono hanno il tetto di tutti", () => {
    expect(leggiTettoDiCopie("", ["Land"])).toBe(COPIE_MASSIME);
  });
});

describe("copieMassime", () => {
  it("legge il tetto dalla carta, senza rifare il conto", () => {
    expect(copieMassime(conTetto(COPIE_MASSIME))).toBe(COPIE_MASSIME);
    // Il numero viene dal pool, quindi qualunque numero il pool scriva vale: è
    // così che le carte limitate a una copia entreranno senza toccare il motore.
    expect(copieMassime(conTetto(1))).toBe(1);
  });

  it("legge il «senza tetto» come un tetto che non ferma nessuno", () => {
    expect(copieMassime(conTetto(null))).toBe(Number.POSITIVE_INFINITY);
  });

  it("non guarda il testo della carta", () => {
    // Il permesso scritto nel testo è già stato letto dalla preparazione: se lo
    // rileggesse anche qui, il tetto avrebbe due padroni.
    const carta: Carta = {
      ...conTetto(COPIE_MASSIME),
      testo: "A deck can have any number of cards named Warren Multiplier.",
    };
    expect(copieMassime(carta)).toBe(COPIE_MASSIME);
  });
});

describe("copieAlMassimo", () => {
  it("di norma sono quattro", () => {
    expect(copieAlMassimo(conTetto(COPIE_MASSIME))).toBe(COPIE_MASSIME);
  });

  it("su una carta limitata è una, e non quattro", () => {
    // È il numero che il motore mette nel mazzo **e** quello che la schermata
    // della combo promette: se le due letture divergessero, l'app prometterebbe
    // quattro copie di una carta che poi ne mette una.
    expect(copieAlMassimo(conTetto(1))).toBe(1);
  });

  it("su una carta senza tetto si ferma comunque a quattro", () => {
    // Trentatré copie della stessa carta sono un mazzo legale che non è un
    // mazzo: di lì non si parte, e non si promette.
    expect(copieAlMassimo(conTetto(null))).toBe(COPIE_MASSIME);
  });
});

/**
 * Ticket 51. Che le terre non entrino nel mazzo tenuto in mano è una regola
 * sola, e fino a qui se la ricordavano in quattro posti diversi: il comando
 * delle copie, il filtro del motore, la riapertura di un mazzo salvato e il
 * conto della base. Quattro memorie separate della stessa regola sono quattro
 * occasioni di dimenticarla in tre.
 *
 * Qui la regola si legge da un posto solo, ed è **provata** invece che ripetuta.
 */
describe("quel che la mano tiene", () => {
  it("le terre non entrano nel mazzo tenuto in mano", () => {
    // La base la sceglie l'app dalla curva: una terra in questo elenco sarebbe
    // una carta contata, salvata ed esportata senza che la si veda mai.
    expect(entraInMano(UNA_TERRA)).toBe(false);
    expect(entraInMano(conTetto(COPIE_MASSIME))).toBe(true);
  });

  it("una terra resta una terra anche se l'app non sa che mana produce", () => {
    // Il campo `terra` è quel che la preparazione ha saputo **leggere**; il tipo
    // è quel che la carta **è**. Guardando solo il primo, una terra di un pool
    // vecchio entrava in mano — e da lì non si vedeva e non si toglieva più.
    expect(entraInMano(TERRA_NON_LETTA)).toBe(false);
    expect(copieInMano(TERRA_NON_LETTA, 4)).toBe(0);
  });

  it("di una terra la mano non ne tiene nemmeno una, per quante gliene si chiedano", () => {
    expect(copieInMano(UNA_TERRA, 4)).toBe(0);
    expect(copieInMano(UNA_TERRA, 1)).toBe(0);
    // Le terre base non hanno tetto di copie: se la regola fosse solo un tetto,
    // qui passerebbero tutte.
    expect(copieInMano(UNA_TERRA, DIMENSIONE_MAZZO)).toBe(0);
  });

  it("di una carta normale ne tiene quante il suo tetto ne ammette", () => {
    expect(copieInMano(conTetto(COPIE_MASSIME), 2)).toBe(2);
    expect(copieInMano(conTetto(COPIE_MASSIME), 9)).toBe(COPIE_MASSIME);
    expect(copieInMano(conTetto(1), 4)).toBe(1);
  });

  it("una carta senza tetto si ferma al mazzo, non all'infinito", () => {
    // «Quante ne vuoi» vuol dire quante ne sta in un mazzo: oltre non c'è posto.
    expect(copieInMano(conTetto(null), 999)).toBe(DIMENSIONE_MAZZO);
  });

  it("sotto zero non si scende", () => {
    expect(copieInMano(conTetto(COPIE_MASSIME), -1)).toBe(0);
    expect(copieInMano(conTetto(COPIE_MASSIME), 0)).toBe(0);
  });
});

describe("tettoInMano", () => {
  it("è zero per una terra, che in mano non ci va", () => {
    expect(tettoInMano(UNA_TERRA)).toBe(0);
  });

  it("è il tetto della carta quando ci sta nel mazzo", () => {
    expect(tettoInMano(conTetto(COPIE_MASSIME))).toBe(COPIE_MASSIME);
    expect(tettoInMano(conTetto(1))).toBe(1);
  });

  it("per una carta senza tetto è il mazzo intero, non l'infinito", () => {
    // È il numero che i bottoni leggono per spegnersi: `Infinity` li lasciava
    // accesi per sempre, su un passo che `copieInMano` non avrebbe più fatto.
    expect(tettoInMano(conTetto(null))).toBe(DIMENSIONE_MAZZO);
  });
});
