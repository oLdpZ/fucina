/**
 * **Le spiegazioni** (ticket 13): per ogni scelta che l'app ha fatto, una frase
 * in italiano semplice, e dentro la frase un numero vero.
 *
 * Questo file non scrive nemmeno una parola di italiano: le parole stanno tutte
 * in `frasi.ts`, che si legge tutto insieme senza leggere questo. Qui si fa
 * l'altra metà del lavoro — **si scelgono i numeri** e si dice quale modello di
 * frase raccontano.
 *
 * La regola che tiene in piedi tutto è una sola, ed è quella che il ticket
 * chiede di poter verificare con un test: i numeri non si rifanno qui. Si
 * pescano dai **valori grezzi** che il punteggio e la simulazione hanno già
 * calcolato per quel mazzo (`punteggio.qualita.grezzi`, `punteggio.colori.
 * grezzi`, `punteggio.curva.grezzi`, `base`, `simulazione`) e si riportano
 * dentro la spiegazione così come sono. Un numero ricalcolato qui potrebbe
 * divergere da quello che l'utente legge accanto, e la frase mentirebbe senza
 * che nessuno se ne accorga.
 *
 * La cucitura è `spiegaFrontiera(frontiera, tema, pool)`: si entra da lì, e ne
 * escono le spiegazioni di ogni mazzo, nello stesso ordine della frontiera.
 * Come tutto il motore, è **pura**: nessuna rete, nessun orologio, nessun caso.
 */

import type { Carta } from "../dati/pool.js";
import { casellaDellaCurva, qualitaDiCarta } from "../punteggio/punteggio.js";
import type { Frontiera, MazzoCostruito } from "../ricerca/costruisci.js";
import { appartiene, eTerra, risolviTema, type Tema, type TemaRisolto } from "../tema/tema.js";
import { copieMassime } from "../mazzo/copie.js";
import { probabilitaDiPescarne } from "../mazzo/probabilita.js";
import {
  frasePerIlPasso,
  frasePerLaCombo,
  frasePerLaPresenza,
  frasePerLeCopie,
  frasePerLeTerre,
  frasePerLEsclusione,
  type GrezziDellaCombo,
  type GrezziDelleCopie,
  type GrezziDelleTerre,
  type GrezziDelPasso,
  type GrezziDelRuolo,
  type GrezziDiEsclusione,
  type GrezziDiPresenza,
} from "./frasi.js";

/**
 * Una spiegazione: la frase, e **i numeri che la giustificano**. I due campi
 * viaggiano sempre insieme, ed è il punto: un test può chiedere se la frase
 * dice il numero, e se quel numero è quello del punteggio.
 */
export type Spiegazione<G> = {
  frase: string;
  grezzi: G;
};

export type SpiegazioneDiCarta = {
  nome: string;
  copie: number;
  /** Perché la carta è nel mazzo. */
  perche: Spiegazione<GrezziDiPresenza>;
  /** Perché tante copie e non un altro numero. */
  quante: Spiegazione<GrezziDelleCopie>;
};

export type SpiegazioniDelMazzo = {
  /** Una per carta non-terra, nell'ordine in cui il mazzo le elenca. */
  carte: SpiegazioneDiCarta[];
  /** Le carte del tema rimaste fuori: le più forti, che sono quelle che si notano. */
  esclusioni: Spiegazione<GrezziDiEsclusione>[];
  terre: Spiegazione<GrezziDelleTerre>;
  /** Che cosa cambia rispetto al mazzo precedente. `null` sul primo. */
  passo: Spiegazione<GrezziDelPasso> | null;
  /**
   * La combo dichiarata su questo mazzo, col patto scritto dentro la frase.
   * `null` quando l'utente non ne ha dichiarata nessuna: non c'è niente da
   * dire, e dire zero sarebbe rispondere a una domanda che nessuno ha fatto.
   */
  combo: Spiegazione<GrezziDellaCombo> | null;
};

/**
 * Quel che serve a spiegare, oltre al mazzo: il tema con cui giudicare le carte
 * e il pool da cui cercare quelle rimaste fuori.
 */
