/**
 * Il mazzo che esce dall'app e ci rientra (ticket 07).
 *
 * Due formati, per due usi diversi, e non uno solo che provi a fare entrambi:
 *
 * 1. Il **testo da scambiare**: si legge a occhio, si incolla in un messaggio,
 *    e contiene sia la lista sia la richiesta che l'ha prodotta. È il formato
 *    che l'app rilegge quando l'amico lo importa.
 * 2. La **lista da torneo**: solo copie e nomi inglesi, niente altro, perché è
 *    il foglio che si consegna all'arbitro (Q23, Q24).
 *
 * Il testo da scambiare viaggia per messaggi e programmi di posta, che lo
 * tagliano, lo indentano e gli aggiungono righe vuote. Perciò: righe vuote e
 * spazi ai bordi si ignorano, e il testo **dichiara quante carte contiene** e
 * finisce con una riga di chiusura, così un testo troncato si riconosce come
 * troncato invece di importare mezzo mazzo in silenzio.
 *
 * Il numero di formato in intestazione serve al giorno in cui la richiesta
 * conterrà il tema e il seme del motore: un'app vecchia deve poter dire «questo
 * mazzo viene da una versione più recente» invece di leggerlo male.
 *
 * Da non confondere con il **formato di gioco**, che il testo adesso dichiara e
 * che è tutt'altra cosa: uno dice come è scritto il testo, l'altro a quale gioco
 * appartiene il mazzo. Il primo non cresce per il secondo — due righe in più che
 * un'app vecchia semplicemente non guarda non le impediscono di leggere la
 * lista, e alzare il numero le farebbe rifiutare mazzi che sa leggere benissimo.
 *
 * Il formato di gioco però **si confronta** (ticket 10): un testo di un altro
 * gioco — o uno che non dice di quale, scritto prima che l'app lo dichiarasse —
 * si rifiuta con la sua ragione, dalla stessa porta da cui passa la richiesta
 * che non si riconosce. Le sue carte qui non esistono, e importarlo metterebbe
 * nell'elenco un mazzo che non si apre.
 *
 * ## Il tema e il tetto (ticket 31)
 *
 * Il mazzo salvato porta il tema e il tetto sotto cui le sue terre sono state
 * scelte, e questo testo porta **gli stessi campi**: senza, un mazzo esportato e
 * reimportato li perderebbe per strada, cioè si riaprirebbe con le terre di
 * qualcun altro — il guasto del ticket 31 spostato di una porta.
 *
 * Il numero di formato **non cresce** nemmeno per loro, per la stessa ragione di
 * un momento fa: un'app vecchia che non guarda quelle righe legge comunque la
 * lista intera, e alzare il numero la farebbe rifiutare in blocco un mazzo che
 * sa leggere. Perde il tema, com'era prima di questo ticket — che è meno di
 * quel che perderebbe rifiutando tutto.
 *
 * Il tetto sta in una riga che si legge a occhio. Il tema **no**: è un oggetto
 * con dentro sei filtri, una carta-seme e gli allargamenti accettati, e non c'è
 * modo di renderlo in prosa senza scriverne un secondo lettore da tenere in
 * passo col primo — dove il prezzo di un passo mancato è una base di terre
 * sbagliata in silenzio, cioè esattamente il guasto che si sta chiudendo. Va
 * quindi in una riga sola di JSON, che si vede e si può cancellare a mano. Se
 * arriva rotta ci si ferma **dicendolo**, e dicendo che togliendo quella riga la
 * lista si importa lo stesso: un tema letto a metà è peggio di nessun tema.
 */

import { interpretaIdentita, stessoFormato, type IdentitaDiFormato } from "../dati/ambito.js";
import { frasePerUnMazzoDiUnAltroFormato } from "../spiegazioni/frasi.js";
import { interpretaTema } from "../tema/interpreta.js";
import { temaDichiarato, type Tema } from "../tema/tema.js";
import {
  interpretaContenuto,
  type ContenutoMazzo,
  type Richiesta,
  type VoceSalvata,
} from "./salvato.js";

