/**
 * Le probabilità della base di terre, verificate su casi con risposta nota.
 *
 * Ogni valore atteso qui sotto è scritto come **formula ipergeometrica**, non
 * copiato da un'esecuzione: se il codice cambia idea, il test se ne accorge.
 * È la richiesta esplicita del ticket 06 e di `spec.md` — «casi ipergeometrici
 * con risposta calcolabile a penna».
 */

import { describe, expect, it, vi } from "vitest";

import { probabilitaDiLanciare, probabilitaDiPescarne } from "./probabilita.js";

/** C(n, k) esatto per i numeri piccoli dei test: nessun logaritmo, nessun dubbio. */
function combinazioni(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  let risultato = 1n;
  for (let i = 0n; i < BigInt(k); i++) {
    risultato = (risultato * BigInt(n - Number(i))) / (i + 1n);
  }
  return risultato;
}

/** Il rapporto fra due combinazioni, in virgola mobile. */
function rapporto(sopra: bigint, sotto: bigint): number {
  return Number(sopra) / Number(sotto);
}

const MONTAGNA = { copie: 24, produce: ["R"] as const, girata: false };

describe("probabilitaDiLanciare", () => {
  it("con sole terre dritte di un colore, dà l'ipergeometrica scritta a penna", () => {
    // Una carta da {R}: al turno 1 si sono viste 7 carte, e serve almeno una
    // delle 24 Montagne. P = 1 − C(36,7)/C(60,7).
    const attesa = 1 - rapporto(combinazioni(36, 7), combinazioni(60, 7));

    const avuta = probabilitaDiLanciare({
      dimensioneMazzo: 60,
      terre: [{ ...MONTAGNA, produce: ["R"] }],
      pips: [["R"]],
      valoreDiMana: 1,
      turno: 1,
    });

    expect(avuta).toBeCloseTo(attesa, 12);
    expect(attesa).toBeCloseTo(0.9784, 4);
  });

  it("per una carta da due mana dello stesso colore chiede due fonti", () => {
    // {R}{R} al turno 2: 8 carte viste, servono almeno 2 Montagne su 24.
    const senzaNessuna = combinazioni(36, 8);
    const conUnaSola = 24n * combinazioni(36, 7);
    const attesa = 1 - rapporto(senzaNessuna + conUnaSola, combinazioni(60, 8));

    const avuta = probabilitaDiLanciare({
      dimensioneMazzo: 60,
      terre: [{ ...MONTAGNA, produce: ["R"] }],
      pips: [["R"], ["R"]],
      valoreDiMana: 2,
      turno: 2,
    });

    expect(avuta).toBeCloseTo(attesa, 12);
  });

  it("per un costo generico conta solo quante terre si sono viste", () => {
    // {2} al turno 2 non chiede colori: bastano 2 terre qualsiasi fra le 8
    // carte viste. Stessa formula del caso sopra, e non è un caso: le uniche
    // terre del mazzo sono Montagne.
    const attesa =
      1 - rapporto(combinazioni(36, 8) + 24n * combinazioni(36, 7), combinazioni(60, 8));

    const avuta = probabilitaDiLanciare({
      dimensioneMazzo: 60,
      terre: [{ ...MONTAGNA, produce: ["R"] }],
      pips: [],
      valoreDiMana: 2,
      turno: 2,
    });

    expect(avuta).toBeCloseTo(attesa, 12);
  });
});

