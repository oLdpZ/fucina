/**
 * Quanto costa comprare il mazzo, e quale stampa ha fatto il conto (ticket 09).
 *
 * Il prezzo di una carta, in questo pool, è il prezzo della **copia ammessa più
 * economica che un listino ce l'abbia** — che non è detto sia la copia che il
 * pool ha scelto per mostrare nome, testo e figura. Le due domande sono due, e
 * la risposta coincide quasi sempre e non sempre. Da qui tutto il resto di
 * questo modulo:
 *
 * - il conto è dichiarato una **stima al ribasso**, sempre e ovunque compaia
 *   (`AVVISO_STIMA_AL_RIBASSO`): è il prezzo di una copia giocabile, e la copia
 *   che il giocatore troverà al banchetto può essere un'altra e costare di più;
 * - ogni voce dice **quale stampa** si compra, perché è quella che si cerca su
 *   Cardmarket e non un'altra, e dice anche **da quale stampa viene il prezzo**
 *   quando non è la stessa (`altraStampaDelPrezzo`);
 * - le carte senza prezzo si contano a parte invece di valere zero: contarle
 *   zero direbbe che sono gratis, che è la bugia più cara di tutte;
 * - le carte della **Reserved List** si nominano, perché il loro prezzo non
 *   scenderà aspettando: non saranno mai ristampate.
 *
 * È un modulo puro e senza dipendenze dall'interfaccia: i numeri si calcolano
 * qui e le frasi le compone chi mostra, sui numeri veri e mai inventati.
 */

import type { Carta, Stampa } from "../dati/pool.js";
import type { CopieDiCarta } from "./base-di-terre.js";

/**
 * L'avviso che accompagna **ogni** prezzo mostrato dall'app.
 *
 * Sta scritto una volta sola perché è una promessa e non una decorazione: due
 * copie diverse della stessa frase diventano, prima o poi, due promesse
 * diverse.
 */
export const AVVISO_STIMA_AL_RIBASSO =
  "Stima al ribasso: ogni prezzo è quello della copia più economica, fra quelle che il formato ammette, " +
  "che su Cardmarket un listino ce l'abbia. La copia che troverai da comprare può essere un'altra, e costare di più.";

/**
 * Sotto questa differenza due cifre in euro si dicono **la stessa cifra**:
 * mezzo centesimo.
 *
 * Non è la tolleranza generica dei numeri con la virgola — quella vale un
 * miliardesimo e sta nella ricerca, dove serve a confrontare due punteggi — ed
 * è in euro apposta, perché in euro è la ragione.
 *
 * La ragione è questa. Il prezzo di un mazzo è la somma di sessanta decimali, e
 * una somma di decimali in binario non torna mai esatta: un mazzo che costa
 * 233,25 € il computer se lo ricorda come 233,25000000000006. All'utente si
 * mostra sempre la cifra **arrotondata al centesimo** — è così che si scrive un
 * prezzo — e chi legge «233,25 €» e riscrive quel numero nella casella del
 * tetto sta chiedendo esattamente quel mazzo. Fra la cifra mostrata e il numero
 * vero ci può stare al massimo **mezzo centesimo**, che è quanto un
 * arrotondamento al centesimo può spostare: perdonare di meno vorrebbe dire
 * rifiutare un mazzo a chi ha scritto il suo prezzo, perdonare di più vorrebbe
 * dire consegnare un mazzo che costa un centesimo più del chiesto.
 *
 * Non si arrotonda invece la spesa dentro il motore, e sarebbe la scorciatoia:
 * la cifra mostrata è già un arrotondamento, e arrotondare anche quella su cui
 * si decide darebbe due arrotondamenti che possono divergere — lo stesso
 * difetto, più difficile da vedere.
 */
export const PARI_IN_EURO = 0.005;

/**
 * `spesa` sta dentro `tetto`, perdonato quel mezzo centesimo?
 *
 * Sta qui, accanto ai prezzi, e non dentro chi confronta: il tetto lo
 * interrogano la ricerca, la base di terre e ogni frase che ne parla, e tre
 * copie della stessa domanda diventano prima o poi tre risposte.
 *
 * Serve dove una delle due parti è una **somma**: il prezzo di un mazzo, il
 * conto di una base. Il prezzo di **una** copia non è una somma — arriva dal
 * listino già scritto al centesimo — e lì il confronto nudo di `comprabile` è
 * esatto per davvero.
 */
export function nonSupera(spesa: number, tetto: number): boolean {
  return spesa <= tetto + PARI_IN_EURO;
}

