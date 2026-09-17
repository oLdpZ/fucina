import { describe, expect, it } from "vitest";

import {
  temaInVigore,
  tettoInVigore,
  vincoliDaSalvare,
  vincoliDiUnMazzoRiaperto,
} from "./in-vigore.js";
import { interpretaMazzoSalvato, type MazzoSalvato } from "./salvato.js";
import { budgetPerLeTerre, terreCandidate } from "./terre-candidate.js";
import type { CopieDiCarta } from "./base-di-terre.js";
import { frasePerIlTettoInVigore } from "../spiegazioni/frasi.js";
import { leggiScambio, scriviScambio } from "./scambio.js";
import { FILTRO_TEMA_VUOTO, type Tema } from "../tema/tema.js";
import type { Carta } from "../dati/pool.js";

/**
 * Ticket 31, il caso per intero e dalla porta da cui entra l'utente: costruisci
 * un mazzo dicendo «niente nero», salvalo, cambia tema, riaprilo — e le paludi
 * **non** tornano.
 *
 * È il giro completo — si salva, si rilegge, si rimette in mano, si rifà la
 * base — e sta qui perché nessuno dei pezzi da solo lo dimostra: `salvato.ts`
 * sa rileggere il tema ma non sa che cosa scelga, `in-vigore.ts` sa quando vale
 * ma non che terre produca, e `terre-candidate.ts` non sa da dove venga il tema
 * che riceve. Il guasto viveva proprio nella cucitura fra i tre.
 */

const carta = (nome: string, colore: "B" | "R", terra: boolean): Carta =>
  ({
    nome,
    identitaDiColore: [colore],
    tipi: terra ? ["Land"] : ["Creature"],
    sottotipi: [],
    tag: [],
    valoreDiMana: terra ? 0 : 2,
    terra: terra ? { produce: [colore], entraGirata: false } : null,
    prezzo: 1,
  }) as unknown as Carta;

const POOL: readonly Carta[] = [
  carta("Swamp", "B", true),
  carta("Mountain", "R", true),
  carta("Goblin", "R", false),
];

const SENZA_NERO: Tema = {
  inclusioni: FILTRO_TEMA_VUOTO,
  seme: null,
  esclusioni: { ...FILTRO_TEMA_VUOTO, colori: ["B"] },
  allargamenti: [],
};

const TUTTO: Tema = {
  inclusioni: FILTRO_TEMA_VUOTO,
  seme: null,
  esclusioni: { ...FILTRO_TEMA_VUOTO, colori: ["R"] },
  allargamenti: [],
};

const SALVATO_SENZA_NERO: MazzoSalvato = {
  id: "uno",
  nome: "Niente nero",
  salvatoIl: "2026-09-10T10:00:00.000Z",
  datiDel: "2026-09-06T00:00:00.000Z",
  richiesta: { origine: "a-mano", terreVolute: 22, tema: SENZA_NERO },
  carte: [{ nome: "Goblin", copie: 4 }],
};

/**
 * Quel che `App` fa riaprendo, con **la sua stessa funzione** e non con una
 * copia: una regola riscritta qui proverebbe che la copia funziona, e lascerebbe
 * l'originale libero di allontanarsene.
 */
const riapri = (salvato: MazzoSalvato) => {
  const copie = new Map(salvato.carte.map((voce) => [voce.nome, voce.copie]));
  return { copie, consegnato: vincoliDiUnMazzoRiaperto(salvato.richiesta, copie) };
};

describe("un mazzo salvato «niente nero», riaperto dopo aver cambiato tema", () => {
  it("non si ritrova le paludi", () => {
    const letto = interpretaMazzoSalvato(structuredClone(SALVATO_SENZA_NERO));
    const { copie, consegnato } = riapri(letto);

    // L'utente nel frattempo ha cambiato tema: adesso i Vincoli dicono altro.
    const temaDelMazzo = temaInVigore(consegnato, copie) ?? TUTTO;
    const nomi = terreCandidate(POOL, temaDelMazzo, tettoInVigore(consegnato, copie)).map(
      (carta) => carta.nome,
    );

    expect(nomi).toEqual(["Mountain"]);
    expect(nomi).not.toContain("Swamp");
  });

  it("le riprende appena il mazzo non è più quello, che è la regola dichiarata", () => {
    const { consegnato } = riapri(interpretaMazzoSalvato(structuredClone(SALVATO_SENZA_NERO)));
    const toccato = new Map([["Goblin", 3]]);

    const temaDelMazzo = temaInVigore(consegnato, toccato) ?? TUTTO;
    expect(terreCandidate(POOL, temaDelMazzo, null).map((c) => c.nome)).toEqual(["Swamp"]);
  });

  it("fa lo stesso giro passando per il testo da mandare a un amico", () => {
    // Il testo si importa solo se è del formato che l'app gioca (ticket 10):
    // quello del mazzo, e nient'altro da provare qui.
    const formato = { nome: "Formato di prova", impronta: "una-regola/aaa" };
    const { id: _id, ...contenuto } = SALVATO_SENZA_NERO;
    const arrivato = leggiScambio(scriviScambio(structuredClone({ ...contenuto, formato })), formato);
    const { copie, consegnato } = riapri({ ...arrivato, id: "due" });

    const temaDelMazzo = temaInVigore(consegnato, copie) ?? TUTTO;
    expect(terreCandidate(POOL, temaDelMazzo, null).map((c) => c.nome)).toEqual(["Mountain"]);
  });

  it("un mazzo salvato prima del ticket rifà le terre col tema di adesso, senza cadere", () => {
    const vecchio = structuredClone(SALVATO_SENZA_NERO);
    delete (vecchio.richiesta as { tema?: unknown }).tema;

    const { copie, consegnato } = riapri(interpretaMazzoSalvato(vecchio));

    expect(consegnato).toBeNull();
    const temaDelMazzo = temaInVigore(consegnato, copie) ?? TUTTO;
    expect(terreCandidate(POOL, temaDelMazzo, null).map((c) => c.nome)).toEqual(["Swamp"]);
  });
});

