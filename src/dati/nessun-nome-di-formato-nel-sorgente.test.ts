import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Il vincolo di ADR-0004 preso per la sua metà più facile da disfare: **nessun
 * nome di formato vive nel sorgente**.
 *
 * Le altre metà del vincolo hanno già un guardiano ciascuna — le edizioni e le
 * carte stanno nel documento di formato, il pool è prodotto di compilazione, il
 * tetto di copie è un dato della carta. Il nome no: è una parola, e una parola
 * si scrive in mezzo a una frase senza accorgersene. È successo davvero — il
 * conteggio del catalogo ha detto «in Standard» per quattro giorni dopo che il
 * formato era cambiato, e nessun test è diventato rosso.
 *
 * Il nome del gioco arriva **dal documento di formato**, passa da
 * `dati/ambito.ts` e da lì all'interfaccia. Non c'è nessun'altra strada, e
 * questo file è quel che tiene chiusa la scorciatoia.
 *
 * ## Come guarda, e perché così
 *
 * Guarda il codice come testo, dopo aver tolto i commenti. È grossolano, e va
 * bene: il confine da difendere è grossolano quanto lui — la stessa scelta di
 * `niente-scryfall-a-runtime.test.ts`.
 *
 * I **commenti restano liberi di nominare lo Standard**, ed è una decisione e
 * non una svista. `PROGETTO.md` §7 tiene apposta il proprio titolo vecchio: il
 * ragionamento che ha portato al cambio è la cosa di più valore che questo
 * progetto possiede, e un codice che non può più dire da dove viene lo perde.
 * Quel che non si può fare è **dirlo all'utente**.
 */

const SRC = fileURLToPath(new URL("..", import.meta.url));
const QUESTO_FILE = fileURLToPath(import.meta.url);

/**
 * I nomi di formato che il sorgente non pronuncia.
 *
 * Uno solo, e basta uno: è il gioco che questa app ha giocato fino al 6
 * settembre 2026, quindi è l'unico nome che qualcuno possa aver scritto in
 * buona fede. Il nome del formato di **adesso** non è in elenco perché non
 * esiste nel sorgente in nessuna forma da cercare: nessuno lo ha mai scritto,
 * e il giorno che qualcuno lo scrivesse sarebbe questa la riga da allungare.
 */
const NOMI_DI_FORMATO = ["Standard"];

function sorgenti(cartella: string): string[] {
  const trovati: string[] = [];
  for (const voce of readdirSync(cartella, { withFileTypes: true })) {
    const percorso = join(cartella, voce.name);
    if (voce.isDirectory()) trovati.push(...sorgenti(percorso));
    else if (/\.(ts|tsx|css)$/.test(voce.name) && percorso !== QUESTO_FILE) {
      trovati.push(percorso);
    }
  }
  return trovati;
}

/**
 * Il file senza i suoi commenti.
 *
 * Toglie i blocchi `/* … *​/` e le righe `//`. Sbaglia dove un `//` sta dentro
 * una stringa — un indirizzo, di solito — e allora si porta via anche il resto
 * della riga: sbaglia cioè **tacendo**, mai accusando. Per un guardiano è il
 * verso giusto in cui sbagliare, e il verso sbagliato lo pagherebbe chi legge
 * un errore che non c'è.
 */
function senzaCommenti(codice: string): string {
  return codice.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, " ");
}

const FILE = sorgenti(SRC);

describe("nessun nome di formato vive nel sorgente", () => {
  it("guarda davvero tutto il codice dell'app", () => {
    // Se un giorno la ricerca dei file si rompesse, il controllo qui sotto
    // passerebbe su un elenco vuoto senza dire niente.
    expect(FILE.length).toBeGreaterThan(20);
    expect(FILE.map((f) => relative(SRC, f).replaceAll("\\", "/"))).toContain(
      "componenti/Mazzo.tsx",
    );
  });

  it("nessuna riga di codice pronuncia il nome di un formato", () => {
    const colpevoli = FILE.flatMap((percorso) => {
      const codice = senzaCommenti(readFileSync(percorso, "utf8"));
      return NOMI_DI_FORMATO.filter((nome) =>
        new RegExp(`\\b${nome}\\b`, "i").test(codice),
      ).map((nome) => `${relative(SRC, percorso).replaceAll("\\", "/")}: ${nome}`);
    });

    expect(colpevoli).toEqual([]);
  });

  it("il controllo funziona: un nome di formato scritto in chiaro lo trova", () => {
    // Senza questo, un ritocco al modo in cui si tolgono i commenti potrebbe
    // svuotare il controllo qui sopra lasciandolo verde per sempre.
    const finto = `const riga = "Un mazzo ${NOMI_DI_FORMATO[0]} ne vuole 60";`;
    expect(new RegExp(`\\b${NOMI_DI_FORMATO[0]}\\b`, "i").test(senzaCommenti(finto))).toBe(true);
  });

  it("un commento invece può raccontare da dove veniamo", () => {
    const commento = `/** Il pool di allora era lo ${NOMI_DI_FORMATO[0]}. */\nconst x = 1;`;
    expect(new RegExp(`\\b${NOMI_DI_FORMATO[0]}\\b`, "i").test(senzaCommenti(commento))).toBe(
      false,
    );
  });
});
