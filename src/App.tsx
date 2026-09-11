import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { caricaOrologiDiPartenza } from "./avversario/carica-orologi.js";
import { orologiCheSiLeggono, type Orologio } from "./avversario/orologio.js";
import { Avversario } from "./componenti/Avversario.js";
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
import { dimenticaOrologi, leggiOrologiSalvati, salvaOrologi } from "./dati/deposito.js";
import { identitaDelFormato } from "./dati/ambito.js";
import { caricaFormato } from "./dati/carica-formato.js";
import { dataInItaliano } from "./dati/carica-pool.js";
import type { Formato } from "./dati/formato.js";
import type { Carta, Pool } from "./dati/pool.js";
import { FILTRI_VUOTI, type Filtri } from "./catalogo/filtri.js";
import type { CopieDiCarta } from "./mazzo/base-di-terre.js";
import { copieMassime } from "./mazzo/copie.js";
import {
  temaInVigore,
  tettoInVigore,
  vincoliDiUnMazzoRiaperto,
  type MazzoConsegnato,
} from "./mazzo/in-vigore.js";
import { DIMENSIONE_MAZZO, TERRE_A_MANO_MASSIME, TERRE_A_MANO_MINIME } from "./mazzo/taratura.js";
import type { MazzoSalvato } from "./mazzo/salvato.js";
import { usaMotore } from "./ricerca/usa-motore.js";
import { COMBO_VUOTA, type Combo as CarteDellaCombo } from "./combo/combo.js";
import { temaDichiarato, TEMA_VUOTO, type Tema } from "./tema/tema.js";
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
   * Il tetto di spesa in euro, e `null` vuol dire **spento** — che è come
   * l'app si apre (ticket 09).
   *
   * Spento di suo e non per dimenticanza: il fulcro è il tasso di cambio fra
   * tema e potenza, e la frontiera ne mostra uno. Un budget acceso all'apertura
   * ne metterebbe accanto un secondo, e la prima risposta che il giocatore
   * riceve sarebbe sul portafoglio invece che sul tema. Lo accende lui, quando
   * sta per comprare.
   *
   * Vive qui accanto al tema e al seme, e per le stesse ragioni: è un ingresso
   * della richiesta, e passando alle altre schermate non si perde.
   */
  const [tettoDiSpesa, setTettoDiSpesa] = useState<number | null>(null);
  /**
   * Il mazzo consegnato: i vincoli sotto cui le sue terre sono state scelte —
   * il tetto e il tema — e le carte che ci stavano dentro.
   *
   * Quei due non sono `tettoDiSpesa` e `tema`, ed è tutta la differenza: la
   * schermata del mazzo si rifà la base di terre da sola, e per ritrovare
   * quella di allora deve filtrare le terre coi vincoli di **allora**. Coi
   * vincoli di adesso, chi costruisce a 30 euro e poi spegne l'interruttore si
   * vedrebbe cambiare la base e il conto sotto le mani, senza aver toccato il
   * mazzo; chi accende un tetto su un mazzo messo insieme a mano se ne vedrebbe
   * sparire le terre senza listino; e chi salva un mazzo dicendo «niente nero»,
   * cambia tema e lo riapre se lo ritroverebbe pieno di paludi (ticket 31).
   *
   * Accanto ai vincoli ci sono le carte perché i vincoli **non valgono per
   * sempre**: valgono finché il mazzo in mano è ancora quello consegnato, e per
   * saperlo bisogna avere con che confrontarlo (`in-vigore.ts`, ticket 21).
   *
   * `null` per i mazzi messi insieme a mano dal catalogo: nessuna richiesta li
   * ha prodotti, e nessuna se ne applica. I mazzi **riaperti** dai salvati
   * invece ne hanno una — quella con cui erano stati costruiti — e la ritrovano
   * qui: rimettere in mano il mazzo com'era, non rimettere l'app com'era.
   */
  const [consegnato, setConsegnato] = useState<MazzoConsegnato | null>(null);
  /**
   * Gli orologi dell'avversario: i mazzi che l'utente dice di incontrare
   * ([ADR-0002](../docs/adr/0002-avversario-come-orologio-motore-di-regole-rimandato.md)).
   *
   * Vivono qui accanto al tema, al seme e al tetto, e per la stessa ragione:
   * sono un ingresso della richiesta, e passando da una schermata all'altra non
   * si devono perdere.
   *
   * Partono vuoti e non dal file del manutentore: il file arriva **dopo**,
   * nell'effetto che carica i dati, e solo se l'utente non ne ha di suoi. Un
   * elenco pieno prima che si sappia cosa l'utente ha salvato farebbe lampeggiare
   * i mazzi del manutentore a chi li aveva cancellati.
   */
  const [orologi, setOrologi] = useState<readonly Orologio[]>([]);
  /**
   * L'utente ha già messo mano agli orologi in questa sessione?
   *
   * Serve a una cosa sola: che l'apertura, che arriva dopo un `fetch` e quindi
   * tardi, non passi sopra a quel che l'utente ha scritto nel frattempo.
   */
  const orologiScrittiAMano = useRef(false);
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
    // richiesta — il tema, la combo e il tetto di spesa — e nient'altro. Un
    // mazzo costruito con un tetto diverso da quello scritto adesso
    // risponderebbe a una domanda che non gli è più stata fatta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tema, combo, tettoDiSpesa]);

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

  /**
   * Da dove vengono gli orologi all'apertura: prima quel che l'utente ha
   * salvato, e solo se non ha mai salvato niente il file del manutentore.
   *
   * La distinzione fra «non ha mai deciso» e «ha salvato un elenco vuoto» è
   * tutta qui: senza, chi cancella tutti gli orologi se li ritroverebbe alla
   * riapertura, e l'app gli rimetterebbe in bocca un meta che ha rifiutato.
   */
  useEffect(() => {
    let vivo = true;
    void leggiOrologiSalvati()
      .then(async (suoi) => {
        if (!vivo || orologiScrittiAMano.current) return;
        if (suoi !== null) return setOrologi(suoi);
        const diPartenza = await caricaOrologiDiPartenza();
        // Il file del manutentore arriva da un `fetch`, e alla prima apertura
        // quell'attesa è lunga abbastanza perché l'utente apra il pannello e
        // scriva. Quel che ha scritto vince sempre: senza questa guardia il
        // file di cortesia gli passava sopra, e il tasto successivo salvava la
        // sostituzione (ticket 35).
        if (vivo && !orologiScrittiAMano.current) setOrologi(diPartenza);
      })
      // Gli orologi che non si caricano non fermano l'app: senza, la corsa
      // semplicemente non si corre, e tutto il resto funziona intero.
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  /**
   * Gli orologi cambiati si salvano subito: non c'è un bottone «salva».
   *
   * Nel deposito va solo quel che si rileggerà. Un mazzo appena aggiunto non ha
   * ancora un nome — lo scrive l'utente, ed è giusto così — ma un orologio
   * senza nome è una riga che si sta scrivendo, non una decisione: vive nello
   * stato della schermata e nel deposito entra quando un nome ce l'ha
   * (ticket 35). Salvare uno stato che non si rilegge era la causa; il lettore
   * indulgente di `leggiOrologiSalvati` è il rimedio per i depositi già rovinati.
   */
  const cambiaOrologi = (nuovi: readonly Orologio[]) => {
    orologiScrittiAMano.current = true;
    setOrologi(nuovi);
    void salvaOrologi(orologiCheSiLeggono(nuovi) ?? []);
  };

  /** Rimette i mazzi di partenza, dimenticando quel che l'utente aveva scritto. */
  const ripristinaOrologi = () => {
    orologiScrittiAMano.current = true;
    void dimenticaOrologi()
      .then(() => caricaOrologiDiPartenza())
      .then(setOrologi)
      .catch(() => {});
  };

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

  /**
   * Il tetto che vale **adesso** sul mazzo in mano: quello con cui il motore
   * l'ha costruito finché è ancora quel mazzo, niente appena non lo è più
   * (ticket 21).
   *
   * Si ricava e non si tiene: un tetto tenuto a parte sarebbe un secondo stato
   * da mantenere allineato alle carte, e la volta che non lo fosse la schermata
   * del mazzo filtrerebbe le terre con una cifra che non appartiene più a
   * niente. Ricavarlo dalle carte toglie di mezzo quella possibilità.
   */
  const tettoDelMazzoInMano = useMemo(
    () => tettoInVigore(consegnato, copiePerNome),
    [consegnato, copiePerNome],
  );

  /**
   * Il tema che sceglie **adesso** le terre del mazzo in mano: quello con cui è
   * stato costruito finché è ancora quel mazzo, e quello dichiarato nei Vincoli
   * appena non lo è più — o quando nessuno lo ha costruito (ticket 31).
   *
   * La manopola dei Vincoli non si tocca mai: è la decisione del ticket. Chi
   * riapre un mazzo salvato ritrova il mazzo com'era, non l'app com'era, e la
   * schermata del tema resta quella che stava guardando.
   */
  const temaDelMazzo = useMemo(
    () => temaInVigore(consegnato, copiePerNome),
    [consegnato, copiePerNome],
  );
  const temaDelMazzoInMano = temaDelMazzo ?? tema;

  /**
   * Slegare il mazzo che si ha in mano dai vincoli con cui è nato, senza
   * toccarne le carte: è la seconda metà del ticket 21, e la ragione per cui la
   * prima può permettersi di essere severa. Chi vuole tenere il mazzo com'è e
   * vedere la base rifatta coi vincoli di adesso lo dice qui, invece di doverlo
   * ottenere di sponda cambiando una carta e rimettendola.
   *
   * Se ne vanno **insieme**, tetto e tema, per la ragione scritta in
   * `in-vigore.ts`: sono un fatto solo — sotto che cosa questo mazzo è stato
   * costruito — e staccarne metà lascerebbe una base filtrata da metà della
   * richiesta di allora e da metà di quella di adesso.
   */
  const sciogliIVincoli = () => setConsegnato(null);

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
    // I vincoli con cui il mazzo era stato costruito tornano **attaccati a
    // lui**, non nelle manopole (ticket 31): sono quelli che gli rifanno le sue
    // terre, e sono anche quelli che se ne andranno da soli appena una carta
    // cambia. Un mazzo salvato prima di questo cambio non ne porta nessuno, e
    // non è un guasto: le sue terre si rifanno con quel che c'è adesso, come
    // facevano tutte prima — con la differenza che adesso, non dichiarando
    // niente, la schermata non dice il falso su come sono state scelte.
    setConsegnato(vincoliDiUnMazzoRiaperto(salvato.richiesta, copie));
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
  const mettiInMano = (carte: readonly CopieDiCarta[], terre: number, tetto: number | null) => {
    // Le terre non si trasportano una per una: la schermata del mazzo le
    // ricalcola dalle stesse carte, dallo stesso pool e dalle stesse
    // esclusioni del tema, e con lo stesso numero ritrova la stessa base.
    // Portarsi dietro l'elenco vorrebbe dire avere due liste di terre che
    // possono divergere, e prima o poi divergerebbero.
    const copie = new Map(carte.map((voce) => [voce.carta.nome, voce.copie]));
    setCopiePerNome(copie);
    cambiaTerre(terre);
    // Il tetto **e il tema** viaggiano col mazzo, non con le manopole: da qui in
    // poi questo mazzo è «quello costruito a tanti euro sotto quel tema», e
    // resta tale anche se le manopole cambiano idea. Resta tale finché resta
    // **questo** mazzo: le carte partono di qui insieme ai vincoli proprio per
    // poterlo dire (`in-vigore.ts`).
    //
    // Il tema si fotografa qui anche quando il tetto è spento, ed è il ticket
    // 31: prima, senza tetto, il mazzo consegnato non veniva registrato affatto
    // e le sue terre finivano per essere scelte dalla manopola dei Vincoli —
    // cioè da quel che l'utente sta chiedendo adesso, non da quel che aveva
    // chiesto quando il mazzo è nato.
    //
    // Le copie si fotografano in una mappa **sua**: quella dello stato può
    // cambiare padrone, e una fotografia che fosse lo stesso oggetto
    // confronterebbe il mazzo con se stesso — cioè non staccherebbe i vincoli
    // mai più, che è esattamente il difetto per cui esiste `in-vigore.ts`.
    //
    // Un tema che non dichiara niente si registra come **nessun tema**, e non
    // come un tema vuoto: `temaDichiarato` è la definizione dell'app, e un
    // mazzo salvato non ha modo di scrivere la differenza fra «costruito senza
    // vincoli» e «salvato prima che l'app scrivesse il tema». Registrandolo qui
    // come tema vero, lo stesso mazzo si comporterebbe in un modo prima di
    // essere salvato e in un altro dopo essere stato riaperto — e due regole
    // per lo stesso mazzo sono peggio di una regola sola un po' larga. La
    // regola sola: chi non ha dichiarato niente prende le terre che il tema di
    // adesso permette, come è sempre stato.
    setConsegnato({ tetto, tema: temaDichiarato(tema) ? tema : null, copie: new Map(copie) });
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
            formato={ambito}
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
            <Avversario
              orologi={orologi}
              cambiaOrologi={cambiaOrologi}
              ripristina={ripristinaOrologi}
            />
            <Costruzione
              pool={pool}
              tema={tema}
              combo={combo}
              seme={seme}
              cambiaSeme={setSeme}
              tettoDiSpesa={tettoDiSpesa}
              cambiaTetto={setTettoDiSpesa}
              orologi={orologi}
              motore={motore}
              mettiInMano={mettiInMano}
            />
          </div>
        ) : pagina === "salvati" ? (
          <MazziSalvati
            pool={pool}
            tema={temaDelMazzoInMano}
            temaDeiVincoli={tema}
            tettoDiSpesa={tettoDelMazzoInMano}
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
            tema={temaDelMazzoInMano}
            temaDeiVincoli={tema}
            temaDelMazzo={temaDelMazzo}
            mazzo={mazzo}
            copiePerNome={copiePerNome}
            cambiaCopie={cambiaCopie}
            terreVolute={terreVolute}
            cambiaTerre={cambiaTerre}
            tettoDiSpesa={tettoDelMazzoInMano}
            sciogliIVincoli={sciogliIVincoli}
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
  temaDeiVincoli,
  temaDelMazzo,
  mazzo,
  copiePerNome,
  cambiaCopie,
  terreVolute,
  cambiaTerre,
  tettoDiSpesa,
  sciogliIVincoli,
}: {
  pool: Pool;
  /** Il tema che sceglie le terre di questo mazzo, che non è per forza l'altro. */
  tema: Tema;
  /** Il tema dichiarato adesso nei Vincoli: serve a dire di quanto differiscono. */
  temaDeiVincoli: Tema;
  /** Se un tema è attaccato a questo mazzo, e quale; `null` se decide la manopola. */
  temaDelMazzo: Tema | null;
  mazzo: readonly CopieDiCarta[];
  copiePerNome: ReadonlyMap<string, number>;
  cambiaCopie: (carta: Carta, delta: number) => void;
  terreVolute: number | null;
  cambiaTerre: (quante: number | null) => void;
  /** Il tetto di spesa, che vale anche sulle terre che la schermata sceglie. */
  tettoDiSpesa: number | null;
  /** Slegare questo mazzo dai vincoli con cui è nato (ticket 21, poi 31). */
  sciogliIVincoli: () => void;
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
        temaDeiVincoli={temaDeiVincoli}
        temaDelMazzo={temaDelMazzo}
        mazzo={mazzo}
        cambiaCopie={cambiaCopie}
        terreVolute={terreVolute}
        cambiaTerre={cambiaTerre}
        tettoDiSpesa={tettoDiSpesa}
        sciogliIVincoli={sciogliIVincoli}
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
