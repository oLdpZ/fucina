/**
 * La forma del **documento di formato**: il file di dati che dice quale gioco
 * si sta giocando.
 *
 * È l'opposto del pool. Il pool è un prodotto di compilazione, lo scrive un
 * comando e non si tocca a mano; questo lo **scrive una persona**, entra in git,
 * e si corregge una riga per volta senza compilare niente. Il perché sta in
 * [ADR-0004](../../docs/adr/0004-nessuna-verita-di-formato-nel-sorgente.md): le
 * decisioni di un gruppo che gioca il venerdì non stanno in nessuna banca dati,
 * e sepolte in un `.ts` non le troverebbe e non le aggiornerebbe nessuno.
 *
 * Da qui discende il vincolo che questo modulo deve far rispettare: **nessun
 * nome di carta, nessun codice di edizione, nessuna data vive nel sorgente**.
 * Qui ci sono solo tipi — la forma delle risposte, mai le risposte.
 *
 * Ogni voce porta due cose oltre al proprio contenuto, e sono le due che
 * rendono il documento leggibile fra un anno:
 *
 * - il **perché**, a parole, perché una lista di nomi senza ragioni non si sa
 *   più correggere quando il gruppo cambia idea;
 * - la **divergenza**, quando la voce si scosta dal regolamento pubblicato di
 *   riferimento: chi la legge deve poterla spiegare a chi la contesta al tavolo.
 *
 * E una terza, che è temporanea per costruzione: **da confermare**. Un dato
 * incerto dichiarato incerto è un dato; scritto senza dirlo è un errore che
 * aspetta.
 *
 * Come il pool, questo modulo non ha peso a runtime: lo leggono sia l'app sia
 * gli strumenti del manutentore senza legarli fra loro.
 */

/**
 * Una voce che nomina una carta: una limitata o una bandita.
 *
 * `divergenza` e `daConfermare` sono `null` quando non c'è niente da dire, e
 * non assenti: un campo che a volte manca si scorda di essere guardato.
 */
export type VoceDiCarta = {
  /** Il nome della carta, come lo scrive la stampa inglese. */
  carta: string;
  perché: string;
  /** In che cosa questa voce si scosta dal regolamento pubblicato di riferimento. */
  divergenza: string | null;
  /** La domanda ancora aperta col gruppo, se ce n'è una. */
  daConfermare: string | null;
};

/**
 * Un elenco di carte con la ragione della sua forma.
 *
 * Il `perché` è dell'**elenco intero** e non della singola riga: dice perché
 * l'elenco è fatto di nomi e non di una regola, che è la decisione di ADR-0004
 * e la prima cosa che qualcuno vorrà disfare.
 */
export type ElencoDiCarte = {
  perché: string;
  daConfermare: string | null;
  carte: VoceDiCarta[];
};

/** Un'edizione ammessa, per codice — il codice che usano i dati di Scryfall. */
export type Edizione = {
  codice: string;
  nome: string;
  perché: string;
  /**
   * Le lingue le cui stampe il gruppo ammette **per questa edizione**, coi
   * codici di lingua che usano i dati di Scryfall.
   *
   * Obbligatorio e non vuoto. Un'edizione che non lo dichiara fa rifiutare il
   * documento, e l'assenza **non** si legge come «tutte»: un valore predefinito
   * qui sarebbe verità di formato scritta nel sorgente sotto forma di
   * comportamento implicito, ed è precisamente quel che ADR-0004 vieta. La
   * regola la dichiara il documento, sempre, anche quando è generosa.
   *
   * **L'ordine è la preferenza.** `["it", "en"]` dice due cose insieme: queste
   * due lingue si giocano, e fra le stampe che esistono si mostra la prima
   * disponibile in quest'ordine. Il campo fa due mestieri di proposito:
   * l'alternativa è un secondo campo per la preferenza, che andrebbe tenuto in
   * accordo col primo e che nessuno leggerebbe mai come diverso.
   *
   * Le lingue **non** entrano nell'impronta del formato (`ambito.ts`): non
   * cambiano quali carte esistono, quindi non cambiano se un mazzo salvato è
   * dello stesso gioco.
   */
  lingue: string[];
  daConfermare: string | null;
};

/**
 * Come si decide chi entra nel pool.
 *
 * Due letture possibili della stessa frase del gruppo, ed è una delle quattro
 * voci da confermare:
 *
 * - `stampa-italiana` — una carta entra se **esiste una sua stampa in italiano**
 *   dentro le edizioni ammesse. È una regola, e vale anche per le carte che
 *   nessuno ha ancora guardato;
 * - `solo-edizioni` — entra tutto quel che sta in quelle edizioni, in qualunque
 *   lingua sia stampato. È un elenco.
 *
 * I due nomi non sono verità di formato: sono i due comportamenti che il codice
 * sa eseguire. **Quale dei due** è il gioco vero lo dice il documento.
 */
export type Criterio = {
  regola: "stampa-italiana" | "solo-edizioni";
  /** La stessa regola scritta a parole, per chi legge il documento e non il codice. */
  descrizione: string;
  daConfermare: string | null;
};

/** Il documento intero. */
export type Formato = {
  /**
   * Come si chiama il formato. È la stringa che l'utente legge in interfaccia,
   * nelle note legali e sulla lista da consegnare all'arbitro: viene da qui e
   * non da una costante del sorgente.
   */
  nome: string;
  /** La domanda aperta sul nome, se ce n'è una. */
  daConfermare: string | null;
  /** Quando la lista è stata presa. Una data nel documento, mai nel sorgente. */
  aggiornatoIl: string;
  /** Da chi la lista è stata presa. Fra un anno è l'unica cosa che la spiega. */
  fonte: string;
  /**
   * Il regolamento pubblicato rispetto al quale si misurano le divergenze.
   *
   * Non è la nostra fonte — la nostra è il gruppo — ed è il motivo per cui sta
   * in un campo separato: serve a **dichiarare gli scarti**, non a decidere.
   */
  regolamentoDiRiferimento: string;
  criterio: Criterio;
  edizioni: Edizione[];
  limitate: ElencoDiCarte;
  bandite: ElencoDiCarte;
};

/** Una voce ancora da confermare col gruppo, e la domanda da fargli. */
export type DaConfermare = {
  /** Dove sta la voce nel documento, per ritrovarla. */
  voce: string;
  domanda: string;
};
