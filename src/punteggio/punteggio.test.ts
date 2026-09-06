/**
 * Il punteggio a componenti separate, verificato **per proprietà**.
 *
 * `spec.md` e il ticket 10 lo chiedono a chiare lettere: i pesi cambieranno
 * alla sosta, e i test non devono cadere per quello. Qui si asserisce che un
 * mazzo con più sinergie ha densità di sinergia maggiore, non che la densità
 * valga 0,42. I valori esatti si asseriscono solo dove sono proprietà vere del
 * dominio — un conteggio di coppie, una somma di quote che fa uno.
 *
 * I test entrano dalla cucitura pubblica: `valutaMazzo`.
 */

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { TERRE_FINTE } from "../catalogo/pool-finto.js";
import type { Carta, Colore, Tag } from "../dati/pool.js";
import type { CopieDiCarta } from "../mazzo/base-di-terre.js";
import { leggiTettoDiCopie } from "../mazzo/copie.js";
import { valutaMazzo, type Punteggio } from "./punteggio.js";
import {
  CURVA_ATTESA_LENTA,
  CURVA_ATTESA_VELOCE,
  PESI_DELLA_VELOCITA,
  PESI_DELLE_COMPONENTI,
} from "./taratura.js";

const SEME = 20260903;
const PARTITE = 100;

function magia(abbozzo: {
  nome: string;
  costoDiMana: string;
  valoreDiMana: number;
  identitaDiColore?: Colore[];
  forza?: number | null;
  costituzione?: number | null;
  tipi?: string[];
  testo?: string;
  tag?: Tag[];
  euro?: number | null;
  rarita?: string;
}): Carta {
  return {
    id: `finta-${abbozzo.nome}`,
    nome: abbozzo.nome,
    costoDiMana: abbozzo.costoDiMana,
    valoreDiMana: abbozzo.valoreDiMana,
    identitaDiColore: abbozzo.identitaDiColore ?? [],
    tipi: abbozzo.tipi ?? ["Creature"],
    sottotipi: [],
    testo: abbozzo.testo ?? "",
    forza: abbozzo.forza === undefined || abbozzo.forza === null ? null : String(abbozzo.forza),
    costituzione:
      abbozzo.costituzione === undefined || abbozzo.costituzione === null
        ? null
        : String(abbozzo.costituzione),
    immagine: null,
    rarita: abbozzo.rarita ?? "common",
    nomeItaliano: null,
    edizione: "prova",
    numeroDiCollezione: "1",
    linguaDellaStampa: "en",
    prezzo: { euro: abbozzo.euro ?? 0.1, aggiornatoIl: "2026-09-02" },
    tag: abbozzo.tag ?? [],
    tagScryfall: [],
    facce: null,
    terra: null,
    tettoDiCopie: leggiTettoDiCopie(abbozzo.testo ?? "", abbozzo.tipi ?? ["Creature"]),
  };
}

function valuta(mazzo: readonly CopieDiCarta[]) {
  return valutaMazzo(mazzo, TERRE_FINTE, { seme: SEME, partite: PARTITE });
}

function componenti(punteggio: Punteggio) {
  return [
    punteggio.velocita,
    punteggio.curva,
    punteggio.colori,
    punteggio.sinergia,
    punteggio.qualita,
  ];
}

/* --- I mazzi di prova, tutti costruiti perché il confronto sia ovvio ------ */

/** Un aggro monorosso: creature efficienti, curva bassa, chiude presto. */
const AGGRO: CopieDiCarta[] = [
  {
    carta: magia({
      nome: "Fante di Braci",
      costoDiMana: "{R}",
      valoreDiMana: 1,
      identitaDiColore: ["R"],
      forza: 2,
      costituzione: 1,
    }),
    copie: 12,
  },
  {
    carta: magia({
      nome: "Bruto di Ferriera",
      costoDiMana: "{1}{R}",
      valoreDiMana: 2,
      identitaDiColore: ["R"],
      forza: 3,
      costituzione: 3,
    }),
    copie: 12,
  },
  {
    carta: magia({
      nome: "Capobanda",
      costoDiMana: "{2}{R}",
      valoreDiMana: 3,
      identitaDiColore: ["R"],
      forza: 4,
      costituzione: 3,
    }),
    copie: 8,
  },
  {
    carta: magia({
      nome: "Colpo di Fulmine",
      costoDiMana: "{1}{R}",
      valoreDiMana: 2,
      identitaDiColore: ["R"],
      tipi: ["Instant"],
      testo: "Destroy target creature.",
      tag: ["rimozione-mirata"],
    }),
    copie: 4,
  },
];

