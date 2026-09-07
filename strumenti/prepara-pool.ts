import type { Carta, Colore, ColoreMana, Faccia, Immagine, Pool, Terra } from "../src/dati/pool.ts";
import type { Formato } from "../src/dati/formato.ts";
import { verificaCarteEsistenti } from "../src/dati/carica-formato.ts";
import { COPIE_DI_UNA_LIMITATA, leggiTettoDiCopie } from "../src/mazzo/copie.ts";
import { applicaCorrezioni, tagMeccanici, type Correzione } from "./tag-di-sinergia.ts";
import { registroDeiTag, type IndiceTag } from "./tag-di-scryfall.ts";

/**
 * Da archivio Scryfall a pool: la trasformazione, e nient'altro.
 *
 * Questo modulo **non gira mai nel browser** e non tocca la rete, l'orologio o
 * il disco: è una funzione pura, e per questo è la seconda cucitura di test
 * della specifica. Chi scarica l'archivio e scrive il file è `aggiorna-pool.ts`.
 *
 * Il vincolo non negoziabile di `CLAUDE.md` vive qui: **nessuna verità di
 * formato nel sorgente**. Quali edizioni siano ammesse, quali carte limitate,
 * quali bandite e con che criterio si entra non è scritto in questo file: entra
 * come parametro, letto dal documento di formato
 * ([ADR-0004](../docs/adr/0004-nessuna-verita-di-formato-nel-sorgente.md)).
 *
 * ## Perché `legalities.oldschool` non si usa
 *
 * Scryfall dichiara un formato che si chiama come il nostro, ed è la prima cosa
 * che verrebbe in mente di leggere qui sotto. Non si usa, per due ragioni
 * separate e ciascuna sufficiente:
 *
 * 1. **sono le regole svedesi, non le nostre.** Quel campo descrive un
 *    regolamento pubblicato da un altro gruppo, con la sua lista di limitate e
 *    bandite, e il nostro gruppo ne diverge — le divergenze stanno scritte nel
 *    documento di formato, voce per voce;
 * 2. **vale per stampa e non per carta.** Maze of Ith risulta legale sulla
 *    stampa inglese e non legale sulla stampa italiana della stessa espansione.
 *    Un pool che leggesse quel campo darebbe risposte diverse a seconda di
 *    quale stampa gli capita sotto mano, che è il modo esatto in cui il conto
 *    per stampa sbaglia.
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
  /**
   * L'identificativo della **carta** e non della stampa: è per questo che
   * Scryfall Tagger aggancia i suoi tag, e le tre stampe di una carta lo
   * condividono.
   */
  oracle_id?: string;
  /**
   * Il nome **inglese**, su ogni stampa e in ogni lingua: Scryfall scrive qui
   * il nome dell'oracolo, e mette in `printed_name` quel che c'è stampato
   * sopra. È la ragione per cui una carta che in inglese, dentro le edizioni
   * ammesse, non esiste ha lo stesso un nome inglese da mostrare.
   */
  name?: string;
  /** Il nome come lo stampa questa stampa: presente solo fuori dall'inglese. */
  printed_name?: string;
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
  /**
   * Le legalità che Scryfall dichiara, **nessuna delle quali si legge**: sta qui
   * perché è il campo che verrebbe in mente di usare, e questo è il posto dove
   * dire di no.
   *
   * Fra le sue chiavi ce n'è una che si chiama come il nostro formato. Non è il
   * nostro formato: descrive il **regolamento svedese**, che ha limitate e
   * bandite diverse dalle nostre — le divergenze stanno scritte nel documento
   * di formato, voce per voce. E vale **per stampa**: Maze of Ith risulta
   * legale sulla stampa inglese e non legale sulla stampa italiana della stessa
   * espansione, quindi la stessa carta darebbe due risposte a seconda di quale
   * stampa capita sotto mano. Chi entra lo decide il documento, e nient'altro.
   */
  legalities?: Record<string, string>;
  games?: string[];
  digital?: boolean;
  rarity?: string;
  /**
   * La Reserved List: Wizards si è impegnata a non ristampare più queste carte.
   *
   * È un fatto della **carta** e non della stampa, e Scryfall lo ripete su ogni
   * stampa: qui si legge da quella scelta, come la rarità.
   */
  reserved?: boolean;
  prices?: Record<string, string | null>;
  /**
   * Che cosa Scryfall ha davvero della figura: `missing` e `placeholder` sono i
   * due modi in cui dice «gli indirizzi ci sono ma non è la carta».
   */
  image_status?: string;
  image_uris?: Record<string, string>;
  card_faces?: FacciaScryfall[];
  all_parts?: { component?: string; name?: string }[];
};

