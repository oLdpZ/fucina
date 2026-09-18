import { describe, expect, it } from "vitest";

import documentoVero from "../../public/dati/formato.json" with { type: "json" };
import {
  cartePerNome,
  interpretaFormato,
  verificaCarteEsistenti,
  vociDaConfermare,
} from "./carica-formato.js";

/**
 * Il documento di formato è l'unico file di dati che scrive **una persona**, e
 * questo cambia cosa vuol dire provarlo.
 *
 * Il pool, prodotto da un comando, sbaglia in modi che si ripetono; questo
 * sbaglia in modi che fa una mano: un nome scritto storto, una virgola in meno,
 * una riga aggiunta senza il suo perché. Da qui si prova che nessuno di quegli
 * errori passi in silenzio — e in particolare l'unico che sarebbe invisibile
 * all'occhio: **un nome di carta che non esiste**, che senza controllo
 * sparirebbe e basta, lasciando limitata una carta che nessuno limita.
 *
 * Le carte nominate nei casi di prova sono **inventate**: il vincolo di
 * ADR-0004 dice che nessun nome di carta vive nel sorgente, e un test è
 * sorgente. I nomi veri stanno nel documento, che è dato.
 */

const COMPLETO = {
  nome: "Formato di prova",
  daConfermare: null,
  aggiornatoIl: "2026-09-06",
  fonte: "Il gruppo del giovedì, a voce",
  regolamentoDiRiferimento: "Il regolamento di prova, letto oggi",
  criterio: {
    regola: "stampa-italiana",
    descrizione: "Entra la carta che esiste stampata in italiano.",
    daConfermare: null,
  },
  edizioni: [
    {
      codice: "aaa",
      nome: "Prima edizione",
      perché: "È l'era.",
      lingue: ["it", "en"],
      daConfermare: null,
    },
  ],
  edizioniEscluse: [
    {
      codice: "zzz",
      nome: "Edizione di prova esclusa",
      perché: "Il gruppo l'ha guardata e ha detto di no.",
      daConfermare: null,
    },
  ],
  limitate: {
    perché: "Sono le carte che il gruppo trova troppo forti.",
    daConfermare: null,
    carte: [
      {
        carta: "Anello di Prova",
        perché: "Fa troppo mana per quel che costa.",
        divergenza: null,
        daConfermare: null,
      },
    ],
  },
  bandite: {
    perché: "Si scrivono per nome, mai per regola.",
    daConfermare: null,
    carte: [
      {
        carta: "Patto di Prova",
        perché: "Si gioca per la posta.",
        divergenza: null,
        daConfermare: null,
      },
    ],
  },
};

/** Il documento senza uno dei suoi campi: serve a provare i rifiuti. */
function senza(campo: string): unknown {
  const copia: Record<string, unknown> = { ...COMPLETO };
  delete copia[campo];
  return copia;
}

