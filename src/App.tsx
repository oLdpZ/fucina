import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { Catalogo } from "./componenti/Catalogo.js";
import { Combo } from "./componenti/Combo.js";
import { Costruzione } from "./componenti/Costruzione.js";
import { Mazzo } from "./componenti/Mazzo.js";
import {
  MazziSalvati,
  type MazzoAperto,
  type TerreScartate,
} from "./componenti/MazziSalvati.js";
import { NoteLegali } from "./componenti/NoteLegali.js";
import { SchedaCarta } from "./componenti/SchedaCarta.js";
import { Vincoli } from "./componenti/Vincoli.js";
import { aggiornaInSottofondo, poolDaAprire } from "./dati/aggiornamento.js";
import { identitaDelFormato } from "./dati/ambito.js";
import { caricaFormato } from "./dati/carica-formato.js";
import { dataInItaliano } from "./dati/carica-pool.js";
import type { Formato } from "./dati/formato.js";
import type { Carta, Pool } from "./dati/pool.js";
import { FILTRI_VUOTI, type Filtri } from "./catalogo/filtri.js";
import type { CopieDiCarta } from "./mazzo/base-di-terre.js";
import { copieMassime } from "./mazzo/copie.js";
import { DIMENSIONE_MAZZO, TERRE_A_MANO_MASSIME, TERRE_A_MANO_MINIME } from "./mazzo/taratura.js";
import type { MazzoSalvato } from "./mazzo/salvato.js";
import { usaMotore } from "./ricerca/usa-motore.js";
import { COMBO_VUOTA, type Combo as CarteDellaCombo } from "./combo/combo.js";
import { TEMA_VUOTO, type Tema } from "./tema/tema.js";
import { NOME_APP, NOME_APP_DA_DECIDERE } from "./identita.js";

