/**
 * La griglia dei risultati, con l'immagine di ogni carta (storia 6).
 *
 * Due cose la governano:
 *
 * 1. **Si mostra un pezzo per volta.** I filtri larghi lasciano migliaia di
 *    carte, e migliaia di immagini nella pagina bloccherebbero il telefono. Se
 *    ne disegna un blocco e se ne aggiunge un altro quando si arriva in fondo.
 * 2. **Le immagini non sono nel pacchetto.** Vengono da Scryfall quando c'è
 *    rete, e il service worker le tiene una volta viste. Senza rete e senza
 *    cache al posto dell'immagine resta il nome della carta, che è quanto
 *    basta per riconoscerla: l'app al negozio non si ferma per un'immagine.
 */

import { useEffect, useRef, useState } from "preact/hooks";

import type { Carta } from "../dati/pool.js";
import { tipoPrincipale } from "../catalogo/vocabolario.js";
import { CostoDiMana } from "./CostoDiMana.js";
import { PassiDelleCopie } from "./PassiDelleCopie.js";

/** Quante carte per volta. Un blocco riempie più di uno schermo di telefono. */
const BLOCCO = 60;

export function GrigliaCarte({
  carte,
  apri,
  copiePerNome,
  cambiaCopie,
}: {
  carte: readonly Carta[];
  apri: (carta: Carta) => void;
  copiePerNome: ReadonlyMap<string, number>;
  cambiaCopie: (carta: Carta, delta: number) => void;
}) {
  const [quante, setQuante] = useState(BLOCCO);
  const sentinella = useRef<HTMLDivElement | null>(null);
  const cima = useRef<HTMLUListElement | null>(null);

  // Filtri nuovi, lista nuova: si riparte dal primo blocco e dall'inizio della
  // griglia. Senza il secondo pezzo, chi ha scorso fino alla carta cinquecento
  // e poi tocca un filtro si ritrova in fondo ai nuovi risultati invece che
  // davanti ai primi.
  useEffect(() => {
    setQuante(BLOCCO);
    const nodo = cima.current;
    if (nodo && nodo.getBoundingClientRect().top < 0) {
      nodo.scrollIntoView({ block: "start" });
    }
  }, [carte]);

  useEffect(() => {
    const nodo = sentinella.current;
    if (!nodo || quante >= carte.length) return;
    const osservatore = new IntersectionObserver(
      (voci) => {
        if (voci.some((voce) => voce.isIntersecting)) {
          setQuante((finora) => Math.min(finora + BLOCCO, carte.length));
        }
      },
      // Si carica il blocco successivo prima di arrivare in fondo: chi scorre
      // veloce non deve vedere il vuoto.
      { rootMargin: "600px" },
    );
    osservatore.observe(nodo);
    return () => osservatore.disconnect();
  }, [carte, quante]);

  if (carte.length === 0) {
    return (
      <p class="niente-trovato">
        Nessuna carta soddisfa questi filtri. Togline uno e guarda come cambia il numero.
      </p>
    );
  }

  return (
    <>
      <ul class="griglia" ref={cima}>
        {carte.slice(0, quante).map((carta) => (
          <li key={carta.id}>
            <CartaInGriglia carta={carta} apri={apri} />
            <PassiDelleCopie
              carta={carta}
              copie={copiePerNome.get(carta.nome) ?? 0}
              cambiaCopie={cambiaCopie}
            />
          </li>
        ))}
      </ul>
      {quante < carte.length ? (
        <div ref={sentinella} class="ancora">
          Altre {carte.length - quante} carte…
        </div>
      ) : null}
    </>
  );
}

function CartaInGriglia({ carta, apri }: { carta: Carta; apri: (carta: Carta) => void }) {
  const [immagineRotta, setImmagineRotta] = useState(false);
  const indirizzo = carta.immagine?.piccola;

  return (
    <button type="button" class="cella" onClick={() => apri(carta)}>
      <span class="ritratto">
        {indirizzo && !immagineRotta ? (
          <img
            src={indirizzo}
            alt={carta.nome}
            loading="lazy"
            decoding="async"
            width={146}
            height={204}
            onError={() => setImmagineRotta(true)}
          />
        ) : (
          <span class="ritratto-assente">
            <span class="nome-di-riserva">{carta.nome}</span>
            <CostoDiMana costo={carta.costoDiMana} />
          </span>
        )}
      </span>
      <span class="didascalia">
        <span class="nome-carta">{carta.nome}</span>
        <span class="riga-dati">
          {tipoPrincipale(carta.tipi)}
          {carta.tipi.includes("Land") ? "" : ` · ${carta.valoreDiMana}`}
        </span>
      </span>
    </button>
  );
}
