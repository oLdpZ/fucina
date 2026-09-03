/**
 * Le costanti di taratura del mazzo — base di terre e simulazione — tutte in
 * un punto solo.
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

/* ------------------------------------------------------------------------- *
 * La simulazione goldfish (ticket 09)
 * ------------------------------------------------------------------------- */

/**
 * Quante partite si simulano per ogni mazzo.
 *
 * È il numero **provvisorio** che il ticket 09 chiede di tenere in un punto
 * solo e di ritarare alla sosta misurando davvero. È un compromesso fra due
 * cose che tirano in direzioni opposte: poche partite fanno ballare i numeri da
 * un'esecuzione all'altra, tante fanno aspettare chi usa l'app dal telefono.
 *
 * Cinquecento partite tengono l'errore su una quota attorno a due punti
 * percentuali, che è abbastanza fine per distinguere due mazzi diversi e non
 * abbastanza per fidarsi dell'ultima cifra. Costano una quindicina di
 * millisecondi su un computer da tavolo — misurati, non stimati — e quindi
 * verosimilmente attorno al decimo di secondo su un telefono.
 *
 * **Quel «verosimilmente» è il motivo per cui il numero è provvisorio**: alla
 * sosta si misura il tempo vero su un telefono vero, tenendo conto che la
 * ricerca a scambi singoli (ticket 11) chiamerà questa simulazione una volta
 * per ogni scambio provato, e si sposta questo numero — non gli altri.
 */
export const PARTITE_SIMULATE = 500;

/** I punti vita da togliere per vincere: è una regola, non una taratura. */
export const VITE_AVVERSARIO = 20;

/** Le carte della mano iniziale: regola, non taratura. */
export const CARTE_IN_MANO_INIZIALI = 7;

/**
 * Il turno oltre il quale si smette di simulare e la partita si conta come
 * **non chiusa**.
 *
 * Un mazzo che non ha ucciso entro il ventesimo turno non ucciderà: continuare
 * costerebbe tempo e non direbbe niente di nuovo. Le partite non chiuse non
 * entrano nel turno medio di chiusura — entrano nella quota di partite chiuse,
 * che è il numero onesto da mettere accanto alla media.
 */
export const TURNO_MASSIMO = 20;

/**
 * Quante volte si rimescola prima di tenere per forza.
 *
 * Si usa il mulligan «di Londra», che è quello vero del formato: si rimescola
 * tutto, si pescano di nuovo sette carte, e se ne mettono sotto tante quante
 * sono le volte che si è rimescolato. Oltre il secondo mulligan una mano da
 * cinque carte non salva quasi mai la partita, e chi gioca lo sa: si tiene.
 */
export const MULLIGAN_MASSIMI = 2;

/**
 * La regola di mulligan, **scritta e dichiarata** come chiede il ticket 09: si
 * tiene una mano se le terre che contiene stanno fra questi due numeri.
 *
 * Non è la sola regola possibile ed è di proposito grossolana: guarda le terre
 * e nient'altro, perché ogni raffinamento in più sarebbe un giudizio nostro
 * mascherato da misura. Chi legge i numeri della simulazione deve poter sapere
 * in una frase come sono stati ottenuti.
 */
export const TERRE_MINIME_IN_MANO = 2;
export const TERRE_MASSIME_IN_MANO = 5;

/**
 * Quante terre vuole tenere in mano chi deve mettere carte sotto dopo un
 * mulligan: le terre in più vanno sotto per prime, poi le magie più care.
 */
export const TERRE_VOLUTE_IN_MANO = 3;

/**
 * Quando una partenza si dice **impiantata**: entro questo turno il mazzo ha
 * lanciato meno di questo numero di magie.
 *
 * Si misura dall'esito e non dalla causa, ed è una scelta: una mano che non
 * lancia niente perché le terre mancano e una che non lancia niente perché sono
 * arrivate solo terre sono lo stesso guaio per chi gioca. Le partite chiuse
 * entro il turno della partenza non sono impiantate — hanno già vinto.
 */
export const TURNO_DELLA_PARTENZA = 3;
export const MAGIE_MINIME_ALLA_PARTENZA = 2;
