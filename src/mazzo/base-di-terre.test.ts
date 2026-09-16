/**
 * La cucitura della schermata: si dà un gruppo di carte non-terra, si riceve la
 * base di terre e la probabilità reale di lanciare ognuna al suo turno.
 *
 * I test entrano solo da qui, come vuole `spec.md`: nomi di funzioni interne e
 * ordine dei passaggi non compaiono, perché cambieranno.
 */

import { describe, expect, it } from "vitest";

import { TERRE_FINTE } from "../catalogo/pool-finto.js";
import type { Carta, Tag } from "../dati/pool.js";
import {
  analizzaBaseDiTerre,
  postiDiTerraRiempibili,
  type CopieDiCarta,
} from "./base-di-terre.js";
import { leggiTettoDiCopie } from "./copie.js";
import {
  COPIE_MINIME_PER_UNA_TERRA_DI_UTILITA,
  PERDITA_MASSIMA_PER_I_COLORI,
  TERRE_DI_UTILITA_MASSIME,
  TERRE_MASSIME,
  TERRE_SENZA_MANA_MASSIME,
} from "./taratura.js";

/** Una carta non-terra inventata sul momento: conta solo il suo costo. */
function magia(
  nome: string,
  costoDiMana: string,
  valoreDiMana: number,
  tag: readonly Tag[] = [],
): Carta {
  return {
    id: `finta-${nome}`,
    nome,
    costoDiMana,
    valoreDiMana,
    identitaDiColore: [],
    tipi: ["Creature"],
    sottotipi: [],
    testo: "",
    forza: null,
    costituzione: null,
    immagine: null,
    rarita: "common",
    riservata: false,
    nomeItaliano: null,
    edizione: "prova",
    numeroDiCollezione: "1",
    linguaDellaStampa: "en",
    prezzo: {
      euro: 0.1,
      aggiornatoIl: "2026-09-02",
      stampa: { edizione: "prova", numeroDiCollezione: "1", lingua: "en" },
    },
    tag: [...tag],
    tagScryfall: [],
    facce: null,
    terra: null,
    tettoDiCopie: leggiTettoDiCopie("", ["Creature"]),
  };
}

function mazzo(...voci: [string, string, number, number][]): CopieDiCarta[] {
  return voci.map(([nome, costo, valore, copie]) => ({
    carta: magia(nome, costo, valore),
    copie,
  }));
}

/** C(n, k) esatto: i numeri attesi si scrivono come formule, non si copiano. */
function combinazioni(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n;
  let risultato = 1n;
  for (let i = 0n; i < BigInt(k); i++) {
    risultato = (risultato * BigInt(n - Number(i))) / (i + 1n);
  }
  return risultato;
}

function copie(base: { terre: readonly CopieDiCarta[] }, nome: string): number {
  return base.terre.find((voce) => voce.carta.nome === nome)?.copie ?? 0;
}

/**
 * Un mazzo rosso che **potenzia**: è il tag che porta la terra-creatura del
 * pool finto, e serve ai test delle terre di utilità qui sotto.
 */
function mazzoChePotenzia(copieDelTag = 20): CopieDiCarta[] {
  return [
    { carta: magia("Ingrossatore", "{R}", 1, ["potenzia"]), copie: copieDelTag },
    { carta: magia("Corpo", "{1}{R}", 2, []), copie: 38 - copieDelTag },
  ];
}

