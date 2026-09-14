import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Carta, Pool, Tag } from "../src/dati/pool.ts";
import {
  CONDIZIONI_DELLA_RIMOZIONE,
  CONDIZIONI_DEL_CONTROINCANTESIMO,
  CONDIZIONI_DELLO_SPAZZA_VIA,
} from "../src/punteggio/taratura.ts";

/**
 * Misura sul pool vero gli sconti delle risposte condizionate (ticket 73).
 *
 *     node strumenti/misura-le-condizioni.ts
 *
 * Risponde a due domande, e nessuna delle due si può rispondere a occhio.
 *
 * 1. **Le frasi toccano quel che dicono di toccare?** Per ogni elenco di
 *    condizioni stampa quali carte del pool ciascuna frase prende, e quali
 *    restano incondizionate. Una frase che non prende nessuna carta va tolta
 *    dall'elenco invece di restare a far numero; una carta che il formato
 *    considera forte e che finisce fra le condizionate è il segno che la frase
 *    è troppo larga, e va tolta lei.
 * 2. **Quanto copre davvero una risposta condizionata?** Quante carte del pool
 *    annulla o spazza, contro quante ne prenderebbe senza la sua condizione.
 *    È la misura da cui vengono `QUOTA_DEL_CONTROINCANTESIMO_CONDIZIONALE` e
 *    `QUOTA_DELLO_SPAZZA_VIA_CONDIZIONALE`, e va rifatta quando il pool cambia.
 *
 * Gira sul computer del manutentore, **mai nel browser**: legge il pool e
 * stampa: non tocca niente e non decide niente. Le quote le sceglie una
 * persona, leggendo questi numeri.
 */

const POOL = fileURLToPath(new URL("../public/dati/pool.json", import.meta.url));

const pool = JSON.parse(readFileSync(POOL, "utf8")) as Pool;
const carte = pool.carte;
const nonTerre = carte.filter((carta) => carta.terra === null);

const diTipo = (carta: Carta, tipo: string) =>
  carta.tipi.some((suo) => suo.toLowerCase() === tipo);
const creature = nonTerre.filter((carta) => diTipo(carta, "creature"));
const permanenti = nonTerre.filter(
  (carta) =>
    diTipo(carta, "creature") || diTipo(carta, "enchantment") || diTipo(carta, "artifact"),
);
const diColore = (dove: readonly Carta[], colore: string) =>
  dove.filter((carta) => carta.identitaDiColore.includes(colore as never)).length;

/** Quali carte di quel tag ogni frase prende, e quali non ne prende nessuna. */
function frasiPerFrase(tag: Tag, condizioni: readonly string[]): void {
  const del = carte.filter((carta) => carta.tag.includes(tag));
  const prese = new Set<string>();

  console.log(`\n==== ${tag}: ${del.length} carte nel pool`);
  for (const frase of condizioni) {
    const tocca = del.filter((carta) => carta.testo.toLowerCase().includes(frase));
    for (const carta of tocca) prese.add(carta.nome);
    console.log(
      `${String(tocca.length).padStart(3)}  «${frase}»  ${tocca.map((c) => c.nome).join(", ")}`,
    );
  }

  const incondizionate = del.filter((carta) => !prese.has(carta.nome));
  console.log(`\n  restano incondizionate, ${incondizionate.length}:`);
  for (const carta of incondizionate) {
    console.log(`   · ${carta.nome} — ${carta.testo.replace(/\n/g, " / ").slice(0, 100)}`);
  }
}

