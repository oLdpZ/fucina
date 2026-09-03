/**
 * Quanto è forte un mazzo — **in cinque componenti tenute separate**.
 *
 * Il ticket 10 lo chiede così e non a caso: le spiegazioni all'utente (ticket
 * 13) andranno a pescare dentro ognuna di queste componenti e dovranno poterne
 * citare il valore. Un numero solo direbbe «questo mazzo vale 0,63», che non
 * spiega niente e non si può verificare; cinque componenti, ciascuna con i
 * valori grezzi che la giustificano, dicono **perché**.
 *
 * Le cinque, nell'ordine in cui il ticket le elenca:
 *
 * 1. **velocità e affidabilità** — dalla simulazione goldfish: in quanti turni
 *    chiude, quante prime mani terrebbe, quante volte parte impiantato;
 * 2. **forma della curva** — quanto la curva del mazzo somiglia a quella attesa
 *    **per la sua velocità**, misurata sul turno in cui chiude davvero;
 * 3. **salute dei colori** — quanto costano i colori, cioè quanta probabilità
 *    ogni carta perde per i suoi simboli rispetto a una che costasse lo stesso
 *    senza;
 * 4. **densità di sinergia** — quante coppie di copie condividono tag che si
 *    attivano a vicenda;
 * 5. **qualità delle singole carte** — euristiche deterministiche: efficienza
 *    forza+costituzione per costo, rimozione incondizionata contro
 *    condizionale, vantaggio in carte.
 *
 * **Mai popolarità, mai prezzo, mai un peso appreso da dati esterni** (Q13,
 * Q16). In questo modulo il prezzo e la rarità di una carta non si leggono
 * proprio, e un test lo verifica cambiandoli.
 *
 * Tutti i pesi stanno in `taratura.ts`, in un punto solo, dichiarati
 * provvisori: alla sosta si cambiano. Qui dentro non c'è nessun numero tarato,
 * e anche questo lo verifica un test.
 *
 * La funzione è **pura** e deterministica: niente rete, niente orologio, e il
 * solo caso è quello seminato della simulazione, col seme che arriva da fuori.
 */

import type { Carta, Tag } from "../dati/pool.js";
import {
  analizzaBaseDiTerre,
  type BaseDiTerre,
  type CopieDiCarta,
} from "../mazzo/base-di-terre.js";
import { simulaGoldfish, type EsitoDellaSimulazione } from "../mazzo/simulazione.js";
import {
  CONDIZIONI_DELLA_RIMOZIONE,
  COPPIE_CHE_SI_ATTIVANO,
  COSTO_DI_BASE_DI_UNA_CARTA,
  CURVA_ATTESA_LENTA,
  CURVA_ATTESA_VELOCE,
  DENSITA_DI_SINERGIA_PIENA,
  EFFICIENZA_ATTESA,
  PESI_DELLA_VELOCITA,
  PESI_DELLE_COMPONENTI,
  QUOTA_DELLA_RIMOZIONE_CONDIZIONALE,
  TAG_DI_VANTAGGIO_CARTE,
  TURNO_DI_CHIUSURA_OTTIMO,
  TURNO_DI_CHIUSURA_PESSIMO,
  TURNO_MAZZO_LENTO,
  TURNO_MAZZO_VELOCE,
  VALORE_DEL_CORPO,
  VALORE_DEL_VANTAGGIO_CARTE,
  VALORE_DELLA_RIMOZIONE,
} from "./taratura.js";

/**
 * Una componente del punteggio: un voto fra zero e uno, l'etichetta con cui si
 * chiama davanti all'utente, e **i valori grezzi che la giustificano** — che è
 * la parte che conta, perché è quella che le spiegazioni citeranno.
 */
export type Componente<G> = {
  etichetta: string;
  valore: number;
  grezzi: G;
};