describe("quante terre", () => {
  it("un mazzo che costa poco ne vuole meno di uno che costa molto", () => {
    const leggero = analizzaBaseDiTerre(
      mazzo(["Uno", "{R}", 1, 20], ["Due", "{1}{R}", 2, 18]),
      TERRE_FINTE,
      { terreVolute: null, budget: null },
    );
    const pesante = analizzaBaseDiTerre(
      mazzo(["Cinque", "{4}{R}", 5, 20], ["Sei", "{5}{R}", 6, 18]),
      TERRE_FINTE,
      { terreVolute: null, budget: null },
    );

    expect(leggero.numeroTerre).toBeLessThan(pesante.numeroTerre);
  });

  it("il numero deciso dall'app si può scavalcare a mano", () => {
    const carte = mazzo(["Due", "{1}{R}", 2, 24]);
    const dallApp = analizzaBaseDiTerre(carte, TERRE_FINTE, { terreVolute: null, budget: null });
    const aMano = analizzaBaseDiTerre(carte, TERRE_FINTE, { terreVolute: 26, budget: null });

    expect(aMano.numeroTerre).toBe(26);
    expect(aMano.numeroTerreDallaCurva).toBe(dallApp.numeroTerre);
    // Più terre, più probabilità di poterla lanciare: è il compromesso che
    // l'utente deve poter vedere muoversi.
    expect(aMano.righe[0]!.probabilita).toBeGreaterThan(dallApp.righe[0]!.probabilita);
  });

  it("mette in tavola sempre sessanta carte, anche se il mazzo non è finito", () => {
    const base = analizzaBaseDiTerre(mazzo(["Due", "{1}{R}", 2, 4]), TERRE_FINTE, {
      terreVolute: null,
      budget: null,
    });

    expect(base.dimensioneMazzo).toBe(60);
    expect(base.copieNonTerra).toBe(4);
  });
});

describe("quali terre", () => {
  it("un mazzo di un colore solo gioca solo la sua terra base", () => {
    const base = analizzaBaseDiTerre(mazzo(["Uno", "{R}", 1, 30]), TERRE_FINTE, {
      terreVolute: 24,
      budget: null,
    });

    expect(copie(base, "Mountain")).toBe(24);
    expect(base.terre).toHaveLength(1);
    expect(base.terreCheEntranoGirate).toBe(0);
  });

  it("un mazzo a due colori prende le terre doppie che fanno quei due colori", () => {
    const base = analizzaBaseDiTerre(
      mazzo(["Nera", "{1}{B}", 2, 16], ["Rossa", "{1}{R}", 2, 16]),
      TERRE_FINTE,
      { terreVolute: 24, budget: null },
    );

    // La terra doppia che entra dritta viene prima di quelle che entrano
    // girate, e in quattro copie: è il massimo consentito.
    expect(copie(base, "Cinder Crossing")).toBe(4);
    // Non prende terre doppie di colori che il mazzo non gioca.
    expect(copie(base, "Tideglass Steps")).toBe(0);
    // E resta comunque una base di ventiquattro terre.
    const totale = base.terre.reduce((somma, voce) => somma + voce.copie, 0);
    expect(totale).toBe(24);
  });

  it("dichiara quante terre entrano girate, e quante solo a volte", () => {
    const base = analizzaBaseDiTerre(
      mazzo(["Nera", "{1}{B}", 2, 16], ["Rossa", "{1}{R}", 2, 16]),
      TERRE_FINTE,
      { terreVolute: 24, budget: null },
    );

    const girate = base.terre
      .filter((voce) => voce.carta.terra?.entraGirata === true)
      .reduce((somma, voce) => somma + voce.copie, 0);
    expect(base.terreCheEntranoGirate).toBe(girate);
    expect(base.terreCheEntranoGirate).toBeGreaterThan(0);
  });

  it("le terre messe sono sempre esattamente quante promesse", () => {
    // Se il numero in cima dicesse 24 e le terre elencate fossero 23, tutte le
    // probabilità sotto sarebbero calcolate su un mazzo che non esiste.
    const mazzi = [
      mazzo(["Uno", "{R}", 1, 30]),
      mazzo(["Nera", "{1}{B}", 2, 16], ["Rossa", "{1}{R}", 2, 16]),
      mazzo(["Nera", "{B}", 1, 12], ["Rossa", "{R}", 1, 12], ["Blu", "{U}", 1, 12]),
      // Un colore che nessuna terra base del pool finto produce non deve far
      // sparire terre dal conto.
      mazzo(["Incolore", "{C}", 1, 12], ["Rossa", "{R}", 1, 12]),
    ];

    // E lo stesso con un pool a cui manca la terra base di un colore chiesto:
    // il pool arriva dai dati, e i dati possono sempre sorprendere.
    const senzaIncolore = TERRE_FINTE.filter((carta) => carta.nome !== "Wastes");

    for (const carte of mazzi) {
      for (const pool of [TERRE_FINTE, senzaIncolore]) {
        for (let volute = 20; volute <= 27; volute++) {
          const base = analizzaBaseDiTerre(carte, pool, { terreVolute: volute, budget: null });
          const totale = base.terre.reduce((somma, voce) => somma + voce.copie, 0);
          expect(totale).toBe(volute);
        }
      }
    }
  });

  it("non mette mai più di quattro copie di una terra non base", () => {
    const base = analizzaBaseDiTerre(
      mazzo(["Nera", "{1}{B}", 2, 16], ["Rossa", "{1}{R}", 2, 16]),
      TERRE_FINTE,
      { terreVolute: 26, budget: null },
    );

    for (const voce of base.terre) {
      if (voce.carta.tipi.includes("Basic")) continue;
      expect(voce.copie).toBeLessThanOrEqual(4);
    }
  });
});