describe("le terre che entrano girate", () => {
  it("non producono mana il turno in cui si giocano", () => {
    // Ventiquattro Montagne che entrano tutte girate: al turno 1 la terra
    // appena giocata è girata, e una carta da {R} non parte mai.
    const avuta = probabilitaDiLanciare({
      dimensioneMazzo: 60,
      terre: [{ copie: 24, produce: ["R"], girata: true }],
      pips: [["R"]],
      valoreDiMana: 1,
      turno: 1,
    });

    expect(avuta).toBe(0);
  });

  it("al turno 1 chiedono che la terra giocata sia una di quelle dritte", () => {
    // Dodici Montagne dritte e dodici girate: serve una delle dodici dritte
    // fra le 7 carte viste. P = 1 − C(48,7)/C(60,7).
    const attesa = 1 - rapporto(combinazioni(48, 7), combinazioni(60, 7));

    const avuta = probabilitaDiLanciare({
      dimensioneMazzo: 60,
      terre: [
        { copie: 12, produce: ["R"], girata: false },
        { copie: 12, produce: ["R"], girata: true },
      ],
      pips: [["R"]],
      valoreDiMana: 1,
      turno: 1,
    });

    expect(avuta).toBeCloseTo(attesa, 12);
  });

  it("al turno 2 valgono come terre, purché una sola sia dritta", () => {
    // {1}{R} al turno 2, 8 carte viste, 12 Montagne dritte e 12 girate.
    // Servono almeno due terre e almeno una dritta:
    //   1 − P(meno di due terre) − P(nessuna dritta) + P(nessuna dritta e meno di due terre)
    const sotto = combinazioni(60, 8);
    const menoDiDueTerre = combinazioni(36, 8) + 24n * combinazioni(36, 7);
    const nessunaDritta = combinazioni(48, 8);
    const nessunaDrittaEMenoDiDueTerre = combinazioni(36, 8) + 12n * combinazioni(36, 7);
    const attesa =
      1 -
      rapporto(menoDiDueTerre, sotto) -
      rapporto(nessunaDritta, sotto) +
      rapporto(nessunaDrittaEMenoDiDueTerre, sotto);

    const avuta = probabilitaDiLanciare({
      dimensioneMazzo: 60,
      terre: [
        { copie: 12, produce: ["R"], girata: false },
        { copie: 12, produce: ["R"], girata: true },
      ],
      pips: [["R"]],
      valoreDiMana: 2,
      turno: 2,
    });

    expect(avuta).toBeCloseTo(attesa, 12);
  });

  it("una terra dritta che non fa il colore giusto non salva un costo tutto colorato", () => {
    // {R}{R} al turno 2: si giocano due terre e servono due fonti di rosso,
    // quindi entrambe le terre giocate sono Montagne girate. Le due terre
    // dritte del mazzo non producono rosso e non c'è posto per giocarle:
    // la carta non parte mai, per quante Montagne si peschino.
    const avuta = probabilitaDiLanciare({
      dimensioneMazzo: 60,
      terre: [
        { copie: 2, produce: ["C"], girata: false },
        { copie: 22, produce: ["R"], girata: true },
      ],
      pips: [["R"], ["R"]],
      valoreDiMana: 2,
      turno: 2,
    });

    expect(avuta).toBe(0);
  });
});

describe("provare a lanciarla più tardi del suo turno", () => {
  it("una carta da un mana è più facile al turno 3 che al turno 1", () => {
    // Le carte viste crescono di una per turno: aspettare non può peggiorare le
    // cose. Se questo numero scendesse, il conto starebbe misurando il turno e
    // non la carta.
    const terre = [{ copie: 24, produce: ["R"] as const, girata: false }];
    const alPrimo = probabilitaDiLanciare({
      dimensioneMazzo: 60,
      terre,
      pips: [["R"]],
      valoreDiMana: 1,
      turno: 1,
    });
    const alTerzo = probabilitaDiLanciare({
      dimensioneMazzo: 60,
      terre,
      pips: [["R"]],
      valoreDiMana: 1,
      turno: 3,
    });

    expect(alTerzo).toBeGreaterThan(alPrimo);
  });

  it("con tutte le terre girate, al turno 2 la carta da un mana parte", () => {
    // La terra del primo turno è girata quel turno, ma al secondo produce. Con
    // due terre in mano se ne gioca una al turno 1 e si lancia al turno 2:
    // serve solo che almeno due Montagne stiano nelle 8 carte viste.
    const senzaNessuna = combinazioni(36, 8);
    const conUnaSola = 24n * combinazioni(36, 7);
    const attesa = 1 - rapporto(senzaNessuna + conUnaSola, combinazioni(60, 8));

    const avuta = probabilitaDiLanciare({
      dimensioneMazzo: 60,
      terre: [{ copie: 24, produce: ["R"], girata: true }],
      pips: [["R"]],
      valoreDiMana: 1,
      turno: 2,
    });

    expect(avuta).toBeCloseTo(attesa, 12);
  });
});