/** Lo stesso mazzo, ma tutto da sette mana: la curva è la peggiore possibile. */
const PESANTE: CopieDiCarta[] = [
  {
    carta: magia({
      nome: "Colosso Antico",
      costoDiMana: "{6}{R}",
      valoreDiMana: 7,
      identitaDiColore: ["R"],
      forza: 8,
      costituzione: 8,
    }),
    copie: 36,
  },
];

/** Creature che costano tanto e picchiano poco: qualità bassa per costruzione. */
const SCADENTE: CopieDiCarta[] = [
  {
    carta: magia({
      nome: "Sacco di Paglia",
      costoDiMana: "{2}{R}",
      valoreDiMana: 3,
      identitaDiColore: ["R"],
      forza: 1,
      costituzione: 1,
    }),
    copie: 36,
  },
];

/** Le stesse creature, ma efficienti. */
const EFFICIENTE: CopieDiCarta[] = [
  {
    carta: magia({
      nome: "Bestia Sobria",
      costoDiMana: "{2}{R}",
      valoreDiMana: 3,
      identitaDiColore: ["R"],
      forza: 5,
      costituzione: 5,
    }),
    copie: 36,
  },
];

/** Un mazzo a tre colori con simboli doppi: i colori costano davvero. */
const TRE_COLORI: CopieDiCarta[] = [
  {
    carta: magia({
      nome: "Rovina Nera",
      costoDiMana: "{B}{B}",
      valoreDiMana: 2,
      identitaDiColore: ["B"],
      forza: 2,
      costituzione: 2,
    }),
    copie: 12,
  },
  {
    carta: magia({
      nome: "Furia Rossa",
      costoDiMana: "{R}{R}",
      valoreDiMana: 2,
      identitaDiColore: ["R"],
      forza: 2,
      costituzione: 2,
    }),
    copie: 12,
  },
  {
    carta: magia({
      nome: "Rigoglio Verde",
      costoDiMana: "{G}{G}",
      valoreDiMana: 2,
      identitaDiColore: ["G"],
      forza: 2,
      costituzione: 2,
    }),
    copie: 12,
  },
];

/** Lo stesso mazzo di un colore solo: i simboli non costano più niente. */
const UN_COLORE: CopieDiCarta[] = [
  {
    carta: magia({
      nome: "Furia Rossa",
      costoDiMana: "{R}{R}",
      valoreDiMana: 2,
      identitaDiColore: ["R"],
      forza: 2,
      costituzione: 2,
    }),
    copie: 36,
  },
];

const PEDINE = magia({
  nome: "Chiamata alle Braci",
  costoDiMana: "{1}{R}",
  valoreDiMana: 2,
  identitaDiColore: ["R"],
  tipi: ["Sorcery"],
  tag: ["potenzia"],
});
const ALTARE = magia({
  nome: "Altare del Fumo",
  costoDiMana: "{1}{R}",
  valoreDiMana: 2,
  identitaDiColore: ["R"],
  forza: 1,
  costituzione: 2,
  tag: ["evasione"],
});
/** Le stesse due carte senza tag: stessa forma, sinergia zero. */
const PEDINE_MUTA: Carta = { ...PEDINE, nome: "Chiamata Muta", tag: [] };
const ALTARE_MUTO: Carta = { ...ALTARE, nome: "Altare Muto", tag: [] };

const SINERGICO: CopieDiCarta[] = [
  { carta: PEDINE, copie: 18 },
  { carta: ALTARE, copie: 18 },
];
const MUTO: CopieDiCarta[] = [
  { carta: PEDINE_MUTA, copie: 18 },
  { carta: ALTARE_MUTO, copie: 18 },
];

/* --- I test -------------------------------------------------------------- */

