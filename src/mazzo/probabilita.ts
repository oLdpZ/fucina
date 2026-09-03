/**
 * La probabilità di poter lanciare una carta al suo turno, calcolata.
 *
 * Non è una stima e non è una tabella: è la probabilità esatta, sulle carte che
 * si sono viste entro quel turno, di avere abbastanza terre **e** le fonti di
 * colore giuste. È la funzione a sé che `spec.md` chiede di poter verificare su
 * casi con risposta nota a mano, e i test la verificano così.
 *
 * Il modello, dichiarato per intero perché i numeri non mentano:
 *
 * - Si gioca per primi: al turno `t` si sono viste 7 + (t − 1) carte. È il caso
 *   peggiore fra i due, e mostrare il peggiore è più onesto.
 * - Nessun mulligan: chi tiene sei carte ha probabilità diverse, e fingere di
 *   saperle sarebbe inventare.
 * - Si gioca una terra per turno, e si sceglie **quale**: le terre pescate si
 *   mettono giù nell'ordine più comodo.
 * - Una terra che entra girata non produce mana il turno in cui la si gioca.
 *   Contarla come una terra normale sarebbe la bugia che il ticket 06 vieta.
 * - Il mana generico lo paga qualunque terra; ogni simbolo colorato vuole una
 *   terra che produca **uno** dei colori che quel simbolo accetta (gli ibridi
 *   ne accettano due), e una stessa terra non paga due simboli.
 */

import type { ColoreMana } from "../dati/pool.js";

/**
 * Un gruppo di terre indistinguibili per il calcolo: stesso insieme di colori
 * prodotti, stesso comportamento all'entrata. Le terre che non producono nessun
 * colore utile al mazzo stanno insieme con `produce` vuoto — servono comunque a
 * pagare il mana generico.
 */
export type GruppoDiTerre = {
  copie: number;
  produce: readonly ColoreMana[];
  girata: boolean;
};

/**
 * Un simbolo colorato del costo, come insieme dei colori che lo pagano: `{R}`
 * è `["R"]`, l'ibrido `{R/G}` è `["R", "G"]`. I simboli generici e quelli
 * Phyrexiani (che si pagano coi punti vita) non compaiono affatto.
 */
export type Pip = readonly ColoreMana[];

export type Domanda = {
  dimensioneMazzo: number;
  terre: readonly GruppoDiTerre[];
  pips: readonly Pip[];
  valoreDiMana: number;
  /** Il turno a cui si prova a lanciarla; di norma il suo valore di mana. */
  turno: number;
};

const CARTE_IN_MANO = 7;

/** Le carte viste al turno `t` giocando per primi: la mano più un pescato per turno. */
export function carteViste(turno: number): number {
  return CARTE_IN_MANO + Math.max(0, turno - 1);
}

/**
 * I logaritmi dei fattoriali: le combinazioni di un mazzo da sessanta carte
 * superano gli interi esatti della virgola mobile, e sommare logaritmi non le
 * fa esplodere.
 */
const LOG_FATTORIALE: number[] = [0];
function logFattoriale(n: number): number {
  for (let i = LOG_FATTORIALE.length; i <= n; i++) {
    LOG_FATTORIALE[i] = LOG_FATTORIALE[i - 1]! + Math.log(i);
  }
  return LOG_FATTORIALE[n]!;
}

/** Il logaritmo di C(n, k); meno infinito quando la combinazione non esiste. */
function logCombinazioni(n: number, k: number): number {
  if (k < 0 || k > n) return Number.NEGATIVE_INFINITY;
  return logFattoriale(n) - logFattoriale(k) - logFattoriale(n - k);
}

/**
 * La probabilità di **averne pescata almeno una copia** entro un turno.
 *
 * È l'altra metà della domanda «quante copie?»: `probabilitaDiLanciare` dice se
 * il mana ci sarà, questa dice se la carta ci sarà. Non dipende dalle terre —
 * dipende solo da quante copie ce ne sono e da quante carte si sono viste — ed
 * è il numero che le spiegazioni (ticket 13) citano per dire perché quattro
 * copie e non due.
 *
 * È un conto esatto, come l'altro: uno meno la probabilità ipergeometrica di
 * non vederne nemmeno una.
 */
