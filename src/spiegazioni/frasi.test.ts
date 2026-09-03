/**
 * I modelli di frase, provati **uno per uno e ramo per ramo**.
 *
 * La suite accanto (`spiegazioni.test.ts`) entra dalla cucitura e prova che i
 * numeri citati siano quelli del punteggio. Qui si prova l'altra metà: che
 * ogni modello, con qualunque numero gli si dia, scriva una frase che quel
 * numero lo contiene davvero — che è la cosa che il ticket 13 chiede di poter
 * verificare con un test.
 *
 * Alcuni rami non si incontrano sul pool finto (una carta a copie illimitate
 * che resta fuori, un mazzo che non chiude mai) e si provano solo da qui: sono
 * casi che sul pool vero esistono, e una frase rotta là dentro si scoprirebbe
 * troppo tardi.
 */

import { describe, expect, it } from "vitest";

import {
  carte,
  conArticolo,
  copie,
  decimale,
  elenco,
  frasePerIlPasso,
  frasePerLaPresenza,
  frasePerLeCopie,
  frasePerLeTerre,
  frasePerLEsclusione,
  percento,
  percentoFine,
  quantita,
  simboli,
  terre,
  type GrezziDelleCopie,
  type GrezziDelleTerre,
  type GrezziDelPasso,
  type GrezziDiPresenza,
} from "./frasi.js";

describe("come si scrivono i numeri", () => {
  it("scrive le percentuali all'italiana", () => {
    expect(percento(0.4137)).toBe("41%");
    expect(percentoFine(0.7922)).toBe("79,2%");
    expect(decimale(1.5)).toBe("1,50");
    expect(quantita(3)).toBe("3");
    expect(quantita(2.5)).toBe("2,5");
  });

  it("elide l'articolo davanti ai numeri che cominciano per vocale", () => {
    expect(conArticolo("il", "77%")).toBe("il 77%");
    expect(conArticolo("il", "87%")).toBe("l'87%");
    expect(conArticolo("il", "8%")).toBe("l'8%");
    expect(conArticolo("il", "11%")).toBe("l'11%");
    expect(conArticolo("dal", "100,0%")).toBe("dal 100,0%");
    expect(conArticolo("al", "1,5%")).toBe("all'1,5%");
    expect(conArticolo("del", "18%")).toBe("del 18%");
    // Lo zero comincia per z, e la z vuole «lo»: capita a un mazzo che non
    // chiude mai una partita, e capita all'ultimo mazzo di una frontiera.
    expect(conArticolo("il", "0%")).toBe("lo 0%");
    expect(conArticolo("dal", "0,0%")).toBe("dallo 0,0%");
    expect(conArticolo("del", "0%")).toBe("dello 0%");
  });

  it("accorda singolare e plurale invece di scrivere «1 carte»", () => {
    expect(copie(1)).toBe("1 copia");
    expect(copie(4)).toBe("4 copie");
    expect(carte(1)).toBe("1 carta");
    expect(carte(12)).toBe("12 carte");
    expect(simboli(1)).toBe("1 simbolo");
    expect(simboli(2.5)).toBe("2,5 simboli");
    expect(terre(1)).toBe("1 terra");
    expect(terre(22)).toBe("22 terre");
    expect(elenco(["uno"])).toBe("uno");
    expect(elenco(["uno", "due", "tre"])).toBe("uno, due e tre");
  });
});

describe("perché la carta è nel mazzo", () => {
  const base: GrezziDiPresenza = {
    nome: "Carta Finta",
    copie: 4,
    nelTema: true,
    copieNelTema: 30,
    copieNonTerra: 38,
    ruolo: {
      ruolo: "corpo",
      valoreDiMana: 2,
      forza: "3",
      costituzione: "3",
      efficienza: 2,
      efficienzaMedia: 1.4,
    },
  };

  it("dice quante copie del tema ci sono, quando la carta è del tema", () => {
    const frase = frasePerLaPresenza(base);
    expect(frase).toContain("30");
    expect(frase).toContain("38");
    expect(frase).toContain("3/3");
    expect(frase).toContain("1,40");
  });

  it("conta le copie fuori tema, quando la carta non è del tema", () => {
    const frase = frasePerLaPresenza({ ...base, nelTema: false });
    // Trentotto copie meno le trenta del tema: otto fuori tema.
    expect(frase).toContain("8");
    expect(frase).toContain("fuori tema");
  });

  it("dice la rimozione, e distingue quella che colpisce sempre", () => {
    const sempre = frasePerLaPresenza({
      ...base,
      ruolo: { ruolo: "rimozione", incondizionata: true, copieCheLoFanno: 6, copieNonTerra: 38 },
    });
    const aVolte = frasePerLaPresenza({
      ...base,
      ruolo: { ruolo: "rimozione", incondizionata: false, copieCheLoFanno: 2, copieNonTerra: 38 },
    });
    expect(sempre).toContain("6 copie");
    expect(aVolte).toContain("2 copie");
    expect(sempre).not.toBe(aVolte);
  });

  it("dice il vantaggio in carte e il posto riempito", () => {
    expect(
      frasePerLaPresenza({
        ...base,
        ruolo: { ruolo: "vantaggio", copieCheLoFanno: 5, copieNonTerra: 38 },
      }),
    ).toContain("5 copie");
    expect(
      frasePerLaPresenza({
        ...base,
        ruolo: { ruolo: "posto", turno: 3, probabilitaDiMana: 0.72 },
      }),
    ).toContain("72%");
  });
});

