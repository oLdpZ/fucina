import type { Carta, Colore, ColoreMana, Faccia, Immagine, Pool, Terra } from "../src/dati/pool.ts";

/**
 * Da archivio Scryfall a pool: la trasformazione, e nient'altro.
 *
 * Questo modulo **non gira mai nel browser** e non tocca la rete, l'orologio o
 * il disco: è una funzione pura, e per questo è la seconda cucitura di test
 * della specifica. Chi scarica l'archivio e scrive il file è `aggiorna-pool.ts`.
 *
 * Il vincolo non negoziabile di `CLAUDE.md` vive qui: la legalità si legge
 * sempre da `legalities.standard`, mai da una data o da un elenco di set.
 */

/** I campi Scryfall che leggiamo. L'archivio ne ha molti altri: non ci servono. */
export type FacciaScryfall = {
  name?: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  image_uris?: Record<string, string>;
};

export type CartaScryfall = {
  id?: string;
  name?: string;
  lang?: string;
  layout?: string;
  released_at?: string;
  set?: string;
  collector_number?: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  color_identity?: string[];
  produced_mana?: string[];
  legalities?: Record<string, string>;
  games?: string[];
  digital?: boolean;
  rarity?: string;
  prices?: Record<string, string | null>;
  image_uris?: Record<string, string>;
  card_faces?: FacciaScryfall[];
  all_parts?: { component?: string; name?: string }[];
};

/**
 * L'esito della preparazione. Oltre al pool porta i **nomi banditi**: non
 * entrano nel file dell'app, ma servono al diario per distinguere una carta
 * bandita da una semplicemente ruotata fuori.
 */
export type Preparazione = {
  pool: Pool;
  bandite: string[];
};

export type Diario = {
  primaVolta: boolean;
  entrate: string[];
  uscite: string[];
  bandite: string[];
};

const COLORI: readonly string[] = ["W", "U", "B", "R", "G"];
const COLORI_MANA: readonly string[] = [...COLORI, "C"];

/**
 * La carta va guardata? Solo se è **di carta**, **in inglese** (Q24) e se i dati
 * la dichiarano legale o bandita in Standard. Le bandite servono al diario, ed è
 * l'unico motivo per cui arrivano fin qui.
 *
 * Esportata perché `aggiorna-pool.ts` la usa come setaccio mentre legge
 * l'archivio riga per riga: così in memoria entrano poche migliaia di carte e
 * non l'intero scaricato.
 */
export function interessante(grezza: CartaScryfall): boolean {
  if (grezza.lang !== "en") return false;
  if (grezza.digital === true) return false;
  if (!(grezza.games ?? []).includes("paper")) return false;
  if (nataDaUnUnione(grezza)) return false;
  if (grezza.layout === "reversible_card") return false;

  const legalita = grezza.legalities?.["standard"];
  return legalita === "legal" || legalita === "banned";
}

/**
 * Il risultato di un'unione (*meld*): i dati la dichiarano legale in Standard, e
 * hanno ragione, ma in un mazzo non ci va — arriva in gioco solo unendo le due
 * carte che la compongono, e quelle sì che sono nel pool.
 *
 * Si riconosce dai dati e non dal costo mancante: esistono carte vere senza
 * costo di mana che in un mazzo ci vanno eccome.
 *
 * L'altra stampa da non guardare è quella fronte-retro (`reversible_card`), che
 * ha la stessa identica carta sui due lati: Scryfall le dà il nome raddoppiato
 * («Blood Crypt // Blood Crypt»), e senza escluderla il pool si ritroverebbe due
 * voci per la stessa carta — cioè otto copie legali dove ne sono ammesse quattro.
 */
function nataDaUnUnione(grezza: CartaScryfall): boolean {
  return (grezza.all_parts ?? []).some(
    (parte) => parte.component === "meld_result" && parte.name === grezza.name,
  );
}

/**
 * L'archivio grezzo diventa il pool: una voce per nome, i soli campi usati.
 *
 * `aggiornatoIl` è la data che Scryfall dichiara per l'archivio scaricato.
 * Entra come argomento e non viene letta da un orologio, perché la stessa
 * preparazione sugli stessi dati deve dare lo stesso file.
 */
