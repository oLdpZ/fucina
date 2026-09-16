/**
 * **Le soglie che separano aggro, midrange e controllo, in un punto solo, e
 * tutte provvisorie.**
 *
 * È la prima delle sei tarature che la tappa 3 consegna alla sosta (`spec.md`,
 * «Le sei tarature»): nessuna è decisa qui. I numeri sono il punto di partenza
 * ragionevole da cui misurare, scelti a occhio sulla scala che il punteggio già
 * usa per la velocità (`punteggio/taratura.ts`: un mazzo veloce chiude al
 * quarto turno, uno lento al decimo) e **non rimisurati su nessun mazzo vero**.
 * Alla sosta si fa girare `archetipoDi` sui mazzi che ogni giocatore
 * chiamerebbe in un modo, e si spostano questi numeri finché le caselle
 * tornano; se non tornano per nessun numero, ADR-0001 si riapre.
 *
 * Sono soglie sul **comportamento** — turni, quote, corse — e su nient'altro.
 * Una soglia sulla composizione («almeno N creature») qui non entra: è la
 * riga che ADR-0001 traccia.
 */

/**
 * Il turno medio di chiusura entro cui un mazzo che chiude quasi sempre si dice
 * **aggro**.
 *
 * Sei: due turni oltre il mazzo veloce del punteggio, perché la simulazione non
 * conosce bloccanti e un aggro vero nel goldfish arriva prima che al tavolo.
 */
export const TURNO_MASSIMO_AGGRO = 6;

/**
 * Il turno medio di chiusura entro cui un mazzo che chiude quasi sempre si dice
 * **midrange**, se non è già un aggro.
 *
 * Nove: uno prima del mazzo lento del punteggio. Oltre, chiudere non basta più a
 * dire che cosa sia il mazzo, e parla la corsa.
 */
export const TURNO_MASSIMO_MIDRANGE = 9;

/**
 * La quota di partite chiuse sotto cui il turno medio non basta a fare un aggro
 * o un midrange.
 *
 * Il turno medio si prende sulle sole partite chiuse, e da solo mente: chiudere
 * al quarto turno una volta su cinque non è un aggro. Otto volte su dieci è un
 * mazzo il cui turno medio racconta come gioca.
 */
export const QUOTA_CHE_CHIUDE = 0.8;

/**
 * La quota di partite chiuse sotto cui nemmeno un controllo si dice tale.
 *
 * Più bassa di `QUOTA_CHE_CHIUDE`, perché il goldfish non sa che le rimozioni
 * comprano tempo — lo sa la corsa — e un controllo nella simulazione chiude di
 * meno. Ma deve chiudere: un mazzo che tiene lontano l'avversario e poi non vince
 * quasi mai non ha una strategia, ha un'attesa.
 */
export const QUOTA_MINIMA_DEL_CONTROLLO = 0.5;

/**
 * La quota di corse che un controllo deve reggere **grazie al ritardo che
 * infligge**, fra quelle contro gli orologi dichiarati.
 *
 * Metà: un mazzo che tiene lontano un avversario su quattro non ha un piano
 * contro il meta dell'utente, ha un avversario comodo.
 */
export const QUOTA_DI_CORSE_RETTE = 0.5;
