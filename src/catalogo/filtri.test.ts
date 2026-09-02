import { describe, expect, it } from "vitest";

import type { Carta } from "../dati/pool.js";
import { FILTRI_VUOTI, cerca, contaFiltriAttivi, type Filtri } from "./filtri.js";
import { POOL_FINTO } from "./pool-finto.js";

/**
 * Storie 7-14: colore, tipo, sottotipo di creatura, costo, parola nel testo, e
 * tutti insieme; con davanti sempre il conteggio di quante carte restano.
 *
 * La cucitura è una sola funzione — `cerca(carte, filtri)` — perché è ciò che
 * l'utente fa: muove i filtri e guarda la lista. Il conteggio vivo non ha un
 * calcolo suo: è la lunghezza di questa lista, e non può quindi discordare da
 * ciò che si vede.
 */

const con = (parziali: Partial<Filtri>): Filtri => ({ ...FILTRI_VUOTI, ...parziali });
const nomi = (filtri: Partial<Filtri>) => cerca(POOL_FINTO, con(filtri)).map((c: Carta) => c.nome);

describe("catalogo senza filtri", () => {
  it("mostra tutto il pool", () => {
    expect(cerca(POOL_FINTO, FILTRI_VUOTI)).toHaveLength(POOL_FINTO.length);
  });

  it("dice che nessun filtro è attivo", () => {
    expect(contaFiltriAttivi(FILTRI_VUOTI)).toBe(0);
  });
});

describe("filtro per colore", () => {
  it("mostra solo ciò che si può giocare nella combinazione scelta", () => {
    const trovate = nomi({ colori: ["R"] });
    expect(trovate).toContain("Goblin Chieftain");
    // Bicolore nero-rosso: fuori da un mazzo mono-rosso.
    expect(trovate).not.toContain("Rakdos Firestarter");
    expect(trovate).not.toContain("Whispering Sage");
  });

  it("tiene dentro le carte senza colore, giocabili in qualunque mazzo", () => {
    const trovate = nomi({ colori: ["R"] });
    expect(trovate).toContain("Ancient Colossus");
    expect(trovate).toContain("Sunlit Sanctuary");
  });

  it("aggiungere un colore allarga, non restringe", () => {
    const rosso = nomi({ colori: ["R"] });
    const rossoNero = nomi({ colori: ["R", "B"] });
    expect(rossoNero).toEqual(expect.arrayContaining(rosso));
    expect(rossoNero).toContain("Rakdos Firestarter");
  });
});

describe("filtro per tipo di carta", () => {
  it("mostra solo il tipo scelto", () => {
    expect(nomi({ tipi: ["Land"] })).toEqual(["Sunlit Sanctuary"]);
  });

  it("più tipi insieme sono un'unione, non un'intersezione", () => {
    const trovate = nomi({ tipi: ["Instant", "Sorcery"] });
    expect(trovate).toContain("Lightning Strike");
    expect(trovate).toContain("Krenko's Command");
    expect(trovate).not.toContain("Goblin Chieftain");
  });

  it("una carta con due tipi risponde a entrambi", () => {
    expect(nomi({ tipi: ["Artifact"] })).toContain("Ancient Colossus");
    expect(nomi({ tipi: ["Creature"] })).toContain("Ancient Colossus");
  });
});

describe("filtro per sottotipo di creatura", () => {
  it("trova tutti i Goblin, anche quelli che non lo dicono nel nome", () => {
    const trovate = nomi({ sottotipi: ["Goblin"] });
    expect(trovate).toEqual(
      expect.arrayContaining(["Goblin Chieftain", "Skirk Prospector", "Rakdos Firestarter"]),
    );
    expect(trovate).not.toContain("Krenko's Command");
  });
});

describe("filtro per costo di mana", () => {
  it("mostra un punto solo della curva", () => {
    expect(nomi({ costi: [1] })).toEqual(["Skirk Prospector"]);
  });

  it("più costi insieme sono un'unione", () => {
    const trovate = nomi({ costi: [1, 2] });
    expect(trovate).toContain("Skirk Prospector");
    expect(trovate).toContain("Lightning Strike");
    expect(trovate).not.toContain("Goblin Chieftain");
  });

  it("l'ultimo scalino raccoglie tutto ciò che costa di più", () => {
    expect(nomi({ costi: [7] })).toContain("Ancient Colossus");
  });
});

describe("ricerca di una parola nel testo", () => {
  it("trova tutto ciò che parla di cimitero", () => {
    expect(nomi({ testo: "graveyard" })).toEqual(["Gravedigger Zombie"]);
  });

  it("ignora le maiuscole", () => {
    expect(nomi({ testo: "GOBLIN" })).toEqual(
      expect.arrayContaining(["Goblin Chieftain", "Krenko's Command"]),
    );
  });

  it("guarda il testo delle regole, non il nome", () => {
    expect(nomi({ testo: "sacrifice" })).toEqual(["Skirk Prospector"]);
  });
});

describe("filtri combinati", () => {
  it("si restringono a vicenda fino all'idea che si ha in testa", () => {
    const trovate = nomi({ colori: ["R"], sottotipi: ["Goblin"], costi: [1, 2, 3] });
    expect(trovate).toEqual(["Goblin Chieftain", "Skirk Prospector"]);
  });

  it("la ricerca per nome convive con i filtri", () => {
    expect(nomi({ nome: "goblim", tipi: ["Creature"] })).toEqual(["Goblin Chieftain"]);
    expect(nomi({ nome: "goblim", tipi: ["Land"] })).toEqual([]);
  });

  it("una combinazione che non lascia nulla dà zero carte, non un errore", () => {
    expect(nomi({ colori: ["W"], sottotipi: ["Goblin"] })).toEqual([]);
  });

  it("un segno di punteggiatura da solo non è un filtro attivo", () => {
    // Il conteggio dei filtri e la lista devono dire la stessa cosa: se la
    // lista non è stata ristretta, il bottone «Azzera» non deve comparire.
    const soloPunteggiatura = con({ nome: "'", testo: " — " });
    expect(contaFiltriAttivi(soloPunteggiatura)).toBe(0);
    expect(cerca(POOL_FINTO, soloPunteggiatura)).toHaveLength(POOL_FINTO.length);
  });

  it("conta quanti filtri sono attivi, per poterli azzerare a colpo sicuro", () => {
    expect(contaFiltriAttivi(con({ colori: ["R"], costi: [1] }))).toBe(2);
    expect(contaFiltriAttivi(con({ nome: "gob", testo: "goblin" }))).toBe(2);
  });
});

describe("velocità", () => {
  /**
   * Storia 14: i risultati compaiono mentre si muovono i filtri, sul telefono e
   * sull'intero pool — che oggi conta quasi cinquemila carte. Non è un test di
   * prestazioni fine: è la rete che prende un `cerca` diventato quadratico.
   */
  it("attraversa un pool grande quanto quello vero in una frazione di secondo", () => {
    const grande: Carta[] = [];
    for (let i = 0; i < 5000; i += 1) {
      const modello = POOL_FINTO[i % POOL_FINTO.length] as Carta;
      grande.push({ ...modello, id: `${modello.id}-${i}`, nome: `${modello.nome} ${i}` });
    }

    const inizio = performance.now();
    for (const query of ["gobli", "goblim chieftan", "strik"]) {
      cerca(grande, con({ nome: query, colori: ["R"], costi: [1, 2, 3], testo: "creature" }));
    }
    expect(performance.now() - inizio).toBeLessThan(1000);
  });
});
