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
 * e per lo stesso numero — e in fila diventa molto peggio: senza tetto, un
 * turno che non finisce fermerebbe ogni operazione successiva per il resto
 * della sessione, in silenzio. Il salvataggio degli orologi, i mazzi, tutto.
 *
 * Tre secondi: un'operazione sul deposito ne prende qualche decimo anche su un
 * telefono lento, e chi ci arriva sopra non sta rispondendo. Scaduto il turno
 * il prossimo parte — l'ordine si perde solo lì, dove un deposito muto non lo
 * lasciava comunque più tenere.
 */
export const TETTO_DEL_TURNO = 3000;

/**
 * Una fila nuova. Ce n'è una sola in tutta l'app, davanti al deposito; questa
 * funzione esiste perché una fila condivisa fra i test sarebbe una fila sola
 * per prove diverse, e la prima lenta terrebbe ferme le altre.
 */
export function creaFila(
  tetto: number = TETTO_DEL_TURNO,
): <T>(lavoro: () => Promise<T>) => Promise<T> {
  let ultimo: Promise<unknown> = Promise.resolve();

  return <T>(lavoro: () => Promise<T>): Promise<T> => {
    const precedente = ultimo;
    // Si aspetta che il precedente abbia finito, **comunque** sia finito: un
    // lavoro andato male ha comunque smesso di toccare il deposito.
    const mio = precedente.then(lavoro, lavoro);
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