describe("lettura del documento di formato", () => {
  it("legge un documento completo e lo consegna tipato", () => {
    const formato = interpretaFormato(COMPLETO);

    expect(formato.nome).toBe("Formato di prova");
    expect(formato.criterio.regola).toBe("stampa-italiana");
    expect(formato.edizioni).toHaveLength(1);
    expect(formato.limitate.carte[0]?.carta).toBe("Anello di Prova");
    expect(formato.bandite.carte[0]?.carta).toBe("Patto di Prova");
  });

  it("dice a parole quando il file non è un documento di formato", () => {
    expect(() => interpretaFormato(null)).toThrow(/non si legge/);
    expect(() => interpretaFormato("un formato")).toThrow(/non si legge/);
  });

  it("non accetta un documento senza nome, senza data o senza fonte", () => {
    // Sono le tre cose che rendono il documento ritrovabile fra un anno: un
    // documento che non le ha non è un documento, è un appunto.
    expect(() => interpretaFormato(senza("nome"))).toThrow(/nome/);
    expect(() => interpretaFormato(senza("aggiornatoIl"))).toThrow(/data/);
    expect(() => interpretaFormato(senza("fonte"))).toThrow(/fonte/);
  });

  it("non accetta un documento senza edizioni ammesse", () => {
    expect(() => interpretaFormato({ ...COMPLETO, edizioni: [] })).toThrow(/edizion/);
  });

  it("non accetta la stessa edizione nominata due volte", () => {
    // Da quando l'edizione porta le proprie lingue è una contraddizione: due
    // righe dicono quali copie sono legali, e quale valga lo deciderebbe
    // l'ordine di lettura. Lo spazio in coda non fa due edizioni.
    expect(() =>
      interpretaFormato({
        ...COMPLETO,
        edizioni: [COMPLETO.edizioni[0], { ...COMPLETO.edizioni[0], lingue: ["fr"] }],
      }),
    ).toThrow(/aaa/);

    expect(() =>
      interpretaFormato({
        ...COMPLETO,
        edizioni: [COMPLETO.edizioni[0], { ...COMPLETO.edizioni[0], codice: " AAA " }],
      }),
    ).toThrow(/aaa/);
  });

  it("legge le edizioni escluse come legge le ammesse", () => {
    // Un'edizione fuori dal formato è un dato come gli altri: chi la legge
    // vuole sapere quale fosse e perché è rimasta fuori, senza scavare in git.
    const formato = interpretaFormato(COMPLETO);

    expect(formato.edizioniEscluse).toHaveLength(1);
    expect(formato.edizioniEscluse[0]?.codice).toBe("zzz");
    expect(formato.edizioniEscluse[0]?.nome).toBe("Edizione di prova esclusa");
    expect(formato.edizioniEscluse[0]?.perché).not.toBe("");
  });

  it("legge un documento che non esclude nessuna edizione", () => {
    // Un formato che non ha niente da escludere non deve scrivere un elenco
    // vuoto per dirlo: l'assenza qui non nasconde nessuna regola.
    expect(interpretaFormato(senza("edizioniEscluse")).edizioniEscluse).toEqual([]);
  });

  it("non accetta un'edizione esclusa senza il proprio perché", () => {
    // Vale quel che vale per le ammesse: una riga senza ragione, fra un anno,
    // nessuno sa se si può togliere — e questo elenco esiste solo per la
    // ragione, perché il pool non lo guarda affatto.
    expect(() =>
      interpretaFormato({
        ...COMPLETO,
        edizioniEscluse: [{ codice: "zzz", nome: "Edizione di prova esclusa" }],
      }),
    ).toThrow(/perché/);
  });

  it("non accetta la stessa edizione ammessa ed esclusa insieme", () => {
    // È la svista di chi decide di togliere un'edizione, scrive la riga fra le
    // escluse e dimentica di cancellarla dalle ammesse: senza questo controllo
    // il pool uscirebbe con dentro tutta l'edizione mentre il documento, a
    // leggerlo, dice il contrario.
    expect(() =>
      interpretaFormato({
        ...COMPLETO,
        edizioniEscluse: [{ ...COMPLETO.edizioniEscluse[0], codice: "aaa" }],
      }),
    ).toThrow(/aaa/);

    // Lo spazio e la maiuscola non fanno due edizioni, qui come fra le ammesse.
    expect(() =>
      interpretaFormato({
        ...COMPLETO,
        edizioniEscluse: [{ ...COMPLETO.edizioniEscluse[0], codice: " AAA " }],
      }),
    ).toThrow(/aaa/);
  });

  it("non accetta la stessa edizione esclusa due volte", () => {
    // È la stessa mano che incolla una riga e non cancella l'originale: qui non
    // cambia nessun pool, ma lascia due ragioni possibilmente diverse per lo
    // stesso no, e chi rilegge non sa quale sia quella vera.
    expect(() =>
      interpretaFormato({
        ...COMPLETO,
        edizioniEscluse: [
          COMPLETO.edizioniEscluse[0],
          { ...COMPLETO.edizioniEscluse[0], codice: " ZZZ ", perché: "Detto in un altro modo." },
        ],
      }),
    ).toThrow(/zzz/);
  });

  it("non accetta un'edizione che non dichiara le proprie lingue ammesse", () => {
    // L'assenza non si legge come «tutte le lingue»: un valore predefinito qui
    // sarebbe verità di formato scritta nel sorgente sotto forma di
    // comportamento implicito, ed è quel che ADR-0004 vieta.
    const { lingue: _, ...senzaLingue } = COMPLETO.edizioni[0] as Record<string, unknown>;

    expect(() => interpretaFormato({ ...COMPLETO, edizioni: [senzaLingue] })).toThrow(/lingue/);
  });

  it("dice quale edizione guardare quando le lingue mancano", () => {
    // Chi legge il messaggio ha il file aperto davanti: «manca un campo» lo
    // manderebbe a rileggere quattro voci per trovare quella storta.
    const { lingue: _, ...senzaLingue } = COMPLETO.edizioni[0] as Record<string, unknown>;

    expect(() => interpretaFormato({ ...COMPLETO, edizioni: [senzaLingue] })).toThrow(/aaa/);
  });

  it("non accetta un elenco di lingue vuoto", () => {
    expect(() =>
      interpretaFormato({
        ...COMPLETO,
        edizioni: [{ ...COMPLETO.edizioni[0], lingue: [] }],
      }),
    ).toThrow(/lingue/);
  });

  it("non accetta lingue che non sono un elenco di testi", () => {
    // Una mano che scrive `"lingue": "it"` invece di `["it"]` non deve
    // ritrovarsi un'edizione che ammette le lettere «i» e «t».
    expect(() =>
      interpretaFormato({
        ...COMPLETO,
        edizioni: [{ ...COMPLETO.edizioni[0], lingue: "it" }],
      }),
    ).toThrow(/lingue/);

    expect(() =>
      interpretaFormato({
        ...COMPLETO,
        edizioni: [{ ...COMPLETO.edizioni[0], lingue: ["it", 7] }],
      }),
    ).toThrow(/lingue/);
  });

  it("conserva l'ordine in cui le lingue sono scritte, che è la preferenza", () => {
    // Il campo fa due mestieri: dice quali copie il gruppo ammette, e in quale
    // ordine si preferisce mostrarle. Riordinarlo qui sarebbe togliere la
    // seconda metà senza dirlo.
    const formato = interpretaFormato({
      ...COMPLETO,
      edizioni: [{ ...COMPLETO.edizioni[0], lingue: ["fr", "it", "en"] }],
    });

    expect(formato.edizioni[0]?.lingue).toEqual(["fr", "it", "en"]);
  });

  it("non accetta un criterio che il codice non sa eseguire", () => {
    // Il documento decide **quale** criterio, non ne inventa uno nuovo: un
    // criterio sconosciuto verrebbe letto come «nessun criterio», e il pool
    // uscirebbe con dentro tutto.
    expect(() =>
      interpretaFormato({
        ...COMPLETO,
        criterio: { ...COMPLETO.criterio, regola: "a occhio" },
      }),
    ).toThrow(/criterio/);
  });

  it("non accetta un criterio che non è scritto a parole", () => {
    // È il campo che decide quali carte esistono: `regola` da sola dice al
    // codice cosa fare senza dire a nessuno perché.
    expect(() =>
      interpretaFormato({
        ...COMPLETO,
        criterio: { ...COMPLETO.criterio, descrizione: "  " },
      }),
    ).toThrow(/parole/);
  });

  it("ripulisce quel che legge, così uno spazio di troppo non diventa una carta diversa", () => {
    // Su un file scritto a mano «Anello di Prova » passerebbe ogni controllo e
    // poi non troverebbe la sua carta, con un messaggio d'errore che a occhio
    // nudo sembra una bugia dell'app.
    const limitate = {
      ...COMPLETO.limitate,
      carte: [{ ...COMPLETO.limitate.carte[0], carta: " Anello di Prova " }],
    };

    expect(interpretaFormato({ ...COMPLETO, limitate }).limitate.carte[0]?.carta).toBe(
      "Anello di Prova",
    );
  });

  it("non accetta una carta senza il suo perché", () => {
    // È la regola che tiene il documento leggibile: chi aggiunge una riga
    // scrive anche perché l'ha aggiunta, o la riga non entra.
    const limitate = {
      ...COMPLETO.limitate,
      carte: [{ carta: "Anello di Prova", divergenza: null, daConfermare: null }],
    };

    expect(() => interpretaFormato({ ...COMPLETO, limitate })).toThrow(/perché/);
  });

  it("non accetta un elenco senza il proprio perché", () => {
    // Il perché dell'elenco intero dice perché l'elenco è fatto di nomi e non
    // di una regola: è l'unico campo che spiega la decisione di ADR-0004, e
    // finché si poteva omettere era anche l'unico che nessuno pretendeva.
    const { perché: _, ...senzaPerché } = COMPLETO.bandite;

    expect(() => interpretaFormato({ ...COMPLETO, bandite: senzaPerché })).toThrow(/perché/);
  });

  it("dice quale dei due elenchi non dice il proprio perché", () => {
    const { perché: _, ...senzaPerché } = COMPLETO.limitate;

    expect(() => interpretaFormato({ ...COMPLETO, limitate: senzaPerché })).toThrow(/limitate/);
  });

  it("non accetta una carta senza nome", () => {
    const bandite = {
      ...COMPLETO.bandite,
      carte: [{ perché: "Si gioca per la posta.", divergenza: null, daConfermare: null }],
    };

    expect(() => interpretaFormato({ ...COMPLETO, bandite })).toThrow(/carta/);
  });

  it("non accetta la stessa carta limitata e bandita insieme", () => {
    // Una carta a una copia e insieme fuori dal formato non ha un comportamento
    // giusto: ne ha due, e quale valga lo deciderebbe l'ordine di lettura.
    const bandite = {
      ...COMPLETO.bandite,
      carte: [{ ...COMPLETO.limitate.carte[0] }],
    };

    expect(() => interpretaFormato({ ...COMPLETO, bandite })).toThrow(/Anello di Prova/);
  });

  it("legge divergenza e da confermare come assenti quando non ci sono", () => {
    const formato = interpretaFormato(COMPLETO);

    expect(formato.limitate.carte[0]?.divergenza).toBeNull();
    expect(formato.limitate.carte[0]?.daConfermare).toBeNull();
  });
});

