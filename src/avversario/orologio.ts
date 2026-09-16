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

/**
 * Come `interpretaOrologi`, ma una voce storta vale come assente.
 *
 * È la lettura giusta per il **deposito del dispositivo**, dove gli orologi
 * sono già dell'utente: sono l'unica cosa che l'app conserva e che nessuno può
 * ricostruire al posto suo — il meta del suo negozio, mazzo per mazzo. Là
 * dentro una riga scritta a metà — un mazzo appena aggiunto a cui non ha ancora
 * dato un nome, una scrittura interrotta, spazio recuperato dal browser — non
 * deve poter far sparire le altre undici. Si perde **una voce, non l'elenco**:
 * è la stessa lezione di `identitaSeSiLegge`, che sta accanto a
 * `interpretaIdentita` per la stessa ragione (ticket 35).
 *
 * Chi non si legge cade, e cadono anche i doppioni — si tiene il **primo**, che
 * è quello su cui l'utente aveva già deciso — e le voci oltre il massimo. Quel
 * che resta è esattamente quel che il lettore severo accetterebbe: una voce
 * senza nome non entra nella corsa nemmeno da qui, e ADR-0002 resta in piedi.
 *
 * `undefined` non è l'elenco vuoto, e la distinzione regge tutta la riapertura:
 * l'elenco vuoto è «non voglio correre contro nessuno», `undefined` è «non si è
 * capito niente di quel che c'è scritto», e solo il secondo fa tornare il file
 * del manutentore.
 *
 * Per un testo arrivato da fuori — un mazzo scambiato per iscritto — vale
 * l'altra, quella severa: là il file non è ancora di nessuno, e rifiutarlo
 * dicendo quale riga guardare è la risposta giusta, perché chi lo ha in mano lo
 * può correggere.
 *
 * Il file di partenza del manutentore è arrivato da fuori e usa questa, e non è
 * una contraddizione: quel file esiste perché la prima schermata non sia vuota,
 * e il severo — che solleva — la svuotava del tutto per una riga (ticket 57).
 * Chi lo apre non lo può correggere, quindi rifiutarlo non gli serve a niente.
 * Le ragioni non si buttano lo stesso: `righeCheNonSiConservano` le consegna, e
 * la schermata dice quanti mazzi sono caduti.
 */
export function orologiCheSiLeggono(dati: unknown): Orologio[] | undefined {
  if (!Array.isArray(dati)) return undefined;
  return vaglia(dati).tenuti;
}

/**
 * Quali orologi entrano nella **corsa**: gli stessi che entrerebbero nel
 * deposito, e non uno di più (ticket 60).
 *
 * È la stessa setacciatura di `orologiCheSiLeggono`, e lo è di proposito. La
 * schermata tiene in mano righe che decisioni non sono ancora — il tasto
 * «Aggiungi un mazzo» ne semina una con `nome: ""`, ed è giusto, il nome lo
 * scrive l'utente — e quelle righe nel deposito non entravano già da
 * ticket 35. Nella corsa entravano: il motore le contava tutte, e la schermata
 * scriveva «Contro , che chiude al turno 6…», intestando un esito a un mazzo
 * che un nome non ce l'ha. ADR-0002 dice che un orologio senza nome non entra
 * nella corsa; questa è la riga che lo rende vero anche da questa porta.
 *
 * Non è un sinonimo con un nome nuovo: risponde a una domanda diversa — che
 * **corre**, non che **si conserva** — e succede che la risposta sia la stessa.
 * Che resti la stessa non è lasciato alla buona volontà: lo tiene un test
 * scritto come uguaglianza fra le due, perché due copie della stessa regola
 * sono due risposte che prima o poi divergono.
 *
 * Prende orologi **già tipati** e non `unknown`: qui non si legge niente da
 * fuori, si setaccia quel che la schermata ha in mano. Per la stessa ragione
 * non torna `undefined` — «non si è capito niente» non è un esito possibile su
 * un array che esiste già.
 */
export function orologiCheCorrono(orologi: readonly Orologio[]): Orologio[] {
  return vaglia(orologi).tenuti;
}

/**
 * Quali righe non entrano nel deposito, e **perché**, riga per riga.
 *
 * È la seconda metà della promessa del ticket 35. La prima è che una riga
 * storta non porti via le altre; questa è che non se ne vada in silenzio: la
 * schermata mostra quel che l'utente ha in mano, il deposito tiene quel che si
 * rilegge, e finché le due cose differiscono l'utente deve poterlo leggere sotto
 * la riga che sta scrivendo. «Un mazzo scomparso in silenzio è la cosa che il
 * progetto ha promesso di non fare», e una riga che si salva a metà è lo stesso
 * silenzio più piccolo.
 *
 * Le ragioni sono quelle che il lettore severo scriverebbe: sono già frasi per
 * una persona che ha la riga davanti, ed è esattamente chi le leggerà.
 */
export function righeCheNonSiConservano(dati: readonly unknown[]): Map<number, string> {
  return vaglia(dati).scarti;
}

/** La setacciatura, una volta sola: che cosa resta e che cosa cade, e perché. */
function vaglia(dati: readonly unknown[]): {
  tenuti: Orologio[];
  scarti: Map<number, string>;
} {
  const tenuti: Orologio[] = [];
  const scarti = new Map<number, string>();
  // Il nome com'è scritto **nella riga tenuta**, non nella riga che cade: chi
  // legge deve poter andare a cercare l'altra, e «MONO ROSSO» non la trova.
  const nomi = new Map<string, string>();

  for (const [indice, voce] of dati.entries()) {
    if (tenuti.length >= OROLOGI_MASSIMI) {
      scarti.set(
        indice,
        `Gli orologi che si tengono sono ${OROLOGI_MASSIMI}: questa riga non si salva.`,
      );
      continue;
    }

    let letto: Orologio;
    try {
      letto = interpretaOrologio(voce, indice);
    } catch (guaio) {
      scarti.set(indice, guaio instanceof Error ? guaio.message : "Questa riga non si legge.");
      continue;
    }

    const chiave = letto.nome.toLowerCase();
    const gia = nomi.get(chiave);
    if (gia !== undefined) {
      scarti.set(indice, `Un altro mazzo si chiama già «${gia}»: questa riga non si salva.`);
      continue;
    }
    nomi.set(chiave, letto.nome);
    tenuti.push(letto);
  }
  return { tenuti, scarti };
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