/** La versione del formato di scambio. Cresce quando cresce la richiesta. */
const FORMATO = 1;

const INTESTAZIONE = `Mazzi fuori meta — mazzo da scambiare (formato ${FORMATO})`;
const CHIUSURA = "Fine del mazzo.";
const RICHIESTA_A_MANO = "costruito a mano dal catalogo";
/**
 * Le due righe del formato di gioco, e sono due apposta.
 *
 * Il **nome** è per chi legge il testo, l'**impronta** per l'app che lo rilegge:
 * scritti su una riga sola — il nome, e la sigla fra parentesi — un nome di
 * formato con una parentesi dentro li rimescolerebbe, e a rimescolarli si
 * scambia il gioco di un mazzo per un altro.
 */
const RIGA_FORMATO = "Formato";
const RIGA_IMPRONTA = "Impronta del formato";
const TERRE_DALLA_CURVA = "decise dalla curva del mazzo";
/**
 * L'unità sta nel **nome** della riga e non accanto al numero: il numero lo
 * rilegge una macchina, e «30,00 €» a virgola italiana contro «30.00» a punto
 * inglese è un modo per far cambiare tetto a un mazzo passando una frontiera.
 */
const RIGA_TETTO = "Tetto di spesa in euro";
const RIGA_TEMA = "Tema";

/** Il mazzo come testo: la lista, la richiesta, e di che dati era fatto. */
export function scriviScambio(mazzo: ContenutoMazzo): string {
  const copie = mazzo.carte.reduce((somma, voce) => somma + voce.copie, 0);
  return [
    INTESTAZIONE,
    "",
    `Nome: ${mazzo.nome}`,
    `Salvato il: ${mazzo.salvatoIl}`,
    `Carte del: ${mazzo.datiDel}`,
    // Il mazzo di un altro gioco non è un mazzo rotto: è un mazzo che qui non
    // si può giocare, ed è una cosa che chi lo riceve deve poter leggere invece
    // di scoprirla carta per carta.
    ...(mazzo.formato === undefined
      ? []
      : [
          `${RIGA_FORMATO}: ${mazzo.formato.nome}`,
          `${RIGA_IMPRONTA}: ${mazzo.formato.impronta}`,
        ]),
    `Richiesta: ${RICHIESTA_A_MANO}`,
    `Terre: ${
      mazzo.richiesta.terreVolute === null
        ? TERRE_DALLA_CURVA
        : `${mazzo.richiesta.terreVolute} scelte a mano`
    }`,
    // Sotto quali vincoli le terre di questo mazzo sono state scelte. Righe che
    // ci sono solo quando c'è qualcosa da dire: un mazzo messo insieme a mano
    // senza tema e senza tetto non deve dichiarare due assenze.
    ...(mazzo.richiesta.tetto === undefined ? [] : [`${RIGA_TETTO}: ${mazzo.richiesta.tetto}`]),
    ...(mazzo.richiesta.tema === undefined
      ? []
      : [`${RIGA_TEMA}: ${JSON.stringify(mazzo.richiesta.tema)}`]),
    "",
    `Carte (${copie} copie, ${mazzo.carte.length} diverse):`,
    ...mazzo.carte.map((voce) => `${voce.copie} ${voce.nome}`),
    "",
    CHIUSURA,
  ].join("\n");
}

const RIGA_CARTA = /^(\d+)\s+(.+)$/u;
const RIGA_CONTA = /^Carte \((\d+) copie, (\d+) diverse\):$/u;
const RIGA_VOCE = /^([^:]+):\s*(.*)$/u;
const RIGA_INTESTAZIONE = /^Mazzi fuori meta\b.*\(formato (\d+)\)$/u;
const TERRE_A_MANO = /^(\d+) scelte a mano$/u;

