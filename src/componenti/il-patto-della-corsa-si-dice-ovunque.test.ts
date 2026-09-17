import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * **Chi mostra un esito di corsa dichiara che l’avversario è una caricatura.**
 *
 * ADR-0002 lo chiede alla lettera, e non come una cortesia: un numero che
 * sembra un tasso di vittoria senza esserlo sarebbe la bugia peggiore che
 * quest’app possa dire. La frase esiste già ed è una costante sola,
 * `PATTO_DELLA_CORSA`, perché sia la stessa parola per parola dappertutto.
 *
 * Quel che mancava è il guardiano: niente impediva a una terza schermata di
 * mostrare `frasePerLaCorsa` dimenticandosi il patto, e nessun test sarebbe
 * diventato rosso. Il controllo è grossolano di proposito — guarda il testo
 * dei file come testo — perché il confine da difendere è grossolano quanto
 * lui: se in una schermata compare la corsa, in quella schermata compare il
 * patto.
 */

const COMPONENTI = fileURLToPath(new URL(".", import.meta.url));
const QUESTO_FILE = fileURLToPath(import.meta.url);

/**
 * Le frasi che portano in schermata un esito di corsa, e la dichiarazione che
 * deve accompagnarle.
 *
 * Sono due e non una. `frasePerLaCorsa` è quella ovvia. L'altra è la frase
 * dell'archetipo: il controllo si misura **sulle corse rette**, e quella frase
 * le conta — «ne regge 3 su 4» — per dire perché il mazzo sia un controllo. Un
 * numero di corsa è un numero di corsa da qualunque frase esca, e ADR-0002 non
 * fa sconti a seconda di chi lo scrive.
 *
 * Si cerca `archetipo.frase` e non `frasePerLArchetipo` perché le schermate la
 * frase non se la compongono: la ricevono già fatta da `spiegaMazzo`, e in
 * codice si legge così.
 */
const FRASI_DI_CORSA = ["frasePerLaCorsa", "archetipo.frase"];
const PATTO = "PATTO_DELLA_CORSA";

function schermate(cartella: string): string[] {
  return readdirSync(cartella, { withFileTypes: true })
    .filter((voce) => voce.isFile() && /\.tsx?$/.test(voce.name) && !voce.name.includes(".test."))
    .map((voce) => join(cartella, voce.name))
    .filter((percorso) => percorso !== QUESTO_FILE);
}

const FILE = schermate(COMPONENTI);

describe("il patto della corsa si dice ovunque la corsa si mostri", () => {
  it("guarda davvero le schermate", () => {
    const nomi = FILE.map((f) => relative(COMPONENTI, f).replaceAll("\\", "/"));
    expect(nomi).toContain("Costruzione.tsx");
    expect(nomi).toContain("Avversario.tsx");
  });

  it("nessuna schermata mostra una corsa senza dichiarare la caricatura", () => {
    const colpevoli = FILE.filter((percorso) => {
      const codice = readFileSync(percorso, "utf8");
      return FRASI_DI_CORSA.some((frase) => codice.includes(frase)) && !codice.includes(PATTO);
    }).map((percorso) => relative(COMPONENTI, percorso).replaceAll("\\", "/"));

    expect(colpevoli).toEqual([]);
  });

  it("almeno una schermata la corsa la mostra davvero, per ciascuna delle due frasi", () => {
    // Senza questo il controllo qui sopra resterebbe verde anche il giorno che
    // la corsa sparisse dall'interfaccia per sbaglio — o che una delle due
    // frasi cambiasse nome e nessuno la cercasse più.
    for (const frase of FRASI_DI_CORSA) {
      const mostrano = FILE.filter((percorso) => readFileSync(percorso, "utf8").includes(frase));
      expect(mostrano.length, frase).toBeGreaterThan(0);
    }
  });
});