export type Contesto = {
  risolto: TemaRisolto;
  pool: readonly Carta[];
};

/**
 * Quante carte del tema rimaste fuori si spiegano. Non è una taratura del
 * motore ma una misura della pazienza di chi legge: sono le più forti, e dopo
 * le prime cinque l'elenco smette di dire qualcosa e comincia a essere lungo.
 */
const ESCLUSIONI_NOTEVOLI = 5;

/**
 * Le spiegazioni di tutta la frontiera, un elenco per mazzo e nello stesso
 * ordine — dal più fedele al tema al più forte.
 *
 * Una frontiera vuota non ha niente da spiegare e non è un guasto: il motivo
 * per cui non c'è nessun mazzo lo dice già `Frontiera.motivo`, che è una frase
 * riempita di numeri veri come queste.
 */
export function spiegaFrontiera(
  frontiera: Frontiera,
  tema: Tema,
  pool: readonly Carta[],
): SpiegazioniDelMazzo[] {
  const contesto: Contesto = { risolto: risolviTema(tema, pool), pool };
  return frontiera.mazzi.map((mazzo, indice) =>
    spiegaMazzo(mazzo, frontiera.mazzi[indice - 1] ?? null, contesto),
  );
}

/** Le spiegazioni di un mazzo solo, col precedente accanto per il passo. */
export function spiegaMazzo(
  mazzo: MazzoCostruito,
  precedente: MazzoCostruito | null,
  contesto: Contesto,
): SpiegazioniDelMazzo {
  return {
    carte: mazzo.carte.map((voce) => spiegaCarta(voce.carta, voce.copie, mazzo, contesto)),
    esclusioni: spiegaLeEsclusioni(mazzo, contesto),
    terre: spiegaLeTerre(mazzo),
    passo: precedente === null ? null : spiegaIlPasso(mazzo, precedente, contesto),
    combo: spiegaLaCombo(mazzo),
  };
}

/* --- Le carte del mazzo ---------------------------------------------------- */

/** Le copie non-terra che appartengono al tema: il numeratore della purezza. */
function copieNelTema(mazzo: MazzoCostruito, contesto: Contesto): number {
  return mazzo.carte
    .filter((voce) => appartiene(voce.carta, contesto.risolto))
    .reduce((somma, voce) => somma + voce.copie, 0);
}