export function preparaPool(
  datiGrezzi: CartaScryfall[],
  opzioni: { aggiornatoIl: string },
): Preparazione {
  const perNome = new Map<string, CartaScryfall[]>();
  for (const grezza of datiGrezzi) {
    if (!interessante(grezza)) continue;
    const nome = grezza.name ?? "";
    if (nome === "") continue;
    const stampe = perNome.get(nome);
    if (stampe) stampe.push(grezza);
    else perNome.set(nome, [grezza]);
  }

  const carte: Carta[] = [];
  const bandite: string[] = [];

  for (const [nome, stampe] of perNome) {
    const legali = stampe.filter((s) => s.legalities?.["standard"] === "legal");
    // Nessuna stampa legale vuol dire una cosa sola: la carta è bandita.
    if (legali.length === 0) {
      bandite.push(nome);
      continue;
    }
    carte.push(riduci(nome, sceltaPiuEconomica(legali), opzioni.aggiornatoIl));
  }

  // L'ordine è alfabetico e non quello dell'archivio: il file finisce in git, e
  // un diff deve mostrare quel che è cambiato, non come Scryfall ha ordinato.
  carte.sort((a, b) => confrontaTesti(a.nome, b.nome));
  bandite.sort(confrontaTesti);

  return { pool: { generatoIl: opzioni.aggiornatoIl, carte }, bandite };
}

/**
 * La stampa più economica fra quelle legali. A parità di prezzo — e le carte
 * senza prezzo sono tutte a pari — si sceglie la stampa più vecchia, e a parità
 * di tutto l'identificativo: serve solo che la scelta sia sempre la stessa.
 */
function sceltaPiuEconomica(legali: CartaScryfall[]): CartaScryfall {
  const ordinate = [...legali].sort((a, b) => {
    // Confronto e non sottrazione: due carte senza prezzo valgono entrambe
    // «infinito», e la loro differenza non è un numero.
    const prezzoA = prezzoInEuro(a) ?? Infinity;
    const prezzoB = prezzoInEuro(b) ?? Infinity;
    if (prezzoA !== prezzoB) return prezzoA < prezzoB ? -1 : 1;
    const data = confrontaTesti(a.released_at ?? "", b.released_at ?? "");
    if (data !== 0) return data;
    return confrontaTesti(a.id ?? "", b.id ?? "");
  });
  return ordinate[0] as CartaScryfall;
}

function prezzoInEuro(grezza: CartaScryfall): number | null {
  const grezzo = grezza.prices?.["eur"];
  if (grezzo === undefined || grezzo === null || grezzo === "") return null;
  const valore = Number(grezzo);
  return Number.isFinite(valore) ? valore : null;
}

/** La stampa scelta, ridotta ai soli campi che l'app usa davvero. */
function riduci(nome: string, grezza: CartaScryfall, aggiornatoIl: string): Carta {
  const facce = (grezza.card_faces ?? []).map(riduciFaccia);
  const davanti = facce[0] ?? null;

  const lineaDiTipo = grezza.type_line ?? facce.map((f) => f.lineaDiTipo).join(" // ");
  const { tipi, sottotipi } = leggiTipi(lineaDiTipo);

  const testo =
    grezza.oracle_text ??
    facce
      .map((f) => f.testo)
      .filter((t) => t !== "")
      .join("\n");

  const immagine = leggiImmagine(grezza.image_uris) ?? davanti?.immagine ?? null;

  return {
    id: grezza.id ?? "",
    nome,
    // Il costo che conta per curva e terre è quello della faccia giocabile per
    // prima. Quando le facce ci sono, la faccia vince sempre sul livello della
    // carta: sulle avventure e sulle carte divise Scryfall scrive lì i due costi
    // attaccati («{1}{B} // {B}»), che non è il costo di nulla.
    costoDiMana:
      davanti !== null && davanti.costoDiMana !== ""
        ? davanti.costoDiMana
        : (grezza.mana_cost ?? ""),
    // Come il costo, e per lo stesso motivo: sulle carte divise il valore
    // dichiarato dai dati è la somma delle due metà, e non è il costo di
    // nessuna delle due. Quando le facce ci sono, il valore si conta.
    valoreDiMana:
      davanti !== null && davanti.costoDiMana !== ""
        ? valoreDiMana(davanti.costoDiMana)
        : (grezza.cmc ?? 0),
    identitaDiColore: (grezza.color_identity ?? []).filter((c): c is Colore =>
      COLORI.includes(c),
    ),
    tipi,
    sottotipi,
    testo,
    forza: grezza.power ?? davanti?.forza ?? null,
    costituzione: grezza.toughness ?? davanti?.costituzione ?? null,
    immagine,
    rarita: grezza.rarity ?? "",
    legalitaStandard: grezza.legalities?.["standard"] ?? "",
    prezzo: { euro: prezzoInEuro(grezza), aggiornatoIl },
    facce: facce.length > 0 ? facce : null,
    terra: tipi.includes("Land") ? leggiTerra(grezza, testo) : null,
  };
}