describe("i posti di terra: il conto e la base non possono divergere", () => {
  // Due conti delle terre che si scoprono diversi sono già costati due ticket
  // (17 e 39): chi conta i posti prima di cercare e chi poi le sceglie devono
  // rispondere lo stesso, e qui si verifica sulla cucitura, non sul sorgente.
  const NERO_E_ROSSO = mazzo(["Nera", "{1}{B}", 2, 16], ["Rossa", "{1}{R}", 2, 16]);

  function terreScelte(terreDelPool: readonly Carta[], terreVolute: number): number {
    return analizzaBaseDiTerre(NERO_E_ROSSO, terreDelPool, {
      terreVolute,
      budget: null,
    }).terre.reduce((somma, voce) => somma + voce.copie, 0);
  }

  it("senza nessuna terra base i posti sono zero, e la base ne fa zero", () => {
    const senzaBasi = TERRE_FINTE.filter((carta) => !carta.tipi.includes("Basic"));

    expect(postiDiTerraRiempibili(senzaBasi)).toBe(0);
    expect(terreScelte(senzaBasi, 24)).toBe(0);
  });

  it("con una terra base sola i posti sono tutti, e la base li riempie tutti", () => {
    const unaSola = TERRE_FINTE.filter(
      (carta) => !carta.tipi.includes("Basic") || carta.nome === "Swamp",
    );

    expect(postiDiTerraRiempibili(unaSola)).toBe(TERRE_MASSIME);
    // Fino al massimo che l'app mette: le terre base non hanno tetto di copie,
    // ed è la ragione per cui il conto è «zero oppure tutti» e non una somma.
    expect(terreScelte(unaSola, TERRE_MASSIME)).toBe(TERRE_MASSIME);
  });
});

