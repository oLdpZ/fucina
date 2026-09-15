/**
 * **Il primo mazzo costruito dall'app** (ticket 11).
 *
 * L'utente dichiara il tema e preme un tasto; qui dentro si parte da un mazzo
 * iniziale ragionevole, si prova a sostituire una carta alla volta, si tiene lo
 * scambio se il punteggio sale, e ci si ferma quando nessuno scambio migliora
 * più o quando finisce il tempo concesso. Ne esce un mazzo legale da sessanta
 * carte con la sua base di terre.
 *
 * È la **cucitura di test principale** di tutto il progetto:
 * `costruisciMazzo(richiesta, pool) → frontiera`.
 *
 * ## La frontiera (ticket 12)
 *
 * La stessa ricerca si ripete con **pesi diversi dati alla purezza del tema**,
 * dal peso che rende il tema inviolabile a quello che lo ignora quasi del
 * tutto (`PESI_DELLA_PUREZZA`). Ne escono quattro o cinque mazzi allineati dal
 * più fedele al più forte, e con loro il numero che è il fulcro dichiarato del
 * progetto: non la lista, ma il **tasso di cambio** fra originalità e potenza —
 * quanto tema costa il passo successivo, e quanta potenza rende.
 *
 * Due cose tengono in piedi quella lettura, e sono scritte nel codice più sotto:
 *
 * - i **duplicati si scartano**: due pesi vicini che trovano lo stesso mazzo
 *   compaiono una volta sola, se no la frontiera direbbe che c'è un passo dove
 *   non c'è;
 * - i mazzi **dominati si scartano**: resta solo chi, cedendo tema, guadagna
 *   davvero potenza. Così purezza e potenza si muovono in direzioni opposte
 *   lungo tutta la frontiera, e la differenza fra un mazzo e il precedente è
 *   sempre un baratto vero.
 *
 * Il tetto di tempo vale per la **frontiera intera** e non per ogni mazzo: se
 * scade si torna con i mazzi trovati fin lì, dichiarando il troncamento.
 *
 * ## Come questa funzione resta pura
 *
 * `CLAUDE.md` chiede comportamento deterministico e verificabile, e il ticket
 * lo ripete: niente rete, niente orologio, niente caso non seminato, niente
 * disco. Le prime tre si tengono così:
 *
 * - **il caso** arriva dal seme della richiesta, e da lì si derivano le
 *   partenze: `caso(seme)` e nient'altro, mai `Math.random`;
 * - **l'orologio** arriva da fuori, come il seme. Il tetto di tempo esiste
 *   perché la ricerca gira sul telefono, ma un orologio letto di nascosto
 *   renderebbe il risultato dipendente da quanto è veloce la macchina. Chi
 *   chiama passa il suo — il worker passa quello vero, i test ne passano uno
 *   fermo — e il tempo può soltanto **fermare prima** una ricerca che era già
 *   decisa in ogni suo passo;
 * - **il tetto vero** è quello delle valutazioni, che non dipende da nessuna
 *   macchina: `taratura.valutazioniMassimePerPartenza`. È lui a garantire che
 *   due esecuzioni della stessa richiesta, se il tempo basta, diano lo stesso
 *   mazzo byte per byte.
 *
 * Tutte le valutazioni della ricerca usano **lo stesso seme**, non semi diversi
 * a ogni scambio: due mazzi vanno confrontati sulle stesse partite, se no la
 * differenza che si misura è quella fra due mescolate e non quella fra due
 * mazzi.
 */

import { qualitaDiCarta, valutaMazzo, combina, type Punteggio } from "../punteggio/punteggio.js";
import { caso } from "../caso.js";
import {
  comboDichiarata,
  misuraLaCombo,
  risolviCombo,
  type Combo,
  type ComboRisolta,
  type EsitoDellaCombo,
} from "../combo/combo.js";
import type { Orologio } from "../avversario/orologio.js";
import type { Carta } from "../dati/pool.js";
import {
  postiDiTerraRiempibili,
  terreDallaCurva,
  type BaseDiTerre,
  type CopieDiCarta,
} from "../mazzo/base-di-terre.js";
import { copieAlMassimo, copieMassime, entraInMano } from "../mazzo/copie.js";
import {
  comprabile,
  contoDelMazzo,
  nonPeggiora,
  nonSupera,
  prezzoDiUnaCopia,
  quanteCopieCiStanno,
} from "../mazzo/spesa.js";
import { terreCandidate, terrePermesseDalTema } from "../mazzo/terre-candidate.js";
import type { EsitoDellaSimulazione } from "../mazzo/simulazione.js";
import { DIMENSIONE_MAZZO, TERRE_MINIME } from "../mazzo/taratura.js";
import { elenco, terre as terreDette } from "../spiegazioni/frasi.js";
import { valutaTema, type Ampiezza } from "../tema/ampiezza.js";
import { notaDelFuoriTema } from "./nota-del-fuori-tema.js";
import { POSTI_NON_TERRA } from "../tema/taratura.js";
import {
  escluso,
  purezza,
  risolviTema,
  temaDichiarato,
  appartiene,
  type Allargamento,
  type Tema,
  type TemaRisolto,
} from "../tema/tema.js";
import { TARATURA_DELLA_RICERCA, type TaraturaDellaRicerca } from "./taratura.js";

/**
 * La richiesta, nella forma che `spec.md` fissa: è la decisione più difficile
 * da cambiare dopo, ed è scritta lì prima che qui.
 */
export type Richiesta = {
  tema: Tema;
  /**
   * Le carte che l'utente afferma vincano se stanno insieme, **per nome**
   * (ticket 05 della tappa 3). Vuota quando non ne ha dichiarata nessuna.
   *
   * L'app non giudica se quelle carte vincano: le mette nel mazzo al massimo
   * delle copie e non le scambia via. Vedi `combo/combo.ts`.
   */
  combo: Combo;
  /** Il seme del caso: senza, niente di quel che segue è verificabile. */
  seme: number;
  /** Il tetto di tempo, perché la ricerca gira sul telefono. */
  tempoMassimoMs: number;
  /**
   * Il tetto di spesa in euro, oppure `null` quando è **spento** — ed è così
   * che parte (ticket 09).
   *
   * Spento di suo, e non per pigrizia: il fulcro dell'app è il tasso di cambio
   * fra tema e potenza, e un budget acceso di default ne metterebbe un secondo
   * accanto dentro la stessa frontiera. I due prezzi si confonderebbero, e la
   * domanda per cui l'app esiste smetterebbe di avere una risposta leggibile.
   * Lo accende chi sta per comprare.
   *
   * Acceso, è un vincolo **duro**: nessun mazzo consegnato lo supera. E perché
   * quella frase voglia dire qualcosa, ne serve una seconda accanto — nessun
   * mazzo consegnato contiene una carta di cui l'app **non sa il prezzo**
   * (ticket 34). Un prezzo che non si conosce non sta né dentro né fuori dal
   * tetto: contarlo zero farebbe entrare gratis proprio le carte che un listino
   * non ce l'hanno, e la lista uscirebbe dal negozio con un numero scritto sotto
   * che nessuno può mantenere.
   *
   * Vale anche per i **pezzi della combo**, che nel mazzo entrano senza passare
   * dal prezzo (`riempi`): sono la ragione per cui quel mazzo esiste e non si
   * contrattano, ma un tetto acceso sopra una combo che non si sa contare non
   * costruisce niente e lo dice — con dentro i nomi, così che si sappia se
   * spegnere il tetto o cambiare pezzo. Toglierli di mezzo in silenzio sarebbe
   * una combo smontata di nascosto, che è la cosa che quel patto vieta.
   *
   * Vedi `SpesaDellaRicerca` per quel che la ricerca racconta di sé quando lo fa.
   */
  tettoDiSpesa: number | null;
  /**
   * I mazzi del meta contro cui il mazzo costruito deve reggere: gli
   * **orologi**, scritti dall'utente ([ADR-0002](../../docs/adr/0002-avversario-come-orologio-motore-di-regole-rimandato.md)).
   *
   * Entrano nella **richiesta** e non nelle opzioni perché cambiano il mazzo che
   * esce: la corsa è una componente del punteggio, e il punteggio è quel che la
   * ricerca massimizza. Due richieste con orologi diversi sono due richieste
   * diverse, e devono poter dare due mazzi diversi.
   *
   * Vuoti o assenti, la corsa non esiste e la ricerca ordina i mazzi
   * esattamente come faceva prima che la corsa fosse scritta.
   */
  orologi?: readonly Orologio[];
};

/**
 * Quel che la ricerca dichiara di aver fatto col tetto di spesa acceso.
 * `null` sulla frontiera quando il tetto è spento: non c'è niente da dire.
 *
 * Sono numeri e non frasi, come tutto quel che esce di qui: le frasi le compone
 * chi mostra, su questi numeri e mai inventate.
 */
export type SpesaDellaRicerca = {
  /** Il tetto chiesto, in euro. */
  tetto: number;
  /**
   * Quante carte sono rimaste fuori perché **una copia sola** già lo sfonda.
   * Sul pool vero sono le carte migliori che ci siano, e va detto.
   */
  troppoCare: number;
  /**
   * Quante di quelle sono in **Reserved List**: non saranno mai ristampate, e
   * il loro prezzo non scenderà. Aspettare non le porterà dentro il tetto.
   */
  troppoCareRiservate: number;
  /**
   * Quante sono rimaste fuori perché **nessuna copia ammessa ha listino**. Col
   * tetto acceso l'app promette un conto, e non può promettere quel che non sa
   * contare — contarle zero direbbe che sono gratis.
   */
  senzaPrezzo: number;
  /**
   * Il **pavimento**: quanto costano le sessanta copie meno care che restano,
   * terre comprese. Sotto questa cifra nessun mazzo può scendere.
   *
   * Non è il prezzo di un mazzo che esiste, ed è importante non raccontarlo
   * come tale: mette insieme le sessanta carte più economiche senza guardare
   * curva, colori né quante terre servano, e un mazzo vero costa parecchio di
   * più. Serve a una cosa sola — dire di no con dentro un numero, invece di un
   * no che non si può agire — e chi lo mostra deve dirlo per quello che è.
   *
   * `null` quando le copie rimaste non arrivano a sessanta: lì un pavimento per
   * sessanta carte non esiste, e chi mostra non deve nominarne uno. Vedi
   * `mazzoPiuEconomico`.
   */
  minimo: number | null;
  /**
   * Quanti passi della frontiera il tetto ha lasciato **senza mazzo**: il passo
   * un mazzo lo avrebbe, e costa più di quanto è stato chiesto.
   *
   * Serve a una frase sola, ed è una frase che senza questo numero dice il
   * falso. Quando la frontiera resta lunga uno, l'app spiega che cedendo tema
   * non si guadagna potenza da nessuna parte: è vero se i passi mancanti non
   * c'erano, ed è falso se a toglierli è stato il tetto del giocatore — «non
   * c'è niente da guadagnare» e «con questi soldi non si compra quel che si
   * guadagnerebbe» sono due risposte diverse, e la seconda si può agire.
   *
   * Sta dentro `SpesaDellaRicerca` e non accanto a `mazzi` apposta: a tetto
   * spento questo oggetto è `null`, e chi compone la frase non può nemmeno
   * andare a cercare il numero. È il modo strutturale di tenere la promessa che
   * a tetto spento non cambia una parola.
   */
  passiSenzaMazzo: number;
};