/**
 * Il valore di mana di un costo scritto: `{3}{W}{W}` vale cinque.
 *
 * Un simbolo ibrido vale il più caro dei suoi lati — `{2/W}` due, `{G/U}` uno —
 * e `{X}` vale zero, come dicono le regole del gioco. La formula è verificata:
 * sulle 4.647 carte a faccia singola del pool vero dà lo stesso numero che
 * dichiara Scryfall, riga per riga.
 */
function valoreDiMana(costo: string): number {
  let totale = 0;
  for (const simbolo of costo.match(/\{[^}]*\}/g) ?? []) {
    const lati = simbolo.slice(1, -1).split("/");
    totale += Math.max(...lati.map(valoreDelLato));
  }
  return totale;
}

function valoreDelLato(lato: string): number {
  const numero = Number(lato);
  if (lato !== "" && Number.isFinite(numero)) return numero;
  // `{X}`, `{Y}`, `{Z}` valgono zero fuori dalla pila; ogni altro simbolo — un
  // colore, l'incolore, la neve, il phyrexian — vale uno.
  return /^[XYZ]$/.test(lato) ? 0 : 1;
}

function riduciFaccia(grezza: FacciaScryfall): Faccia {
  const lineaDiTipo = grezza.type_line ?? "";
  const { tipi, sottotipi } = leggiTipi(lineaDiTipo);
  return {
    nome: grezza.name ?? "",
    costoDiMana: grezza.mana_cost ?? "",
    lineaDiTipo,
    tipi,
    sottotipi,
    testo: grezza.oracle_text ?? "",
    forza: grezza.power ?? null,
    costituzione: grezza.toughness ?? null,
    immagine: leggiImmagine(grezza.image_uris),
  };
}

function leggiImmagine(indirizzi: Record<string, string> | undefined): Immagine | null {
  const piccola = indirizzi?.["small"];
  const normale = indirizzi?.["normal"];
  if (piccola === undefined || normale === undefined) return null;
  return { piccola, normale };
}

/**
 * `"Legendary Creature — Goblin Warrior // Land"` diventa tipi e sottotipi,
 * uniti su tutte le facce: chi cerca «tutti i Goblin» deve trovare anche la
 * carta che è Goblin solo sul retro.
 *
 * Il trattino è il lungo (—) delle carte, non il segno meno.
 */
function leggiTipi(lineaDiTipo: string): { tipi: string[]; sottotipi: string[] } {
  const tipi: string[] = [];
  const sottotipi: string[] = [];

  for (const pezzo of lineaDiTipo.split("//")) {
    const [prima = "", dopo = ""] = pezzo.split("—");
    aggiungiUnaVolta(tipi, prima.trim().split(/\s+/));
    aggiungiUnaVolta(sottotipi, dopo.trim().split(/\s+/));
  }
  return { tipi, sottotipi };
}

function aggiungiUnaVolta(elenco: string[], parole: string[]): void {
  for (const parola of parole) {
    if (parola !== "" && !elenco.includes(parola)) elenco.push(parola);
  }
}

/**
 * Quel che serve sapere di una terra: i colori che produce, e se entra girata.
 *
 * «Entra girata» si riconosce dal verbo *enters* attaccato a *tapped*, e non
 * dalla sola parola *tapped*: molte carte parlano di permanenti che *tornano*
 * in gioco girati, e sono un'altra cosa. Quando la frase prosegue con *unless*,
 * la terra entra girata solo a volte, e la condizione si conserva perché la
 * base di terre (ticket 06) dovrà pesarla.
 */
