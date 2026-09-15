import type {
  Carta,
  Colore,
  ColoreMana,
  Faccia,
  Immagine,
  Pool,
  Prezzo,
  Stampa,
  Terra,
} from "../src/dati/pool.ts";
import type { Formato } from "../src/dati/formato.ts";
import { verificaCarteEsistenti } from "../src/dati/carica-formato.ts";
import { improntaDelDocumento } from "../src/dati/impronta-del-documento.ts";
import { leggiTettoDiCopie } from "../src/mazzo/copie.ts";
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
 * L'esito della preparazione. Oltre al pool porta i **nomi banditi**: nel pool
 * ci sono — il bando lo applica l'app, leggendo il documento (ADR-0008) — e il
 * diario li nomina a parte, perché sono le carte del file che il catalogo non
 * mostrerà.
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
  /**
   * Le carte di un'edizione ammessa che **non hanno nessuna stampa in una
   * lingua ammessa** per quell'edizione.
   *
   * Oggi resta vuota, ed è misurato in ADR-0006: le stampe straniere delle
   * edizioni di questo formato sono complete. Il giorno che nominasse qualcuno,
   * sarebbe scattata la clausola «si riaprirebbe se» di quell'ADR, e la
   * decisione andrebbe rifatta invece che aggirata. La carta entra nel pool lo
   * stesso — la lingua non è un criterio e non deve togliere nomi.
   */
  senzaLinguaAmmessa: string[];
  /**
   * Quante carte mostrano la figura di **un'altra copia della stessa edizione**,
   * perché la stampa che le descrive per illustrazione ha un dorso (ADR-0007).
   *
   * Nel pool la carta non porta scritto da dove la figura venga: questo conto è
   * l'unico posto in cui la cosa si vede, ed è il modo in cui chi tiene l'app
   * si accorge se un giorno il prestito diventa la regola invece che il caso.
   */
  figureDaUnAltraCopia: number;
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
  /** Senza nemmeno un tag, né dei nostri né di Tagger. */
  senzaTag: number;
  /**
   * Quante carte si mostrano su un cartoncino e si prezzano su un altro: il
   * numero che il ticket 30 chiede di tenere sott'occhio.
   *
   * Non è un buco come gli altri — la carta ha un prezzo, ed è vero — ma è la
   * distanza fra il cartoncino che la lista manda a comprare e quello da cui
   * l'euro viene, ed è il solo modo di accorgersi se torna a crescere.
   *
   * Il cartoncino sono **edizione e numero di collezione insieme**, e non la
   * sola edizione: le terre base hanno più figure numerate diversamente dentro
   * la stessa edizione, e contare per edizione le darebbe per coincidenti
   * quando non lo sono. La divergenza di sola **lingua** non si conta qui:
   * quella ADR-0006 l'ha scelta apposta, ed è il funzionamento previsto.
   */
  prezzoDaUnAltroCartoncino: number;
  totale: number;
};

const COLORI: readonly string[] = ["W", "U", "B", "R", "G"];
const COLORI_MANA: readonly string[] = [...COLORI, "C"];

/**
 * L'unico codice di lingua che resta scritto qui, e perché non è verità di
 * formato.
 *
 * **Quali** copie il gruppo ammetta non si legge più dal sorgente: sta nel campo
 * `lingue` di ogni edizione del documento, e la preparazione non ha altra strada
 * per saperlo che leggerlo di lì (ADR-0004). Le due costanti che c'erano fino a
 * ieri — la lingua preferita e il suo ripiego — sono sparite con quella lettura.
 *
 * Questa non le sostituisce, perché non risponde alla stessa domanda. Serve a
 * due cose che non cambiano quando il gruppo cambia idea sulle copie:
 *
 * 1. la regola `stampa-italiana`, il cui **nome è la sua definizione** —
 *    «esiste una stampa in italiano»: è uno dei due comportamenti che il codice
 *    sa eseguire, e quale valga lo dice il documento;
 * 2. il **nome italiano** come chiave di ricerca, che è una funzione dell'app
 *    per chi la usa e non una regola del tavolo: chi scrive «Labirinto di Ith»
 *    deve trovare *Maze of Ith* anche il giorno che l'italiano non si giocasse
 *    più.
 *
 * Nessuna delle due si può leggere da `lingue` senza dire una falsità: un
 * formato che ammettesse solo l'inglese non smetterebbe di volere la ricerca in
 * italiano, e la regola `stampa-italiana` diventerebbe un'altra regola.
 */