/**
 * `spesa` costa meno di `altra` di una cifra che in euro si possa scrivere?
 *
 * Non è `nonSupera` rovesciato: quello chiede se una somma **ci sta dentro** una
 * cifra che qualcuno ha scritto, questo confronta **due somme** fra loro e
 * chiede se passando dall'una all'altra si risparmia qualcosa. La domanda la fa
 * la base di terre quando sceglie quale copia togliere per stare nel budget, e
 * la risposta l'utente se la legge: la copia che non ha avuto gli arriva scritta
 * col suo nome e col suo prezzo, e una rinuncia che non abbassa il conto gli
 * racconta un risparmio che non c'è.
 *
 * La soglia è la stessa `PARI_IN_EURO`, e la ragione è un'altra. Ogni prezzo
 * arriva dal listino già scritto al centesimo, quindi due somme di copie che
 * differiscono per davvero differiscono di **almeno un centesimo**; sotto, la
 * differenza è il rumore della somma in binario — un quadrilionesimo, col segno
 * deciso dall'ordine degli addendi. Mezzo centesimo sta a metà fra i due, e li
 * separa entrambi con tutto il margine che c'è: più stretto lascerebbe passare
 * il rumore di somme più lunghe, più largo scambierebbe un centesimo vero per
 * niente.
 *
 * Nemmeno qui si arrotondano le due somme per confrontarle, per la ragione
 * scritta sopra `PARI_IN_EURO`.
 */
export function costaMeno(spesa: number, altra: number): boolean {
  return spesa < altra - PARI_IN_EURO;
}

/** Una riga della lista della spesa: una carta, le sue copie, e il suo conto. */
export type VoceDiSpesa = {
  carta: Carta;
  copie: number;
  /** Il prezzo di **una** copia; `null` quando la stampa scelta non ne ha. */
  euroPerCopia: number | null;
  /** Il prezzo delle copie chieste; `null` per la stessa ragione. */
  euro: number | null;
};

export type ListaDellaSpesa = {
  /** Le voci, **dalla più cara alla meno cara**: è in cima che si decide. */
  voci: VoceDiSpesa[];
  /**
   * Il conto di quel che ha un prezzo, e di nient'altro. Chi lo mostra deve
   * dire «almeno» quando `senzaPrezzo` non è vuota.
   */
  totale: number;
  /** Le voci che un prezzo non ce l'hanno: il totale non le racconta. */
  senzaPrezzo: VoceDiSpesa[];
  /** Le voci in Reserved List: quelle che non diventeranno più economiche. */
  riservate: VoceDiSpesa[];
  /**
   * La data dei prezzi — la più recente fra quelle delle carte, che nel pool
   * vero sono tutte la stessa. `null` su una lista vuota: una data inventata
   * su un conto che non c'è sarebbe una data che non vuol dire niente.
   */
  aggiornatoIl: string | null;
};

/**
 * Una carta si può comprare dentro questo tetto di spesa?
 *
 * Due modi di non poterla: costa più di tutto il tetto **da sola**, oppure la
 * stampa scelta **non ha listino**. Il secondo è quello che sorprende, ed è
 * quello giusto: col tetto acceso l'app promette un conto, e non può promettere
 * quel che non sa contare. Contare zero una carta senza listino la farebbe
 * entrare gratis in ogni mazzo, e sono proprio le carte care a non averlo.
 *
 * Col tetto spento (`null`) passano tutte: è il prezzo a non avere voce in
 * capitolo, non la carta a doversi giustificare.
 *
 * Sta qui e non dentro la ricerca perché lo chiedono in due: la ricerca, per
 * costruire, e la schermata del mazzo, che la base di terre se la rifà da sola.
 * Se lo chiedessero con due regole diverse, il mazzo consegnato non sarebbe
 * quello che la ricerca ha prezzato — e sarebbe il prezzo a saltare.
 */
export function comprabile(carta: Carta, tetto: number | null): boolean {
  if (tetto === null) return true;
  const euro = prezzoDiUnaCopia(carta);
  return euro !== null && euro <= tetto;
}

/** Il prezzo di una copia, `null` quando nessuna copia ammessa ha listino. */
export function prezzoDiUnaCopia(carta: Carta): number | null {
  return carta.prezzo.euro;
}

/**
 * Quanto costa il mazzo, e **che cosa il conto non racconta**.
 *
 * I due pezzi viaggiano insieme apposta, e sono un tipo e non un numero per una
 * ragione precisa (ticket 34). Finché questa funzione restituiva il solo
 * `minimo`, chi lo **mostrava** sapeva di dover dire «almeno» — il commento
 * glielo diceva — ma chi lo **confrontava col tetto di spesa** non lo sapeva
 * affatto, e non aveva modo di saperlo: un mazzo con dentro una carta senza
 * listino la contava zero, stava dentro il tetto per finta, e si consegnava con
 * un prezzo scritto sotto che nessuno poteva mantenere.
 *
 * Con `incontabili` accanto al numero quel confronto non si può più scrivere
 * per sbaglio: chi vuole il minimo deve nominarlo, e nominandolo si ricorda che
 * è un minimo.
 */
