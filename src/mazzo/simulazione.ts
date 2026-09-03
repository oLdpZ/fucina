/**
 * La simulazione *goldfish*: il mazzo gioca da solo, contro nessuno.
 *
 * Nessun avversario, nessun motore di regole (Q4). Si pescano le mani, si
 * tengono o si rimescolano secondo una regola scritta, si giocano terre e magie
 * secondo una politica semplice, e si conta in quanti turni il mazzo toglierebbe
 * venti punti vita a un avversario che non fa niente. Da lì escono i tre numeri
 * che il ticket 09 chiede e che l'utente capisce senza spiegazioni: **quanto
 * spesso il mazzo parte bene**, **quante mani sarebbe costretto a rimescolare**,
 * **in quanti turni chiude**.
 *
 * Il caso qui è pericoloso, e per questo **il seme fa parte della richiesta**:
 * arriva da fuori, non dall'orologio e non da `Math.random` (vedi `caso.ts`).
 * Stessa richiesta, stesso risultato, sempre — altrimenti il vincolo di
 * determinismo di `CLAUDE.md` non regge e ogni frase che l'app mostrerà
 * all'utente diventa inverificabile.
 *
 * ## Le regole del gioco finto, dichiarate per intero
 *
 * Sono grossolane di proposito. Ogni raffinamento in più sarebbe un giudizio
 * nostro travestito da misura, e chi legge i numeri deve poter sapere in poche
 * righe come sono stati ottenuti.
 *
 * - **Si gioca per primi**: al turno 1 non si pesca. È il caso peggiore fra i
 *   due, com'è già in `probabilita.ts`.
 * - **Mulligan di Londra**: si rimescola tutto, si pescano di nuovo sette carte,
 *   e se ne mettono sotto tante quante sono le volte che si è rimescolato. Si
 *   tiene una mano se le terre stanno fra `TERRE_MINIME_IN_MANO` e
 *   `TERRE_MASSIME_IN_MANO`; dopo `MULLIGAN_MASSIMI` si tiene comunque.
 * - **Una terra per turno**, scelta guardando un turno avanti: si prova ogni
 *   terra della mano e si tiene quella che fa lanciare di più **oggi**. A parità
 *   si preferisce mettere giù quella che entra girata, per toglierla di mezzo.
 * - **Una terra che entra girata non produce mana il turno in cui la si gioca.**
 *   Vale anche per le terre che entrano girate **solo a certe condizioni**: qui
 *   contano come girate sempre. È la stessa lettura pessimistica di
 *   `probabilita.ts`, ed è voluta — la scelta delle terre in `base-di-terre.ts`
 *   le preferisce a quelle girate sempre (`PENALITA_ENTRA_GIRATA_A_VOLTE`),
 *   perché lì si sceglie; qui si misura, e in partita la condizione a volte non
 *   si avvera. Fra promettere un turno che potrebbe non arrivare e toglierne
 *   uno che forse c'era, la seconda è la sola che non può mentire.
 * - **Le magie si lanciano dalla più cara alla più economica**, finché il mana
 *   basta. I colori si pagano davvero: ogni simbolo colorato vuole una terra sua,
 *   e una stessa terra non ne paga due (è la condizione di Hall, qui risolta come
 *   abbinamento).
 * - **Solo le creature fanno danno**, per la loro forza, a partire dal turno
 *   **dopo** quello in cui entrano. Nessuna creatura muore, nessuna magia fa
 *   danno diretto: senza avversario non ci sarebbe niente da bersagliare, e
 *   fingere di saperlo vorrebbe dire scrivere un motore di regole.
 * - Una creatura la cui forza non è un numero (`*`, `1+*`) conta zero: è la
 *   lettura pessimistica, ed è la sola che non può mentire.
 *
 * Tutti i numeri di questa simulazione stanno in `taratura.ts`, in un punto
 * solo, e sono **provvisori**: vanno ritarati alla sosta misurando davvero.
 */