describe("perché tante copie", () => {
  const base: GrezziDelleCopie = {
    nome: "Carta Finta",
    copie: 4,
    massimo: 4,
    turno: 2,
    probabilitaDiPescarla: 0.55,
    probabilitaDiMana: 0.87,
    dimensioneMazzo: 60,
    copieNonTerra: 38,
    carteDiverse: 12,
  };

  it("dice le due probabilità e il tetto del regolamento", () => {
    const frase = frasePerLeCopie(base);
    expect(frase).toContain("4 copie");
    expect(frase).toContain("55%");
    expect(frase).toContain("l'87%");
    expect(frase).toContain("il regolamento ne concede 4");
  });

  it("sotto il massimo dice il baratto, e non un divieto che non esiste", () => {
    // Una copia in più **ci starebbe**, togliendone un'altra: dire «di più non
    // ne entrano» sarebbe inventare un vincolo, e `CLAUDE.md` non lo permette.
    const frase = frasePerLeCopie({ ...base, copie: 2 });
    expect(frase).toContain("2 copie");
    expect(frase).toContain("una carta in meno");
    expect(frase).toContain("38");
    expect(frase).toContain("12 carte");
    expect(frase).not.toContain("Di più non ne entrano");
  });

  it("le carte a copie illimitate non citano un tetto che non c'è", () => {
    const frase = frasePerLeCopie({ ...base, copie: 7, massimo: Number.POSITIVE_INFINITY });
    expect(frase).toContain("7 copie");
    expect(frase).not.toContain("Infinity");
    expect(frase).toContain("le 7 le ha scelte l'app");
  });
});

describe("perché una carta del tema è rimasta fuori", () => {
  it("dice la curva, con la quota vera e quella attesa", () => {
    const frase = frasePerLEsclusione({
      nome: "Carta Cara",
      motivo: "curva",
      valoreDiMana: 5,
      casella: "5",
      quotaVera: 0.2,
      quotaAttesa: 0.08,
    });
    expect(frase).toContain("Carta Cara");
    expect(frase).toContain("5 mana");
    expect(frase).toContain("il 20%");
    expect(frase).toContain("l'8%");
  });

  it("sulle caselle di cima e di fondo nomina la casella, non il costo", () => {
    // La casella «6 o più» raccoglie più costi, e le due quote sono prese su
    // tutta la casella: dire «di carte che costano 7 mana» sarebbe un numero
    // giusto sotto una frase sbagliata.
    const frase = frasePerLEsclusione({
      nome: "Carta Carissima",
      motivo: "curva",
      valoreDiMana: 7,
      casella: "6 o più",
      quotaVera: 0.15,
      quotaAttesa: 0.05,
    });
    expect(frase).toContain("costa 7 mana");
    expect(frase).toContain("costano 6 o più mana");
  });

  it("dice la qualità, col confronto con la carta più debole entrata", () => {
    const frase = frasePerLEsclusione({
      nome: "Carta Debole",
      motivo: "qualita",
      qualita: 0.31,
      nomePiuDebole: "Carta Entrata",
      qualitaPiuDebole: 0.42,
    });
    expect(frase).toContain("0,31");
    expect(frase).toContain("Carta Entrata");
    expect(frase).toContain("0,42");
  });

  it("a parità di qualità dice la parità, e non «meno di» fra due numeri uguali", () => {
    // La qualità si scrive con due decimali e i pareggi capitano spesso: sul
    // pool vero una frontiera sola ne ha prodotti tre a 0,60.
    const frase = frasePerLEsclusione({
      nome: "Carta Pari",
      motivo: "qualita",
      qualita: 0.6,
      nomePiuDebole: "Carta Entrata",
      qualitaPiuDebole: 0.6,
    });
    expect(frase).toContain("quanto la più debole");
    expect(frase).not.toContain("meno della più debole");
    expect(frase).toContain("0,60");
  });

  it("dice i posti finiti come un baratto, non come un verdetto della ricerca", () => {
    const frase = frasePerLEsclusione({
      nome: "Carta Forte",
      motivo: "posti",
      qualita: 0.9,
      copieNonTerra: 38,
      carteDiverse: 12,
    });
    expect(frase).toContain("0,90");
    expect(frase).toContain("38 posti");
    expect(frase).toContain("12 carte");
    expect(frase).toContain("togliere una di quelle");
  });
});

