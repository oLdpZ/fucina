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
 */

import { interpretaIdentita, type IdentitaDiFormato } from "../dati/ambito.js";
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
 * a metà, o se è un mazzo di un'app più nuova della sua.
 */
export function leggiScambio(testo: string): ContenutoMazzo {
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

  // La riga che dichiara quante carte ci sono è la difesa contro il testo
  // tagliato: senza, un elenco a metà passerebbe per intero. Se manca, manca
  // per un motivo — qualcuno ha maltrattato il testo — e non ci si fida.
  if (copieDichiarate === null || diverseDichiarate === null) {
    throw new Error("Il testo del mazzo non dice quante carte contiene: è stato maltrattato.");
  }
  const copie = carte.reduce((somma, voce) => somma + voce.copie, 0);
  if (carte.length > 0 && (copie !== copieDichiarate || carte.length !== diverseDichiarate)) {
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
    formato: leggiFormato(voci),
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
  if (terre === TERRE_DALLA_CURVA) return { origine: "a-mano", terreVolute: null };
  const aMano = terre.match(TERRE_A_MANO);
  if (!aMano) {
    throw new Error(`Le terre di questo mazzo non si capiscono: «${terre}».`);
  }
  return { origine: "a-mano", terreVolute: Number(aMano[1]) };
}

/**
 * Il formato di gioco, dalle due righe che lo dichiarano.
 *
 * Assenti tutte e due, è un mazzo scritto prima che l'app dichiarasse il
 * formato: si legge lo stesso. Presente una sola, il testo è stato maltrattato
 * o scritto a mano, e `interpretaIdentita` lo dice invece di indovinare.
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
