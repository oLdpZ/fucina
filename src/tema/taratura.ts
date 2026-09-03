/**
 * Le soglie del tema, tutte in un punto solo e **dichiarate provvisorie**.
 *
 * `spec.md` è esplicito: le soglie di «tema stretto» non si decidono a
 * tavolino, si tarano alla sosta sui dati veri. Il primo mockup diceva
 * quattordici Goblin giocabili in Standard; il pool vero ne conta
 * novantacinque. Un numero scritto qui è un punto di partenza da cui misurare,
 * mai una verità sul gioco.
 *
 * La soglia dell'**impossibile** non è qui, ed è apposta: quella non è una
 * taratura ma un conto: se le copie disponibili non arrivano a riempire i
 * posti non-terra, un mazzo legale non esiste, e nessuna taratura può
 * cambiarlo.
 */

import { DIMENSIONE_MAZZO, TERRE_MINIME } from "../mazzo/taratura.js";

/**
 * Quanti posti deve riempire il tema: le carte del mazzo meno le terre.
 *
 * Si prende il **minimo** delle terre che l'app consiglia, cioè il caso più
 * favorevole al tema: un mazzo con meno terre lascia più posti alle magie, e
 * dichiarare impossibile un tema che con venti terre ce l'avrebbe fatta
 * sarebbe un errore dell'app.
 */
export const POSTI_NON_TERRA = DIMENSIONE_MAZZO - TERRE_MINIME;

/**
 * Quante carte distinte servono perché il tema stia comodo.
 *
 * Non è il minimo per **fare** un mazzo — quello è un conto di copie — ma il
 * minimo perché la ricerca abbia da scegliere: sotto questo numero la
 * frontiera è corta e i quattro mazzi si somigliano tutti, perché sono quasi
 * le stesse carte in ordine diverso.
 *
 * Quaranta è il numero dei posti non-terra: chiedere che le carte candidate
 * siano almeno tante quanti i posti da riempire è il modo più semplice di dire
 * «c'è da scegliere». **Da ritarare alla sosta**, guardando quanto si
 * somigliano davvero i mazzi che escono.
 */
export const CARTE_DISTINTE_COMODE = 40;