describe("le probabilità", () => {
  it("su una base di sole terre base sono l'ipergeometrica scritta a penna", () => {
    // Ventiquattro Montagne dritte in sessanta carte. Per una carta da {R} al
    // turno 1 servono 7 carte viste e almeno una Montagna: 1 − C(36,7)/C(60,7).
    const attesa = 1 - Number(combinazioni(36, 7)) / Number(combinazioni(60, 7));

    const base = analizzaBaseDiTerre(mazzo(["Uno", "{R}", 1, 4]), TERRE_FINTE, {
      terreVolute: 24,
      budget: null,
    });

    expect(base.righe[0]!.probabilita).toBeCloseTo(attesa, 12);
    expect(base.righe[0]!.turno).toBe(1);
  });

  it("scendono man mano che una carta chiede più simboli dello stesso colore", () => {
    const base = analizzaBaseDiTerre(
      mazzo(["Uno", "{R}", 1, 4], ["Doppia", "{R}{R}", 2, 4], ["Tripla", "{R}{R}{R}", 3, 4]),
      TERRE_FINTE,
      { terreVolute: 24, budget: null },
    );

    const [uno, doppia, tripla] = base.righe;
    expect(uno!.probabilita).toBeGreaterThan(doppia!.probabilita);
    expect(doppia!.probabilita).toBeGreaterThan(tripla!.probabilita);
  });

  it("segnalano le carte che questa base non regge, per colpa dei colori", () => {
    // «Dura» chiede due simboli per ciascuno dei due colori allo stesso turno:
    // è la carta che una base a due colori non regge. «Facile» costa uguale ma
    // chiede un solo simbolo, e non va segnalata: se lo fosse, l'avviso non
    // direbbe più niente.
    const base = analizzaBaseDiTerre(
      mazzo(["Facile", "{3}{B}", 4, 20], ["Dura", "{B}{B}{R}{R}", 4, 4]),
      TERRE_FINTE,
      { terreVolute: 24, budget: null },
    );

    const dura = base.righe.find((riga) => riga.carta.nome === "Dura")!;
    expect(dura.probabilitaSenzaColori - dura.probabilita).toBeGreaterThan(
      PERDITA_MASSIMA_PER_I_COLORI,
    );
    expect(dura.difficile).toBe(true);
    expect(base.difficili.map((riga) => riga.carta.nome)).toEqual(["Dura"]);
  });

  it("non segnalano una carta solo perché costa tanto", () => {
    // Al turno cinque nessun mazzo ha cinque terre più di un terzo delle volte:
    // è il costo, non la base. La probabilità resta bassa e in vista, ma
    // l'avviso non scatta, perché cambiare le terre non risolverebbe niente.
    const base = analizzaBaseDiTerre(mazzo(["Grossa", "{4}{R}", 5, 30]), TERRE_FINTE, {
      terreVolute: 24,
      budget: null,
    });

    const grossa = base.righe[0]!;
    expect(grossa.probabilita).toBeLessThan(0.5);
    expect(grossa.difficile).toBe(false);
  });

  it("stesso mazzo, stessi numeri: il conto non ha nulla di casuale", () => {
    const carte = mazzo(["Nera", "{1}{B}", 2, 16], ["Rossa", "{1}{R}", 2, 16]);
    const prima = analizzaBaseDiTerre(carte, TERRE_FINTE, { terreVolute: null, budget: null });
    const dopo = analizzaBaseDiTerre(carte, TERRE_FINTE, { terreVolute: null, budget: null });

    expect(JSON.stringify(dopo)).toBe(JSON.stringify(prima));
  });

  it("un mazzo vuoto non fa cadere niente", () => {
    const base = analizzaBaseDiTerre([], TERRE_FINTE, { terreVolute: null, budget: null });

    expect(base.righe).toHaveLength(0);
    expect(base.difficili).toHaveLength(0);
    expect(base.numeroTerre).toBeGreaterThan(0);
  });
});

