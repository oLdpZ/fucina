import { describe, expect, it } from "vitest";

import { POOL_DEL_MOTORE, TERRE_FINTE } from "../catalogo/pool-finto.js";
import type { Carta } from "../dati/pool.js";
import { listaDaTorneo } from "./scambio.js";
import { analizzaBaseDiTerre, type CopieDiCarta } from "./base-di-terre.js";
import { budgetPerLeTerre, terreCandidate, terrePermesseDalTema } from "./terre-candidate.js";
import { FILTRO_TEMA_VUOTO, TEMA_VUOTO, type Tema } from "../tema/tema.js";

/**
 * La cucitura che il ticket 19 chiedeva e che non esisteva.
 *
 * Il guasto era che tre posti — il motore, la schermata del mazzo e i mazzi
 * salvati — decidevano **ciascuno per conto proprio** quali terre un mazzo
 * potesse usare, e uno dei tre si era dimenticato due filtri su tre: la lista
 * da consegnare all'arbitro elencava terre che il mazzo mostrato non aveva.
 *
 * Finché quella decisione stava dentro tre componenti, nessun test poteva
 * entrarci: questo progetto non ha test di componenti e non è questo il lavoro
 * per introdurli. Raccogliendola in una funzione la si può provare, ed è la
 * ragione per cui la funzione esiste — non l'eleganza, la verificabilità.
 */

const POOL: readonly Carta[] = [...POOL_DEL_MOTORE, ...TERRE_FINTE];

const tema = (parti: Partial<Tema>): Tema => ({ ...TEMA_VUOTO, ...parti });

/** Il nome di una terra del pool finto che il tema può escludere per colore. */
const terraNera = TERRE_FINTE.find(
  (carta) => carta.terra !== null && carta.identitaDiColore.includes("B"),
) as Carta;

describe("le terre che un mazzo può usare", () => {
  it("sono solo terre, e non le altre carte", () => {
    expect(terreCandidate(POOL, TEMA_VUOTO, null).every((carta) => carta.terra !== null)).toBe(
      true,
    );
    expect(terreCandidate(POOL, TEMA_VUOTO, null).length).toBeGreaterThan(0);
  });

  it("non contengono quel che il tema esclude", () => {
    // È la prima delle due promesse che la lista per l'arbitro violava: chi ha
    // detto «niente nero» le vedeva rispettate nella schermata del mazzo e
    // violate sul foglio da consegnare.
    const senzaNero = tema({ esclusioni: { ...FILTRO_TEMA_VUOTO, colori: ["B"] } });

    expect(terreCandidate(POOL, TEMA_VUOTO, null)).toContain(terraNera);
    expect(terreCandidate(POOL, senzaNero, null)).not.toContain(terraNera);
  });

  it("non contengono quel che il tetto di spesa lascia fuori", () => {
    // La seconda promessa: col tetto acceso una terra troppo cara non entra, e
    // il mazzo consegnato non costa più di quel che l'app ha promesso.
    const cara = TERRE_FINTE.reduce((piu, carta) =>
      (carta.prezzo.euro ?? 0) > (piu.prezzo.euro ?? 0) ? carta : piu,
    );
    const soglia = (cara.prezzo.euro ?? 0) - 0.01;

    expect(terreCandidate(POOL, TEMA_VUOTO, null)).toContain(cara);
    expect(terreCandidate(POOL, TEMA_VUOTO, soglia)).not.toContain(cara);
  });

  it("il tema decide per primo, il prezzo per secondo", () => {
    // I due filtri non sono intercambiabili, ed è la ragione per cui il passo
    // intermedio è esportato: il motore conta **quante** carte il tetto ha
    // lasciato fuori, e per contarle deve averle già tolte al tema.
    const senzaNero = tema({ esclusioni: { ...FILTRO_TEMA_VUOTO, colori: ["B"] } });
    const permesse = terrePermesseDalTema(POOL, senzaNero);

    expect(permesse).not.toContain(terraNera);
    expect(terreCandidate(POOL, senzaNero, 1000)).toEqual(
      permesse.filter((carta) => (carta.prezzo.euro ?? Number.POSITIVE_INFINITY) <= 1000),
    );
  });

  it("una terra senza listino resta fuori appena un tetto c'è", () => {
    // Col tetto acceso l'app promette un conto, e non può promettere quel che
    // non sa contare.
    const senzaPrezzo = TERRE_FINTE.find((carta) => carta.prezzo.euro === null);
    if (senzaPrezzo === undefined) return;

    expect(terreCandidate(POOL, TEMA_VUOTO, null)).toContain(senzaPrezzo);
    expect(terreCandidate(POOL, TEMA_VUOTO, 1000)).not.toContain(senzaPrezzo);
  });
});

