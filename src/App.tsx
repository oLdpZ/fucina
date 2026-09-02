import { useEffect, useState } from "preact/hooks";

import { Catalogo } from "./componenti/Catalogo.js";
import { NoteLegali } from "./componenti/NoteLegali.js";
import { caricaPool, dataInItaliano } from "./dati/carica-pool.js";
import type { Pool } from "./dati/pool.js";
import { AMBITO_APP, NOME_APP, NOME_APP_DA_DECIDERE } from "./identita.js";

/**
 * La schermata dell'app: il catalogo delle carte legali in Standard cartaceo
 * (ticket 04).
 *
 * Il pool sta nel pacchetto e il service worker lo tiene in cache, quindi
 * questa schermata si apre anche senza rete (storia 15); solo le immagini
 * arrivano da Scryfall, e mancano finché non si è viste almeno una volta.
 *
 * In fondo, sempre, la data dei dati che si stanno guardando (storia 17):
 * presa dal pool e mai dall'orologio, perché è dei dati che parla.
 */
export function App() {
  const [pool, setPool] = useState<Pool | null>(null);
  const [guasto, setGuasto] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    caricaPool().then(
      (letto) => {
        if (vivo) setPool(letto);
      },
      (errore: unknown) => {
        if (vivo) setGuasto(errore instanceof Error ? errore.message : String(errore));
      },
    );
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div class="guscio">
      <header class="testata">
        <span class="marchio">{NOME_APP}</span>
        <span class="ambito">{AMBITO_APP}</span>
      </header>

      <main class="principale">
        {guasto !== null ? (
          <section class="avviso">
            <p>
              <strong>Le carte non si caricano.</strong> {guasto} Prova a chiudere e riaprire
              l&rsquo;app: se il guasto resta, va rifatta l&rsquo;installazione.
            </p>
          </section>
        ) : pool === null ? (
          <p class="attesa">Carico le carte…</p>
        ) : (
          <Catalogo pool={pool} />
        )}
      </main>

      <footer class="piede">
        {pool !== null ? (
          <p class="data-dati">
            Carte e prezzi del {dataInItaliano(pool.generatoIl)}.
            {NOME_APP_DA_DECIDERE
              ? " Il nome dell’app e il suo aspetto non sono ancora stati scelti."
              : ""}
          </p>
        ) : null}
        <NoteLegali />
      </footer>
    </div>
  );
}
