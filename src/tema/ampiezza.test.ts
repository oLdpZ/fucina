/**
 * L'avviso di tema troppo stretto, e gli allargamenti dichiarati (ticket 08,
 * Q26).
 *
 * È quel che l'app dice **prima di generare**, sul solo conteggio delle carte
 * disponibili. I test guardano il verdetto e le proposte, mai come ci si
 * arriva: le soglie sono dichiarate provvisorie e cambieranno alla sosta, e un
 * test che le ricopiasse a mano si romperebbe quel giorno per niente.
 */

import { describe, expect, it } from "vitest";

import { POOL_FINTO, TERRE_FINTE } from "../catalogo/pool-finto.js";
import type { Carta } from "../dati/pool.js";
import { valutaTema } from "./ampiezza.js";
import { CARTE_DISTINTE_COMODE, POSTI_NON_TERRA } from "./taratura.js";
import {
  FILTRO_TEMA_VUOTO,
  TEMA_VUOTO,
  accetta,
  appartiene,
  carteDelTema,
  risolviTema,
  type Tema,
} from "./tema.js";

const TUTTE: readonly Carta[] = [...POOL_FINTO, ...TERRE_FINTE];

const GOBLIN: Tema = {
  ...TEMA_VUOTO,
  inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Goblin"] },
};

/** Un pool inventato apposta per contare: tanti Goblin distinti, tutti uguali. */
function poolDiGoblin(quanti: number): Carta[] {
  const modello = POOL_FINTO.find((c) => c.nome === "Goblin Chieftain") as Carta;
  return Array.from({ length: quanti }, (_, indice) => ({
    ...modello,
    id: `finta-goblin-${indice}`,
    nome: `Goblin Numero ${indice}`,
  }));
}

describe("il verdetto arriva prima di generare, sul solo conteggio", () => {
  it("dice quante carte ha davvero il tema", () => {
    expect(valutaTema(TUTTE, GOBLIN).carteDisponibili).toBe(3);
  });

  it("tre Goblin non riempiono i posti non-terra: il tema è impossibile", () => {
    const ampiezza = valutaTema(TUTTE, GOBLIN);
    expect(ampiezza.verdetto).toBe("impossibile");
    expect(ampiezza.copieDisponibili).toBeLessThan(POSTI_NON_TERRA);
  });

  it("quando le copie bastano appena, il tema è stretto e non impossibile", () => {
    const appena = Math.ceil(POSTI_NON_TERRA / 4);
    const ampiezza = valutaTema(poolDiGoblin(appena), GOBLIN);
    expect(ampiezza.verdetto).toBe("stretto");
    expect(ampiezza.copieDisponibili).toBeGreaterThanOrEqual(POSTI_NON_TERRA);
  });

  it("con carte in abbondanza il tema è ampio", () => {
    expect(valutaTema(poolDiGoblin(CARTE_DISTINTE_COMODE), GOBLIN).verdetto).toBe("ampio");
  });

  it("le terre non contano fra le carte disponibili: riempiono altri posti", () => {
    const soleTerre: Tema = { ...TEMA_VUOTO, inclusioni: { ...FILTRO_TEMA_VUOTO, tipi: ["Land"] } };
    expect(valutaTema(TUTTE, soleTerre).carteDisponibili).toBe(0);
  });

  it("un tema che non prende niente dà un verdetto, non un crollo", () => {
    const inesistente: Tema = {
      ...TEMA_VUOTO,
      inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Sottotipo Che Non Esiste"] },
    };
    const ampiezza = valutaTema(TUTTE, inesistente);
    expect(ampiezza.verdetto).toBe("impossibile");
    expect(ampiezza.carteDisponibili).toBe(0);
  });

  it("lo stesso tema valutato due volte dà lo stesso identico esito", () => {
    expect(valutaTema(TUTTE, GOBLIN)).toEqual(valutaTema(TUTTE, GOBLIN));
  });
});

