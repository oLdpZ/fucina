/**
 * Le manopole della ricerca a scambi singoli, tutte in un punto solo e
 * **dichiarate provvisorie**, come ogni altra taratura del progetto.
 *
 * Qui dentro non c'è nessuna verità sul gioco: c'è il compromesso fra quanto la
 * ricerca guarda e quanto fa aspettare chi tiene il telefono in mano. Alla
 * sosta si misura sul pool vero, e questi numeri si spostano.
 *
 * Stanno in un oggetto, e non in tante costanti sparse, perché chi misura deve
 * poterli cambiare **da fuori** senza toccare il codice: `costruisciMazzo`
 * accetta una taratura nella sua terza voce, e i test la stringono per girare
 * in un lampo.
 */

export type TaraturaDellaRicerca = {
  /**
   * Da quante partenze diverse si rifà la ricerca, tenendo la migliore.
   *
   * La ricerca a scambi singoli si ferma al primo posto in cui nessuno scambio
   * migliora, che non è quasi mai il posto migliore: ripartire da un'altra
   * parte è il rimedio più semplice che esista. Le partenze sono **derivate dal
   * seme**, non casuali, altrimenti il determinismo salterebbe.
   */
  partenze: number;

  /**
   * Quante partite si simulano per **ogni** mazzo provato durante la ricerca.
   *
   * Molto meno delle `PARTITE_SIMULATE` di `mazzo/taratura.ts`, e apposta: qui
   * non serve il numero da mostrare all'utente, serve solo poter dire quale di
   * due mazzi è meglio. Il mazzo vincitore viene poi rivalutato per intero, ed
   * è quello il numero che si legge sulla schermata.
   */
  partiteInRicerca: number;

  /**
   * Quanti mazzi si provano al massimo per ogni partenza.
   *
   * È il tetto **deterministico**, quello che non dipende da quanto è veloce la
   * macchina: senza, due esecuzioni della stessa richiesta su due telefoni
   * diversi darebbero due mazzi diversi, e il vincolo di determinismo sarebbe
   * carta straccia. Il tetto di tempo che arriva dalla richiesta può solo
   * fermare la ricerca **prima**, e quando lo fa lo dichiara.
   */
  valutazioniMassimePerPartenza: number;

  /**
   * Quante carte distinte entrano nel giro delle candidate.
   *
   * Ogni candidata in più moltiplica gli scambi da provare, e il pool vero ne
   * conta quasi cinquemila: senza un tetto la ricerca passerebbe tutto il suo
   * tempo sul primo scambio. Si tengono le migliori secondo la qualità della
   * singola carta e l'appartenenza al tema — che è un ordine di partenza, non
   * un giudizio finale: quello lo dà il punteggio del mazzo intero.
   */
  candidatiMassimi: number;

  /**
   * I pesi con cui la purezza del tema entra nel punteggio, **uno per mazzo
   * della frontiera**, dal più fedele al più forte.
   *
   * Il vincolo del tema è **morbido** (Q14): un mazzo può contenere carte fuori
   * tema, e questo peso è il prezzo che paga per ognuna. È da qui che nasce la
   * frontiera del ticket 12: la stessa ricerca, ripetuta con pesi diversi,
   * scrive il **tasso di cambio** fra originalità e potenza invece di
   * sceglierlo al posto dell'utente. Vedi `PESI_DELLA_PUREZZA`.
   */
  pesiDellaPurezza: readonly number[];
};

/**
 * I cinque pesi della frontiera, **dal tema inviolabile al tema quasi
 * ignorato**.
 *
 * Le cinque componenti del punteggio stanno fra zero e uno, e la purezza pure:
 * i pesi si leggono contro quella scala.
 *
 * - **200** non è un peso, è un divieto: una copia in più nel tema vale circa
 *   tre centesimi di purezza, e tre centesimi per duecento battono qualunque
 *   guadagno di potenza esista. È il mazzo più puro che il tema permetta.
 * - **1**, **0,4** e **0,15** sono i passi in mezzo, dove il baratto si vede.
 *   Una copia su trentotto vale poco meno di tre centesimi di purezza, e uno
 *   scambio ne sposta la potenza di uno o due: il tasso di cambio vive lì intorno,
 *   e i tre pesi lo attraversano invece di stringersi tutti da una parte.
 * - **0,05** lo **ignora quasi del tutto** — «quasi», e non «del tutto», perché
 *   a parità di potenza è giusto che vinca il mazzo più fedele: l'utente ha
 *   aperto l'app per il tema, non contro.
 *
 * Sono cinque perché il ticket ne chiede quattro o cinque; se due pesi vicini
 * danno lo stesso mazzo, il duplicato si scarta e la frontiera ne mostra meno.
 * Come ogni taratura del progetto, alla sosta si misurano e si spostano.
 */
export const PESI_DELLA_PUREZZA: readonly number[] = [200, 1, 0.4, 0.15, 0.05];

/**
 * Le manopole, **divise per cinque**: dal ticket 12 il tetto di tempo non paga
 * più una ricerca ma la frontiera intera, e cinque ricerche con il budget di
 * prima sfondavano gli otto secondi promessi tornando con due mazzi su cinque e
 * il troncamento dichiarato — che è onesto, ma non è quel che il ticket chiede.
 *
 * Meno partenze e meno partite per mazzo provato: quel che si perde è
 * precisione nel confronto fra due mazzi vicini, quel che si guadagna è la
 * frontiera intera dentro l'attesa promessa. È un compromesso, non una verità,
 * e alla sosta (ticket 14) si misura sul pool vero.
 */
export const TARATURA_DELLA_RICERCA: TaraturaDellaRicerca = {
  partenze: 3,
  partiteInRicerca: 40,
  valutazioniMassimePerPartenza: 260,
  candidatiMassimi: 90,
  pesiDellaPurezza: PESI_DELLA_PUREZZA,
};

/**
 * Quanto tempo l'app si concede, di suo, per costruire la **frontiera intera**.
 *
 * Non è una taratura della ricerca ma una **promessa all'utente**: è l'attesa
 * oltre la quale, su un telefono, si pensa che l'app si sia piantata. Superata,
 * la ricerca torna con i mazzi che ha trovato fin lì e lo dice. Il tetto vero
 * resta quello delle valutazioni, che non dipende da quanto è veloce il
 * telefono: qui si mette solo un limite all'attesa.
 *
 * Erano otto secondi finché il tetto pagava **una** ricerca (ticket 11). Dal
 * ticket 12 ne paga cinque, e otto secondi le troncavano a una o due su un
 * telefono di fascia media: onesto — il troncamento si dichiara — ma la
 * frontiera è il fulcro del progetto, e consegnarne un pezzo per difendere
 * l'attesa vuol dire difendere la cosa sbagliata. Quindici secondi sono
 * un'attesa che si sopporta **perché si vede**: la riga dell'avanzamento dice a
 * che mazzo è arrivata, e il tasto «Ferma» c'è. Alla sosta (ticket 14) si
 * misura sul telefono vero, ed è lì che questo numero si decide davvero.
 */
export const TEMPO_MASSIMO_PREDEFINITO_MS = 15000;