/**
 * Il mazzo ricostruito dal testo, o un errore che dice **che cosa** non va.
 *
 * Ogni messaggio è una frase che si può leggere all'utente così com'è: chi
 * incolla un testo sbagliato deve capire se è il testo sbagliato, se è tagliato
 * a metà, se è un mazzo di un'app più nuova della sua, o se è un mazzo di un
 * altro gioco.
 *
 * `corrente` è il formato che l'app gioca adesso. Non è facoltativo: un lettore
 * che si potesse chiamare senza lascerebbe entrare in silenzio proprio i mazzi
 * che il ticket 10 esiste per fermare.
 */
export function leggiScambio(testo: string, corrente: IdentitaDiFormato): ContenutoMazzo {
  const righe = testo
    .split(/\r?\n/u)
    .map((riga) => riga.trim())
    .filter((riga) => riga !== "");

  const intestazione = righe[0]?.match(RIGA_INTESTAZIONE);
  if (righe.length === 0 || !intestazione) {
    throw new Error("Questo testo non è un mazzo esportato da quest’app.");
  }
  if (Number(intestazione[1]) > FORMATO) {
    throw new Error(
      "Questo mazzo viene da una versione più recente dell’app: aggiornala e riprova.",
    );
  }
  if (righe[righe.length - 1] !== CHIUSURA) {
    throw new Error(`Il testo del mazzo è troncato: manca la riga finale «${CHIUSURA}».`);
  }

  const voci = new Map<string, string>();
  const carte: VoceSalvata[] = [];
  let copieDichiarate: number | null = null;
  let diverseDichiarate: number | null = null;

  for (const riga of righe.slice(1, -1)) {
    const conta = riga.match(RIGA_CONTA);
    if (conta) {
      copieDichiarate = Number(conta[1]);
      diverseDichiarate = Number(conta[2]);
      continue;
    }
    const carta = riga.match(RIGA_CARTA);
    if (carta) {
      carte.push({ copie: Number(carta[1]), nome: (carta[2] as string).trim() });
      continue;
    }
    const voce = riga.match(RIGA_VOCE);
    // Una riga che non è nessuna di queste tre è una riga aggiunta per strada —
    // una firma, un «> » di citazione — e non è una ragione per rifiutare tutto.
    if (voce) voci.set((voce[1] as string).trim(), (voce[2] as string).trim());
  }

  // Di che gioco è, **prima** di tutto quel che il gioco decide: un testo di un
  // altro formato può avere un tema scritto con filtri che qui non esistono, e
  // la ragione vera — non è di questo gioco — non deve restare coperta da una
  // ragione di dettaglio. Prima però deve essere un testo intero: da un testo
  // tagliato non si sa nemmeno di che formato sia, e quello si dice sopra.
  const formato = leggiFormato(voci);
  if (!stessoFormato(formato, corrente)) {
    throw new Error(
      frasePerUnMazzoDiUnAltroFormato({ delMazzo: formato, corrente, dove: "da-importare" }),
    );
  }

  // La riga che dichiara quante carte ci sono è la difesa contro il testo
  // tagliato: senza, un elenco a metà passerebbe per intero. Se manca, manca
  // per un motivo — qualcuno ha maltrattato il testo — e non ci si fida.
  if (copieDichiarate === null || diverseDichiarate === null) {
    throw new Error("Il testo del mazzo non dice quante carte contiene: è stato maltrattato.");
  }
  const copie = carte.reduce((somma, voce) => somma + voce.copie, 0);
  // Nessuna carta **non** è un caso da lasciare fuori di qui: è il troncamento
  // peggiore che ci sia — via il blocco delle carte, rimasta l'intestazione che
  // dice quante ce n'erano — e chi lo incolla deve sentirsi dire che il testo è
  // tagliato, che gli dice anche che cosa fare: farselo rimandare intero. Detto
  // «questo mazzo non contiene carte» suonerebbe come un mazzo scritto male.
  // Un testo che dichiara zero copie di zero carte diverse, invece, va
  // d'accordo con sé stesso: lì non manca niente per strada, il conto torna, e
  // a dire che quel mazzo è vuoto ci pensa `interpretaContenuto` più sotto.
  if (copie !== copieDichiarate || carte.length !== diverseDichiarate) {
    // Ne mancano: tagliato. Ce ne sono di più: incollato due volte, che capita
    // di continuo. Sono due guai diversi e vanno detti come due guai diversi.
    const troppe = copie > copieDichiarate || carte.length > diverseDichiarate;
    throw new Error(
      `Il testo del mazzo non torna: dichiara ${copieDichiarate} copie di ` +
        `${diverseDichiarate} carte diverse, e ne contiene ${copie} di ${carte.length}. ` +
        (troppe ? "Forse è stato incollato due volte." : "Forse è tagliato a metà."),
    );
  }

  return interpretaContenuto({
    nome: voci.get("Nome"),
    salvatoIl: voci.get("Salvato il"),
    datiDel: voci.get("Carte del"),
    richiesta: leggiRichiesta(voci),
    formato,
    carte,
  });
}