describe("quanto la base può spendere", () => {
  const mazzo: CopieDiCarta[] = [
    { carta: POOL_DEL_MOTORE[0] as Carta, copie: 4 },
    { carta: POOL_DEL_MOTORE[1] as Carta, copie: 4 },
  ];

  /** La stessa carta il giorno che la sua ultima copia con listino sparisce. */
  const delistata = (voce: CopieDiCarta): CopieDiCarta => ({
    ...voce,
    carta: { ...voce.carta, prezzo: { ...voce.carta.prezzo, euro: null } },
  });

  it("è quel che resta del tetto dopo le carte", () => {
    const carte = mazzo.reduce(
      (somma, voce) => somma + (voce.carta.prezzo.euro ?? 0) * voce.copie,
      0,
    );

    expect(budgetPerLeTerre(mazzo, 100)?.euro).toBeCloseTo(100 - carte, 6);
  });

  it("non scende sotto zero quando le carte hanno già sfondato il tetto", () => {
    // Un budget negativo è quel che rompeva la ricerca prima del ticket 20:
    // non deve poter rientrare da questa porta.
    expect(budgetPerLeTerre(mazzo, 0)?.euro).toBe(0);
  });

  it("non c'è quando il tetto è spento", () => {
    expect(budgetPerLeTerre(mazzo, null)).toBeNull();
  });

  it("non nomina nessuna carta quando le sa contare tutte", () => {
    // Vuoto è la notizia buona: il numero accanto è il resto vero, e chi lo
    // mostra può promettere che le terre ci stanno dentro.
    expect(budgetPerLeTerre(mazzo, 100)?.incontabili).toEqual([]);
  });

  it("nomina la carta che non sa contare, invece di contarla zero", () => {
    // Il ticket 38: fuori dalla ricerca nessuno ha già rifiutato questo mazzo,
    // e un numero nudo qui sarebbe un resto più largo del vero sotto una riga
    // che promette il contrario.
    const incontabile = delistata(mazzo[0] as CopieDiCarta);
    const budget = budgetPerLeTerre([incontabile, mazzo[1] as CopieDiCarta], 100);

    expect(budget?.incontabili.map((carta) => carta.nome)).toEqual([incontabile.carta.nome]);
  });

  it("il numero resta quel che è: è la promessa a cadere, non il mazzo dell'utente", () => {
    // Non si tocca la base di terre di un mazzo salvato perché un listino è
    // sparito da Cardmarket: il mazzo è dell'utente. Quel che cade è la riga
    // che promette che le terre ci stanno dentro.
    const incontabile = delistata(mazzo[0] as CopieDiCarta);
    const altra = mazzo[1] as CopieDiCarta;
    const resto = 100 - (altra.carta.prezzo.euro ?? 0) * altra.copie;

    expect(budgetPerLeTerre([incontabile, altra], 100)?.euro).toBeCloseTo(resto, 6);
  });
});

describe("la lista da consegnare all'arbitro", () => {
  /**
   * Un mazzo **nero**, perché la terra da escludere è nera: una base non mette
   * mai una palude in un mazzo che il nero non lo chiede, e il test guarderebbe
   * un elenco in cui quella terra non c'era comunque.
   */
  const NERE = POOL_DEL_MOTORE.filter((carta) => carta.identitaDiColore.includes("B")).slice(
    0,
    2,
  );

  /**
   * Il guasto del ticket 19, provato dalla catena intera: le terre candidate,
   * la base che le sceglie, e la lista che ne esce. Sono le tre funzioni che
   * `MazziSalvati` mette in fila, e qui si mettono in fila senza il componente.
   */
  function listaDi(tema: Tema, tetto: number | null): string {
    const mazzo: CopieDiCarta[] = NERE.map((carta) => ({ carta, copie: 19 }));
    const base = analizzaBaseDiTerre(mazzo, terreCandidate(POOL, tema, tetto), {
      terreVolute: 22,
      budget: budgetPerLeTerre(mazzo, tetto)?.euro ?? null,
    });
    return listaDaTorneo(
      base.righe.map((riga) => ({ nome: riga.carta.nome, copie: riga.copie })),
      base.terre.map((voce) => ({ nome: voce.carta.nome, copie: voce.copie })),
      { nome: "Finto", impronta: "finto/xx" },
    );
  }

  it("non nomina una terra che il tema esclude", () => {
    // La casella che il ticket 19 chiedeva per nome. Il guasto vero, misurato
    // sul pool vero, era di due ordini di grandezza: 59,58 € di terre sullo
    // schermo contro 6 525,09 € sul foglio.
    const senzaNero = tema({ esclusioni: { ...FILTRO_TEMA_VUOTO, colori: ["B"] } });

    expect(listaDi(TEMA_VUOTO, null)).toContain(terraNera.nome);
    expect(listaDi(senzaNero, null)).not.toContain(terraNera.nome);
  });
});