describe("le voci ancora da confermare", () => {
  it("le raccoglie da tutto il documento, ognuna con la sua domanda", () => {
    const formato = interpretaFormato({
      ...COMPLETO,
      daConfermare: "Come si chiama il formato?",
      criterio: { ...COMPLETO.criterio, daConfermare: "Regola o elenco?" },
      edizioni: [{ ...COMPLETO.edizioni[0], daConfermare: "Questa edizione è dentro?" }],
      limitate: {
        ...COMPLETO.limitate,
        carte: [{ ...COMPLETO.limitate.carte[0], daConfermare: "Dimenticanza o scelta?" }],
      },
    });

    const aperte = vociDaConfermare(formato);

    expect(aperte).toHaveLength(4);
    expect(aperte.map((voce) => voce.domanda)).toContain("Dimenticanza o scelta?");
    // La voce dice **dove** sta la domanda: un elenco di sole domande non si
    // saprebbe più riportare nel documento.
    expect(aperte.every((voce) => voce.voce !== "")).toBe(true);
  });

  it("su un documento senza dubbi non ne trova nessuna", () => {
    expect(vociDaConfermare(interpretaFormato(COMPLETO))).toEqual([]);
  });
});

describe("i nomi di carta del documento", () => {
  it("li elenca tutti, limitate e bandite insieme", () => {
    // È il modo in cui chi prepara il pool controlla il documento contro le
    // carte che esistono davvero.
    expect(cartePerNome(interpretaFormato(COMPLETO))).toEqual([
      "Anello di Prova",
      "Patto di Prova",
    ]);
  });
});