const ITALIANO = "it";

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
 * Le lingue ammesse edizione per edizione, nell'ordine in cui il documento le
 * scrive — e quell'ordine **è la preferenza**.
 *
 * Si ricorda per documento come le edizioni, e per la stessa ragione: la
 * domanda si fa su ogni stampa di ogni carta.
 */
const LINGUE_DI: WeakMap<Formato, Map<string, string[]>> = new WeakMap();

function lingueAmmesse(formato: Formato): Map<string, string[]> {
  const gia = LINGUE_DI.get(formato);
  if (gia !== undefined) return gia;

  const per = new Map<string, string[]>(
    formato.edizioni.map((edizione) => [
      codiceDiEdizione(edizione.codice),
      // Ripulite come i codici di edizione, e per lo stesso motivo: uno spazio
      // in coda a «it » è invisibile a chi scrive il documento, e svuoterebbe
      // un'edizione senza che nessuno se ne accorga.
      edizione.lingue.map((lingua) => lingua.trim().toLowerCase()),
    ]),
  );
  LINGUE_DI.set(formato, per);
  return per;
}

/**
 * Il posto di una stampa nell'ordine di preferenza della **propria** edizione,
 * e `-1` quando la sua lingua quell'edizione non la ammette.
 *
 * È per edizione e non per formato perché la regola vera è per edizione: la
 * stessa lingua può essere giocabile in una e non nell'altra, e un unico ordine
 * di formato sarebbe una media che nessun gruppo ha detto.
 */
function rangoDiLingua(grezza: CartaScryfall, formato: Formato): number {
  const lingue = lingueAmmesse(formato).get(codiceDiEdizione(grezza.set));
  if (lingue === undefined) return -1;
  return lingue.indexOf((grezza.lang ?? "").trim().toLowerCase());
}

/**
 * Le stampe che il gruppo ammette davvero: quelle la cui lingua è dichiarata
 * dall'edizione da cui vengono.
 *
 * Sono le uniche che possono descrivere la carta e le uniche che possono
 * prezzarla. Una copia che al tavolo l'arbitro respinge non è la carta che il
 * giocatore comprerà, e non è il pavimento del suo prezzo.
 */
