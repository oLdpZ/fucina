/**
 * Quel che l'app dice di un aggiornamento che non ha preso (ticket 11).
 *
 * Una frase sola per caso, costruita sul motivo vero e sulla data dei dati che
 * restano: chi la legge deve sapere che cosa non è arrivato, perché, e con quali
 * dati sta lavorando adesso. Non si dice niente, invece, di un aggiornamento che
 * non è arrivato affatto: senza rete l'app è corretta, e non c'è niente da
 * spiegare.
 */

import type { Aggiornabile, Rifiuto } from "./aggiornamento.js";
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

/**
 * La nota di un dato conservato che il deposito non ha lasciato guardare
 * (ticket 65), con la data di quel che resta in uso.
 *
 * Dice solo quel che si sa: che là **potrebbe** esserci qualcosa di più fresco.
 * Non promette che ci sia — il deposito può anche essere vuoto — e non dà un
 * rimedio, perché le cause di un deposito che non si fa guardare sono più d'una.
 */
export function notaDelNonVisto(
  cosa: Aggiornabile,
  inUso: { documentoDel: string; prezziDel: string },
): string {
  return cosa === "documento"
    ? "Sul dispositivo potrebbe esserci un documento di formato più fresco, preso in una " +
        "sessione passata, che non si è potuto leggere. " +
        `Resta quello del ${dataInItaliano(inUso.documentoDel)}.`
    : "Sul dispositivo potrebbero esserci dei prezzi più freschi, presi in una sessione " +
        "passata, che non si sono potuti leggere. " +
        `Restano quelli del ${dataInItaliano(inUso.prezziDel)}.`;
}
