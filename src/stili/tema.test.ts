import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { DIREZIONI_VISIVE } from "./direzione.js";
// @ts-expect-error strumento del manutentore: JavaScript semplice, senza tipi.
import { coloriDelTema } from "../../strumenti/risorse-pwa.mjs";

/**
 * Manifest, icone e colore della barra del browser sono generati leggendo
 * `tema.css`. Se quella lettura smette di funzionare non si rompe niente in
 * modo visibile: l'app cambia aspetto e le icone restano quelle di prima. È
 * successo davvero, ed è il motivo di questo test.
 */

const TEMA = fileURLToPath(new URL("./tema.css", import.meta.url));
const leggi = coloriDelTema as (percorso: string, direzione: string) => Record<string, string>;

describe("colori del tema", () => {
  it("trova i colori richiesti per ogni direzione disegnata", () => {
    for (const direzione of DIREZIONI_VISIVE) {
      const colori = leggi(TEMA, direzione);
      for (const richiesto of ["fondo", "superficie", "accento"]) {
        expect(colori[richiesto], `${direzione} → --${richiesto}`).toMatch(
          /^#[0-9a-fA-F]{6}$/,
        );
      }
    }
  });

  it("ogni direzione ha davvero i suoi colori, non quelli della predefinita", () => {
    const fondi = DIREZIONI_VISIVE.map((direzione) => leggi(TEMA, direzione)["fondo"]);
    expect(new Set(fondi).size).toBe(DIREZIONI_VISIVE.length);
  });

  it("una direzione che non esiste è un errore, non un silenzio", () => {
    expect(() => leggi(TEMA, "inventata")).toThrow(/inventata/);
  });
});
