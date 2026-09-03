/**
 * Il tasto che costruisce il mazzo, e quel che si vede mentre lo costruisce
 * (ticket 11).
 *
 * La ricerca dura secondi e gira in un **web worker**: l'interfaccia resta
 * viva, si può passare al catalogo a controllare una carta e tornare qui a
 * trovare la ricerca dov'era. Il worker non vive qui dentro ma nell'App
 * (`ricerca/usa-motore.ts`), ed è per quello: una schermata che si smonta non
 * deve poter buttare via otto secondi di lavoro. Questo componente è solo la
 * faccia del motore — non decide niente e non tiene niente.
 *
 * Il tetto di tempo sta nella richiesta, come il seme, e quando scatta il mazzo
 * torna lo stesso, dichiarato troncato.
 *
 * Il **seme** è in vista e si cambia a mano. Non è un vezzo da programmatori:
 * è la cosa che rende ripetibile quel che l'app fa. Stesso tema e stesso seme,
 * stesso mazzo, sempre; cambiando seme si chiede alla ricerca di ripartire da
 * un'altra parte.
 */

import type { Pool } from "../dati/pool.js";
import type { CopieDiCarta } from "../mazzo/base-di-terre.js";
import type { Richiesta } from "../ricerca/costruisci.js";
import { TEMPO_MASSIMO_PREDEFINITO_MS } from "../ricerca/taratura.js";
import type { Motore } from "../ricerca/usa-motore.js";
import { temaDichiarato, type Tema } from "../tema/tema.js";

const NUMERI = new Intl.NumberFormat("it-IT");
const PERCENTO = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 0 });

/** Il seme sta in trentadue bit, come lo vuole `caso.ts`. */
const SEME_MASSIMO = 0xffffffff;

export function Costruzione({
  pool,
  tema,
  seme,
  cambiaSeme,
  motore,
  mettiInMano,
}: {
  pool: Pool;
  tema: Tema;
  seme: number;
  cambiaSeme: (seme: number) => void;
  motore: Motore;
  /** Il mazzo costruito torna in mano all'utente, nella schermata «Mazzo». */
  mettiInMano: (carte: readonly CopieDiCarta[], terre: number) => void;
}) {
  const dichiarato = temaDichiarato(tema);
  const mazzo = motore.frontiera?.mazzi[0] ?? null;

  const costruisci = () => {
    const richiesta: Richiesta = {
      tema,
      seme,
      tempoMassimoMs: TEMPO_MASSIMO_PREDEFINITO_MS,
      formato: "standard",
    };
    // L'impronta del pool è la data dei suoi dati: cambia quando e solo quando
    // cambiano le carte (ticket 05).
    motore.costruisci(pool.carte, pool.generatoIl, richiesta);
  };

  return (
    <section class="costruzione">
      <h2>Il mazzo</h2>

      <div class="comandi-costruzione">
        <button
          type="button"
          class="genera"
          disabled={!dichiarato || motore.allOpera}
          onClick={costruisci}
        >
          {motore.allOpera ? "Sto costruendo…" : "Costruisci il mazzo"}
        </button>
        {motore.allOpera ? (
          <button type="button" class="ferma" onClick={motore.ferma}>
            Ferma
          </button>
        ) : null}
        <label class="campo seme">
          <span class="etichetta-campo">Seme</span>
          <input
            type="number"
            min={0}
            max={SEME_MASSIMO}
            step={1}
            value={seme}
            disabled={motore.allOpera}
            onInput={(evento) => {
              // Il seme che si vede dev'essere **quello che parte**: un numero
              // rifiutato in silenzio lascerebbe scritta una cosa e ne
              // manderebbe un'altra, che è esattamente quel che il seme esiste
              // per impedire. Perciò si porta dentro i limiti invece di
              // ignorarlo, e il campo si riscrive con quello vero.
              const scritto = evento.currentTarget.value.trim();
              if (scritto === "") return;
              const letto = Number(scritto);
              if (!Number.isFinite(letto)) return;
              cambiaSeme(Math.max(0, Math.min(SEME_MASSIMO, Math.floor(letto))));
            }}
          />
        </label>
      </div>

      {!dichiarato ? (
        <p class="nota-filtro">
          Prima dichiara un tema qui sopra: è quello il vincolo dentro cui l&rsquo;app costruisce.
        </p>
      ) : null}

      {motore.allOpera ? (
        <p class="avanzamento" aria-live="polite">
          {motore.avanzamento === null
            ? "Preparo le carte…"
            : `Partenza ${motore.avanzamento.partenza + 1} di ${
                motore.avanzamento.partenze
              }, ${NUMERI.format(motore.avanzamento.valutazioni)} mazzi provati.`}
        </p>
      ) : null}

      {motore.guasto !== null ? (
        <p class="nota-filtro avviso-seme">Il motore si è fermato: {motore.guasto}</p>
      ) : null}

      {motore.frontiera !== null ? (
        <div class="esito-costruzione" data-esito={motore.frontiera.esito}>
          <p class="motivo">{motore.frontiera.motivo}</p>
          {motore.frontiera.troncataPerTempo ? (
            <p class="nota-filtro">
              Il tempo concesso è finito prima che la ricerca si fermasse da sé: questo è il meglio
              che ha trovato, non il meglio che c&rsquo;è.
            </p>
          ) : null}

          {mazzo !== null ? (
            <>
              <ul class="componenti">
                <li>
                  <span>fedeltà al tema</span>
                  <strong>{PERCENTO.format(mazzo.purezza)}</strong>
                </li>
                {Object.values(mazzo.punteggio).map((componente) => (
                  <li key={componente.etichetta}>
                    <span>{componente.etichetta}</span>
                    <strong>{PERCENTO.format(componente.valore)}</strong>
                  </li>
                ))}
              </ul>

              <ul class="lista-costruita">
                {[...mazzo.carte, ...mazzo.terre].map((voce) => (
                  <li key={voce.carta.nome}>
                    <span class="copie">{voce.copie}</span> {voce.carta.nome}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                class="genera"
                onClick={() => mettiInMano(mazzo.carte, mazzo.base.numeroTerre)}
              >
                Mettilo in mano
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
