/**
 * Lo stato del motore che la schermata mostra, e come cambia.
 *
 * Il worker resta nel gancio (`usa-motore.ts`); qui c'è solo quel che se ne
 * vede — sta lavorando, a che punto è, che cosa ha trovato, che cosa è andato
 * storto, e perché si è fermato se non si è fermato da sé. È una regola, e sta
 * dove la si può provare: la suite gira in `node`, e un gancio Preact non si
 * monta.
 */

import type { Avanzamento, Frontiera } from "./costruisci.js";
import type { IngressoDellaRichiesta } from "./ripensamento.js";

export type StatoDelMotore = {
  allOpera: boolean;
  avanzamento: Avanzamento | null;
  frontiera: Frontiera | null;
  guasto: string | null;
  /**
   * Gli ingressi della richiesta cambiati mentre il motore lavorava, se è per
   * quello che si è fermato; `null` altrimenti (ticket 46).
   *
   * Non è un guasto e non ne prende il posto: nessuno ha sbagliato niente. Se
   * ne va da sé alla ricerca successiva, e solo lì — un altro ingresso che
   * cambia a motore fermo non lo riscrive, perché la ricerca fermata è ancora
   * quella di prima.
   */
  fermataPer: readonly IngressoDellaRichiesta[] | null;
};

export type EventoDelMotore =
  /** Il tasto «Costruisci il mazzo». */
  | { tipo: "parte" }
  | { tipo: "avanzamento"; avanzamento: Avanzamento }
  | { tipo: "frontiera"; frontiera: Frontiera }
  | { tipo: "guasto"; messaggio: string }
  /** Il tasto «Ferma»: chi l'ha premuto sa perché, e non serve dirglielo. */
  | { tipo: "fermata-a-mano" }
  /**
   * Un ingresso della richiesta è cambiato: il mazzo di prima non vale più.
   *
   * `interrotta` dice se il worker stava cercando, e lo dice il gancio che il
   * worker lo tiene: è lui che decide se spegnerlo, e la frase deve seguire la
   * stessa decisione, non rifarla su uno stato che può essere di un giro prima.
   */
  | {
      tipo: "ripensamento";
      cambiati: readonly IngressoDellaRichiesta[];
      interrotta: boolean;
    };

export const STATO_DEL_MOTORE_INIZIALE: StatoDelMotore = {
  allOpera: false,
  avanzamento: null,
  frontiera: null,
  guasto: null,
  fermataPer: null,
};

export function avanzaIlMotore(stato: StatoDelMotore, evento: EventoDelMotore): StatoDelMotore {
  switch (evento.tipo) {
    case "parte":
      return { ...STATO_DEL_MOTORE_INIZIALE, allOpera: true };
    case "avanzamento":
      return { ...stato, avanzamento: evento.avanzamento };
    case "frontiera":
      return { ...stato, allOpera: false, frontiera: evento.frontiera };
    case "guasto":
      return { ...stato, allOpera: false, guasto: evento.messaggio };
    case "fermata-a-mano":
      return { ...stato, allOpera: false, avanzamento: null };
    case "ripensamento":
      return {
        ...stato,
        allOpera: false,
        avanzamento: null,
        frontiera: null,
        guasto: null,
        fermataPer: evento.interrotta ? evento.cambiati : stato.fermataPer,
      };
  }
}
