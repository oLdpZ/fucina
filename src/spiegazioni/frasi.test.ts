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
  frasePerIlGuaioDellaCombo,
  frasePerIlMazzoSolo,
  frasePerLaCorsa,
  frasePerIlPasso,
  frasePerIlPattoDellaCombo,
  frasePerLaCombo,
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
  });
});

describe("quel che il tetto di spesa è costato alla base", () => {
  it("resta muta quando il tetto non ha tolto niente", () => {
    // Una frase che dicesse «non ti ho tolto niente» a ogni mazzo insegnerebbe
    // a saltarla proprio le volte che conta.
    expect(frasePerLeRinunceDelBudget({ tetto: 100, rinunce: [] })).toBe("");
  });

  it("nomina le terre lasciate fuori, con le copie e gli euro", () => {
    const frase = frasePerLeRinunceDelBudget({
      tetto: 300,
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

  it("su quel che esce dice la cifra e dove si leva", () => {
    const frase = frasePerIlTettoSuQuelCheEsce({ tetto: 30 });
    expect(frase).toContain("30,00 €");
    expect(frase).toContain("Mazzo");
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
    expect(frasePerIlMazzoSolo({ troncataPerTempo: false, tetto: null })).toBe(
      "Un mazzo solo: cedendo tema, qui, non si guadagna potenza da nessuna parte.",
    );
  });

  it("col tetto acceso ma nessun passo tolto dice ancora che il baratto non c'è", () => {
    // Il tetto c'è e non ha tolto niente: la frontiera è corta per la ragione
    // di sempre, e attribuirlo al portafoglio sarebbe inventare una causa.
    expect(
      frasePerIlMazzoSolo({ troncataPerTempo: false, tetto: { euro: 30, passiSenzaMazzo: 0 } }),
    ).toBe("Un mazzo solo: cedendo tema, qui, non si guadagna potenza da nessuna parte.");
  });

  it("quando il tetto ha tolto i passi lo dice, col numero dentro", () => {
    // Senza il numero sarebbe un no come gli altri. Con il numero è una
    // risposta che si può agire: alza il tetto e il baratto ricompare.
    const frase = frasePerIlMazzoSolo({
      troncataPerTempo: false,
      tetto: { euro: 30, passiSenzaMazzo: 3 },
    });

    expect(frase).toContain("30,00 €");
    expect(frase).toContain("3 passi");
    expect(frase).not.toContain("non si guadagna potenza da nessuna parte");
  });

  it("accorda al singolare quando il passo tolto è uno solo", () => {
    const frase = frasePerIlMazzoSolo({
      troncataPerTempo: false,
      tetto: { euro: 12.5, passiSenzaMazzo: 1 },
    });

    expect(frase).toContain("un altro passo");
    expect(frase).toContain("12,50 €");
  });

  it("il tempo scaduto viene prima del tetto, perché quei passi non sono stati provati", () => {
    // Una ricerca troncata non ha nemmeno **cercato** i passi che mancano:
    // accusare il tetto sarebbe dare al portafoglio la colpa dell'orologio.
    const frase = frasePerIlMazzoSolo({
      troncataPerTempo: true,
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