import { caso, mescola, type Caso } from "../caso.js";
import type { Carta, ColoreMana } from "../dati/pool.js";
import type { CopieDiCarta } from "./base-di-terre.js";
import { simboliDiColore } from "./costo.js";
import type { Pip } from "./probabilita.js";
import {
  CARTE_IN_MANO_INIZIALI,
  MAGIE_MINIME_ALLA_PARTENZA,
  MULLIGAN_MASSIMI,
  PARTITE_SIMULATE,
  TERRE_MASSIME_IN_MANO,
  TERRE_MINIME_IN_MANO,
  TERRE_VOLUTE_IN_MANO,
  TURNO_DELLA_PARTENZA,
  TURNO_MASSIMO,
  VITE_AVVERSARIO,
} from "./taratura.js";

export type RichiestaDiSimulazione = {
  /** Il seme del caso: fa parte della richiesta, e senza di lui niente regge. */
  seme: number;
  /** Quante partite; di suo la costante tarata in `taratura.ts`. */
  partite?: number;
};

export type EsitoDellaSimulazione = {
  /** Le partite effettivamente giocate: sta nella risposta perché la media va letta con questo accanto. */
  partite: number;
  /**
   * Il turno medio di chiusura, sulle **sole** partite chiuse. È `null` quando
   * il mazzo non chiude mai: una media su zero partite sarebbe un numero
   * inventato.
   */
  turnoMedioDiChiusura: number | null;
  /** La quota di partite chiuse entro `turnoMassimo`: il numero da leggere accanto alla media. */
  quotaPartiteChiuse: number;
  /** La quota di prime mani che la regola di mulligan avrebbe tenuto. */
  quotaManiTenibili: number;
  /** Quante volte, in media, il mazzo rimescola prima di partire. */
  mulliganMedi: number;
  /** La quota di partenze impiantate, come le definisce `taratura.ts`. */
  quotaPartenzeImpiantate: number;
  /** Il danno medio inflitto, fermo a `VITE_AVVERSARIO` nelle partite chiuse. */
  dannoMedio: number;
  /** Il tetto di turni oltre cui la partita si conta come non chiusa. */
  turnoMassimo: number;
};

/**
 * Una carta già letta: costo scomposto, forza, e se è una terra. Si prepara una
 * volta sola per carta e la si condivide fra tutte le copie e tutte le partite —
 * la simulazione la interroga decine di migliaia di volte.
 */
type Scheda = {
  nome: string;
  terra: { produce: readonly ColoreMana[]; girata: boolean } | null;
  pips: readonly Pip[];
  /** Il mana generico da pagare: il valore di mana meno i simboli colorati. */
  generico: number;
  /** La forza, se è una creatura e se è un numero. Altrimenti zero. */
  forza: number;
  valoreDiMana: number;
};

function leggi(carta: Carta): Scheda {
  const pips = carta.terra === null ? simboliDiColore(carta.costoDiMana) : [];
  const forzaScritta = Number(carta.forza);
  const creatura = carta.tipi.some((tipo) => tipo.toLowerCase() === "creature");
  return {
    nome: carta.nome,
    terra:
      carta.terra === null
        ? null
        : { produce: carta.terra.coloriProdotti, girata: carta.terra.entraGirata },
    pips,
    generico: Math.max(0, carta.valoreDiMana - pips.length),
    forza: creatura && Number.isFinite(forzaScritta) ? Math.max(0, forzaScritta) : 0,
    valoreDiMana: carta.valoreDiMana,
  };
}

/** Una terra in gioco: quello che produce, e da quando. */
type Fonte = { produce: readonly ColoreMana[]; dalTurno: number };

/**
 * L'abbinamento fra i simboli colorati di un costo e le terre che li pagano.
 *
 * È la condizione di Hall di `probabilita.ts`, qui risolta in modo costruttivo
 * perché non basta sapere **se** il costo si paga: bisogna sapere **con quali
 * terre**, per lanciare la magia dopo con quelle che restano. Cammini
 * aumentanti, il metodo di sempre per l'abbinamento massimo.
 *
 * Restituisce gli indici delle terre da spendere, oppure `null` se il costo non
 * si paga.
 */