/**
 * Ticket 38, e di nuovo dalla porta da cui entra l'utente: un mazzo salvato
 * sotto un tetto, e un pool di oggi in cui una delle sue carte ha perso il
 * listino — la copia più economica che l'aveva è stata delistata, e nessun'altra
 * copia ammessa ne ha.
 *
 * Il ticket 34 ha chiuso questa strada dentro la ricerca: col tetto acceso, un
 * mazzo che l'app non sa contare tutto non si consegna. Qui nessuna ricerca gira
 * più, e il mazzo **esiste già**: rifiutarsi di mostrarlo non è fra le risposte
 * oneste, e riscrivergli le terre nemmeno — è il mazzo dell'utente, e un listino
 * sparito da Cardmarket non è una buona ragione per cambiarglielo sotto le mani.
 *
 * Quel che cade è dunque **la promessa**, non il mazzo: i vincoli restano in
 * vigore, la base resta quella, e la riga smette di dire che le terre sono
 * scelte per starci dentro — dice invece quale carta non si sa contare.
 *
 * Sta qui, e non in un test di componente, per la ragione di sempre: il guasto
 * vive nella cucitura fra i pezzi. `in-vigore.ts` sa che il tetto vale ancora
 * ma non sa che il mazzo sia diventato incontabile, `terre-candidate.ts` fa la
 * sottrazione ma non sa chi gliela chieda, e `frasi.ts` scrive la riga senza
 * sapere su che mazzo finisce.
 */
describe("un mazzo salvato sotto un tetto, riaperto dopo che una carta ha perso il listino", () => {
  const SALVATO_A_TRENTA: MazzoSalvato = {
    ...SALVATO_SENZA_NERO,
    id: "tre",
    nome: "Trenta euro",
    richiesta: { origine: "a-mano", terreVolute: 22, tema: SENZA_NERO, tetto: 30 },
  };

  /** Il pool di oggi: il Goblin non ha più nessuna copia ammessa con listino. */
  const OGGI: readonly Carta[] = POOL.map((carta) =>
    carta.nome === "Goblin"
      ? ({ ...carta, prezzo: { euro: null, aggiornatoIl: "", stampa: null } } as Carta)
      : ({ ...carta, prezzo: { euro: 1, aggiornatoIl: "", stampa: null } } as Carta),
  );

  /** Quel che la schermata ha in mano: le carte salvate, prezzate col pool di oggi. */
  const inMano = (salvato: MazzoSalvato): CopieDiCarta[] =>
    salvato.carte.map((voce) => ({
      carta: OGGI.find((carta) => carta.nome === voce.nome) as Carta,
      copie: voce.copie,
    }));

  it("il tetto è ancora in vigore, perché il mazzo è ancora quello", () => {
    // Non è una svista da correggere: le carte non sono cambiate, e il tetto
    // viaggia col mazzo. È il presupposto del ticket, non il suo difetto.
    const { copie, consegnato } = riapri(interpretaMazzoSalvato(structuredClone(SALVATO_A_TRENTA)));
    expect(tettoInVigore(consegnato, copie)).toBe(30);
  });

  it("il budget delle terre nomina la carta che non si sa contare", () => {
    const letto = interpretaMazzoSalvato(structuredClone(SALVATO_A_TRENTA));
    const { copie, consegnato } = riapri(letto);
    const budget = budgetPerLeTerre(inMano(letto), tettoInVigore(consegnato, copie));

    expect(budget?.incontabili.map((carta) => carta.nome)).toEqual(["Goblin"]);
  });

  it("e la schermata non dichiara più che il tetto vale ancora", () => {
    const letto = interpretaMazzoSalvato(structuredClone(SALVATO_A_TRENTA));
    const { copie, consegnato } = riapri(letto);
    const tetto = tettoInVigore(consegnato, copie);
    const budget = budgetPerLeTerre(inMano(letto), tetto);

    const frase = frasePerIlTettoInVigore({
      tetto: tetto as number,
      conIlSuoTema: temaInVigore(consegnato, copie) !== null,
      incontabili: (budget?.incontabili ?? []).map((carta) => carta.nome),
    });

    // Il tetto no; il tema di questo mazzo sì, e la sua coda lo dice: a cadere
    // è la sola promessa che poggia su un prezzo.
    expect(frase).not.toContain("il tetto vale ancora");
    expect(frase).not.toMatch(/scelte per starci dentro/u);
    expect(frase).toContain("Goblin");
    expect(frase).toContain("30,00 €");
  });

  it("le terre del mazzo restano quelle: la carta non sparisce e la base non si rifà", () => {
    // Il «da non fare» del ticket, provato: il mazzo salvato resta intero, e il
    // tema con cui è nato continua a scegliergli le terre.
    const letto = interpretaMazzoSalvato(structuredClone(SALVATO_A_TRENTA));
    const { copie, consegnato } = riapri(letto);

    expect(inMano(letto).map((voce) => voce.carta.nome)).toEqual(["Goblin"]);
    const temaDelMazzo = temaInVigore(consegnato, copie) ?? TUTTO;
    const terre = terreCandidate(OGGI, temaDelMazzo, tettoInVigore(consegnato, copie));
    expect(terre.map((c) => c.nome)).toEqual(["Mountain"]);
  });
});