describe("probabilitaDiPescarne", () => {
  it("le quattro copie in mano al primo turno: il conto noto a penna", () => {
    // Sette carte viste, quattro copie su sessanta: uno meno la probabilità che
    // le sette vengano tutte dalle cinquantasei che non sono lei.
    const attesa = 1 - rapporto(combinazioni(56, 7), combinazioni(60, 7));

    expect(probabilitaDiPescarne(60, 4, 1)).toBeCloseTo(attesa, 12);
    // È il numero che ogni giocatore conosce: quattro copie si aprono in mano
    // due volte su cinque.
    expect(probabilitaDiPescarne(60, 4, 1)).toBeCloseTo(0.399, 3);
  });

  it("più copie e più turni la fanno salire, e non scende mai", () => {
    expect(probabilitaDiPescarne(60, 4, 1)).toBeGreaterThan(probabilitaDiPescarne(60, 2, 1));
    expect(probabilitaDiPescarne(60, 2, 4)).toBeGreaterThan(probabilitaDiPescarne(60, 2, 1));
  });

  it("i casi estremi rispondono senza inventare", () => {
    expect(probabilitaDiPescarne(60, 0, 3)).toBe(0);
    expect(probabilitaDiPescarne(60, 60, 1)).toBe(1);
    // Viste tutte le carte del mazzo, la copia c'è di sicuro.
    expect(probabilitaDiPescarne(10, 1, 20)).toBeCloseTo(1, 12);
  });
});

/**
 * Il conto è ricordato fra una chiamata e l'altra, ed è quel che ha reso la
 * frontiera sei volte più veloce. Il rischio di ricordare è uno solo, ed è
 * grave: che due domande **diverse** finiscano sulla stessa risposta perché la
 * chiave che le distingue ha dimenticato un campo.
 *
 * Il test lo esclude nel solo modo che vale: ogni domanda si rifà in un modulo
 * appena caricato, che di quella domanda non sa niente e non ha visto le altre.
 * Se la risposta ricordata coincide con quella calcolata da solo, la chiave
 * distingue tutto quel che deve.
 */
describe("il conto ricordato", () => {
  const MONTAGNE = { copie: 24, produce: ["R"] as const, girata: false };
  const PALUDI = { copie: 10, produce: ["B"] as const, girata: false };
  const GIRATA = { copie: 4, produce: ["R", "B"] as const, girata: true };

  /** Domande che differiscono per **un campo alla volta**: è lì che una chiave sbaglia. */
  const DOMANDE = [
    { dimensioneMazzo: 60, terre: [MONTAGNE], pips: [["R"] as const], valoreDiMana: 1, turno: 1 },
    { dimensioneMazzo: 60, terre: [MONTAGNE], pips: [["R"] as const], valoreDiMana: 1, turno: 2 },
    { dimensioneMazzo: 60, terre: [MONTAGNE], pips: [["R"] as const], valoreDiMana: 2, turno: 2 },
    { dimensioneMazzo: 40, terre: [MONTAGNE], pips: [["R"] as const], valoreDiMana: 1, turno: 1 },
    { dimensioneMazzo: 60, terre: [{ ...MONTAGNE, copie: 23 }], pips: [["R"] as const], valoreDiMana: 1, turno: 1 },
    { dimensioneMazzo: 60, terre: [{ ...MONTAGNE, girata: true }], pips: [["R"] as const], valoreDiMana: 1, turno: 1 },
    { dimensioneMazzo: 60, terre: [PALUDI], pips: [["B"] as const], valoreDiMana: 1, turno: 1 },
    { dimensioneMazzo: 60, terre: [MONTAGNE, PALUDI], pips: [["R"] as const, ["B"] as const], valoreDiMana: 2, turno: 2 },
    { dimensioneMazzo: 60, terre: [PALUDI, MONTAGNE], pips: [["R"] as const, ["B"] as const], valoreDiMana: 2, turno: 2 },
    { dimensioneMazzo: 60, terre: [MONTAGNE, PALUDI, GIRATA], pips: [["R", "B"] as const], valoreDiMana: 3, turno: 3 },
    { dimensioneMazzo: 60, terre: [MONTAGNE, PALUDI, GIRATA], pips: [["R"] as const, ["R"] as const], valoreDiMana: 3, turno: 3 },
  ];

  it("dà a ogni domanda la risposta che avrebbe avuto da sola", async () => {
    // Prima le si fanno tutte, in fila, allo stesso modulo: da qui in poi la
    // sua memoria è piena delle altre dieci.
    const ricordate = DOMANDE.map((domanda) => probabilitaDiLanciare(domanda));

    for (const [indice, domanda] of DOMANDE.entries()) {
      vi.resetModules();
      const solo = await import("./probabilita.js");
      expect(solo.probabilitaDiLanciare(domanda), JSON.stringify(domanda)).toBe(ricordate[indice]);
    }
  });

  it("risponde uguale a chiederglielo due volte", () => {
    for (const domanda of DOMANDE) {
      expect(probabilitaDiLanciare(domanda)).toBe(probabilitaDiLanciare(domanda));
    }
  });
});