function pagaCosto(
  disponibili: readonly (readonly ColoreMana[])[],
  scheda: Scheda,
): number[] | null {
  // `abbinata[t]` è l'**indice** del simbolo che la terra `t` paga, non il
  // simbolo: due simboli uguali (`{R}{R}`) sono due elementi distinti
  // dell'elenco e vogliono due terre distinte.
  const abbinata: (number | null)[] = new Array(disponibili.length).fill(null);

  const cammina = (indice: number, visitate: boolean[]): boolean => {
    const pip: Pip = scheda.pips[indice]!;
    for (let t = 0; t < disponibili.length; t++) {
      if (visitate[t]) continue;
      if (!disponibili[t]!.some((colore) => pip.includes(colore))) continue;
      visitate[t] = true;
      // `?? null` e non `!`: con `!` il tipo perderebbe il `null`, il ramo qui
      // sotto sembrerebbe morto a chi legge e al compilatore, e toglierlo
      // romperebbe l'abbinamento facendo passare per pagabili costi che non lo
      // sono — senza che un tipo se ne accorga.
      const occupata = abbinata[t] ?? null;
      if (occupata === null || cammina(occupata, visitate)) {
        abbinata[t] = indice;
        return true;
      }
    }
    return false;
  };

  for (let i = 0; i < scheda.pips.length; i++) {
    if (!cammina(i, new Array<boolean>(disponibili.length).fill(false))) return null;
  }

  const spese = new Set<number>();
  for (let t = 0; t < abbinata.length; t++) if (abbinata[t] !== null) spese.add(t);

  // Il generico lo paga qualunque terra: si spendono per prime le meno
  // flessibili, così quelle che fanno più colori restano per le magie dopo.
  const libere = disponibili
    .map((produce, indice) => ({ produce, indice }))
    .filter(({ indice }) => !spese.has(indice))
    .sort((a, b) => a.produce.length - b.produce.length || a.indice - b.indice);

  if (libere.length < scheda.generico) return null;
  for (let i = 0; i < scheda.generico; i++) spese.add(libere[i]!.indice);

  return [...spese];
}

/**
 * La politica di lancio: dalla magia più cara alla più economica, finché il mana
 * basta. Non tocca niente — restituisce gli indici delle carte della mano che
 * verrebbero lanciate, in ordine, e chi chiama decide se applicarli davvero.
 *
 * Serve pura perché la scelta della terra la usa come sguardo in avanti: prova
 * ogni terra e guarda quanto si lancerebbe con quella.
 */
function magieLanciabili(mano: readonly Scheda[], fonti: readonly Fonte[], turno: number): number[] {
  const disponibili: (readonly ColoreMana[])[] = fonti
    .filter((fonte) => fonte.dalTurno <= turno)
    .map((fonte) => fonte.produce);

  const rimaste = mano
    .map((scheda, indice) => ({ scheda, indice }))
    .filter(({ scheda }) => scheda.terra === null)
    .sort(
      (a, b) =>
        b.scheda.valoreDiMana - a.scheda.valoreDiMana ||
        b.scheda.forza - a.scheda.forza ||
        (a.scheda.nome < b.scheda.nome ? -1 : a.scheda.nome > b.scheda.nome ? 1 : 0),
    );

  const lanciate: number[] = [];
  let riprova = true;
  while (riprova) {
    riprova = false;
    for (let i = 0; i < rimaste.length; i++) {
      const { scheda, indice } = rimaste[i]!;
      const spese = pagaCosto(disponibili, scheda);
      if (spese === null) continue;
      const daTogliere = new Set(spese);
      for (let t = disponibili.length - 1; t >= 0; t--) {
        if (daTogliere.has(t)) disponibili.splice(t, 1);
      }
      lanciate.push(indice);
      rimaste.splice(i, 1);
      riprova = true;
      break;
    }
  }

  return lanciate;
}

/** Le carte da mettere sotto dopo un mulligan: prima le terre in più, poi le magie più care. */
function daMettereSotto(mano: readonly Scheda[], quante: number): Set<number> {
  const terre = mano
    .map((scheda, indice) => ({ scheda, indice }))
    .filter(({ scheda }) => scheda.terra !== null)
    .map(({ indice }) => indice);
  const magie = mano
    .map((scheda, indice) => ({ scheda, indice }))
    .filter(({ scheda }) => scheda.terra === null)
    .sort(
      (a, b) =>
        b.scheda.valoreDiMana - a.scheda.valoreDiMana ||
        (a.scheda.nome < b.scheda.nome ? -1 : a.scheda.nome > b.scheda.nome ? 1 : 0),
    )
    .map(({ indice }) => indice);

  const eccessoDiTerre = terre.slice(TERRE_VOLUTE_IN_MANO).reverse();
  const ordine = [...eccessoDiTerre, ...magie, ...terre.slice(0, TERRE_VOLUTE_IN_MANO)];
  return new Set(ordine.slice(0, quante));
}

