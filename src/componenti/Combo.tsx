/**
 * **La combo dichiarata** (ticket 05 della tappa 3): la schermata in cui
 * l'utente nomina le carte che secondo lui vincono se stanno insieme.
 *
 * Qui l'app dice a parole quel che fa, e il patto è scritto in cima dove si
 * legge senza scorrere: *non giudico se questa combo vinca — l'hai detto tu; ti
 * dico che probabilità hai di averla in mano al turno che guardo.* Non è una
 * cortesia: è la sola cosa che rende onesto il numero che si legge dopo.
 *
 * Le carte si scelgono **per nome**, con lo stesso strumento della carta-seme
 * del tema, e per la stessa ragione: i pool si aggiornano, gli oggetti no. Un
 * pezzo che il pool di oggi non ha più, uno che il tema esclude, una terra: si
 * dicono tutti e tre, uno per uno, invece di sparire in silenzio.
 *
 * Le frasi non si scrivono qui — arrivano da `spiegazioni/frasi.ts`, dove
 * stanno tutte insieme.
 */

import { useMemo, useState } from "preact/hooks";

import { cercaPerNome } from "../catalogo/ricerca.js";
import {
  comboDichiarata,
  risolviCombo,
  type Combo as CombiDichiarate,
} from "../combo/combo.js";
import { CARTE_MASSIME_DELLA_COMBO, TURNO_DELLA_COMBO } from "../combo/taratura.js";
import type { Carta, Pool } from "../dati/pool.js";
import { COPIE_MASSIME } from "../mazzo/taratura.js";
import { frasePerIlGuaioDellaCombo } from "../spiegazioni/frasi.js";
import type { Tema } from "../tema/tema.js";

/** Quante carte si propongono mentre si scrive: come per la carta-seme. */
const CARTE_PROPOSTE = 6;

export function Combo({
  pool,
  tema,
  combo,
  cambiaCombo,
}: {
  pool: Pool;
  /** Il tema serve alle esclusioni: vincono anche su una carta nominata. */
  tema: Tema;
  combo: CombiDichiarate;
  cambiaCombo: (combo: CombiDichiarate) => void;
}) {
  const [domanda, setDomanda] = useState("");

  const risolta = useMemo(
    () => risolviCombo(combo, pool.carte, tema),
    [combo, pool.carte, tema],
  );

  const piena = combo.length >= CARTE_MASSIME_DELLA_COMBO;
  const proposte = useMemo(
    () =>
      domanda.trim() === "" || piena
        ? []
        : cercaPerNome(pool.carte, domanda)
            .filter((carta) => !combo.includes(carta.nome))
            .slice(0, CARTE_PROPOSTE),
    [pool.carte, domanda, combo, piena],
  );

  const aggiungi = (carta: Carta) => {
    if (combo.includes(carta.nome) || piena) return;
    cambiaCombo([...combo, carta.nome]);
    setDomanda("");
  };

  return (
    <section class="combo-dichiarata">
      <h2>La combo, se ce l&rsquo;hai</h2>

      {/*
        Il patto. Sta qui sopra tutto il resto perché è la cosa che l'utente
        deve leggere **prima** di dare un numero per un giudizio.
      */}
      <p class="patto">
        Non giudico se le carte che nomini vincano la partita insieme: quello lo dici tu, e ti
        credo. Ti dico che probabilità hai di averle in mano <strong>tutte</strong> entro il turno{" "}
        {TURNO_DELLA_COMBO}, e le metto nel mazzo in {COPIE_MASSIME} copie ciascuna senza mai
        scambiarle via.
      </p>

      {comboDichiarata(combo) ? (
        <ul class="pezzi-combo">
          {combo.map((nome) => (
            <li key={nome} class="seme-scelto">
              <span class="nome-seme">{nome}</span>
              <button
                type="button"
                class="azzera"
                onClick={() => cambiaCombo(combo.filter((altro) => altro !== nome))}
              >
                Togli
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {risolta.guai.map((guaio) => (
        <p key={guaio.nome} class="nota-filtro avviso-seme">
          {frasePerIlGuaioDellaCombo(guaio)}
        </p>
      ))}

      {piena ? (
        <p class="nota-filtro">
          {CARTE_MASSIME_DELLA_COMBO} carte sono il massimo: oltre, la probabilità di averle tutte
          entro un turno scende a numeri che non dicono più niente.
        </p>
      ) : (
        <label class="campo">
          <span class="etichetta-campo">Cerca una carta per nome</span>
          <input
            type="search"
            autocomplete="off"
            spellcheck={false}
            placeholder="Scrivi il nome, anche sbagliato"
            value={domanda}
            onInput={(evento) => setDomanda(evento.currentTarget.value)}
          />
        </label>
      )}

      {proposte.length > 0 ? (
        <ul class="proposte-seme">
          {proposte.map((carta) => (
            <li key={carta.id}>
              <button type="button" class="chip" onClick={() => aggiungi(carta)}>
                {carta.nome}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