function spiegaCarta(
  carta: Carta,
  copie: number,
  mazzo: MazzoCostruito,
  contesto: Contesto,
): SpiegazioneDiCarta {
  const qualita = mazzo.punteggio.qualita.grezzi;
  const colori = mazzo.punteggio.colori.grezzi;
  const riga = qualita.perCarta.find((voce) => voce.nome === carta.nome);
  const probabilita = colori.perCarta.find((voce) => voce.nome === carta.nome);

  // Le due righe ci sono sempre: il punteggio le calcola per ogni carta
  // non-terra del mazzo, e queste sono le carte non-terra di quel mazzo. Se un
  // giorno mancassero, la carta si spiega col solo posto che occupa invece di
  // far cadere l'app: una spiegazione più povera è meglio di una schermata rotta.
  const turno = probabilita?.turno ?? Math.max(1, carta.valoreDiMana);

  // Il modo del vantaggio sceglie la frase **e** il conto che le sta accanto: i
  // due modi si raccontano diversi e si contano a parte (ticket 78).
  const spazzaVia = riga?.modoDelVantaggio === "spazza-via";

  const ruolo: GrezziDelRuolo =
    riga !== undefined && riga.risposta > 0
      ? {
          ruolo: "risposta",
          incondizionata: riga.risposta >= 1,
          copieCheLoFanno:
            riga.risposta >= 1 ? qualita.risposteIncondizionate : qualita.risposteCondizionali,
          copieNonTerra: mazzo.base.copieNonTerra,
        }
      : riga !== undefined && riga.vantaggio > 0
        ? {
            ruolo: "vantaggio",
            modo: spazzaVia ? "spazza-via" : "pesca",
            copieCheLoFanno: spazzaVia ? qualita.carteCheSpazzano : qualita.carteChePescano,
            copieNonTerra: mazzo.base.copieNonTerra,
          }
        : riga !== undefined && riga.creatura
          ? {
              ruolo: "corpo",
              valoreDiMana: carta.valoreDiMana,
              forza: carta.forza,
              costituzione: carta.costituzione,
              efficienza: riga.efficienza,
              efficienzaMedia: qualita.efficienzaMedia,
            }
          : {
              ruolo: "posto",
              turno,
              probabilitaDiMana: probabilita?.probabilita ?? 0,
            };

  const presenza: GrezziDiPresenza = {
    nome: carta.nome,
    copie,
    nelTema: appartiene(carta, contesto.risolto),
    copieNelTema: copieNelTema(mazzo, contesto),
    copieNonTerra: mazzo.base.copieNonTerra,
    ruolo,
  };

  const quante: GrezziDelleCopie = {
    nome: carta.nome,
    copie,
    massimo: copieMassime(carta),
    turno,
    // Le copie si spiegano col numero che dalle copie dipende: la probabilità
    // di averne pescata almeno una entro quel turno. Quella del mana sta
    // accanto e viene dal punteggio: una carta in mano che non si può lanciare
    // non è ancora una carta giocata.
    probabilitaDiPescarla: probabilitaDiPescarne(mazzo.base.dimensioneMazzo, copie, turno),
    probabilitaDiMana: probabilita?.probabilita ?? 0,
    dimensioneMazzo: mazzo.base.dimensioneMazzo,
    copieNonTerra: mazzo.base.copieNonTerra,
    carteDiverse: mazzo.carte.length,
  };

  return {
    nome: carta.nome,
    copie,
    perche: { frase: frasePerLaPresenza(presenza), grezzi: presenza },
    quante: { frase: frasePerLeCopie(quante), grezzi: quante },
  };
}

/* --- Le carte del tema rimaste fuori --------------------------------------- */

/**
 * Le esclusioni notevoli: le carte più forti che il tema prendeva e che nel
 * mazzo non ci sono.
 *
 * «Notevoli» vuol dire proprio questo: si ordinano per la stessa misura di
 * qualità con cui la ricerca ordina le candidate, e si spiegano le prime. Sono
 * quelle che l'utente si aspettava di trovare, ed è per loro che il ticket
 * chiede questa risposta — perché non pensi che l'app se le sia dimenticate.
 */
function spiegaLeEsclusioni(
  mazzo: MazzoCostruito,
  contesto: Contesto,
): Spiegazione<GrezziDiEsclusione>[] {
  const dentro = new Set(mazzo.carte.map((voce) => voce.carta.nome));
  const fuori = contesto.pool
    .filter(
      (carta) =>
        !eTerra(carta) &&
        carta.terra === null &&
        !dentro.has(carta.nome) &&
        appartiene(carta, contesto.risolto),
    )
    .map((carta) => ({ carta, qualita: qualitaDiCarta(carta) }))
    .sort((a, b) => b.qualita - a.qualita || a.carta.nome.localeCompare(b.carta.nome, "en"))
    .slice(0, ESCLUSIONI_NOTEVOLI);

  const curva = mazzo.punteggio.curva.grezzi;
  // La carta più debole che invece è entrata: è il termine di paragone della
  // ragione «vale meno», e senza di lei quella ragione sarebbe un'opinione.
  const piuDebole = [...mazzo.punteggio.qualita.grezzi.perCarta].sort(
    (a, b) => a.valore - b.valore || a.nome.localeCompare(b.nome, "en"),
  )[0];

  return fuori.map(({ carta, qualita }) => {
    const casella = casellaDellaCurva(carta.valoreDiMana);
    const quotaVera = curva.quote[casella] ?? 0;
    const quotaAttesa = curva.quoteAttese[casella] ?? 0;
    // L'etichetta della casella e non il costo della carta: le caselle in cima
    // e in fondo raccolgono più costi («1 o meno», «6 o più»), e le due quote
    // sono prese sulla casella intera. Il punteggio l'ha già scritta.
    const etichetta = curva.caselle[casella] ?? String(carta.valoreDiMana);

    const grezzi: GrezziDiEsclusione =
      quotaVera > quotaAttesa
        ? {
            nome: carta.nome,
            motivo: "curva",
            valoreDiMana: carta.valoreDiMana,
            casella: etichetta,
            quotaVera,
            quotaAttesa,
          }
        : piuDebole !== undefined && qualita <= piuDebole.valore
          ? {
              nome: carta.nome,
              motivo: "qualita",
              qualita,
              nomePiuDebole: piuDebole.nome,
              qualitaPiuDebole: piuDebole.valore,
            }
          : {
              nome: carta.nome,
              motivo: "posti",
              qualita,
              copieNonTerra: mazzo.base.copieNonTerra,
              carteDiverse: mazzo.carte.length,
            };

    return { frase: frasePerLEsclusione(grezzi), grezzi };
  });
}

