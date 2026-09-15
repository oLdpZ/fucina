/**
 * Che cosa dice la schermata dei mazzi salvati dopo «Cancella» (ticket 50).
 *
 * `dimenticaMazzo` risponde con un `EsitoDellaScrittura`, e questa è la
 * decisione su che farne. Sta fuori dal componente perché è la parte che si
 * prova: la suite gira in `node`, e un componente Preact non si monta.
 *
 * Una cancellazione non riuscita va detta **nel canale dei guasti**, e il mazzo
 * **resta nell'elenco**: prima si annunciava «è stato cancellato» e poi la
 * rilettura rimetteva il mazzo dov'era, nella riga sotto la frase che lo diceva
 * andato.
 *
 * `rifiutata` e `nessun-deposito` dicono la stessa cosa, e non è la regola degli
 * orologi copiata al contrario. Là il ripristino taceva su un deposito che non
 * si apre perché di quel che sta sul dispositivo non si sapeva niente. Qui si sa
 * quel che basta: il mazzo l'utente l'ha appena visto nell'elenco, letto da un
 * deposito che si era aperto, e nessuno l'ha cancellato. Il caso si presenta —
 * un'altra scheda che porta il deposito a una versione più nuova fa fallire le
 * aperture di questa — e la frase resta vera anche lì.
 *
 * Nessun «riprova più tardi»: nel caso della versione più nuova riprovare
 * fallisce uguale finché la scheda non si ricarica, e un rimedio che vale per
 * un caso solo non si suggerisce a tutti.
 */

import type { EsitoDellaScrittura } from "../dati/deposito.js";

/**
 * La notizia da dare, nei due canali della schermata, e se il mazzo esce
 * dall'elenco e dalle mani.
 */
export interface NotaDellaCancellazione {
  readonly fatto: string | null;
  readonly male: string | null;
  readonly tolto: boolean;
}

export function notaDellaCancellazione(
  nome: string,
  come: EsitoDellaScrittura,
): NotaDellaCancellazione {
  if (come === "fatta") return { fatto: `«${nome}» è stato cancellato.`, male: null, tolto: true };
  return {
    fatto: null,
    male: `«${nome}» non si è potuto cancellare, ed è ancora nell'elenco.`,
    tolto: false,
  };
}
