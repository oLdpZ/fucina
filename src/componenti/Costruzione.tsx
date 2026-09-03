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
 *
 * ## La frontiera (ticket 12)
 *
 * Quel che torna non è un mazzo ma **quattro o cinque**, allineati dal più
 * fedele al tema al più forte, e sono affiancati apposta: il fulcro del
 * progetto non è la lista, è il **tasso di cambio** fra originalità e potenza.
 * Ogni mazzo porta scritto quanto tema ha ceduto e quanta potenza ha guadagnato
 * rispetto a quello prima di lui — numeri che la ricerca ha già calcolato
 * (`MazzoCostruito.passo`), non differenze rifatte qui.
 *
 * Dove fermarsi lo sceglie l'utente, ed è il senso di tutto: il primo mazzo è
 * selezionato perché è quello che ha chiesto, non perché sia il consigliato.
 *
 * ## Le spiegazioni (ticket 13)
 *
 * Ogni carta del mazzo si apre e dice perché è lì e perché in tante copie; sotto
 * le terre c'è come sono state scelte; e chiude l'elenco delle carte del tema
 * rimaste fuori, col motivo. Le frasi non si scrivono qui: arrivano già fatte da
 * `spiegazioni/spiegazioni.ts`, che le riempie di numeri già calcolati.
 *
 * Le carte si aprono una per volta e non stanno aperte tutte: chi vuole la
 * lista la legge come una lista, e chi vuole capire tocca la carta. È l'unico
 * modo di dare una spiegazione lunga a ogni carta senza che la lista smetta di
 * essere leggibile.
 */

import { useEffect, useMemo, useState } from "preact/hooks";

import type { Pool } from "../dati/pool.js";
import type { CopieDiCarta } from "../mazzo/base-di-terre.js";
import type { Richiesta } from "../ricerca/costruisci.js";
import { TEMPO_MASSIMO_PREDEFINITO_MS } from "../ricerca/taratura.js";
import type { Motore } from "../ricerca/usa-motore.js";
import { spiegaFrontiera } from "../spiegazioni/spiegazioni.js";
import { temaDichiarato, type Tema } from "../tema/tema.js";

const NUMERI = new Intl.NumberFormat("it-IT");
const PERCENTO = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 0 });
/**
 * La differenza fra un mazzo e il precedente: le stesse due percentuali di
 * sopra, sottratte, **col segno sempre in vista**. «−8% di tema, +2% di
 * potenza» dice il baratto in due numeri, e il segno è metà di quel che dice.
 */
