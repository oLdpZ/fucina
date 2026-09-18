import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * **Nessuna schermata attribuisce al mercato una cifra che il gruppo ha
 * dichiarato** (ticket 83).
 *
 * Da quando il documento di formato può dichiarare quanto vale una terra base,
 * l'app mostra cifre di due specie diverse: quelle lette da Cardmarket e quelle
 * decise dal gruppo. Si distinguono da `prezzoDichiarato` (`mazzo/spesa.ts`), e
 * una schermata che nomini Cardmarket senza distinguerle direbbe che a fare
 * quel prezzo è stato il mercato — che di una terra base a zero euro è
 * esattamente il falso che questo ticket ha corretto.
 *
 * Il controllo è grossolano come i suoi fratelli — guarda il testo dei file
 * come testo — e il confine che difende è grossolano quanto lui: se in una
 * schermata compare il nome del mercato, in quella schermata compare anche la
 * domanda che separa le due specie di cifra.
 */

const COMPONENTI = fileURLToPath(new URL(".", import.meta.url));
const QUESTO_FILE = fileURLToPath(import.meta.url);

/** Il mercato da cui vengono i prezzi letti, e la domanda che li separa dagli altri. */
const MERCATO = "Cardmarket";
const LA_DOMANDA = "prezzoDichiarato";

function schermate(cartella: string): string[] {
  return readdirSync(cartella, { withFileTypes: true })
    .filter((voce) => voce.isFile() && /\.tsx?$/.test(voce.name) && !voce.name.includes(".test."))
    .map((voce) => join(cartella, voce.name))
    .filter((percorso) => percorso !== QUESTO_FILE);
}

const FILE = schermate(COMPONENTI);

describe("nessuna cifra dichiarata si spaccia per un prezzo di mercato", () => {
  it("guarda davvero le schermate", () => {
    const nomi = FILE.map((f) => relative(COMPONENTI, f).replaceAll("\\", "/"));
    expect(nomi).toContain("SchedaCarta.tsx");
    expect(nomi).toContain("ListaDellaSpesa.tsx");
  });

  it("chi nomina il mercato sa distinguere le due specie di cifra", () => {
    const colpevoli = FILE.filter((percorso) => {
      const codice = readFileSync(percorso, "utf8");
      return codice.includes(MERCATO) && !codice.includes(LA_DOMANDA);
    }).map((percorso) => relative(COMPONENTI, percorso).replaceAll("\\", "/"));

    expect(colpevoli).toEqual([]);
  });

  it("almeno una schermata il mercato lo nomina davvero", () => {
    // Senza questo, il giorno che il nome del mercato sparisse dall'interfaccia
    // per sbaglio il controllo qui sopra resterebbe verde per sempre.
    const nominano = FILE.filter((percorso) => readFileSync(percorso, "utf8").includes(MERCATO));
    expect(nominano.length).toBeGreaterThan(0);
  });
});