describe("le terre di utilità: quelle che fanno qualcosa invece dei colori", () => {
  const opzioni = { terreVolute: null, budget: null };

  it("una terra che fa quel che il mazzo fa entra nella base, anche in un monocolore", () => {
    // È il caso che fino al ticket 08 non poteva succedere per nessuna strada:
    // il budget delle terre non base dipendeva dai colori, e un monocolore ne
    // aveva zero. Sono proprio i monocolore a giocarle di più.
    const base = analizzaBaseDiTerre(mazzoChePotenzia(), TERRE_FINTE, opzioni);

    expect(copie(base, "Emberworks Foundry")).toBeGreaterThan(0);
    expect(base.terreDiUtilita).toBeGreaterThan(0);
  });

  it("una carta sola non compra una terra: la sinergia si conta in copie", () => {
    // Una terra di utilità costa un posto alla base di mana. Un mazzo con una
    // sola copia di una carta che potenzia pagherebbe quattro fonti di colore
    // per una sinergia che in partita non si vede mai.
    const base = analizzaBaseDiTerre(mazzoChePotenzia(1), TERRE_FINTE, opzioni);
    expect(copie(base, "Emberworks Foundry")).toBe(0);

    // Con le copie di un tema vero, invece, la terra entra.
    const tema = analizzaBaseDiTerre(
      mazzoChePotenzia(COPIE_MINIME_PER_UNA_TERRA_DI_UTILITA),
      TERRE_FINTE,
      opzioni,
    );
    expect(copie(tema, "Emberworks Foundry")).toBeGreaterThan(0);
  });

  it("una carta che porta due tag della terra conta una volta sola", () => {
    // La soglia si conta in **carte del mazzo**, non tag per tag: una carta a
    // due tag condivisi resterebbe una carta sola, e sommandola due volte
    // pagherebbe da sé una soglia che nessuno le ha fatto passare.
    const doppia = TERRE_FINTE.map((carta) =>
      carta.nome === "Emberworks Foundry"
        ? { ...carta, tag: ["potenzia", "danno-diretto"] as Tag[] }
        : carta,
    );
    const sotto = Math.ceil(COPIE_MINIME_PER_UNA_TERRA_DI_UTILITA / 2);
    const carteSotto: CopieDiCarta[] = [
      { carta: magia("Ingrossatore", "{R}", 1, ["potenzia", "danno-diretto"]), copie: sotto },
      { carta: magia("Corpo", "{1}{R}", 2, []), copie: 38 - sotto },
    ];

    expect(copie(analizzaBaseDiTerre(carteSotto, doppia, opzioni), "Emberworks Foundry")).toBe(0);

    // Con le copie vere del tema, invece, la terra entra: è il conto per carte
    // che è cambiato, non la regola.
    const carteSopra: CopieDiCarta[] = [
      {
        carta: magia("Ingrossatore", "{R}", 1, ["potenzia", "danno-diretto"]),
        copie: COPIE_MINIME_PER_UNA_TERRA_DI_UTILITA,
      },
      { carta: magia("Corpo", "{1}{R}", 2, []), copie: 38 - COPIE_MINIME_PER_UNA_TERRA_DI_UTILITA },
    ];

    expect(
      copie(analizzaBaseDiTerre(carteSopra, doppia, opzioni), "Emberworks Foundry"),
    ).toBeGreaterThan(0);
  });

  it("una terra che il mazzo non sa usare resta fuori", () => {
    // «Sunken Quarry» distrugge terre, e questo mazzo non attacca le terre di
    // nessuno: la sinergia si conta, non si immagina.
    const base = analizzaBaseDiTerre(mazzoChePotenzia(), TERRE_FINTE, opzioni);

    expect(copie(base, "Sunken Quarry")).toBe(0);
  });

  it("una terra senza nessun tag non entra mai: di quella l'app non sa dire niente", () => {
    for (const carte of [mazzoChePotenzia(), mazzo(["Nera", "{1}{B}", 2, 34])]) {
      const base = analizzaBaseDiTerre(carte, TERRE_FINTE, opzioni);
      expect(copie(base, "Sorrowfen Path")).toBe(0);
    }
  });

  it("la base resta del numero promesso: le terre di utilità non si aggiungono, sostituiscono", () => {
    const base = analizzaBaseDiTerre(mazzoChePotenzia(), TERRE_FINTE, opzioni);
    const messe = base.terre.reduce((somma, voce) => somma + voce.copie, 0);

    expect(messe).toBe(base.numeroTerre);
    // E resta almeno una terra base per il colore che il mazzo chiede: una base
    // fatta solo di terre di utilità non farebbe i propri stessi colori.
    expect(copie(base, "Mountain")).toBeGreaterThan(0);
  });

  it("una terra che non fa mana affatto non conta fra le fonti", () => {
    // «Winding Causeway» previene danno e non produce niente. Nel mazzo c'è —
    // è un posto occupato — ma nei conti non è una fonte: contarla prometterebbe
    // a chi legge un mana che in partita non c'è.
    const carte = [
      { carta: magia("Parapetto", "{1}{W}", 2, ["previene-il-danno"]), copie: 20 },
      { carta: magia("Corpo", "{1}{W}", 2, []), copie: 18 },
    ];
    const base = analizzaBaseDiTerre(carte, TERRE_FINTE, opzioni);
    expect(copie(base, "Winding Causeway")).toBeGreaterThan(0);

    // La stessa base senza quella terra: le carte devono risultare **più**
    // facili da lanciare, perché le fonti sono le stesse su meno posti morti.
    const senza = analizzaBaseDiTerre(
      carte,
      TERRE_FINTE.filter((carta) => carta.nome !== "Winding Causeway"),
      opzioni,
    );
    expect(senza.righe[0]!.probabilita).toBeGreaterThan(base.righe[0]!.probabilita);
    expect(base.terreSenzaMana).toBeGreaterThan(0);
    expect(senza.terreSenzaMana).toBe(0);
  });

  it("una terra presa per i suoi colori non finisce nel conto delle terre di utilità", () => {
    // Il conto si faceva rifacendo il predicato su **tutte** le terre scelte,
    // invece di dire quel che il passo dell'utilità aveva aggiunto. Una terra
    // doppia presa al primo passo per i suoi colori, che per caso porta anche
    // un tag, ci finiva dentro: il numero dichiarato poteva superare il proprio
    // tetto, e non era la scelta ma una misura fatta a valle della scelta.
    //
    // Col pool di adesso i due conti coincidono, perché nessuna terra doppia
    // porta un tag. Qui gliene si dà uno, ed è il caso che il ticket descrive.
    const doppieConTag = TERRE_FINTE.map((carta) =>
      carta.terra !== null && carta.terra.coloriProdotti.length > 1
        ? { ...carta, tag: ["potenzia"] as Tag[] }
        : carta,
    );
    const base = analizzaBaseDiTerre(
      [{ carta: magia("Ingrossatore", "{B}{R}", 2, ["potenzia"]), copie: 38 }],
      doppieConTag,
      opzioni,
    );

    // Le doppie ci sono davvero: se no il caso non si starebbe provando.
    const copieDoppie = base.terre
      .filter((voce) => (voce.carta.terra?.coloriProdotti.length ?? 0) > 1)
      .reduce((somma, voce) => somma + voce.copie, 0);
    expect(copieDoppie).toBeGreaterThan(TERRE_DI_UTILITA_MASSIME);

    // E non sono terre di utilità: il mazzo non le ha prese per quel che fanno.
    expect(base.terreDiUtilita).toBeLessThanOrEqual(TERRE_DI_UTILITA_MASSIME);
  });

  it("le terre che non fanno mana hanno un tetto più stretto delle altre", () => {
    const base = analizzaBaseDiTerre(
      [{ carta: magia("Parapetto", "{1}{W}", 2, ["previene-il-danno"]), copie: 38 }],
      TERRE_FINTE,
      opzioni,
    );

    expect(base.terreSenzaMana).toBeLessThanOrEqual(TERRE_SENZA_MANA_MASSIME);
    expect(base.terreDiUtilita).toBeLessThanOrEqual(TERRE_DI_UTILITA_MASSIME);
  });
});