describe("com'è stata scelta la base di terre", () => {
  const base: GrezziDelleTerre = {
    numeroTerre: 22,
    numeroTerreDallaCurva: 22,
    dimensioneMazzo: 60,
    copieNonTerra: 38,
    costoMedio: 2.6,
    colori: [{ colore: "R", simboli: 46, fonti: 22 }],
    terreCheEntranoGirate: 0,
    terreGirateSoloAVolte: 0,
    probabilitaMedia: 0.77,
    difficili: [],
  };

  it("dice quante terre, da che costo medio vengono, e con che effetto", () => {
    const frase = frasePerLeTerre(base);
    expect(frase).toContain("22 terre su 60");
    expect(frase).toContain("2,6 mana");
    expect(frase).toContain("46 simboli di mana rosso");
    expect(frase).toContain("il 77%");
  });

  it("quando le terre non sono quelle della curva, lo dice invece di tacerlo", () => {
    const frase = frasePerLeTerre({ ...base, numeroTerre: 24 });
    expect(frase).toContain("24 terre");
    expect(frase).toContain("ne servirebbero 22");
  });

  it("dice le terre girate e le carte che la base regge male", () => {
    const frase = frasePerLeTerre({
      ...base,
      terreCheEntranoGirate: 6,
      terreGirateSoloAVolte: 2,
      difficili: ["Carta Difficile", "Altra Carta"],
    });
    expect(frase).toContain("6 di queste terre entrano girate");
    expect(frase).toContain("2 solo a certe condizioni");
    expect(frase).toContain("2 carte");
    expect(frase).toContain("Carta Difficile e Altra Carta");
  });

  it("accorda al singolare invece di scrivere «1 simboli» e «1 terre»", () => {
    const frase = frasePerLeTerre({
      ...base,
      colori: [{ colore: "U", simboli: 1, fonti: 1 }],
      terreCheEntranoGirate: 1,
      terreGirateSoloAVolte: 1,
      difficili: ["Carta Difficile"],
    });
    expect(frase).toContain("1 simbolo di mana blu");
    expect(frase).toContain("1 terra che lo produce");
    expect(frase).toContain("1 di queste terre entra girata");
    expect(frase).toContain("1 carta questa base la regge male");
    expect(frase).not.toContain("1 simboli");
    expect(frase).not.toContain("1 terre");
  });

  it("un mazzo senza colori chiesti non inventa una frase sui colori", () => {
    const frase = frasePerLeTerre({ ...base, colori: [] });
    expect(frase).not.toContain("Il mazzo chiede");
    expect(frase).toMatch(/\d/);
  });
});

describe("che cosa cambia rispetto al mazzo precedente", () => {
  const base: GrezziDelPasso = {
    purezzaPrima: 1,
    purezzaDopo: 0.8684,
    potenzaPrima: 0.7922,
    potenzaDopo: 0.8067,
    copieFuoriTemaPrima: 0,
    copieFuoriTemaDopo: 5,
    copieNonTerra: 38,
    copieNonTerraPrima: 40,
    turnoPrima: 5.7,
    turnoDopo: 5.2,
    quotaChiusePrima: 0.9,
    quotaChiuseDopo: 0.94,
    partite: 500,
  };

  it("dice il baratto e il turno di chiusura, come nell'esempio del ticket", () => {
    const frase = frasePerIlPasso(base);
    expect(frase).toContain("5 copie");
    expect(frase).toContain("dal 100,0%");
    expect(frase).toContain("86,8%");
    expect(frase).toContain("79,2%");
    expect(frase).toContain("80,7%");
    expect(frase).toContain("turno 5,2");
    expect(frase).toContain("turno 5,7");
  });

  it("dà a ogni conto delle copie fuori tema il suo denominatore", () => {
    // I due mazzi non hanno lo stesso numero di carte non-terra: le terre le
    // sceglie la curva, e lungo la frontiera il loro numero si sposta.
    const frase = frasePerIlPasso(base);
    expect(frase).toContain("5 su 38");
    expect(frase).toContain("0 su 40");
  });

  it("quando i due turni si scrivono uguali, passa alle partite chiuse", () => {
    const frase = frasePerIlPasso({ ...base, turnoDopo: 5.7 });
    expect(frase).not.toContain("turno 5,7 invece che al turno 5,7");
    expect(frase).toContain("94%");
    expect(frase).toContain("90%");
  });

  it("quando non cambia nemmeno quello, non finge una differenza", () => {
    const frase = frasePerIlPasso({ ...base, turnoDopo: 5.7, quotaChiuseDopo: 0.9 });
    expect(frase).toContain("chiude come prima");
    expect(frase).toContain("5,7");
  });

  it("un mazzo che non chiude mai lo dice, invece di scrivere «turno null»", () => {
    const frase = frasePerIlPasso({
      ...base,
      turnoPrima: null,
      turnoDopo: null,
      quotaChiusePrima: 0,
      quotaChiuseDopo: 0,
    });
    expect(frase).not.toContain("null");
    expect(frase).toContain("non chiude mai");
  });

  it("a parità di copie fuori tema non dice «zero copie in più»", () => {
    const frase = frasePerIlPasso({ ...base, copieFuoriTemaPrima: 5 });
    expect(frase).toContain("restano 5 su 38");
    expect(frase).not.toContain("0 copie fuori tema in più");
  });
});