export type GrezziDiVelocita = {
  partite: number;
  turnoMedioDiChiusura: number | null;
  quotaPartiteChiuse: number;
  quotaManiTenibili: number;
  quotaPartenzeImpiantate: number;
  /** Il voto sulla sola chiusura, prima di mescolarlo con l'affidabilità. */
  votoDiChiusura: number;
};

export type GrezziDiCurva = {
  /** Le quote vere del mazzo, casella per casella di costo. */
  quote: number[];
  /** Le quote attese per la velocità **di questo** mazzo. */
  quoteAttese: number[];
  /** Le etichette delle caselle, per chi dovrà scriverle in una frase. */
  caselle: string[];
  /** Il turno di chiusura da cui viene la forma attesa. */
  turnoDiRiferimento: number;
  /** Quanto le due distribuzioni distano, fra zero e uno. */
  distanza: number;
  copieNonTerra: number;
};

export type ProbabilitaDiUnaCarta = {
  nome: string;
  copie: number;
  turno: number;
  probabilita: number;
  probabilitaSenzaColori: number;
  /** Quanta probabilità resta rispetto alla stessa carta senza simboli. */
  quotaConservata: number;
  difficile: boolean;
};

export type GrezziDiColori = {
  perCarta: ProbabilitaDiUnaCarta[];
  /** Le carte che questa base non regge, come le conta `base-di-terre.ts`. */
  carteDifficili: number;
  numeroTerre: number;
  /**
   * Il mazzo su cui le probabilità sono calcolate. **Non è sempre il mazzo
   * dato**: `base-di-terre.ts` conta su sessanta carte anche quando ce ne sono
   * meno, perché sotto i sessanta il mazzo non è legale e le probabilità di un
   * mazzo che non si può giocare non vogliono dire niente. Sta qui perché chi
   * legge il numero deve sapere su quante carte è stato preso.
   */
  dimensioneMazzo: number;
  /** La probabilità media, pesata per copie, di lanciare ogni carta al suo turno. */
  probabilitaMedia: number;
};

export type CoppiaDiSinergia = {
  uno: Tag;
  altro: Tag;
  /** Quante coppie di copie del mazzo realizzano questa coppia di tag. */
  coppie: number;
};

export type GrezziDiSinergia = {
  /** Tutte le coppie di copie non-terra del mazzo: il denominatore. */
  coppieDiCopie: number;
  /** Quelle in cui le due carte si attivano a vicenda: il numeratore. */
  coppieAttive: number;
  densita: number;
  /** Quali coppie di tag l'hanno prodotta, dalla più frequente in giù. */
  perCoppiaDiTag: CoppiaDiSinergia[];
};

export type QualitaDiUnaCarta = {
  nome: string;
  copie: number;
  /** Se è una creatura per tipo — che è cosa diversa dall'avere efficienza sopra zero. */
  creatura: boolean;
  /** `(forza + costituzione) / (valore di mana + costo di base)`, zero se non è una creatura. */
  efficienza: number;
  /** L'efficienza portata fra zero e uno. */
  corpo: number;
  /** Quanto vale come rimozione: uno se incondizionata, meno se condizionale, zero se non lo è. */
  rimozione: number;
  /** Uno se la carta porta vantaggio in carte. */
  vantaggio: number;
  valore: number;
};

export type GrezziDiQualita = {
  perCarta: QualitaDiUnaCarta[];
  /** L'efficienza media delle sole creature, pesata per copie. */
  efficienzaMedia: number;
  /** Le tre conte che seguono sono **in copie**, non in nomi di carta. */
  rimozioniIncondizionate: number;
  rimozioniCondizionali: number;
  carteDiVantaggio: number;
};

/**
 * Le cinque componenti, **separate**. Non c'è nessun totale qui dentro: chi ne
 * vuole uno lo chiede a `combina`, e così le componenti non possono essere
 * sommate via per distrazione.
 */