describe("le carte che il documento nomina e che non esistono", () => {
  it("passa quando ogni nome trova la sua carta", () => {
    expect(() =>
      verificaCarteEsistenti(interpretaFormato(COMPLETO), [
        "Anello di Prova",
        "Patto di Prova",
        "Una Carta Qualunque",
      ]),
    ).not.toThrow();
  });

  it("dà errore e nomina la carta che non esiste", () => {
    // È il modo in cui un errore di battitura si scopre subito. Senza questo,
    // «Anelo di Prova» resterebbe una limitata che non limita niente: il
    // documento direbbe una cosa e il gioco ne farebbe un'altra.
    expect(() =>
      verificaCarteEsistenti(interpretaFormato(COMPLETO), ["Patto di Prova"]),
    ).toThrow(/Anello di Prova/);
  });

  it("le nomina tutte, non solo la prima", () => {
    // Chi corregge il documento vuole la lista intera in una passata sola.
    const errore = (() => {
      try {
        verificaCarteEsistenti(interpretaFormato(COMPLETO), []);
        return "";
      } catch (guasto) {
        return (guasto as Error).message;
      }
    })();

    expect(errore).toContain("Anello di Prova");
    expect(errore).toContain("Patto di Prova");
  });
});

describe("il documento vero", () => {
  it("si legge", () => {
    // Il documento in `public/dati/` è dato scritto a mano: se una virgola
    // salta, si deve sapere qui e non alla prima apertura dell'app.
    const formato = interpretaFormato(documentoVero);

    expect(formato.nome).not.toBe("");
    expect(formato.edizioni.length).toBeGreaterThan(0);
    expect(formato.limitate.carte.length).toBeGreaterThan(0);
    expect(formato.bandite.carte.length).toBeGreaterThan(0);
  });

  it("porta le sue voci ancora da confermare, scritte come tali", () => {
    // Il numero non si fissa qui: cala man mano che il gruppo risponde, e un
    // test che pretendesse quattro diventerebbe rosso il giorno che una viene
    // chiusa — cioè premierebbe il non aggiornare il documento.
    const aperte = vociDaConfermare(interpretaFormato(documentoVero));

    expect(aperte.length).toBeGreaterThan(0);
    expect(aperte.every((voce) => voce.domanda.length > 10)).toBe(true);
  });

  it("dichiara per ogni edizione almeno una lingua ammessa", () => {
    // **Quali** lingue non si fissa qui: sono dati, e cambieranno il giorno che
    // il gruppo risponde. Che ce ne sia almeno una per edizione sì: è la regola
    // che il documento deve eseguire invece di raccontarla nel proprio perché.
    const formato = interpretaFormato(documentoVero);

    for (const edizione of formato.edizioni) {
      expect(edizione.lingue.length).toBeGreaterThan(0);
    }
  });

  it("non nomina la stessa carta due volte", () => {
    const nomi = cartePerNome(interpretaFormato(documentoVero));

    expect(new Set(nomi).size).toBe(nomi.length);
  });
});