/**
 * L'esito della preparazione. Oltre al pool porta i **nomi banditi**: non
 * entrano nel file dell'app, ma servono al diario per distinguere una carta
 * bandita da una che il criterio non ammette.
 *
 * E porta i nomi delle **correzioni orfane**: le righe del file dei tag scritte
 * a mano che non trovano più la loro carta. Vanno dette a schermo, mai ingoiate.
 *
 * `postaNonBandita` è la verifica della meccanica della posta: le carte entrate
 * nel pool che nel testo parlano di posta e che la lista delle bandite non
 * nomina. È una **verifica e non una fonte** — non toglie niente da sé, lo
 * dice e basta.
 */
export type Preparazione = {
  pool: Pool;
  bandite: string[];
  correzioniOrfane: string[];
  postaNonBandita: string[];
};

export type Diario = {
  primaVolta: boolean;
  entrate: string[];
  uscite: string[];
  bandite: string[];
};

/** I buchi del pool: quel che il manutentore vuole vedere contato (storia 31). */
export type Buchi = {
  senzaImmagine: number;
  senzaPrezzo: number;
  /** Senza nessuno dei tag **nostri**: è il numero che il ticket 06 chiede. */
  senzaTagNostri: number;
  /** Senza nemmeno un tag di nessuna delle due razze. */
  senzaTag: number;
  totale: number;
};

const COLORI: readonly string[] = ["W", "U", "B", "R", "G"];
const COLORI_MANA: readonly string[] = [...COLORI, "C"];

/** Le due lingue che questa preparazione guarda, e a che cosa serve ciascuna. */
const ITALIANO = "it";
const INGLESE = "en";

/**
 * Le immagini che Scryfall dichiara di non avere. Gli indirizzi ci sono lo
 * stesso e puntano al dorso di una carta: mostrarli sarebbe peggio di non
 * mostrare niente.
 */
const IMMAGINI_INESISTENTI: readonly string[] = ["missing", "placeholder"];

/**
 * La carta va guardata? Solo se è **di carta** e se la sua stampa appartiene a
 * un'edizione che il formato ammette.
 *
 * La **lingua non si guarda qui**, ed è voluto: quale lingua conti è una
 * domanda del criterio, e il criterio si applica al passo 1 di `preparaPool`,
 * dove le stampe di una carta sono tutte insieme. Setacciare per lingua adesso
 * vorrebbe dire decidere due volte, in due posti, la stessa cosa.
 *
 * Esportata perché `aggiorna-pool.ts` la usa come setaccio mentre legge
 * l'archivio riga per riga: così in memoria entrano poche migliaia di stampe e
 * non l'intero scaricato — che con tutte le lingue è dieci volte più grande di
 * quello che bastava allo Standard.
 */
export function interessante(grezza: CartaScryfall, formato: Formato): boolean {
  if (grezza.digital === true) return false;
  if (!(grezza.games ?? []).includes("paper")) return false;
  if (nataDaUnUnione(grezza)) return false;
  if (grezza.layout === "reversible_card") return false;

  return edizioniAmmesse(formato).has(codiceDiEdizione(grezza.set));
}

/**
 * I codici delle edizioni ammesse, ripuliti come li ripulisce l'impronta del
 * formato: il documento lo scrive una mano, e uno spazio in coda a un codice
 * non deve poter svuotare il pool.
 *
 * Si ricava una volta per documento e poi si ricorda. Non è ottimizzazione
 * prematura: `interessante` è chiamata su **ogni riga** dell'archivio, e le
 * righe sono un milione — rifare l'insieme ogni volta vuol dire un milione di
 * insiemi buttati via, e il comando gira su un portatile.
 */
const EDIZIONI_DI: WeakMap<Formato, Set<string>> = new WeakMap();

function edizioniAmmesse(formato: Formato): Set<string> {
  const gia = EDIZIONI_DI.get(formato);
  if (gia !== undefined) return gia;

  const codici = new Set(formato.edizioni.map((edizione) => codiceDiEdizione(edizione.codice)));
  EDIZIONI_DI.set(formato, codici);
  return codici;
}

function codiceDiEdizione(codice: string | undefined): string {
  return (codice ?? "").trim().toLowerCase();
}