/**
 * Ticket 40, e di nuovo il giro intero: si costruisce un mazzo sotto un tema e
 * un tetto, si preme «Rifà le terre coi vincoli di adesso» per slegarlo
 * apposta, lo si salva — e riaprendolo è **ancora slegato**.
 *
 * Il guasto stava fra due pezzi che da soli avevano ragione: `in-vigore.ts`
 * sapeva dire che su quel mazzo non c'era più nessun vincolo, e la schermata
 * dei salvati sapeva scrivere nel file i vincoli che riceveva — ma quel che
 * riceveva era il ripiego sulla manopola, buono per **mostrare** le terre e
 * falso per **scriverle**. Lo scioglimento non sopravviveva a un salvataggio.
 */
describe("un mazzo slegato dai vincoli e poi salvato", () => {
  const CONSEGNATO_SENZA_NERO = {
    tetto: 30,
    tema: SENZA_NERO,
    strategia: null,
    copie: new Map([["Goblin", 4]]),
  };

  /** Quel che `App` e la schermata dei salvati fanno salvando, in fila. */
  const salva = (consegnato: typeof CONSEGNATO_SENZA_NERO | null, copie: Map<string, number>) => ({
    ...SALVATO_SENZA_NERO,
    id: "quattro",
    richiesta: {
      origine: "a-mano" as const,
      terreVolute: 22,
      ...vincoliDaSalvare(consegnato, copie),
    },
    carte: [...copie].map(([nome, quante]) => ({ nome, copie: quante })),
  });

  it("si riapre ancora slegato: le terre le decide il tema di adesso", () => {
    const inMano = new Map([["Goblin", 4]]);
    // «Rifà le terre coi vincoli di adesso»: i vincoli se ne vanno insieme.
    const salvato = salva(null, inMano);

    expect(salvato.richiesta).not.toHaveProperty("tema");
    expect(salvato.richiesta).not.toHaveProperty("tetto");

    const { copie, consegnato } = riapri(interpretaMazzoSalvato(structuredClone(salvato)));
    expect(consegnato).toBeNull();
    const temaDelMazzo = temaInVigore(consegnato, copie) ?? TUTTO;
    expect(terreCandidate(POOL, temaDelMazzo, null).map((c) => c.nome)).toEqual(["Swamp"]);
  });

  it("un mazzo montato a mano dal catalogo non si porta via le manopole di quel momento", () => {
    const salvato = salva(null, new Map([["Goblin", 4]]));
    expect(salvato.richiesta).toEqual({ origine: "a-mano", terreVolute: 22 });
  });

  it("un mazzo costruito dal motore e salvato intatto si porta dietro i suoi vincoli", () => {
    const salvato = salva(CONSEGNATO_SENZA_NERO, new Map([["Goblin", 4]]));

    expect(salvato.richiesta).toEqual({
      origine: "a-mano",
      terreVolute: 22,
      tema: SENZA_NERO,
      tetto: 30,
    });

    const { copie, consegnato } = riapri(interpretaMazzoSalvato(structuredClone(salvato)));
    expect(tettoInVigore(consegnato, copie)).toBe(30);
    const temaDelMazzo = temaInVigore(consegnato, copie) ?? TUTTO;
    expect(terreCandidate(POOL, temaDelMazzo, null).map((c) => c.nome)).toEqual(["Mountain"]);
  });
});