const ENTRA_GIRATA = /enters (?:the battlefield )?tapped/i;

/** «This land enters tapped **unless you control a basic land**.» */
const CONDIZIONE_ALTRIMENTI = /enters (?:the battlefield )?tapped\s+unless\s+([^.\n]+)/i;

/**
 * «**As this land enters, you may pay 2 life.** If you don't, it enters tapped.»
 * — la stessa condizione detta al contrario, ed è come la scrive il ciclo di
 * terre più importante che ci sia.
 */
const CONDIZIONE_SE_NON = /([^.\n]+)\.\s*If you don't,[^.\n]*?enters (?:the battlefield )?tapped/i;

function leggiTerra(grezza: CartaScryfall, testo: string): Terra {
  const girata = ENTRA_GIRATA.test(testo);
  const condizione =
    CONDIZIONE_ALTRIMENTI.exec(testo)?.[1] ?? CONDIZIONE_SE_NON.exec(testo)?.[1] ?? null;

  return {
    coloriProdotti: (grezza.produced_mana ?? []).filter((c): c is ColoreMana =>
      COLORI_MANA.includes(c),
    ),
    entraGirata: girata,
    condizione: girata ? (condizione?.trim() ?? null) : null,
  };
}

/**
 * Cosa è cambiato dal pool precedente. Le carte sparite si dividono in due:
 * quelle **bandite**, che hanno un nome e una data, e quelle semplicemente
 * **uscite**, cioè ruotate fuori. È la distinzione che il manutentore guarda
 * prima di pubblicare (user story 61).
 */
export function confrontaPool(precedente: Pool | null, nuova: Preparazione): Diario {
  const prima = new Set((precedente?.carte ?? []).map((c) => c.nome));
  const adesso = new Set(nuova.pool.carte.map((c) => c.nome));
  const bandite = new Set(nuova.bandite);

  const sparite = [...prima].filter((nome) => !adesso.has(nome));

  return {
    primaVolta: precedente === null,
    entrate: [...adesso].filter((nome) => !prima.has(nome)).sort(confrontaTesti),
    uscite: sparite.filter((nome) => !bandite.has(nome)).sort(confrontaTesti),
    bandite: sparite.filter((nome) => bandite.has(nome)).sort(confrontaTesti),
  };
}

/**
 * Quanti nomi si scrivono per categoria prima di fermarsi al conteggio. Un
 * annuncio di bandi ne muove una manciata e si legge tutto; una rotazione ne
 * muove centinaia, e un elenco che scorre per pagine non lo legge nessuno.
 */
const NOMI_MOSTRATI = 40;

/** Il diario, detto a schermo al manutentore. */
export function raccontaDiario(diario: Diario): string {
  const righe = [
    diario.primaVolta
      ? `Primo pool: ${diario.entrate.length} carte.`
      : `Differenze dal pool precedente: ${diario.entrate.length} entrate, ` +
        `${diario.uscite.length} uscite, ${diario.bandite.length} bandite.`,
  ];

  for (const [titolo, nomi] of [
    ["entrate", diario.entrate],
    ["uscite", diario.uscite],
    ["bandite", diario.bandite],
  ] as const) {
    if (nomi.length === 0) continue;
    // Al primo giro le entrate sono migliaia: il numero basta, l'elenco no.
    if (diario.primaVolta && titolo === "entrate") continue;

    righe.push("", `  ${titolo} (${nomi.length}):`);
    for (const nome of nomi.slice(0, NOMI_MOSTRATI)) righe.push(`    ${nome}`);
    if (nomi.length > NOMI_MOSTRATI) {
      righe.push(`    …e altre ${nomi.length - NOMI_MOSTRATI}`);
    }
  }

  return righe.join("\n");
}

/**
 * Confronto fra stringhe che non dipende dalla lingua del sistema: `sort()`
 * senza argomenti ordina per unità di codice, e questo fa lo stesso in modo
 * dichiarato. Il pool finisce in git, e l'ordine non deve cambiare da un
 * computer all'altro.
 */
function confrontaTesti(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