/**
 * Il budget della base: quel che succede quando il tetto di spesa arriva fin
 * qui.
 *
 * La regola decisa (ticket 20) è **una sola**: la base più forte che sta nel
 * budget, senza un ordine fisso fra terre doppie e terre di utilità. Quel che
 * si prova qui è quella regola, e mai come è fatta dentro.
 */
describe("la base dentro un budget", () => {
  /** Un mazzo a due colori: è quello che si compra le terre doppie. */
  const DUE_COLORI: CopieDiCarta[] = [
    { carta: magia("Nera", "{1}{B}", 2), copie: 19 },
    { carta: magia("Rossa", "{1}{R}", 2), copie: 19 },
  ];

  const conBudget = (budget: number | null) =>
    analizzaBaseDiTerre(DUE_COLORI, TERRE_FINTE, { terreVolute: 22, budget });

  const costo = (base: { terre: readonly CopieDiCarta[] }): number =>
    base.terre.reduce((somma, voce) => somma + (voce.carta.prezzo.euro ?? 0) * voce.copie, 0);

  it("senza budget sceglie esattamente la base di sempre", () => {
    // La seconda casella del ticket: chi non ha chiesto un tetto non deve
    // vedersi cambiare il mazzo sotto i piedi.
    const senza = conBudget(null);
    const larghissimo = conBudget(10_000);

    expect(larghissimo.terre).toEqual(senza.terre);
    expect(larghissimo.rinunceDelBudget).toEqual([]);
    expect(senza.rinunceDelBudget).toEqual([]);
  });

  it("con un budget stretto non lo sfonda", () => {
    // `Cinder Crossing` costa sei euro la copia ed è la doppia migliore del
    // pool finto: dentro un budget da poco non ci sta, e la base deve restare
    // una base intera lo stesso.
    const stretta = conBudget(2);

    expect(costo(stretta)).toBeLessThanOrEqual(2);
    expect(stretta.terre.reduce((somma, voce) => somma + voce.copie, 0)).toBe(22);
  });

  it("rinuncia prima alla copia che costa di più, e non alla famiglia sbagliata", () => {
    // È la decisione del ticket messa alla prova: non «prima l'utilità» né
    // «prima i colori», ma la copia che libera più soldi. Nel pool finto la
    // cara è la doppia da sei euro, e se ne va prima delle doppie da tre
    // centesimi — che restano, e tengono in piedi i due colori.
    const senza = conBudget(null);
    const stretta = conBudget(2);

    expect(copie(senza, "Cinder Crossing")).toBeGreaterThan(0);
    expect(copie(stretta, "Cinder Crossing")).toBe(0);
  });

  it("dice quali copie il tetto gli è costato, col numero", () => {
    // La terza casella: quando il tetto costa al mazzo una terra che avrebbe
    // voluto, l'app lo dice — e per dirlo a parole servono i numeri veri.
    const stretta = conBudget(2);
    const rinuncia = stretta.rinunceDelBudget.find(
      (voce) => voce.carta.nome === "Cinder Crossing",
    );

    expect(rinuncia).toBeDefined();
    expect(rinuncia!.copie).toBeGreaterThan(0);
    expect(rinuncia!.euro).toBeCloseTo(6 * rinuncia!.copie, 5);
  });

  it("un budget che non basta nemmeno alle terre base dà comunque una base intera", () => {
    // Non è compito della base dire di no: la promessa dura la fa la ricerca,
    // che un mazzo fuori dal tetto non lo consegna. Qui si deve solo non
    // cadere e non restituire meno terre di quante se ne sono promesse.
    const impossibile = conBudget(0);

    expect(impossibile.terre.reduce((somma, voce) => somma + voce.copie, 0)).toBe(22);
  });

  it("dichiara di non stare nel tetto quando le rinunce non sono bastate", () => {
    // Il ticket 63. Qui le rinunce ci sono davvero — Cinder Crossing da sei
    // euro se ne va — ma sotto il prezzo delle sole terre base non si scende, e
    // la base torna sopra il tetto lo stesso. Chi legge `rinunceDelBudget` non
    // ha modo di distinguere questo dal tetto rispettato, ed è per questo che
    // la frase annunciava un risultato che non c'era.
    const impossibile = conBudget(0);

    expect(impossibile.rinunceDelBudget.length).toBeGreaterThan(0);
    expect(costo(impossibile)).toBeGreaterThan(0);
    expect(impossibile.dentroIlBudget).toBe(false);
  });

  it("dichiara di stare nel tetto quando il tetto l'ha rispettato", () => {
    // L'altra faccia, perché una bandiera sempre falsa passerebbe il test di
    // sopra senza dire niente di vero.
    //
    // Qui si prova **solo** la bandiera: che la base costi davvero meno di due
    // euro lo inchioda il test «con un budget stretto non lo sfonda», più
    // sopra. Rifarlo qui legherebbe la bandiera a una somma che non è la sua —
    // `dentroIlBudget` viene da `nonSupera`, che perdona mezzo centesimo, e si
    // misura su `contoDelMazzo(...).minimo`, mentre `costo` qui somma
    // `prezzo.euro`. Oggi le due coincidono sul pool finto; il giorno che non
    // coincidessero il test cadrebbe su una bandiera giusta.
    const stretta = conBudget(2);

    expect(stretta.dentroIlBudget).toBe(true);
  });

  it("senza tetto non c'è niente da non rispettare", () => {
    expect(conBudget(null).dentroIlBudget).toBe(true);
  });

  it("un budget non fa mai costare la base **più** che senza budget", () => {
    // Il caso che la prima stesura sbagliava. Togliere la copia più cara e
    // metterci una terra base sembra sempre un risparmio, e non lo è: nel pool
    // finto `Sootfall Gate` costa tre centesimi dove una terra base ne costa
    // cinque, e nel pool vero `Oasis` sta a 0,28 € dove l'Isola sta a 0,45 €.
    // Scambiarla alzava il conto **e** peggiorava la base, e la frase all'utente
    // gli annunciava un risparmio che non c'era.
    const senza = costo(conBudget(null));
    for (const budget of [0, 0.5, 1, 1.2, 1.5, 2, 3, 6, 12]) {
      expect(costo(conBudget(budget)), `budget ${budget}`).toBeLessThanOrEqual(senza);
    }
  });

  it("non dichiara una rinuncia che non libera nemmeno un centesimo", () => {
    // Una doppia che costa quanto la terra base che la sostituirebbe: toglierla
    // non risparmia niente, e la base non deve né toglierla né dire all'utente
    // di averlo fatto. Il prezzo dell'altra doppia, sotto quello della base, è
    // lì per dare alle somme addendi diversi: senza, i conti tornano a bit e il
    // guasto non si vede (ticket 47).
    const riprezzata = (nome: string, euro: number): Carta => {
      const carta = TERRE_FINTE.find((voce) => voce.nome === nome)!;
      return { ...carta, prezzo: { ...carta.prezzo, euro } };
    };
    const pool = [
      riprezzata("Swamp", 0.1),
      riprezzata("Mountain", 0.1),
      riprezzata("Pyre Threshold", 0.1),
      riprezzata("Sootfall Gate", 0.05),
    ];
    const conQuesto = (budget: number | null) =>
      analizzaBaseDiTerre(DUE_COLORI, pool, { terreVolute: 22, budget });

    const impossibile = conQuesto(0);

    expect(impossibile.rinunceDelBudget).toEqual([]);
    expect(copie(impossibile, "Pyre Threshold")).toBe(copie(conQuesto(null), "Pyre Threshold"));
  });

  it("a pari risparmio lascia andare la terra meno buona, e tiene la migliore", () => {
    // La regola di spareggio, inchiodata: due doppie allo stesso prezzo liberano
    // la stessa cifra, e il budget ne chiede via una copia sola. Se ne va quella
    // scelta **dopo** — qui la girata, che dentro la sua famiglia era la meno
    // buona — e non la migliore.
    //
    // Questo test prova la **regola**, non la soglia con cui la parità si dice:
    // il ticket 47 sospettava che la parità non scattasse quasi mai, e la
    // misura ha detto il contrario — in mezzo milione di configurazioni provate
    // le due somme tornavano uguali a bit ogni volta che il risparmio era
    // davvero uguale. La regola girava; a essere rotta era la scelta fra spese
    // **diverse**, che è il test qui sopra.
    const riprezzata = (nome: string, euro: number): Carta => {
      const carta = TERRE_FINTE.find((voce) => voce.nome === nome)!;
      return { ...carta, prezzo: { ...carta.prezzo, euro } };
    };
    const pool = [
      ...TERRE_FINTE.filter((carta) => ["Swamp", "Mountain"].includes(carta.nome)),
      riprezzata("Cinder Crossing", 0.11),
      riprezzata("Ashen Waystation", 0.11),
    ];
    const conQuesto = (budget: number | null) =>
      analizzaBaseDiTerre(DUE_COLORI, pool, { terreVolute: 22, budget });

    const senza = conQuesto(null);
    // Quattro copie per doppia a 0,11 € e quattordici terre base a 0,05 €: la
    // base costa 1,58 €, e una copia in meno ne libera sei centesimi. Il budget
    // sta in mezzo apposta: ne deve andare via **una** sola.
    const stretta = conQuesto(1.55);

    expect(copie(senza, "Cinder Crossing")).toBe(4);
    expect(copie(senza, "Ashen Waystation")).toBe(4);
    expect(stretta.rinunceDelBudget.map((voce) => [voce.carta.nome, voce.copie])).toEqual([
      ["Ashen Waystation", 1],
    ]);
    expect(copie(stretta, "Cinder Crossing")).toBe(4);
  });

  it("alzare il budget non peggiora mai la base", () => {
    // La proprietà che il ticket 20 chiede di inchiodare, e che oggi è rotta:
    // più soldi non danno mai una base che costa meno, cioè peggiore.
    //
    // Il tetto si rispetta **quando si può**: sotto il prezzo delle sole terre
    // base non si scende, e a quel punto la base si consegna lo stesso — dire
    // di no non è compito suo, e la ricerca il mazzo fuori tetto non lo dà.
    const pavimento = costo(conBudget(0));
    let precedente = -1;
    for (const budget of [0, 1, 2, 5, 10, 30, 100, 1000]) {
      const quanto = costo(conBudget(budget));
      expect(quanto).toBeLessThanOrEqual(Math.max(budget, pavimento));
      expect(quanto).toBeGreaterThanOrEqual(precedente);
      precedente = quanto;
    }
  });
});
