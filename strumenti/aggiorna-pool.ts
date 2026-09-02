import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";

import type { Pool } from "../src/dati/pool.ts";
import {
  confrontaPool,
  interessante,
  preparaPool,
  raccontaDiario,
  type CartaScryfall,
} from "./prepara-pool.ts";

/**
 * Il comando unico di aggiornamento dei dati (user story 60).
 *
 *     npm run dati
 *
 * Scarica l'archivio completo Scryfall, tiene le sole carte legali in Standard
 * cartaceo, le riduce ai campi che servono, riscrive `public/dati/pool.json` e
 * dice a schermo cosa è cambiato.
 *
 * Gira sul computer del manutentore, **mai nel browser**. La prossima volta che
 * servirà davvero è il 12 ottobre 2026, annuncio di bandi: se lanciarlo è
 * complicato, l'app è già in debito con Q27. Per questo è un comando solo,
 * senza argomenti obbligatori e senza dipendenze da installare.
 *
 * Con `--da <archivio>` legge un archivio Scryfall già sulla macchina invece
 * di scaricarlo — `.jsonl` o `.jsonl.gz`, col nome che gli dà Scryfall: serve
 * per riprovare senza rifare ottanta megabyte di rete.
 */

const DESCRITTORE = "https://api.scryfall.com/bulk-data/default-cards";

/**
 * Scryfall chiede a chi usa l'API di farsi riconoscere. È gratis e senza
 * chiave: dichiarare chi siamo è la contropartita, ed è anche la condizione dei
 * termini d'uso su cui si regge la legittimità dell'app (`PROGETTO.md` §3).
 */
const INTESTAZIONI = {
  "User-Agent": "mazzi-fuori-meta/0.0 (app hobbistica non commerciale)",
  Accept: "application/json",
};

const qui = (percorso: string) => fileURLToPath(new URL(percorso, import.meta.url));
const POOL = qui("../public/dati/pool.json");

type Descrittore = {
  updated_at: string;
  jsonl_download_uri: string;
  compressed_size?: number;
};

async function principale(): Promise<void> {
  const argomenti = process.argv.slice(2);
  const daFile = leggiOpzione(argomenti, "--da");

  const { grezze, aggiornatoIl } = daFile
    ? await daArchivioLocale(daFile)
    : await daScryfall();

  console.log(`Trovate ${grezze.length} stampe legali o bandite in Standard cartaceo.`);

  const preparazione = preparaPool(grezze, { aggiornatoIl });
  const precedente = poolPrecedente();

  scriviPool(preparazione.pool);

  console.log("");
  console.log(raccontaDiario(confrontaPool(precedente, preparazione)));
  console.log("");
  console.log(
    `Scritto ${percorsoLeggibile(POOL)}: ${preparazione.pool.carte.length} carte, ` +
      `dati Scryfall del ${aggiornatoIl}.`,
  );
  console.log("Il file è un prodotto di compilazione: va messo in git, mai modificato a mano.");
}

/** Scarica il descrittore, poi l'archivio, e lo setaccia mentre arriva. */
async function daScryfall(): Promise<{ grezze: CartaScryfall[]; aggiornatoIl: string }> {
  console.log(`Chiedo a Scryfall qual è l'archivio più fresco…`);
  const risposta = await fetch(DESCRITTORE, { headers: INTESTAZIONI });
  if (!risposta.ok) {
    throw new Error(`Scryfall ha risposto ${risposta.status} al descrittore dell'archivio.`);
  }
  const descrittore = (await risposta.json()) as Descrittore;

  const peso = descrittore.compressed_size;
  console.log(
    `Archivio del ${descrittore.updated_at}` +
      (peso === undefined ? "" : `, ${(peso / 1e6).toFixed(0)} MB compressi`) +
      ". Scarico…",
  );

  const scaricato = await fetch(descrittore.jsonl_download_uri, { headers: INTESTAZIONI });
  if (!scaricato.ok || scaricato.body === null) {
    throw new Error(`Scryfall ha risposto ${scaricato.status} all'archivio.`);
  }

  return {
    // `tsconfig.json` carica anche i tipi del browser, e lì `ReadableStream` è
    // un altro tipo con lo stesso nome: a runtime è quello di Node ed è giusto.
    grezze: await setaccia(Readable.fromWeb(scaricato.body as never), true),
    aggiornatoIl: descrittore.updated_at,
  };
}

/**
 * L'archivio già sul disco. La data dei dati non si inventa: si legge dal nome
 * che Scryfall dà al file (`default-cards-20260902090548.jsonl`), perché il
 * prezzo di ogni carta la porta con sé e sbagliarla vorrebbe dire mentire.
 */
