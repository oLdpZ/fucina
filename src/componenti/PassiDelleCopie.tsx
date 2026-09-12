/**
 * Il comando che mette e toglie copie di una carta dal mazzo (ticket 06).
 *
 * Sta sotto ogni carta del catalogo e dentro la carta aperta, ed è lo stesso
 * comando in tutti e due i posti: chi ha imparato a usarlo una volta lo sa già
 * usare ovunque.
 *
 * Le terre non si aggiungono a mano, e non è una dimenticanza: la base di terre
 * la decide l'app dalla curva del mazzo, ed è il senso della schermata «Mazzo».
 * Il comando lo dice invece di sparire in silenzio, perché una carta senza il
 * suo bottone farebbe pensare a un guasto.
 */

import type { Carta } from "../dati/pool.js";
import { entraInMano, tettoInMano } from "../mazzo/copie.js";

export function PassiDelleCopie({
  carta,
  copie,
  cambiaCopie,
  grande = false,
}: {
  carta: Carta;
  copie: number;
  cambiaCopie: (carta: Carta, delta: number) => void;
  grande?: boolean;
}) {
  // La regola non è di questo comando: è quella che decide che cosa il mazzo in
  // mano contiene (`entraInMano`), e qui si legge invece di ripetersi. Il
  // comando la **dice** invece di sparire in silenzio, perché una carta senza il
  // suo bottone farebbe pensare a un guasto.
  if (!entraInMano(carta)) {
    return <p class="terra-non-si-aggiunge">Le terre le sceglie l&rsquo;app</p>;
  }

  // Fin dove il più può arrivare: il tetto della carta — quasi sempre quattro,
  // ma non per quelle poche che portano scritto di poterne mettere quante se ne
  // vuole — e comunque non oltre il mazzo. È lo stesso numero a cui `cambiaCopie`
  // tronca, chiesto alla stessa funzione: un bottone che resta acceso su un
  // passo che non fa niente è un bottone rotto.
  const tetto = tettoInMano(carta);

  return (
    <div class={grande ? "passi" : "passi piccoli"} data-nel-mazzo={copie > 0}>
      <button
        type="button"
        onClick={() => cambiaCopie(carta, -1)}
        disabled={copie === 0}
        aria-label={`Una copia in meno di ${carta.nome}`}
      >
        −
      </button>
      <span class="copie" aria-live="polite">
        {copie > 0 ? `${copie} nel mazzo` : "nel mazzo"}
      </span>
      <button
        type="button"
        onClick={() => cambiaCopie(carta, +1)}
        disabled={copie >= tetto}
        aria-label={`Una copia in più di ${carta.nome}`}
      >
        +
      </button>
    </div>
  );
}