export type Punteggio = {
  velocita: Componente<GrezziDiVelocita>;
  curva: Componente<GrezziDiCurva>;
  colori: Componente<GrezziDiColori>;
  sinergia: Componente<GrezziDiSinergia>;
  qualita: Componente<GrezziDiQualita>;
};

export type RichiestaDiPunteggio = {
  /** Il seme del caso: fa parte della richiesta, e senza di lui niente regge. */
  seme: number;
  /** Quante partite simulare; di suo la costante tarata in `mazzo/taratura.ts`. */
  partite?: number;
  /** Quante terre volute; `null` o assente per lasciar decidere alla curva. */
  terreVolute?: number | null;
};

export type MazzoValutato = {
  /** Il mazzo intero su cui si è misurato: le carte date più le terre scelte. */
  mazzo: CopieDiCarta[];
  base: BaseDiTerre;
  simulazione: EsitoDellaSimulazione;
  punteggio: Punteggio;
};

/**
 * La cucitura: un gruppo di carte e le terre disponibili, e ne escono la base
 * di terre, la simulazione e le cinque componenti.
 *
 * Le terre eventualmente presenti fra le carte date si ignorano, come già fa
 * `analizzaBaseDiTerre`: la base la sceglie l'app, ed è la sua risposta.
 *
 * Se le carte date non arrivano a sessanta col loro contorno di terre, la
 * simulazione gioca il mazzo **com'è adesso** — riempirlo di carte inventate
 * sarebbe far giocare un mazzo che non esiste — mentre la salute dei colori
 * eredita da `base-di-terre.ts` il conto su sessanta carte, perché sotto i
 * sessanta il mazzo non è legale e le sue probabilità non vorrebbero dire
 * niente. Le due letture divergono solo sui mazzi incompleti, e il numero su
 * cui la seconda è presa sta scritto nei suoi valori grezzi
 * (`colori.grezzi.dimensioneMazzo`).
 */
export function valutaMazzo(
  carte: readonly CopieDiCarta[],
  terreDelPool: readonly Carta[],
  richiesta: RichiestaDiPunteggio,
): MazzoValutato {
  const base = analizzaBaseDiTerre(carte, terreDelPool, {
    terreVolute: richiesta.terreVolute ?? null,
  });
  const nonTerre = carte.filter((voce) => voce.carta.terra === null && voce.copie > 0);
  const mazzo: CopieDiCarta[] = [...nonTerre, ...base.terre];

  const simulazione = simulaGoldfish(mazzo, {
    seme: richiesta.seme,
    ...(richiesta.partite === undefined ? {} : { partite: richiesta.partite }),
  });

  return {
    mazzo,
    base,
    simulazione,
    punteggio: {
      velocita: velocita(simulazione),
      curva: curva(nonTerre, simulazione),
      colori: colori(base),
      sinergia: sinergia(nonTerre),
      qualita: qualita(nonTerre),
    },
  };
}

/**
 * Le cinque componenti in un numero solo, per chi deve **ordinare** due mazzi —
 * la ricerca a scambi singoli del ticket 11.
 *
 * Sta qui e non dentro `Punteggio` di proposito: le componenti restano separate
 * nella risposta, e il totale è una domanda che si fa, non una cosa che si
 * trova già fatta.
 */
export function combina(punteggio: Punteggio): number {
  return (
    PESI_DELLE_COMPONENTI.velocita * punteggio.velocita.valore +
    PESI_DELLE_COMPONENTI.curva * punteggio.curva.valore +
    PESI_DELLE_COMPONENTI.colori * punteggio.colori.valore +
    PESI_DELLE_COMPONENTI.sinergia * punteggio.sinergia.valore +
    PESI_DELLE_COMPONENTI.qualita * punteggio.qualita.valore
  );
}

/* --- Velocità e affidabilità --------------------------------------------- */