describe("il punteggio a componenti separate", () => {
  it("restituisce cinque componenti, ciascuna fra zero e uno, e nessuna somma", () => {
    const { punteggio } = valuta(AGGRO);

    expect(Object.keys(punteggio).sort()).toEqual([
      "colori",
      "curva",
      "qualita",
      "sinergia",
      "velocita",
    ]);
    for (const componente of componenti(punteggio)) {
      expect(componente.valore).toBeGreaterThanOrEqual(0);
      expect(componente.valore).toBeLessThanOrEqual(1);
      expect(componente.etichetta.length).toBeGreaterThan(0);
      expect(componente.grezzi).toBeTypeOf("object");
    }
  });

  it("è deterministico: stesso mazzo e stesso seme, stesso risultato", () => {
    const uno = valuta(AGGRO);
    const altro = valuta(AGGRO);
    expect(uno).toEqual(altro);
  });

  it("non guarda né il prezzo né la rarità", () => {
    const caro = AGGRO.map((voce) => ({
      ...voce,
      carta: { ...voce.carta, prezzo: { euro: 99, aggiornatoIl: "2026-09-02" }, rarita: "mythic" },
    }));
    expect(valuta(caro).punteggio).toEqual(valuta(AGGRO).punteggio);
  });

  it("tiene i pesi in un punto solo: nel codice del punteggio non c'è un numero tarato", () => {
    // Il ticket 10 lo chiede: alla sosta i pesi si cambiano tutti insieme, e li
    // si deve poter trovare senza cercarli nel codice. Qui si controlla che
    // `punteggio.ts` non contenga nessun decimale scritto a mano.
    const sorgente = readFileSync(new URL("./punteggio.ts", import.meta.url), "utf8");
    const codice = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(codice.match(/\d+\.\d+/g) ?? []).toEqual([]);
  });
});

describe("i pesi, che alla sosta cambieranno", () => {
  // Non si asserisce **quanto** valgono — cambieranno — ma che restino
  // distribuzioni: sono quote, e una quota che non fa uno è un peso sbagliato
  // che nessun altro test coglierebbe.
  const somma = (quote: readonly number[]) => quote.reduce((a, b) => a + b, 0);

  it("le cinque componenti si dividono l'intero", () => {
    expect(somma(Object.values(PESI_DELLE_COMPONENTI))).toBeCloseTo(1, 10);
  });

  it("velocità e affidabilità si dividono l'intero", () => {
    expect(somma(Object.values(PESI_DELLA_VELOCITA))).toBeCloseTo(1, 10);
  });

  it("le due curve attese sono due distribuzioni della stessa forma", () => {
    expect(somma(CURVA_ATTESA_VELOCE)).toBeCloseTo(1, 10);
    expect(somma(CURVA_ATTESA_LENTA)).toBeCloseTo(1, 10);
    expect(CURVA_ATTESA_VELOCE.length).toBe(CURVA_ATTESA_LENTA.length);
  });
});

describe("velocità e affidabilità", () => {
  it("premia il mazzo che chiude prima", () => {
    const veloce = valuta(AGGRO);
    const lento = valuta(PESANTE);
    expect(veloce.punteggio.velocita.valore).toBeGreaterThan(lento.punteggio.velocita.valore);
  });

  it("porta con sé i numeri della simulazione che la giustificano", () => {
    const { punteggio, simulazione } = valuta(AGGRO);
    const grezzi = punteggio.velocita.grezzi;
    expect(grezzi.turnoMedioDiChiusura).toBe(simulazione.turnoMedioDiChiusura);
    expect(grezzi.quotaManiTenibili).toBe(simulazione.quotaManiTenibili);
    expect(grezzi.quotaPartenzeImpiantate).toBe(simulazione.quotaPartenzeImpiantate);
    expect(grezzi.partite).toBe(PARTITE);
  });
});