const PUNTI = new Intl.NumberFormat("it-IT", {
  // Un decimale, e non zero: i guadagni di potenza veri stanno intorno all'uno
  // per cento, e arrotondarli all'intero scriverebbe «+0% di potenza» proprio
  // sul numero per cui questa schermata esiste.
  maximumFractionDigits: 1,
  style: "percent",
  signDisplay: "always",
});

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
  const mazzi = motore.frontiera?.mazzi ?? [];
  // Quale mazzo della frontiera si sta guardando. Zero è il più fedele al tema:
  // si parte da lì perché è quello che l'utente ha chiesto, e scendere lungo la
  // frontiera è una scelta che fa lui, non un consiglio che gli si dà.
  const [scelto, scegli] = useState(0);
  // Una frontiera nuova riporta la scelta sul primo: lasciare il dito dov'era
  // mostrerebbe, dopo una ricerca diversa, il mazzo di una posizione che in
  // quella nuova frontiera vuol dire un'altra cosa.
  useEffect(() => scegli(0), [motore.frontiera]);
  const mazzo = mazzi[Math.min(scelto, mazzi.length - 1)] ?? null;

  // Le spiegazioni si rifanno solo quando cambia la frontiera, il tema o il
  // pool: sono un passaggio sul pool per mazzo, e rifarle a ogni battito di
  // cursore sul seme non servirebbe a niente.
  const spiegazioni = useMemo(
    () =>
      motore.frontiera === null ? [] : spiegaFrontiera(motore.frontiera, tema, pool.carte),
    [motore.frontiera, tema, pool.carte],
  );
  const spiegato = spiegazioni[Math.min(scelto, spiegazioni.length - 1)] ?? null;

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
            : `Mazzo ${motore.avanzamento.passo + 1} di ${motore.avanzamento.passi}, partenza ${
                motore.avanzamento.partenza + 1
              } di ${motore.avanzamento.partenze}, ${NUMERI.format(
                motore.avanzamento.valutazioni,
              )} ${motore.avanzamento.valutazioni === 1 ? "mazzo provato" : "mazzi provati"}.`}
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

          {mazzi.length > 0 ? (
            <>
              {mazzi.length > 1 ? (
                <p class="nota-frontiera">
                  {mazzi.length} mazzi, dal più fedele al tema al più forte. Ogni passo dice quanto
                  tema costa e quanta potenza rende: dove fermarsi lo scegli tu.
                </p>
              ) : motore.frontiera.troncataPerTempo ? (
                <p class="nota-frontiera">
                  Un mazzo solo: il tempo è finito prima che l&rsquo;app potesse cercare gli altri.
                  Non vuol dire che un baratto non ci sia — vuol dire che non è stato cercato.
                </p>
              ) : (
                <p class="nota-frontiera">
                  Un mazzo solo: cedendo tema, qui, non si guadagna potenza da nessuna parte.
                </p>
              )}
              <ol class="frontiera">
                {mazzi.map((voce, indice) => (
                  <li key={voce.peso}>
                    <button
                      type="button"
                      aria-pressed={indice === scelto}
                      class="passo-frontiera"
                      data-scelto={indice === scelto ? "" : undefined}
                      onClick={() => scegli(indice)}
                    >
                      <span class="posizione">
                        {indice === 0
                          ? "il più fedele"
                          : indice === mazzi.length - 1
                            ? "il più forte"
                            : `${indice + 1}º`}
                      </span>
                      <span class="numeri">
                        <span class="etichetta-numero">tema</span>
                        <strong>{PERCENTO.format(voce.purezza)}</strong>
                        <span class="etichetta-numero">potenza</span>
                        <strong>{PERCENTO.format(voce.potenza)}</strong>
                      </span>
                      <span class="passo">
                        {voce.passo === null
                          ? "il mazzo più puro che il tema permetta"
                          : `${PUNTI.format(-voce.passo.purezzaCeduta)} di tema, ${PUNTI.format(
                              voce.passo.potenzaGuadagnata,
                            )} di potenza`}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </>
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

              {spiegato !== null && spiegato.passo !== null ? (
                <p class="spiegazione spiegazione-passo">{spiegato.passo.frase}</p>
              ) : null}

              <h3>Le carte</h3>
              <ol class="lista-spiegata">
                {mazzo.carte.map((voce, indice) => {
                  const detta = spiegato?.carte[indice] ?? null;
                  return (
                    <li key={voce.carta.nome}>
                      <details>
                        <summary>
                          <span class="copie">{voce.copie}</span> {voce.carta.nome}
                        </summary>
                        {detta === null ? null : (
                          <>
                            <p class="spiegazione">{detta.perche.frase}</p>
                            <p class="spiegazione">{detta.quante.frase}</p>
                          </>
                        )}
                      </details>
                    </li>
                  );
                })}
              </ol>

              <h3>Le terre</h3>
              <ul class="lista-costruita">
                {mazzo.terre.map((voce) => (
                  <li key={voce.carta.nome}>
                    <span class="copie">{voce.copie}</span> {voce.carta.nome}
                  </li>
                ))}
              </ul>
              {spiegato === null ? null : (
                <p class="spiegazione">{spiegato.terre.frase}</p>
              )}

              {spiegato !== null && spiegato.esclusioni.length > 0 ? (
                <>
                  <h3>Rimaste fuori</h3>
                  <ul class="rimaste-fuori">
                    {spiegato.esclusioni.map((esclusione) => (
                      <li key={esclusione.grezzi.nome} class="spiegazione">
                        {esclusione.frase}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

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