/** La regola di mulligan, tutta qui: si guardano le terre e nient'altro. */
function manoTenibile(mano: readonly Scheda[]): boolean {
  const terre = mano.filter((scheda) => scheda.terra !== null).length;
  return terre >= TERRE_MINIME_IN_MANO && terre <= TERRE_MASSIME_IN_MANO;
}

type Partita = {
  turnoDiChiusura: number | null;
  danno: number;
  primaManoTenibile: boolean;
  mulligan: number;
  impiantata: boolean;
};

function giocaUnaPartita(carte: readonly Scheda[], generatore: Caso): Partita {
  let mulligan = 0;
  let primaManoTenibile = false;
  let mano: Scheda[] = [];
  let biblioteca: Scheda[] = [];

  for (;;) {
    const mescolate = mescola(carte, generatore);
    mano = mescolate.slice(0, CARTE_IN_MANO_INIZIALI);
    biblioteca = mescolate.slice(CARTE_IN_MANO_INIZIALI);
    const tenibile = manoTenibile(mano);
    if (mulligan === 0) primaManoTenibile = tenibile;
    if (tenibile || mulligan === MULLIGAN_MASSIMI) break;
    mulligan++;
  }

  if (mulligan > 0) {
    const sotto = daMettereSotto(mano, Math.min(mulligan, mano.length));
    const tenute: Scheda[] = [];
    for (let i = 0; i < mano.length; i++) {
      if (sotto.has(i)) biblioteca.push(mano[i]!);
      else tenute.push(mano[i]!);
    }
    mano = tenute;
  }

  const fonti: Fonte[] = [];
  const creature: { forza: number; dalTurno: number }[] = [];
  let danno = 0;
  /** Le magie lanciate **entro il turno della partenza**, e non in tutta la partita. */
  let magieAllaPartenza = 0;
  let turnoDiChiusura: number | null = null;
  let pescate = 0;

  for (let turno = 1; turno <= TURNO_MASSIMO; turno++) {
    // Si gioca per primi: al primo turno non si pesca. Finita la biblioteca non
    // si pesca più e non si perde: senza avversario nessuno vince per decking.
    if (turno > 1 && pescate < biblioteca.length) mano.push(biblioteca[pescate++]!);

    const terra = scegliLaTerra(mano, fonti, turno);
    if (terra !== null) {
      const scheda = mano[terra]!;
      mano.splice(terra, 1);
      fonti.push({
        produce: scheda.terra!.produce,
        dalTurno: scheda.terra!.girata ? turno + 1 : turno,
      });
    }

    const lanciate = magieLanciabili(mano, fonti, turno);
    for (const indice of [...lanciate].sort((a, b) => b - a)) {
      const scheda = mano[indice]!;
      mano.splice(indice, 1);
      if (turno <= TURNO_DELLA_PARTENZA) magieAllaPartenza++;
      if (scheda.forza > 0) creature.push({ forza: scheda.forza, dalTurno: turno + 1 });
    }

    for (const creatura of creature) {
      if (creatura.dalTurno <= turno) danno += creatura.forza;
    }
    if (danno >= VITE_AVVERSARIO) {
      danno = VITE_AVVERSARIO;
      turnoDiChiusura = turno;
      break;
    }
  }

  const chiusaPresto = turnoDiChiusura !== null && turnoDiChiusura <= TURNO_DELLA_PARTENZA;
  return {
    turnoDiChiusura,
    danno,
    primaManoTenibile,
    mulligan,
    impiantata: !chiusaPresto && magieAllaPartenza < MAGIE_MINIME_ALLA_PARTENZA,
  };
}

