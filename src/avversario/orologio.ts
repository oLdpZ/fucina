/**
 * **L'orologio: un mazzo avversario ridotto a pochi numeri.**
 *
 * L'app non conosce **nessuna carta** dell'avversario e non la vuole conoscere.
 * Il perché sta in [ADR-0002](../../docs/adr/0002-avversario-come-orologio-motore-di-regole-rimandato.md):
 * far giocare due mazzi uno contro l'altro vorrebbe dire un motore di regole, e
 * un motore di regole non esiste in questo linguaggio, costerebbe anni, e
 * misurerebbe come gioca un'IA invece di come gioca una persona.
 *
 * Quel che resta è una **caricatura**: tre numeri scritti a mano da chi il
 * venerdì quei mazzi li incontra. È poco, ed è vero — e l'app deve dire che è
 * una caricatura ogni volta che ne mostra un esito, perché un numero che sembra
 * un tasso di vittoria senza esserlo sarebbe la bugia peggiore che possa dire.
 *
 * Gli orologi li scrive **l'utente**: il meta del suo negozio non è il meta di
 * internet, e quella conoscenza è più precisa di qualunque file compilato. Il
 * file del manutentore serve a una cosa sola — che la prima schermata non sia
 * vuota — e si butta appena l'utente scrive i suoi.
 */

/**
 * Un mazzo del meta come l'app lo conosce: un nome, un perché, e tre numeri.
 *
 * I tre numeri sono entrati **uno alla volta**, ed è la disciplina che ADR-0002
 * impone: ognuno resta solo se, misurato sui mazzi veri, cambia la loro
 * classifica. Alla sosta si guarda quale dei tre l'ha cambiata davvero, e gli
 * altri si tolgono invece di restare lì a fare volume.
 */
export type Orologio = {
  /** Come lo chiama chi lo incontra: «mono rosso», «il mazzo di Marco». */
  nome: string;
  /**
   * Perché sta in questo elenco. Non lo legge il motore: lo legge chi riapre il
   * file fra sei mesi e non si ricorda perché ci aveva messo dentro un mazzo.
   */
  perche: string;
  /**
   * Il turno in cui quel mazzo chiude la partita, di solito. È il numero che
   * conta di più: la corsa è prima di tutto una domanda sul tempo.
   */
  turnoDiChiusura: number;
  /** Quante **copie** di rimozione porta: non nomi di carta, copie. */
  rimozioni: number;
  /** Quante **copie** di contromagia porta. */
  contromagie: number;
};

/**
 * Quanti orologi si possono dichiarare. Non è una regola del gioco: è che oltre
 * una manciata nessuno li tiene aggiornati, e un elenco che invecchia dice il
 * falso con più sicurezza di uno corto.
 */
export const OROLOGI_MASSIMI = 12;

/** Oltre questo turno un mazzo non «chiude»: in negozio si va a orologio. */
export const TURNO_DI_CHIUSURA_MASSIMO = 20;

/** Oltre sessanta copie di una cosa sola un mazzo non ci sta. */
const COPIE_MASSIME_IN_UN_MAZZO = 60;

/**
 * Controlla che quel che si è letto sia davvero un elenco di orologi, e lo
 * consegna tipato.
 *
 * Come per il documento di formato, ogni rifiuto dice **quale campo** e **quale
 * voce**: chi legge il messaggio ha il file aperto davanti, e «elenco non
 * valido» non gli dice quale riga guardare.
 *
 * I numeri si controllano anche nel merito e non solo nel tipo. Un turno di
 * chiusura negativo, o duecento rimozioni, non sono un mazzo che qualcuno
 * incontra: sono un refuso, e passarli vorrebbe dire far entrare nel punteggio
 * una corsa contro un avversario che non esiste.
 */
export function interpretaOrologi(dati: unknown): Orologio[] {
  if (!Array.isArray(dati)) {
    throw new Error("Gli orologi devono essere un elenco.");
  }
  if (dati.length > OROLOGI_MASSIMI) {
    throw new Error(
      `Gli orologi sono ${dati.length}, e se ne tengono al massimo ${OROLOGI_MASSIMI}: un elenco più lungo nessuno lo aggiorna, e uno che invecchia dice il falso.`,
    );
  }
  const letti = dati.map((voce, indice) => interpretaOrologio(voce, indice));

  const nomi = new Set<string>();
  for (const orologio of letti) {
    const chiave = orologio.nome.toLowerCase();
    if (nomi.has(chiave)) {
      throw new Error(
        `Due orologi si chiamano «${orologio.nome}»: chi guarda l'esito non saprebbe di quale dei due parla.`,
      );
    }
    nomi.add(chiave);
  }
  return letti;
}

function interpretaOrologio(dati: unknown, indice: number): Orologio {
  const dove = `L'orologio numero ${indice + 1}`;
  if (typeof dati !== "object" || dati === null || Array.isArray(dati)) {
    throw new Error(`${dove} non è una voce: serve un oggetto con nome e numeri.`);
  }
  const voce = dati as Record<string, unknown>;

  const nome = testo(voce["nome"], `${dove} non ha un nome`);
  return {
    nome,
    // Il perché può essere vuoto: è per chi rilegge, e obbligarlo a scriverlo
    // produrrebbe righe scritte per far contento un controllo.
    perche: typeof voce["perche"] === "string" ? voce["perche"].trim() : "",
    turnoDiChiusura: numero(voce["turnoDiChiusura"], `«${nome}»`, "il turno di chiusura", {
      minimo: 1,
      massimo: TURNO_DI_CHIUSURA_MASSIMO,
    }),
    rimozioni: numero(voce["rimozioni"], `«${nome}»`, "le rimozioni", {
      minimo: 0,
      massimo: COPIE_MASSIME_IN_UN_MAZZO,
    }),
    contromagie: numero(voce["contromagie"], `«${nome}»`, "le contromagie", {
      minimo: 0,
      massimo: COPIE_MASSIME_IN_UN_MAZZO,
    }),
  };
}

function testo(valore: unknown, guaio: string): string {
  if (typeof valore !== "string" || valore.trim() === "") {
    throw new Error(`${guaio}.`);
  }
  return valore.trim();
}

function numero(
  valore: unknown,
  chi: string,
  che: string,
  limiti: { minimo: number; massimo: number },
): number {
  if (typeof valore !== "number" || !Number.isInteger(valore)) {
    throw new Error(`In ${chi}, ${che} deve essere un numero intero.`);
  }
  if (valore < limiti.minimo || valore > limiti.massimo) {
    throw new Error(
      `In ${chi}, ${che} è ${valore}: si aspetta un numero fra ${limiti.minimo} e ${limiti.massimo}.`,
    );
  }
  return valore;
}