/** Quel che la ricerca racconta di sé mentre lavora, per chi mostra una barra. */
export type Avanzamento = {
  /** Il mazzo della frontiera in corso, contato da zero. */
  passo: number;
  /** Quanti mazzi la frontiera prova a cercare: uno per peso della purezza. */
  passi: number;
  /** La partenza in corso, dentro il passo, contata da zero. */
  partenza: number;
  partenze: number;
  /**
   * I mazzi provati finora, dalla **frontiera intera**: tutte le partenze di
   * tutti i passi, sommate. Sale e non torna mai indietro — un contatore che
   * ricominciasse a ogni passo direbbe a chi guarda la barra che il lavoro
   * fatto si è perso.
   */
  valutazioni: number;
  /**
   * Il punteggio del migliore trovato finora **in questo passo**: sale finché
   * il passo dura, e riparte da capo al passo dopo. Non si confronta fra passi
   * diversi — ognuno pesa il tema a modo suo, e sono due scale diverse.
   */
  migliore: number;
};

export type Opzioni = {
  /**
   * L'orologio, in millisecondi che crescono. Arriva da fuori apposta: vedi la
   * nota in testa al file.
   */
  orologio?: () => number;
  avanzamento?: (avanzamento: Avanzamento) => void;
  /** Le manopole di `taratura.ts`, sovrascrivibili una per una. */
  taratura?: Partial<TaraturaDellaRicerca>;
};

/**
 * L'esito, **sempre dichiarato**: anche quando non c'è niente da costruire, chi
 * chiama riceve una risposta e non un'eccezione.
 */
export type Esito =
  /** C'è un mazzo, e il tema aveva carte a sufficienza per riempirlo. */
  | "costruito"
  /** C'è un mazzo, ma il tema non bastava: il resto viene da fuori tema. */
  | "costruito-fuori-tema"
  /** Non c'è un tema: non c'è niente da costruire, e non è un guasto. */
  | "tema-non-dichiarato"
  /** Nemmeno il pool intero, tolte le esclusioni, riempie un mazzo legale. */
  | "niente-da-costruire";

export type MazzoCostruito = {
  /** Le carte non-terra, per costo e poi per nome: si legge come una lista. */
  carte: CopieDiCarta[];
  terre: CopieDiCarta[];
  /** La quota di copie non-terra che appartengono al tema, da `tema.ts`. */
  purezza: number;
  /** Le cinque componenti, **separate**: le spiegazioni ci pescheranno dentro. */
  punteggio: Punteggio;
  base: BaseDiTerre;
  simulazione: EsitoDellaSimulazione;
  /**
   * Le cinque componenti combinate in un numero: la **potenza**, l'asse contro
   * cui si legge la purezza lungo la frontiera. Si mostra accanto alle
   * componenti, non al posto loro — è la componente separata che spiega, questo
   * numero serve solo a dire quale mazzo è più forte di quale.
   */
  potenza: number;
  /**
   * La combo dichiarata, misurata su **questo** mazzo: quante copie di ogni
   * pezzo ci sono finite e che probabilità danno di averla assemblata al turno
   * della taratura. `null` quando l'utente non ne ha dichiarata nessuna — e
   * `null` e non zero, perché zero sarebbe la risposta a una domanda che
   * nessuno ha fatto.
   */
  combo: EsitoDellaCombo | null;
  /**
   * Il peso della purezza con cui **questo** mazzo è stato cercato. Sta qui
   * perché la frontiera sia verificabile: è la manopola che l'ha prodotto.
   */
  peso: number;
  /**
   * Quanto costa il passo dal mazzo precedente della frontiera: tema ceduto e
   * potenza guadagnata. `null` sul primo, che un precedente non ce l'ha.
   *
   * Sono le due differenze già fatte, e non due numeri da rifare a mano nella
   * schermata: il ticket chiede che l'utente le legga, e si leggono da qui.
   */
  passo: PassoDellaFrontiera | null;
  /**
   * Il numero solo con cui la ricerca ha ordinato i mazzi: la potenza più la
   * purezza per il suo peso. Sta qui perché sia verificabile, non perché si
   * mostri — quel che si mostra sono le componenti.
   */
  totale: number;
  /**
   * Quanto costa comprare **questo** mazzo, terre comprese, ai prezzi delle
   * stampe che il pool ha scelto: una stima al ribasso, e va detto ovunque si
   * mostri (`mazzo/spesa.ts`). Le carte senza listino non lo alzano.
   *
   * **Col tetto acceso è un totale e non un minimo**, e non per fortuna: un
   * mazzo con dentro una carta che l'app non sa prezzare non si consegna affatto
   * (`Richiesta.tettoDiSpesa`), quindi qui non ne arriva nessuno. A tetto spento
   * la promessa non c'è e il numero resta quel che è sempre stato — la stima al
   * ribasso che l'avviso dichiara.
   */
  spesa: number;
};

/** Il baratto fra un mazzo della frontiera e quello prima di lui. */
export type PassoDellaFrontiera = {
  /** Il tema ceduto: quota di copie non-terra, sempre maggiore di zero. */
  purezzaCeduta: number;
  /** La potenza guadagnata in cambio: sempre maggiore di zero. */
  potenzaGuadagnata: number;
};

export type Frontiera = {
  esito: Esito;
  /** La frase che dice l'esito, riempita di numeri veri e mai inventata. */
  motivo: string;
  /** Il verdetto sul tema, lo stesso che la schermata dei vincoli ha mostrato. */
  ampiezza: Ampiezza;
  /**
   * La combo dichiarata come il pool di oggi la vede: i pezzi trovati e i guai
   * — un nome sparito, uno che il tema esclude, una terra. I guai stanno qui e
   * non nei mazzi perché non dipendono dal mazzo: sono della richiesta.
   */
  combo: ComboRisolta;
  /**
   * I mazzi, **dal più fedele al tema al più forte**: purezza che scende e
   * potenza che sale, passo dopo passo. Vuota quando non c'è niente da
   * costruire; mai più lunga dei pesi provati, e più corta quando due pesi
   * hanno trovato lo stesso mazzo o quando il tempo è scaduto per strada.
   */
  mazzi: MazzoCostruito[];
  /** Il tetto di spesa e quel che ha lasciato fuori; `null` quando è spento. */
  spesa: SpesaDellaRicerca | null;
  allargamentiApplicati: readonly Allargamento[];
  troncataPerTempo: boolean;
  /**
   * Le partenze di **ogni passo** della frontiera: dentro un passo la ricerca
   * si rifà da più parti e tiene la migliore. Le partenze davvero provate sono
   * queste per il numero di mazzi cercati, e quel numero è `mazzi.length` solo
   * quando nessun passo è stato scartato — per questo qui ce n'è una sola, ed è
   * quella di un passo.
   */
  partenze: number;
  scambiProvati: number;
  scambiTenuti: number;
};

/**
 * L'orologio vero, per chi non ne passa uno. Non è mai quello che i test usano.
 */
