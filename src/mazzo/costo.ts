/**
 * Il costo di mana letto come **richiesta di colori**: quali simboli vogliono
 * per forza una terra di un certo colore, e quali si accontentano di qualunque
 * cosa.
 *
 * Questa lettura è la sola porta fra il testo del costo (`{1}{R}{R}`, come sta
 * nei dati di Scryfall) e il calcolo delle probabilità. Sbagliare qui vorrebbe
 * dire mostrare numeri giusti su una domanda sbagliata, e sarebbe peggio che
 * non mostrarli.
 */

import type { ColoreMana } from "../dati/pool.js";
import type { Pip } from "./probabilita.js";

const COLORI: readonly string[] = ["W", "U", "B", "R", "G", "C"];

/**
 * I simboli colorati di un costo, uno per elemento, ciascuno come insieme dei
 * colori che lo pagano.
 *
 * Si scartano, e non è una dimenticanza:
 *
 * - il mana generico (`{3}`) e la `{X}`, che li paga qualunque terra;
 * - gli ibridi col generico (`{2/W}`), che si pagano con due mana qualsiasi;
 * - i simboli Phyrexiani (`{U/P}`), che si pagano con due punti vita.
 *
 * In tutti e tre i casi pretendere il colore direbbe che la carta è più
 * difficile da lanciare di quanto sia.
 */
export function simboliDiColore(costoDiMana: string): Pip[] {
  const simboli = costoDiMana.match(/\{[^}]+\}/g) ?? [];
  const pips: Pip[] = [];

  for (const simbolo of simboli) {
    const parti = simbolo.slice(1, -1).toUpperCase().split("/");
    // Phyrexiano, o ibrido col generico: nessun colore obbligatorio.
    if (parti.some((parte) => parte === "P" || /^\d+$/.test(parte))) continue;
    const colori = parti.filter((parte): parte is ColoreMana => COLORI.includes(parte));
    if (colori.length === 0) continue;
    pips.push(colori);
  }

  return pips;
}