function velocita(esito: EsitoDellaSimulazione): Componente<GrezziDiVelocita> {
  // Chiudere presto vale, ma vale per quante volte si chiude davvero: un mazzo
  // che vince al quarto turno una partita su cinque non è un mazzo veloce.
  const prontezza =
    esito.turnoMedioDiChiusura === null
      ? 0
      : scala(esito.turnoMedioDiChiusura, TURNO_DI_CHIUSURA_PESSIMO, TURNO_DI_CHIUSURA_OTTIMO);
  const votoDiChiusura = prontezza * esito.quotaPartiteChiuse;

  const valore =
    PESI_DELLA_VELOCITA.chiusura * votoDiChiusura +
    PESI_DELLA_VELOCITA.mani * esito.quotaManiTenibili +
    PESI_DELLA_VELOCITA.partenza * (1 - esito.quotaPartenzeImpiantate);

  return {
    etichetta: "velocità e affidabilità",
    valore: fraZeroEUno(valore),
    grezzi: {
      partite: esito.partite,
      turnoMedioDiChiusura: esito.turnoMedioDiChiusura,
      quotaPartiteChiuse: esito.quotaPartiteChiuse,
      quotaManiTenibili: esito.quotaManiTenibili,
      quotaPartenzeImpiantate: esito.quotaPartenzeImpiantate,
      votoDiChiusura,
    },
  };
}

/* --- Forma della curva ---------------------------------------------------- */

/** Le caselle di costo: l'ultima raccoglie tutto quello che costa di più. */
const CASELLE = CURVA_ATTESA_VELOCE.length;

function etichettaDellaCasella(indice: number): string {
  if (indice === 0) return "1 o meno";
  if (indice === CASELLE - 1) return `${CASELLE} o più`;
  return String(indice + 1);
}

function casellaDi(valoreDiMana: number): number {
  const costo = Math.max(1, Math.round(valoreDiMana));
  return Math.min(costo, CASELLE) - 1;
}

function curva(
  nonTerre: readonly CopieDiCarta[],
  esito: EsitoDellaSimulazione,
): Componente<GrezziDiCurva> {
  const copieNonTerra = nonTerre.reduce((somma, voce) => somma + voce.copie, 0);

  const quote = new Array<number>(CASELLE).fill(0);
  for (const voce of nonTerre) {
    const casella = casellaDi(voce.carta.valoreDiMana);
    quote[casella] = quote[casella]! + voce.copie;
  }
  if (copieNonTerra > 0) {
    for (let i = 0; i < quote.length; i++) quote[i] = quote[i]! / copieNonTerra;
  }

  // La forma attesa non è una sola: è quella della velocità **di questo**
  // mazzo, e la velocità la dice la simulazione, non un archetipo scritto qui.
  //
  // Il turno medio di chiusura è preso sulle **sole partite chiuse**, e da solo
  // mentirebbe: un mazzo di controllo che vince di rado, e quando vince vince
  // presto per una mano fortunata, si direbbe veloce e verrebbe misurato con la
  // curva di un aggro. Le partite non chiuse contano perciò come chiuse al
  // turno in cui la simulazione ha smesso di guardare — che è il meno che si
  // possa dire di loro, visto che a quel turno non erano ancora finite. È la
  // stessa correzione che `velocita` fa moltiplicando per la quota di partite
  // chiuse.
  const turnoDiRiferimento =
    esito.turnoMedioDiChiusura === null
      ? esito.turnoMassimo
      : esito.turnoMedioDiChiusura * esito.quotaPartiteChiuse +
        esito.turnoMassimo * (1 - esito.quotaPartiteChiuse);
  const lentezza = 1 - scala(turnoDiRiferimento, TURNO_MAZZO_LENTO, TURNO_MAZZO_VELOCE);
  const quoteAttese = CURVA_ATTESA_VELOCE.map(
    (veloce, i) => veloce + lentezza * (CURVA_ATTESA_LENTA[i]! - veloce),
  );

  // Distanza in variazione totale: metà della somma degli scarti. Vale zero
  // quando le due forme coincidono e uno quando non si toccano mai.
  const distanza =
    copieNonTerra === 0
      ? 1
      : quoteAttese.reduce((somma, attesa, i) => somma + Math.abs(quote[i]! - attesa), 0) / 2;

  return {
    etichetta: "forma della curva",
    valore: fraZeroEUno(1 - distanza),
    grezzi: {
      quote,
      quoteAttese,
      caselle: quoteAttese.map((_, i) => etichettaDellaCasella(i)),
      turnoDiRiferimento,
      distanza,
      copieNonTerra,
    },
  };
}

