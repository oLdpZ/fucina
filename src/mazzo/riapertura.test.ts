import { describe, expect, it } from "vitest";

import { temaInVigore, tettoInVigore, vincoliDiUnMazzoRiaperto } from "./in-vigore.js";
import { interpretaMazzoSalvato, type MazzoSalvato } from "./salvato.js";
import { terreCandidate } from "./terre-candidate.js";
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
    const { id: _id, ...contenuto } = SALVATO_SENZA_NERO;
    const arrivato = leggiScambio(scriviScambio(structuredClone(contenuto)));
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