/**
 * Le quattro schermate dell'app: il catalogo delle carte legali nel formato che
 * si sta giocando (ticket 04), i vincoli — il tema che l'utente dichiara, con
 * l'avviso quando è troppo stretto (ticket 08) —, il mazzo che se ne mette
 * insieme, con la base di terre e le probabilità reali (ticket 06), e i mazzi
 * salvati sul dispositivo, che si riaprono, si scambiano per iscritto e si
 * esportano per l'arbitro (ticket 07).
 *
 * **Quale** formato si stia giocando l'app non lo sa da sé: lo legge dal
 * documento di formato, insieme alle carte e prima di disegnare qualunque cosa
 * (ADR-0004). Senza quel documento non si apre — e deve essere così: un'app che
 * mostrasse un catalogo senza saper dire di che gioco parla direbbe all'utente
 * che sono carte sue da giocare, e potrebbero non esserlo.
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
  /** Il gioco che si sta giocando, letto dal documento di formato. */
  const [formato, setFormato] = useState<Formato | null>(null);
  const [guasto, setGuasto] = useState<string | null>(null);
  const [pagina, setPagina] = useState<"catalogo" | "tema" | "mazzo" | "salvati">("catalogo");

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
  /**
   * Il tema dichiarato dall'utente (ticket 08). Vive qui per la stessa ragione
   * dei filtri — passando alle altre schermate non si perde — e perché è quel
   * che il motore riceverà quando esisterà: la richiesta parte da qui.
   */
  const [tema, setTema] = useState<Tema>(TEMA_VUOTO);
  /**
   * Le carte che l'utente afferma vincano se stanno insieme (ticket 05 della
   * tappa 3). Vivono qui accanto al tema, e per le stesse ragioni: sono un
   * ingresso della richiesta, e passando alle altre schermate non si perdono.
   *
   * Si tengono **per nome**, come il seme: i pool si aggiornano da soli.
   */
  const [combo, setCombo] = useState<CarteDellaCombo>(COMBO_VUOTA);
  /**
   * Il seme della ricerca (ticket 11). Vive qui, in vista e modificabile, e
   * non nasce dall'orologio: è quello che rende ripetibile il mazzo che l'app
   * costruisce. Stesso tema e stesso seme, stesso mazzo — anche fra un anno.
   */
  const [seme, setSeme] = useState(1);
  /**
   * Il motore vive qui e non nella schermata da cui lo si accende: le pagine
   * si smontano passando da una all'altra, e una ricerca che vivesse dentro la
   * pagina morirebbe andando a controllare una carta nel catalogo — cioè
   * proprio la cosa che il worker esiste per permettere.
   */
  const motore = usaMotore();

  /**
   * L'ambito: il formato ridotto a quel che ne esce di qui — il nome da
   * mostrare e l'impronta da confrontare.
   *
   * Ricavato **una volta**, e non nel disegno: sarebbe un oggetto nuovo a ogni
   * respiro dell'app, e chi lo riceve lo tiene fra le dipendenze dei propri
   * conti. Mentre il motore cerca, l'app si ridisegna di continuo, e la base di
   * terre della lista da torneo si rifarebbe a ogni giro per niente.
   */
  const ambito = useMemo(
    () => (formato === null ? null : identitaDelFormato(formato)),
    [formato],
  );

  // Un mazzo costruito per un tema — o per una combo — che nel frattempo è stato
  // riscritto risponde a una domanda che non gli è più stata fatta: si butta,
  // invece di restare lì col suo tasto «mettilo in mano» a dire una piccola bugia.
  const dimentica = motore.dimentica;
  useEffect(() => {
    dimentica();
    // `dimentica` cambia a ogni render — è ricostruita dal gancio — e metterla
    // fra le dipendenze vorrebbe dire buttare via il mazzo a ogni respiro
    // dell'app. Quel che deve far scattare l'oblio sono gli ingressi della
    // richiesta — il tema e la combo — e nient'altro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tema, combo]);

  /** Il controllo di freschezza si fa una volta per apertura, non a ogni pool. */
  const giaControllato = useRef(false);

  useEffect(() => {
    let vivo = true;
    // Le carte e il formato si aprono **insieme**, e insieme falliscono: le
    // carte senza il formato sarebbero un catalogo di un gioco che non si sa
    // quale sia, e il formato senza le carte non ha niente da governare.
    Promise.all([poolDaAprire(), caricaFormato()]).then(
      ([lettoPool, lettoFormato]) => {
        if (!vivo) return;
        setPool(lettoPool);
        setFormato(lettoFormato);
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
      // Il tetto lo dice la carta, non il codice: è un dato del pool, e le
      // poche carte che non ne hanno — quelle col permesso nel testo, le terre
      // base — fanno proprio i mazzi fuori meta che cerchiamo.
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
   * mai. Le carte che nel frattempo sono uscite dal formato non rientrano
   * affatto — una carta bandita, un'edizione che esce — ed è quel che deve
   * succedere: non sono più giocabili.
   */
  const apriMazzo = (salvato: MazzoSalvato, vaiAlMazzo: boolean): TerreScartate => {
    const perNome = new Map(pool?.carte.map((carta) => [carta.nome, carta]) ?? []);
    const copie = new Map<string, number>();
    const scartate: { nome: string; copie: number }[] = [];
    for (const voce of salvato.carte) {
      const carta = perNome.get(voce.nome);
      if (carta === undefined) continue;
      // Le terre non entrano qui nemmeno da un file: la schermata del mazzo le
      // ricalcola dalle carte (`mettiInMano`), e una terra in questo elenco
      // sarebbe una carta che l'app conta, salva ed esporta senza mostrarla
      // e senza lasciarla togliere. Le terre base non hanno tetto, quindi il
      // tetto non basta più a limitare i danni: è il posto giusto per dirlo.
      //
      // Restano fuori **tutte** le terre, non solo le base — e da quando il
      // motore sa mettere in un mazzo anche le terre di utilità
      // (`mazzo/base-di-terre.ts`), una lista che ne porta perde davvero
      // qualcosa. Finché è così, chi importa se lo deve sentir dire: se ne
      // porta il conto fuori di qui, e chi chiama lo racconta.
      if (carta.terra !== null) {
        scartate.push({ nome: carta.nome, copie: Math.max(1, voce.copie) });
        continue;
      }
      const tetto = Math.min(copieMassime(carta), DIMENSIONE_MAZZO);
      copie.set(voce.nome, Math.max(1, Math.min(tetto, voce.copie)));
    }
    setCopiePerNome(copie);
    cambiaTerre(salvato.richiesta.terreVolute);
    setAperto({ id: salvato.id, nome: salvato.nome, salvatoIl: salvato.salvatoIl });
    // Se c'è qualcosa da dire, si resta dove la frase si legge: portare
    // l'utente al mazzo con un messaggio alle spalle vorrebbe dire non dirglielo
    // affatto — e questo è proprio il caso in cui il mazzo che vede non è
    // quello che ha aperto.
    if (vaiAlMazzo && scartate.length === 0) setPagina("mazzo");
    return scartate;
  };

  /**
   * Il mazzo che il motore ha costruito torna in mano all'utente: le carte
   * nella schermata «Mazzo», e le terre fissate a quelle che la ricerca ha
   * scelto, così i numeri che si leggono lì sono gli stessi su cui il motore
   * ha deciso. Da quel momento è un mazzo come gli altri: si tocca, si salva,
   * si esporta.
   */
  const mettiInMano = (carte: readonly CopieDiCarta[], terre: number) => {
    // Le terre non si trasportano una per una: la schermata del mazzo le
    // ricalcola dalle stesse carte, dallo stesso pool e dalle stesse
    // esclusioni del tema, e con lo stesso numero ritrova la stessa base.
    // Portarsi dietro l'elenco vorrebbe dire avere due liste di terre che
    // possono divergere, e prima o poi divergerebbero.
    setCopiePerNome(new Map(carte.map((voce) => [voce.carta.nome, voce.copie])));
    cambiaTerre(terre);
    setAperto(null);
    setPagina("mazzo");
  };

  return (
    <div class="guscio">
      <header class="testata">
        <span class="marchio">{NOME_APP}</span>
        {ambito !== null ? <span class="ambito">{ambito.nome}</span> : null}
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
              aria-current={pagina === "tema" ? "page" : undefined}
              onClick={() => setPagina("tema")}
            >
              Tema
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
              <strong>L&rsquo;app non si apre.</strong> {guasto} Prova a chiudere e riaprire
              l&rsquo;app: se il guasto resta, va rifatta l&rsquo;installazione.
            </p>
          </section>
        ) : pool === null || ambito === null ? (
          <p class="attesa">Carico le carte…</p>
        ) : pagina === "catalogo" ? (
          <Catalogo
            pool={pool}
            filtri={filtri}
            cambiaFiltri={setFiltri}
            copiePerNome={copiePerNome}
            cambiaCopie={cambiaCopie}
          />
        ) : pagina === "tema" ? (
          <div class="schermata-tema">
            <Vincoli
              pool={pool}
              tema={tema}
              cambiaTema={setTema}
              copiePerNome={copiePerNome}
              cambiaCopie={cambiaCopie}
            />
            <Combo pool={pool} tema={tema} combo={combo} cambiaCombo={setCombo} />
            <Costruzione
              pool={pool}
              tema={tema}
              combo={combo}
              seme={seme}
              cambiaSeme={setSeme}
              motore={motore}
              mettiInMano={mettiInMano}
            />
          </div>
        ) : pagina === "salvati" ? (
          <MazziSalvati
            pool={pool}
            formato={ambito}
            mazzo={mazzo}
            terreVolute={terreVolute}
            aperto={aperto}
            apriMazzo={apriMazzo}
            chiudiMazzo={() => setAperto(null)}
          />
        ) : (
          <SchermataMazzo
            pool={pool}
            tema={tema}
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
            {/*
              L'aspetto è ancora da scegliere anche adesso che il nome c'è, e
              l'avviso lo dice per quel che è invece di sparire con lui: un'app
              che smettesse di dichiarare i propri lavori in corso appena ne
              chiude uno direbbe il falso sugli altri.
            */}
            {NOME_APP_DA_DECIDERE
              ? " Il nome dell’app e il suo aspetto non sono ancora stati scelti."
              : " L’aspetto dell’app non è ancora stato scelto."}
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
  tema,
  mazzo,
  copiePerNome,
  cambiaCopie,
  terreVolute,
  cambiaTerre,
}: {
  pool: Pool;
  tema: Tema;
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
        tema={tema}
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