export function orologioDiSistema(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

/**
 * Sotto questa differenza due **punteggi** si dicono pari, e lo scambio non si
 * tiene.
 *
 * Vale per i voti della ricerca, che sono numeri astratti senza unità. Le cifre
 * in euro hanno la loro tolleranza e la loro ragione, e stanno coi prezzi
 * (`nonSupera`, in `mazzo/spesa.ts`): un miliardesimo su un prezzo non vuol
 * dire niente, e un mezzo centesimo su un punteggio nemmeno.
 *
 * L'eccezione è `penalitaDiSpesa`, che se ne serve come **divisore minimo** per
 * non dividere per un tetto a zero. Lì non confronta niente: è solo il numero
 * positivo più piccolo che il file abbia già.
 */
const PARI = 1e-9;

/**
 * Quanto conta uno sforamento del tetto di spesa nel voto della ricerca.
 *
 * Dieci volte lo sforamento in quota, moltiplicato per il peso della purezza:
 * al peso più stretto — duecento — un uno per cento di sforamento vale venti
 * punti, e una copia di tema ne vale sei. È scelto per **vincere sempre** sul
 * tema, non per pareggiarlo: un mazzo fuori dal tetto non si può consegnare, e
 * la ricerca non deve passarci il suo tempo.
 */
const PESO_DELLO_SFORAMENTO = 10;

/**
 * Il portafoglio con cui si riempie una partenza e si prova uno scambio.
 *
 * `riservaPerLeTerre` non è un dettaglio: la base di terre **non sta nella
 * selezione** — la sceglie `analizzaBaseDiTerre` dalla curva — e chi riempie
 * deve lasciare da parte quel che costerà, se no spende tutto in carte e il
 * mazzo esce dal tetto per colpa di quel che l'utente non ha scelto.
 *
 * È il **pavimento**: quel che costa la base più economica che il codice sappia
 * produrre per quel numero di posti. Non è una stima e non ha bisogno di
 * esserlo, perché da quando la base sa quanto può spendere (ticket 20) non è
 * più lei a dover indovinare: le si dice quanto è rimasto e lei scende fin lì.
 * Quel che va lasciato da parte è dunque solo il minimo sotto cui una base non
 * può costare — e quello si misura, non si stima.
 *
 * «Più economica che il codice sappia produrre» e non «più economica che
 * esista», ed è una differenza vera: la discesa è avida e si ferma quando
 * nessuna rinuncia abbassa più il conto, quindi il numero che esce può essere
 * sopra l'ottimo. Ed è per questo che si **limita al tetto**: un pavimento più
 * alto del tetto lascerebbe alle carte un budget negativo, che è esattamente
 * il guasto che questo ticket è venuto a togliere. Su un mazzo nero a 11 € le
 * ventitré paludi ne costano 11,96, e senza il limite si tornerebbe da capo.
 *
 * ## Perché non è più il prezzo della base che il mazzo vorrebbe
 *
 * Perché quel numero non era limitato da niente e poteva superare il tetto. La
 * base di prova si sceglieva **senza guardare il prezzo**: bastava che una
 * terra doppia da centinaia di euro entrasse fra le comprabili perché la
 * riserva prendesse quattro copie e diventasse più grande del tetto intero. Da
 * lì il budget per le carte era negativo, nessuna copia di niente era
 * concessa, e ogni scambio che alzasse il prezzo era rifiutato per sempre: più
 * soldi l'utente dichiarava, peggio l'app costruiva — e da un certo punto in
 * poi non costruiva più. Sul pool del 2026-09-07 il gradino stava fra 470 € e
 * 480 €, e lo faceva una sola carta.
 *
 * Il conto vero lo fa `punteggioDi` sul mazzo intero, ed è quello a decidere
 * che cosa si consegna: qui si lascia solo il posto perché una base ci stia.
 */
type Portafoglio = {
  tetto: number;
  riservaPerLeTerre: number;
};

/** Quanto si può spendere in carte non-terra, lasciata da parte la base. */
function tettoPerLeCarte(portafoglio: Portafoglio): number {
  return portafoglio.tetto - portafoglio.riservaPerLeTerre;
}

/**
 * Quanto costano le copie di una selezione, terre escluse perché non ci sono.
 *
 * Somma la mappa invece di passare da `voci()`: gira dentro il ciclo degli
 * scambi, che è il ciclo su cui il tetto di tempo del telefono si spende, e
 * un elenco nuovo a ogni scambio provato sarebbe spazzatura per niente.
 */
function prezzoDellaSelezione(selezione: Selezione): number {
  let totale = 0;
  for (const voce of selezione.values()) {
    const euro = prezzoDiUnaCopia(voce.carta);
    if (euro !== null) totale += euro * voce.copie;
  }
  return totale;
}

/**
 * Il mazzo più economico che queste carte permettano: le sessanta copie meno
 * care, prese dalle carte e dalle terre insieme.
 *
 * È un minimo **vero** e non una stima — nessun mazzo legale di sessanta carte
 * costruito con queste carte può costare meno — e per esserlo prende da ogni
 * carta tutte le copie che il suo tetto le concede, terre base comprese, che di
 * tetto non ne hanno. Serve a dire di no con dentro il numero che ci vorrebbe.
 *
 * Torna `null` quando le copie non arrivano a sessanta, ed è quella promessa
 * presa sul serio. Chi costruisce quel caso non lo incontra — `postiRiempibili`
 * lo ferma prima, a tetto acceso come a tetto spento — ma le uscite che
 * arrivano ancora prima (nessuna terra, posti non-terra scoperti) dichiarano la
 * spesa lo stesso, e lì un pavimento che non esiste va detto `null` invece che
 * arrotondato. Prima il ciclo usciva a copie finite e restituiva la **somma
 * parziale**, che l'app mostrava come pavimento: con un tetto da cinque
 * centesimi il pool vero lascia tredici carte per cinquantadue copie, e la
 * frase diceva «tanto costano le sessanta carte meno care» sopra un conto che
 * ne aveva contate cinquantadue. Un numero preciso e falso — e chi prova
 * «quanto poco posso spendere?» ci arriva al primo tentativo.
 *
 * Non era un guasto del calcolo, che sommava giusto, ma della **promessa**: un
 * minimo per sessanta carte non si può dire quando sessanta carte non ci sono.
 * La cosa vera, e più utile, è che con quelle carte un mazzo legale non esiste
 * affatto, e chi chiama deve poterla dire invece di arrotondare.
 */
function mazzoPiuEconomico(carte: readonly Carta[]): number | null {
  // Qui il tetto è quello nudo, `copieMassime`, e non le quattro copie di chi
  // costruisce: fra queste carte ci sono le terre base, e sessanta posti li
  // riempiono davvero. Il pavimento è quel che il formato permette, non quel
  // che il motore mette.
  const prezzi = carte
    .map((carta) => ({ euro: prezzoDiUnaCopia(carta) ?? 0, copie: copieMassime(carta) }))
    .sort((a, b) => a.euro - b.euro);

  let restano = DIMENSIONE_MAZZO;
  let totale = 0;
  for (const voce of prezzi) {
    if (restano <= 0) break;
    const quante = Math.min(voce.copie, restano);
    totale += quante * voce.euro;
    restano -= quante;
  }
  return restano > 0 ? null : totale;
}

/** «1 carta giocabile», «9 carte giocabili»: le frasi non scrivono «1 carte». */
function giocabiliDette(quante: number): string {
  return quante === 1 ? "1 carta giocabile" : `${quante} carte giocabili`;
}

/** Gli euro come si scrivono in una frase: due decimali e il simbolo. */
const EURO = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

function euro(quanti: number): string {
  return EURO.format(quanti);
}

/**
 * Quanto rumore si aggiunge al merito delle carte per far partire la ricerca da
 * un'altra parte. Zero darebbe la stessa partenza tutte le volte; troppo,
 * partenze così brutte da sprecare il tempo che hanno.
 */
const RUMORE_DELLE_PARTENZE = 0.4;

/**
 * Quante volte, in una partenza, le terre possono tornare a seguire la curva.
 *
 * Un tetto serve: meno terre aprono posti per altre carte, altre carte
 * spostano il costo medio, e il costo medio ridice quante terre. Due
 * assestamenti tolgono la deriva grossa; il terzo girerebbe a vuoto.
 */
const ASSESTAMENTI_PER_PARTENZA = 2;

/** La selezione in lavorazione: quante copie per nome, e la carta dietro il nome. */
type Selezione = Map<string, { carta: Carta; copie: number }>;

export function costruisciMazzo(
  richiesta: Richiesta,
  pool: readonly Carta[],
  opzioni: Opzioni = {},
): Frontiera {
  const taratura: TaraturaDellaRicerca = { ...TARATURA_DELLA_RICERCA, ...opzioni.taratura };
  const orologio = opzioni.orologio ?? orologioDiSistema;
  const inizio = orologio();
  const scaduto = (): boolean => orologio() - inizio >= richiesta.tempoMassimoMs;

  const tema = richiesta.tema;
  /** Il tetto di spesa: `null` quando è spento, ed è così che l'app parte. */
  const tetto = richiesta.tettoDiSpesa;
  const ampiezza = valutaTema(pool, tema);
  // La combo si risolve **prima** di qualunque conto, e sul pool intero: un
  // nome sparito va detto anche quando poi non si costruisce niente.
  const comboRisolta = risolviCombo(richiesta.combo, pool, tema);

  // Quel che si potrà dire del tetto di spesa. Nasce vuoto perché le prime due
  // uscite — nessun tema, nessuna carta — arrivano prima che il pool sia stato
  // filtrato, e a quel punto del tetto non c'è ancora niente da raccontare.
  // Senza `passiSenzaMazzo`, che qui non si può ancora sapere: si conta mentre
  // la frontiera gira, e si attacca all'uscita. Il tipo lo dice invece di
  // lasciare uno zero provvisorio in giro a somigliare a una risposta.
  let spesaDichiarata: Omit<SpesaDellaRicerca, "passiSenzaMazzo"> | null = null;

  // I contatori della ricerca stanno **qui sopra** e non accanto al ciclo che
  // li muove, perché `niente` deve poterli leggere: un'uscita che arriva dopo
  // che il motore ha girato deve dire i numeri veri, e prima che giri i numeri
  // veri sono zero. Dichiararli dopo li renderebbe illeggibili proprio nella
  // funzione che ne ha bisogno.
  let scambiProvati = 0;
  let scambiTenuti = 0;
  let valutazioni = 0;
  let troncata = false;
  /**
   * Se il ciclo della frontiera è partito. Serve a una cosa sola: `partenze`
   * non è un contatore ma il numero di partenze **per passo** che la taratura
   * dichiara, e dirlo prima che si sia cercato qualcosa vorrebbe dire annunciare
   * un lavoro che nessuno ha fatto.
   */
  let laRicercaHaGirato = false;
  /** I passi che il tetto ha lasciato senza mazzo. Vedi `SpesaDellaRicerca`. */
  let passiSenzaMazzo = 0;

  /** Il tetto e quel che ha lasciato fuori, col conto dei passi aggiornato. */
  const spesaDaDichiarare = (): SpesaDellaRicerca | null =>
    spesaDichiarata === null ? null : { ...spesaDichiarata, passiSenzaMazzo };

  /**
   * L'uscita che non consegna nessun mazzo.
   *
   * Ce ne sono di due specie, e la differenza è tutta in quel che dichiarano.
   * Le prime — nessun tema, nessuna carta, tetto sotto il minimo — arrivano
   * **prima** che il motore giri, e per loro zero partenze e nessun troncamento
   * sono la verità. L'ultima, «nessun mazzo sta dentro il tetto», arriva
   * **dopo**: lì i contatori valgono quel che valgono, e un troncamento per
   * tempo va detto — se no l'app annuncia che un mazzo non c'è avendo guardato
   * metà di quel che poteva, e `Costruzione.tsx` tiene nascosta la nota del
   * tempo proprio nel caso in cui serve.
   *
   * Per questo qui non c'è nessun letterale: si leggono i contatori, che
   * rispondono la verità a tutte e due le specie senza doverle distinguere.
   */
  const niente = (esito: Esito, motivo: string): Frontiera => ({
    esito,
    motivo,
    ampiezza,
    combo: comboRisolta,
    mazzi: [],
    // La spesa si dichiara **anche** quando non si costruisce niente, e a
    // maggior ragione: è spesso il tetto la ragione per cui non si costruisce.
    spesa: spesaDaDichiarare(),
    allargamentiApplicati: tema.allargamenti,
    troncataPerTempo: troncata,
    partenze: laRicercaHaGirato ? taratura.partenze : 0,
    scambiProvati,
    scambiTenuti,
  });

  if (!temaDichiarato(tema)) {
    return niente(
      "tema-non-dichiarato",
      "Non hai ancora detto che mazzo vuoi: senza un tema non c'è niente da costruire.",
    );
  }

  // Le esclusioni vincono su tutto e valgono anche per le terre: la base la
  // sceglie l'app, ma dentro i limiti che l'utente ha dichiarato.
  const terrePermesse = terrePermesseDalTema(pool, tema);
  const giocabiliPermesse = pool.filter(
    // Che cosa non sia una terra lo dice `entraInMano`, che è la stessa regola
    // con cui le carte entrano nel mazzo dal catalogo e rientrano da un file
    // salvato: il motore non deve poter costruire un mazzo che l'app poi non si
    // lascia tenere in mano (ticket 51).
    (carta) => entraInMano(carta) && !escluso(carta, tema),
  );

  // Il tetto di spesa, quando è acceso, è il **secondo** filtro e non il primo:
  // il tema decide che mazzo si vuole, il prezzo decide che cosa si può
  // comprare. Nell'ordine inverso l'app risponderebbe prima sul portafoglio, che
  // è esattamente quel che il ticket 09 le vieta.
  const terreDelPool = terreCandidate(pool, tema, tetto);
  const giocabili = giocabiliPermesse.filter((carta) => comprabile(carta, tetto));

  spesaDichiarata =
    tetto === null
      ? null
      : (() => {
          const fuori = [...giocabiliPermesse, ...terrePermesse].filter(
            (carta) => !comprabile(carta, tetto),
          );
          const troppoCare = fuori.filter((carta) => prezzoDiUnaCopia(carta) !== null);
          return {
            tetto,
            troppoCare: troppoCare.length,
            troppoCareRiservate: troppoCare.filter((carta) => carta.riservata).length,
            senzaPrezzo: fuori.length - troppoCare.length,
            minimo: mazzoPiuEconomico([...giocabili, ...terreDelPool]),
          };
        })();

  if (terreDelPool.length === 0) {
    return niente(
      "niente-da-costruire",
      tetto === null
        ? "Non è rimasta nessuna terra fra quelle che il tema permette, e un mazzo senza terre non si gioca."
        : `Dentro ${euro(tetto)} non resta nessuna terra fra quelle che il tema permette, e un mazzo senza terre non si gioca.`,
    );
  }

  // La capienza si conta con **lo stesso tetto** con cui poi si riempie il
  // mazzo: quattro copie per carta, anche per le carte che se ne concedono
  // infinite. Contarle diversamente vorrebbe dire rispondere «si fa» e poi
  // consegnare un mazzo da cinquantotto carte, che non e legale.
  const capienza = capienzaDi(giocabili);
  if (capienza < POSTI_NON_TERRA) {
    return niente(
      "niente-da-costruire",
      tetto === null
        ? `Restano ${giocabiliDette(giocabili.length)}, buone per ${capienza} posti: un mazzo ne chiede almeno ${POSTI_NON_TERRA}.`
        : `Dentro ${euro(tetto)} restano ${giocabiliDette(giocabili.length)}, buone per ${capienza} posti: un mazzo ne chiede almeno ${POSTI_NON_TERRA}.`,
    );
  }

  // E il controllo gemello del gemello: i posti non-terra si riempiono, ma i
  // posti in tutto — terre comprese — non arrivano a sessanta. È la stessa
  // promessa del ticket 09, «un mazzo intero oppure niente, mai un mazzo
  // corto», per la strada che quel ticket non guardava.
  //
  // Sta **qui** e non dentro il racconto del tetto di spesa, dov'era: contare
  // le copie che ci sono non è una domanda sul prezzo, e `SpesaDellaRicerca` a
  // tetto spento è `null` — legarcela voleva dire farla solo a chi il tetto lo
  // accende, e consegnare a tutti gli altri trentanove carte chiamandole un
  // mazzo costruito (ticket 33).
  const posti = postiRiempibili(giocabili, terreDelPool);
  if (posti.nonTerra + posti.terra < DIMENSIONE_MAZZO) {
    // Quando i posti di terra sono zero **e le terre no**, il numero da solo si
    // legge come una contraddizione: «dodici terre, buone per zero posti».
    // Quel che manca ha un nome, e dirlo è la differenza fra un no e un no su
    // cui si può agire — la base si riempie di terre base, e senza nemmeno una
    // le terre a due colori non fanno una base da sole.
    const conto =
      posti.terra === 0 && terreDelPool.length > 0
        ? `buone per ${posti.nonTerra} posti non-terra e ${posti.terra} di terre: fra quelle rimaste non c'è nessuna terra base, e la base di un mazzo si riempie con quelle. Un mazzo chiede ${DIMENSIONE_MAZZO} posti in tutto.`
        : `buone per ${posti.nonTerra} posti non-terra e ${posti.terra} di terre, e un mazzo ne chiede ${DIMENSIONE_MAZZO} in tutto.`;
    return niente(
      "niente-da-costruire",
      tetto === null
        ? `Restano ${giocabiliDette(giocabili.length)} e ${terreDette(terreDelPool.length)}: ${conto}`
        : `Dentro ${euro(tetto)} restano ${giocabiliDette(giocabili.length)} e ${terreDette(terreDelPool.length)}: ${conto}`,
    );
  }

  // Il conto si fa **prima** di cercare, e non dopo aver cercato invano: le
  // sessanta copie meno care che queste carte permettano sono un minimo vero, e
  // se non ci stanno nel tetto nessun mazzo ci starà. Un no dato subito, con
  // dentro il numero che ci vorrebbe, si può agire; otto secondi di ricerca e
  // poi un no senza numero, no.
  // Qui il pavimento c'è di sicuro: la domanda che lo precede — sessanta copie
  // ci sono? — l'ha già fatta la guardia qui sopra, a tetto acceso come a tetto
  // spento. Resta il confronto, che invece del prezzo parla davvero.
  if (spesaDichiarata !== null) {
    const { tetto: chiesto, minimo } = spesaDichiarata;
    if (minimo !== null && !nonSupera(minimo, chiesto)) {
      return niente(
        "niente-da-costruire",
        `Dentro ${euro(chiesto)} un mazzo non si fa: le sessanta carte meno care che restano ne costano ${euro(minimo)}.`,
      );
    }
  }

  // I pezzi della combo che l'app **non sa contare**, e il tetto è acceso.
  //
  // Sono l'unica strada per cui una carta senza listino può entrare in un mazzo:
  // tutte le altre passano da `comprabile`, che col tetto acceso le lascia
  // fuori. I pezzi no, di proposito — `riempi` li mette dentro senza chiedere il
  // prezzo, perché sono la ragione per cui questo mazzo esiste — e da lì il
  // tetto saltava in silenzio (ticket 34).
  //
  // Il no si dà **qui**, prima di cercare, e non alla fine: alla fine
  // arriverebbe come «nessun mazzo sta dentro il tetto», con accanto il prezzo
  // di un mazzo che sotto il tetto ci stava — un numero che darebbe da alzare un
  // tetto già abbastanza alto, cioè un consiglio che non porta da nessuna parte.
  // E arriverebbe dopo aver speso tutto il tempo concesso per dire una cosa che
  // si sapeva prima di cominciare.
  //
  // I nomi ci sono perché il no dev'essere agibile: le strade sono due — il
  // tetto o quel pezzo — e senza sapere **quale** pezzo non si può prendere né
  // l'una né l'altra.
  if (tetto !== null) {
    const senzaListino = comboRisolta.pezzi.filter((carta) => prezzoDiUnaCopia(carta) === null);
    if (senzaListino.length > 0) {
      const quali = elenco(senzaListino.map((carta) => carta.nome));
      const uno = senzaListino.length === 1;
      const soggetto = uno ? `${quali} non ha listino` : `${quali} non hanno listino`;
      return niente(
        "niente-da-costruire",
        `${soggetto}, e col tetto acceso l'app non consegna un mazzo di cui non sa dire il prezzo. ` +
          `${uno ? "È un pezzo" : "Sono pezzi"} della combo, e i pezzi entrano al massimo delle copie senza passare dal prezzo: ` +
          `smontarli per far tornare il conto sarebbe smontare la combo di nascosto. ` +
          `Spegni il tetto, oppure togli dalla combo ${uno ? "quella carta" : "le carte"} che non si sa contare.`,
      );
    }
  }

  const risolto = risolviTema(tema, pool);

  /**
   * Il portafoglio con cui si riempie e si scambia: il tetto, e il prezzo della
   * terra più economica rimasta.
   *
   * La seconda serve perché le terre non stanno nella selezione — le sceglie
   * `analizzaBaseDiTerre` dalla curva — e chi riempie deve **lasciare da parte**
   * quel che la base costerà almeno, se no spenderebbe tutto in carte e
   * consegnerebbe un mazzo fuori dal tetto per colpa delle terre.
   */
  /**
   * I pezzi della combo, che nel mazzo entrano **al massimo delle copie** e non
   * si scambiano via: è tutto quel che «crederci» vuol dire, e da lì esce la
   * probabilità più alta che un mazzo da sessanta carte permetta.
   */
  const obbligate = comboRisolta.pezzi;
  const copieObbligate = obbligate.reduce((somma, carta) => somma + copieAlMassimo(carta), 0);
  const nomiObbligati = new Set(obbligate.map((carta) => carta.nome));

  // Non può succedere coi quattro pezzi che l'interfaccia concede — sedici
  // copie sui trentatré posti più stretti — ma una richiesta arriva anche
  // da un file, e un mazzo che non ci sta va detto invece che consegnato monco.
  if (copieObbligate > POSTI_NON_TERRA) {
    return niente(
      "niente-da-costruire",
      `I ${obbligate.length} pezzi rimasti della combo vogliono ${copieObbligate} posti, e un mazzo ne ha ${POSTI_NON_TERRA} da riempire oltre alle terre.`,
    );
  }

  const portafoglio: Portafoglio | null =
    tetto === null
      ? null
      : // Mai più di quel che c'è: una riserva più grande del tetto darebbe alle
        // carte un budget negativo, e da lì la ricerca può solo scendere di
        // prezzo. Il tetto resta comunque garantito dal conto sul mazzo intero.
        { tetto, riservaPerLeTerre: Math.min(tetto, riservaPerLeTerre()) };

  /**
   * Il pavimento della base: quel che costa la base più economica possibile per
   * il numero di posti che questo mazzo le lascia.
   *
   * Si riempie una partenza per sapere **quante** terre servono — è la curva a
   * dirlo, e la curva viene dalle carte — e poi si chiede quella base con un
   * budget di zero: la base scende fino alle sole terre base e dice quanto
   * costa. Il numero che ne esce non può superare il tetto per costruzione,
   * perché è il minimo che una base di quella misura possa costare.
   *
   * È un giro in più prima di cominciare — uno solo, non uno per partenza.
   */
  function riservaPerLeTerre(): number {
    const ordine = [...giocabili].sort(
      (a, b) =>
        qualitaDiCarta(b) - qualitaDiCarta(a) || a.nome.localeCompare(b.nome, "en"),
    );
    const posti = assestaIPosti(ordine, capienza, obbligate);
    const provvisorio = voci(riempi(ordine, posti, obbligate));
    const base = valutaMazzo(provvisorio, terreDelPool, {
      seme: richiesta.seme,
      terreVolute: DIMENSIONE_MAZZO - posti,
      partite: 1,
      budgetPerLeTerre: 0,
    }).base;
    // Il solo minimo: le terre candidate col tetto acceso hanno tutte un
    // listino, e una riserva non è un mazzo da consegnare.
    return contoDelMazzo(base.terre).minimo;
  }

  /* --- La ricerca ------------------------------------------------------- */

  /**
   * Il mazzo meno caro che la ricerca abbia visto, dentro o fuori dal tetto.
   *
   * Serve a una frase sola, ma è la frase che rende agibile un no: quando col
   * tetto acceso non esce niente, dire «il meno caro che ho trovato ne costa
   * tanto» dice di quanto alzare. Un no senza numero lascia a indovinare.
   */
  let spesaPiuBassa = Number.POSITIVE_INFINITY;

  /**
   * Il punteggio di una selezione **col peso che questo passo dà al tema**.
   *
   * `totale` è il numero solo con cui la ricerca ordina i mazzi: la potenza più
   * la purezza per il suo peso. Far scorrere quel peso è tutta la frontiera.
   */
  const punteggioDi = (
    selezione: Selezione,
    posti: number,
    peso: number,
    partite: number | undefined,
  ) => {
    const carte = voci(selezione);
    // Quel che resta alla base dopo queste carte, **esatto**: non una quota
    // decisa a priori ma la sottrazione vera. È il numero che rende la riserva
    // qui sopra un pavimento e non una stima — la base non deve indovinare
    // quanto le tocca, glielo si dice.
    const perLeTerre =
      portafoglio === null ? null : Math.max(0, portafoglio.tetto - contoDelMazzo(carte).minimo);
    const valutato = valutaMazzo(carte, terreDelPool, {
      seme: richiesta.seme,
      // Le terre non si contrattano qui: il numero viene dalla curva, e i posti
      // non-terra sono quel che resta. Passarlo esplicitamente è ciò che tiene
      // il mazzo esattamente a sessanta carte a ogni scambio provato.
      terreVolute: DIMENSIONE_MAZZO - posti,
      budgetPerLeTerre: perLeTerre,
      // Gli orologi arrivano fin qui perché la corsa è una **componente del
      // punteggio**: la ricerca costruisce per non perdere contro il meta, non
      // scopre a cose fatte che perderebbe.
      orologi: richiesta.orologi ?? [],
      ...(partite === undefined ? {} : { partite }),
    });
    const pura = purezza(carte, risolto);
    const potenza = combina(valutato.punteggio);
    // Quel che si paga davvero: le carte **e** le terre che la base ha scelto.
    // Le terre di questo formato non sono un contorno da pochi centesimi — su
    // trentasette terre trentadue non sono base — e un tetto che le ignorasse
    // sarebbe un tetto che non tiene.
    // E quel che non si sa pagare viene via con loro, invece di restare
    // indietro come uno zero: `spesa` da sola non saprebbe di essere monca, e
    // chi la confronta col tetto non avrebbe modo di accorgersene.
    const conto = contoDelMazzo([...carte, ...valutato.base.terre]);
    return {
      carte,
      valutato,
      purezza: pura,
      potenza,
      spesa: conto.minimo,
      incontabili: conto.incontabili,
      totale: potenza + peso * pura,
    };
  };

  /**
   * Quanto pesa sfondare il tetto, nel numero solo con cui la ricerca ordina.
   *
   * Non è il vincolo — il vincolo è che un mazzo fuori dal tetto **non si tiene
   * mai**, più sotto — è la **pendenza** che riporta dentro una ricerca finita
   * fuori: senza, tutti i mazzi sforati varrebbero uguale e la ricerca non
   * saprebbe da che parte scendere.
   *
   * Si misura sullo sforamento in quota del tetto, e cresce col peso della
   * purezza: al peso 200 una copia di tema vale sei punti, e uno sforamento
   * dell'uno per cento deve valere di più, se no il mazzo puro e caro
   * resterebbe in testa a una ricerca che non può consegnarlo.
   */
  const penalitaDiSpesa = (spesa: number, peso: number): number =>
    tetto === null || nonSupera(spesa, tetto)
      ? 0
      : PESO_DELLO_SFORAMENTO * (1 + peso) * ((spesa - tetto) / Math.max(tetto, PARI));

  /**
   * Se un mazzo si può consegnare a chi ha acceso il tetto: sta dentro il
   * numero chiesto, **e** l'app sa contarlo tutto.
   *
   * Le due domande sono una funzione sola perché sono una promessa sola
   * (`Richiesta.tettoDiSpesa`), e scritte in due posti diversi prima o poi
   * diventano due promesse. La seconda non è una cintura in più sulla prima: un
   * mazzo con dentro una carta senza listino **passa** la prima, perché quella
   * carta pesa zero, ed è esattamente così che il tetto saltava (ticket 34).
   *
   * A tetto spento non c'è niente da chiedere: è il prezzo a non avere voce in
   * capitolo, e una carta senza listino è una carta come le altre.
   *
   * «Dentro» è `nonSupera` e non `<=`: il prezzo di un mazzo è una somma di
   * sessanta decimali, e chi riscrive nella casella la cifra che l'app gli
   * mostra deve riavere il mazzo che quella cifra la portava. La ragione per
   * esteso, e l'euro che la misura, stanno coi prezzi.
   */
  const dentroIlTetto = (misurato: { spesa: number; incontabili: readonly Carta[] }): boolean =>
    tetto === null || (nonSupera(misurato.spesa, tetto) && misurato.incontabili.length === 0);

  /**
   * Una ricerca intera con **un** peso: le partenze, gli scambi, e il mazzo
   * migliore che ne esce, rivalutato per intero.
   *
   * Il seme riparte da capo a ogni peso, e non prosegue da dove il peso prima
   * l'aveva lasciato: due passi della frontiera devono partire dagli stessi
   * posti, se no la differenza che l'utente legge fra un mazzo e il precedente
   * sarebbe in parte la differenza fra due mescolate.
   */
  const cerca = (peso: number, passo: number, passi: number): MazzoCostruito | null => {
    const semi = caso(richiesta.seme);
    const candidati = scegliCandidati(giocabili, risolto, taratura, peso);
    let migliore: { selezione: Selezione; posti: number; totale: number } | null = null;

    /**
     * Il voto di una selezione, e se il mazzo che ne esce si può comprare.
     *
     * Sono due cose separate apposta: il **voto** guida la salita e la penalità
     * di spesa lo tira giù quando si sfora, ma quel che si **tiene** lo decide
     * `dentroIlTetto`. Così un mazzo fuori dal tetto può stare sul cammino della
     * ricerca senza mai poter finire in mano a chi ha chiesto un tetto.
     */
    const valuta = (selezione: Selezione, posti: number): { voto: number; dentro: boolean } => {
      valutazioni += 1;
      const misurato = punteggioDi(selezione, posti, peso, taratura.partiteInRicerca);
      // Il meno caro che si sia visto si conta solo sui mazzi che si **sanno**
      // contare: il minimo di un mazzo monco è più basso del suo prezzo, e
      // finirebbe dentro un consiglio — «alzando il tetto fin lì può bastare» —
      // che con quel numero non basterebbe mai.
      //
      // Chi legge `spesaPiuBassa` dà per scontato che restare a infinito voglia
      // dire «il tempo è finito prima di misurare qualcosa», e questa riga è la
      // seconda strada per restarci. Oggi non si percorre: la guardia sui pezzi
      // senza listino ha già detto di no molto prima di arrivare qui, ed è
      // l'unico modo in cui una carta incontabile entra in un mazzo. Se un
      // giorno se ne aprisse un secondo, è di qui che passerebbe, ed è là sotto
      // che si vedrebbe — come una frase sul tempo al posto di quella giusta.
      if (misurato.incontabili.length === 0) {
        spesaPiuBassa = Math.min(spesaPiuBassa, misurato.spesa);
      }
      return {
        voto: misurato.totale - penalitaDiSpesa(misurato.spesa, peso),
        dentro: dentroIlTetto(misurato),
      };
    };

    const racconta = (partenza: number): void => {
      opzioni.avanzamento?.({
        passo,
        passi,
        partenza,
        partenze: taratura.partenze,
        valutazioni,
        migliore: migliore?.totale ?? 0,
      });
    };

    for (let partenza = 0; partenza < taratura.partenze; partenza++) {
      // Ogni partenza ha il suo generatore, derivato dal seme della richiesta:
      // partenze diverse, ma nessuna casuale.
      const generatore = caso(semi.intero(0x100000000));
      const ordine = ordinaPerPartenza(candidati, risolto, peso, partenza, generatore);
      // I posti non-terra non sono liberi: sono sessanta meno le terre che la
      // curva chiede, e non possono superare le copie che il pool sa dare.
      let posti = assestaIPosti(ordine, capienza, obbligate, portafoglio);
      let selezione = riempi(ordine, posti, obbligate, portafoglio);

      // La prima valutazione si fa **sempre**, anche col tempo già scaduto:
      // senza di lei non ci sarebbe nessun mazzo da restituire, e restituire un
      // mazzo c'è scritto nel ticket.
      let misura = valuta(selezione, posti);
      let corrente = misura.voto;
      if (misura.dentro && (migliore === null || corrente > migliore.totale + PARI)) {
        migliore = { selezione, posti, totale: corrente };
      }
      racconta(partenza);

      if (scaduto()) {
        troncata = true;
        break;
      }

      let valutazioniQui = 1;
      let assestamenti = 0;
      let migliorato = true;
      while (migliorato) {
        migliorato = false;
        for (const scambio of scambi(selezione, candidati, generatore, nomiObbligati)) {
          if (valutazioniQui >= taratura.valutazioniMassimePerPartenza) break;
          if (scaduto()) {
            troncata = true;
            break;
          }

          const prova = conLoScambio(selezione, scambio, portafoglio);
          if (prova === null) continue;

          scambiProvati += 1;
          valutazioniQui += 1;
          const provata = valuta(prova, posti);
          if (provata.voto > corrente + PARI) {
            selezione = prova;
            corrente = provata.voto;
            scambiTenuti += 1;
            migliorato = true;
            if (provata.dentro && (migliore === null || corrente > migliore.totale + PARI)) {
              migliore = { selezione, posti, totale: corrente };
            }
            racconta(partenza);
            // Primo miglioramento: si riparte a guardare gli scambi dal mazzo
            // nuovo, invece di finire un giro su un mazzo che non c'è più.
            break;
          }
        }
        if (troncata || valutazioniQui >= taratura.valutazioniMassimePerPartenza) break;

        // Quando nessuno scambio migliora più, le terre tornano a seguire la
        // curva, e se cambiano la ricerca riprende sul mazzo nuovo.
        //
        // Si fa **qui** e non dentro la passata di proposito: durante la
        // passata la base non si tocca, se no quel che si misura fra due mazzi
        // è il cambio di terre e non il cambio di carte. Ma un mazzo che ha
        // finito di migliorare e che nel frattempo ha spostato il suo costo
        // medio vuole un altro numero di terre, e consegnarlo con quelle
        // vecchie vorrebbe dire consegnare un mazzo che l'app stessa direbbe
        // sbagliato.
        if (migliorato || assestamenti >= ASSESTAMENTI_PER_PARTENZA) continue;
        const nuoviPosti = postiPerLaCurva(voci(selezione), capienza);
        if (nuoviPosti === posti) break;
        assestamenti += 1;
        selezione = adatta(selezione, ordine, nuoviPosti, nomiObbligati, portafoglio);
        posti = nuoviPosti;
        misura = valuta(selezione, posti);
        corrente = misura.voto;
        migliorato = true;
        if (misura.dentro && (migliore === null || corrente > migliore.totale + PARI)) {
          migliore = { selezione, posti, totale: corrente };
        }
      }

      if (troncata) break;
    }

    // Col tetto spento `migliore` non è mai nullo: il ciclo delle partenze gira
    // almeno una volta e la sua prima valutazione non è sotto nessuna
    // condizione. Col tetto acceso lo diventa quando **nessuna** delle
    // selezioni provate stava dentro il tetto, e allora questo peso non
    // consegna niente: meglio un passo di frontiera in meno che un mazzo che
    // costa più di quanto è stato chiesto.
    if (migliore === null) return null;

    // Il mazzo che vince si rivaluta **per intero**, con le partite piene: i
    // numeri che l'utente legge non sono quelli sbrigativi della ricerca. E si
    // rivaluta qui, dentro il passo, non alla fine: purezza e potenza dei mazzi
    // della frontiera si confrontano fra loro, e confrontare una misura piena
    // con una sbrigativa direbbe che un passo ha guadagnato quando invece ha
    // solo misurato meglio.
    const finale = punteggioDi(migliore.selezione, migliore.posti, peso, undefined);
    // La rivalutazione piena cambia le partite simulate, non le carte: la spesa
    // che ne esce è la stessa di prima. Il controllo c'è lo stesso, perché è la
    // promessa dell'utente e non una conseguenza da dedurre — il giorno che la
    // base di terre dipendesse anche da altro, questo sarebbe il posto in cui
    // accorgersene invece di consegnare un mazzo fuori dal tetto.
    if (!dentroIlTetto(finale)) return null;
    return {
      carte: [...finale.carte].sort(
        (a, b) =>
          a.carta.valoreDiMana - b.carta.valoreDiMana ||
          a.carta.nome.localeCompare(b.carta.nome, "en"),
      ),
      terre: finale.valutato.base.terre,
      purezza: finale.purezza,
      punteggio: finale.valutato.punteggio,
      base: finale.valutato.base,
      simulazione: finale.valutato.simulazione,
      potenza: finale.potenza,
      combo: comboDichiarata(richiesta.combo)
        ? misuraLaCombo(comboRisolta, finale.carte, finale.valutato.base.dimensioneMazzo)
        : null,
      peso,
      passo: null,
      totale: finale.totale,
      spesa: finale.spesa,
    };
  };

  /* --- La frontiera ----------------------------------------------------- */

  // Un passo per peso, dal tema inviolabile al tema quasi ignorato. Il tetto di
  // tempo è quello della **frontiera intera** — `inizio` è stato letto una
  // volta sola, prima di tutto — e quando scade si esce con i mazzi trovati fin
  // lì, che è quel che il ticket chiede.
  const pesi = taratura.pesiDellaPurezza;
  const trovati: MazzoCostruito[] = [];
  /**
   * Le copie del mazzo più lungo che la ricerca ha prodotto **e scartato**
   * perché corto, o `null` se non ne ha prodotto nessuno.
   *
   * È la rete all'uscita, ed è di proposito una rete e non un secondo conto: un
   * `esito: "costruito"` con meno di `DIMENSIONE_MAZZO` copie è una bugia a
   * prescindere da chi l'ha prodotta, e le guardie che stanno prima di cercare
   * chiudono le strade che si conoscono. Questa chiude anche le altre — una
   * volta la guardia dei posti e la base che le sceglie erano già divergite
   * (ticket 39), e prima ancora i due conti delle terre (ticket 17).
   */
  let corto: number | null = null;
  laRicercaHaGirato = true;
  for (let passo = 0; passo < pesi.length; passo++) {
    const mazzo = cerca(pesi[passo]!, passo, pesi.length);
    // Un passo che non consegna niente l'ha perso per il tetto, e per niente
    // altro: col tetto spento `cerca` un mazzo lo trova sempre. Contarlo qui,
    // e non dentro `cerca`, tiene le due uscite di quella funzione libere di
    // restare due — nessuna selezione dentro il tetto, e la rivalutazione
    // piena che lo sfonda — senza doverle far convergere su un contatore.
    if (mazzo === null) passiSenzaMazzo += 1;
    else {
      const copie = copieDelMazzo(mazzo);
      // Non si consegna un mazzo che non si è contato. E non si conta nemmeno
      // come «passo perso per il tetto»: il tetto non c'entra niente.
      if (copie < DIMENSIONE_MAZZO) corto = Math.max(corto ?? 0, copie);
      else trovati.push(mazzo);
    }
    if (troncata) break;
  }

  /**
   * Il no del tetto di spesa, che deve restare **agibile**: senza un numero
   * lascia a indovinare di quanto alzare.
   *
   * Il numero però non vale sempre lo stesso, ed è la metà che mancava. Da una
   * ricerca finita è il meno caro che il motore abbia visto guardando tutto
   * quel che poteva: alzare fin lì può bastare. Da una ricerca **interrotta** è
   * il meno caro di metà lavoro, e alzare fin lì può non bastare affatto — sono
   * due consigli diversi, e darli con la stessa frase ne rende falso uno.
   *
   * Quando la ricerca è stata troncata così presto da non aver misurato nemmeno
   * un mazzo, un numero non c'è: si dice quello, invece di scrivere «∞ €».
   */
  const nessunoDentroIlTetto = (quanto: number): string => {
    const testa = `Nessun mazzo sta dentro ${euro(quanto)}, e sopra il tetto chiesto non se ne consegna nessuno`;
    // Infinito vuol dire che nessun mazzo è stato misurato, e l'unica ragione
    // per cui può succedere è il tempo scaduto. Vedi `valuta`, che è l'altro
    // posto da cui questo numero potrebbe restare fermo.
    if (!Number.isFinite(spesaPiuBassa)) {
      return `${testa}: il tempo concesso è finito prima che la ricerca ne misurasse anche uno solo, quindi non c'è nemmeno un numero da cui partire. Riprova con più tempo.`;
    }
    const visto = `: il meno caro che la ricerca ha guardato ne costava ${euro(spesaPiuBassa)}.`;
    return troncata
      ? `${testa}${visto} Il tempo concesso è però finito prima che finisse lei: quel numero è il meno caro di mezza ricerca, e alzare il tetto fin lì può non bastare.`
      : `${testa}${visto} È quel che ha visto lei, non il minimo che esista: alzando il tetto fin lì può bastare, ma non è una promessa.`;
  };

  const mazzi = allineaLaFrontiera(trovati);
  const primo = mazzi[0];
  if (primo === undefined) {
    return niente(
      "niente-da-costruire",
      corto !== null
        ? // Col tetto acceso il numero del tetto resta accanto: gli altri passi
          // della frontiera possono essere caduti per il prezzo, e senza «il
          // meno caro che ho guardato costava tanto» chi legge non sa di
          // quanto alzare. Le due cose sono vere insieme, e si dicono insieme.
          `Con queste carte la ricerca arriva a ${corto} copie su ${DIMENSIONE_MAZZO}, e un mazzo corto non si consegna: ` +
          `mancano le carte — o le terre — per finirlo.` +
          (tetto === null ? "" : ` ${nessunoDentroIlTetto(tetto)}`)
        : tetto === null
          ? "La ricerca non ha potuto provare nemmeno un mazzo."
          : nessunoDentroIlTetto(tetto),
    );
  }

  /* --- L'esito, che si legge dal mazzo più puro -------------------------- */

  // La domanda «il tema bastava?» si fa sul **primo** mazzo della frontiera,
  // quello cercato col tema inviolabile: se nemmeno lì il tema ha riempito i
  // posti, non li riempirà da nessun'altra parte. Negli altri mazzi le carte
  // fuori tema ci sono per scelta, ed è la frontiera stessa a dire quanto
  // costano: chiamarle una mancanza sarebbe dire il falso.
  const nelTema = primo.carte.filter((voce) => appartiene(voce.carta, risolto));
  const copieNelTema = nelTema.reduce((somma, voce) => somma + voce.copie, 0);
  const copieTotali = primo.carte.reduce((somma, voce) => somma + voce.copie, 0);
  // Le terre si contano da quelle **scelte**, non da quante se ne erano
  // chieste: la frase deve dire il mazzo che c'è, non quello che si sperava.
  const copieDiTerra = primo.base.terre.reduce((somma, voce) => somma + voce.copie, 0);

  // Il tema bastava a riempire **questo** mazzo? La domanda si fa sui posti
  // che il mazzo ha davvero, non sui trentatre del verdetto di `ampiezza.ts`,
  // che prende il caso piu favorevole al tema e risponde a un'altra domanda.
  //
  // Le carte del tema si contano **da `giocabili`**, cioè da quel che il tetto
  // lascia comprare, ed è la stessa popolazione da cui esce la capienza qui
  // sotto. Accanto c'era `ampiezza.carteDisponibili`, che viene da `valutaTema`
  // e il prezzo non lo guarda affatto: un numero contava le carte comprabili,
  // l'altro tutte, e la frase incolpava il tema di quel che aveva tolto il
  // tetto (ticket 52).
  const nelTemaPermesse = giocabiliPermesse.filter((carta) => appartiene(carta, risolto));
  const nelTemaComprabili = nelTemaPermesse.filter((carta) => comprabile(carta, tetto));
  const capienzaDelTema = capienzaDi(nelTemaComprabili);
  const fuoriTema = capienzaDelTema < copieTotali;
  const esito: Esito = fuoriTema ? "costruito-fuori-tema" : "costruito";

  // Quel che il tema aveva e il prezzo ha tolto, diviso per **le due ragioni
  // per cui `comprabile` dice no**: la carta costa più del tetto, oppure un
  // listino non ce l'ha. È la stessa divisione che fa `spesaDichiarata` qui
  // sopra, e per la stessa ragione — alzare il tetto rimedia alla prima e non
  // rimedierà mai alla seconda. A tetto spento `comprabile` dice sempre sì, e i
  // due conti sono zero.
  const tolteDalPrezzo = nelTemaPermesse.filter((carta) => !comprabile(carta, tetto));
  const troppoCare = tolteDalPrezzo.filter((carta) => prezzoDiUnaCopia(carta) !== null).length;

  const motivo = fuoriTema
    ? notaDelFuoriTema({
        carte: nelTemaComprabili.length,
        capienza: capienzaDelTema,
        posti: copieTotali,
        troppoCare,
        senzaPrezzo: tolteDalPrezzo.length - troppoCare,
        tetto,
      })
    : `Il mazzo più fedele: ${copieTotali + copieDiTerra} carte, di cui ${copieDiTerra} terre, e ${copieNelTema} delle ${copieTotali} carte non-terra sono del tema.`;

  return {
    esito,
    motivo,
    ampiezza,
    combo: comboRisolta,
    mazzi,
    spesa: spesaDaDichiarare(),
    allargamentiApplicati: tema.allargamenti,
    troncataPerTempo: troncata,
    partenze: taratura.partenze,
    scambiProvati,
    scambiTenuti,
  };
}

/* --- L'allineamento della frontiera --------------------------------------- */

/**
 * I mazzi trovati, messi in fila **dal più puro al più forte**, con i duplicati
 * e i dominati tolti di mezzo e il passo calcolato per ognuno.
 *
 * Due tagli, e ognuno risponde a una promessa del ticket:
 *
 * - **il duplicato**: due pesi vicini che convergono sullo stesso mazzo
 *   compaiono una volta sola. Mostrarlo due volte direbbe che fra i due c'è un
 *   passo, e un passo che non costa e non rende non è un passo.
 * - **il dominato**: un mazzo che cede tema senza guadagnare potenza non sta
 *   nella lista. È quel taglio a rendere vera la lettura promessa — purezza che
 *   scende e potenza che sale — invece di lasciarla alla fortuna: senza,
 *   la frontiera sarebbe l'elenco di quel che la ricerca ha trovato, e non il
 *   tasso di cambio che l'utente è venuto a leggere.
 *
 * Il mazzo più puro sopravvive sempre a entrambi i tagli: è il primo della fila
 * e non ha nessuno prima di sé che possa dominarlo.
 */
function allineaLaFrontiera(trovati: readonly MazzoCostruito[]): MazzoCostruito[] {
  const visti = new Set<string>();
  const distinti = trovati.filter((mazzo) => {
    const impronta = improntaDelMazzo(mazzo);
    if (visti.has(impronta)) return false;
    visti.add(impronta);
    return true;
  });

  // Purezza in giù; a parità di purezza, il più forte per primo — così che il
  // gemello più debole cada subito dopo, come un dominato qualunque.
  const ordinati = [...distinti].sort((a, b) => b.purezza - a.purezza || b.potenza - a.potenza);

  const frontiera: MazzoCostruito[] = [];
  for (const mazzo of ordinati) {
    const prima = frontiera[frontiera.length - 1];
    if (prima === undefined) {
      frontiera.push(mazzo);
      continue;
    }
    if (mazzo.potenza <= prima.potenza + PARI) continue;
    frontiera.push({
      ...mazzo,
      passo: {
        purezzaCeduta: prima.purezza - mazzo.purezza,
        potenzaGuadagnata: mazzo.potenza - prima.potenza,
      },
    });
  }
  return frontiera;
}

/** Due mazzi sono lo stesso mazzo quando hanno le stesse copie degli stessi nomi. */
function improntaDelMazzo(mazzo: MazzoCostruito): string {
  return [...mazzo.carte, ...mazzo.terre]
    .map((voce) => `${voce.carta.nome} × ${voce.copie}`)
    .sort()
    .join(" | ");
}

/* --- Le candidate --------------------------------------------------------- */

/**
 * Il merito di partenza di una carta: la sua qualità, più il peso del tema se
 * ci appartiene.
 *
 * È un **ordine di partenza**, non un giudizio: il giudizio lo dà il punteggio
 * del mazzo intero, che guarda curva, colori e sinergie e che una carta sola
 * non può portare. Serve a non far cominciare la ricerca da un mazzo a caso,
 * che con un tetto di tempo addosso vorrebbe dire finire su un mazzo a caso.
 */
function merito(carta: Carta, risolto: TemaRisolto, peso: number): number {
  return qualitaDiCarta(carta) + (appartiene(carta, risolto) ? peso : 0);
}

/**
 * Le candidate si scelgono **col peso di questo passo**, non una volta per
 * tutta la frontiera: col tema inviolabile le carte del tema devono entrare
 * tutte nel giro, col tema quasi ignorato devono entrarci le più forti. Un
 * elenco solo, scelto a un peso di mezzo, taglierebbe fuori proprio le carte su
 * cui i due estremi della frontiera si giocano.
 */
function scegliCandidati(
  giocabili: readonly Carta[],
  risolto: TemaRisolto,
  taratura: TaraturaDellaRicerca,
  peso: number,
): Carta[] {
  // Il merito si calcola **una volta per carta** e non dentro il confronto: un
  // ordinamento ne fa una dozzina per carta, e su quattromilaottocento carte
  // erano cinquanta millesimi di secondo per peso invece di cinque. L'ordine che
  // ne esce è lo stesso — il merito di una carta non cambia mentre si ordina.
  const conMerito = giocabili.map((carta) => ({ carta, merito: merito(carta, risolto, peso) }));
  const ordinate = conMerito
    .sort((a, b) => b.merito - a.merito || a.carta.nome.localeCompare(b.carta.nome, "en"))
    .map((voce) => voce.carta);

  // Il tetto vale se resta comunque di che riempire un mazzo: meglio una
  // ricerca lenta di una ricerca che non ha abbastanza carte per finire.
  let quante = Math.min(taratura.candidatiMassimi, ordinate.length);
  while (
    quante < ordinate.length &&
    ordinate.slice(0, quante).reduce((somma, carta) => somma + copieAlMassimo(carta), 0) <
      DIMENSIONE_MAZZO - TERRE_MINIME
  ) {
    quante += 1;
  }
  return ordinate.slice(0, quante);
}

/**
 * L'ordine con cui una partenza riempie il mazzo. La prima prende le carte
 * migliori e basta; le altre le mescolano un po', per finire in un'altra valle.
 */
function ordinaPerPartenza(
  candidati: readonly Carta[],
  risolto: TemaRisolto,
  peso: number,
  partenza: number,
  generatore: ReturnType<typeof caso>,
): Carta[] {
  if (partenza === 0) return [...candidati];
  const conRumore = candidati.map((carta) => ({
    carta,
    voto: merito(carta, risolto, peso) + generatore.frazione() * RUMORE_DELLE_PARTENZE,
  }));
  return conRumore
    .sort((a, b) => b.voto - a.voto || a.carta.nome.localeCompare(b.carta.nome, "en"))
    .map((voce) => voce.carta);
}

/* --- Il mazzo in lavorazione ---------------------------------------------- */

/**
 * Quante copie non-terra un gruppo di carte sa dare, col tetto con cui il mazzo
 * si riempie davvero: quattro per carta, **anche** per quelle che se ne
 * concedono infinite. Trentatre copie della stessa carta fanno un mazzo legale
 * che non e un mazzo, e non e da li che si costruisce.
 */
function capienzaDi(carte: readonly Carta[]): number {
  return carte.reduce((somma, carta) => somma + copieAlMassimo(carta), 0);
}

/**
 * Le copie che un mazzo costruito porta davvero: carte e terre insieme, come si
 * conta una lista prima di darla all'arbitro.
 */
function copieDelMazzo(mazzo: MazzoCostruito): number {
  return [...mazzo.carte, ...mazzo.terre].reduce((somma, voce) => somma + voce.copie, 0);
}

/**
 * I posti che queste carte sanno riempire, contati **dalle due parti che un
 * mazzo tiene separate**: i posti non-terra e quelli di terra.
 *
 * Non è la somma delle copie disponibili, ed è tutta la differenza. Le due parti
 * non si sostituiscono a vicenda: quattordici carte giocabili da quattro copie
 * fanno cinquantasei copie, e un mazzo non ne prende più di quaranta perché alle
 * terre ne restano venti — le sedici che avanzano non tappano il buco delle
 * terre. Sommare e basta direbbe «sessanta ci sono» sopra un mazzo da trentotto
 * carte, ed è il difetto che questa funzione esiste per non ripetere.
 *
 * Perciò ogni parte si tronca al suo tetto, e i tetti sono quelli con cui il
 * mazzo si riempie davvero: le giocabili a quel che avanza lasciando alle terre
 * le loro minime, le terre al massimo che la base ne mette (`terreDallaCurva`
 * non esce mai da lì).
 *
 * Dentro ogni parte i tetti per carta restano diversi, e apposta: trentatré
 * copie della stessa creatura sono un mazzo legale che non è un mazzo, e di lì
 * non si parte; trenta Paludi in un mazzo nero sono un mazzo normalissimo, e
 * contarle quattro direbbe che un mazzo non si fa quando si fa.
 */
function postiRiempibili(
  giocabili: readonly Carta[],
  terre: readonly Carta[],
): { nonTerra: number; terra: number } {
  return {
    nonTerra: Math.min(capienzaDi(giocabili), DIMENSIONE_MAZZO - TERRE_MINIME),
    // La domanda sulle terre la fa **la base**, e non questa funzione: quante
    // copie il pool concede non è quel che la base ne farà. Senza nemmeno una
    // terra base la base esce con zero terre, non con «meno terre», e contare
    // le copie diceva `TERRE_MASSIME` sopra una base che non si fa (ticket 39).
    terra: postiDiTerraRiempibili(terre),
  };
}

/**
 * La partenza riempita: prima i pezzi della combo, che non si contrattano, poi
 * le carte migliori dell'ordine finché i posti bastano.
 *
 * I pezzi vanno **per primi** e non in fondo: se i posti finissero prima di
 * arrivarci, il mazzo uscirebbe senza la combo che l'utente ha chiesto.
 */
function riempi(
  ordine: readonly Carta[],
  posti: number,
  obbligate: readonly Carta[] = [],
  portafoglio: Portafoglio | null = null,
): Selezione {
  const selezione: Selezione = new Map();
  const resta = portafoglio === null ? null : tettoPerLeCarte(portafoglio);
  let messe = 0;
  let speso = 0;

  /** Quante copie di questa carta il portafoglio lascia prendere. */
  const quantePermette = (carta: Carta, volute: number): number => {
    if (resta === null) return volute;
    const prezzo = prezzoDiUnaCopia(carta) ?? 0;
    if (prezzo <= 0) return volute;
    return Math.min(volute, quanteCopieCiStanno(resta - speso, prezzo));
  };

  // I pezzi della combo entrano **senza chiedere il prezzo**: sono la ragione
  // per cui questo mazzo esiste, e un mazzo che li perdesse risponderebbe a
  // un'altra domanda. Se sfondano il tetto lo sfondano, e il mazzo non si
  // consegna: il no arriva dopo, con dentro il perché, invece di una combo
  // smontata di nascosto.
  //
  // «Dopo» però vale per i pezzi **cari**, non per quelli che un listino non ce
  // l'hanno: quel `?? 0` qui sotto è un pezzo che non paga niente, e un no dato
  // a valle su un conto che li conta zero non arriverebbe mai (ticket 34). Il
  // caso lo intercetta `costruisciMazzo` prima di cercare, e qui non ci arriva.
  for (const carta of obbligate) {
    const copie = Math.min(copieAlMassimo(carta), posti - messe);
    if (copie <= 0) continue;
    selezione.set(carta.nome, { carta, copie });
    messe += copie;
    speso += copie * (prezzoDiUnaCopia(carta) ?? 0);
  }
  for (const carta of ordine) {
    if (messe >= posti) break;
    if (selezione.has(carta.nome)) continue;
    const copie = quantePermette(carta, Math.min(copieAlMassimo(carta), posti - messe));
    if (copie <= 0) continue;
    selezione.set(carta.nome, { carta, copie });
    messe += copie;
    speso += copie * (prezzoDiUnaCopia(carta) ?? 0);
  }

  // Il portafoglio governa **quali** carte entrano, mai **quante** ne entrano.
  // Se i soldi sono finiti prima dei posti si riempie lo stesso, e il mazzo
  // esce fuori dal tetto: a quel punto non si tiene — `valuta` lo scarta — e
  // l'utente sente un no. L'alternativa sarebbe fermarsi qui e consegnare un
  // mazzo da quarantacinque carte, illegale e annunciato come se fosse a posto:
  // fra un no e una bugia si sceglie il no.
  for (const carta of ordine) {
    if (messe >= posti) break;
    const gia = selezione.get(carta.nome)?.copie ?? 0;
    const ancora = Math.min(copieAlMassimo(carta) - gia, posti - messe);
    if (ancora <= 0) continue;
    selezione.set(carta.nome, { carta, copie: gia + ancora });
    messe += ancora;
  }
  return selezione;
}

function voci(selezione: Selezione): CopieDiCarta[] {
  return [...selezione.values()].map((voce) => ({ carta: voce.carta, copie: voce.copie }));
}

/**
 * I posti non-terra che questo mazzo chiede: sessanta meno le terre che la
 * curva vuole, e mai piu di quante copie il pool sa dare.
 *
 * Il tetto della capienza non e un dettaglio: senza, un pool ridotto all'osso
 * da esclusioni larghe farebbe uscire un mazzo da cinquantotto carte,
 * annunciato come se fosse a posto.
 */
function postiPerLaCurva(carte: readonly CopieDiCarta[], capienza: number): number {
  const copie = carte.reduce((somma, voce) => somma + voce.copie, 0);
  const costoMedio =
    copie === 0
      ? 0
      : carte.reduce((somma, voce) => somma + voce.carta.valoreDiMana * voce.copie, 0) / copie;
  return Math.min(capienza, DIMENSIONE_MAZZO - terreDallaCurva(costoMedio));
}

/**
 * Quanti posti non-terra ha la partenza.
 *
 * È un punto fisso e si cerca come tale — le terre dipendono dal costo medio,
 * che dipende da quante carte ci stanno — e i giri si contano: due o tre bastano
 * sempre, e se una volta oscillasse ci si ferma con l'ultima risposta invece di
 * girare per sempre.
 */
function assestaIPosti(
  ordine: readonly Carta[],
  capienza: number,
  obbligate: readonly Carta[] = [],
  portafoglio: Portafoglio | null = null,
): number {
  let posti = Math.min(capienza, DIMENSIONE_MAZZO - TERRE_MINIME);
  for (let giro = 0; giro < 5; giro++) {
    const nuovi = postiPerLaCurva(
      voci(riempi(ordine, posti, obbligate, portafoglio)),
      capienza,
    );
    if (nuovi === posti) break;
    posti = nuovi;
  }
  return posti;
}

/**
 * Il mazzo portato a un altro numero di posti, senza rifarlo da capo.
 *
 * Si toglie dalle carte peggiori dell'ordine di partenza e si aggiunge alle
 * migliori: e lo stesso criterio con cui la partenza era stata riempita, e non
 * e un giudizio finale — il giudizio lo dà il punteggio, e la passata dopo
 * rimette mano a queste copie come a tutte le altre.
 */
function adatta(
  selezione: Selezione,
  ordine: readonly Carta[],
  posti: number,
  obbligate: ReadonlySet<string> = new Set(),
  portafoglio: Portafoglio | null = null,
): Selezione {
  const dopo: Selezione = new Map(selezione);
  let copie = [...dopo.values()].reduce((somma, voce) => somma + voce.copie, 0);

  for (let i = ordine.length - 1; i >= 0 && copie > posti; i--) {
    const carta = ordine[i]!;
    // I pezzi della combo non pagano il conto delle terre: sono la ragione per
    // cui questo mazzo esiste.
    if (obbligate.has(carta.nome)) continue;
    const dentro = dopo.get(carta.nome);
    if (dentro === undefined) continue;
    const via = Math.min(dentro.copie, copie - posti);
    if (dentro.copie === via) dopo.delete(carta.nome);
    else dopo.set(carta.nome, { carta: dentro.carta, copie: dentro.copie - via });
    copie -= via;
  }

  // Le copie che si aggiungono passano dal portafoglio come quelle della
  // partenza: `adatta` gira quando le terre cambiano numero, e senza questo un
  // mazzo che era dentro il tetto ne uscirebbe proprio mentre lo si sistema.
  const resta = portafoglio === null ? null : tettoPerLeCarte(portafoglio);
  let speso = resta === null ? 0 : prezzoDellaSelezione(dopo);

  for (const carta of ordine) {
    if (copie >= posti) break;
    const gia = dopo.get(carta.nome)?.copie ?? 0;
    let ancora = Math.min(copieAlMassimo(carta) - gia, posti - copie);
    if (resta !== null) {
      const prezzo = prezzoDiUnaCopia(carta) ?? 0;
      if (prezzo > 0) ancora = Math.min(ancora, quanteCopieCiStanno(resta - speso, prezzo));
    }
    if (ancora <= 0) continue;
    dopo.set(carta.nome, { carta, copie: gia + ancora });
    copie += ancora;
    speso += ancora * (prezzoDiUnaCopia(carta) ?? 0);
  }

  // Come in `riempi`: i posti si riempiono comunque. Un mazzo corto non e un
  // mazzo, e il tetto e gia un vincolo che sa dire di no per conto suo.
  for (const carta of ordine) {
    if (copie >= posti) break;
    const gia = dopo.get(carta.nome)?.copie ?? 0;
    const ancora = Math.min(copieAlMassimo(carta) - gia, posti - copie);
    if (ancora <= 0) continue;
    dopo.set(carta.nome, { carta, copie: gia + ancora });
    copie += ancora;
  }

  return dopo;
}

/* --- Gli scambi ----------------------------------------------------------- */

type Scambio = { fuori: string; dentro: Carta };

/**
 * Gli scambi da provare, in ordine mescolato dal generatore della partenza.
 *
 * Mescolato e non ordinato per merito: la ricerca tiene il **primo**
 * miglioramento che trova, e provare sempre nello stesso ordine vorrebbe dire
 * guardare sempre le stesse carte prima delle altre. L'ordine è comunque
 * deterministico, perché il generatore lo è.
 */
function scambi(
  selezione: Selezione,
  candidati: readonly Carta[],
  generatore: ReturnType<typeof caso>,
  obbligate: ReadonlySet<string> = new Set(),
): Scambio[] {
  const tutti: Scambio[] = [];
  for (const fuori of selezione.keys()) {
    // Un pezzo dichiarato non esce mai dal mazzo, nemmeno se il punteggio
    // salirebbe: l'app non giudica la combo, ci crede.
    if (obbligate.has(fuori)) continue;
    for (const dentro of candidati) {
      if (dentro.nome === fuori) continue;
      // E non ci **entra** nemmeno: al massimo delle copie ci è già, e
      // `conLoScambio` rifiuterebbe comunque una copia in più. Saltarlo qui
      // risparmia la prova, e tiene il pezzo fuori dagli scambi da tutti e due
      // i lati.
      if (obbligate.has(dentro.nome)) continue;
      tutti.push({ fuori, dentro });
    }
  }
  // Fisher-Yates con il generatore della partenza: la stessa mescolata a ogni
  // esecuzione, e una diversa a ogni giro.
  for (let i = tutti.length - 1; i > 0; i--) {
    const j = generatore.intero(i + 1);
    const scambio = tutti[i]!;
    tutti[i] = tutti[j]!;
    tutti[j] = scambio;
  }
  return tutti;
}

/**
 * Il mazzo con una copia in meno di una carta e una in più di un'altra, oppure
 * `null` se lo scambio non si può fare — la carta che entra è già al suo tetto
 * di copie, e quel tetto lo dice la carta, non il codice (`mazzo/copie.ts`). È
 * `copieAlMassimo`, lo stesso di chi conta la capienza e di chi riempie: col
 * tetto nudo una carta che si concede copie illimitate saliva di una a ogni
 * scambio, oltre le quattro su cui la capienza era stata contata.
 *
 * Col tetto di spesa acceso c'è una seconda ragione per dire di no: lo scambio
 * peggiorerebbe la spesa. Che cosa vuol dire, e perché non è «resta sotto»
 * secco, lo dice `nonPeggiora` — che sta in `mazzo/spesa.ts` con gli altri
 * confronti fra cifre in euro, e non qui, perché è di lì che si sbagliano
 * tutti allo stesso modo quando si riscrivono a mano.
 */
function conLoScambio(
  selezione: Selezione,
  scambio: Scambio,
  portafoglio: Portafoglio | null = null,
): Selezione | null {
  const esce = selezione.get(scambio.fuori);
  if (esce === undefined) return null;

  const gia = selezione.get(scambio.dentro.nome)?.copie ?? 0;
  if (gia + 1 > copieAlMassimo(scambio.dentro)) return null;

  if (portafoglio !== null) {
    const attuale = prezzoDellaSelezione(selezione);
    const nuovo =
      attuale - (prezzoDiUnaCopia(esce.carta) ?? 0) + (prezzoDiUnaCopia(scambio.dentro) ?? 0);
    if (!nonPeggiora(nuovo, attuale, tettoPerLeCarte(portafoglio))) return null;
  }

  const dopo: Selezione = new Map(selezione);
  if (esce.copie === 1) dopo.delete(scambio.fuori);
  else dopo.set(scambio.fuori, { carta: esce.carta, copie: esce.copie - 1 });
  dopo.set(scambio.dentro.nome, { carta: scambio.dentro, copie: gia + 1 });
  return dopo;
}
