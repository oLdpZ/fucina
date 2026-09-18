import { describe, expect, it } from "vitest";

import type { Edizione, EdizioneEsclusa, Formato } from "./formato.js";
import {
  improntaDelDocumento,
  SPARTIZIONE,
  verificaAllineamento,
} from "./impronta-del-documento.js";

/**
 * L'impronta del documento risponde a una domanda sola: **questo pool l'ha
 * prodotto questo documento?** Da qui si prova che la risposta cambia per tutte
 * e sole le ragioni per cui il pool cambierebbe davvero.
 *
 * Le edizioni e le carte nominate qui sono **inventate**: ADR-0004 dice che
 * nessun nome di carta e nessun codice di edizione vive nel sorgente, e un test
 * è sorgente.
 */

const unaVoce = (carta: string) => ({
  carta,
  perché: "Chiude la partita da sola.",
  divergenza: null,
  daConfermare: null,
});

const FORMATO: Formato = {
  nome: "Formato di prova",
  daConfermare: null,
  aggiornatoIl: "2026-09-06",
  fonte: "Il gruppo del giovedì, a voce",
  regolamentoDiRiferimento: "Il regolamento di prova",
  criterio: {
    regola: "solo-edizioni",
    descrizione: "Entra tutto quel che sta in quelle edizioni.",
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
    {
      codice: "bbb",
      nome: "Seconda edizione",
      perché: "È l'era.",
      lingue: ["it"],
      daConfermare: null,
    },
  ],
  edizioniEscluse: [
    {
      codice: "zzz",
      nome: "Edizione di prova esclusa",
      perché: "Guardata, e lasciata fuori.",
      daConfermare: null,
    },
  ],
  limitate: {
    perché: "Troppo forti per quattro copie.",
    daConfermare: null,
    carte: [unaVoce("Carta Inventata Prima")],
  },
  bandite: {
    perché: "Si giocano per la posta.",
    daConfermare: null,
    carte: [unaVoce("Carta Inventata Seconda")],
  },
  prezzoDelleTerreBase: null,
};

/** Il documento con una voce sostituita, per dire cosa cambia e cosa no. */
const con = (voci: Partial<Formato>): Formato => ({ ...FORMATO, ...voci });

/** La stessa cosa per la prima delle due edizioni. */
const conLaPrimaEdizione = (voci: Partial<Edizione>): Formato =>
  con({ edizioni: [{ ...FORMATO.edizioni[0]!, ...voci }, FORMATO.edizioni[1]!] });

describe("l'impronta del documento cambia", () => {
  it("quando cambia il criterio, che decide quali carte esistono", () => {
    const altro = con({ criterio: { ...FORMATO.criterio, regola: "stampa-italiana" } });
    expect(improntaDelDocumento(altro)).not.toBe(improntaDelDocumento(FORMATO));
  });

  it("quando si aggiunge un'edizione", () => {
    const altro = con({
      edizioni: [
        ...FORMATO.edizioni,
        { codice: "ccc", nome: "Terza", perché: "È l'era.", lingue: ["en"], daConfermare: null },
      ],
    });
    expect(improntaDelDocumento(altro)).not.toBe(improntaDelDocumento(FORMATO));
  });

  it("quando un'edizione ammette un'altra lingua", () => {
    const altro = conLaPrimaEdizione({ lingue: ["it", "en", "fr"] });
    expect(improntaDelDocumento(altro)).not.toBe(improntaDelDocumento(FORMATO));
  });

  it("quando le stesse lingue cambiano ordine, perché l'ordine è la preferenza", () => {
    const altro = conLaPrimaEdizione({ lingue: ["en", "it"] });
    expect(improntaDelDocumento(altro)).not.toBe(improntaDelDocumento(FORMATO));
  });

});

