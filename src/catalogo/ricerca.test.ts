import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { Carta } from "../dati/pool.js";
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

/**
 * Ticket 07: l'italiano come **chiave di ricerca**.
 *
 * Il formato è definito dalle stampe italiane, e chi ci gioca alle carte pensa
 * col nome che ha letto sul cartoncino. Quel che si vede resta inglese (Q24);
 * quel che si scrive può essere l'una lingua o l'altra.
 */
describe("ricerca per nome italiano", () => {
  it("trova la carta scritta col suo nome italiano", () => {
    expect(nomi("capoclan dei goblin")[0]).toBe("Goblin Chieftain");
    expect(nomi("fulmine")[0]).toBe("Lightning Strike");
  });

  it("trova la carta da un pezzo del nome italiano", () => {
    expect(nomi("santuario")[0]).toBe("Sunlit Sanctuary");
    expect(nomi("saggio")[0]).toBe("Whispering Sage");
  });

  it("perdona i refusi sull'italiano come li perdona sull'inglese", () => {
    expect(nomi("fulmnie")[0]).toBe("Lightning Strike");
    expect(nomi("cercatoer di skirk")[0]).toBe("Skirk Prospector");
  });

  it("ignora accenti e maiuscole anche in italiano", () => {
    expect(nomi("PROGENIE DI BRACE")[0]).toBe("Jötun Emberkin");
  });

  it("restituisce la carta, che resta quella inglese", () => {
    const trovate = cercaPerNome(POOL_FINTO, "capoclan dei goblin");
    expect(trovate[0]?.nome).toBe("Goblin Chieftain");
    expect(trovate[0]?.nomeItaliano).toBe("Capoclan dei Goblin");
  });

  it("non inventa niente per una carta senza nome italiano", () => {
    // «Gravedigger Zombie» non ha nome italiano nel pool finto: si trova in
    // inglese come sempre, e non risponde a una domanda in italiano.
    expect(nomi("gravedigger")[0]).toBe("Gravedigger Zombie");
    expect(nomi("becchino")).toEqual([]);
  });

  it("una carta con un nome italiano storto si cerca lo stesso, in inglese", () => {
    // Il pool arriva anche dal deposito del dispositivo, dove un campo può
    // essersi scritto a metà. Qui una carta storta deve costare quella carta, e
    // non il catalogo: la ricerca gira a ogni battuta.
    const storta = { ...(POOL_FINTO[0] as Carta), nomeItaliano: undefined as unknown as null };
    const carte = [storta, ...POOL_FINTO.slice(1)];
    expect(() => cercaPerNome(carte, "capoclan")).not.toThrow();
    expect(cercaPerNome(carte, "goblin chieftain")[0]?.nome).toBe("Goblin Chieftain");
    expect(cercaPerNome(carte, "capoclan")).toEqual([]);
  });

  it("il nome inglese esatto batte l'italiano che ci somiglia", () => {
    // Due gradini diversi della stessa scala: chi scrive il nome inglese per
    // intero vuole quella carta, non una che in italiano gli assomiglia.
    expect(nomi("fulmine")[0]).toBe("Lightning Strike");
    expect(nomi("lightning strike")[0]).toBe("Lightning Strike");
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

/**
 * L'altra metà di Q24, provata invece che promessa: l'italiano entra come chiave
 * e **non esce mai da uno schermo**.
 *
 * È una decisione che si disfa da sé. Il nome italiano è lì, sulla carta, a un
 * campo di distanza da ogni componente che già scrive `carta.nome`: il primo che
 * passa lo mostrerà in buona fede, e verrà fuori una scheda con nome italiano,
 * immagine a volte assente e testo di regole sempre inglese. Il controllo è
 * grossolano — guarda il codice come testo — e va bene così: il confine da
 * difendere è grossolano quanto lui.
 */
describe("l'italiano non arriva sullo schermo", () => {
  const COMPONENTI = fileURLToPath(new URL("../componenti", import.meta.url));

  function sorgenti(cartella: string): string[] {
    const trovati: string[] = [];
    for (const voce of readdirSync(cartella, { withFileTypes: true })) {
      const percorso = join(cartella, voce.name);
      if (voce.isDirectory()) trovati.push(...sorgenti(percorso));
      else trovati.push(percorso);
    }
    return trovati;
  }

  it("nessun componente legge il nome italiano di una carta", () => {
    const file = sorgenti(COMPONENTI);
    // Se un giorno la ricerca dei file si rompesse, il controllo qui sotto
    // passerebbe su un elenco vuoto senza dire niente.
    expect(file.length).toBeGreaterThan(5);

    const colpevoli = file.filter((percorso) =>
      readFileSync(percorso, "utf8").includes("nomeItaliano"),
    );
    expect(colpevoli).toEqual([]);
  });
});