/** La richiesta, dalle due righe che la raccontano. */
function leggiRichiesta(voci: ReadonlyMap<string, string>): Richiesta | undefined {
  const origine = voci.get("Richiesta");
  if (origine === undefined) return undefined;
  if (origine !== RICHIESTA_A_MANO) {
    throw new Error(
      "La richiesta di questo mazzo non si riconosce: forse viene da una versione più recente dell’app.",
    );
  }

  const terre = voci.get("Terre") ?? TERRE_DALLA_CURVA;
  const terreVolute = terre === TERRE_DALLA_CURVA ? null : leggiTerreAMano(terre);

  // I due campi facoltativi si scrivono solo se ci sono: assenti valgono
  // assenti, e `exactOptionalPropertyTypes` distingue le due cose. Un mazzo che
  // dicesse «tema: nessuno» direbbe qualcosa che nessuno ha mai scritto.
  const tetto = leggiTetto(voci.get(RIGA_TETTO));
  const tema = leggiTema(voci.get(RIGA_TEMA));
  return {
    origine: "a-mano",
    terreVolute,
    ...(tema === undefined ? {} : { tema }),
    ...(tetto === undefined ? {} : { tetto }),
  };
}

function leggiTerreAMano(terre: string): number {
  const aMano = terre.match(TERRE_A_MANO);
  if (!aMano) {
    throw new Error(`Le terre di questo mazzo non si capiscono: «${terre}».`);
  }
  return Number(aMano[1]);
}

/**
 * Il tetto di spesa, dalla riga che lo dichiara.
 *
 * Assente è un mazzo che nessun tetto ha prodotto — o un testo scritto prima
 * che l'app lo scrivesse — e si legge lo stesso. Presente e non una cifra, no:
 * prenderlo per «nessun tetto» rimetterebbe nella base proprio le terre che quel
 * tetto aveva lasciato fuori, ed è il genere di silenzio che il ticket 31 toglie
 * di mezzo.
 */
function leggiTetto(riga: string | undefined): number | undefined {
  if (riga === undefined) return undefined;
  const tetto = Number(riga);
  if (riga.trim() === "" || !Number.isFinite(tetto) || tetto < 0) {
    throw new Error(
      `Il tetto di spesa di questo mazzo non è una cifra da spendere: «${riga}». ` +
        `Togli la riga «${RIGA_TETTO}» per importare la lista senza tetto.`,
    );
  }
  return tetto;
}

