import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { NOME_APP, NOME_APP_DA_DECIDERE } from "./identita.js";

/** Tutti i file sorgente sotto `src/`, ricorsivamente. */
function sorgenti(cartella: string): string[] {
  const trovati: string[] = [];
  for (const voce of readdirSync(cartella, { withFileTypes: true })) {
    const percorso = join(cartella, voce.name);
    if (voce.isDirectory()) trovati.push(...sorgenti(percorso));
    else trovati.push(percorso);
  }
  return trovati;
}

const SRC = join(process.cwd(), "src");

describe("identità dell'app", () => {
  it("ha un nome, e sa dire se è ancora un segnaposto", () => {
    // Non si pretende che il nome resti un segnaposto: il giorno che l'utente lo
    // sceglie (PROGETTO.md §6) i test non devono diventare rossi per una scelta
    // giusta. Si pretende che l'app sappia in che stato si trova, perché è quello
    // che decide se mostrare l'avviso «lavori in corso».
    expect(NOME_APP.trim().length).toBeGreaterThan(0);
    expect(NOME_APP_DA_DECIDERE).toBe(NOME_APP.startsWith("["));
  });

  it("il nome compare in un unico punto del codice", () => {
    const altrove = sorgenti(SRC)
      .filter((f) => !f.endsWith("identita.ts") && !f.endsWith("identita.test.ts"))
      .filter((f) => readFileSync(f, "utf8").includes(NOME_APP));
    expect(altrove).toEqual([]);
  });

  it("i colori stanno nel foglio del tema, non sparsi nei componenti", () => {
    const colorati = sorgenti(SRC)
      .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
      .filter((f) => /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(readFileSync(f, "utf8")));
    expect(colorati).toEqual([]);
  });
});
