/**
 * Le costanti di taratura della base di terre, tutte in un punto solo.
 *
 * `spec.md` lo chiede a chiare lettere: ogni numero scelto a occhio è
 * **provvisorio** e va ritarato alla sosta, guardando le liste che l'app
 * produce sui dati veri. Tenerli qui vuol dire poterli cambiare tutti insieme,
 * e sapere quali sono senza cercarli nel codice.
 *
 * Nessuno di questi numeri è una legge di Magic: sono il punto di partenza
 * ragionevole da cui misurare.
 */

/** Le carte di un mazzo Standard costruito: è una regola, non una taratura. */
export const DIMENSIONE_MAZZO = 60;

/**
 * Le copie massime di una carta: anche questa è una regola, non una taratura —
 * ma è una regola **con un'eccezione scritta sulle carte stesse**, e
 * l'eccezione si legge dai dati come tutto il resto (`CLAUDE.md`).
 */
export const COPIE_MASSIME = 4;

/**
 * Fin dove può arrivare il numero di terre mosso a mano.
 *
 * Non sono i limiti di quel che l'app consiglia — quelli sono `TERRE_MINIME` e
 * `TERRE_MASSIME` — ma di quanto l'utente può spingersi per vedere il
 * compromesso. Un limite serve: il conto delle probabilità è esatto, e il suo
 * costo cresce in fretta col numero di terre. Trenta terre restano immediate
 * anche su un telefono; cinquanta no.
 */
export const TERRE_A_MANO_MINIME = 16;
export const TERRE_A_MANO_MASSIME = 30;

/**
 * Quante terre servono, in funzione del costo medio del mazzo:
 * `TERRE_A_COSTO_ZERO + TERRE_PER_COSTO_MEDIO × costo medio`, arrotondato e
 * tenuto fra il minimo e il massimo.
 *
 * Non è una tabella fissa per archetipo: è la curva del mazzo che decide,
 * com'è scritto nel ticket 06. Un mazzo che costa 2 di media finisce sulle 21
 * terre, uno che costa 4 sulle 24.
 */
export const TERRE_A_COSTO_ZERO = 17.5;
export const TERRE_PER_COSTO_MEDIO = 1.6;
export const TERRE_MINIME = 20;
export const TERRE_MASSIME = 27;

/**
 * Quante terre non base può prendere il mazzo, per ogni colore oltre il primo.
 *
 * Un mazzo di un colore solo non ne ha bisogno: le sue terre base entrano
 * dritte e fanno il colore giusto sempre. Ogni colore in più apre un posto per
 * le terre che fanno due colori insieme.
 */
export const TERRE_NON_BASE_PER_COLORE_IN_PIU = 8;

/**
 * Quanto pesa, nella scelta, il fatto che una terra entri girata.
 *
 * Il punteggio di una terra doppia parte dai colori utili che produce e scende
 * di questa penalità. È **dichiarata** proprio perché è un giudizio: entrare
 * girati costa un turno, e quanto costi dipende dalla velocità del mazzo.
 */
export const PENALITA_ENTRA_GIRATA = 1;

/**
 * La stessa penalità, per le terre che entrano girate **solo a certe
 * condizioni**: in partita spesso entrano dritte, quindi si preferiscono a
 * quelle che entrano girate sempre.
 *
 * Nel calcolo delle probabilità, invece, contano come girate: è la lettura
 * pessimistica, ed è la sola che non può mentire all'utente.
 */
export const PENALITA_ENTRA_GIRATA_A_VOLTE = 0.5;

/**
 * Quanto una carta può perdere **per colpa dei suoi simboli colorati** prima
 * che l'app la segnali come difficile, in punti di probabilità.
 *
 * Il confronto non è con il cento per cento, ed è una scelta ragionata: al
 * turno cinque nessun mazzo ha cinque terre più di un terzo delle volte, e
 * segnalare ogni carta da cinque mana vorrebbe dire ripetere sempre la stessa cosa
 * e non dire niente. La base di terre risponde di una domanda sola — **i
 * colori ci sono?** — e la si misura confrontando la carta con una che
 * costasse lo stesso senza nessun simbolo colorato.
 *
 * Il numero da ritarare per primo alla sosta: troppo basso e l'app grida al
 * lupo per ogni carta a due colori, troppo alto e tace su carte che in partita
 * restano in mano.
 */
export const PERDITA_MASSIMA_PER_I_COLORI = 0.1;
