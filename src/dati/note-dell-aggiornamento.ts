/**
 * Quel che l'app dice di un aggiornamento che non ha preso (ticket 11).
 *
 * Una frase sola per caso, costruita sul motivo vero e sulla data dei dati che
 * restano: chi la legge deve sapere che cosa non è arrivato, perché, e con quali
 * dati sta lavorando adesso. Non si dice niente, invece, di un aggiornamento che
 * non è arrivato affatto: senza rete l'app è corretta, e non c'è niente da
 * spiegare.
 */

import type { Rifiuto } from "./aggiornamento.js";
import { dataInItaliano } from "./carica-pool.js";

/**
 * La nota di un rifiuto, con la data di quel che resta in uso.
 *
 * Il motivo è la frase che ha scritto chi ha rifiutato, e finisce col punto: qui
 * gli si mette intorno quel che serve per leggerla — che cosa è arrivato, e che
 * cosa resta.
 */
export function notaDelRifiuto(
  rifiuto: Rifiuto,
  inUso: { documentoDel: string; prezziDel: string },
): string {
  return rifiuto.cosa === "documento"
    ? `È arrivato un documento di formato che non si può usare. ${rifiuto.motivo} ` +
        `Resta quello del ${dataInItaliano(inUso.documentoDel)}.`
    : `Sono arrivati dei prezzi che non si possono usare. ${rifiuto.motivo} ` +
        `Restano quelli del ${dataInItaliano(inUso.prezziDel)}.`;
}
