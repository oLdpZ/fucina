/**
 * Il catalogo: la prima cosa che l'app sa fare (ticket 04).
 *
 * Risponde alla prima delle tre domande del destinatario — quali carte esistono
 * dentro la mia idea. Si cerca per nome, si filtra, e **il numero di carte che
 * restano è sempre in vista** (storia 13): è il numero che dice se un'idea è
 * ampia o strettissima, ed è lo stesso che il motore userà per avvisare che un
 * tema è troppo stretto.
 *
 * Sul telefono i filtri stanno in un pannello che si apre dal basso, dove
 * arriva il pollice; sullo schermo grande sono una colonna sempre aperta.
 */

import { useEffect, useMemo, useState } from "preact/hooks";

import { codaDelConteggio } from "../catalogo/conteggio.js";
import { FILTRI_VUOTI, cerca, contaFiltriAttivi, type Filtri } from "../catalogo/filtri.js";
import { sottotipiDiCreatura, tipiPresenti } from "../catalogo/vocabolario.js";
import type { IdentitaDiFormato } from "../dati/ambito.js";
import type { Carta, Pool } from "../dati/pool.js";
import { GrigliaCarte } from "./GrigliaCarte.js";
import { PannelloFiltri } from "./PannelloFiltri.js";
import { SchedaCarta } from "./SchedaCarta.js";

const NUMERI = new Intl.NumberFormat("it-IT");

export function Catalogo({
  pool,
  formato,
  filtri,
  cambiaFiltri,
  copiePerNome,
  cambiaCopie,
}: {
  pool: Pool;
  /**
   * Il formato che si sta giocando, per il nome che il conteggio pronuncia.
   * Arriva dal documento di formato: qui dentro non c'è nessun nome di gioco.
   */
  formato: IdentitaDiFormato;
  /** I filtri stanno fuori: passando al mazzo e tornando, non si perdono. */
  filtri: Filtri;
  cambiaFiltri: (filtri: Filtri) => void;
  copiePerNome: ReadonlyMap<string, number>;
  cambiaCopie: (carta: Carta, delta: number) => void;
}) {
  const [filtriAperti, setFiltriAperti] = useState(false);
  const [aperta, setAperta] = useState<Carta | null>(null);

  const tipi = useMemo(() => tipiPresenti(pool.carte), [pool]);
  const sottotipi = useMemo(() => sottotipiDiCreatura(pool.carte), [pool]);
  // Il conteggio non ha un calcolo suo: è la lunghezza di questa lista, e non
  // può quindi dire un numero diverso da quello che si vede.
  const risultati = useMemo(() => cerca(pool.carte, filtri), [pool, filtri]);
  const attivi = contaFiltriAttivi(filtri);

  // Il pannello che si apre dal basso esiste solo sul telefono: allargando la
  // finestra i suoi bottoni di chiusura spariscono col foglio di stile, e
  // resterebbe aperto per sempre — con la pagina bloccata e nessun modo di
  // sbloccarla. La stessa misura del foglio di stile, in un punto solo.
  useEffect(() => {
    const schermoGrande = window.matchMedia("(min-width: 48rem)");
    const guarda = () => {
      if (schermoGrande.matches) setFiltriAperti(false);
    };
    guarda();
    schermoGrande.addEventListener("change", guarda);
    return () => schermoGrande.removeEventListener("change", guarda);
  }, []);

  // Col pannello o la scheda aperti la pagina dietro non deve scorrere: sul
  // telefono, se scorre, si perde il posto in cui si era.
  const bloccata = filtriAperti || aperta !== null;
  useEffect(() => {
    if (!bloccata) return;
    const prima = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prima;
    };
  }, [bloccata]);

  return (
    <div class="catalogo">
      <div class="colonna-filtri" data-aperto={filtriAperti}>
        <div class="filtri-testata">
          <h2 class="conteggio-filtri">Filtri</h2>
          <div class="azioni-filtri">
            {attivi > 0 ? (
              <button type="button" class="azzera" onClick={() => cambiaFiltri(FILTRI_VUOTI)}>
                Azzera ({attivi})
              </button>
            ) : null}
            <button
              type="button"
              class="chiudi solo-telefono"
              onClick={() => setFiltriAperti(false)}
              aria-label="Chiudi i filtri"
            >
              ✕
            </button>
          </div>
        </div>

        <PannelloFiltri
          filtri={filtri}
          cambia={cambiaFiltri}
          tipi={tipi}
          sottotipi={sottotipi}
        />

        <button
          type="button"
          class="vedi-carte solo-telefono"
          onClick={() => setFiltriAperti(false)}
        >
          Vedi {NUMERI.format(risultati.length)}{" "}
          {risultati.length === 1 ? "carta" : "carte"}
        </button>
      </div>

      <div class="colonna-risultati">
        <div class="barra-ricerca">
          <label class="campo campo-nome">
            <span class="etichetta-campo">Cerca una carta per nome</span>
            <input
              type="search"
              inputMode="search"
              autocomplete="off"
              spellcheck={false}
              // Nessun nome di carta come esempio, che ADR-0004 non permette.
              // Il segnaposto dice invece le due cose che nessuno immagina di
              // poter fare: scrivere in italiano, e scrivere sbagliato. Sta in
              // una riga sola perché su un telefono un segnaposto lungo si
              // taglia, e la metà che si taglia è sempre l'ultima.
              placeholder="Il nome, anche in italiano, anche sbagliato"
              value={filtri.nome}
              onInput={(evento) => cambiaFiltri({ ...filtri, nome: evento.currentTarget.value })}
            />
          </label>
          <p class="conteggio" aria-live="polite">
            <strong>{NUMERI.format(risultati.length)}</strong>{" "}
            {risultati.length === 1 ? "carta" : "carte"} {codaDelConteggio(attivi, formato.nome)}
          </p>
        </div>

        <GrigliaCarte
          carte={risultati}
          apri={setAperta}
          copiePerNome={copiePerNome}
          cambiaCopie={cambiaCopie}
        />
      </div>

      {filtriAperti ? (
        <div class="velo-filtri solo-telefono" onClick={() => setFiltriAperti(false)} />
      ) : null}

      <div class="barra-inferiore solo-telefono">
        <span class="conteggio-basso">
          <strong>{NUMERI.format(risultati.length)}</strong>{" "}
          {risultati.length === 1 ? "carta" : "carte"}
        </span>
        <button type="button" class="apri-filtri" onClick={() => setFiltriAperti(true)}>
          Filtri{attivi > 0 ? ` · ${attivi}` : ""}
        </button>
      </div>

      {aperta ? (
        <SchedaCarta
          carta={aperta}
          chiudi={() => setAperta(null)}
          copie={copiePerNome.get(aperta.nome) ?? 0}
          cambiaCopie={cambiaCopie}
        />
      ) : null}
    </div>
  );
}