/**
 * Quale terra giocare: si prova ogni terra diversa che si ha in mano e si tiene
 * quella che fa lanciare di più **questo turno**. È uno sguardo lungo un turno,
 * non un piano: basta a non sprecare un turno di mana e non pretende di saper
 * giocare a Magic.
 */
function scegliLaTerra(
  mano: readonly Scheda[],
  fonti: readonly Fonte[],
  turno: number,
): number | null {
  const coloriChiesti = new Set<ColoreMana>();
  for (const scheda of mano) {
    for (const pip of scheda.pips) for (const colore of pip) coloriChiesti.add(colore);
  }

  let scelta: number | null = null;
  let meglio: readonly number[] = [];
  const provate = new Set<string>();

  for (let i = 0; i < mano.length; i++) {
    const scheda = mano[i]!;
    if (scheda.terra === null) continue;
    // Due copie della stessa terra danno lo stesso esito: si prova una volta.
    const chiave = `${scheda.terra.girata ? "g" : "d"}|${[...scheda.terra.produce].sort().join("")}`;
    if (provate.has(chiave)) continue;
    provate.add(chiave);

    const con: Fonte[] = [
      ...fonti,
      { produce: scheda.terra.produce, dalTurno: scheda.terra.girata ? turno + 1 : turno },
    ];
    const restoDellaMano = [...mano.slice(0, i), ...mano.slice(i + 1)];
    const lanciate = magieLanciabili(restoDellaMano, con, turno);

    let mana = 0;
    let forza = 0;
    for (const indice of lanciate) {
      mana += restoDellaMano[indice]!.valoreDiMana;
      forza += restoDellaMano[indice]!.forza;
    }
    const utili = scheda.terra.produce.filter((colore) => coloriChiesti.has(colore)).length;
    // A parità di quel che si lancia oggi si mette giù la terra che entra
    // girata: costa un turno, e costa meno adesso che dopo.
    const voto = [mana, forza, scheda.terra.girata ? 1 : 0, utili];

    if (scelta === null || confronta(voto, meglio) > 0) {
      scelta = i;
      meglio = voto;
    }
  }

  return scelta;
}

function confronta(uno: readonly number[], altro: readonly number[]): number {
  for (let i = 0; i < uno.length; i++) {
    const differenza = uno[i]! - (altro[i] ?? 0);
    if (differenza !== 0) return differenza;
  }
  return 0;
}

/**
 * La cucitura: un mazzo intero — terre comprese — e una richiesta col seme
 * dentro, e ne escono i numeri della simulazione.
 */
export function simulaGoldfish(
  mazzo: readonly CopieDiCarta[],
  richiesta: RichiestaDiSimulazione,
): EsitoDellaSimulazione {
  const partite = richiesta.partite ?? PARTITE_SIMULATE;
  if (!Number.isInteger(partite) || partite <= 0) {
    throw new Error("Il numero di partite dev'essere un intero positivo.");
  }

  const carte: Scheda[] = [];
  for (const voce of mazzo) {
    if (voce.copie <= 0) continue;
    const scheda = leggi(voce.carta);
    for (let i = 0; i < voce.copie; i++) carte.push(scheda);
  }

  const generatore = caso(richiesta.seme);

  let chiuse = 0;
  let sommaDeiTurni = 0;
  let sommaDelDanno = 0;
  let tenibili = 0;
  let sommaDeiMulligan = 0;
  let impiantate = 0;

  for (let i = 0; i < partite; i++) {
    const partita = giocaUnaPartita(carte, generatore);
    if (partita.turnoDiChiusura !== null) {
      chiuse++;
      sommaDeiTurni += partita.turnoDiChiusura;
    }
    sommaDelDanno += partita.danno;
    if (partita.primaManoTenibile) tenibili++;
    sommaDeiMulligan += partita.mulligan;
    if (partita.impiantata) impiantate++;
  }

  return {
    partite,
    turnoMedioDiChiusura: chiuse === 0 ? null : sommaDeiTurni / chiuse,
    quotaPartiteChiuse: chiuse / partite,
    quotaManiTenibili: tenibili / partite,
    mulliganMedi: sommaDeiMulligan / partite,
    quotaPartenzeImpiantate: impiantate / partite,
    dannoMedio: sommaDelDanno / partite,
    turnoMassimo: TURNO_MASSIMO,
  };
}