/**
 * Il risultato di un'unione (*meld*): i dati lo dichiarano una carta, e hanno
 * ragione, ma in un mazzo non ci va — arriva in gioco solo unendo le due carte
 * che lo compongono, e quelle sì che sono nel pool.
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
 * La preparazione lavora in **due passi**, e sono due domande diverse fatte a
 * due stampe diverse della stessa carta. Chi rilegge questo codice deve sapere
 * che è voluto:
 *
 * 1. **Chi entra** si decide sull'esistenza della stampa italiana. Il conto è
 *    per **nome** e mai per stampa: una carta ristampata in due edizioni
 *    ammesse è una carta sola, e sottrarre insiemi di edizioni — che è il modo
 *    naturale di scriverlo — conta per stampa e dà risposte sbagliate.
 * 2. **Cosa si mostra** viene dalla stampa **inglese** più economica fra quelle
 *    ammesse. Perché l'italiano non si mostra sta in `spec.md`: il testo di
 *    regole in italiano su Scryfall non esiste, l'immagine italiana manca per
 *    un'ottantina di carte, e i prezzi delle stampe italiane non ci sono
 *    affatto. Mostrando l'inglese, nome e prezzo parlano della stessa carta.
 *
 * `aggiornatoIl` è la data che Scryfall dichiara per l'archivio scaricato.
 * Entra come argomento e non viene letta da un orologio, perché la stessa
 * preparazione sugli stessi dati deve dare lo stesso file.
 *
 * Anche le `correzioni` ai tag entrano da qui già lette: il file lo apre chi
 * chiama, così questa funzione resta pura e verificabile a tavolino.
 */
export function preparaPool(
  datiGrezzi: CartaScryfall[],
  opzioni: {
    formato: Formato;
    aggiornatoIl: string;
    correzioni?: Correzione[];
    tag?: IndiceTag | undefined;
  },
): Preparazione {
  const formato = opzioni.formato;

  /* --- Passo 1: chi entra -------------------------------------------------
   *
   * Tutte le stampe delle edizioni ammesse, raccolte **per nome**. Da qui in
   * poi si ragiona su carte e non più su stampe. */
  const perNome = new Map<string, CartaScryfall[]>();
  for (const grezza of datiGrezzi) {
    if (!interessante(grezza, formato)) continue;
    const nome = grezza.name ?? "";
    if (nome === "") continue;
    const stampe = perNome.get(nome);
    if (stampe) stampe.push(grezza);
    else perNome.set(nome, [grezza]);
  }

  // Il documento di formato nomina carte, e questo è il primo posto che ha
  // davanti i nomi di tutte quelle che esistono — bandite comprese, e prima che
  // il criterio ne tolga. Un nome scritto storto si ferma qui, che è l'unico
  // momento in cui si può ancora distinguere da una carta che non c'è.
  verificaCarteEsistenti(formato, perNome.keys());

  const limitate = new Set(formato.limitate.carte.map((voce) => voce.carta));
  const daBandire = new Set(formato.bandite.carte.map((voce) => voce.carta));

  const carte: Carta[] = [];
  const bandite: string[] = [];

  for (const [nome, stampe] of perNome) {
    if (!ammessaDalCriterio(stampe, formato)) continue;
    // La bandita si conta **dopo** il criterio: una carta che il formato
    // bandisce ma che il criterio non ammetterebbe comunque non è sparita dal
    // pool per via del bando, e dirlo nel diario sarebbe una mezza verità.
    if (daBandire.has(nome)) {
      bandite.push(nome);
      continue;
    }

    /* --- Passo 2: cosa si mostra ---------------------------------------- */
    carte.push(
      riduci({
        nome,
        stampa: stampaDaMostrare(stampe),
        nomeItaliano: nomeItalianoDi(stampe),
        limitata: limitate.has(nome),
        aggiornatoIl: opzioni.aggiornatoIl,
        tag: opzioni.tag,
      }),
    );
  }

  // L'ordine è alfabetico e non quello dell'archivio: il file finisce in git, e
  // un diff deve mostrare quel che è cambiato, non come Scryfall ha ordinato.
  carte.sort((a, b) => confrontaTesti(a.nome, b.nome));
  bandite.sort(confrontaTesti);

  // Prima le regole meccaniche, poi le correzioni a mano sopra di esse: è
  // l'ordine deciso in Q13, ed è quel che rende le correzioni l'ultima parola.
  const corrette = applicaCorrezioni(carte, opzioni.correzioni ?? []);

  // Il registro si costruisce dai tag **finiti sulle carte**, non dall'indice
  // intero: fra i due qualche carta si perde per strada — le bandite, le stampe
  // doppie — e un registro che nomina tag che nessuno porta direbbe una falsità.
  const registroTagScryfall =
    opzioni.tag === undefined
      ? []
      : registroDeiTag(
          opzioni.tag,
          corrette.carte.flatMap((carta) => carta.tagScryfall),
        );

  return {
    pool: { generatoIl: opzioni.aggiornatoIl, registroTagScryfall, carte: corrette.carte },
    bandite,
    correzioniOrfane: corrette.orfane,
    postaNonBandita: cartePerLaPosta(corrette.carte),
  };
}

