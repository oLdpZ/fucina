/**
 * La carta aperta: immagine grande e testo completo (storia 6, ticket 04).
 *
 * L'immagine grande è la ragione della schermata — un giocatore poco esperto
 * riconosce la carta dall'illustrazione prima che dal nome. Ma il testo c'è
 * comunque, sotto, in caratteri leggibili: l'immagine può non arrivare (nessuna
 * rete, mai vista prima) e senza il testo la carta resterebbe un rettangolo
 * vuoto.
 *
 * Il prezzo si mostra con la sua data, perché i prezzi Cardmarket sono di ieri
 * (`PROGETTO.md` §3) e mostrarli nudi sarebbe una mezza bugia. Ancora non
 * vincolano niente: il tetto di spesa è tappa 3.
 */

import { useEffect, useRef, useState } from "preact/hooks";

import { dataInItaliano } from "../dati/carica-pool.js";
import type { Carta, Faccia } from "../dati/pool.js";
import { tipoPrincipale } from "../catalogo/vocabolario.js";
import { CostoDiMana } from "./CostoDiMana.js";

/** I prezzi hanno la virgola e il simbolo, come sullo scontrino del negozio. */
const EURO = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function SchedaCarta({ carta, chiudi }: { carta: Carta; chiudi: () => void }) {
  const [immagineRotta, setImmagineRotta] = useState(false);
  const scheda = useRef<HTMLDivElement | null>(null);

  /**
   * La tastiera entra nella scheda, ci resta finché è aperta, e torna dove era
   * quando si chiude.
   *
   * Senza questo, chi apre una carta col tasto invio resta col fuoco sulla
   * cella dietro il velo: tabulando gira per la griglia e per i filtri che non
   * vede più, e la ✕ arriva per ultima. Il tasto di fuga chiude comunque — è
   * il gesto che tutti provano per primo — ma non basta da solo.
   */
  useEffect(() => {
    const primaEra = document.activeElement as HTMLElement | null;
    const dentro = () =>
      [...(scheda.current?.querySelectorAll<HTMLElement>("button, a[href], img[tabindex]") ?? [])];
    dentro()[0]?.focus();

    const allaTastiera = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        chiudi();
        return;
      }
      if (evento.key !== "Tab") return;
      const fermabili = dentro();
      const primo = fermabili[0];
      const ultimo = fermabili[fermabili.length - 1];
      if (!primo || !ultimo) return;
      if (evento.shiftKey && document.activeElement === primo) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primo.focus();
      }
    };

    document.addEventListener("keydown", allaTastiera);
    return () => {
      document.removeEventListener("keydown", allaTastiera);
      primaEra?.focus();
    };
  }, [chiudi]);

  const indirizzo = carta.immagine?.normale;

  return (
    <div class="velo" onClick={chiudi}>
      <div
        class="scheda"
        ref={scheda}
        role="dialog"
        aria-modal="true"
        aria-label={carta.nome}
        onClick={(evento) => evento.stopPropagation()}
      >
        <div class="scheda-testata">
          <div>
            <h2>{carta.nome}</h2>
            <p class="riga-dati">
              {tipoPrincipale(carta.tipi)}
              {carta.sottotipi.length > 0 ? ` · ${carta.sottotipi.join(" ")}` : ""}
            </p>
          </div>
          <button type="button" class="chiudi" onClick={chiudi} aria-label="Chiudi">
            ✕
          </button>
        </div>

        <div class="scheda-corpo">
          {indirizzo && !immagineRotta ? (
            <img
              class="ritratto-grande"
              src={indirizzo}
              alt={carta.nome}
              width={488}
              height={680}
              decoding="async"
              onError={() => setImmagineRotta(true)}
            />
          ) : null}

          <div class="scheda-testo">
            {carta.facce ? (
              carta.facce.map((faccia) => <FacciaDellaCarta key={faccia.nome} faccia={faccia} />)
            ) : (
              <>
                <p class="scheda-costo">
                  <CostoDiMana costo={carta.costoDiMana} />
                </p>
                <TestoDelleRegole testo={carta.testo} />
                {carta.forza !== null && carta.costituzione !== null ? (
                  <p class="forza">
                    {carta.forza}/{carta.costituzione}
                  </p>
                ) : null}
              </>
            )}

            {carta.tag.length > 0 ? (
              <ul class="tag">
                {carta.tag.map((tag) => (
                  <li key={tag}>{tag.replace(/-/g, " ")}</li>
                ))}
              </ul>
            ) : null}

            <p class="prezzo">
              {carta.prezzo.euro === null
                ? "Prezzo non disponibile"
                : `${EURO.format(carta.prezzo.euro)} · prezzo Cardmarket del ${dataInItaliano(
                    carta.prezzo.aggiornatoIl,
                  )}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FacciaDellaCarta({ faccia }: { faccia: Faccia }) {
  return (
    <div class="faccia">
      <h3>{faccia.nome}</h3>
      <p class="scheda-costo">
        <CostoDiMana costo={faccia.costoDiMana} />
      </p>
      <p class="riga-dati">{faccia.lineaDiTipo}</p>
      <TestoDelleRegole testo={faccia.testo} />
      {faccia.forza !== null && faccia.costituzione !== null ? (
        <p class="forza">
          {faccia.forza}/{faccia.costituzione}
        </p>
      ) : null}
    </div>
  );
}

/** Il testo delle regole va a capo dove va a capo sulla carta. */
function TestoDelleRegole({ testo }: { testo: string }) {
  return (
    <>
      {testo
        .split("\n")
        .filter((riga) => riga.trim() !== "")
        .map((riga, indice) => (
          <p key={indice} class="regola">
            {riga}
          </p>
        ))}
    </>
  );
}