describe("l'impronta del documento non cambia", () => {
  // Le limitate e le bandite non fanno il pool dal ticket 11: il pool le porta
  // tutte, e le applica l'app leggendo il documento. Un documento più fresco
  // che ne cambia una deve potersi usare accanto al pool che c'è — e lo può
  // solo se l'impronta non si accorge di lui.
  it("quando si limita una carta in più", () => {
    const altro = con({
      limitate: {
        ...FORMATO.limitate,
        carte: [...FORMATO.limitate.carte, unaVoce("Carta Inventata Terza")],
      },
    });
    expect(improntaDelDocumento(altro)).toBe(improntaDelDocumento(FORMATO));
  });

  it("quando si bandisce una carta in più", () => {
    const altro = con({
      bandite: {
        ...FORMATO.bandite,
        carte: [...FORMATO.bandite.carte, unaVoce("Carta Inventata Terza")],
      },
    });
    expect(improntaDelDocumento(altro)).toBe(improntaDelDocumento(FORMATO));
  });

  it("quando la stessa carta passa da limitata a bandita", () => {
    const altro = con({
      limitate: { ...FORMATO.limitate, carte: [] },
      bandite: {
        ...FORMATO.bandite,
        carte: [...FORMATO.bandite.carte, ...FORMATO.limitate.carte],
      },
    });
    expect(improntaDelDocumento(altro)).toBe(improntaDelDocumento(FORMATO));
  });

  it("quando cambia il nome del formato, che si mostra e non decide niente", () => {
    expect(improntaDelDocumento(con({ nome: "Un altro nome" }))).toBe(
      improntaDelDocumento(FORMATO),
    );
  });

  it("quando si corregge un «perché», una data o una domanda aperta", () => {
    const altro = con({
      aggiornatoIl: "2027-01-01",
      fonte: "Il gruppo, per iscritto",
      regolamentoDiRiferimento: "Un altro regolamento",
      daConfermare: "Come lo chiamiamo?",
      criterio: { ...FORMATO.criterio, descrizione: "Detto meglio.", daConfermare: "Confermi?" },
      limitate: { ...FORMATO.limitate, perché: "Detto meglio." },
    });
    expect(improntaDelDocumento(altro)).toBe(improntaDelDocumento(FORMATO));
  });

  it("quando si guarda un'edizione e la si lascia fuori", () => {
    // L'elenco delle escluse è memoria, non regola: dice che cosa si è deciso
    // di non giocare, e il pool è già quel che è senza di lui. Se cambiasse
    // l'impronta, scrivere il perché di un no costringerebbe a rigenerare
    // quattrocento megabyte di archivio.
    const altro = con({
      edizioniEscluse: [
        ...FORMATO.edizioniEscluse,
        { codice: "yyy", nome: "Un'altra esclusa", perché: "Anche questa no.", daConfermare: null },
      ],
    });
    expect(improntaDelDocumento(altro)).toBe(improntaDelDocumento(FORMATO));
  });

  it("quando si riordinano le edizioni, che il pool guarda per codice", () => {
    const rimescolato = con({ edizioni: [...FORMATO.edizioni].reverse() });
    expect(improntaDelDocumento(rimescolato)).toBe(improntaDelDocumento(FORMATO));
  });

  it("per uno spazio o una maiuscola di troppo, che la preparazione toglie", () => {
    const sciatto = conLaPrimaEdizione({ codice: " AAA ", lingue: ["IT ", " en"] });
    expect(improntaDelDocumento(sciatto)).toBe(improntaDelDocumento(FORMATO));
  });
});

/**
 * La guardia sulla decisione stessa. Il documento è cresciuto una volta — le
 * lingue per edizione sono nate dopo il pool — e crescerà ancora: un campo
 * nuovo che nessuno ha classificato è un campo che l'impronta non guarda, cioè
 * il difetto di questo ticket che torna dalla finestra.
 *
 * Vale per **ogni** pezzo del documento e non solo per quello di fuori: se
 * un'edizione guadagnasse un campo che decide quale copia descrive la carta,
 * l'impronta continuerebbe a guardare codice e lingue e un pool vecchio
 * passerebbe per buono.
 */
describe("ogni voce del documento è classificata", () => {
  const esemplari: Record<keyof typeof SPARTIZIONE, object> = {
    documento: FORMATO,
    criterio: FORMATO.criterio,
    edizione: FORMATO.edizioni[0]!,
    // Scritto qui e non pescato dal documento di prova: l'elenco delle escluse
    // può legittimamente essere vuoto, e il giorno che qualcuno lo svuotasse
    // questa guardia cadrebbe con un errore che parla d'altro invece di dire
    // quale voce nessuno ha classificato.
    edizioneEsclusa: {
      codice: "zzz",
      nome: "Edizione di prova esclusa",
      perché: "Guardata, e lasciata fuori.",
      daConfermare: null,
    } satisfies EdizioneEsclusa,
    elenco: FORMATO.limitate,
    voce: FORMATO.limitate.carte[0]!,
  };

  for (const [pezzo, spartizione] of Object.entries(SPARTIZIONE)) {
    it(`«${pezzo}» non ha voci di cui nessuno ha detto se fanno il pool`, () => {
      expect([...spartizione.fanno, ...spartizione.nonFanno].sort()).toEqual(
        Object.keys(esemplari[pezzo as keyof typeof SPARTIZIONE]).sort(),
      );
    });
  }
});

describe("la verifica di allineamento", () => {
  it("lascia passare il pool che viene da questo documento", () => {
    expect(() =>
      verificaAllineamento(improntaDelDocumento(FORMATO), FORMATO),
    ).not.toThrow();
  });

  it("ferma il pool che viene da un altro documento, e dice quale rifare", () => {
    const altro = con({ criterio: { ...FORMATO.criterio, regola: "stampa-italiana" } });
    expect(() =>
      verificaAllineamento(improntaDelDocumento(altro), FORMATO),
    ).toThrow(/npm run dati/);
  });

  // Un'impronta assente non vale «va bene»: è il pool scritto prima che il
  // legame esistesse, e da quale documento venga non lo sa più nessuno.
  it("ferma il pool che non dice da dove viene", () => {
    for (const niente of [undefined, null, "", 7]) {
      expect(() => verificaAllineamento(niente, FORMATO)).toThrow(
        /npm run dati/,
      );
    }
  });
});
