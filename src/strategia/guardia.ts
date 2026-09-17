/**
 * **La guardia della strategia**: il conto che parla *prima* di costruire, e
 * solo quando è certo (ADR-0001, ticket 04 della tappa 3).
 *
 * L'archetipo si misura facendo giocare il mazzo, e un mazzo per giocarlo va
 * prima costruito: il verdetto «con questo tema un aggro non si fa» sarebbe
 * quindi incalcolabile. La guardia lo rende possibile senza definire niente,
 * perché **esclude soltanto**: guarda la composizione delle carte che la
 * ricerca potrebbe usare, e quando un conto grossolano dimostra che nessun
 * mazzo di quelle carte può comportarsi come è stato chiesto, lo dice. In ogni
 * altro caso **tace**.
 *
 * ## Non definisce l'archetipo, lo esclude
 *
 * È la riga che ADR-0001 traccia, e qui va riletta con attenzione, perché
 * questo è il solo modulo della strategia che le carte le guarda. La guardia
 * non dice mai *questo è un aggro*: non ha un verdetto per dirlo. Può dire solo
 * *questo non potrà esserlo*, e lo dice su una **impossibilità**, non su una
 * somiglianza — mai «un aggro ha almeno N creature», che è la regola vietata,
 * ma «venti punti di vita, con queste carte, entro quel turno non si toglieranno
 * mai». Chi dice che un mazzo **è** un aggro resta `archetipo.ts`, che le carte
 * non le riceve affatto.
 *
 * È il principio già scritto in testa ai tag di sinergia — *le regole
 * preferiscono tacere che sbagliare* — applicato a un problema nuovo. Una
 * guardia che dica «impossibile» a un tema che ce l'avrebbe fatta è un guasto
 * dell'app; una che tace troppo spesso è solo una guardia timida.
 *
 * ## I due conti che sono certi
 *
 * 1. **Il danno che non arriva in tempo.** La simulazione goldfish fa danno
 *    **solo con le creature**, per la loro forza, dal turno dopo quello in cui
 *    entrano, e il mana viene **solo dalle terre**, una per turno
 *    (`mazzo/simulazione.ts`). Da qui esce un tetto al danno che *qualunque*
 *    mazzo fatto con queste carte può avere inflitto entro un turno, nella
 *    partita più fortunata che si possa immaginare: se quel tetto non arriva a
 *    `VITE_AVVERSARIO`, nessuna partita chiude entro quel turno, e allora il
 *    turno medio di chiusura non potrà stare entro la soglia dell'archetipo
 *    chiesto. Il conto è **generoso di proposito** — ignora i colori del mana,
 *    ignora che le carte vanno pescate, lascia rilanciare le stesse copie ogni
 *    turno — perché un tetto troppo alto fa tacere la guardia, mentre uno
 *    troppo basso la farebbe mentire.
 * 2. **Il controllo senza orologi.** Il controllo si riconosce dal reggere le
 *    corse *grazie al ritardo che infligge*, e senza nemmeno un orologio
 *    dichiarato non esiste nessuna corsa da reggere: quella casella non si
 *    misura affatto (`archetipo.ts`), e nessun mazzo potrà caderci. Non è un
 *    conto sulla composizione ed è ugualmente certo, che è la sola cosa che la
 *    guardia chiede.
 *
 * Quanti altri conti valga la pena fare — e quali si possano dire «ovvi»
 * abbastanza — è la **quarta taratura** che questa tappa consegna alla sosta:
 * sta scritto in `taratura.ts`, dove si legge accanto alle soglie.
 */

import type { Carta } from "../dati/pool.js";
import type { Orologio } from "../avversario/orologio.js";
import { CARTE_IN_MANO_INIZIALI, TURNO_MASSIMO, VITE_AVVERSARIO } from "../mazzo/taratura.js";
import type { Strategia } from "./strategia.js";
import { TURNO_MASSIMO_AGGRO, TURNO_MASSIMO_MIDRANGE } from "./taratura.js";

