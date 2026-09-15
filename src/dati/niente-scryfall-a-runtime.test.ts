import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Il vincolo di ADR-0003, provato invece che promesso.
 *
 * I tag della comunità entrano nel pool a tempo di compilazione e lì restano:
 * **l'app non interroga mai Scryfall a runtime**. Il determinismo non è
 * un'aspirazione — la stessa richiesta con lo stesso seme sullo stesso pool dà
 * lo stesso mazzo — e una riga di codice che chiedesse i tag alla rete lo
 * romperebbe in silenzio, funzionando benissimo il giorno che la si scrive.
 *
 * Questo test guarda il codice dell'app come testo. È un modo grossolano, e va
 * bene così: il confine da difendere è grossolano quanto lui.
 */

const SRC = fileURLToPath(new URL("..", import.meta.url));
const QUESTO_FILE = fileURLToPath(import.meta.url);

/**
 * Gli indirizzi di Scryfall che l'app non deve nominare. Manca di proposito
 * `cards.scryfall.io`: le immagini delle carte vengono da lì, sono l'unico
 * terzo a cui l'app parla, e stanno negli indirizzi del pool — non in una
 * richiesta che il codice compone.
 */
const VIETATI = [
  "api.scryfall.com",
  "tagger.scryfall.com",
  "data.scryfall.io",
  "scryfall.com/docs",
  "bulk-data",
];

function sorgenti(cartella: string): string[] {
  const trovati: string[] = [];
  for (const voce of readdirSync(cartella, { withFileTypes: true })) {
    const percorso = join(cartella, voce.name);
    if (voce.isDirectory()) trovati.push(...sorgenti(percorso));
    else if (/\.(ts|tsx|js|css)$/.test(voce.name) && percorso !== QUESTO_FILE) {
      trovati.push(percorso);
    }
  }
  return trovati;
}

const FILE = sorgenti(SRC);

describe("l'app non parla con Scryfall", () => {
  it("guarda davvero tutto il codice dell'app", () => {
    // Se un giorno la ricerca dei file si rompesse, i controlli qui sotto
    // passerebbero su un elenco vuoto senza dire niente.
    expect(FILE.length).toBeGreaterThan(20);
    expect(FILE.map((f) => relative(SRC, f).replaceAll("\\", "/"))).toContain("dati/carica-pool.ts");
  });

  it("non nomina da nessuna parte l'API di Scryfall o Tagger", () => {
    const colpevoli = FILE.flatMap((percorso) => {
      const testo = readFileSync(percorso, "utf8");
      return VIETATI.filter((vietato) => testo.includes(vietato)).map(
        (vietato) => `${relative(SRC, percorso).replaceAll("\\", "/")}: «${vietato}»`,
      );
    });

    expect(colpevoli).toEqual([]);
  });

  it("non importa gli strumenti del manutentore, che invece la rete la usano", () => {
    // I test sono esclusi: non finiscono nel pacchetto, e qualcuno prova
    // davvero uno strumento del manutentore stando qui sotto.
    const colpevoli = FILE.filter((percorso) => !percorso.includes(".test."))
      .filter((percorso) => /from\s+["'][^"']*strumenti\//.test(readFileSync(percorso, "utf8")))
      .map((percorso) => relative(SRC, percorso).replaceAll("\\", "/"));

    expect(colpevoli).toEqual([]);
  });

  it("i tag della comunità li legge dal pool, e il pool è un file locale", () => {
    const lettura = readFileSync(join(SRC, "dati", "carica-pool.ts"), "utf8");

    expect(lettura).toContain("import.meta.env.BASE_URL");
    // L'unico indirizzo che l'app compone per i dati è quello del pool incluso.
    expect(lettura.match(/https?:\/\//g)).toBeNull();
  });
});

/**
 * Il ticket 11 stringe il confine, e questo test lo segue: il pool si congela
 * nell'app, e la rete l'app la usa per **due file suoi** — il documento di
 * formato e il listino dei prezzi — oltre alle immagini che il pool nomina.
 * Vale più di prima perché adesso il confine si può scrivere per intero: chi
 * aggiunge una richiesta di rete deve passare di qui e dire perché.
 */
describe("l'app chiede alla rete solo i suoi file", () => {
  const relativo = (percorso: string) => relative(SRC, percorso).replaceAll("\\", "/");
  const applicazione = FILE.filter((percorso) => !percorso.includes(".test."));

  it("le richieste di rete partono da cinque file, e da nessun altro", () => {
    const conRichieste = applicazione
      .filter((percorso) => /\bfetch\(/.test(readFileSync(percorso, "utf8")))
      .map(relativo)
      .sort();

    expect(conRichieste).toEqual([
      // Il file di cortesia degli avversari, incluso nell'app.
      "avversario/carica-orologi.ts",
      // Il documento di formato incluso nell'app.
      "dati/carica-formato.ts",
      // Il pool incluso nell'app.
      "dati/carica-pool.ts",
      // L'aggiornamento in sottofondo: il documento e il listino, e basta.
      "dati/scarica.ts",
      // Il guscio: i file dell'app, e le immagini delle carte.
      "sw.js",
    ]);
  });

  it("nessuna di quelle richieste compone un indirizzo di un altro dominio", () => {
    for (const nome of [
      "avversario/carica-orologi.ts",
      "dati/carica-formato.ts",
      "dati/carica-pool.ts",
      "dati/listino.ts",
      "dati/scarica.ts",
    ]) {
      const testo = readFileSync(join(SRC, nome), "utf8");
      expect(testo.match(/https?:\/\//g), nome).toBeNull();
    }
  });

  it("il pool non si riscarica: si legge dal pacchetto e basta", () => {
    // Un `no-cache` sul pool vorrebbe dire chiedere al server se le carte sono
    // cambiate, cioè riaprire l'aggiornamento che il ticket 11 ha chiuso.
    const lettura = readFileSync(join(SRC, "dati", "carica-pool.ts"), "utf8");
    expect(lettura).not.toMatch(/no-cache|no-store/);
  });

  it("il guscio lascia passare verso il server il documento e i prezzi, e non il pool", () => {
    const guscio = readFileSync(join(SRC, "sw.js"), "utf8");
    expect(guscio).toContain('"dati/formato.json"');
    expect(guscio).toContain('"dati/prezzi.json"');
    expect(guscio).not.toContain("dati/pool.json");
  });

  it("l'aggiornamento in sottofondo non importa la lettura del pool per scaricarlo", () => {
    const aggiornamento = readFileSync(join(SRC, "dati", "aggiornamento.ts"), "utf8");
    expect(aggiornamento).not.toMatch(/scaricaPool|interpretaPool/);
  });
});
