/**
 * Il file di partenza degli orologi, provato **com'è sul disco**.
 *
 * Gli altri test di questa cartella girano su orologi inventati, ed è giusto:
 * provano che il lettore fa quel che dice. Questo prova una cosa diversa e che
 * quelli non possono provare — che il file che l'app scarica davvero si apra.
 *
 * È il guasto che nessun tipo intercetta: il file è dati, lo scrive una mano, e
 * una virgola in meno lo rende illeggibile senza che il sorgente cambi di una
 * riga. `caricaOrologiDiPartenza` non solleva mai — un file di cortesia che
 * manca non è un guasto dell'app — quindi senza questo test un file rotto
 * sparirebbe in silenzio, e la prima schermata sarebbe vuota per sempre.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { interpretaOrologi, TURNO_DI_CHIUSURA_MASSIMO } from "./orologio.js";

const PERCORSO = fileURLToPath(new URL("../../public/dati/orologi.json", import.meta.url));
const OROLOGI = interpretaOrologi(JSON.parse(readFileSync(PERCORSO, "utf8")));

describe("gli orologi di partenza", () => {
  it("si aprono, e sono più d'uno", () => {
    // Il ticket ne chiede cinque o sei: uno solo non è un meta, e la corsa
    // contro un mazzo solo direbbe molto meno di quel che sembra.
    expect(OROLOGI.length).toBeGreaterThanOrEqual(5);
  });

  it("ognuno porta un perché, che è per chi rilegge fra sei mesi", () => {
    for (const orologio of OROLOGI) {
      expect(orologio.perche.length, orologio.nome).toBeGreaterThan(20);
    }
  });

  it("coprono sia i mazzi veloci sia quelli lenti", () => {
    // È la ragione per cui gli orologi sono più d'uno: un elenco di soli mazzi
    // veloci direbbe a ogni mazzo di controllo che va male, e viceversa, e la
    // sesta componente diventerebbe un secondo voto sulla velocità.
    const turni = OROLOGI.map((orologio) => orologio.turnoDiChiusura);
    expect(Math.min(...turni)).toBeLessThanOrEqual(6);
    expect(Math.max(...turni)).toBeGreaterThanOrEqual(9);
  });

  it("almeno uno porta contromagie, e almeno uno nessuna", () => {
    // Se nessuno ne portasse, il numero delle contromagie non sarebbe mai
    // messo alla prova, e alla sosta non si potrebbe dire se serve.
    expect(OROLOGI.some((orologio) => orologio.contromagie > 0)).toBe(true);
    expect(OROLOGI.some((orologio) => orologio.contromagie === 0)).toBe(true);
  });

  it("nessuno dichiara numeri fuori scala", () => {
    for (const orologio of OROLOGI) {
      expect(orologio.turnoDiChiusura).toBeGreaterThanOrEqual(1);
      expect(orologio.turnoDiChiusura).toBeLessThanOrEqual(TURNO_DI_CHIUSURA_MASSIMO);
      expect(orologio.rimozioni).toBeGreaterThanOrEqual(0);
      expect(orologio.contromagie).toBeGreaterThanOrEqual(0);
    }
  });
});