/**
 * Perché la guardia ha detto «impossibile». Sono i soli due conti certi che
 * esistano oggi; ognuno ha la sua frase in `spiegazioni/frasi.ts`.
 */
export type MotivoDellaGuardia =
  /** Venti punti di vita, con queste carte, entro quel turno non si toglieranno. */
  | "danno-fuori-tempo"
  /** Nessun orologio dichiarato: il controllo non si misura, quindi non si fa. */
  | "controllo-senza-orologi";

/** I numeri che giustificano il verdetto, come per ogni cosa che l'app dice. */
export type GrezziDellaGuardia = {
  strategia: Strategia;
  /**
   * Il turno entro cui, per essere quell'archetipo, il mazzo deve aver chiuso
   * almeno una partita. `null` per un motivo che coi turni non c'entra.
   */
  turno: number | null;
  /**
   * Il danno più alto che un mazzo fatto con queste carte potrebbe aver
   * inflitto entro quel turno, nella partita più fortunata immaginabile.
   * `null` come sopra.
   */
  dannoMassimo: number | null;
  /** I punti vita da togliere: `VITE_AVVERSARIO`, e non un numero scritto qui. */
  vite: number;
  /** Quanti orologi l'utente ha dichiarato. */
  orologi: number;
};

/**
 * Il verdetto: o **impossibile** con dentro il suo conto, o **silenzio**.
 *
 * Non esiste un terzo caso, e non è una dimenticanza: «possibile» sarebbe una
 * promessa che nessun conto grossolano può mantenere, e la guardia che la
 * facesse starebbe definendo l'archetipo dalla composizione.
 */
export type VerdettoDellaGuardia =
  | { verdetto: "tace" }
  | { verdetto: "impossibile"; motivo: MotivoDellaGuardia; grezzi: GrezziDellaGuardia };

const TACE: VerdettoDellaGuardia = { verdetto: "tace" };

/**
 * Entro quale turno il mazzo deve aver chiuso almeno una partita per poter
 * essere quell'archetipo.
 *
 * Il turno **medio** di chiusura si prende sulle sole partite chiuse: se nessuna
 * partita chiude entro la soglia, la media non può starci sotto. Per il
 * controllo la soglia non è un massimo ma il tetto della simulazione — chiude
 * tardi, ma deve chiudere: `QUOTA_MINIMA_DEL_CONTROLLO` non è zero.
 */
function turnoDaChiudere(strategia: Strategia): number {
  if (strategia === "aggro") return TURNO_MASSIMO_AGGRO;
  if (strategia === "midrange") return TURNO_MASSIMO_MIDRANGE;
  return TURNO_MASSIMO;
}

/**
 * La guardia, sulle carte che la ricerca potrebbe davvero usare.
 *
 * `carte` sono le giocabili che restano dopo le esclusioni del tema e dopo il
 * tetto di spesa — non le carte del tema: le **inclusioni** del tema sono un
 * vincolo morbido, e lungo la frontiera i passi che quasi lo ignorano pescano
 * da tutto il resto. Guardare le sole carte del tema farebbe dire «impossibile»
 * a un tema che un mazzo dell'archetipo chiesto l'avrebbe trovato cedendo tema,
 * cioè il guasto che questo modulo esiste per non fare.
 */
export function guardiaDellaStrategia({
  strategia,
  carte,
  orologi,
}: {
  strategia: Strategia;
  carte: readonly Carta[];
  orologi: readonly Orologio[];
}): VerdettoDellaGuardia {
  if (strategia === "controllo" && orologi.length === 0) {
    return {
      verdetto: "impossibile",
      motivo: "controllo-senza-orologi",
      grezzi: { strategia, turno: null, dannoMassimo: null, vite: VITE_AVVERSARIO, orologi: 0 },
    };
  }

  const turno = turnoDaChiudere(strategia);
  const dannoMassimo = dannoMassimoEntro(carte, turno);
  if (dannoMassimo < VITE_AVVERSARIO) {
    return {
      verdetto: "impossibile",
      motivo: "danno-fuori-tempo",
      grezzi: {
        strategia,
        turno,
        dannoMassimo,
        vite: VITE_AVVERSARIO,
        orologi: orologi.length,
      },
    };
  }

  return TACE;
}

