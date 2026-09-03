/**
 * «Questo tema sta in piedi?» — la risposta che arriva **prima di generare**
 * (ticket 08, Q26).
 *
 * È un conto sul solo numero di carte disponibili: un passaggio sul pool per
 * il verdetto, e uno per ognuna delle strade proposte. Sul pool vero sono
 * pochi millisecondi — una decina quando ci sono anche le proposte — e si può
 * quindi rifare a ogni tocco mentre l'utente costruisce il tema, dicendogli
 * subito che quella strada non porta a un mazzo. Aspettare venti secondi di
 * ricerca per ricevere un mazzo scadente non aiuta nessuno.
 *
 * I tre esiti:
 *
 * - **impossibile** — le copie disponibili non riempiono i posti non-terra. Non
 *   è una taratura ma un conto: un mazzo legale non esiste, e nessuna soglia
 *   ritarata potrà farlo esistere.
 * - **stretto** — le carte bastano appena. Il mazzo si fa, ma la frontiera sarà
 *   corta e i mazzi si somiglieranno, perché sono quasi le stesse carte in
 *   ordine diverso.
 * - **ampio** — c'è da scegliere, e la ricerca ha di che lavorare.
 *
 * Quando il tema non è ampio arrivano gli **allargamenti**: proposte generate
 * dal tema stesso, mostrate una per una, e mai applicate senza che l'utente le
 * accetti.
 */

import type { Carta } from "../dati/pool.js";
import { copieMassime } from "../mazzo/copie.js";
import { proponiAllargamenti } from "./allargamenti.js";
import { CARTE_DISTINTE_COMODE, POSTI_NON_TERRA } from "./taratura.js";
import { carteDelTema, eTerra, risolviTema, type Allargamento, type Tema } from "./tema.js";

export type Verdetto = "impossibile" | "stretto" | "ampio";

export type Ampiezza = {
  verdetto: Verdetto;
  /** Le carte distinte non-terra che il tema prende dal pool di oggi. */
  carteDisponibili: number;
  /** I posti che quelle carte potrebbero occupare, contando le copie ammesse. */
  copieDisponibili: number;
  /** I posti da riempire: le carte del mazzo meno le terre. */
  postiNonTerra: number;
  /** Sotto tante carte distinte il tema è stretto. Soglia provvisoria. */
  carteComode: number;
  /** Le strade per allargare il tema, dalla più fedele alla più larga. */
  allargamenti: readonly Allargamento[];
};

/**
 * Il verdetto sul tema, e le strade per allargarlo.
 *
 * Non tocca il tema che riceve: valutare un tema non è cambiarlo. Le terre
 * restano fuori dal conto perché riempiono altri posti — le sceglie l'app dalla
 * curva (ticket 06) — e un tema fatto di sole terre non ha nessuna carta con
 * cui riempire il mazzo.
 */
export function valutaTema(carte: readonly Carta[], tema: Tema): Ampiezza {
  const risolto = risolviTema(tema, carte);
  const nonTerre = carte.filter((carta) => !eTerra(carta));
  const nelTema = carteDelTema(nonTerre, risolto);

  // Una carta che si concede copie illimitate non porta un mazzo intero da
  // sola: oltre i posti da riempire, le copie in più non servono a niente.
  const copieDisponibili = nelTema.reduce(
    (somma, carta) => somma + Math.min(copieMassime(carta), POSTI_NON_TERRA),
    0,
  );

  const verdetto: Verdetto =
    copieDisponibili < POSTI_NON_TERRA
      ? "impossibile"
      : nelTema.length < CARTE_DISTINTE_COMODE
        ? "stretto"
        : "ampio";

  return {
    verdetto,
    carteDisponibili: nelTema.length,
    copieDisponibili,
    postiNonTerra: POSTI_NON_TERRA,
    carteComode: CARTE_DISTINTE_COMODE,
    // Un tema ampio non ha bisogno di proposte, e cercarle costerebbe quattro
    // passaggi sul pool a ogni tocco per poi buttarle via.
    allargamenti:
      verdetto === "ampio" ? [] : proponiAllargamenti(nonTerre, tema, risolto.seme, nelTema),
  };
}
