import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { Carta, Pool, Tag } from "../src/dati/pool.ts";
import {
  CONDIZIONI_DELLA_RIMOZIONE,
  CONDIZIONI_DEL_CONTROINCANTESIMO,
  CONDIZIONI_DELLO_SPAZZA_VIA,
} from "../src/punteggio/taratura.ts";

/**
 * Misura sul pool vero gli sconti delle risposte condizionate (ticket 73 per
 * la contromagia e lo spazzino, ticket 74 per la rimozione).
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
 *    È la misura da cui vengono tutt'e tre le quote —
 *    `QUOTA_DELLA_RIMOZIONE_CONDIZIONALE`,
 *    `QUOTA_DEL_CONTROINCANTESIMO_CONDIZIONALE` e
 *    `QUOTA_DELLO_SPAZZA_VIA_CONDIZIONALE` — e va rifatta quando il pool
 *    cambia. Nessuna delle tre è più un numero scelto.
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
/**
 * Quante carte sono **di quel colore**, come lo intende una risposta che lo
 * nomina: il colore **stampato**, cioè i simboli nel costo di mana.
 *
 * Non l'identità di colore, che è un'altra cosa e qui direbbe il falso. Una
 * creatura verde che si attiva pagando mana nero ha il nero nell'identità, ma
 * «destroy target black creature» non la tocca; e un artefatto incolore che
 * produce mana rosso non lo colpisce nessuna Blast. Contate per identità, le
 * righe di colore sovrastimano — quattro creature sul nero, sei sul rosso — e
 * sono proprio quelle righe a fissare la mediana.
 */
const diColore = (dove: readonly Carta[], colore: string) =>
  dove.filter((carta) => carta.costoDiMana.includes(colore)).length;
const diSottotipo = (dove: readonly Carta[], sottotipo: string) =>
  dove.filter((carta) =>
    carta.sottotipi.some((suo) => suo.toLowerCase() === sottotipo.toLowerCase()),
  ).length;

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

/**
 * La copertura di una condizione: quante ne prende su quante ne prenderebbe.
 *
 * Il quarto posto della riga, se c'è, dice **perché quella riga non fa
 * mediana**: si stampa come le altre, con la sua ragione accanto, ma resta
 * fuori dal conto. Serve alle condizioni che nel pool **non esistono da sole** —
 * la frase c'è, ma ogni carta che la porta ne porta anche un'altra, più stretta
 * e non misurabile. Contarle direbbe della rimozione quel che vale per una
 * rimozione che il pool non ha.
 */
function copertura(
  righe: readonly (readonly [string, number, number] | readonly [string, number, number, string])[],
): void {
  const quote: number[] = [];
  for (const [che, prese, tutte, fuori] of righe) {
    if (fuori === undefined) quote.push(prese / tutte);
    console.log(
      `${String(prese).padStart(4)} su ${String(tutte).padEnd(4)} ${(prese / tutte).toFixed(3)}  ${che}${fuori === undefined ? "" : `   ← fuori mediana: ${fuori}`}`,
    );
  }
  quote.sort((uno, altro) => uno - altro);
  const media = quote.reduce((somma, quota) => somma + quota, 0) / quote.length;
  // La mediana, non la media: una condizione sola che copre il doppio delle
  // altre tirerebbe la media a dire di ognuna quel che vale solo per lei.
  //
  // Con un numero **pari** di condizioni è la media dei due di mezzo, e va
  // scritto: le quote misurate qui si scelgono leggendo questa riga, e prendere
  // il più alto dei due la spingerebbe in su ogni volta che si aggiunge una
  // frase all'elenco.
  const mezzo = Math.floor(quote.length / 2);
  const mediana =
    quote.length % 2 === 1 ? quote[mezzo]! : (quote[mezzo - 1]! + quote[mezzo]!) / 2;
  console.log(`  mediana ${mediana.toFixed(3)} · media ${media.toFixed(3)}`);
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

const artefattiCreatura = creature.filter((carta) => diTipo(carta, "artifact")).length;
const muri = diSottotipo(creature, "wall");
/**
 * La creatura **vola** davvero, invece di nominare il volo di qualcun altro.
 *
 * Non basta cercare la parola: il testo del pool porta dentro anche le
 * spiegazioni fra parentesi, e «creatures with flying or reach» sta scritto
 * sotto ogni singolo volatore. Quel che distingue è la parola **prima**: chi
 * vola lo dichiara e basta, chi lo nomina lo nomina sempre dopo un «with», un
 * «gains», un «loses» o un «choose».
 *
 * Chi il volo se lo dà da sé pagando resta fuori, ed è voluto: la rimozione che
 * colpisce chi vola lo trova a terra.
 */
const vola = (carta: Carta): boolean =>
  [...carta.testo.matchAll(/\bflying\b/gi)].some(
    (dove) => !/(with|gains?|loses?|choose|without) $/i.test(carta.testo.slice(0, dove.index)),
  );
const cheVolano = creature.filter(vola).length;
// La costituzione bassa: le rimozioni del pool che pongono questa condizione
// dicono «3 o meno», oppure la legano alla forza di chi le usa — che nel pool
// arriva lì attorno.
const diCostituzioneBassa = creature.filter(
  (carta) => carta.costituzione !== null && Number(carta.costituzione) <= 3,
).length;

// Il denominatore di una rimozione è quel che colpirebbe **senza** la sua
// condizione: le creature se bersaglia creature, i permanenti non-terra se
// bersaglia permanenti. Le rimozioni del pool si condizionano sull'una o
// sull'altro, e misurarle tutte sul denominatore più largo chiamerebbe
// condizione anche la scelta del bersaglio, che condizione non è.
console.log(
  `\n==== quanto copre una rimozione condizionata (${creature.length} creature, ${permanenti.length} permanenti non-terra)`,
);
copertura([
  ["una creatura che non è un artefatto", creature.length - artefattiCreatura, creature.length],
  ["una creatura che non è nera", creature.length - diColore(creature, "B"), creature.length],
  [
    "una creatura che non è un Muro",
    creature.length - muri,
    creature.length,
    "nel pool non esiste da sola: chi la pone la pone in combattimento",
  ],
  ["un Muro", muri, creature.length],
  ["una creatura blu", diColore(creature, "U"), creature.length],
  ["una creatura nera", diColore(creature, "B"), creature.length],
  ["una creatura rossa", diColore(creature, "R"), creature.length],
  ["un permanente blu", diColore(permanenti, "U"), permanenti.length],
  ["un permanente nero", diColore(permanenti, "B"), permanenti.length],
  ["un permanente rosso", diColore(permanenti, "R"), permanenti.length],
  ["una creatura che vola", cheVolano, creature.length],
  [
    "una creatura di costituzione 3 o meno",
    diCostituzioneBassa,
    creature.length,
    "nel pool non esiste da sola: una la pone in combattimento, l'altra su roba tua",
  ],
]);

// Fuori misura restano le condizioni che non stanno nella carta ma nel turno:
// chi colpisce solo chi attacca, chi blocca, chi è TAPpato. Sono condizionali,
// e delle più strette che ci siano — la carta in mano a volte non trova niente
// — ma il pool non le sa esprimere. Due righe qui sopra restano fuori dalla
// mediana per la stessa ragione vista da vicino: la frase c'è, ma nel pool
// nessuna carta la porta da sola.
console.log(
  "\nFuori misura: chi colpisce solo chi attacca, chi blocca o chi è TAPpato.\nContano come condizionali, ma la loro quota non è misurabile di qui.",
);

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
