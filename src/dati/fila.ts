/**
 * **Una fila davanti al deposito: si entra uno alla volta, nell'ordine.**
 *
 * `apri()` apre una connessione nuova a ogni chiamata, e le chiude come si
 * deve: non si perde niente. Si perde l'**ordine** (ticket 55). Due operazioni
 * che si sovrappongono atterrano quando capita, e questo basta a disfare quel
 * che l'app ha già annunciato: una scrittura partita da un tasto premuto è
 * ancora in volo quando si preme «Rimetti i mazzi di partenza», la
 * cancellazione riesce, la schermata dice che è fatta — e poi la scrittura
 * vecchia atterra sopra il vuoto appena fatto. Alla riapertura ci sono di nuovo
 * i mazzi che l'utente aveva cancellato.
 *
 * IndexedDB da solo non lo impedisce: le sue transazioni sono ordinate fra loro
 * **dentro una connessione**, e qui le connessioni sono una per operazione. La
 * fila è quella connessione che non c'è: ogni lavoro comincia quando il
 * precedente ha finito, e allora l'ordine di partenza è l'ordine di arrivo.
 *
 * Non è un lucchetto e non protegge da niente: due schede restano due file
 * diverse. Mette in ordine quel che parte **da questa scheda**, che è dove
 * nasce il difetto — i tasti li preme una persona sola, su una schermata sola.
 *
 * E ha un tetto, perché una fila senza tetto sarebbe peggio del difetto che
 * chiude: vedi `TETTO_DEL_TURNO`.
 */

/**
 * Quanto la fila aspetta un turno prima di dare il via al prossimo.
 *
 * `indexedDB.open()` **può restare muto per sempre**: non risponde né sì né no,
 * in contesti che certi browser trattano come ristretti. È un caso vero e già
 * noto a questo codice — `datiDaAprire` ha il suo tetto per la stessa ragione,
 * ed è questo numero, `TETTO_DEPOSITO` spiega perché — e in fila diventa molto peggio: senza tetto, un
 * turno che non finisce fermerebbe ogni operazione successiva per il resto
 * della sessione, in silenzio. Il salvataggio degli orologi, i mazzi, tutto.
 *
 * Tre secondi: un'operazione sul deposito ne prende qualche decimo anche su un
 * telefono lento, e chi ci arriva sopra non sta rispondendo.
 *
 * **Un turno scaduto non scivola sotto il prossimo** (ticket 69). Scaduto il
 * tetto la fila va avanti, e se il lavoro scaduto restasse libero di atterrare
 * atterrerebbe dopo chi è partito dopo di lui: due operazioni insieme, e la
 * scrittura vecchia sopra la cancellazione appena annunciata — il ticket 55
 * tornato per la porta di servizio, e proprio sul telefono lento dove
 * un'apertura può metterci tre secondi e mezzo. Perciò, quando il prossimo
 * **comincia davvero** e il lavoro scaduto è ancora in volo, la fila glielo
 * dice, col segnale che gli ha consegnato, e solo dopo dà il via al prossimo:
 * sta a lui rinunciare, e rispondere a chi l'ha chiesto che non si è fatto. La
 * fila non può farlo al suo posto, perché non sa che lavoro sia né che cosa
 * voglia dire «non fatto».
 *
 * Non glielo dice allo scadere, ma quando qualcuno arriva: finché dietro non c'è
 * nessuno il lavoro lento non scavalca niente, e rinunciare sarebbe perdere un
 * salvataggio che sarebbe atterrato un soffio dopo, e nel suo ordine.
 */
export const TETTO_DEL_TURNO = 3000;
/**
 * Una fila nuova. Ce n'è una sola in tutta l'app, davanti al deposito; questa
 * funzione esiste perché una fila condivisa fra i test sarebbe una fila sola
 * per prove diverse, e la prima lenta terrebbe ferme le altre.
 */
export function creaFila(
  tetto: number = TETTO_DEL_TURNO,
): <T>(lavoro: Lavoro<T>) => Promise<T> {
  let ultimo: Promise<unknown> = Promise.resolve();
  let turnoDiPrima: Turno = { segnale: new AbortController(), finito: true };

  return <T>(lavoro: Lavoro<T>): Promise<T> => {
    const precedente = ultimo;
    const prima = turnoDiPrima;
    const turno: Turno = { segnale: new AbortController(), finito: false };
    turnoDiPrima = turno;
    const comincia = () => {
      // Il precedente ancora in volo è un turno scaduto: lo sa adesso, prima
      // che questo lavoro cominci a toccare il deposito.
      if (!prima.finito) prima.segnale.abort();
      return lavoro(turno.segnale.signal);
    };
    // Si aspetta che il precedente abbia finito, **comunque** sia finito: un
    // lavoro andato male ha comunque smesso di toccare il deposito.
    const mio = precedente.then(comincia, comincia);
    const chiuso = () => {
      turno.finito = true;
    };
    void mio.then(chiuso, chiuso);
    // Nella catena va una promessa che non rifiuta mai e che finisce comunque.
    // Una rifiutata lasciata lì, o una che non si scioglie, fermerebbe ogni
    // operazione successiva — e in silenzio, che è il modo peggiore in cui
    // questo codice possa rompersi. Chi ha chiesto il lavoro il guasto lo
    // riceve lo stesso: è `mio` che gli torna, non questa.
    //
    // E si aggancia al **precedente**, non a `mio`: così la sveglia si arma
    // quando questo turno comincia, non quando ci si è messi in fila. Armata
    // all'ingresso, sarebbe un tetto sulla fila intera invece che su un turno:
    // basterebbe un po' di lavoro accumulato perché tutti i turni in coda
    // scadessero insieme, e la fila da lì in poi non metterebbe più in ordine
    // niente.
    ultimo = precedente.then(
      () => scadenza(mio, tetto),
      () => scadenza(mio, tetto),
    );
    return mio;
  };
}

/**
 * Un lavoro in fila. Riceve il segnale del suo turno, che scatta quando il
 * turno è scaduto e il prossimo sta per cominciare: da quel momento il lavoro
 * non deve più toccare il deposito.
 */
export type Lavoro<T> = (turno: AbortSignal) => Promise<T>;

/** Un turno, e se il suo lavoro ha già finito. */
interface Turno {
  readonly segnale: AbortController;
  finito: boolean;
}

/** Il turno finisce quando il lavoro ha finito, o quando scade il tetto. */
function scadenza(lavoro: Promise<unknown>, tetto: number): Promise<void> {
  return new Promise<void>((risolvi) => {
    const sveglia = setTimeout(risolvi, tetto);
    const finito = () => {
      // Il turno finito si porta via la sua sveglia: un timer per operazione,
      // con un tasto premuto a ogni carattere, sarebbe una scia inutile.
      clearTimeout(sveglia);
      risolvi();
    };
    void lavoro.then(finito, finito);
  });
}
