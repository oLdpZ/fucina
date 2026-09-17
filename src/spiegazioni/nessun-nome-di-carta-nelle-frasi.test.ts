import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { interpretaPool } from "../dati/carica-pool.js";

/**
 * **Nessuna frase nomina una carta scritta nel codice** (ticket 06 della
 * tappa 3, e ADR-0004 per la metà che gli tocca: «nessun nome di carta nel
 * sorgente»).
 *
 * I nomi delle carte **ruotano**. Il documento di formato può togliere
 * un'edizione domani, e la carta che oggi è la più forte del pool domani non
 * c'è più: una frase che la nominasse resterebbe lì a parlare di una carta che
 * l'app non ha, e nessun test diventerebbe rosso — è successo col nome del
 * formato, che per quattro giorni ha detto una cosa non più vera
 * (`dati/nessun-nome-di-formato-nel-sorgente.test.ts`, di cui questo file è il
 * fratello).
 *
 * I nomi che le frasi mostrano arrivano tutti **da fuori**: dai grezzi che i
 * modelli ricevono, cioè dal pool. Dentro `frasi.ts` non ce n'è nessuno, e
 * questo file è quel che tiene chiusa la scorciatoia.
 *
 * ## Perché guarda solo le frasi, e non tutto il sorgente
 *
 * Perché i nomi di carta di questo formato sono **parole italiane comuni** —
 * c'è una carta che si chiama «Lancia», e `dati/impronta-del-documento.ts`
 * scrive giustamente «Lancia «npm run dati», poi ricompila». Un guardiano
 * steso su tutto il sorgente accuserebbe quella riga, e un guardiano che
 * accusa a torto è un guardiano che qualcuno cancella.
 *
 * Il confine che regge è quello di `CLAUDE.md`: **tutti** i modelli di frase
 * stanno in `spiegazioni/`. È lì che un nome di carta farebbe il danno — sotto
 * gli occhi dell'utente — ed è lì che questo file guarda, riga per riga e senza
 * eccezioni da mantenere.
 */

const SPIEGAZIONI = fileURLToPath(new URL(".", import.meta.url));
const QUESTO_FILE = fileURLToPath(import.meta.url);

/**
 * I nomi veri, letti dal pool a ogni corsa e non copiati qui: sono una verità
 * di formato, e il giorno che il documento cambia questo elenco cambia da sé.
 *
 * Tutt'e due i nomi di ogni carta — quello stampato e quello italiano — perché
 * una frase potrebbe nominarla in uno qualunque dei due.
 */
const NOMI_DI_CARTA: string[] = (() => {
  const pool = interpretaPool(
    JSON.parse(
      readFileSync(fileURLToPath(new URL("../../public/dati/pool.json", import.meta.url)), "utf8"),
    ),
  );
  const nomi = new Set<string>();
  for (const carta of pool.carte) {
    nomi.add(carta.nome);
    // Il nome italiano c'è solo dove quella stampa esiste: dove non c'è è
    // `null`, e un `null` in elenco cercherebbe la parola «null» nel codice.
    if (carta.nomeItaliano !== null && carta.nomeItaliano !== undefined) {
      nomi.add(carta.nomeItaliano);
    }
  }
  return [...nomi];
})();

/** I file dell'app che scrivono in italiano: i modelli di frase e chi li riempie. */
function sorgenti(cartella: string): string[] {
  return readdirSync(cartella, { withFileTypes: true })
    .filter((voce) => voce.isFile() && /\.tsx?$/.test(voce.name) && !voce.name.includes(".test."))
    .map((voce) => join(cartella, voce.name))
    .filter((percorso) => percorso !== QUESTO_FILE);
}

/**
 * Il file senza i suoi commenti: la stessa scelta, e la stessa grossolanità,
 * del guardiano sul nome di formato. Un commento può nominare una carta per
 * raccontare un guasto che è successo davvero; una frase no.
 */
function senzaCommenti(codice: string): string {
  return codice.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/.*$/gm, " ");
}

/**
 * I nomi di carta che un testo pronuncia, **per intero e non a pezzi**.
 *
 * Il confronto non si fa con un'espressione regolare: i nomi arrivano dal pool
 * e ce ne sono con l'apostrofo, la virgola e il trattino, cioè proprio i segni
 * che in un'espressione regolare vogliono dire un'altra cosa. Si cerca la
 * parola intera a mano — il nome, e ai suoi due capi qualcosa che una lettera
 * non sia — che è lo stesso confine di `\b` senza niente da proteggere.
 */
function nomiDentro(testo: string): string[] {
  const lettera = /\p{L}/u;
  return NOMI_DI_CARTA.filter((nome) => {
    for (let da = testo.indexOf(nome); da !== -1; da = testo.indexOf(nome, da + 1)) {
      const prima = da === 0 ? "" : testo[da - 1];
      const dopo = testo[da + nome.length] ?? "";
      if (!lettera.test(prima ?? "") && !lettera.test(dopo)) return true;
    }
    return false;
  });
}

const FILE = sorgenti(SPIEGAZIONI);

describe("nessuna frase nomina una carta scritta nel codice", () => {
  it("guarda davvero i modelli di frase", () => {
    // Senza questo, una cartella rinominata svuoterebbe il controllo lasciandolo
    // verde per sempre.
    expect(FILE.map((f) => relative(SPIEGAZIONI, f).replaceAll("\\", "/"))).toContain("frasi.ts");
    expect(NOMI_DI_CARTA.length).toBeGreaterThan(100);
  });

  it("nessuna riga di codice pronuncia il nome di una carta", () => {
    const colpevoli = FILE.flatMap((percorso) =>
      nomiDentro(senzaCommenti(readFileSync(percorso, "utf8"))).map(
        (nome) => `${relative(SPIEGAZIONI, percorso).replaceAll("\\", "/")}: ${nome}`,
      ),
    );

    expect(colpevoli).toEqual([]);
  });

  it("il controllo funziona: un nome di carta scritto in chiaro lo trova", () => {
    const nome = NOMI_DI_CARTA[0] as string;
    expect(nomiDentro(`const frase = "La più forte qui è «${nome}».";`)).toContain(nome);
  });

  it("un commento invece può raccontare da dove veniamo", () => {
    const nome = NOMI_DI_CARTA[0] as string;
    expect(nomiDentro(senzaCommenti(`/** Nel 2026 c’era «${nome}». */\nconst x = 1;`))).toEqual([]);
  });
});
