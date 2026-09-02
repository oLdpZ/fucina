import { describe, expect, it } from "vitest";

import { POOL_FINTO } from "./pool-finto.js";
import { cercaPerNome, normalizza } from "./ricerca.js";

/**
 * Storie 4 e 5: si cerca la carta che si ha in mente, e la ricerca perdona le
 * maiuscole e gli errori di battitura — perché i nomi sono inglesi (Q24) e chi
 * usa l'app non lo è.
 *
 * I test guardano che cosa ottiene chi cerca, non come ci si arriva: quale
 * carta esce prima, quali escono, quali no.
 */

const nomi = (query: string) => cercaPerNome(POOL_FINTO, query).map((carta) => carta.nome);

describe("ricerca per nome", () => {
  it("senza domanda restituisce tutto, nell'ordine ricevuto", () => {
    expect(cercaPerNome(POOL_FINTO, "")).toEqual(POOL_FINTO);
    expect(cercaPerNome(POOL_FINTO, "   ")).toEqual(POOL_FINTO);
  });

  it("trova la carta scritta giusta, ignorando le maiuscole", () => {
    expect(nomi("goblin chieftain")[0]).toBe("Goblin Chieftain");
    expect(nomi("GOBLIN CHIEFTAIN")[0]).toBe("Goblin Chieftain");
  });

  it("trova la carta da un pezzo di nome", () => {
    expect(nomi("chief")[0]).toBe("Goblin Chieftain");
    expect(nomi("prospector")[0]).toBe("Skirk Prospector");
  });

  it("perdona una lettera sbagliata, una in meno e una in più", () => {
    expect(nomi("goblim chieftain")[0]).toBe("Goblin Chieftain");
    expect(nomi("chieftan")[0]).toBe("Goblin Chieftain");
    expect(nomi("lightnning strike")[0]).toBe("Lightning Strike");
  });

  it("perdona due lettere invertite", () => {
    expect(nomi("porspector")[0]).toBe("Skirk Prospector");
  });

  it("ignora accenti e apostrofi, che nessuno digita", () => {
    expect(nomi("jotun")[0]).toBe("Jötun Emberkin");
    expect(nomi("krenkos command")[0]).toBe("Krenko's Command");
  });

  it("mette prima la carta il cui nome comincia con quel che si è scritto", () => {
    const trovate = nomi("goblin");
    expect(trovate[0]).toBe("Goblin Chieftain");
    // «Rakdos Firestarter» è un Goblin, ma il nome non lo dice: la ricerca
    // guarda i nomi, non i sottotipi — a quelli ci pensano i filtri.
    expect(trovate).not.toContain("Rakdos Firestarter");
  });

  it("non inventa risultati quando la carta non c'è", () => {
    expect(nomi("qwertyuiop")).toEqual([]);
  });

  it("con due lettere sole non allarga a tutto il pool", () => {
    expect(nomi("go").length).toBeLessThan(POOL_FINTO.length);
  });

  it("è stabile: la stessa domanda dà sempre la stessa risposta", () => {
    expect(nomi("goblim")).toEqual(nomi("goblim"));
  });
});

describe("normalizzazione del testo", () => {
  it("toglie accenti, apostrofi e maiuscole", () => {
    expect(normalizza("Krenko's Command")).toBe("krenkos command");
    expect(normalizza("Jötun Emberkin")).toBe("jotun emberkin");
  });

  it("riduce gli spazi di troppo", () => {
    expect(normalizza("  Goblin   Chieftain  ")).toBe("goblin chieftain");
  });
});
