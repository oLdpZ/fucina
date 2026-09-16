/**
 * Le soglie del tema, tutte in un punto solo e **dichiarate provvisorie**.
 *
 * `spec.md` è esplicito: le soglie di «tema stretto» non si decidono a
 * tavolino, si tarano alla sosta sui dati veri. Un numero scritto qui è un punto
 * di partenza da cui misurare, mai una verità sul gioco.
 *
 * **E qui il punto di partenza è di un altro gioco.** Le soglie sotto sono state
 * scelte su un pool di quasi cinquemila carte, dove un sottotipo popolare ne
 * contava un centinaio; questo pool ne ha meno di ottocento in tutto, e i suoi
 * sottotipi si contano sulle dita. Con ogni probabilità dicono «tema stretto» a
 * temi che qui sono la norma — il che è esattamente l'errore che il progetto
 * teme di più, perché scoraggia l'idea prima di provarla. Si rimisurano al
 * ticket 15, e fino a là vanno lette come sospette.
 *
 * La soglia dell'**insufficiente** non è qui, ed è apposta: quella non è una
 * taratura ma un conto: se le copie disponibili non arrivano a riempire i
 * posti non-terra, un mazzo del solo tema non esiste, e nessuna taratura può
 * cambiarlo.
 */

import { DIMENSIONE_MAZZO, TERRE_MASSIME } from "../mazzo/taratura.js";

/**
 * Quanti posti deve riempire il tema: le carte del mazzo meno le terre.
 *
 * Si prende il **massimo** delle terre che l'app consiglia, perché è il caso
 * più favorevole al tema: più terre ci sono, meno posti restano da riempire
 * con le sue carte. Dire «insufficiente» a un tema che con ventisette terre ce
 * l'avrebbe fatta sarebbe un errore dell'app, non una regola del gioco — e
 * qui, dove il verdetto è un conto e non una taratura, un errore del genere
 * non ha nemmeno la scusa della soglia da ritarare.
 */
export const POSTI_NON_TERRA = DIMENSIONE_MAZZO - TERRE_MASSIME;

/**
 * Quante carte distinte servono perché il tema stia comodo.
 *
 * Non è il minimo per **fare** un mazzo — quello è un conto di copie — ma il
 * minimo perché la ricerca abbia da scegliere: sotto questo numero la
 * frontiera è corta e i quattro mazzi si somigliano tutti, perché sono quasi
 * le stesse carte in ordine diverso.
 *
 * Quaranta è più dei posti da riempire, di parecchio: è il modo più semplice
 * di dire che alla ricerca devono restare carte da scartare, non solo carte da
 * mettere. **Da ritarare alla sosta**, guardando quanto si somigliano davvero i
 * mazzi che escono.
 */
export const CARTE_DISTINTE_COMODE = 40;