function stampeAmmesse(stampe: CartaScryfall[], formato: Formato): CartaScryfall[] {
  return stampe.filter((stampa) => rangoDiLingua(stampa, formato) >= 0);
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
 * La preparazione lavora in **tre passi**, e sono tre domande diverse fatte a
 * tre stampe diverse della stessa carta. Chi rilegge questo codice deve sapere
 * che è voluto:
 *
 * 1. **Chi entra** si decide sull'esistenza della stampa italiana. Il conto è
 *    per **nome** e mai per stampa: una carta ristampata in due edizioni
 *    ammesse è una carta sola, e sottrarre insiemi di edizioni — che è il modo
 *    naturale di scriverlo — conta per stampa e dà risposte sbagliate.
 * 2. **Cosa si mostra** viene dalla prima lingua che l'edizione dichiara e che
 *    esista davvero: l'ordine di `lingue` è la preferenza, e il documento lo
 *    scrive edizione per edizione. Nessun codice di lingua si decide qui.
 * 3. **Quanto costa** viene da una **terza** stampa: la copia ammessa più
 *    economica che un listino ce l'abbia, di qualunque lingua ammessa sia. Il
 *    prezzo se la porta dietro, perché da qui non lo si deduce più dalle altre
 *    due.
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

  // Le limitate e le bandite **non si applicano qui** (ADR-0008). Il pool si
  // congela nell'app e il documento di formato si aggiorna da solo: una carta
  // tolta di qui non potrebbe tornare il giorno che il gruppo la sbandisce, e un
  // tetto scritto qui non scenderebbe il giorno che la limita. Il pool porta
  // tutto quel che il criterio ammette, con il tetto che il gioco dà a ogni
  // carta, e il resto lo fa l'app (`src/dati/pool-in-vigore.ts`).
  const daBandire = new Set(formato.bandite.carte.map((voce) => voce.carta));

  const carte: Carta[] = [];
  const bandite: string[] = [];
  const senzaLinguaAmmessa: string[] = [];
  let figureDaUnAltraCopia = 0;

  for (const [nome, stampe] of perNome) {
    if (!ammessaDalCriterio(stampe, formato)) continue;
    // La bandita si conta **dopo** il criterio: una carta che il formato
    // bandisce ma che il criterio non ammetterebbe comunque nel pool non c'è, e
    // dirla bandita nel diario sarebbe una mezza verità.
    if (daBandire.has(nome)) bandite.push(nome);

    /* --- Passi 2 e 3: cosa si mostra, e quanto costa --------------------- */
    // Le copie che il gruppo ammette si cercano una volta sola: le due domande
    // che seguono partono tutte e due da lì, e chiederlo due volte vorrebbe
    // dire poterlo chiedere in due modi.
    const ammesse = stampeAmmesse(stampe, formato);
    if (ammesse.length === 0) senzaLinguaAmmessa.push(nome);

    // Il prezzo si cerca **prima** di quel che si mostra, e l'ordine è la
    // decisione del ticket 30: fra due copie di pari lingua a scegliere
    // l'edizione mostrata è quella da cui il prezzo viene, così il giocatore
    // legge il numero di collezione e l'euro dello stesso cartoncino.
    const stampaDelPrezzo = stampaChePrezza(ammesse);
    const stampa = stampaCheDescrive(stampe, ammesse, formato, stampaDelPrezzo);
    const stampaDellaFigura = figuraDaUnAltraCopia(stampa, ammesse, formato);
    if (stampaDellaFigura !== null) figureDaUnAltraCopia += 1;

    carte.push(
      riduci({
        nome,
        stampa,
        stampaDelPrezzo,
        stampaDellaFigura,
        nomeItaliano: nomeItalianoDi(stampe),
        aggiornatoIl: opzioni.aggiornatoIl,
        tag: opzioni.tag,
      }),
    );
  }

  // L'ordine è alfabetico e non quello dell'archivio: il file finisce in git, e
  // un diff deve mostrare quel che è cambiato, non come Scryfall ha ordinato.
  carte.sort((a, b) => confrontaTesti(a.nome, b.nome));
  bandite.sort(confrontaTesti);
  senzaLinguaAmmessa.sort(confrontaTesti);

  // Prima le regole meccaniche, poi le correzioni a mano sopra di esse: è
  // l'ordine deciso in Q13, ed è quel che rende le correzioni l'ultima parola.
  const corrette = applicaCorrezioni(carte, opzioni.correzioni ?? []);

  // Il registro si costruisce dai tag **finiti sulle carte**, non dall'indice
  // intero: fra i due qualche carta si perde per strada — quelle che il criterio
  // non ammette, le stampe doppie — e un registro che nomina tag che nessuno
  // porta direbbe una falsità.
  const registroTagScryfall =
    opzioni.tag === undefined
      ? []
      : registroDeiTag(
          opzioni.tag,
          corrette.carte.flatMap((carta) => carta.tagScryfall),
        );

  return {
    pool: {
      generatoIl: opzioni.aggiornatoIl,
      // Il pool si porta dietro **da quale documento viene**: è l'unico momento
      // in cui il legame fra i due file esiste davvero, e senza scriverlo qui
      // resterebbe soltanto nella testa di chi lancia i due comandi nell'ordine
      // giusto. La compilazione lo confronta col documento incluso.
      improntaDelDocumento: improntaDelDocumento(formato),
      registroTagScryfall,
      carte: corrette.carte,
    },
    bandite,
    correzioniOrfane: corrette.orfane,
    // Le bandite adesso nel pool ci sono, e la verifica le deve saltare: è la
    // carta da posta che la lista **non** nomina a dover suonare l'allarme.
    postaNonBandita: cartePerLaPosta(corrette.carte).filter((nome) => !daBandire.has(nome)),
    senzaLinguaAmmessa,
    figureDaUnAltraCopia,
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
/**
 * Che dall'archivio sia uscita almeno una stampa.
 *
 * È la **prima** delle due domande sul vuoto, e si fa appena finito il
 * setaccio. Più giù `preparaPool` confronta i nomi del documento di formato con
 * quelli che ha in mano, e da un archivio vuoto non ne riconosce nessuno: il
 * comando moriva dicendo «Il documento di formato nomina N carte che non
 * esistono», cioè accusando l'unico dei due file scritto a mano — e l'unico dei
 * due che fosse giusto (ticket 18).
 *
 * Sta qui e non accanto al lettore dell'archivio perché la ragione per cui
 * esiste è tutta in *quest'ordine*: è la guardia che deve parlare prima di
 * `verificaCarteEsistenti`. La seconda domanda è `verificaPoolNonVuoto`, qui
 * sotto.
 */
export function verificaRaccolto(quante: number, provenienza: string): void {
  if (quante > 0) return;

  throw new Error(
    `Da «${provenienza}» non è uscita nessuna carta delle edizioni ammesse. ` +
      `Quasi sempre vuol dire che l'archivio non è quello giusto — un altro ` +
      `archivio di Scryfall, o il file dei tag passato per errore a --da. Il pool ` +
      `non viene toccato.`,
  );
}

/**
 * Che il pool preparato abbia dentro almeno una carta.
 *
 * Un pool vuoto scritto sul disco cancellerebbe in silenzio l'unico file che fa
 * funzionare l'app offline, quindi qualcuno lo deve fermare. Ma **questa** è la
 * seconda delle due domande che si fanno, e la differenza fra le due è tutta
 * nella frase che dicono.
 *
 * La prima — zero stampe lette — è dell'archivio, e la fa `verificaRaccolto`.
 * Questa arriva dopo, e allora le stampe c'erano: è il **criterio** a non
 * averne ammessa nessuna. Dire qui «dall'archivio non è uscita nessuna carta»
 * sarebbe falso, e manderebbe il manutentore a riscaricare quattrocento
 * megabyte perfettamente buoni invece che ad aprire il documento di formato,
 * che è l'unico dei due a poter essere sbagliato a questo punto.
 */
export function verificaPoolNonVuoto(pool: Pool, formato: Formato): void {
  if (pool.carte.length > 0) return;

  throw new Error(
    `Il criterio «${formato.criterio.regola}» non ha ammesso nessuna delle carte ` +
      `lette: il pool non viene toccato. Le stampe c'erano — quante lo dice la ` +
      `riga qui sopra — e nessuna ha passato la regola. Da guardare sono le ` +
      `edizioni ammesse e il criterio nel documento di formato.`,
  );
}

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
 * La stampa che descrive la carta: la **prima lingua che l'edizione dichiara**
 * e che esista davvero, e la più economica dentro quella.
 *
 * L'ordine non è scritto qui. Sta nel campo `lingue` di ogni edizione del
 * documento, dove è insieme l'elenco delle copie ammesse e la preferenza con
 * cui si mostrano: `["it", "en"]` dice «queste due si giocano, e fra le stampe
 * che esistono mostra l'italiana». Cambiare quella riga cambia quale cartoncino
 * l'app indica, e non chiede un commit di codice — è la promessa di ADR-0004
 * applicata alla lingua.
 *
 * L'ordine è per **lingua** e non per prezzo, ed è la differenza che conta.
 * Prendendo la più economica fra tutte, le 293 carte di Terza del pool vero
 * finirebbero descritte dalla stampa **francese**: la stessa edizione, la
 * stessa figura, e una copia che il destinatario in mano non avrà. Il numero di
 * collezione manderebbe a comprare la cosa sbagliata.
 *
 * Il **prezzo** non si sceglie qui, e da questo è la differenza fra le due
 * funzioni: la copia francese non descrive la carta e la prezza eccome, perché
 * è una copia che il gruppo ammette. Vedi `stampaChePrezza`.
 *
 * Il ripiego finale — la più economica fra **tutte** le stampe, ammesse o no —
 * serve alla carta che in nessuna lingua ammessa è mai stata stampata. Non è un
 * caso che si nasconde: quella carta finisce in `senzaLinguaAmmessa` e la
 * preparazione la dice a voce alta. Descriverla con niente sarebbe togliere una
 * carta dal catalogo per un motivo che il criterio non contempla.
 *
 * ## A pari lingua decide l'edizione da cui viene il prezzo
 *
 * La lingua è il primo criterio e non l'unico, perché non basta a scegliere: una
 * carta ristampata esiste in italiano in due edizioni, l'italiana non ha listino
 * in nessuna delle due, e a quel punto il prezzo — che è il criterio successivo
 * — vale «infinito» per entrambe e non decide. Prima del ticket 30 a decidere
 * arrivava lo spareggio sulla data, nato per rendere ripetibile la scrittura del
 * file e ritrovatosi a scegliere **l'edizione che il giocatore compra**: sempre
 * la più vecchia, che è anche la più rara e la più cara. Erano 326 carte su 753,
 * mostrate in un'edizione e prezzate in un'altra.
 *
 * Fra copie di pari lingua si preferisce allora quella dell'edizione da cui il
 * prezzo viene davvero. Le due stampe tornano a essere la stessa carta nella
 * stessa edizione, e a separarle resta la sola lingua — che è la divergenza che
 * ADR-0006 ha scelto consapevolmente e che l'interfaccia sa già dire.
 *
 * Non è una preferenza fra edizioni e non va confuso con una: viene **dopo** la
 * lingua, quindi non sposta mai una carta su una copia che il gruppo preferisce
 * meno, e non è scritto da nessuna parte quale edizione sia meglio. Dove il
 * prezzo non c'è non ha niente da dire, e la data torna a decidere: allora però
 * non sta scegliendo fra un'edizione cara e una economica, sta solo rendendo
 * ripetibile una scelta che nessun dato sa fare.
 */
function stampaCheDescrive(
  stampe: CartaScryfall[],
  ammesse: CartaScryfall[],
  formato: Formato,
  delPrezzo: CartaScryfall | null,
): CartaScryfall {
  if (ammesse.length === 0) return piuEconomica(stampe);
  const edizioneDelPrezzo = delPrezzo === null ? null : codiceDiEdizione(delPrezzo.set);
  return scegli(
    ammesse,
    (stampa) => rangoDiLingua(stampa, formato),
    (stampa) =>
      edizioneDelPrezzo !== null && codiceDiEdizione(stampa.set) === edizioneDelPrezzo ? 0 : 1,
  );
}

/**
 * La copia da cui prendere la **figura** quando quella che descrive la carta non
 * ne ha una, e `null` quando ce l'ha o quando non c'è niente da cui prenderla.
 *
 * È il costo che ADR-0007 si porta dietro. Da quando l'edizione mostrata segue
 * il prezzo, 246 carte del pool vero si spostano sull'italiana di Quarta, e di
 * quella Scryfall ha per figura un dorso: mostrarla vorrebbe dire lasciare senza
 * illustrazione metà del catalogo, che è metà di quel che una carta di Magic è.
 *
 * Si cerca **solo dentro la stessa edizione e lo stesso numero di collezione**,
 * ed è il confine che rende la cosa onesta invece che comoda: due copie così
 * sono lo stesso cartoncino con un'altra scritta sopra — stessa illustrazione,
 * stesso bordo, stessa cornice. Un'altra edizione sarebbe un'altra figura, e la
 * scheda mostrerebbe una carta diversa da quella che il numero manda a comprare.
 *
 * Quel che resta non detto è la lingua della scritta sulla figura. È la parte
 * imprecisa di questa scelta, ed è dichiarata: la si paga per non lasciare metà
 * del catalogo senza illustrazione, e la preparazione conta quante volte capita.
 */
function figuraDaUnAltraCopia(
  descrive: CartaScryfall,
  ammesse: CartaScryfall[],
  formato: Formato,
): CartaScryfall | null {
  if (haUnaFigura(descrive)) return null;
  const sorelle = ammesse.filter(
    (stampa) =>
      stampa !== descrive &&
      codiceDiEdizione(stampa.set) === codiceDiEdizione(descrive.set) &&
      (stampa.collector_number ?? "") === (descrive.collector_number ?? "") &&
      haUnaFigura(stampa),
  );
  if (sorelle.length === 0) return null;
  // La lingua ordina anche qui: fra due figure buone, quella della copia che il
  // gruppo preferirebbe portare al tavolo è la meno sorprendente da vedere.
  return scegli(sorelle, (stampa) => rangoDiLingua(stampa, formato));
}

/**
 * Se di questa stampa una figura esiste davvero: al livello della carta, o —
 * quando la carta ha due facce e Scryfall gli indirizzi li scrive solo lì — sul
 * davanti.
 *
 * Guarda gli stessi due posti da cui `riduci` la figura poi la prende, e nello
 * stesso ordine. Guardarne uno solo direbbe «senza figura» di ogni carta a due
 * facce, e manderebbe a chiedere in prestito una figura a chi ce l'ha già.
 */
function haUnaFigura(stampa: CartaScryfall): boolean {
  if (leggiImmagine(stampa.image_uris, stampa.image_status) !== null) return true;
  const davanti = (stampa.card_faces ?? [])[0];
  return davanti !== undefined && leggiImmagine(davanti.image_uris, stampa.image_status) !== null;
}

/**
 * La stampa che **prezza** la carta: la copia ammessa più economica che un
 * prezzo in euro ce l'abbia davvero. `null` quando non ce n'è nessuna.
 *
 * Qui non si sceglie cosa mostrare — quello lo fa `stampaCheDescrive`, e la
 * lingua è la sua prima domanda — si cerca il **pavimento più basso fra le
 * copie legali**. Per questo la **preferenza** di lingua non entra: le stampe
 * che arrivano qui sono già state setacciate da `stampeAmmesse`, che ha tolto
 * le edizioni fuori formato e le lingue che quelle edizioni non ammettono. Fra
 * copie tutte giocabili la più economica è la più economica, in qualunque
 * lingua sia stampata.
 *
 * È la mossa che tiene in piedi il tetto di spesa da quando le stampe mostrate
 * sono italiane: su Cardmarket **nessuna** stampa italiana di queste quattro
 * edizioni ha un listino, e senza sdoppiamento il pool uscirebbe senza un
 * prezzo. Nel pool vero sono 748 carte su 753 a essere prezzate da una copia
 * diversa da quella che le descrive — quasi sempre la stampa inglese della
 * stessa edizione, e per le 49 di Terza la francese.
 *
 * Il prezzo si porta dietro **da quale copia viene** (`Prezzo.stampa`), perché
 * da qui in poi non lo si deduce più da quella che descrive la carta.
 */
function stampaChePrezza(ammesse: CartaScryfall[]): CartaScryfall | null {
  const conListino = ammesse.filter((stampa) => prezzoInEuro(stampa) !== null);
  return conListino.length === 0 ? null : piuEconomica(conListino);
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
 * La scelta fra le stampe di una carta: prima i `ranghi` che chi chiama dà a
 * ciascuna, nell'ordine in cui li passa — è lì che entrano la preferenza di
 * lingua e l'edizione da cui viene il prezzo — poi il prezzo, poi la stampa più
 * vecchia, poi l'identificativo.
 *
 * I ranghi sono più d'uno perché sono **criteri**, e vanno letti in fila: il
 * secondo parla solo dove il primo ha lasciato un pari merito. Impacchettarli in
 * un numero solo — moltiplicare il primo e sommarci il secondo — darebbe la
 * stessa risposta e la darebbe per aritmetica, cioè in un modo che chi rilegge
 * deve decifrare invece che leggere.
 *
 * Le ultime tre servono solo a far sì che la scelta sia **sempre la stessa**:
 * il pool finisce in git, e due preparazioni sugli stessi dati devono scrivere
 * lo stesso file. Sono l'ultima parola e non la prima: quando a decidere arriva
 * la data, vuol dire che nessun criterio dichiarato aveva niente da dire.
 */
function scegli(
  stampe: CartaScryfall[],
  ...ranghi: ((stampa: CartaScryfall) => number)[]
): CartaScryfall {
  const ordinate = [...stampe].sort((a, b) => {
    for (const rango of ranghi) {
      const rangoA = rango(a);
      const rangoB = rango(b);
      if (rangoA !== rangoB) return rangoA - rangoB;
    }
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

/**
 * La più economica fra le stampe date, senza preferenze di lingua: è `scegli`
 * senza nessun criterio davanti al prezzo.
 */
function piuEconomica(stampe: CartaScryfall[]): CartaScryfall {
  return scegli(stampe);
}

/**
 * Il prezzo come lo legge l'app: l'euro, la data dei dati, e la copia da cui
 * viene.
 *
 * Senza stampa che prezzi, `euro` e `stampa` sono `null` **insieme**: una
 * provenienza scritta accanto a un euro che non c'è direbbe di che copia è un
 * prezzo che nessuno ha.
 */
function prezzoDi(stampa: CartaScryfall | null, aggiornatoIl: string): Prezzo {
  if (stampa === null) return { euro: null, aggiornatoIl, stampa: null };
  return {
    euro: prezzoInEuro(stampa),
    aggiornatoIl,
    stampa: quale(stampa),
  };
}

/** Una stampa grezza ridotta a come la si cerca al negozio. */
function quale(grezza: CartaScryfall): Stampa {
  return {
    edizione: codiceDiEdizione(grezza.set),
    numeroDiCollezione: grezza.collector_number ?? "",
    lingua: grezza.lang ?? "",
  };
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
  /**
   * La stampa da cui viene il prezzo, che non è detto sia quella che descrive.
   * `null` quando nessuna copia ammessa ha un listino.
   */
  stampaDelPrezzo: CartaScryfall | null;
  /**
   * La copia da cui prendere la **figura**, quando quella che descrive la carta
   * ha per illustrazione un segnaposto. È sempre della stessa edizione e dello
   * stesso numero di collezione; `null` nel caso normale.
   */
  stampaDellaFigura: CartaScryfall | null;
  nomeItaliano: string | null;
  aggiornatoIl: string;
  tag: IndiceTag | undefined;
}): Carta {
  const grezza = quale.stampa;
  // Tutto viene dalla stampa che descrive, tranne la **figura**: quella può
  // arrivare da un'altra copia della stessa edizione quando la mostrata ha per
  // illustrazione un dorso (ADR-0007). Nel caso normale le due sono la stessa,
  // e questa riga non cambia niente.
  const figura = quale.stampaDellaFigura ?? grezza;
  const facceDellaFigura = figura.card_faces ?? [];
  // Lo stato dell'immagine è della **stampa** e non della faccia: Scryfall lo
  // dichiara una volta sola. Passarlo alle facce è quel che tiene chiusa la
  // porta di servizio — senza, una stampa dichiarata segnaposto perdeva
  // l'immagine al livello della carta e se la riprendeva dal davanti, che è la
  // stessa figura con lo stesso indirizzo.
  const facce = (grezza.card_faces ?? []).map((faccia, indice) => {
    // La faccia che nella copia in prestito non esiste torna alla propria, e
    // torna col **proprio** stato: stato e indirizzi dicono insieme se una
    // figura esiste, e passare i propri indirizzi — che puntano al dorso, ed è
    // il motivo per cui si stava chiedendo in prestito — col permesso della
    // copia buona rimetterebbe in circolo proprio quel dorso.
    const dellaFigura = facceDellaFigura[indice];
    return dellaFigura === undefined
      ? riduciFaccia(faccia, faccia, grezza.image_status)
      : riduciFaccia(faccia, dellaFigura, figura.image_status);
  });
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
    leggiImmagine(figura.image_uris, figura.image_status) ?? davanti?.immagine ?? null;

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
    prezzo: prezzoDi(quale.stampaDelPrezzo, quale.aggiornatoIl),
    tag: [],
    // I tag della comunità arrivano già pronti dall'indice: qui non si deduce
    // nulla, si aggancia e basta. L'assenza è uno stato legittimo. La copia
    // serve a non consegnare alla carta un elenco che appartiene all'indice.
    tagScryfall: [...(quale.tag?.perCarta.get(grezza.oracle_id ?? "") ?? [])],
    facce: facce.length > 0 ? facce : null,
    terra: tipi.includes("Land") ? leggiTerra(grezza, testo) : null,
    // Il tetto di copie si cuoce qui, una volta per carta, e da qui in poi è un
    // dato come il costo di mana: chi costruisce lo legge e non lo ricalcola.
    // Qui è la **regola del gioco** e vive dove viveva (`mazzo/copie.ts`). Il
    // formato ha l'ultima parola — una limitata sta a una copia anche se il suo
    // testo si concedesse il permesso — ma quella parola la scrive l'app sopra
    // il pool, leggendo il documento (ADR-0008).
    tettoDiCopie: leggiTettoDiCopie(testo, tipi),
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

function riduciFaccia(
  grezza: FacciaScryfall,
  dellaFigura: FacciaScryfall,
  statoDellaStampa: string | undefined,
): Faccia {
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
    // della stampa, e vale per tutte. Gli indirizzi vengono dalla copia da cui
    // arriva la figura, che nel caso normale è questa stessa faccia.
    immagine: leggiImmagine(dellaFigura.image_uris, statoDellaStampa),
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
 * Cosa è cambiato dal pool precedente: le carte **entrate** e quelle **uscite**
 * — che adesso escono solo perché è cambiato il criterio o l'archivio — e, a
 * parte, le **bandite**: nel pool ci sono, ma il catalogo non le mostrerà
 * (ADR-0008). È la distinzione che il manutentore guarda prima di pubblicare
 * (storia 30).
 */
export function confrontaPool(precedente: Pool | null, nuova: Preparazione): Diario {
  const prima = new Set((precedente?.carte ?? []).map((c) => c.nome));
  const adesso = new Set(nuova.pool.carte.map((c) => c.nome));

  return {
    primaVolta: precedente === null,
    entrate: [...adesso].filter((nome) => !prima.has(nome)).sort(confrontaTesti),
    uscite: [...prima].filter((nome) => !adesso.has(nome)).sort(confrontaTesti),
    bandite: [...nuova.bandite].sort(confrontaTesti),
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
    prezzoDaUnAltroCartoncino: pool.carte.filter(
      (carta) =>
        carta.prezzo.stampa !== null &&
        (carta.prezzo.stampa.edizione !== carta.edizione ||
          carta.prezzo.stampa.numeroDiCollezione !== carta.numeroDiCollezione),
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
        `${diario.uscite.length} uscite. ` +
        `Nel pool ${diario.bandite.length} bandite, che l'app terrà fuori dal catalogo.`,
  ];

  for (const [titolo, nomi] of [
    ["entrate", diario.entrate],
    ["uscite", diario.uscite],
    ["bandite, nel pool ma fuori dal catalogo", diario.bandite],
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
    `(di cui ${buchi.senzaTag} senza nemmeno un tag).\n` +
    `  ${buchi.prezzoDaUnAltroCartoncino} si mostrano su un cartoncino e si comprano al prezzo ` +
    `di un altro — altra edizione, o altro numero di collezione: erano 326 su 753 prima ` +
    `che l'edizione mostrata seguisse il prezzo (ADR-0007), e crescere di nuovo vorrebbe ` +
    `dire che quella scelta ha smesso di reggere.`
  );
}

/**
 * Le figure prese in prestito, dette a schermo: quante carte mostrano
 * l'illustrazione di un'altra copia della stessa edizione perché la stampa che
 * le descrive, per figura, ha un dorso (ADR-0007).
 *
 * Si dice sempre, anche a zero, perché è il prezzo di una decisione e non un
 * guasto: chi legge il comando deve poterlo confrontare con la volta prima.
 */
export function raccontaFigure(quante: number, totale: number): string {
  return (
    `Di quelle con una figura, ${quante} la prendono in prestito da un'altra copia ` +
    `della stessa edizione e dello stesso numero: stessa illustrazione, la scritta ` +
    `in un'altra lingua. Su ${totale} carte del pool.`
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
 * Le carte che nessuna copia ammessa descrive, raccontate al manutentore.
 *
 * Non è un guasto della preparazione e non ferma niente: è la clausola «si
 * riaprirebbe se» di ADR-0006 che scatta. Quell'ADR ha **misurato** che le
 * stampe straniere delle edizioni di questo formato sono complete, ed è su
 * quel numero che poggia la decisione di non fare della lingua un criterio. Se
 * questo elenco stampasse qualcosa, il numero sarebbe cambiato, e la decisione
 * andrebbe rifatta invece che aggirata.
 */
export function raccontaLingue(nomi: string[]): string {
  if (nomi.length === 0) return "";
  return (
    (nomi.length === 1
      ? `Nel pool c'è una carta che di una copia in una lingua ammessa non ne ha nessuna:\n`
      : `Nel pool ci sono ${nomi.length} carte che di una copia in una lingua ammessa ` +
        `non ne hanno nessuna:\n`) +
    nomi.map((nome) => `    ${nome}`).join("\n") +
    `\n  Entrano lo stesso, perché la lingua non è un criterio e non toglie nomi. Ma ` +
    `ADR-0006 dava questo caso per impossibile: se è qui, la decisione va rifatta.`
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