/**
 * Ticket 83: col pool del 2026-09-17 quattro terre base su cinque non hanno
 * prezzo in euro, e col tetto acceso l'app non mette in mazzo quel che non sa
 * contare — cioè, sotto un tetto, solo i mazzi verdi potevano avere terre base.
 *
 * La strada scelta è la prima delle tre che il ticket elenca: **il documento
 * dichiara quanto vale una terra base**, perché al tavolo non le compra
 * nessuno. Il numero è un dato e non una costante del sorgente (ADR-0004), e
 * come ogni voce del documento porta con sé il suo perché.
 */
describe("il prezzo dichiarato delle terre base", () => {
  it("si legge, col perché accanto", () => {
    const formato = interpretaFormato({
      ...COMPLETO,
      prezzoDelleTerreBase: {
        euro: 0,
        perché: "Al tavolo le terre base non le compra nessuno.",
        daConfermare: null,
      },
    });

    expect(formato.prezzoDelleTerreBase?.euro).toBe(0);
    expect(formato.prezzoDelleTerreBase?.perché).toContain("tavolo");
  });

  it("un documento che non lo dichiara resta un documento buono", () => {
    // Non dichiararlo è una risposta legittima — vuol dire «le terre base si
    // comprano come tutte le altre» — e i documenti scritti prima di questo
    // ticket non devono smettere di aprirsi.
    expect(interpretaFormato(COMPLETO).prezzoDelleTerreBase).toBeNull();
  });

  it("dichiarato senza il suo perché, si rifiuta dicendo quale campo manca", () => {
    expect(() =>
      interpretaFormato({
        ...COMPLETO,
        prezzoDelleTerreBase: { euro: 0, perché: "  ", daConfermare: null },
      }),
    ).toThrow(/terre base/i);
  });

  it("una cifra che non è un numero non passa per zero", () => {
    // Zero e «non si sa» sono due risposte diverse, e leggere la seconda come
    // la prima regalerebbe all'utente un mazzo che costa quel che non sa.
    expect(() =>
      interpretaFormato({
        ...COMPLETO,
        prezzoDelleTerreBase: { euro: "gratis", perché: "Perché sì.", daConfermare: null },
      }),
    ).toThrow(/terre base/i);
  });

  it("una cifra negativa non si legge: un prezzo sotto zero non esiste", () => {
    expect(() =>
      interpretaFormato({
        ...COMPLETO,
        prezzoDelleTerreBase: { euro: -1, perché: "Perché sì.", daConfermare: null },
      }),
    ).toThrow(/terre base/i);
  });
});

