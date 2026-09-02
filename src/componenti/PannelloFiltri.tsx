/**
 * I filtri del catalogo (storie 7-12).
 *
 * Un pannello solo per il telefono e per lo schermo grande: sul telefono si
 * apre dal basso, dove arriva il pollice; sullo schermo grande sta sempre
 * aperto in colonna, così lo spazio in più diventa filtri e non margine (Q20).
 * La differenza è tutta nel foglio di stile, perché la duplicazione di un
 * pannello di filtri è il modo più sicuro di farne divergere due.
 *
 * Le voci — tipi e sottotipi — arrivano dal pool, mai da un elenco nel codice.
 */

import type { Colore } from "../dati/pool.js";
import { SCALINI_DI_COSTO, COSTO_MASSIMO_SEPARATO, type Filtri } from "../catalogo/filtri.js";
import type { VoceSottotipo, VoceTipo } from "../catalogo/vocabolario.js";

/** Quanti sottotipi si mostrano come bottoni prima di passare all'elenco. */
const SOTTOTIPI_IN_VISTA = 10;

const COLORI: readonly { colore: Colore; nome: string }[] = [
  { colore: "W", nome: "bianco" },
  { colore: "U", nome: "blu" },
  { colore: "B", nome: "nero" },
  { colore: "R", nome: "rosso" },
  { colore: "G", nome: "verde" },
];

type Proprieta = {
  filtri: Filtri;
  cambia: (filtri: Filtri) => void;
  tipi: readonly VoceTipo[];
  sottotipi: readonly VoceSottotipo[];
};

/** Aggiunge o toglie una voce da un filtro a più scelte. */
function commuta<T>(voci: readonly T[], voce: T): T[] {
  return voci.includes(voce) ? voci.filter((v) => v !== voce) : [...voci, voce];
}

export function PannelloFiltri({ filtri, cambia, tipi, sottotipi }: Proprieta) {
  const inVista = sottotipi.slice(0, SOTTOTIPI_IN_VISTA);
  // Un sottotipo scelto dall'elenco lungo resta visibile fra i bottoni, o non
  // si potrebbe più togliere senza ricordarsi come si chiamava.
  const scelti = filtri.sottotipi.filter(
    (s) => !inVista.some((vista) => vista.sottotipo === s),
  );

  return (
    <div class="filtri">
      <section class="gruppo-filtro">
        <h2>Colori</h2>
        <div class="pastiglie-colore">
          {COLORI.map(({ colore, nome }) => (
            <button
              key={colore}
              type="button"
              class="pastiglia-colore"
              data-mana={colore}
              aria-pressed={filtri.colori.includes(colore)}
              aria-label={nome}
              onClick={() => cambia({ ...filtri, colori: commuta(filtri.colori, colore) })}
            >
              {colore}
            </button>
          ))}
        </div>
        <p class="nota-filtro">
          {filtri.colori.length === 0
            ? "Tutti i colori. Scegli quelli del tuo mazzo."
            : "Vedi solo ciò che potresti giocare in questa combinazione, più le carte senza colore."}
        </p>
      </section>

      <section class="gruppo-filtro">
        <h2>Tipo di carta</h2>
        <div class="chips">
          {tipi.map((voce) => (
            <button
              key={voce.tipo}
              type="button"
              class="chip"
              aria-pressed={filtri.tipi.includes(voce.tipo)}
              onClick={() => cambia({ ...filtri, tipi: commuta(filtri.tipi, voce.tipo) })}
            >
              {voce.etichetta} <span class="chip-conto">{voce.quante}</span>
            </button>
          ))}
        </div>
      </section>

      <section class="gruppo-filtro">
        <h2>Sottotipo di creatura</h2>
        <div class="chips">
          {[...inVista, ...scelti.map((sottotipo) => ({ sottotipo, quante: 0 }))].map((voce) => (
            <button
              key={voce.sottotipo}
              type="button"
              class="chip"
              aria-pressed={filtri.sottotipi.includes(voce.sottotipo)}
              onClick={() =>
                cambia({ ...filtri, sottotipi: commuta(filtri.sottotipi, voce.sottotipo) })
              }
            >
              {voce.sottotipo}
              {voce.quante > 0 ? <span class="chip-conto">{voce.quante}</span> : null}
            </button>
          ))}
        </div>
        <label class="campo">
          <span class="etichetta-campo">Un altro sottotipo</span>
          <input
            type="text"
            list="elenco-sottotipi"
            placeholder="Dragon, Elf, Vampire…"
            // Campo non controllato di proposito: il sottotipo scelto diventa
            // un bottone qui sopra e il campo torna vuoto, ma imporgli un
            // valore a ogni ridisegno cancellerebbe quel che si sta scrivendo.
            onChange={(evento) => {
              const campo = evento.currentTarget;
              const scelto = campo.value.trim();
              const esiste = sottotipi.find(
                (voce) => voce.sottotipo.toLowerCase() === scelto.toLowerCase(),
              );
              // Un sottotipo che in Standard non c'è resta scritto: svuotare il
              // campo in silenzio farebbe credere di aver filtrato.
              if (!esiste) return;
              campo.value = "";
              if (!filtri.sottotipi.includes(esiste.sottotipo)) {
                cambia({ ...filtri, sottotipi: [...filtri.sottotipi, esiste.sottotipo] });
              }
            }}
          />
        </label>
        <datalist id="elenco-sottotipi">
          {sottotipi.map((voce) => (
            <option key={voce.sottotipo} value={voce.sottotipo} />
          ))}
        </datalist>
      </section>

      <section class="gruppo-filtro">
        <h2>Costo di mana</h2>
        <div class="chips">
          {SCALINI_DI_COSTO.map((scalino) => (
            <button
              key={scalino}
              type="button"
              class="chip chip-costo"
              aria-pressed={filtri.costi.includes(scalino)}
              onClick={() => cambia({ ...filtri, costi: commuta(filtri.costi, scalino) })}
            >
              {scalino === COSTO_MASSIMO_SEPARATO ? `${scalino}+` : scalino}
            </button>
          ))}
        </div>
      </section>

      <section class="gruppo-filtro">
        <h2>Parola nel testo</h2>
        <label class="campo">
          <span class="etichetta-campo">Cerca fra le regole delle carte</span>
          <input
            type="search"
            placeholder="graveyard, token, sacrifice…"
            value={filtri.testo}
            onInput={(evento) => cambia({ ...filtri, testo: evento.currentTarget.value })}
          />
        </label>
      </section>
    </div>
  );
}
