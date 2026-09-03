/**
 * Le due manopole della combo dichiarata, in un punto solo e **provvisorie**,
 * come ogni altra taratura del progetto.
 *
 * Una delle due è fra le sei che questa tappa consegna alla sosta
 * (`spec.md`, «Le sei tarature»); l'altra è un limite di buon senso e non una
 * verità sul gioco. Qui sotto è scritto quale è quale.
 */

/**
 * Il turno entro cui una combo dichiarata si considera assemblata. **La
 * taratura numero cinque di questa tappa: si fissa alla sosta.**
 *
 * Cinque è il turno in cui, in Standard, una combo che voglia battere sul tempo
 * il resto del tavolo deve essere in mano: prima non ci sono abbastanza carte
 * viste, dopo la partita l'ha già decisa qualcun altro. È un punto di partenza
 * da cui misurare, non una regola: alla sosta si guardano le probabilità vere
 * che escono dai mazzi veri e questo numero si sposta.
 *
 * Cambiarlo non cambia **nessun mazzo**: la ricerca non lo guarda — i pezzi
 * dichiarati entrano al massimo delle copie qualunque sia il turno — e sposta
 * soltanto il numero che l'app dichiara all'utente.
 */
export const TURNO_DELLA_COMBO = 5;

/**
 * Quante carte al massimo si possono nominare.
 *
 * Non è una taratura da sosta ma un limite di buon senso, e ha due ragioni.
 * La prima è di gioco: una combinazione da cinque pezzi non è una combo, è un
 * mazzo — e la probabilità di assemblarla entro un turno crolla a numeri che
 * non dicono più niente. La seconda è di conto: i pezzi occupano `4 × n` posti
 * non-terra dei trentatré scarsi che un mazzo ha, e l'inclusione-esclusione di
 * `probabilitaDiAssemblarne` costa 2^n.
 */
export const CARTE_MASSIME_DELLA_COMBO = 4;
