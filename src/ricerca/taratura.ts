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
   * Quanto pesa la purezza del tema accanto alle cinque componenti.
   *
   * Il vincolo del tema è **morbido** (Q14): un mazzo può contenere carte fuori
   * tema, e questo numero è il prezzo che paga per ognuna. Zero vorrebbe dire
   * ignorare il tema, un numero grande renderlo inviolabile: la frontiera del
   * ticket 12 nascerà proprio dal far scorrere questo peso da un estremo
   * all'altro. Qui ce n'è uno solo, e sta dalla parte del tema — è per il tema
   * che l'utente ha aperto l'app.
   */
  pesoDellaPurezza: number;
};

export const TARATURA_DELLA_RICERCA: TaraturaDellaRicerca = {
  partenze: 4,
  partiteInRicerca: 60,
  valutazioniMassimePerPartenza: 400,
  candidatiMassimi: 90,
  pesoDellaPurezza: 1,
};

/**
 * Quanto tempo l'app si concede, di suo, per costruire un mazzo.
 *
 * Non è una taratura della ricerca ma una **promessa all'utente**: otto secondi
 * sono l'attesa oltre la quale, su un telefono, si pensa che l'app si sia
 * piantata. Superati, la ricerca torna con il meglio che ha trovato e lo dice.
 * Il tetto vero della ricerca resta quello delle valutazioni, che non dipende
 * da quanto è veloce il telefono: qui si mette solo un limite all'attesa.
 */
export const TEMPO_MASSIMO_PREDEFINITO_MS = 8000;