describe("gli allargamenti si propongono uno per uno, e nessuno si applica da solo", () => {
  const proposti = valutaTema(TUTTE, GOBLIN).allargamenti;

  it("un tema impossibile riceve delle proposte", () => {
    expect(proposti.length).toBeGreaterThan(0);
  });

  it("ogni proposta aggiunge davvero delle carte", () => {
    for (const allargamento of proposti) {
      expect(allargamento.carteAggiunte).toBeGreaterThan(0);
    }
  });

  it("ogni proposta si spiega a parole, col suo numero dentro", () => {
    for (const allargamento of proposti) {
      expect(allargamento.descrizione).toContain(String(allargamento.carteAggiunte));
      expect(allargamento.descrizione.length).toBeGreaterThan(10);
    }
  });

  it("due proposte non dicono la stessa cosa", () => {
    const descrizioni = proposti.map((a) => a.descrizione);
    expect(new Set(descrizioni).size).toBe(descrizioni.length);
  });

  it("propone di prendere le carte che nominano il sottotipo nel testo", () => {
    // «Krenko's Command» fa pedine Goblin senza essere un Goblin: il sottotipo
    // lo nomina, ed è da lì che il tema se la prende.
    const nomina = proposti.find((a) => a.criterio.tipo === "nomina-il-sottotipo");
    expect(nomina).toBeDefined();
    expect(nomina?.carteAggiunte).toBe(1);
  });

  it("propone di allargare ai colori e al tipo di carta del tema", () => {
    const perColore = proposti.find((a) => a.criterio.tipo === "colori-e-tipo");
    expect(perColore).toBeDefined();
    // Le creature nere o rosse che Goblin non sono: lo Zombie e il Golem incolore.
    expect(perColore?.carteAggiunte).toBe(2);
  });

  it("valutare il tema non lo cambia: il tema esce com'era entrato", () => {
    const prima = structuredClone(GOBLIN);
    valutaTema(TUTTE, GOBLIN);
    expect(GOBLIN).toEqual(prima);
  });

  it("accettato l'allargamento, le carte nuove entrano nel tema", () => {
    const pedine = proposti.find((a) => a.criterio.tipo === "nomina-il-sottotipo");
    if (pedine === undefined) throw new Error("manca la proposta sul sottotipo nominato");

    const prima = risolviTema(GOBLIN, TUTTE);
    const comando = TUTTE.find((c) => c.nome === "Krenko's Command") as Carta;
    expect(appartiene(comando, prima)).toBe(false);

    const allargato = accetta(GOBLIN, pedine);
    expect(appartiene(comando, risolviTema(allargato, TUTTE))).toBe(true);
    expect(allargato.allargamenti).toHaveLength(1);
  });

  it("l'allargamento accettato resta scritto nel tema: è detto ad alta voce", () => {
    const primo = proposti[0];
    if (primo === undefined) throw new Error("nessuna proposta");
    expect(accetta(GOBLIN, primo).allargamenti[0]?.descrizione).toBe(primo.descrizione);
  });

  it("le esclusioni vincono anche sugli allargamenti accettati", () => {
    const pedine = proposti.find((a) => a.criterio.tipo === "nomina-il-sottotipo");
    if (pedine === undefined) throw new Error("manca la proposta sul sottotipo nominato");

    const tema = accetta(
      { ...GOBLIN, esclusioni: { ...FILTRO_TEMA_VUOTO, tipi: ["Sorcery"] } },
      pedine,
    );
    const nomi = carteDelTema(TUTTE, risolviTema(tema, TUTTE)).map((c) => c.nome);
    expect(nomi).not.toContain("Krenko's Command");
  });

  it("accettare la stessa proposta due volte non la scrive due volte", () => {
    const primo = proposti[0];
    if (primo === undefined) throw new Error("nessuna proposta");
    expect(accetta(accetta(GOBLIN, primo), primo).allargamenti).toHaveLength(1);
  });

  it("le frasi si leggono in italiano, articoli compresi", () => {
    // «tutte le artefatti» e «di colore senza colore» sono usciti davvero.
    for (const allargamento of proposti) {
      expect(allargamento.descrizione).not.toMatch(/tutte le (artefatti|istantanei|incantesimi)/);
      expect(allargamento.descrizione).not.toContain("di colore senza colore");
    }
  });

  it("un tema tutto incolore si dice «senza colore», non «di colore niente»", () => {
    const modello = POOL_FINTO.find((c) => c.nome === "Ancient Colossus") as Carta;
    const altreIncolori: Carta[] = [1, 2].map((numero) => ({
      ...modello,
      id: `finta-costrutto-${numero}`,
      nome: `Costrutto Numero ${numero}`,
      sottotipi: ["Construct"],
    }));
    const incolore: Tema = {
      ...TEMA_VUOTO,
      inclusioni: { ...FILTRO_TEMA_VUOTO, sottotipi: ["Golem"] },
    };
    const perColore = valutaTema([...TUTTE, ...altreIncolori], incolore).allargamenti.find(
      (a) => a.criterio.tipo === "colori-e-tipo",
    );
    expect(perColore?.descrizione).toContain("senza colore");
    expect(perColore?.descrizione).not.toContain("di colore senza");
  });

  it("una carta-seme che è anche una terra non fa sparire le proposte", () => {
    // Il conto delle carte aggiunte e quello delle carte già dentro devono
    // guardare lo stesso tema: se il seme sopravvive a un conto e non all'altro,
    // la differenza va sotto zero e proposte buone spariscono in silenzio.
    const modello = POOL_FINTO.find((c) => c.nome === "Goblin Chieftain") as Carta;
    const terraCreatura: Carta = {
      ...modello,
      id: "finta-grotta",
      nome: "Goblin Grotto",
      tipi: ["Land", "Creature"],
      sottotipi: ["Goblin"],
      terra: { coloriProdotti: ["R"], entraGirata: false, condizione: null },
    };
    const conSeme: Tema = { ...TEMA_VUOTO, seme: "Goblin Grotto" };
    const proposte = valutaTema([...TUTTE, terraCreatura], conSeme).allargamenti;
    expect(proposte.some((a) => a.criterio.tipo === "nomina-il-sottotipo")).toBe(true);
  });

  it("un tema ormai ampio non ha più bisogno di proposte", () => {
    expect(valutaTema(poolDiGoblin(CARTE_DISTINTE_COMODE), GOBLIN).allargamenti).toEqual([]);
  });
});
