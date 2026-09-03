import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { Catalogo } from "./componenti/Catalogo.js";
import { Mazzo } from "./componenti/Mazzo.js";
import { MazziSalvati, type MazzoAperto } from "./componenti/MazziSalvati.js";
import { NoteLegali } from "./componenti/NoteLegali.js";
import { SchedaCarta } from "./componenti/SchedaCarta.js";
import { aggiornaInSottofondo, poolDaAprire } from "./dati/aggiornamento.js";
import { dataInItaliano } from "./dati/carica-pool.js";
import type { Carta, Pool } from "./dati/pool.js";
import { FILTRI_VUOTI, type Filtri } from "./catalogo/filtri.js";
import type { CopieDiCarta } from "./mazzo/base-di-terre.js";
import { copieMassime } from "./mazzo/copie.js";
import { DIMENSIONE_MAZZO, TERRE_A_MANO_MASSIME, TERRE_A_MANO_MINIME } from "./mazzo/taratura.js";
import type { MazzoSalvato } from "./mazzo/salvato.js";
import { AMBITO_APP, NOME_APP, NOME_APP_DA_DECIDERE } from "./identita.js";

/**
 * Le tre schermate dell'app: il catalogo delle carte legali in Standard
 * cartaceo (ticket 04), il mazzo che se ne mette insieme, con la base di terre
 * e le probabilità reali (ticket 06), e i mazzi salvati sul dispositivo, che si
 * riaprono, si scambiano per iscritto e si esportano per l'arbitro (ticket 07).
 *
 * Il pool sta nel pacchetto e il service worker lo tiene in cache, quindi
 * l'app si apre anche senza rete (storia 15); solo le immagini arrivano da
 * Scryfall, e mancano finché non si è viste almeno una volta.
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
  const [pagina, setPagina] = useState<"catalogo" | "mazzo" | "salvati">("catalogo");

  /**
   * Il mazzo si tiene **per nome di carta**, non per oggetto: i dati si
   * aggiornano da soli in sottofondo (ticket 05), e un mazzo legato agli
   * oggetti del vecchio pool si svuoterebbe da sé sotto le mani dell'utente.
   * Chiudendo l'app il mazzo in mano si perde: quello che resta è il mazzo
   * **salvato** con un nome, nella terza schermata (ticket 07).
   */
  const [copiePerNome, setCopiePerNome] = useState<ReadonlyMap<string, number>>(new Map());
  /**
   * Il mazzo salvato che si sta guardando, se se ne sta guardando uno: serve a
   * risalvarlo al suo posto invece di farne ogni volta una copia nuova.
   */
  const [aperto, setAperto] = useState<MazzoAperto>(null);
  /** Le terre volute a mano; `null` finché decide la curva del mazzo. */
  const [terreVolute, setTerreVolute] = useState<number | null>(null);
  /**
   * I filtri del catalogo vivono qui, non dentro il catalogo: passando al mazzo
   * e tornando indietro, chi aveva ristretto a dodici carte deve ritrovare
   * quelle dodici e non tutte le quattromilaottocento.
   */
  const [filtri, setFiltri] = useState<Filtri>(FILTRI_VUOTI);

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

  // Il mazzo, ricostruito sulle carte del pool che c'è adesso. Le carte che un
  // aggiornamento dei dati facesse sparire — una rotazione, un bando — escono
  // dal mazzo da sole, che è esattamente quel che deve succedere: non sono più
  // giocabili.
  const mazzo = useMemo<CopieDiCarta[]>(() => {
    if (pool === null || copiePerNome.size === 0) return [];
    const perNome = new Map(pool.carte.map((carta) => [carta.nome, carta]));
    const voci: CopieDiCarta[] = [];
    for (const [nome, copie] of copiePerNome) {
      const carta = perNome.get(nome);
      if (carta !== undefined && copie > 0) voci.push({ carta, copie });
    }
    return voci;
  }, [pool, copiePerNome]);

  const carteNelMazzo = mazzo.reduce((somma, voce) => somma + voce.copie, 0);

  const cambiaCopie = (carta: Carta, delta: number) => {
    setCopiePerNome((prima) => {
      const dopo = new Map(prima);
      // Il tetto lo dice la carta, non il codice: le poche che portano scritto
      // «any number of cards named …» non ne hanno, e un mazzo costruito
      // attorno a una di quelle è proprio il mazzo fuori meta che cerchiamo.
      const tetto = Math.min(copieMassime(carta), DIMENSIONE_MAZZO);
      const quante = Math.max(0, Math.min(tetto, (prima.get(carta.nome) ?? 0) + delta));
      if (quante === 0) dopo.delete(carta.nome);
      else dopo.set(carta.nome, quante);
      return dopo;
    });
  };

  const cambiaTerre = (quante: number | null) => {
    setTerreVolute(
      quante === null
        ? null
        : Math.max(TERRE_A_MANO_MINIME, Math.min(TERRE_A_MANO_MASSIME, quante)),
    );
  };

  /**
   * Aprire un mazzo salvato è rimetterselo in mano: le carte tornano quelle,
   * le terre tornano quelle che l'utente aveva chiesto, e da lì si riprende a
   * lavorarci.
   *
   * Quel che rientra passa dagli **stessi limiti** di quel che si aggiunge a
   * mano dal catalogo: un mazzo può arrivare da un file scritto a mano, e non
   * deve poter mettere nell'app uno stato che l'app da sola non produrrebbe
   * mai. Le carte che nel frattempo sono uscite dallo Standard non rientrano
   * affatto — una rotazione, un bando — ed è quel che deve succedere: non sono
   * più giocabili.
   */
  const apriMazzo = (salvato: MazzoSalvato, vaiAlMazzo: boolean) => {
    const perNome = new Map(pool?.carte.map((carta) => [carta.nome, carta]) ?? []);
    const copie = new Map<string, number>();
    for (const voce of salvato.carte) {
      const carta = perNome.get(voce.nome);
      if (carta === undefined) continue;
      const tetto = Math.min(copieMassime(carta), DIMENSIONE_MAZZO);
      copie.set(voce.nome, Math.max(1, Math.min(tetto, voce.copie)));
    }
    setCopiePerNome(copie);
    cambiaTerre(salvato.richiesta.terreVolute);
    setAperto({ id: salvato.id, nome: salvato.nome, salvatoIl: salvato.salvatoIl });
    if (vaiAlMazzo) setPagina("mazzo");
  };

  return (
    <div class="guscio">
      <header class="testata">
        <span class="marchio">{NOME_APP}</span>
        <span class="ambito">{AMBITO_APP}</span>
        {pool !== null && guasto === null ? (
          <nav class="schede" aria-label="Le schermate">
            <button
              type="button"
              class="scheda-nav"
              aria-current={pagina === "catalogo" ? "page" : undefined}
              onClick={() => setPagina("catalogo")}
            >
              Catalogo
            </button>
            <button
              type="button"
              class="scheda-nav"
              aria-current={pagina === "mazzo" ? "page" : undefined}
              onClick={() => setPagina("mazzo")}
            >
              Mazzo{carteNelMazzo > 0 ? ` · ${carteNelMazzo}` : ""}
            </button>
            <button
              type="button"
              class="scheda-nav"
              aria-current={pagina === "salvati" ? "page" : undefined}
              onClick={() => setPagina("salvati")}
            >
              Salvati
            </button>
          </nav>
        ) : null}
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
        ) : pagina === "catalogo" ? (
          <Catalogo
            pool={pool}
            filtri={filtri}
            cambiaFiltri={setFiltri}
            copiePerNome={copiePerNome}
            cambiaCopie={cambiaCopie}
          />
        ) : pagina === "salvati" ? (
          <MazziSalvati
            pool={pool}
            mazzo={mazzo}
            terreVolute={terreVolute}
            aperto={aperto}
            apriMazzo={apriMazzo}
            chiudiMazzo={() => setAperto(null)}
          />
        ) : (
          <SchermataMazzo
            pool={pool}
            mazzo={mazzo}
            copiePerNome={copiePerNome}
            cambiaCopie={cambiaCopie}
            terreVolute={terreVolute}
            cambiaTerre={cambiaTerre}
          />
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

/**
 * La schermata del mazzo, con la carta che si apre: la scheda è la stessa del
 * catalogo, e vive qui perché è la schermata a sapere quale carta è aperta.
 */
function SchermataMazzo({
  pool,
  mazzo,
  copiePerNome,
  cambiaCopie,
  terreVolute,
  cambiaTerre,
}: {
  pool: Pool;
  mazzo: readonly CopieDiCarta[];
  copiePerNome: ReadonlyMap<string, number>;
  cambiaCopie: (carta: Carta, delta: number) => void;
  terreVolute: number | null;
  cambiaTerre: (quante: number | null) => void;
}) {
  const [aperta, setAperta] = useState<Carta | null>(null);

  useEffect(() => {
    if (aperta === null) return undefined;
    const prima = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prima;
    };
  }, [aperta]);

  return (
    <>
      <Mazzo
        pool={pool}
        mazzo={mazzo}
        cambiaCopie={cambiaCopie}
        terreVolute={terreVolute}
        cambiaTerre={cambiaTerre}
        apri={setAperta}
      />
      {aperta ? (
        <SchedaCarta
          carta={aperta}
          chiudi={() => setAperta(null)}
          copie={copiePerNome.get(aperta.nome) ?? 0}
          cambiaCopie={cambiaCopie}
        />
      ) : null}
    </>
  );
}