/* --- Salute dei colori ---------------------------------------------------- */

function colori(base: BaseDiTerre): Componente<GrezziDiColori> {
  const perCarta: ProbabilitaDiUnaCarta[] = base.righe.map((riga) => ({
    nome: riga.carta.nome,
    copie: riga.copie,
    turno: riga.turno,
    probabilita: riga.probabilita,
    probabilitaSenzaColori: riga.probabilitaSenzaColori,
    // Il confronto è con la stessa carta **senza simboli colorati**: così la
    // componente risponde della domanda dei colori e non ricasca su quella
    // della curva, che ha già la sua componente. Vedi `mazzo/taratura.ts`.
    // Quando nemmeno una carta **senza colori** si lancerebbe mai, la carta non
    // si lancia mai: vale zero e non uno. Dire «i colori sono a posto» di una
    // carta che resta in mano sarebbe la bugia peggiore che questa componente
    // possa raccontare, e la ricerca del ticket 11 la prenderebbe per un
    // consiglio.
    quotaConservata:
      riga.probabilitaSenzaColori === 0
        ? 0
        : Math.min(1, riga.probabilita / riga.probabilitaSenzaColori),
    difficile: riga.difficile,
  }));

  const copie = perCarta.reduce((somma, riga) => somma + riga.copie, 0);
  const media = (di: (riga: ProbabilitaDiUnaCarta) => number) =>
    copie === 0 ? 0 : perCarta.reduce((somma, riga) => somma + di(riga) * riga.copie, 0) / copie;

  return {
    etichetta: "salute dei colori",
    // Senza carte da lanciare non c'è niente di sano da misurare: vale zero, e
    // non uno — un mazzo vuoto non è un mazzo dai colori perfetti.
    valore: fraZeroEUno(media((riga) => riga.quotaConservata)),
    grezzi: {
      perCarta,
      carteDifficili: base.difficili.length,
      numeroTerre: base.numeroTerre,
      dimensioneMazzo: base.dimensioneMazzo,
      probabilitaMedia: media((riga) => riga.probabilita),
    },
  };
}

/* --- Densità di sinergia -------------------------------------------------- */

/** Le coppie dichiarate, in una forma che si interroga in un colpo solo. */
const ATTIVAZIONI = new Set(COPPIE_CHE_SI_ATTIVANO.map(([uno, altro]) => chiaveDiCoppia(uno, altro)));

function chiaveDiCoppia(uno: Tag, altro: Tag): string {
  return uno < altro ? `${uno}|${altro}` : `${altro}|${uno}`;
}

