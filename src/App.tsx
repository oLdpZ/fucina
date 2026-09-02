import { useEffect, useRef, useState } from "preact/hooks";

import { Catalogo } from "./componenti/Catalogo.js";
import { NoteLegali } from "./componenti/NoteLegali.js";
import { aggiornaInSottofondo, poolDaAprire } from "./dati/aggiornamento.js";
import { dataInItaliano } from "./dati/carica-pool.js";
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
 *
 * L'apertura non aspetta mai la rete (ticket 05): si parte dai dati che ci sono
 * già — quelli inclusi, o quelli più freschi scaricati una volta passata. Solo
 * dopo, in sottofondo, si guarda se ne esistano di più recenti; se arrivano, la
 * data in fondo cambia e il catalogo si ritrova le carte nuove sotto le mani.
 * Se non arrivano, non succede niente e nessuno se ne accorge.
 */
export function App() {
  const [pool, setPool] = useState<Pool | null>(null);
  const [guasto, setGuasto] = useState<string | null>(null);

  /** Il controllo di freschezza si fa una volta per apertura, non a ogni pool. */
  const giaControllato = useRef(false);

  useEffect(() => {
    let vivo = true;
    poolDaAprire().then(
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

  useEffect(() => {
    if (pool === null || giaControllato.current) return undefined;
    giaControllato.current = true;

    let vivo = true;
    void aggiornaInSottofondo(pool).then((esito) => {
      // Solo i dati più freschi cambiano qualcosa. Rete assente, risposta rotta,
      // niente di nuovo da mesi: in tutti questi casi si resta come si era, e
      // all'utente non si dice niente perché non c'è niente da dirgli.
      if (vivo && esito.tipo === "preso") setPool(esito.pool);
    })
      // Il controllo non fallisce mai rumorosamente, e se un giorno lo facesse
      // non sarebbe comunque una ragione per rovinare la schermata a chi legge.
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [pool]);

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
