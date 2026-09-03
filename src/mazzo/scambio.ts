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
 */

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
 * La lista da consegnare all'arbitro: copie e nomi inglesi, in ordine, e basta.
 *
 * Le terre in fondo, come si scrive una lista a mano. Nessuna intestazione:
 * ogni sito e ogni foglio ne vuole una diversa, e una riga in più da cancellare
 * è peggio di una riga in meno da aggiungere.
 */
export function listaDaTorneo(
  carte: readonly VoceSalvata[],
  terre: readonly VoceSalvata[],
): string {
  return [...ordinate(carte), ...ordinate(terre)]
    .map((voce) => `${voce.copie} ${voce.nome}`)
    .join("\n");
}

function ordinate(voci: readonly VoceSalvata[]): VoceSalvata[] {
  return [...voci].sort((a, b) => a.nome.localeCompare(b.nome, "en"));
}