/**
 * Il criterio del pool, applicato alle stampe di **una carta**.
 *
 * I due nomi non sono verità di formato: sono i due comportamenti che il codice
 * sa eseguire, e quale valga lo dice il documento (`formato.ts`). Che
 * `stampa-italiana` voglia dire «esiste una stampa in italiano» è la
 * definizione della regola, non una lista di carte.
 */
function ammessaDalCriterio(stampe: CartaScryfall[], formato: Formato): boolean {
  switch (formato.criterio.regola) {
    case "stampa-italiana":
      return stampe.some((stampa) => stampa.lang === ITALIANO);
    // Le stampe sono già tutte di edizioni ammesse: essercene una basta.
    case "solo-edizioni":
      return true;
  }
}

/**
 * La stampa che descrive la carta, cercata in **quest'ordine di lingue**, e la
 * più economica dentro la prima che dia qualcosa.
 *
 * 1. **inglese**, che è il caso normale e la ragione della scelta: prezzo,
 *    immagine e nome parlano tutti della stessa carta;
 * 2. **italiano**, quando in inglese, dentro le edizioni ammesse, la carta non
 *    è mai stata stampata. Nel pool vero sono settantadue — settantasei prima
 *    che le bandite uscissero — e fra loro le terre duali e metà delle
 *    limitate. Nome, testo e tipi restano inglesi lo stesso,
 *    perché Scryfall li scrive in inglese su ogni stampa; quel che manca è il
 *    prezzo, e in genere manca davvero — le stampe italiane su Cardmarket non
 *    hanno listino;
 * 3. **qualunque altra**, che serve solo al criterio a elenco: là dentro può
 *    entrare una carta che né in inglese né in italiano esiste.
 *
 * L'ordine è per **lingua** e non per prezzo, ed è la differenza che conta.
 * Prendendo la più economica fra tutte, queste settantadue carte finivano
 * descritte dalla stampa **francese**: la stessa edizione, la stessa figura, un
 * prezzo che su Cardmarket esiste — e una carta che il destinatario non gioca.
 * Un prezzo preso di lì sarebbe un numero vero di un'altra carta, e la lista
 * della spesa manderebbe a comprare la cosa sbagliata. Meglio dire che il
 * prezzo non si sa: è quel che succede davvero a chi compra quelle carte, e il
 * diario conta quante sono.
 */
function stampaDaMostrare(stampe: CartaScryfall[]): CartaScryfall {
  for (const lingua of [INGLESE, ITALIANO]) {
    const nella = stampe.filter((stampa) => stampa.lang === lingua);
    if (nella.length > 0) return piuEconomica(nella);
  }
  return piuEconomica(stampe);
}

/**
 * Il nome italiano, che non si mostra e serve solo a cercare: chi scrive
 * «Labirinto di Ith» deve trovare *Maze of Ith*.
 *
 * Si prende dalla stessa stampa italiana ogni volta — la più economica, poi la
 * più vecchia, poi per identificativo — così due preparazioni sugli stessi dati
 * scrivono lo stesso file.
 */
function nomeItalianoDi(stampe: CartaScryfall[]): string | null {
  const italiane = stampe.filter((stampa) => stampa.lang === ITALIANO);
  if (italiane.length === 0) return null;
  const stampato = piuEconomica(italiane).printed_name?.trim();
  return stampato === undefined || stampato === "" ? null : stampato;
}

/**
 * La più economica fra le stampe date. A parità di prezzo — e le carte senza
 * prezzo sono tutte a pari — si sceglie la stampa più vecchia, e a parità di
 * tutto l'identificativo: serve solo che la scelta sia sempre la stessa.
 */