export function probabilitaDiPescarne(
  dimensioneMazzo: number,
  copie: number,
  turno: number,
): number {
  if (copie <= 0 || dimensioneMazzo <= 0) return 0;
  if (copie >= dimensioneMazzo) return 1;
  const viste = Math.min(carteViste(turno), dimensioneMazzo);
  const nessuna = Math.exp(
    logCombinazioni(dimensioneMazzo - copie, viste) - logCombinazioni(dimensioneMazzo, viste),
  );
  return 1 - nessuna;
}

/**
 * La probabilità di poter lanciare la carta al turno chiesto.
 *
 * Si enumerano tutti i modi in cui le terre pescate possono distribuirsi fra i
 * gruppi, si scarta quelli che non bastano, e si sommano le loro probabilità
 * ipergeometriche multivariate. È un conto esatto, non un campionamento.
 */
export function probabilitaDiLanciare(domanda: Domanda): number {
  const { dimensioneMazzo, terre, valoreDiMana, turno } = domanda;
  if (valoreDiMana <= 0 && domanda.pips.length === 0) return 1;

  const pescate = Math.min(carteViste(turno), dimensioneMazzo);
  const copieDiTerra = terre.reduce((somma, gruppo) => somma + gruppo.copie, 0);
  const nonTerre = dimensioneMazzo - copieDiTerra;
  if (nonTerre < 0) throw new Error("Le terre non possono essere più delle carte del mazzo.");

  const prova = preparaProva(domanda);
  const logDenominatore = logCombinazioni(dimensioneMazzo, pescate);

  /** Quante terre possono ancora arrivare dai gruppi non ancora scelti. */
  const restanti: number[] = new Array(terre.length + 1).fill(0);
  for (let i = terre.length - 1; i >= 0; i--) {
    restanti[i] = restanti[i + 1]! + terre[i]!.copie;
  }

  const pescatePerGruppo = new Array<number>(terre.length).fill(0);
  let somma = 0;

  const percorri = (indice: number, terrePescate: number, logPeso: number): void => {
    // Se anche prendendo tutte le terre rimaste non si paga il costo, questo
    // ramo non può servire a niente: si taglia. Il taglio guarda il **costo**,
    // non il turno: una carta da un mana provata al turno 3 non ha bisogno di
    // tre terre.
    if (terrePescate + restanti[indice]! < valoreDiMana) return;

    if (indice === terre.length) {
      const dalResto = pescate - terrePescate;
      if (dalResto < 0 || dalResto > nonTerre) return;
      if (!prova(pescatePerGruppo, terrePescate)) return;
      somma += Math.exp(logPeso + logCombinazioni(nonTerre, dalResto) - logDenominatore);
      return;
    }

    const gruppo = terre[indice]!;
    const massimo = Math.min(gruppo.copie, pescate - terrePescate);
    for (let quante = 0; quante <= massimo; quante++) {
      pescatePerGruppo[indice] = quante;
      percorri(indice + 1, terrePescate + quante, logPeso + logCombinazioni(gruppo.copie, quante));
    }
    pescatePerGruppo[indice] = 0;
  };

  percorri(0, 0, 0);
  // La somma di tanti esponenziali può sbordare di un pelo dai limiti.
  return Math.min(1, Math.max(0, somma));
}

/**
 * Costruisce, una volta sola per domanda, la prova che dice se una certa mano di
 * terre basta. Sta fuori dal ciclo perché il ciclo la chiama decine di migliaia
 * di volte.
 */
