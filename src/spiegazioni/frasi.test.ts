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
  ciSonoCopieChe,
  conArticolo,
  fraseConLeTerreScartate,
  copie,
  decimale,
  elenco,
  esserci,
  frasePerIlGuaioDellaCombo,
  frasePerIlMazzoSolo,
  frasePerLaCorsa,
  frasePerIlPasso,
  frasePerIlPattoDellaCombo,
  frasePerLaCombo,
  frasePerLArchetipo,
  frasePerLaFrontieraPiuCorta,
  frasePerIlPrezzoDichiarato,
  PATTO_DELLA_CORSA,
  frasePerLaPresenza,
  frasePerLeCopie,
  frasePerLeTerre,
  frasePerLeTerreScartate,
  frasePerLEsclusione,
  percento,
  percentoFine,
  quantita,
  simboli,
  terre,
  type GrezziDellaCombo,
  type GrezziDelleCopie,
  type GrezziDelleTerre,
  type GrezziDelPasso,
  type GrezziDiPresenza,
  frasePerLeRinunceDelBudget,
  frasePerIlTettoInVigore,
  frasePerIlTettoSuQuelCheEsce,
  frasePerIlTemaInVigore,
  frasePerIlTemaSuQuelCheEsce,
  frasePerUnMazzoDiUnAltroFormato,
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
    // Le forme che `percentoDiUnaParte` scrive ai due capi (ticket 49): conta
    // l'intero che si pronuncia per primo, *novantanove* e *zero*.
    expect(conArticolo("il", "99,8%")).toBe("il 99,8%");
    expect(conArticolo("il", "99,9%")).toBe("il 99,9%");
    expect(conArticolo("il", "0,2%")).toBe("lo 0,2%");
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

  it("accorda anche il verbo che sta intorno al numero, non solo il nome", () => {
    // «Ci sono 1 copia» era il difetto del ticket 79: il nome si accordava e il
    // verbo no. La regola sta qui, in un posto solo, e i rami la chiamano.
    expect(esserci(1)).toBe("c'è");
    expect(esserci(4)).toBe("ci sono");
    expect(ciSonoCopieChe(1, "spazza", "spazzano anche loro")).toBe(
      "c'è 1 copia che spazza",
    );
    expect(ciSonoCopieChe(3, "spazza", "spazzano anche loro")).toBe(
      "ci sono 3 copie che spazzano anche loro",
    );
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

  it("la carta che pesca rimette carte in mano, quella che spazza no", () => {
    // Wrath of God non rimette in mano niente: spazza il campo. Dirgli la
    // frase della pesca era il difetto del ticket 78, e le due frasi si
    // scelgono sul modo che il punteggio ha pesato.
    const pesca = frasePerLaPresenza({
      ...base,
      ruolo: { ruolo: "vantaggio", modo: "pesca", copieCheLoFanno: 16, copieNonTerra: 38 },
    });
    const spazza = frasePerLaPresenza({
      ...base,
      ruolo: { ruolo: "vantaggio", modo: "spazza-via", copieCheLoFanno: 5, copieNonTerra: 38 },
    });

    expect(pesca).toContain("in mano");
    expect(pesca).toContain("16 copie");
    expect(spazza).not.toContain("in mano");
    expect(spazza).toContain("5 copie");
  });

  it("la frase dello spazzino non dice di chi sono le creature che prende", () => {
    // Lo spazzino è simmetrico: prende anche le tue creature, e il danno a
    // tutto il campo tocca anche te. «Gli togli dal tavolo» sarebbe falso.
    const spazza = frasePerLaPresenza({
      ...base,
      ruolo: { ruolo: "vantaggio", modo: "spazza-via", copieCheLoFanno: 5, copieNonTerra: 38 },
    });

    for (const possessivo of ["gli ", "avversar", " suo", " sue", " tuo", "loro creature"]) {
      expect(spazza.toLowerCase(), possessivo).not.toContain(possessivo);
    }
  });

  it("dice la risposta, e distingue quella che colpisce sempre", () => {
    const sempre = frasePerLaPresenza({
      ...base,
      ruolo: { ruolo: "risposta", incondizionata: true, copieCheLoFanno: 6, copieNonTerra: 38 },
    });
    const aVolte = frasePerLaPresenza({
      ...base,
      ruolo: { ruolo: "risposta", incondizionata: false, copieCheLoFanno: 2, copieNonTerra: 38 },
    });
    expect(sempre).toContain("6 copie");
    expect(aVolte).toContain("2 copie");
    expect(sempre).not.toBe(aVolte);
  });

  it("dice il vantaggio in carte e il posto riempito", () => {
    expect(
      frasePerLaPresenza({
        ...base,
        ruolo: { ruolo: "vantaggio", modo: "pesca", copieCheLoFanno: 5, copieNonTerra: 38 },
      }),
    ).toContain("5 copie");
    expect(
      frasePerLaPresenza({
        ...base,
        ruolo: { ruolo: "posto", turno: 3, probabilitaDiMana: 0.72 },
      }),
    ).toContain("72%");
  });

  it("il posto riempito non promette il mana «il 100%» quando non c'è sempre (ticket 49)", () => {
    const quasi = frasePerLaPresenza({
      ...base,
      ruolo: { ruolo: "posto", turno: 1, probabilitaDiMana: 0.998 },
    });
    expect(quasi).toContain("c'è il 99,8% delle volte");
    expect(quasi).not.toContain("100%");

    const sempre = frasePerLaPresenza({
      ...base,
      ruolo: { ruolo: "posto", turno: 1, probabilitaDiMana: 1 },
    });
    expect(sempre).toContain("c'è il 100% delle volte");
  });

  it("con una copia sola nessun ramo dice «ci sono 1 copia» né mette il verbo al plurale", () => {
    // Le limitate del formato entrano in una copia sola, e la frase si legge a
    // voce alta (ticket 13): «ci sono 1 copia che lo fanno» non regge la prova.
    const ruoli: GrezziDiPresenza["ruolo"][] = [
      { ruolo: "risposta", incondizionata: true, copieCheLoFanno: 1, copieNonTerra: 35 },
      { ruolo: "risposta", incondizionata: false, copieCheLoFanno: 1, copieNonTerra: 35 },
      { ruolo: "vantaggio", modo: "pesca", copieCheLoFanno: 1, copieNonTerra: 35 },
      { ruolo: "vantaggio", modo: "spazza-via", copieCheLoFanno: 1, copieNonTerra: 35 },
    ];

    for (const ruolo of ruoli) {
      const frase = frasePerLaPresenza({ ...base, copie: 1, ruolo });
      expect(frase, JSON.stringify(ruolo)).toContain("c'è 1 copia");
      expect(frase, JSON.stringify(ruolo)).not.toContain("ci sono 1 copia");
      for (const plurale of ["lo fanno", "rispondono", "spazzano", "anche loro"]) {
        expect(frase, plurale).not.toContain(plurale);
      }
    }
  });

  it("con due o più copie le frasi restano quelle di prima", () => {
    const ruoli: [GrezziDiPresenza["ruolo"], string][] = [
      [
        { ruolo: "risposta", incondizionata: true, copieCheLoFanno: 6, copieNonTerra: 38 },
        "ci sono 6 copie che rispondono senza condizioni",
      ],
      [
        { ruolo: "risposta", incondizionata: false, copieCheLoFanno: 2, copieNonTerra: 38 },
        "ci sono 2 copie che rispondono anche loro a certe carte sole",
      ],
      [
        { ruolo: "vantaggio", modo: "pesca", copieCheLoFanno: 16, copieNonTerra: 38 },
        "ci sono 16 copie che lo fanno",
      ],
      [
        { ruolo: "vantaggio", modo: "spazza-via", copieCheLoFanno: 5, copieNonTerra: 38 },
        "ci sono 5 copie che spazzano anche loro",
      ],
    ];

    for (const [ruolo, atteso] of ruoli) {
      expect(frasePerLaPresenza({ ...base, ruolo }), atteso).toContain(atteso);
    }
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

  it("con una copia sola l'articolo e il pronome si accordano, e il numero non resta nudo", () => {
    // «le 1 le ha scelte l'app» era plurale attorno a un numero singolare, col
    // numero per giunta nudo: nel resto del file si dice «1 copia» (ticket 80).
    const frase = frasePerLeCopie({ ...base, copie: 1, massimo: Number.POSITIVE_INFINITY });
    expect(frase).toContain("1 copia l'ha scelta l'app");
    expect(frase).not.toContain("le 1");
  });

  /*
    Ticket 49: una quota di mana di 0,998 — una carta da un mana in una base
    molto carica, o un conto al turno più tardo — arrotondata all'intero
    diventava «il 100% delle volte», cioè la promessa che non capiterà mai di non
    poterla lanciare, smentita al primo tavolo. Il numero viene da un conto
    chiuso, non da partite simulate: il decimale è vero quanto l'intero.
  */
  it("il mana quasi sempre presente non si scrive «il 100%»", () => {
    const frase = frasePerLeCopie({ ...base, probabilitaDiMana: 0.998 });
    expect(frase).toContain("il mana per lanciarla c'è il 99,8% delle volte");
    expect(frase).not.toContain("100%");
  });

  it("una quota che col decimale direbbe ancora «100,0» si ferma a «il 99,9%»", () => {
    const frase = frasePerLeCopie({ ...base, probabilitaDiMana: 0.9996 });
    expect(frase).toContain("il mana per lanciarla c'è il 99,9% delle volte");
    expect(frase).not.toContain("100");
  });

  it("il mana che c'è davvero sempre resta «il 100%», senza decimali", () => {
    const frase = frasePerLeCopie({ ...base, probabilitaDiMana: 1 });
    expect(frase).toContain("il mana per lanciarla c'è il 100% delle volte");
    expect(frase).not.toContain("100,0");
  });

  it("il mana quasi mai presente non si scrive «lo 0%»", () => {
    const frase = frasePerLeCopie({ ...base, probabilitaDiMana: 0.003 });
    expect(frase).toContain("c'è lo 0,3% delle volte");
  });

  it("la probabilità di pescarla quasi certa non si scrive certa, e nel mezzo resta tonda", () => {
    expect(frasePerLeCopie({ ...base, probabilitaDiPescarla: 0.997 })).toContain(
      "te ne capita almeno una il 99,7% delle volte",
    );
    // Il decimale solo dove l'intero mentirebbe: dappertutto direbbe che l'app
    // misura più fine di quanto misuri.
    const tonda = frasePerLeCopie({ ...base, probabilitaDiPescarla: 0.4137 });
    expect(tonda).toContain("il 41% delle volte");
    expect(tonda).not.toContain("41,");
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

/**
 * La combo dichiarata (ticket 05 della tappa 3).
 *
 * La frase ha un lavoro in più delle altre: oltre al numero deve dire **il
 * patto** — non giudico se questa combo vinca, l'hai detto tu; ti dico che
 * probabilità hai di averla in mano al turno che guardo. Il ticket lo chiede
 * alla lettera, e un test lo tiene lì.
 */
describe("frasePerLaCombo", () => {
  const base: GrezziDellaCombo = {
    pezzi: [
      { nome: "Bombarda Rovente", copie: 4 },
      { nome: "Fornace Antica", copie: 4 },
    ],
    turno: 5,
    probabilita: 0.3072640358325542,
    dimensioneMazzo: 60,
    guai: [],
  };

  it("dice il patto: non giudico, l'hai detto tu", () => {
    const frase = frasePerLaCombo(base);
    expect(frase).toContain("l'hai detto tu");
    expect(frase).toContain("Bombarda Rovente");
    expect(frase).toContain("Fornace Antica");
  });

  it("dice la probabilità, il turno e le copie che ci sono davvero", () => {
    const frase = frasePerLaCombo(base);
    expect(frase).toContain("31%");
    expect(frase).toContain("turno 5");
    expect(frase).toContain("4 copie");
  });

  it("con un pezzo solo parla al singolare", () => {
    const frase = frasePerLaCombo({
      ...base,
      pezzi: [{ nome: "Bombarda Rovente", copie: 3 }],
      probabilita: 0.42,
    });
    expect(frase).toContain("3 copie");
    expect(frase).not.toContain("tutte e");
  });

  it("un pezzo solo in una copia sola non fa dire «ci sono 1 copia»", () => {
    // Le limitate del formato entrano in una copia sola, e una combo dichiarata
    // su una di quelle cadeva nello stesso stampo del ticket 79.
    const frase = frasePerLaCombo({
      ...base,
      pezzi: [{ nome: "Loto Nero", copie: 1 }],
      probabilita: 0.12,
    });
    expect(frase).toContain("c'è 1 copia");
    expect(frase).not.toContain("ci sono 1 copia");
  });

  it("quando dei pezzi non ne è rimasto nessuno non scrive nessuna probabilità", () => {
    const frase = frasePerLaCombo({
      ...base,
      pezzi: [],
      probabilita: null,
      guai: [{ nome: "Bombarda Rovente", tipo: "sparita" }],
    });
    expect(frase).not.toContain("%");
    expect(frase).toContain("0 su 1");
  });

  it("se un pezzo è rimasto fuori, il numero non si spaccia per quello della combo", () => {
    // Il caso che conta: due pezzi su tre si sono trovati, e la probabilità dei
    // due è **più alta** di quella dei tre. Dirla senza dire che manca il terzo
    // sarebbe rispondere a una domanda che l'utente non ha fatto.
    const frase = frasePerLaCombo({
      ...base,
      guai: [{ nome: "Vortice Perduto", tipo: "sparita" }],
    });
    expect(frase).toContain("Vortice Perduto");
    expect(frase).toContain("i pezzi rimasti");
  });

  it("un pezzo che nel mazzo non è entrato porta la probabilità a zero, e lo dice", () => {
    const frase = frasePerLaCombo({
      ...base,
      pezzi: [
        { nome: "Bombarda Rovente", copie: 4 },
        { nome: "Fornace Antica", copie: 0 },
      ],
      probabilita: 0,
    });
    expect(frase).toContain("Fornace Antica");
    expect(frase).toContain("0%");
  });
});

describe("frasePerIlGuaioDellaCombo", () => {
  it("dice i tre modi in cui un pezzo resta fuori, e nomina la carta", () => {
    for (const tipo of ["sparita", "esclusa", "terra"] as const) {
      const frase = frasePerIlGuaioDellaCombo({ nome: "Fornace Antica", tipo });
      expect(frase).toContain("Fornace Antica");
      expect(frase.length).toBeGreaterThan("Fornace Antica".length + 10);
    }
  });
});

describe("il patto della combo, prima che il mazzo esista", () => {
  it("senza pezzi promette il massimo, e non un numero che non c'è ancora", () => {
    const frase = frasePerIlPattoDellaCombo({ pezzi: [], turno: 4 });
    expect(frase).toContain("turno 4");
    expect(frase).toContain("al massimo delle copie");
  });

  it("con pezzi tutti liberi dice quattro copie ciascuna", () => {
    const frase = frasePerIlPattoDellaCombo({
      pezzi: [
        { nome: "Tizio", copie: 4 },
        { nome: "Caio", copie: 4 },
      ],
      turno: 4,
    });
    expect(frase).toContain("4 copie ciascuna");
  });

  it("con una carta limitata dice una copia, e la nomina", () => {
    // È il punto in cui l'app diceva la cosa sbagliata: la frase leggeva la
    // costante e prometteva quattro copie, mentre il mazzo ne conteneva una.
    const frase = frasePerIlPattoDellaCombo({
      pezzi: [
        { nome: "Tizio", copie: 4 },
        { nome: "Calice d'onice", copie: 1 },
      ],
      turno: 4,
    });
    expect(frase).toContain("1 copia di «Calice d'onice»");
    expect(frase).toContain("4 copie di «Tizio»");
    expect(frase).not.toContain("4 copie ciascuna");
  });

  it("una sola carta limitata: nessuna promessa di quattro", () => {
    const frase = frasePerIlPattoDellaCombo({
      pezzi: [{ nome: "Calice", copie: 1 }],
      turno: 4,
    });
    expect(frase).toContain("in 1 copia senza mai scambiarla via");
    expect(frase).toContain("di averla in mano entro il turno 4");
    expect(frase).not.toContain("4 copie");
  });
});

describe("le terre di un mazzo che arriva da fuori", () => {
  it("dice quali terre non sono entrate e quante carte mancano", () => {
    const frase = frasePerLeTerreScartate({
      terre: [
        { nome: "Officina di Mishra", copie: 4 },
        { nome: "Miniera a Nastro", copie: 1 },
      ],
    });

    expect(frase).toContain("Le 2 terre");
    expect(frase).toContain("4 copie di «Officina di Mishra»");
    expect(frase).toContain("1 copia di «Miniera a Nastro»");
    expect(frase).toContain("5 copie");
  });

  it("non dice che il mazzo è più corto, perché non lo è", () => {
    // La base si rifà dalla curva e le terre tornano al loro numero: quel che si
    // perde è **quali** erano. Dire «hai cinque carte in meno» sarebbe un
    // allarme falso, ed è quel che questa frase diceva prima.
    const frase = frasePerLeTerreScartate({ terre: [{ nome: "Labirinto", copie: 4 }] });
    expect(frase).not.toContain("in meno");
    expect(frase).toContain("torna quello che serve");
  });

  it("con una terra sola parla al singolare", () => {
    const frase = frasePerLeTerreScartate({ terre: [{ nome: "Labirinto", copie: 1 }] });
    expect(frase).toContain("La terra");
    expect(frase).toContain("non è quella che rimetto");
    // Anche in coda, dov'era rimasto il plurale del ticket 79: «1 copia
    // scritte in una lista non le so ancora tenere».
    expect(frase).toContain("1 copia scritta in una lista non la so ancora tenere");
    expect(frase).not.toContain("scritte");
  });
});

/**
 * Ticket 48. Le tre strade che rimettono un mazzo in mano — l'importazione, il
 * tasto dell'elenco, il salvataggio — scartano le stesse terre e devono dirlo
 * **tutte e tre**. Finché ognuna si scriveva il messaggio per conto suo, una se
 * lo dimenticava: il salvataggio riapriva il mazzo appena scritto, ne buttava le
 * terre prese dal catalogo e annunciava soltanto «è salvato».
 *
 * La regola sta qui, in un posto solo, perché le tre chiamate la leggano uguale.
 */
describe("l'annuncio di un mazzo rimesso in mano, con le terre che ha perso", () => {
  const UNA_TERRA = [{ nome: "Miniera a Nastro", copie: 4 }];

  it("senza terre scartate resta l'annuncio e basta", () => {
    expect(fraseConLeTerreScartate({ annuncio: "«Zoo» è salvato.", terre: [] })).toBe(
      "«Zoo» è salvato.",
    );
  });

  it("senza annuncio e senza terre non dice niente", () => {
    // È il tasto dell'elenco quando non c'è nulla da raccontare: una riga vuota
    // sopra la schermata sarebbe un avviso che avvisa di niente.
    expect(fraseConLeTerreScartate({ annuncio: null, terre: [] })).toBeNull();
  });

  it("senza annuncio dice solo delle terre", () => {
    const frase = fraseConLeTerreScartate({ annuncio: null, terre: UNA_TERRA });
    expect(frase).toBe(frasePerLeTerreScartate({ terre: UNA_TERRA }));
  });

  it("dice prima quel che è successo e poi quel che è costato", () => {
    // L'ordine non è un vezzo: chi ha premuto «Salva» sta aspettando di sapere
    // se il mazzo è salvato, e la notizia delle terre si legge solo dopo averlo
    // saputo.
    const frase = fraseConLeTerreScartate({ annuncio: "«Zoo» è salvato.", terre: UNA_TERRA });
    expect(frase).not.toBeNull();
    expect(frase as string).toContain("«Zoo» è salvato.");
    expect(frase as string).toContain("«Miniera a Nastro»");
    expect((frase as string).indexOf("è salvato")).toBeLessThan(
      (frase as string).indexOf("Miniera a Nastro"),
    );
  });
});

describe("quel che il tetto di spesa è costato alla base", () => {
  it("resta muta quando il tetto non ha tolto niente", () => {
    // Una frase che dicesse «non ti ho tolto niente» a ogni mazzo insegnerebbe
    // a saltarla proprio le volte che conta.
    expect(frasePerLeRinunceDelBudget({ tetto: 100, dentroIlTetto: true, rinunce: [] })).toBe("");
  });

  it("nomina le terre lasciate fuori, con le copie e gli euro", () => {
    const frase = frasePerLeRinunceDelBudget({
      tetto: 300,
      dentroIlTetto: true,
      rinunce: [
        { nome: "Terra Cara", copie: 4, euro: 480 },
        { nome: "Terra Meno Cara", copie: 1, euro: 12.5 },
      ],
    });

    expect(frase).toContain("300,00 €");
    expect(frase).toContain("4 copie di Terra Cara");
    expect(frase).toContain("1 copia di Terra Meno Cara");
    expect(frase).toContain("480,00 €");
    expect(frase).toContain("12,50 €");
    // Il totale c'è: è il numero che dice se valga la pena alzare il tetto.
    expect(frase).toContain("492,50 €");
  });

  it("non promette il tetto quando le rinunce non sono bastate", () => {
    // Il guasto del ticket 63: la base scende finché può, e quando nessuna
    // rinuncia abbassa più il conto si ferma **sopra** il tetto. Dire «per
    // stare dentro 5,00 €» annuncerebbe un risultato che non c'è, sopra un
    // elenco di terre che quella cifra la sfonda.
    const frase = frasePerLeRinunceDelBudget({
      tetto: 5,
      dentroIlTetto: false,
      rinunce: [{ nome: "Taiga", copie: 4, euro: 470.95 }],
    });

    expect(frase).not.toContain("Per stare dentro");
    // I numeri restano tutti: la cifra chiesta, la terra, quel che è costata.
    expect(frase).toContain("5,00 €");
    expect(frase).toContain("4 copie di Taiga");
    expect(frase).toContain("470,95 €");
  });

  it("dice a chi legge che dentro il tetto non ci si è arrivati", () => {
    // La seconda casella del ticket: non basta togliere la promessa, chi legge
    // deve sapere che le rinunce non sono bastate — è quel che gli dice se
    // alzare il tetto o cambiare mazzo.
    const frase = frasePerLeRinunceDelBudget({
      tetto: 5,
      dentroIlTetto: false,
      rinunce: [{ nome: "Taiga", copie: 4, euro: 470.95 }],
    });

    expect(frase).toMatch(/non ci sta|non basta|non sono bastate|resta sopra/i);
  });
});

describe("il tetto in vigore sul mazzo in mano", () => {
  it("dice la cifra e dice che vale sulle terre", () => {
    const frase = frasePerIlTettoInVigore({ tetto: 30 });
    expect(frase).toContain("30,00 €");
    expect(frase).toContain("terre");
  });

  it("non promette terre che il tema esclude", () => {
    // Le esclusioni del tema valgono sulle terre prima del prezzo: a tetto
    // levato la base si rifà su quel che il tema permette, non sul pool intero.
    expect(frasePerIlTettoInVigore({ tetto: 30 })).toContain("che il tema permette");
  });

  it("col tema del mazzo in vigore non promette una base che nessun tasto produce", () => {
    // Il solo comando che leva il tetto scioglie il mazzo da tutti e due i
    // vincoli insieme: promettere che la base «si rifà sulle terre che il tema
    // permette» sarebbe promettere quel che non succede, perché quel tema se ne
    // va con lui. La frase dice che valgono insieme, e tace sul resto.
    const frase = frasePerIlTettoInVigore({ tetto: 30, conIlSuoTema: true });

    expect(frase).toContain("si levano insieme");
    expect(frase).not.toMatch(/la base si rifà/u);
  });

  it("con incontabili e col suo tema dice comunque che si levano insieme", () => {
    // Il tasto accanto stacca tutti e due i vincoli: se la riga tace, l'utente
    // preme «Rifà le terre coi vincoli di adesso» senza sapere che si porta via
    // anche il tema. È la cifra invisibile che i ticket 21 e 31 esistono per
    // togliere, e non torna dentro per via di un prezzo mancante.
    const frase = frasePerIlTettoInVigore({
      tetto: 30,
      conIlSuoTema: true,
      incontabili: ["Serra Angel"],
    });

    expect(frase).toContain("si levano insieme");
    // «Il tema vale ancora» è vero e va detto: a cadere è la promessa sul
    // **tetto**, che è l'unica delle due che poggi su un prezzo.
    expect(frase).not.toContain("il tetto vale ancora");
  });

  it("non elenca un mazzo intero di nomi quando il pool perde un'edizione", () => {
    // Il pool si rigenera da solo, e una rigenerazione che perde i listini di
    // un'edizione intera farebbe un paragrafo lungo quanto il mazzo: una riga
    // che non si legge non avvisa nessuno.
    const molte = Array.from({ length: 12 }, (_, quale) => `Carta ${quale + 1}`);
    const frase = frasePerIlTettoInVigore({ tetto: 30, incontabili: molte });

    expect(frase).toContain("Carta 1");
    expect(frase).not.toContain("Carta 12");
    // Quante ne restano si dice: un elenco troncato in silenzio è un elenco che
    // mente sul suo numero.
    expect(frase).toMatch(/altre 8 carte/u);
  });

  it("con cinque nomi non scrive «e altre 1 carte»", () => {
    // Il ticket 43: il plurale era scritto a mano, e con esattamente cinque
    // carte senza listino il resto è uno. La riga si legge sulla schermata del
    // mazzo e sul foglio per l'arbitro, cioè nei due posti in cui l'app chiede
    // di essere creduta sui numeri.
    const cinque = Array.from({ length: 5 }, (_, quale) => `Carta ${quale + 1}`);

    for (const frase of [
      frasePerIlTettoInVigore({ tetto: 30, incontabili: cinque }),
      frasePerIlTettoSuQuelCheEsce({ tetto: 30, incontabili: cinque }),
    ]) {
      expect(frase).not.toMatch(/1 carte/u);
      expect(frase).toContain("Carta 4");
      expect(frase).not.toContain("Carta 5");
      expect(frase).toMatch(/un’altra carta/u);
    }
  });

  it("su quel che esce ritira la promessa quando il mazzo non si sa contare", () => {
    // Il ticket 38 sul foglio per l'arbitro, che è dove la promessa costa di
    // più: è la lista che esce dal negozio con un numero sotto.
    const frase = frasePerIlTettoSuQuelCheEsce({ tetto: 30, incontabili: ["Serra Angel"] });

    expect(frase).not.toMatch(/stanno dentro il tetto/u);
    expect(frase).toContain("Serra Angel");
    expect(frase).toContain("30,00 €");
  });

  it("su quel che esce dice la cifra e dove si leva", () => {
    const frase = frasePerIlTettoSuQuelCheEsce({ tetto: 30 });
    expect(frase).toContain("30,00 €");
    expect(frase).toContain("Mazzo");
  });

  it("sopra un mazzo che non sa contare non dice che il tetto vale ancora", () => {
    // Il ticket 38. Il mazzo esiste e l'utente ce l'ha in mano: non si rifiuta
    // di mostrarlo, e non gli si riscrivono le terre. Quel che cade è la
    // promessa — l'app non può dire che le terre stanno dentro una cifra che
    // non sa raggiungere.
    const frase = frasePerIlTettoInVigore({ tetto: 30, incontabili: ["Serra Angel"] });

    expect(frase).not.toContain("il tetto vale ancora");
    expect(frase).not.toMatch(/scelte per starci dentro/u);
  });

  it("nomina la carta che non sa contare, perché è da lì che si riparte", () => {
    // Senza il nome non si prende nessuna delle strade: né togliere la carta,
    // né levare il tetto. È la stessa ragione per cui il no del ticket 34
    // nomina i pezzi della combo.
    const frase = frasePerIlTettoInVigore({ tetto: 30, incontabili: ["Serra Angel", "Cleanse"] });

    expect(frase).toContain("Serra Angel");
    expect(frase).toContain("Cleanse");
    // La cifra resta: è ancora il tetto con cui il mazzo è nato, ed è il fatto
    // che rende leggibile la base che si sta guardando.
    expect(frase).toContain("30,00 €");
  });

  it("un elenco vuoto è il caso normale, e la frase è quella di prima", () => {
    expect(frasePerIlTettoInVigore({ tetto: 30, incontabili: [] })).toBe(
      frasePerIlTettoInVigore({ tetto: 30 }),
    );
  });

  it("non promette «scelte per starci dentro» se la base il tetto lo supera", () => {
    // Ticket 63: è questa la riga che la promessa la fa per prima e la fa
    // sempre, anche a rinunce zero. Finché non guardava la base, prometteva in
    // cima quel che la frase delle rinunce smentiva in fondo.
    const frase = frasePerIlTettoInVigore({ tetto: 5, dentroIlTetto: false });

    expect(frase).not.toMatch(/scelte per starci dentro/u);
    expect(frase).toMatch(/questo mazzo non ci sta/u);
    // Il tetto **vale** ancora: è in vigore, solo non è stato rispettato. Sono
    // due cose diverse, e a tacere la prima si perde il perché della base.
    expect(frase).toContain("5,00 €");
  });

  it("col tetto superato tiene la coda sul tema, che non c'entra col prezzo", () => {
    // La coda dice che cosa fa **il tasto**, e il tasto c'è lo stesso: è la
    // stessa ragione per cui sopravvive al ramo delle incontabili.
    const frase = frasePerIlTettoInVigore({ tetto: 5, dentroIlTetto: false, conIlSuoTema: true });
    expect(frase).toContain("si levano insieme");
  });

  it("su quel che esce non dice all'arbitro che le terre stanno nel tetto", () => {
    // Il foglio che esce di casa: qui l'asserzione piatta «stanno dentro il
    // tetto» costa più che altrove.
    const frase = frasePerIlTettoSuQuelCheEsce({ tetto: 5, dentroIlTetto: false });

    expect(frase).not.toMatch(/stanno dentro il tetto/u);
    expect(frase).toMatch(/il mazzo non ci sta/u);
    expect(frase).toContain("5,00 €");
    expect(frase).toContain("Mazzo");
  });

  it("non incolpa le terre di uno sforo che può venire dalle carte", () => {
    // La bandiera nasce dal budget che resta alla base **dopo le carte**, e
    // quel budget è agganciato a zero: un mazzo le cui carte da sole sfondano
    // il tetto la fa cadere con una base da due euro. Dire «le terre non ci
    // stanno» manderebbe ad alzare il tetto chi deve togliere una carta — ed è
    // la stessa trappola che la frase delle rinunce ha già evitato.
    for (const frase of [
      frasePerIlTettoInVigore({ tetto: 30, dentroIlTetto: false }),
      frasePerIlTettoSuQuelCheEsce({ tetto: 30, dentroIlTetto: false }),
    ]) {
      expect(frase).not.toMatch(/le terre .{0,40}non ci stanno/u);
      expect(frase).not.toMatch(/la base si è fermata/u);
    }
  });

  it("dichiarare il tetto rispettato lascia le frasi esattamente com'erano", () => {
    // La bandiera non deve riscrivere il caso normale: assente e `true` devono
    // dare la stessa identica frase, o il ticket 63 avrebbe cambiato quel che
    // leggono tutti invece del solo caso rotto.
    expect(frasePerIlTettoInVigore({ tetto: 30, dentroIlTetto: true })).toBe(
      frasePerIlTettoInVigore({ tetto: 30 }),
    );
    expect(frasePerIlTettoSuQuelCheEsce({ tetto: 30, dentroIlTetto: true })).toBe(
      frasePerIlTettoSuQuelCheEsce({ tetto: 30 }),
    );
  });

  it("il tetto a zero si scrive come tutti gli altri", () => {
    // Zero euro è una richiesta legittima — «solo carte senza prezzo» — e una
    // frase che se lo mangiasse lascerebbe l'utente senza sapere perché la
    // base sia quella che è.
    expect(frasePerIlTettoInVigore({ tetto: 0 })).toContain("0,00 €");
  });
});

describe("perché la frontiera ha un mazzo solo", () => {
  it("a tetto spento dice che il baratto non c'è, parola per parola come prima", () => {
    // La promessa del ticket 24: chi non ha acceso il tetto non deve accorgersi
    // che il tetto esiste. La frase è quella storica, e questo test è il posto
    // in cui resta tale.
    expect(frasePerIlMazzoSolo({ troncataPerTempo: false, strategia: null, tetto: null })).toBe(
      "Un mazzo solo: cedendo tema, qui, non si guadagna potenza da nessuna parte.",
    );
  });

  it("col tetto acceso ma nessun passo tolto dice ancora che il baratto non c'è", () => {
    // Il tetto c'è e non ha tolto niente: la frontiera è corta per la ragione
    // di sempre, e attribuirlo al portafoglio sarebbe inventare una causa.
    expect(
      frasePerIlMazzoSolo({ troncataPerTempo: false, strategia: null, tetto: { euro: 30, passiSenzaMazzo: 0 } }),
    ).toBe("Un mazzo solo: cedendo tema, qui, non si guadagna potenza da nessuna parte.");
  });

  it("quando il tetto ha tolto i passi lo dice, col numero dentro", () => {
    // Senza il numero sarebbe un no come gli altri. Con il numero è una
    // risposta che si può agire: alza il tetto e il baratto ricompare.
    const frase = frasePerIlMazzoSolo({
      troncataPerTempo: false, strategia: null,
      tetto: { euro: 30, passiSenzaMazzo: 3 },
    });

    expect(frase).toContain("30,00 €");
    expect(frase).toContain("3 passi");
    expect(frase).not.toContain("non si guadagna potenza da nessuna parte");
  });

  it("accorda al singolare quando il passo tolto è uno solo", () => {
    const frase = frasePerIlMazzoSolo({
      troncataPerTempo: false, strategia: null,
      tetto: { euro: 12.5, passiSenzaMazzo: 1 },
    });

    expect(frase).toContain("un altro passo");
    expect(frase).toContain("12,50 €");
  });

  it("il tempo scaduto viene prima del tetto, perché quei passi non sono stati provati", () => {
    // Una ricerca troncata non ha nemmeno **cercato** i passi che mancano:
    // accusare il tetto sarebbe dare al portafoglio la colpa dell'orologio.
    const frase = frasePerIlMazzoSolo({
      troncataPerTempo: true, strategia: null,
      tetto: { euro: 30, passiSenzaMazzo: 3 },
    });

    expect(frase).toContain("il tempo è finito");
    expect(frase).not.toContain("tetto");
  });
});

describe("la corsa contro un orologio", () => {
  const GREZZI = {
    contro: "Mono rosso",
    turnoMio: 5,
    turnoSuo: 6,
    ritardoInflittoConRimozioni: 0,
    ritardoInflittoConContromagie: 0,
    ritardoDaRimozioni: 0,
    ritardoDaContromagie: 0,
    turnoMioRitardato: 5,
    quotaPartiteChiuse: 0.8,
  };

  it("dichiara che l'avversario è una caricatura, e non un tasso di vittoria", () => {
    // La riga più importante di tutta la funzionalità: ADR-0002 la impone, e un
    // numero che sembra un tasso di vittoria senza esserlo sarebbe la bugia
    // peggiore che quest'app possa dire.
    expect(PATTO_DELLA_CORSA).toMatch(/caricatura/i);
    expect(PATTO_DELLA_CORSA).toMatch(/non è un tasso di vittoria/i);
  });

  it("cita i due turni e dice chi arriva prima", () => {
    const frase = frasePerLaCorsa(GREZZI);
    expect(frase).toContain("Mono rosso");
    expect(frase).toContain("turno 6");
    expect(frase).toContain("turno 5,0");
    expect(frase).toContain("arriva prima lui");
  });

  it("nomina i ritardi solo quando ci sono, uno per uno", () => {
    // Scrivere «le sue rimozioni ti costano zero turni» sarebbe rumore, e
    // insegnerebbe a saltare la riga proprio le volte che il numero non è zero.
    expect(frasePerLaCorsa(GREZZI)).not.toContain("rimozioni");

    const conRitardo = frasePerLaCorsa({
      ...GREZZI,
      ritardoDaRimozioni: 1.2,
      turnoMioRitardato: 6.2,
    });
    expect(conRitardo).toContain("1,2 per le sue rimozioni");
    expect(conRitardo).not.toContain("contromagie");
    expect(conRitardo).toContain("arriva prima l’avversario");
  });

  it("dice di entrambi i ritardi quando ci sono tutti e due", () => {
    const frase = frasePerLaCorsa({
      ...GREZZI,
      ritardoDaRimozioni: 1.2,
      ritardoDaContromagie: 0.5,
      turnoMioRitardato: 6.7,
    });
    expect(frase).toContain("rimozioni");
    expect(frase).toContain("contromagie");
  });

  /**
   * L'altra metà della corsa: quel che questo mazzo fa all'avversario. La frase
   * deve decidere chi arriva prima sullo **stesso** turno dell'avversario che
   * il voto ha usato, e mostrarlo: chi legge «lui chiude al 6» e «tu al 7,2» e
   * poi «arrivi prima tu» non può rifare la somma se la metà che la spiega
   * manca.
   */
  it("nomina il ritardo che questo mazzo infligge, e decide sul turno ritardato di lui", () => {
    const frase = frasePerLaCorsa({
      ...GREZZI,
      turnoMio: 7.2,
      turnoMioRitardato: 7.2,
      ritardoInflittoConRimozioni: 1.5,
      ritardoInflittoConContromagie: 0.5,
    });

    expect(frase).toContain("turno 6");
    expect(frase).toContain("diventa 8,0");
    expect(frase).toContain("1,5 per le rimozioni di questo mazzo");
    expect(frase).toContain("0,5 per le contromagie di questo mazzo");
    expect(frase).toContain("arriva prima lui");
  });

  it("non nomina il ritardo inflitto quando non c'è", () => {
    expect(frasePerLaCorsa(GREZZI)).not.toContain("di questo mazzo");
    expect(frasePerLaCorsa(GREZZI)).not.toContain("diventa");
  });

  it("il turno di lui si rifà dai ritardi mostrati, come quello di questo mazzo", () => {
    // Un ritardo che si mostra «0,0» esce dall'elenco, e non sposta il turno.
    const frase = frasePerLaCorsa({ ...GREZZI, ritardoInflittoConRimozioni: 0.02 });
    expect(frase).not.toContain("di questo mazzo");
    expect(frase).not.toContain("diventa");
  });

  it("dice il pareggio invece di scegliere un vincitore a caso", () => {
    expect(frasePerLaCorsa({ ...GREZZI, turnoSuo: 5 })).toContain("arrivano insieme");
  });

  it("non racconta una corsa quando il mazzo non chiude mai", () => {
    const frase = frasePerLaCorsa({ ...GREZZI, turnoMio: null, turnoMioRitardato: null });
    expect(frase).toContain("non chiude mai");
    expect(frase).not.toContain("arriva prima");
  });

  it("dice sempre quante volte ci arriva, che è il numero che regge tutto il resto", () => {
    expect(frasePerLaCorsa(GREZZI)).toContain("80%");
    expect(frasePerLaCorsa(GREZZI)).toContain("le altre non chiude affatto");
  });

  it("non parla di «le altre volte» quando altre volte non ce ne sono", () => {
    // Vista girare nell'app: sotto un 100% la frase diceva «ci arriva 100%
    // delle volte — le altre non chiude affatto», che si contraddice da sola. È
    // il genere di riga che insegna a non leggere le altre.
    const frase = frasePerLaCorsa({ ...GREZZI, quotaPartiteChiuse: 1 });

    expect(frase).toContain("tutte le volte");
    expect(frase).not.toContain("le altre");
  });

  it("una partita su cinquecento che non chiude non si arrotonda a «100%»", () => {
    // Il ticket 43. La guardia guardava il numero grezzo — esatto, `>= 1` — e
    // accanto ci stampava quello arrotondato: 499 partite su 500 fanno 0,998,
    // che come percentuale tonda è «100%». Ne usciva «ci arriva 100% delle
    // volte — le altre non chiude affatto», cioè precisamente la riga che il
    // commento tre righe sopra la guardia promette di non scrivere.
    const frase = frasePerLaCorsa({ ...GREZZI, quotaPartiteChiuse: 499 / 500 });

    expect(frase).not.toContain("100%");
    expect(frase).toContain("99,8%");
    // La partita che non chiude c'è, e va detta: il guasto era la coppia, non
    // la coda.
    expect(frase).toContain("le altre non chiude affatto");
  });

  it("una partita su cinquecento che chiude non si arrotonda a «0%»", () => {
    // L'altro capo dello stesso guasto: la frase dice a che turno il mazzo
    // chiude, e sotto scriveva che non ci arriva mai. Il turno medio esiste
    // appena una partita chiude, quindi il ramo del «non chiude mai» non
    // interviene, e restava scritto «chiude al turno 7,0 […] E ci arriva 0%
    // delle volte».
    const frase = frasePerLaCorsa({ ...GREZZI, quotaPartiteChiuse: 1 / 500 });

    expect(frase).not.toContain("0% delle volte");
    expect(frase).toContain("0,2%");
  });

  it("la somma che la frase mostra torna con i numeri che mostra", () => {
    // Il patto della corsa: chi legge può rifare la somma. Un ritardo che si
    // mostra «0,0» esce dall'elenco, e allora non può nemmeno restare dentro il
    // turno ritardato — se no la riga legge «chiude al turno 5,0, che diventa
    // 5,2 contando 0,1 per le sue contromagie», e i conti non tornano.
    const frase = frasePerLaCorsa({
      ...GREZZI,
      turnoSuo: 9,
      turnoMio: 5,
      ritardoDaRimozioni: 2 * 0.5 * (1 / 24),
      ritardoDaContromagie: 1.5 * 2 * 0.5 * (1 / 24),
      turnoMioRitardato: 5 + 2 * 0.5 * (1 / 24) + 1.5 * 2 * 0.5 * (1 / 24),
    });

    expect(frase).toContain("chiude al turno 5,0, che diventa 5,1 contando 0,1 per le sue contromagie");
    expect(frase).not.toContain("rimozioni");
  });

  it("non dichiara un vincitore fra due turni che si mostrano uguali", () => {
    // Il turno medio è una media su cinquecento partite, e si mostra a un
    // decimale: con un avversario a 5 e un mazzo a 5,02 la frase scriveva due
    // volte «5,0» e ne dichiarava uno perdente.
    const frase = frasePerLaCorsa({
      ...GREZZI,
      turnoSuo: 5,
      turnoMio: 5.02,
      turnoMioRitardato: 5.02,
    });

    expect(frase).toContain("arrivano insieme");
    expect(frase).not.toContain("arriva prima");
  });

  it("non nomina un ritardo che si mostra «0,0»", () => {
    // Un avversario con una sola rimozione contro un mazzo mezzo di creature
    // costa 2 × 0,5 × 1/24 = 0,042 turni: la guardia sul grezzo lo faceva
    // nominare, e la frase leggeva «chiude al turno 5,0, che diventa 5,0
    // contando 0,0 per le sue rimozioni». Il «diventa» non diventava niente.
    const frase = frasePerLaCorsa({
      ...GREZZI,
      turnoMio: 5,
      ritardoDaRimozioni: 2 * 0.5 * (1 / 24),
      turnoMioRitardato: 5 + 2 * 0.5 * (1 / 24),
    });

    expect(frase).not.toContain("rimozioni");
    expect(frase).not.toContain("diventa");
    expect(frase).toContain("chiude al turno 5,0");
  });

  it("il turno ritardato segue il ritardo mostrato, non quello grezzo", () => {
    // L'altra direzione della stessa regola: mezzo centesimo di turno si mostra
    // «0,1», mentre il turno ritardato grezzo — 5,05 — arrotondato per conto suo
    // resterebbe «5,0». La frase deve dire 5,1, cioè il turno più il ritardo che
    // ha appena scritto, o torna a promettere un «diventa» che non diventa.
    const frase = frasePerLaCorsa({
      ...GREZZI,
      turnoMio: 5,
      ritardoDaRimozioni: 0.05,
      turnoMioRitardato: 5.05,
    });

    expect(frase).toContain("chiude al turno 5,0, che diventa 5,1 contando 0,1 per le sue rimozioni");
  });
});

/**
 * Ticket 31: il tema con cui un mazzo è stato costruito resta attaccato a quel
 * mazzo e ne sceglie le terre. Va dichiarato mentre vale, come il tetto — e con
 * dei numeri dentro, perché una frase senza numeri è un'opinione.
 */
describe("il tema che sceglie le terre del mazzo in mano", () => {
  it("dice quante terre ammette, e quante ne ammetterebbe quello di adesso", () => {
    const frase = frasePerIlTemaInVigore({
      terreAmmesse: 12,
      terreDelFormato: 37,
      terreColTemaDiAdesso: 30,
      terreSoloSue: 0,
    });

    expect(frase).toContain("12");
    expect(frase).toContain("37");
    expect(frase).toContain("30");
  });

  it("un tema che non esclude nessuna terra non dice «12 delle 12»", () => {
    const frase = frasePerIlTemaInVigore({
      terreAmmesse: 37,
      terreDelFormato: 37,
      terreColTemaDiAdesso: 12,
      terreSoloSue: 25,
    });

    expect(frase).toContain("non ne esclude nessuna delle 37");
    expect(frase).not.toMatch(/37 delle 37/u);
  });

  it("a conti pari dice quante non sono le stesse, invece di ripetere il numero", () => {
    // Due temi possono ammettere altrettante terre senza ammettere le stesse:
    // la frase che si fermasse ai totali direbbe «28… e ne avrebbe 28», cioè un
    // avviso i cui numeri non mostrano niente da avvisare.
    const frase = frasePerIlTemaInVigore({
      terreAmmesse: 28,
      terreDelFormato: 40,
      terreColTemaDiAdesso: 28,
      terreSoloSue: 5,
    });

    expect(frase).toContain("5 terre");
    expect(frase).not.toMatch(/ne avrebbe 28/u);
  });

  it("su quel che esce dice gli stessi numeri e dove si cambia", () => {
    const frase = frasePerIlTemaSuQuelCheEsce({
      terreAmmesse: 12,
      terreDelFormato: 37,
      terreColTemaDiAdesso: 30,
      terreSoloSue: 0,
    });

    expect(frase).toContain("12");
    expect(frase).toContain("Mazzo");
  });
});

/**
 * Ticket 10: il mazzo di un altro gioco dice **perché** non si apre, con i nomi
 * che i due documenti di formato dichiarano e non con nomi scritti qui.
 */
describe("il mazzo di un altro formato", () => {
  const CORRENTE = { nome: "Formato di adesso", impronta: "una-regola/aaa+bbb" };
  const ALTRO = { nome: "Formato di prima", impronta: "altra-regola/ccc" };

  it("nomina il formato del mazzo e quello che l'app gioca adesso", () => {
    const frase = frasePerUnMazzoDiUnAltroFormato({
      delMazzo: ALTRO,
      corrente: CORRENTE,
      dove: "salvato",
    });

    expect(frase).toContain("«Formato di prima»");
    expect(frase).toContain("«Formato di adesso»");
  });

  it("di un mazzo che il formato non lo dichiara non inventa un nome", () => {
    const frase = frasePerUnMazzoDiUnAltroFormato({
      delMazzo: undefined,
      corrente: CORRENTE,
      dove: "salvato",
    });

    expect(frase).toContain("«Formato di adesso»");
    expect(frase).not.toMatch(/undefined|«»/u);
    expect(frase).toMatch(/non dice di che formato/u);
    // Perché non lo dica non si sa: un mazzo di prima e un testo a cui qualcuno
    // ha tolto le righe si leggono uguali.
    expect(frase).not.toMatch(/prima/u);
  });

  it("con lo stesso nome e un altro gioco non dice «X» contro «X»", () => {
    // Il nome si mostra e non si confronta: il giorno che il gruppo cambia le
    // edizioni tenendo il nome, i due nomi coincidono e la ragione è altrove.
    const frase = frasePerUnMazzoDiUnAltroFormato({
      delMazzo: { ...ALTRO, nome: CORRENTE.nome },
      corrente: CORRENTE,
      dove: "salvato",
    });

    expect(frase.split("«Formato di adesso»").length - 1).toBe(1);
    expect(frase).toMatch(/edizioni/u);
    // Quale dei due documenti venga prima le impronte non lo dicono.
    expect(frase).not.toMatch(/prima/u);
  });

  it("su un mazzo salvato dice che resta, e che a cancellarlo è solo l'utente", () => {
    const frase = frasePerUnMazzoDiUnAltroFormato({
      delMazzo: ALTRO,
      corrente: CORRENTE,
      dove: "salvato",
    });

    expect(frase).toMatch(/cancell/u);
    expect(frase).not.toMatch(/importat/u);
  });

  it("su un file da importare dice che non l'ha importato", () => {
    const frase = frasePerUnMazzoDiUnAltroFormato({
      delMazzo: ALTRO,
      corrente: CORRENTE,
      dove: "da-importare",
    });

    expect(frase).toMatch(/non l.ho importato/u);
  });
});

/**
 * Ticket 06 della tappa 3: **perché questo mazzo è un aggro**, coi numeri che
 * l'hanno stabilito e non con l'etichetta.
 *
 * L'etichetta da sola sarebbe il difetto che ADR-0001 esiste per non fare: una
 * parola attaccata al mazzo, indistinguibile da un archetipo scritto a mano. La
 * frase deve portare dentro la misura — il turno, la quota, le corse — **e le
 * soglie accanto**, perché un numero senza il suo confine è vero e muto: «ci
 * arriva 92% delle volte» non dice perché quel 92% basti.
 */
describe("perché questo mazzo è quel che è", () => {
  /** Un mazzo che chiude presto e quasi sempre. */
  const AGGRO = {
    turnoMedioDiChiusura: 4.2,
    quotaPartiteChiuse: 0.92,
    corse: 0,
    corseRetteGrazieAlRitardo: 0,
  };

  it("l'aggro dice il turno medio, quante volte chiude, e i due confini", () => {
    const frase = frasePerLArchetipo({ archetipo: "aggro", grezzi: AGGRO });

    expect(frase).toContain("aggro");
    expect(frase).toContain("4,2");
    expect(frase).toContain("92%");
    // Le due soglie che quella casella l'hanno data: il turno e la quota.
    expect(frase).toContain("6º");
    expect(frase).toContain("80%");
  });

  it("il midrange dice tutt'e due i confini: più tardi dell'aggro, e non oltre il suo", () => {
    const frase = frasePerLArchetipo({
      archetipo: "midrange",
      grezzi: { ...AGGRO, turnoMedioDiChiusura: 7.5, quotaPartiteChiuse: 0.88 },
    });

    expect(frase).toContain("midrange");
    expect(frase).toContain("7,5");
    expect(frase).toContain("88%");
    expect(frase).toContain("6º");
    expect(frase).toContain("9º");
    expect(frase).toContain("80%");
  });

  /** Un mazzo che chiude tardi e regge le corse grazie al ritardo che infligge. */
  const CONTROLLO = {
    turnoMedioDiChiusura: 11.3,
    quotaPartiteChiuse: 0.62,
    corse: 4,
    corseRetteGrazieAlRitardo: 3,
  };

  it("il controllo dice che chiude tardi, e le corse che regge grazie al ritardo", () => {
    const frase = frasePerLArchetipo({ archetipo: "controllo", grezzi: CONTROLLO });

    expect(frase).toContain("controllo");
    expect(frase).toContain("11,3");
    expect(frase).toContain("9º");
    expect(frase).toContain("62%");
    // Le due metà del conto delle corse, e la soglia che le pesa: senza il
    // denominatore «ne regge 3» non si può controllare.
    expect(frase).toContain("3 su 4");
    expect(frase).toContain("50%");
    expect(frase).toMatch(/ritardo/u);
  });

  it("le corse si contano sugli orologi dichiarati, che sono quel che l'utente scrive", () => {
    // `CONTEXT.md`: l'utente dichiara **orologi**; la corsa è il confronto che
    // ne esce. Dire «le corse che hai dichiarato» sposta la parola di un passo.
    const frase = frasePerLArchetipo({ archetipo: "controllo", grezzi: CONTROLLO });

    expect(frase).toContain("orologi che hai dichiarato");
    expect(frase).not.toContain("corse che hai dichiarato");
  });

  it("non dice «le regge» di tre corse su quattro", () => {
    // Il clitico riprenderebbe le quattro corse invece delle tre rette: letta a
    // voce alta, la frase direbbe che le regge tutte.
    const frase = frasePerLArchetipo({ archetipo: "controllo", grezzi: CONTROLLO });

    expect(frase).not.toContain("le regge");
  });

  it("con un orologio solo non scrive «1 delle 1 corse»", () => {
    const frase = frasePerLArchetipo({
      archetipo: "controllo",
      grezzi: { ...CONTROLLO, corse: 1, corseRetteGrazieAlRitardo: 1 },
    });

    expect(frase).not.toMatch(/1 su 1|1 delle 1/u);
    expect(frase).toMatch(/l.unico orologio/u);
  });

  it("nessuno dei tre dice i numeri e non sceglie la casella più vicina", () => {
    const frase = frasePerLArchetipo({
      archetipo: "nessuno-dei-tre",
      grezzi: {
        turnoMedioDiChiusura: 7.1,
        quotaPartiteChiuse: 0.45,
        corse: 3,
        corseRetteGrazieAlRitardo: 1,
      },
    });

    expect(frase).toContain("nessuno dei tre");
    expect(frase).toContain("7,1");
    expect(frase).toContain("45%");
    expect(frase).toContain("1 su 3");
    expect(frase).not.toContain("aggro");
    expect(frase).not.toContain("midrange");
  });

  it("senza orologi dichiarati non nomina nessuna corsa", () => {
    // «ne regge 0 su 0» sarebbe una frazione che non esiste, e una riga che
    // insegna a saltare le altre.
    const frase = frasePerLArchetipo({
      archetipo: "nessuno-dei-tre",
      grezzi: {
        turnoMedioDiChiusura: 7.1,
        quotaPartiteChiuse: 0.45,
        corse: 0,
        corseRetteGrazieAlRitardo: 0,
      },
    });

    expect(frase).not.toMatch(/corsa|corse|orolog/u);
  });

  it("un mazzo che non chiude mai non si inventa il turno «0,0», e un numero lo porta lo stesso", () => {
    // `archetipoDi` non ha un turno da dare quando la simulazione non chiude
    // nemmeno una partita, e un turno zero sarebbe il più veloce che esista: la
    // frase direbbe il contrario esatto di quel che è successo. Il numero che
    // porta è la quota, che è zero e lo dice — una frase senza numeri sarebbe
    // un'opinione.
    const frase = frasePerLArchetipo({
      archetipo: "nessuno-dei-tre",
      grezzi: {
        turnoMedioDiChiusura: null,
        quotaPartiteChiuse: 0,
        corse: 0,
        corseRetteGrazieAlRitardo: 0,
      },
    });

    expect(frase).toContain("nessuno dei tre");
    expect(frase).not.toContain("0,0");
    expect(frase).toMatch(/non chiude mai/u);
    expect(frase).toMatch(/\d/u);
  });
});

/**
 * Ticket 06 della tappa 3, terza casella: «perché la frontiera è **più corta**
 * del solito, **quando lo è**» — e una frontiera più corta non è solo quella
 * lunga uno. Con due o tre mazzi consegnati e qualche passo perso per strada,
 * l'app diceva soltanto «3 mazzi, dal più fedele al tema al più forte», e i
 * passi mancanti non li nominava nessuno.
 */
describe("la frontiera più corta del solito", () => {
  const INTERA = { troncataPerTempo: false, tetto: null, strategia: null };

  it("tace quando non manca nessun passo", () => {
    expect(frasePerLaFrontieraPiuCorta(INTERA)).toBeNull();
    expect(
      frasePerLaFrontieraPiuCorta({
        ...INTERA,
        tetto: { euro: 50, passiSenzaMazzo: 0 },
        strategia: { dichiarata: "aggro", passiSenzaMazzo: 0 },
      }),
    ).toBeNull();
  });

  it("con la strategia dice quanti passi ha lasciato senza mazzo, e quale strategia", () => {
    const frase = frasePerLaFrontieraPiuCorta({
      ...INTERA,
      strategia: { dichiarata: "aggro", passiSenzaMazzo: 2 },
    });

    expect(frase).toContain("2");
    expect(frase).toContain("aggro");
  });

  it("con un passo solo non scrive «1 passi»", () => {
    const frase = frasePerLaFrontieraPiuCorta({
      ...INTERA,
      strategia: { dichiarata: "controllo", passiSenzaMazzo: 1 },
    });

    expect(frase).not.toMatch(/1 passi/u);
  });

  it("col tetto dice la cifra, perché è la risposta che si può agire", () => {
    const frase = frasePerLaFrontieraPiuCorta({
      ...INTERA,
      tetto: { euro: 42.5, passiSenzaMazzo: 3 },
    });

    expect(frase).toContain("3");
    expect(frase).toContain("42,50");
  });

  it("dove morde la strategia non incolpa il tetto", () => {
    // La stessa regola di `frasePerIlMazzoSolo`: dove la domanda più stretta ha
    // già tolto il mazzo, il tetto non ha nemmeno avuto modo di mordere.
    const frase = frasePerLaFrontieraPiuCorta({
      ...INTERA,
      tetto: { euro: 42.5, passiSenzaMazzo: 3 },
      strategia: { dichiarata: "midrange", passiSenzaMazzo: 1 },
    });

    expect(frase).toContain("midrange");
    expect(frase).not.toContain("42,50");
  });
});

/**
 * Ticket 83, seconda casella: il conto dice il vero su quel che le terre base
 * costano. Col prezzo dichiarato le sa contare — ma l'avviso che accompagna
 * ogni cifra promette il prezzo della copia più economica su Cardmarket, e
 * quella parte del conto su Cardmarket non ci è mai passata.
 */
describe("le copie contate a un prezzo dichiarato", () => {
  it("tace quando non ce n'è nessuna", () => {
    expect(frasePerIlPrezzoDichiarato({ copie: 0, euro: 0 })).toBeNull();
  });

  it("dice quante copie sono e quanto pesano", () => {
    const frase = frasePerIlPrezzoDichiarato({ copie: 24, euro: 0 });

    expect(frase).toContain("24");
    expect(frase).toContain("0,00 €");
    expect(frase).toMatch(/dichiarat/u);
  });

  it("con una copia sola concorda il verbo", () => {
    const frase = frasePerIlPrezzoDichiarato({ copie: 1, euro: 0.5 });

    expect(frase).not.toMatch(/1 copie|pesano/u);
    expect(frase).toContain("0,50 €");
  });
});

