import { describe, expect, it } from "vitest";

import { POOL_FINTO } from "./pool-finto.js";
import { costoPiuAlto, sottotipiDiCreatura, tipiPresenti, tipoPrincipale } from "./vocabolario.js";

/**
 * Le voci dei filtri si ricavano **dal pool**, mai da un elenco scritto nel
 * codice: quando esce un set con un tipo di creatura nuovo, il filtro lo
 * conosce senza che nessuno tocchi niente. È lo stesso principio della
 * legalità letta dai dati (`CLAUDE.md`).
 */

describe("tipi di carta offerti dai filtri", () => {
  it("sono quelli che nel pool esistono davvero", () => {
    const tipi = tipiPresenti(POOL_FINTO).map((t) => t.tipo);
    expect(tipi).toContain("Creature");
    expect(tipi).toContain("Land");
    expect(tipi).not.toContain("Planeswalker");
  });

  it("hanno un nome in italiano da mostrare e il conto delle carte", () => {
    const creature = tipiPresenti(POOL_FINTO).find((t) => t.tipo === "Creature");
    expect(creature?.etichetta).toBe("Creature");
    expect(creature?.quante).toBe(6);
    const istantanei = tipiPresenti(POOL_FINTO).find((t) => t.tipo === "Instant");
    expect(istantanei?.etichetta).toBe("Istantanei");
  });

  it("vengono nell'ordine in cui un giocatore se li aspetta", () => {
    const tipi = tipiPresenti(POOL_FINTO).map((t) => t.tipo);
    expect(tipi.indexOf("Creature")).toBeLessThan(tipi.indexOf("Instant"));
    expect(tipi.indexOf("Instant")).toBeLessThan(tipi.indexOf("Land"));
  });
});

describe("sottotipi di creatura offerti dai filtri", () => {
  it("elenca solo i sottotipi delle creature, col loro conto", () => {
    const sottotipi = sottotipiDiCreatura(POOL_FINTO);
    const goblin = sottotipi.find((s) => s.sottotipo === "Goblin");
    expect(goblin?.quante).toBe(3);
    expect(sottotipi.map((s) => s.sottotipo)).toContain("Zombie");
  });

  it("mette per primi i sottotipi con più carte: sono quelli che si cercano", () => {
    const sottotipi = sottotipiDiCreatura(POOL_FINTO);
    expect(sottotipi[0]?.sottotipo).toBe("Goblin");
  });

  it("non ripete un sottotipo portato da più carte", () => {
    const sottotipi = sottotipiDiCreatura(POOL_FINTO).map((s) => s.sottotipo);
    expect(new Set(sottotipi).size).toBe(sottotipi.length);
  });
});

describe("come si chiama una carta in una riga", () => {
  it("la dice in italiano, al singolare", () => {
    expect(tipoPrincipale(["Instant"])).toBe("Istantaneo");
    expect(tipoPrincipale(["Land"])).toBe("Terra");
  });

  it("un artefatto che è anche creatura è prima di tutto una creatura", () => {
    expect(tipoPrincipale(["Artifact", "Creature"])).toBe("Creatura");
  });

  it("un tipo mai visto si mostra com'è, senza inventare traduzioni", () => {
    expect(tipoPrincipale(["Conspiracy"])).toBe("Conspiracy");
  });

  it("non chiama una carta col suo supertipo", () => {
    expect(tipoPrincipale(["Legendary", "Creature"])).toBe("Creatura");
    expect(tipoPrincipale(["Basic", "Land"])).toBe("Terra");
  });
});

describe("il costo più alto che ha senso chiedere", () => {
  it("è quello che nel pool esiste davvero", () => {
    // «Oltre non c'è niente» era una frase sul gioco, scritta come costante. Su
    // un pool diverso era falsa, e a dirlo non era rimasto nessuno.
    expect(costoPiuAlto(POOL_FINTO)).toBe(7);
  });

  it("un pool senza carte non fa un limite di zero", () => {
    // Zero come tetto chiuderebbe il campo: meglio non restringere affatto che
    // restringere a niente per un pool che non è ancora arrivato.
    expect(costoPiuAlto([])).toBeGreaterThan(0);
  });
});