/**
 * Il danno più alto che un mazzo fatto con queste carte possa aver inflitto
 * entro `turno`, nella partita più fortunata che la simulazione permetta.
 *
 * È un **tetto**, e ogni approssimazione va nella direzione che lo alza: chi
 * legge questo numero ne ricava un «impossibile», e un tetto sottostimato
 * sarebbe una guardia che mente.
 *
 * Il conto segue le regole della simulazione (`mazzo/simulazione.ts`):
 *
 * - il mana viene **solo dalle terre**, una per turno, quindi al turno `s` non
 *   si può spendere più di `s`;
 * - una creatura lanciata al turno `s` picchia dal turno `s + 1`, cioè per
 *   `turno − s` volte;
 * - le carte in mano al turno `s` non sono più di `CARTE_IN_MANO_INIZIALI` più
 *   una per turno pescato, e serve a non lasciare infinito il conto quando fra
 *   le carte c'è una creatura a costo zero.
 *
 * Quel che si concede alla fortuna, e che rende il numero un tetto e non una
 * previsione: i colori del mana non si pagano, le carte si hanno in mano appena
 * servono, e ogni turno si possono rilanciare le stesse copie da capo.
 */
function dannoMassimoEntro(carte: readonly Carta[], turno: number): number {
  /** La forza migliore per ogni costo: di due creature allo stesso costo, la più forte. */
  const forzaPerCosto = new Map<number, number>();
  for (const carta of carte) {
    if (carta.terra !== null) continue;
    if (!carta.tipi.some((tipo) => tipo.toLowerCase() === "creature")) continue;
    // La forza che non è un numero conta zero, come nella simulazione: `*` non
    // si sa quanto valga, e il tetto non si alza con quel che non si sa.
    const forza = Number(carta.forza);
    if (!Number.isFinite(forza) || forza <= 0) continue;
    const costo = Math.max(0, carta.valoreDiMana);
    forzaPerCosto.set(costo, Math.max(forzaPerCosto.get(costo) ?? 0, forza));
  }
  if (forzaPerCosto.size === 0) return 0;

  // Il mana e le carte che il turno più lungo concede: le creature che picchiano
  // entro `turno` sono quelle lanciate entro `turno - 1`.
  const manoMassima = CARTE_IN_MANO_INIZIALI + Math.max(0, turno - 2);
  const manaMassimo = Math.max(0, turno - 1);

  /**
   * `migliore[mana][carte]`: la forza più alta che si possa mettere in gioco in
   * un turno con quel mana e quelle carte in mano. È uno zaino a copie
   * illimitate su due dimensioni — il mana e il numero di carte — e le copie si
   * lasciano illimitate di proposito: un tetto per carta abbasserebbe il numero,
   * e questo numero deve stare in alto.
   */
  const migliore: number[][] = Array.from({ length: manaMassimo + 1 }, () =>
    new Array<number>(manoMassima + 1).fill(0),
  );
  for (let mana = 0; mana <= manaMassimo; mana++) {
    for (let mano = 1; mano <= manoMassima; mano++) {
      let meglio = migliore[mana]![mano - 1]!;
      for (const [costo, forza] of forzaPerCosto) {
        if (costo > mana) continue;
        const prima = migliore[mana - costo]![mano - 1]!;
        meglio = Math.max(meglio, prima + forza);
      }
      migliore[mana]![mano] = meglio;
    }
  }

  let danno = 0;
  for (let lancio = 1; lancio < turno; lancio++) {
    const mano = Math.min(manoMassima, CARTE_IN_MANO_INIZIALI + Math.max(0, lancio - 1));
    danno += migliore[Math.min(manaMassimo, lancio)]![mano]! * (turno - lancio);
  }
  return danno;
}