function preparaProva(
  domanda: Domanda,
): (pescatePerGruppo: readonly number[], terrePescate: number) => boolean {
  const { terre, valoreDiMana, turno } = domanda;

  // I simboli uguali si contano insieme: `{R}{R}` è un solo tipo, chiesto due
  // volte. Ai tipi si applica la condizione di Hall, che è la sola cosa che
  // distingue «ho tre fonti» da «ho tre fonti che pagano davvero questi tre
  // simboli».
  const tipiDiPip = new Map<string, { colori: readonly ColoreMana[]; quanti: number }>();
  for (const pip of domanda.pips) {
    if (pip.length === 0) continue;
    const chiave = [...pip].sort().join("");
    const gia = tipiDiPip.get(chiave);
    if (gia) gia.quanti += 1;
    else tipiDiPip.set(chiave, { colori: pip, quanti: 1 });
  }
  const tipi = [...tipiDiPip.values()];

  // Per ogni sottoinsieme di tipi di simbolo: quali tipi contiene e quali gruppi
  // di terre ne pagano almeno uno. La condizione di Hall dice che la mano basta
  // se e solo se, per ogni sottoinsieme, le terre buone per quel sottoinsieme
  // sono almeno quanti sono i suoi simboli.
  const sottoinsiemi: { tipi: number[]; gruppiBuoni: number[] }[] = [];
  for (let maschera = 1; maschera < 1 << tipi.length; maschera++) {
    const dentro: number[] = [];
    const colori = new Set<ColoreMana>();
    for (let i = 0; i < tipi.length; i++) {
      if ((maschera & (1 << i)) === 0) continue;
      dentro.push(i);
      for (const colore of tipi[i]!.colori) colori.add(colore);
    }
    const gruppiBuoni: number[] = [];
    for (let g = 0; g < terre.length; g++) {
      if (terre[g]!.produce.some((colore) => colori.has(colore))) gruppiBuoni.push(g);
    }
    sottoinsiemi.push({ tipi: dentro, gruppiBuoni });
  }

  const quantiPerTipo = tipi.map((tipo) => tipo.quanti);
  const simboliColorati = quantiPerTipo.reduce((somma, quanti) => somma + quanti, 0);

  /** La condizione di Hall su una certa mano di terre e una certa richiesta. */
  const hallRegge = (pescatePerGruppo: readonly number[], richiestePerTipo: number[]): boolean => {
    for (const sottoinsieme of sottoinsiemi) {
      let richiesti = 0;
      for (const i of sottoinsieme.tipi) richiesti += richiestePerTipo[i]!;
      if (richiesti === 0) continue;
      let disponibili = 0;
      for (const g of sottoinsieme.gruppiBuoni) disponibili += pescatePerGruppo[g]!;
      if (disponibili < richiesti) return false;
    }
    return true;
  };

  /** I gruppi di terre che entrano dritte, e per ognuno i tipi di simbolo che pagano. */
  const gruppiDritti = terre
    .map((gruppo, indice) => ({ indice, gruppo }))
    .filter(({ gruppo }) => !gruppo.girata)
    .map(({ indice, gruppo }) => ({
      indice,
      tipiPagabili: tipi
        .map((tipo, i) => ({ tipo, i }))
        .filter(({ tipo }) => tipo.colori.some((colore) => gruppo.produce.includes(colore)))
        .map(({ i }) => i),
    }));

  const manoDiScorta: number[] = new Array(terre.length).fill(0);

  return (pescatePerGruppo, terrePescate) => {
    // Si gioca una terra per turno: al turno `turno` se ne sono giocate al
    // massimo `turno`, e devono bastare a pagare il costo.
    const giocabili = Math.min(terrePescate, turno);
    if (giocabili < valoreDiMana) return false;
    if (!hallRegge(pescatePerGruppo, quantiPerTipo)) return false;

    // La terra giocata **in** questo turno non ha ancora prodotto niente se
    // entra girata. Conta però solo quando il mana serve tutto: se al turno
    // chiesto se ne possono giocare più di quante ne costa la carta, la terra
    // girata la si mette giù per ultima e non toglie niente. È il caso di chi
    // prova a lanciare una carta da un mana al terzo turno.
    if (giocabili > valoreDiMana) return true;

    // Qui invece l'ultima terra giocata serve, e dev'essere dritta.
    let dritte = 0;
    for (const { indice } of gruppiDritti) dritte += pescatePerGruppo[indice]!;
    if (dritte === 0) return false;

    // Quando i simboli colorati riempiono da soli tutti i cali di terra, non
    // c'è posto per una terra dritta «di scorta»: dev'essere una delle terre
    // che pagano i simboli. Si prova a farne pagare uno a ciascun gruppo dritto.
    if (simboliColorati < giocabili) return true;
    for (const { indice, tipiPagabili } of gruppiDritti) {
      if (pescatePerGruppo[indice]! === 0) continue;
      for (const i of tipiPagabili) {
        for (let g = 0; g < manoDiScorta.length; g++) manoDiScorta[g] = pescatePerGruppo[g]!;
        manoDiScorta[indice] = manoDiScorta[indice]! - 1;
        quantiPerTipo[i] = quantiPerTipo[i]! - 1;
        const regge = hallRegge(manoDiScorta, quantiPerTipo);
        quantiPerTipo[i] = quantiPerTipo[i]! + 1;
        if (regge) return true;
      }
    }
    return false;
  };
}