function sinergia(nonTerre: readonly CopieDiCarta[]): Componente<GrezziDiSinergia> {
  const copie = nonTerre.reduce((somma, voce) => somma + voce.copie, 0);
  const coppieDiCopie = (copie * (copie - 1)) / 2;

  let coppieAttive = 0;
  const perCoppiaDiTag = new Map<string, CoppiaDiSinergia>();

  const conta = (uno: CopieDiCarta, altro: CopieDiCarta, quante: number) => {
    if (quante === 0) return;

    // I motivi per cui questa coppia di carte si attiva, ciascuno una volta
    // sola: due carte che portano tutt'e due i tag di un'attivazione la
    // realizzano in due versi, ma il motivo resta uno.
    const motivi = new Map<string, readonly [Tag, Tag]>();
    for (const tagUno of uno.carta.tag) {
      for (const tagAltro of altro.carta.tag) {
        const chiave = chiaveDiCoppia(tagUno, tagAltro);
        if (!ATTIVAZIONI.has(chiave)) continue;
        motivi.set(chiave, tagUno < tagAltro ? [tagUno, tagAltro] : [tagAltro, tagUno]);
      }
    }

    for (const [chiave, [primo, secondo]] of motivi) {
      const gia = perCoppiaDiTag.get(chiave);
      if (gia === undefined) perCoppiaDiTag.set(chiave, { uno: primo, altro: secondo, coppie: quante });
      else gia.coppie += quante;
    }

    // Una coppia di carte conta **una volta sola**, anche se i motivi per cui
    // si attiva sono due: si contano le coppie di carte, non i motivi.
    if (motivi.size > 0) coppieAttive += quante;
  };

  for (let i = 0; i < nonTerre.length; i++) {
    const uno = nonTerre[i]!;
    // Due copie della stessa carta sono una coppia come le altre: capita che
    // una carta porti tutt'e due i tag di un'attivazione, e allora due copie
    // lavorano davvero insieme.
    conta(uno, uno, (uno.copie * (uno.copie - 1)) / 2);
    for (let j = i + 1; j < nonTerre.length; j++) {
      const altro = nonTerre[j]!;
      conta(uno, altro, uno.copie * altro.copie);
    }
  }

  const densita = coppieDiCopie === 0 ? 0 : coppieAttive / coppieDiCopie;

  return {
    etichetta: "densità di sinergia",
    valore: fraZeroEUno(densita / DENSITA_DI_SINERGIA_PIENA),
    grezzi: {
      coppieDiCopie,
      coppieAttive,
      densita,
      perCoppiaDiTag: [...perCoppiaDiTag.values()].sort(
        (a, b) => b.coppie - a.coppie || (a.uno < b.uno ? -1 : 1),
      ),
    },
  };
}

/* --- Qualità delle singole carte ------------------------------------------ */

function numero(scritto: string | null): number {
  if (scritto === null) return 0;
  const letto = Number(scritto);
  // Una forza che non è un numero (`*`, `1+*`) conta zero: è la lettura
  // pessimistica, la stessa della simulazione, ed è la sola che non può mentire.
  return Number.isFinite(letto) ? Math.max(0, letto) : 0;
}

function eCreatura(carta: Carta): boolean {
  return carta.tipi.some((tipo) => tipo.toLowerCase() === "creature");
}

/**
 * Quanto vale una rimozione: uno se colpisce quel che vuole, meno se il testo
 * porta una delle condizioni dichiarate in `taratura.ts`, zero se la carta non
 * è una rimozione.
 */
function valoreDellaRimozione(carta: Carta): number {
  if (!carta.tag.includes("rimozione-mirata")) return 0;
  const testo = carta.testo.toLowerCase();
  const condizionale = CONDIZIONI_DELLA_RIMOZIONE.some((frase) => testo.includes(frase));
  return condizionale ? QUOTA_DELLA_RIMOZIONE_CONDIZIONALE : 1;
}

function qualitaDiUnaCarta(voce: CopieDiCarta): QualitaDiUnaCarta {
  const carta = voce.carta;
  const creatura = eCreatura(carta);
  const efficienza = creatura
    ? (numero(carta.forza) + numero(carta.costituzione)) /
      (carta.valoreDiMana + COSTO_DI_BASE_DI_UNA_CARTA)
    : 0;
  const corpo = fraZeroEUno(efficienza / EFFICIENZA_ATTESA);
  const rimozione = valoreDellaRimozione(carta);
  const vantaggio = carta.tag.some((tag) => TAG_DI_VANTAGGIO_CARTE.includes(tag)) ? 1 : 0;

  return {
    nome: carta.nome,
    copie: voce.copie,
    creatura,
    efficienza,
    corpo,
    rimozione,
    vantaggio,
    // I tre mestieri si sommano **pesati**, e nessuno dei tre da solo arriva al
    // tetto: una creatura che pesca entrando dev'essere meglio della stessa
    // creatura e basta anche quando il corpo è già ottimo. Con la somma nuda,
    // ogni creatura da un 3/3 in su si mangiava il bonus contro il tetto e le
    // due carte finivano pari — che è l'opposto di quel che questa componente
    // deve dire.
    valore: fraZeroEUno(
      VALORE_DEL_CORPO * corpo +
        VALORE_DELLA_RIMOZIONE * rimozione +
        VALORE_DEL_VANTAGGIO_CARTE * vantaggio,
    ),
  };
}