export type ContoDelMazzo = {
  /**
   * Le copie di ogni carta che **un prezzo ce l'ha**. Le altre non entrano nel
   * conto e non lo azzerano: è un **minimo** ogni volta che `incontabili` non è
   * vuoto, e vale come totale solo quando lo è.
   */
  minimo: number;
  /**
   * Le carte di cui nessuna copia ammessa ha listino, senza ripetizioni e
   * nell'ordine in cui stavano nel mazzo — e **solo quelle che ci stanno
   * davvero**: una voce a zero copie non è una carta del mazzo. Vuoto è la notizia buona: il `minimo`
   * è il prezzo, e non un pezzo di prezzo.
   */
  incontabili: readonly Carta[];
};

/** Vedi `ContoDelMazzo`: il minimo, e le carte che il minimo non racconta. */
export function contoDelMazzo(voci: readonly CopieDiCarta[]): ContoDelMazzo {
  let minimo = 0;
  const incontabili: Carta[] = [];
  const gia = new Set<string>();
  for (const voce of voci) {
    // Zero copie non sono una carta nel mazzo, e non vanno nominate come tale.
    // Non è un caso di scuola: `scendiNelBudget` prova a togliere una copia alla
    // volta e chiama di qui con la voce già scesa a zero. Legge solo il
    // `minimo`, dove uno zero non fa danno — ma `incontabili` è un elenco di
    // carte che ci sono, e chi lo leggesse da lì rifiuterebbe un mazzo per una
    // carta che non contiene.
    if (voce.copie <= 0) continue;
    const euro = prezzoDiUnaCopia(voce.carta);
    if (euro !== null) {
      minimo += euro * voce.copie;
      continue;
    }
    // Lo stesso nome in due voci — le terre e le carte, un giorno che si
    // incontrassero — è una carta sola da nominare, come in `listaDellaSpesa`.
    if (gia.has(voce.carta.nome)) continue;
    gia.add(voce.carta.nome);
    incontabili.push(voce.carta);
  }
  return { minimo, incontabili };
}

/**
 * La lista della spesa di un mazzo: carte e terre insieme, perché è tutto quel
 * che si compra.
 *
 * Le copie dello stesso nome si sommano: un mazzo che arrivasse con la stessa
 * carta in due voci — le terre e le carte, un giorno che si incontrassero —
 * darebbe due righe da comprare per una carta sola.
 */
export function listaDellaSpesa(mazzo: readonly CopieDiCarta[]): ListaDellaSpesa {
  const perNome = new Map<string, { carta: Carta; copie: number }>();
  for (const voce of mazzo) {
    const gia = perNome.get(voce.carta.nome);
    if (gia === undefined) perNome.set(voce.carta.nome, { carta: voce.carta, copie: voce.copie });
    else gia.copie += voce.copie;
  }

  const voci: VoceDiSpesa[] = [...perNome.values()].map(({ carta, copie }) => {
    const euroPerCopia = prezzoDiUnaCopia(carta);
    return {
      carta,
      copie,
      euroPerCopia,
      euro: euroPerCopia === null ? null : euroPerCopia * copie,
    };
  });

  // Dalla più cara alla meno cara, e le senza prezzo in fondo: sono l'unica
  // riga che il totale non racconta, e in cima sembrerebbero le più economiche.
  voci.sort((a, b) => (b.euro ?? -1) - (a.euro ?? -1) || a.carta.nome.localeCompare(b.carta.nome, "en"));

  const date = voci
    .map((voce) => voce.carta.prezzo.aggiornatoIl)
    .filter((quando) => quando !== "")
    .sort();

  return {
    voci,
    totale: voci.reduce((somma, voce) => somma + (voce.euro ?? 0), 0),
    senzaPrezzo: voci.filter((voce) => voce.euro === null),
    riservate: voci.filter((voce) => voce.carta.riservata),
    aggiornatoIl: date[date.length - 1] ?? null,
  };
}

/**
 * Come si dice in italiano il codice di una lingua.
 *
 * **Non è** l'elenco delle lingue che il formato ammette, e non va letto così:
 * quello lo dice il documento e mai il sorgente (ADR-0004). Questo è un
 * dizionario di traduzione, e vale per una lingua che il formato ammetta o no.
 *
 * Perché ce ne sia più di una coppia: da quando il prezzo si stacca dalla stampa
 * che descrive la carta, la lingua è spesso l'**unico** pezzo che distingue le
 * due. Sulle carte di Terza le due stampe hanno la stessa edizione e lo stesso
 * numero di collezione, e la riga diventa «FBB 139, italiano · prezzo di FBB
 * 139, francese»: senza il nome della seconda lingua sarebbe un codice di due
 * lettere in mezzo a una frase italiana, cioè la confusione che questa riga
 * esiste per togliere.
 *
 * Una lingua che non è in elenco si scrive col suo codice — dire il codice è
 * meno utile che dire il nome, ma inventare il nome sarebbe peggio di entrambi.
 */