describe("forma della curva", () => {
  it("premia la curva bassa di un aggro e punisce il mazzo tutto da sette mana", () => {
    expect(valuta(AGGRO).punteggio.curva.valore).toBeGreaterThan(
      valuta(PESANTE).punteggio.curva.valore,
    );
  });

  it("un mazzo che non chiude mai si misura sulla curva lenta, non su nessuna", () => {
    // Il turno medio di chiusura è preso sulle sole partite chiuse: da solo
    // direbbe «veloce» di un mazzo che vince di rado e, quando vince, vince
    // presto. Le partite non chiuse contano come chiusure lentissime.
    const inerte = valuta([
      {
        carta: magia({
          nome: "Statua Muta",
          costoDiMana: "{2}{R}",
          valoreDiMana: 3,
          identitaDiColore: ["R"],
          tipi: ["Artifact"],
        }),
        copie: 36,
      },
    ]);
    expect(inerte.simulazione.turnoMedioDiChiusura).toBeNull();
    expect(inerte.punteggio.curva.grezzi.turnoDiRiferimento).toBe(inerte.simulazione.turnoMassimo);
  });

  it("le partite non chiuse fanno il mazzo più lento di quel che dice la sua media", () => {
    const lento = valuta(PESANTE);
    expect(lento.simulazione.quotaPartiteChiuse).toBeLessThan(1);
    expect(lento.punteggio.curva.grezzi.turnoDiRiferimento).toBeGreaterThan(
      lento.simulazione.turnoMedioDiChiusura!,
    );
  });

  it("porta con sé le quote vere e quelle attese, e sono due distribuzioni", () => {
    const grezzi = valuta(AGGRO).punteggio.curva.grezzi;
    const somma = (quote: readonly number[]) => quote.reduce((a, b) => a + b, 0);
    expect(somma(grezzi.quote)).toBeCloseTo(1, 10);
    expect(somma(grezzi.quoteAttese)).toBeCloseTo(1, 10);
    expect(grezzi.quote.length).toBe(grezzi.quoteAttese.length);
    // La curva dell'aggro pesa tutta sulle prime caselle.
    expect(grezzi.quote[0]! + grezzi.quote[1]!).toBeGreaterThan(grezzi.quote[4]!);
  });
});

describe("salute dei colori", () => {
  it("un mazzo di un colore solo sta meglio di uno a tre colori con simboli doppi", () => {
    expect(valuta(UN_COLORE).punteggio.colori.valore).toBeGreaterThan(
      valuta(TRE_COLORI).punteggio.colori.valore,
    );
  });

  it("una carta che non si lancerebbe mai non ha i colori a posto: ha zero", () => {
    // Senza terre nessuna carta parte, nemmeno una che non chiede colori. Dire
    // «i colori sono a posto» sarebbe la bugia peggiore che questa componente
    // possa raccontare, e la ricerca del ticket 11 la prenderebbe per un
    // consiglio: preferirebbe la base di terre peggiore possibile.
    const senzaTerre = valutaMazzo(UN_COLORE, TERRE_FINTE, {
      seme: SEME,
      partite: 10,
      terreVolute: 0,
    });
    expect(senzaTerre.punteggio.colori.valore).toBe(0);
  });

  it("porta con sé una riga per carta, con la probabilità che la giustifica", () => {
    const { punteggio, base } = valuta(TRE_COLORI);
    const grezzi = punteggio.colori.grezzi;
    expect(grezzi.perCarta.length).toBe(base.righe.length);
    for (const riga of grezzi.perCarta) {
      const vera = base.righe.find((altra) => altra.carta.nome === riga.nome)!;
      expect(riga.probabilita).toBe(vera.probabilita);
      expect(riga.probabilitaSenzaColori).toBe(vera.probabilitaSenzaColori);
    }
  });
});

