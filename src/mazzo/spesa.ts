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
 * Quanto costa il mazzo: le copie di ogni carta che **un prezzo ce l'ha**.
 *
 * Le altre non entrano nel conto e non lo azzerano: il numero che ne esce è un
 * minimo, e chi lo mostra lo dice.
 */
export function prezzoDelMazzo(voci: readonly CopieDiCarta[]): number {
  let totale = 0;
  for (const voce of voci) {
    const euro = prezzoDiUnaCopia(voce.carta);
    if (euro !== null) totale += euro * voce.copie;
  }
  return totale;
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
 * Quale stampa ha fatto il conto, come si scriverebbe su un foglietto da
 * portare al negozio: `4ED 212, inglese`.
 *
 * Serve perché il prezzo è di **quella** stampa e di nessun'altra (storia 14):
 * senza, il numero sarebbe una cifra campata per aria, e chi cerca su
 * Cardmarket non saprebbe quale delle cinque edizioni guardare.
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

function descrivi(stampa: Stampa): string {
  if (stampa.edizione === "") return "stampa sconosciuta";
  const numero = stampa.numeroDiCollezione === "" ? "" : ` ${stampa.numeroDiCollezione}`;
  const lingua =
    stampa.lingua === "" ? "" : `, ${NOMI_DELLE_LINGUE[stampa.lingua] ?? stampa.lingua}`;
  return `${stampa.edizione.toUpperCase()}${numero}${lingua}`;
}