const NOMI_DELLE_LINGUE: Readonly<Record<string, string>> = {
  en: "inglese",
  it: "italiano",
  fr: "francese",
  de: "tedesco",
  es: "spagnolo",
  pt: "portoghese",
  ja: "giapponese",
};

/**
 * La stampa che descrive la carta, come si scriverebbe su un foglietto da
 * portare al negozio: `FBB 139, italiano`.
 *
 * Serve perché il pool ammette più edizioni della stessa carta: senza questa
 * riga, chi cerca su Cardmarket non saprebbe quale guardare né in che lingua.
 * È la copia che il giocatore comprerà; da quale copia venga il **prezzo** lo
 * dice `altraStampaDelPrezzo`, che non è detto sia la stessa.
 */
export function descriviLaStampa(carta: Carta): string {
  return descrivi({
    edizione: carta.edizione,
    numeroDiCollezione: carta.numeroDiCollezione,
    lingua: carta.linguaDellaStampa,
  });
}

/**
 * La stampa da cui viene il **prezzo**, quando non è quella che si mostra;
 * `null` quando è la stessa, e `null` quando un prezzo non c'è.
 *
 * `null` nel caso normale è la decisione, non una scorciatoia: quando le due
 * copie coincidono non c'è niente di speciale da dire, e ripetere la stessa
 * stampa due volte per riga insegnerebbe a saltarla proprio le volte che
 * conta. Quando invece divergono — la carta si compra in una copia e il
 * pavimento viene da un'altra — chi confronta su Cardmarket deve saperlo, o
 * confronta il proprio numero con quello di un'altra carta.
 */
export function altraStampaDelPrezzo(carta: Carta): string | null {
  const stampa = carta.prezzo.stampa;
  if (stampa === null) return null;
  if (
    stampa.edizione === carta.edizione &&
    stampa.numeroDiCollezione === carta.numeroDiCollezione &&
    stampa.lingua === carta.linguaDellaStampa
  ) {
    return null;
  }
  return descrivi(stampa);
}

/**
 * Le parole con cui si introduce la stampa del prezzo, e sono tre perché tre
 * sono le notizie: `prezzo di` quando a cambiare è la sola lingua, `prezzo di
 * un'altra stampa:` quando cambia il numero di collezione dentro la stessa
 * edizione, `prezzo di un'altra edizione:` quando cambia l'edizione.
 *
 * La distinzione non è pignoleria. Un'altra **lingua** della stessa edizione e
 * dello stesso numero è lo stesso cartoncino con un'altra scritta sopra, e su
 * Cardmarket costa press'a poco uguale: il pavimento regge, e non c'è niente da
 * avvisare. Un'altra **edizione** è un'altra carta da comprare, spesso di
 * un'altra rarità e di un'altra tiratura, e l'euro può essere un ordine di
 * grandezza sotto quello della copia che la lista manda a cercare — è quel che
 * il ticket 30 ha misurato su 326 carte su 753 prima che l'edizione mostrata
 * tornasse a seguire il prezzo (ADR-0007).
 *
 * Il caso di mezzo è il più facile da lasciarsi sfuggire, ed è il motivo per cui
 * queste frasi guardano il **numero di collezione** e non la sola edizione: nel
 * pool vero sono sette carte — le cinque terre base, che dentro la stessa
 * edizione hanno più figure numerate diversamente, e due carte che la Quarta
 * tedesca numera per conto suo. L'edizione è la stessa, ma il numero da cercare
 * al negozio no, e dirlo nel registro più quieto vorrebbe dire chiamarlo «la
 * stessa carta».
 *
 * Le frasi stanno **qui** e non nelle schermate perché sono più d'una, e due
 * componenti che se le riscrivessero per conto proprio finirebbero per dirle in
 * modo diverso.
 */
export function attaccoDelPrezzo(carta: Carta): string {
  const stampa = carta.prezzo.stampa;
  if (stampa === null) return "prezzo di ";
  if (stampa.edizione !== carta.edizione) return "prezzo di un’altra edizione: ";
  if (stampa.numeroDiCollezione !== carta.numeroDiCollezione) return "prezzo di un’altra stampa: ";
  return "prezzo di ";
}

function descrivi(stampa: Stampa): string {
  if (stampa.edizione === "") return "stampa sconosciuta";
  const numero = stampa.numeroDiCollezione === "" ? "" : ` ${stampa.numeroDiCollezione}`;
  const lingua =
    stampa.lingua === "" ? "" : `, ${NOMI_DELLE_LINGUE[stampa.lingua] ?? stampa.lingua}`;
  return `${stampa.edizione.toUpperCase()}${numero}${lingua}`;
}
