/**
 * **Gli orologi dell'avversario**: la schermata in cui l'utente scrive i mazzi
 * che incontra davvero.
 *
 * Il patto sta in cima, dove si legge senza scorrere, ed è lo stesso che la
 * schermata della combo mette in cima a sé: *l'avversario qui è una caricatura,
 * e quel che ne esce non è un tasso di vittoria.* ADR-0002 lo impone in ogni
 * posto che mostri un esito di corsa, e questo è il primo di quei posti.
 *
 * Tre numeri per mazzo e nient'altro. Non c'è una casella per le carte
 * dell'avversario, e non ci sarà: l'app non ne conosce nessuna, e la ragione —
 * che un motore di regole non esiste in questo linguaggio e costerebbe anni —
 * sta scritta nell'ADR.
 *
 * Gli orologi si salvano sul dispositivo. Il file del manutentore serve perché
 * la prima schermata non sia vuota, e appena l'utente ne scrive uno suo non si
 * guarda più: il meta del suo negozio non è il meta di internet.
 */

import { useState } from "preact/hooks";

import {
  OROLOGI_MASSIMI,
  TURNO_DI_CHIUSURA_MASSIMO,
  type Orologio,
} from "../avversario/orologio.js";
import { PATTO_DELLA_CORSA } from "../spiegazioni/frasi.js";
import { interoScritto } from "./casella-numerica.js";

/** Un orologio appena aggiunto: numeri plausibili da correggere, non zeri. */
const NUOVO: Orologio = {
  nome: "",
  perche: "",
  turnoDiChiusura: 6,
  rimozioni: 4,
  contromagie: 0,
};

export function Avversario({
  orologi,
  cambiaOrologi,
  ripristina,
}: {
  orologi: readonly Orologio[];
  cambiaOrologi: (orologi: readonly Orologio[]) => void;
  /** Torna al file di partenza, buttando quel che l'utente ha scritto. */
  ripristina: () => void;
}) {
  const [aperto, setAperto] = useState(false);

  const cambia = (indice: number, parti: Partial<Orologio>) => {
    cambiaOrologi(orologi.map((voce, i) => (i === indice ? { ...voce, ...parti } : voce)));
  };

  return (
    <section class="avversario">
      <h2>Chi incontri</h2>

      <p class="patto">{PATTO_DELLA_CORSA}</p>

      {orologi.length === 0 ? (
        <p class="nota-filtro">
          Nessun mazzo dichiarato: la corsa non si corre, e il punteggio resta quello delle cinque
          componenti di sempre. Non è un guasto — è quel che succede finché non dici contro chi
          giochi.
        </p>
      ) : null}

      {aperto ? (
        <>
          <ul class="orologi">
            {orologi.map((orologio, indice) => (
              <li key={indice}>
                <input
                  type="text"
                  class="nome-orologio"
                  value={orologio.nome}
                  placeholder="Come lo chiami"
                  aria-label={`Nome del mazzo ${indice + 1}`}
                  onInput={(evento) => cambia(indice, { nome: evento.currentTarget.value })}
                />
                <div class="numeri-orologio">
                  <Numero
                    etichetta="chiude al turno"
                    valore={orologio.turnoDiChiusura}
                    minimo={1}
                    massimo={TURNO_DI_CHIUSURA_MASSIMO}
                    cambia={(turnoDiChiusura) => cambia(indice, { turnoDiChiusura })}
                  />
                  <Numero
                    etichetta="rimozioni"
                    valore={orologio.rimozioni}
                    minimo={0}
                    massimo={60}
                    cambia={(rimozioni) => cambia(indice, { rimozioni })}
                  />
                  <Numero
                    etichetta="contromagie"
                    valore={orologio.contromagie}
                    minimo={0}
                    massimo={60}
                    cambia={(contromagie) => cambia(indice, { contromagie })}
                  />
                </div>
                <textarea
                  class="perche-orologio"
                  value={orologio.perche}
                  rows={2}
                  placeholder="Perché lo tieni in elenco (per te, fra sei mesi)"
                  aria-label={`Perché del mazzo ${indice + 1}`}
                  onInput={(evento) => cambia(indice, { perche: evento.currentTarget.value })}
                />
                <button
                  type="button"
                  class="togli"
                  onClick={() => cambiaOrologi(orologi.filter((_, i) => i !== indice))}
                >
                  Togli
                </button>
              </li>
            ))}
          </ul>

          <div class="passi-orologi">
            <button
              type="button"
              disabled={orologi.length >= OROLOGI_MASSIMI}
              onClick={() => cambiaOrologi([...orologi, { ...NUOVO }])}
            >
              Aggiungi un mazzo
            </button>
            {/* Buttare tutto è una risposta: «non voglio correre contro
                nessuno». Si salva come tale, e alla riapertura resta vuoto
                invece di ripopolarsi col file del manutentore. */}
            <button type="button" onClick={() => cambiaOrologi([])}>
              Non correre contro nessuno
            </button>
            <button type="button" onClick={ripristina}>
              Rimetti i mazzi di partenza
            </button>
          </div>

          {orologi.length >= OROLOGI_MASSIMI ? (
            <p class="nota-filtro">
              {OROLOGI_MASSIMI} è il massimo, e non è una regola del gioco: oltre una manciata
              nessuno li tiene aggiornati, e un elenco che invecchia dice il falso con più sicurezza
              di uno corto.
            </p>
          ) : null}
        </>
      ) : (
        <ul class="orologi-riassunto">
          {orologi.map((orologio) => (
            <li key={orologio.nome}>
              <strong>{orologio.nome}</strong> · chiude al turno {orologio.turnoDiChiusura},{" "}
              {orologio.rimozioni} rimozioni, {orologio.contromagie} contromagie
            </li>
          ))}
        </ul>
      )}

      <button type="button" class="apri-orologi" onClick={() => setAperto(!aperto)}>
        {aperto ? "Chiudi" : "Scrivi i mazzi che incontri"}
      </button>
    </section>
  );
}