function piuEconomica(stampe: CartaScryfall[]): CartaScryfall {
  const ordinate = [...stampe].sort((a, b) => {
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
function riduci(quale: {
  nome: string;
  stampa: CartaScryfall;
  nomeItaliano: string | null;
  limitata: boolean;
  aggiornatoIl: string;
  tag: IndiceTag | undefined;
}): Carta {
  const grezza = quale.stampa;
  // Lo stato dell'immagine è della **stampa** e non della faccia: Scryfall lo
  // dichiara una volta sola. Passarlo alle facce è quel che tiene chiusa la
  // porta di servizio — senza, una stampa dichiarata segnaposto perdeva
  // l'immagine al livello della carta e se la riprendeva dal davanti, che è la
  // stessa figura con lo stesso indirizzo.
  const facce = (grezza.card_faces ?? []).map((faccia) =>
    riduciFaccia(faccia, grezza.image_status),
  );
  const davanti = facce[0] ?? null;

  const lineaDiTipo = grezza.type_line ?? facce.map((f) => f.lineaDiTipo).join(" // ");
  const { tipi, sottotipi } = leggiTipi(lineaDiTipo);

  const testo =
    grezza.oracle_text ??
    facce
      .map((f) => f.testo)
      .filter((t) => t !== "")
      .join("\n");

  const immagine =
    leggiImmagine(grezza.image_uris, grezza.image_status) ?? davanti?.immagine ?? null;

  const carta: Carta = {
    id: grezza.id ?? "",
    nome: quale.nome,
    nomeItaliano: quale.nomeItaliano,
    edizione: codiceDiEdizione(grezza.set),
    numeroDiCollezione: grezza.collector_number ?? "",
    linguaDellaStampa: grezza.lang ?? "",
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
    // Assente vuol dire «non riservata», che è la risposta giusta per la
    // stragrande maggioranza delle carte e l'unica onesta per un dato che non
    // c'è: dire «riservata» per prudenza terrebbe fuori dal tetto di spesa
    // carte che si ristampano ogni due anni.
    riservata: grezza.reserved === true,
    prezzo: { euro: prezzoInEuro(grezza), aggiornatoIl: quale.aggiornatoIl },
    tag: [],
    // I tag della comunità arrivano già pronti dall'indice: qui non si deduce
    // nulla, si aggancia e basta. L'assenza è uno stato legittimo. La copia
    // serve a non consegnare alla carta un elenco che appartiene all'indice.
    tagScryfall: [...(quale.tag?.perCarta.get(grezza.oracle_id ?? "") ?? [])],
    facce: facce.length > 0 ? facce : null,
    terra: tipi.includes("Land") ? leggiTerra(grezza, testo) : null,
    // Il tetto di copie si cuoce qui, una volta per carta, e da qui in poi è un
    // dato come il costo di mana: chi costruisce lo legge e non lo ricalcola.
    // Il formato ha l'ultima parola — una limitata sta a una copia anche se il
    // suo testo si concedesse il permesso — e quel che resta è regola del gioco
    // e vive dove viveva (`mazzo/copie.ts`).
    tettoDiCopie: quale.limitata ? COPIE_DI_UNA_LIMITATA : leggiTettoDiCopie(testo, tipi),
  };

  // I tag si leggono dalla carta già ridotta, non dai dati grezzi: le regole
  // guardano il testo di tutte le facce e i tipi, che è quel che c'è qui.
  return { ...carta, tag: tagMeccanici(carta) };
}

/**
 * Il valore di mana di un costo scritto: `{3}{W}{W}` vale cinque.
 *
 * Un simbolo ibrido vale il più caro dei suoi lati — `{2/W}` due, `{G/U}` uno —
 * e `{X}` vale zero, come dicono le regole del gioco.
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

function riduciFaccia(grezza: FacciaScryfall, statoDellaStampa: string | undefined): Faccia {
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
    // Le facce non portano uno stato dell'immagine per conto proprio: quello è
    // della stampa, e vale per tutte.
    immagine: leggiImmagine(grezza.image_uris, statoDellaStampa),
  };
}

/**
 * Gli indirizzi dell'immagine, quando l'immagine c'è davvero.
 *
 * Una stampa che Scryfall dichiara `placeholder` gli indirizzi ce li ha lo
 * stesso, e puntano al dorso di una carta: capita a tutta la Quarta italiana.
 * Consegnarli vorrebbe dire mostrare all'utente un dorso al posto della sua
 * carta, che è peggio del riquadro vuoto.
 */
function leggiImmagine(
  indirizzi: Record<string, string> | undefined,
  stato: string | undefined,
): Immagine | null {
  if (stato !== undefined && IMMAGINI_INESISTENTI.includes(stato)) return null;
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
 * base di terre dovrà pesarla.
 */
const ENTRA_GIRATA = /enters (?:the battlefield )?tapped/i;

/** «This land enters tapped **unless you control a basic land**.» */
const CONDIZIONE_ALTRIMENTI = /enters (?:the battlefield )?tapped\s+unless\s+([^.\n]+)/i;

/**
 * «**As this land enters, you may pay 2 life.** If you don't, it enters tapped.»
 * — la stessa condizione detta al contrario.
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
 * La meccanica della **posta**: le carte che chiedono di scommettere una carta
 * vera prima di giocare.
 *
 * Il documento di formato le bandisce **per nome**, e fa bene: una regola come
 * fonte banderebbe in silenzio la prima carta che nomina la posta per un altro
 * motivo. Questa funzione è l'altra metà di quella scelta — la **verifica** —
 * e serve a una cosa sola: dire al manutentore che nel pool ne è rimasta una
 * che la lista non nomina. Non toglie niente e non decide niente.
 *
 * La parola si cerca **intera**. Cercarla dentro le altre pesca ottantatré
 * carte, perché «ench**ante**d» la contiene: è una trappola vera, e chi ha
 * scritto la specifica ci è cascato prima di accorgersene.
 */
const POSTA = /\bantes?\b/i;

function cartePerLaPosta(carte: Carta[]): string[] {
  return carte.filter((carta) => POSTA.test(carta.testo)).map((carta) => carta.nome);
}

/**
 * Cosa è cambiato dal pool precedente. Le carte sparite si dividono in due:
 * quelle **bandite**, che hanno un nome e una data, e quelle semplicemente
 * **uscite**. È la distinzione che il manutentore guarda prima di pubblicare
 * (storia 30).
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
 * Quante carte del pool hanno perso qualcosa per strada (storia 31).
 *
 * Su questo formato non sono incidenti rari: le stampe italiane non hanno
 * listino, un'ottantina di figure sono segnaposto, e Scryfall Tagger copre metà
 * del pool contro i due terzi dei set recenti. Contarle è il modo in cui il
 * manutentore si accorge se un giorno il buco raddoppia.
 */
export function contaBuchi(pool: Pool): Buchi {
  return {
    senzaImmagine: pool.carte.filter((carta) => carta.immagine === null).length,
    senzaPrezzo: pool.carte.filter((carta) => carta.prezzo.euro === null).length,
    senzaTagNostri: pool.carte.filter((carta) => carta.tag.length === 0).length,
    senzaTag: pool.carte.filter(
      (carta) => carta.tag.length === 0 && carta.tagScryfall.length === 0,
    ).length,
    totale: pool.carte.length,
  };
}

/**
 * Quanti nomi si scrivono per categoria prima di fermarsi al conteggio. Un
 * annuncio di bandi ne muove una manciata e si legge tutto; un cambio di
 * criterio ne muove centinaia, e un elenco che scorre per pagine non lo legge
 * nessuno.
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
    // Al primo giro le entrate sono centinaia: il numero basta, l'elenco no.
    if (diario.primaVolta && titolo === "entrate") continue;

    righe.push("", `  ${titolo} (${nomi.length}):`);
    for (const nome of nomi.slice(0, NOMI_MOSTRATI)) righe.push(`    ${nome}`);
    if (nomi.length > NOMI_MOSTRATI) {
      righe.push(`    …e altre ${nomi.length - NOMI_MOSTRATI}`);
    }
  }

  return righe.join("\n");
}

/** I buchi, detti a schermo accanto al diario. */
export function raccontaBuchi(buchi: Buchi): string {
  return (
    `Sulle ${buchi.totale} carte del pool: ${buchi.senzaImmagine} senza immagine, ` +
    `${buchi.senzaPrezzo} senza prezzo, ${buchi.senzaTagNostri} senza nessuno dei nostri tag ` +
    `(di cui ${buchi.senzaTag} senza nemmeno un tag).`
  );
}

/**
 * La verifica della posta, detta a schermo: vuota quando non c'è niente da
 * dire, così chi legge il comando non impara a saltare una riga.
 */
export function raccontaPosta(nomi: string[]): string {
  if (nomi.length === 0) return "";
  return (
    `Nel pool restano ${nomi.length} carte che nel testo parlano di posta e che la lista ` +
    `delle bandite non nomina:\n` +
    nomi.map((nome) => `    ${nome}`).join("\n") +
    `\n  È una verifica e non una fonte: se vanno bandite, si aggiunge una riga al ` +
    `documento di formato.`
  );
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
