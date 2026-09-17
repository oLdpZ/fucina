/**
 * **La strategia dichiarata** (ticket 04 della tappa 3): la schermata in cui
 * l'utente dice *come* vuole vincere, accanto a quella in cui dice *che cosa*
 * vuole giocare.
 *
 * Due cose vanno lette prima di tutto il resto, e stanno scritte in cima dove
 * si leggono senza scorrere:
 *
 * - **è facoltativa**: senza, l'app costruisce come ha sempre costruito;
 * - **è un vincolo duro**: quel che ne esce sono solo mazzi che l'app ha
 *   *misurato* cadere in quella casella, e la frontiera può risultare più
 *   corta. Il prezzo si paga in potenza, e si legge dove si leggono tutti i
 *   prezzi (ADR-0001).
 *
 * Qui c'è anche la voce della **guardia**: se con le carte che restano quella
 * strategia non si fa, lo si sente **prima** di premere il tasto, e con dentro
 * il conto. Le frasi non si scrivono qui — arrivano da `spiegazioni/frasi.ts`,
 * dove stanno tutte insieme.
 *
 * Il tema e la strategia non vanno confusi, e la schermata lo dice: *Goblin* è
 * un tema, *aggro* è una strategia, e si scelgono separatamente.
 */

import { useMemo } from "preact/hooks";

import type { Orologio } from "../avversario/orologio.js";
import { risolviCombo, type Combo } from "../combo/combo.js";
import type { Pool } from "../dati/pool.js";
import { giocabiliDellaRicerca } from "../ricerca/costruisci.js";
import { frasePerLaGuardia } from "../spiegazioni/frasi.js";
import { guardiaDellaStrategia } from "../strategia/guardia.js";
import { STRATEGIE, type Strategia as StrategiaDichiarata } from "../strategia/strategia.js";
import type { Tema } from "../tema/tema.js";

/**
 * Come si legge ogni scelta, e che promette. Sono parole e non numeri: i numeri
 * che separano le tre caselle li misura l'app dopo, e sono provvisori — dirli
 * qui li farebbe sembrare una regola del gioco.
 */
const COME_SI_LEGGE: Record<StrategiaDichiarata, { titolo: string; dice: string }> = {
  aggro: { titolo: "Aggro", dice: "chiude presto, e quasi sempre." },
  midrange: { titolo: "Midrange", dice: "chiude quasi sempre, un po’ più tardi." },
  controllo: {
    titolo: "Controllo",
    dice: "chiude tardi, e tiene l’avversario più lontano del proprio arrivo.",
  },
};

export function Strategia({
  pool,
  tema,
  combo,
  tettoDiSpesa,
  orologi,
  strategia,
  cambiaStrategia,
}: {
  pool: Pool;
  /** Il tema serve alla guardia: le esclusioni tolgono carte dal conto. */
  tema: Tema;
  /** E la combo pure: i suoi pezzi nel mazzo entrano comunque. */
  combo: Combo;
  /** Il tetto pure: quel che non si compra non fa danno a nessuno. */
  tettoDiSpesa: number | null;
  /** E gli orologi: senza nemmeno uno, il controllo non si misura. */
  orologi: readonly Orologio[];
  strategia: StrategiaDichiarata | null;
  cambiaStrategia: (strategia: StrategiaDichiarata | null) => void;
}) {
  /**
   * Le carte su cui la guardia fa il suo conto: **le stesse** che la ricerca
   * potrebbe usare, dalla stessa funzione che usa lei.
   *
   * Riscriverne qui una versione somigliante vorrebbe dire due conti che prima o
   * poi divergono, e allora la schermata direbbe «impossibile» su un pool e il
   * motore costruirebbe su un altro — o, peggio, il contrario.
   */
  const carte = useMemo(
    () => [
      ...giocabiliDellaRicerca(pool.carte, tema, tettoDiSpesa),
      ...risolviCombo(combo, pool.carte, tema).pezzi,
    ],
    [pool.carte, tema, tettoDiSpesa, combo],
  );

  /**
   * Il verdetto sulla strategia **dichiarata**, e su nessun'altra: sentire tre
   * verdetti insieme trasformerebbe la guardia in un consiglio su che strategia
   * scegliere, che è un'altra cosa e non è quel che l'app sa fare.
   */
  const detto = useMemo(
    () =>
      strategia === null
        ? null
        : frasePerLaGuardia(guardiaDellaStrategia({ strategia, carte, orologi })),
    [strategia, carte, orologi],
  );

  return (
    <section class="strategia-dichiarata">
      <h2>Come vuoi vincere</h2>

      <p class="patto">
        È facoltativa: senza, costruisco come ho sempre costruito. Se la dichiari
        diventa un <strong>vincolo duro</strong> — ti do solo mazzi che ho misurato giocare
        così, e la fila dei mazzi può venire più corta. Quel che costa si legge in potenza,
        dove si leggono tutti i prezzi. Non confonderla col tema: «Goblin» è un tema,
        «aggro» è una strategia.
      </p>

      <div class="scelte-strategia" role="group" aria-label="Strategia">
        <button
          type="button"
          class="chip"
          aria-pressed={strategia === null}
          onClick={() => cambiaStrategia(null)}
        >
          Nessuna
        </button>
        {STRATEGIE.map((quale) => (
          <button
            key={quale}
            type="button"
            class="chip"
            aria-pressed={strategia === quale}
            onClick={() => cambiaStrategia(quale)}
          >
            {COME_SI_LEGGE[quale].titolo}
          </button>
        ))}
      </div>

      {strategia === null ? (
        <p class="nota-filtro">
          Nessuna strategia dichiarata: costruisco il mazzo più forte che il tema permetta,
          come sempre.
        </p>
      ) : (
        <p class="nota-filtro">
          {COME_SI_LEGGE[strategia].titolo}: {COME_SI_LEGGE[strategia].dice} Che un mazzo lo
          sia lo misuro facendolo giocare, non guardando che carte contiene.
        </p>
      )}

      {/*
        La voce della guardia. Compare solo quando è certa, e quando compare è
        la cosa più importante in pagina: si legge prima di premere il tasto, e
        porta dentro il conto da cui esce.
      */}
      {detto !== null ? <p class="nota-filtro avviso-guardia">{detto}</p> : null}
    </section>
  );
}