/** La copertura di una condizione: quante ne prende su quante ne prenderebbe. */
function copertura(righe: readonly (readonly [string, number, number])[]): void {
  const quote: number[] = [];
  for (const [che, prese, tutte] of righe) {
    quote.push(prese / tutte);
    console.log(
      `${String(prese).padStart(4)} su ${String(tutte).padEnd(4)} ${(prese / tutte).toFixed(3)}  ${che}`,
    );
  }
  quote.sort((uno, altro) => uno - altro);
  const media = quote.reduce((somma, quota) => somma + quota, 0) / quote.length;
  // La mediana, non la media: una condizione sola che copre il doppio delle
  // altre tirerebbe la media a dire di ognuna quel che vale solo per lei.
  console.log(
    `  mediana ${quote[Math.floor(quote.length / 2)]!.toFixed(3)} · media ${media.toFixed(3)}`,
  );
}

console.log(`pool del ${pool.generatoIl}: ${carte.length} carte, ${nonTerre.length} non-terra`);

frasiPerFrase("rimozione-mirata", CONDIZIONI_DELLA_RIMOZIONE);
frasiPerFrase("controincantesimo", CONDIZIONI_DEL_CONTROINCANTESIMO);
frasiPerFrase("spazza-via", CONDIZIONI_DELLO_SPAZZA_VIA);

const aure = nonTerre.filter((carta) =>
  carta.sottotipi.some((sotto) => sotto.toLowerCase() === "aura"),
);
const istanti = nonTerre.filter((carta) => diTipo(carta, "instant"));
const incantesimi = nonTerre.filter((carta) => diTipo(carta, "enchantment"));
const artefatti = nonTerre.filter((carta) => diTipo(carta, "artifact"));

// Il denominatore è quel che la risposta prenderebbe **senza** la sua
// condizione: tutte le carte non-terra per una contromagia secca, tutte le
// creature per chi spazza creature, tutti i permanenti non-terra per chi
// spazza permanenti.
console.log(`\n==== quanto copre una contromagia condizionata (su ${nonTerre.length} non-terra)`);
copertura([
  ["una magia creatura", creature.length, nonTerre.length],
  [
    "un istantaneo o un'aura",
    new Set([...istanti, ...aure].map((carta) => carta.nome)).size,
    nonTerre.length,
  ],
  ["un incantesimo", incantesimi.length, nonTerre.length],
  ["una magia blu", diColore(nonTerre, "U"), nonTerre.length],
  ["una magia rossa", diColore(nonTerre, "R"), nonTerre.length],
  ["una magia nera", diColore(nonTerre, "B"), nonTerre.length],
  ["una magia verde", diColore(nonTerre, "G"), nonTerre.length],
  ["un istantaneo", istanti.length, nonTerre.length],
  [
    "una magia che distrugge una tua terra",
    nonTerre.filter((carta) => carta.tag.includes("attacca-le-terre")).length,
    nonTerre.length,
  ],
  ["un'abilità attivata di un artefatto", 0, nonTerre.length],
  ["se stessa, e nient'altro", 0, nonTerre.length],
]);

console.log(
  `\n==== quanto copre uno spazzino condizionato (${creature.length} creature, ${permanenti.length} permanenti non-terra)`,
);
copertura([
  ["le creature nere", diColore(creature, "B"), creature.length],
  ["le creature bianche", diColore(creature, "W"), creature.length],
  ["le creature non nere", creature.length - diColore(creature, "B"), creature.length],
  ["le creature non bianche", creature.length - diColore(creature, "W"), creature.length],
  [
    "una razza sola",
    creature.filter((carta) => carta.sottotipi.some((sotto) => sotto.toLowerCase() === "goblin"))
      .length,
    creature.length,
  ],
  ["gli incantesimi", incantesimi.length, permanenti.length],
  ["gli artefatti", artefatti.length, permanenti.length],
]);

// Fuori misura restano le condizioni che il pool non sa esprimere: chi spazza
// un tipo di terra — il pool ha le terre del formato, non quelle che un mazzo
// vero gioca — e chi prende la parte di campo che non ha attaccato.
console.log(
  "\nFuori misura: chi spazza un tipo di terra e chi prende una parte del campo.\nContano come condizionali, ma la loro quota non è misurabile di qui.",
);