/**
 * Il tema, dalla riga di JSON che lo porta.
 *
 * Due guai diversi e due frasi diverse: la riga **non si legge** — tagliata o
 * mandata a capo da un programma di posta — oppure si legge e non è un tema, e
 * lo dice `interpretaTema` con la sua ragione. In tutti e due i casi ci si
 * ferma: un tema letto a metà rifà in silenzio una base di terre che nessuno ha
 * chiesto, che è il guasto per cui questo campo esiste. E in tutti e due i casi
 * si dice come importare comunque la lista, perché la lista è intera.
 */
function leggiTema(riga: string | undefined): Tema | undefined {
  if (riga === undefined) return undefined;

  let letto: unknown;
  try {
    letto = JSON.parse(riga);
  } catch {
    throw new Error(
      `Il tema di questo mazzo è arrivato a pezzi: la riga «${RIGA_TEMA}» non si legge, ` +
        "forse è stata mandata a capo per strada. Togli quella riga per importare la lista " +
        "senza il tema con cui il mazzo era stato costruito.",
    );
  }

  const tema = interpretaTema(letto);
  // Un tema che non dichiara niente non è un tema, e l'app non ne scrive mai
  // uno: se la riga c'è e non contiene un tema, il testo è stato messo insieme
  // a mano o maltrattato, e leggerlo come «nessun vincolo» sarebbe il guasto
  // del ticket 31 rientrato dalla porta di servizio — le terre rifatte in
  // silenzio col tema di chi importa. Ci si ferma, come per la riga illeggibile.
  if (tema === undefined || !temaDichiarato(tema)) {
    throw new Error(
      `La riga «${RIGA_TEMA}» di questo mazzo non contiene un tema. ` +
        "Toglila per importare la lista senza il tema con cui il mazzo era stato costruito.",
    );
  }
  return tema;
}

/**
 * Il formato di gioco, dalle due righe che lo dichiarano.
 *
 * Assenti tutte e due, è un mazzo scritto prima che l'app dichiarasse il
 * formato: si legge come «non si sa», e chi legge lo rifiuta con quella
 * ragione. Presente una sola, il testo è stato maltrattato o scritto a mano, e
 * `interpretaIdentita` lo dice invece di indovinare.
 */
function leggiFormato(voci: ReadonlyMap<string, string>): IdentitaDiFormato | undefined {
  const nome = voci.get(RIGA_FORMATO);
  const impronta = voci.get(RIGA_IMPRONTA);
  if (nome === undefined && impronta === undefined) return undefined;
  return interpretaIdentita({ nome, impronta });
}

/**
 * La lista da consegnare all'arbitro: copie e nomi inglesi, in ordine, e basta.
 *
 * Le terre in fondo, come si scrive una lista a mano.
 *
 * Una riga sola di intestazione, quando il formato si conosce: **quale gioco**
 * è la prima cosa che un arbitro guarda su una lista, ed è anche la sola che la
 * lista da sé non direbbe. Prima non ce n'era nessuna, ed era giusto finché
 * l'app costruiva mazzi di un formato che tutti danno per scontato; adesso ne
 * gioca uno che ogni gruppo scrive a modo proprio, e tacerlo costa più di una
 * riga da cancellare.
 *
 * Il formato resta un argomento e non un dato interno per la ragione di sempre:
 * questa funzione non conosce il gioco, glielo si dice. Chi la chiama senza
 * ottiene la lista nuda — che è la stessa di prima, riga per riga.
 */
export function listaDaTorneo(
  carte: readonly VoceSalvata[],
  terre: readonly VoceSalvata[],
  formato?: IdentitaDiFormato,
): string {
  const righe = [...ordinate(carte), ...ordinate(terre)].map(
    (voce) => `${voce.copie} ${voce.nome}`,
  );
  if (formato === undefined) return righe.join("\n");
  return [`${RIGA_FORMATO}: ${formato.nome}`, "", ...righe].join("\n");
}

function ordinate(voci: readonly VoceSalvata[]): VoceSalvata[] {
  return [...voci].sort((a, b) => a.nome.localeCompare(b.nome, "en"));
}