/* --- La base di terre ------------------------------------------------------ */

function spiegaLeTerre(mazzo: MazzoCostruito): Spiegazione<GrezziDelleTerre> {
  const base = mazzo.base;
  const grezzi: GrezziDelleTerre = {
    numeroTerre: base.numeroTerre,
    numeroTerreDallaCurva: base.numeroTerreDallaCurva,
    dimensioneMazzo: base.dimensioneMazzo,
    copieNonTerra: base.copieNonTerra,
    costoMedio: base.costoMedio,
    colori: base.coloriRichiesti,
    terreCheEntranoGirate: base.terreCheEntranoGirate,
    terreGirateSoloAVolte: base.terreGirateSoloAVolte,
    probabilitaMedia: mazzo.punteggio.colori.grezzi.probabilitaMedia,
    difficili: base.difficili.map((riga) => riga.carta.nome),
  };
  return { frase: frasePerLeTerre(grezzi), grezzi };
}

/* --- Il passo rispetto al mazzo precedente --------------------------------- */

function spiegaIlPasso(
  mazzo: MazzoCostruito,
  precedente: MazzoCostruito,
  contesto: Contesto,
): Spiegazione<GrezziDelPasso> {
  const grezzi: GrezziDelPasso = {
    purezzaPrima: precedente.purezza,
    purezzaDopo: mazzo.purezza,
    potenzaPrima: precedente.potenza,
    potenzaDopo: mazzo.potenza,
    copieFuoriTemaPrima: precedente.base.copieNonTerra - copieNelTema(precedente, contesto),
    copieFuoriTemaDopo: mazzo.base.copieNonTerra - copieNelTema(mazzo, contesto),
    copieNonTerra: mazzo.base.copieNonTerra,
    copieNonTerraPrima: precedente.base.copieNonTerra,
    turnoPrima: precedente.simulazione.turnoMedioDiChiusura,
    turnoDopo: mazzo.simulazione.turnoMedioDiChiusura,
    quotaChiusePrima: precedente.simulazione.quotaPartiteChiuse,
    quotaChiuseDopo: mazzo.simulazione.quotaPartiteChiuse,
    partite: mazzo.simulazione.partite,
  };
  return { frase: frasePerIlPasso(grezzi), grezzi };
}

/* --- La combo dichiarata --------------------------------------------------- */

/**
 * La combo, detta a parole: **i numeri non si rifanno qui**.
 *
 * Le copie, il turno e la probabilità sono quelli che `misuraLaCombo` ha già
 * calcolato per questo mazzo (`MazzoCostruito.combo`), e si riportano dentro la
 * frase così come sono. Ricalcolarli qui vorrebbe dire poter scrivere un numero
 * diverso da quello che l'utente legge accanto.
 */
function spiegaLaCombo(mazzo: MazzoCostruito): Spiegazione<GrezziDellaCombo> | null {
  const combo = mazzo.combo;
  if (combo === null) return null;

  const grezzi: GrezziDellaCombo = {
    pezzi: combo.pezzi,
    turno: combo.turno,
    probabilita: combo.probabilita,
    dimensioneMazzo: combo.dimensioneMazzo,
    guai: combo.guai,
  };
  return { frase: frasePerLaCombo(grezzi), grezzi };
}