/**
 * Una casella per un numero intero, che rifiuta quel che numero non è.
 *
 * Un campo vuoto non diventa zero: zero rimozioni è un'affermazione, e
 * prendersela da una casella che l'utente sta ancora svuotando vorrebbe dire
 * mettergli in bocca una cosa che non ha detto. Finché non c'è un numero, resta
 * l'ultimo valido.
 *
 * La promessa la mantiene `interoScritto`, che guarda il testo prima del
 * numero: scritta qui dentro con `Number(...)` diceva il contrario di quel che
 * prometteva per tutte le caselle con `minimo` zero (ticket 36).
 */
function Numero({
  etichetta,
  valore,
  minimo,
  massimo,
  cambia,
}: {
  etichetta: string;
  valore: number;
  minimo: number;
  massimo: number;
  cambia: (valore: number) => void;
}) {
  return (
    <label>
      <span>{etichetta}</span>
      <input
        type="number"
        value={valore}
        min={minimo}
        max={massimo}
        step={1}
        onInput={(evento) => {
          const letto = interoScritto(evento.currentTarget.value, { minimo, massimo });
          if (letto === undefined) return;
          cambia(letto);
        }}
        onBlur={(evento) => {
          // Quel che si vede e quel che vale devono essere lo stesso numero.
          // Rifiutare in silenzio non basta: senza `cambia` non c'è nessun
          // ridisegno, e la casella resterebbe a mostrare il «70» battuto in un
          // campo che arriva a 60 mentre la corsa si corre sul 7. È la stessa
          // cura che `TettoDiSpesa` mette sul suo campo, per la stessa ragione.
          const campo = evento.currentTarget;
          if (campo.value !== String(valore)) campo.value = String(valore);
        }}
      />
    </label>
  );
}