/**
 * La qualità di una carta sola, fra zero e uno: la stessa euristica che la
 * componente usa, chiesta per una carta invece che per un mazzo.
 *
 * Serve alla ricerca (ticket 11) per **ordinare le candidate** prima di
 * cominciare: partire dalle carte migliori invece che da carte a caso è quel
 * che rende utile una ricerca che ha un tetto di tempo addosso. Non è il
 * punteggio del mazzo e non lo sostituisce — quello lo dà `valutaMazzo`, che
 * guarda anche curva, colori e sinergie — ma è un ordine di partenza
 * deterministico e già tarato in un punto solo.
 */
export function qualitaDiCarta(carta: Carta): number {
  return qualitaDiUnaCarta({ carta, copie: 1 }).valore;
}

function qualita(nonTerre: readonly CopieDiCarta[]): Componente<GrezziDiQualita> {
  const perCarta = nonTerre.map(qualitaDiUnaCarta);
  const copie = perCarta.reduce((somma, riga) => somma + riga.copie, 0);

  // Le creature sono quelle che lo sono per tipo, non quelle che hanno
  // efficienza sopra zero: una creatura 0/0 e una che ha la forza scritta a
  // stella sono creature, contano zero, e devono **abbassare** la media invece
  // di sparire dal conto e farla salire.
  const creature = perCarta.filter((riga) => riga.creatura);
  const copieDiCreature = creature.reduce((somma, riga) => somma + riga.copie, 0);
  const copieDove = (di: (riga: QualitaDiUnaCarta) => boolean) =>
    perCarta.filter(di).reduce((somma, riga) => somma + riga.copie, 0);

  return {
    etichetta: "qualità delle singole carte",
    valore: fraZeroEUno(
      copie === 0
        ? 0
        : perCarta.reduce((somma, riga) => somma + riga.valore * riga.copie, 0) / copie,
    ),
    grezzi: {
      perCarta,
      efficienzaMedia:
        copieDiCreature === 0
          ? 0
          : creature.reduce((somma, riga) => somma + riga.efficienza * riga.copie, 0) /
            copieDiCreature,
      // Contate **in copie**, come ogni altro numero di questo modulo: chi
      // scriverà la frase dirà «quattro rimozioni», che è quello che l'utente
      // vede in mano, non «una rimozione» perché il nome è uno solo.
      rimozioniIncondizionate: copieDove((riga) => riga.rimozione === 1),
      rimozioniCondizionali: copieDove((riga) => riga.rimozione > 0 && riga.rimozione < 1),
      carteDiVantaggio: copieDove((riga) => riga.vantaggio > 0),
    },
  };
}

/* --- Gli attrezzi --------------------------------------------------------- */

function fraZeroEUno(valore: number): number {
  if (!Number.isFinite(valore)) return 0;
  return Math.max(0, Math.min(1, valore));
}

/**
 * Porta un numero fra zero e uno stendendolo fra i due estremi dichiarati:
 * vale zero a `zero`, uno a `uno`, e interpola diritto in mezzo. Funziona in
 * tutt'e due i versi, che è quel che serve quando «meglio» vuol dire «meno».
 */
function scala(valore: number, zero: number, uno: number): number {
  if (uno === zero) return 0;
  return fraZeroEUno((valore - zero) / (uno - zero));
}