describe("densità di sinergia", () => {
  it("conta di più dove le carte si attivano a vicenda", () => {
    expect(valuta(SINERGICO).punteggio.sinergia.grezzi.densita).toBeGreaterThan(
      valuta(MUTO).punteggio.sinergia.grezzi.densita,
    );
    expect(valuta(SINERGICO).punteggio.sinergia.valore).toBeGreaterThan(
      valuta(MUTO).punteggio.sinergia.valore,
    );
  });

  it("senza tag non inventa sinergie", () => {
    const grezzi = valuta(MUTO).punteggio.sinergia.grezzi;
    expect(grezzi.coppieAttive).toBe(0);
    expect(grezzi.densita).toBe(0);
  });

  it("una coppia di carte conta una volta sola, anche quando i motivi sono due", () => {
    // Una carta che porta tutt'e due i tag di un'attivazione la realizza in due
    // versi: due copie sono una coppia attiva, non due, e il motivo è uno.
    const doppia = magia({
      nome: "Forno da Campo",
      costoDiMana: "{1}{R}",
      valoreDiMana: 2,
      identitaDiColore: ["R"],
      tipi: ["Artifact"],
      tag: ["potenzia", "evasione"],
    });
    const grezzi = valuta([{ carta: doppia, copie: 36 }]).punteggio.sinergia.grezzi;

    expect(grezzi.coppieDiCopie).toBe(630);
    expect(grezzi.coppieAttive).toBe(630);
    expect(grezzi.perCoppiaDiTag).toEqual([
      { uno: "evasione", altro: "potenzia", coppie: 630 },
    ]);
  });

  it("conta tutte le coppie di copie non-terra, e quelle attive sono quelle vere", () => {
    const grezzi = valuta(SINERGICO).punteggio.sinergia.grezzi;
    // 36 copie non-terra: le coppie sono 36×35/2 = 630.
    expect(grezzi.coppieDiCopie).toBe(630);
    // Ogni pedina con ogni altare: 18×18 = 324. Le coppie fra due pedine o fra
    // due altari non si attivano — nessun tag della coppia ne attiva un altro.
    expect(grezzi.coppieAttive).toBe(324);
  });
});