async function daArchivioLocale(
  percorso: string,
): Promise<{ grezze: CartaScryfall[]; aggiornatoIl: string }> {
  // Solo il nome del file, non l'intero percorso: una cartella che si chiama
  // con dei numeri darebbe una data plausibile e falsa, e quella data finisce
  // sul prezzo di ogni carta.
  const impronta = /default-cards-(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(
    basename(percorso),
  );
  if (!impronta) {
    throw new Error(
      `Dal nome «${percorso}» non si legge la data dei dati. ` +
        `Serve il nome che gli dà Scryfall, tipo default-cards-20260902090548.jsonl.gz`,
    );
  }
  const [, anno, mese, giorno, ore, minuti, secondi] = impronta;
  const aggiornatoIl = `${anno}-${mese}-${giorno}T${ore}:${minuti}:${secondi}.000+00:00`;

  console.log(`Leggo ${percorsoLeggibile(percorso)} (dati del ${aggiornatoIl})…`);
  return {
    grezze: await setaccia(createReadStream(percorso), percorso.endsWith(".gz")),
    aggiornatoIl,
  };
}

/**
 * L'archivio arriva a righe, una carta per riga, e viene setacciato mentre
 * scorre: in memoria restano solo le poche migliaia di carte che ci riguardano,
 * e non il mezzo gigabyte dell'archivio intero.
 */
async function setaccia(sorgente: Readable, compresso: boolean): Promise<CartaScryfall[]> {
  if (!compresso) return raccogli(sorgente);

  const decompresso = sorgente.pipe(createGunzip());
  // `pipe` non porta avanti gli errori: senza questo, una rete che cade a metà
  // lascerebbe il comando ad aspettare per sempre invece di dirlo.
  sorgente.on("error", (guaio) => decompresso.destroy(guaio));
  return raccogli(decompresso);
}

async function raccogli(flusso: Readable): Promise<CartaScryfall[]> {
  const grezze: CartaScryfall[] = [];
  let lette = 0;

  for await (const riga of createInterface({ input: flusso, crlfDelay: Infinity })) {
    const pulita = riga.trim().replace(/,$/, "");
    // L'archivio JSONL ha una carta per riga; le parentesi quadre della
    // variante a elenco, se ci sono, non sono carte.
    if (pulita === "" || pulita === "[" || pulita === "]") continue;

    const grezza = JSON.parse(pulita) as CartaScryfall;
    if (interessante(grezza)) grezze.push(grezza);

    lette += 1;
    if (lette % 100_000 === 0) console.log(`  …${lette.toLocaleString("it")} carte lette`);
  }
  return grezze;
}

/** Il pool com'era prima di questo giro, se esiste: serve solo al diario. */
function poolPrecedente(): Pool | null {
  if (!existsSync(POOL)) return null;
  try {
    return JSON.parse(readFileSync(POOL, "utf8")) as Pool;
  } catch {
    console.log("Il pool precedente non si legge: il diario racconterà un primo giro.");
    return null;
  }
}

/**
 * Il pool si scrive con una carta per riga: è JSON valido, ma un diff di git
 * mostra le carte cambiate invece di una riga lunga due megabyte. Il file non
 * si modifica a mano, ma si deve poter *leggere* cosa è cambiato.
 */
function scriviPool(pool: Pool): void {
  // Un pool vuoto vuol dire che qualcosa è andato storto a monte, e scriverlo
  // cancellerebbe in silenzio l'unico file che fa funzionare l'app offline.
  if (pool.carte.length === 0) {
    throw new Error("Dall'archivio non è uscita nessuna carta: il pool non viene toccato.");
  }

  mkdirSync(qui("../public/dati"), { recursive: true });
  const carte = pool.carte.map((carta) => JSON.stringify(carta)).join(",\n");
  writeFileSync(
    POOL,
    `{\n"generatoIl": ${JSON.stringify(pool.generatoIl)},\n"carte": [\n${carte}\n]\n}\n`,
    "utf8",
  );
}

function leggiOpzione(argomenti: string[], nome: string): string | null {
  const posizione = argomenti.indexOf(nome);
  if (posizione === -1) return null;
  const valore = argomenti[posizione + 1];
  if (valore === undefined) throw new Error(`A ${nome} manca il percorso del file.`);
  return valore;
}

function percorsoLeggibile(percorso: string): string {
  return percorso.replace(qui("../"), "").replaceAll("\\", "/");
}

await principale();