describe("qualità delle singole carte", () => {
  it("premia le creature efficienti per il loro costo", () => {
    expect(valuta(EFFICIENTE).punteggio.qualita.valore).toBeGreaterThan(
      valuta(SCADENTE).punteggio.qualita.valore,
    );
  });

  it("vale di più una rimozione incondizionata di una condizionale", () => {
    const incondizionata = magia({
      nome: "Rovina",
      costoDiMana: "{1}{B}",
      valoreDiMana: 2,
      identitaDiColore: ["B"],
      tipi: ["Instant"],
      testo: "Destroy target creature.",
      tag: ["rimozione-mirata"],
    });
    const condizionata = magia({
      nome: "Rovina Timida",
      costoDiMana: "{1}{B}",
      valoreDiMana: 2,
      identitaDiColore: ["B"],
      tipi: ["Instant"],
      testo: "Destroy target black creature.",
      tag: ["rimozione-mirata"],
    });

    const valoreDi = (carta: Carta) => {
      const grezzi = valuta([{ carta, copie: 36 }]).punteggio.qualita.grezzi;
      return grezzi.perCarta.find((riga) => riga.nome === carta.nome)!.valore;
    };

    expect(valoreDi(incondizionata)).toBeGreaterThan(valoreDi(condizionata));
  });

  it("una carta che pesca vale più della stessa carta che non pesca", () => {
    const comune = magia({
      nome: "Passante",
      costoDiMana: "{1}{U}",
      valoreDiMana: 2,
      identitaDiColore: ["U"],
      forza: 1,
      costituzione: 1,
    });
    const chePesca: Carta = { ...comune, nome: "Passante Curioso", tag: ["pesca"] };

    const valoreDi = (carta: Carta) =>
      valuta([{ carta, copie: 36 }]).punteggio.qualita.grezzi.perCarta[0]!.valore;

    expect(valoreDi(chePesca)).toBeGreaterThan(valoreDi(comune));
  });

  it("il bonus non si perde nemmeno quando il corpo è già ottimo", () => {
    // Una creatura da due mana 3/3 ha già l'efficienza attesa: se i mestieri si
    // sommassero nudi contro il tetto, quella che pesca varrebbe quanto quella
    // muta — che è l'opposto di quel che questa componente deve dire.
    const ottima = magia({
      nome: "Bruto Ottimo",
      costoDiMana: "{1}{R}",
      valoreDiMana: 2,
      identitaDiColore: ["R"],
      forza: 3,
      costituzione: 3,
    });
    const chePesca: Carta = { ...ottima, nome: "Bruto Curioso", tag: ["pesca"] };

    const valoreDi = (carta: Carta) =>
      valuta([{ carta, copie: 36 }]).punteggio.qualita.grezzi.perCarta[0]!.valore;

    expect(valoreDi(ottima)).toBeGreaterThan(0);
    expect(valoreDi(chePesca)).toBeGreaterThan(valoreDi(ottima));
  });

  it("conta le rimozioni e le carte di vantaggio in copie, non in nomi", () => {
    const rimozione = magia({
      nome: "Rovina",
      costoDiMana: "{1}{B}",
      valoreDiMana: 2,
      identitaDiColore: ["B"],
      tipi: ["Instant"],
      testo: "Destroy target creature.",
      tag: ["rimozione-mirata"],
    });
    const timida: Carta = {
      ...rimozione,
      nome: "Rovina Timida",
      testo: "Destroy target black creature.",
    };
    const pesca = magia({
      nome: "Studio",
      costoDiMana: "{1}{U}",
      valoreDiMana: 2,
      identitaDiColore: ["U"],
      tipi: ["Sorcery"],
      tag: ["pesca"],
    });

    const grezzi = valuta([
      { carta: rimozione, copie: 4 },
      { carta: timida, copie: 3 },
      { carta: pesca, copie: 2 },
    ]).punteggio.qualita.grezzi;

    expect(grezzi.rimozioniIncondizionate).toBe(4);
    expect(grezzi.rimozioniCondizionali).toBe(3);
    expect(grezzi.carteDiVantaggio).toBe(2);
  });

  it("le creature che contano zero abbassano l'efficienza media, non spariscono dal conto", () => {
    // Metà creature con la forza scritta a stella, metà 3/3 da due mana: la
    // media delle **creature** è uno, non due. Se le prime uscissero dal conto,
    // il numero direbbe che il mazzo è il doppio di quel che è — e il ticket 13
    // scriverebbe quella cifra in una frase.
    const stella = magia({
      nome: "Ombra Mutevole",
      costoDiMana: "{1}{B}",
      valoreDiMana: 2,
      identitaDiColore: ["B"],
    });
    const grezzi = valuta([
      { carta: { ...stella, forza: "*", costituzione: "*" }, copie: 18 },
      {
        carta: magia({
          nome: "Bruto",
          costoDiMana: "{1}{B}",
          valoreDiMana: 2,
          identitaDiColore: ["B"],
          forza: 3,
          costituzione: 3,
        }),
        copie: 18,
      },
    ]).punteggio.qualita.grezzi;

    expect(grezzi.efficienzaMedia).toBeCloseTo(1, 10);
  });

  it("una creatura senza forza scritta a numero conta zero, e non fa cadere il conto", () => {
    const indefinita = magia({
      nome: "Ombra Mutevole",
      costoDiMana: "{1}{B}",
      valoreDiMana: 2,
      identitaDiColore: ["B"],
    });
    const grezzi = valuta([
      { carta: { ...indefinita, forza: "*", costituzione: "*" }, copie: 36 },
    ]).punteggio.qualita.grezzi;
    expect(grezzi.perCarta[0]!.corpo).toBe(0);
    expect(Number.isFinite(grezzi.efficienzaMedia)).toBe(true);
  });
});

describe("il mazzo valutato", () => {
  it("porta con sé la base di terre e la simulazione da cui vengono i numeri", () => {
    const valutato = valuta(AGGRO);
    expect(valutato.base.numeroTerre).toBeGreaterThan(0);
    expect(valutato.simulazione.partite).toBe(PARTITE);
    // Il mazzo su cui si è misurato è quello dato più le terre scelte: né una
    // carta di più né una di meno. Riempirlo fino a sessanta con carte
    // inventate vorrebbe dire misurare un mazzo che non esiste.
    expect(valutato.mazzo.reduce((somma, voce) => somma + voce.copie, 0)).toBe(
      valutato.base.copieNonTerra + valutato.base.numeroTerre,
    );
  });

  it("regge un mazzo vuoto senza cadere", () => {
    const valutato = valutaMazzo([], TERRE_FINTE, { seme: SEME, partite: 10 });
    for (const componente of componenti(valutato.punteggio)) {
      expect(Number.isFinite(componente.valore)).toBe(true);
    }
  });
});
