/**
 * **Il primo mazzo costruito dall'app** (ticket 11).
 *
 * L'utente dichiara il tema e preme un tasto; qui dentro si parte da un mazzo
 * iniziale ragionevole, si prova a sostituire una carta alla volta, si tiene lo
 * scambio se il punteggio sale, e ci si ferma quando nessuno scambio migliora
 * più o quando finisce il tempo concesso. Ne esce un mazzo legale da sessanta
 * carte con la sua base di terre.
 *
 * È la **cucitura di test principale** di tutto il progetto:
 * `costruisciMazzo(richiesta, pool) → frontiera`.
 *
 * ## La frontiera (ticket 12)
 *
 * La stessa ricerca si ripete con **pesi diversi dati alla purezza del tema**,
 * dal peso che rende il tema inviolabile a quello che lo ignora quasi del
 * tutto (`PESI_DELLA_PUREZZA`). Ne escono quattro o cinque mazzi allineati dal
 * più fedele al più forte, e con loro il numero che è il fulcro dichiarato del
 * progetto: non la lista, ma il **tasso di cambio** fra originalità e potenza —
 * quanto tema costa il passo successivo, e quanta potenza rende.
 *
 * Due cose tengono in piedi quella lettura, e sono scritte nel codice più sotto:
 *
 * - i **duplicati si scartano**: due pesi vicini che trovano lo stesso mazzo
 *   compaiono una volta sola, se no la frontiera direbbe che c'è un passo dove
 *   non c'è;
 * - i mazzi **dominati si scartano**: resta solo chi, cedendo tema, guadagna
 *   davvero potenza. Così purezza e potenza si muovono in direzioni opposte
 *   lungo tutta la frontiera, e la differenza fra un mazzo e il precedente è
 *   sempre un baratto vero.
 *
 * Il tetto di tempo vale per la **frontiera intera** e non per ogni mazzo: se
 * scade si torna con i mazzi trovati fin lì, dichiarando il troncamento.
 *
 * ## Come questa funzione resta pura
 *
 * `CLAUDE.md` chiede comportamento deterministico e verificabile, e il ticket
 * lo ripete: niente rete, niente orologio, niente caso non seminato, niente
 * disco. Le prime tre si tengono così:
 *
 * - **il caso** arriva dal seme della richiesta, e da lì si derivano le
 *   partenze: `caso(seme)` e nient'altro, mai `Math.random`;
 * - **l'orologio** arriva da fuori, come il seme. Il tetto di tempo esiste
 *   perché la ricerca gira sul telefono, ma un orologio letto di nascosto
 *   renderebbe il risultato dipendente da quanto è veloce la macchina. Chi
 *   chiama passa il suo — il worker passa quello vero, i test ne passano uno
 *   fermo — e il tempo può soltanto **fermare prima** una ricerca che era già
 *   decisa in ogni suo passo;
 * - **il tetto vero** è quello delle valutazioni, che non dipende da nessuna
 *   macchina: `taratura.valutazioniMassimePerPartenza`. È lui a garantire che
 *   due esecuzioni della stessa richiesta, se il tempo basta, diano lo stesso
 *   mazzo byte per byte.
 *
 * Tutte le valutazioni della ricerca usano **lo stesso seme**, non semi diversi
 * a ogni scambio: due mazzi vanno confrontati sulle stesse partite, se no la
 * differenza che si misura è quella fra due mescolate e non quella fra due
 * mazzi.
 */

import { qualitaDiCarta, valutaMazzo, combina, type Punteggio } from "../punteggio/punteggio.js";
import { caso } from "../caso.js";
import {
  comboDichiarata,
  misuraLaCombo,
  risolviCombo,
  type Combo,
  type ComboRisolta,
  type EsitoDellaCombo,
} from "../combo/combo.js";
import type { Carta } from "../dati/pool.js";
import { terreDallaCurva, type BaseDiTerre, type CopieDiCarta } from "../mazzo/base-di-terre.js";
import { copieAlMassimo, copieMassime } from "../mazzo/copie.js";
import type { EsitoDellaSimulazione } from "../mazzo/simulazione.js";
import { DIMENSIONE_MAZZO, TERRE_MINIME } from "../mazzo/taratura.js";
import { valutaTema, type Ampiezza } from "../tema/ampiezza.js";
import { POSTI_NON_TERRA } from "../tema/taratura.js";
import {
  escluso,
  eTerra,
  purezza,
  risolviTema,
  temaDichiarato,
  appartiene,
  type Allargamento,
  type Tema,
  type TemaRisolto,
} from "../tema/tema.js";
import { TARATURA_DELLA_RICERCA, type TaraturaDellaRicerca } from "./taratura.js";

/**
 * La richiesta, nella forma che `spec.md` fissa: è la decisione più difficile
 * da cambiare dopo, ed è scritta lì prima che qui.
 */
export type Richiesta = {
  tema: Tema;
  /**
   * Le carte che l'utente afferma vincano se stanno insieme, **per nome**
   * (ticket 05 della tappa 3). Vuota quando non ne ha dichiarata nessuna.
   *
   * L'app non giudica se quelle carte vincano: le mette nel mazzo al massimo
   * delle copie e non le scambia via. Vedi `combo/combo.ts`.
   */
  combo: Combo;
  /** Il seme del caso: senza, niente di quel che segue è verificabile. */
  seme: number;
  /** Il tetto di tempo, perché la ricerca gira sul telefono. */
  tempoMassimoMs: number;
};

/** Quel che la ricerca racconta di sé mentre lavora, per chi mostra una barra. */
export type Avanzamento = {
  /** Il mazzo della frontiera in corso, contato da zero. */
  passo: number;
  /** Quanti mazzi la frontiera prova a cercare: uno per peso della purezza. */
  passi: number;
  /** La partenza in corso, dentro il passo, contata da zero. */
  partenza: number;
  partenze: number;
  /**
   * I mazzi provati finora, dalla **frontiera intera**: tutte le partenze di
   * tutti i passi, sommate. Sale e non torna mai indietro — un contatore che
   * ricominciasse a ogni passo direbbe a chi guarda la barra che il lavoro
   * fatto si è perso.
   */
  valutazioni: number;
  /**
   * Il punteggio del migliore trovato finora **in questo passo**: sale finché
   * il passo dura, e riparte da capo al passo dopo. Non si confronta fra passi
   * diversi — ognuno pesa il tema a modo suo, e sono due scale diverse.
   */
  migliore: number;
};

export type Opzioni = {
  /**
   * L'orologio, in millisecondi che crescono. Arriva da fuori apposta: vedi la
   * nota in testa al file.
   */
  orologio?: () => number;
  avanzamento?: (avanzamento: Avanzamento) => void;
  /** Le manopole di `taratura.ts`, sovrascrivibili una per una. */
  taratura?: Partial<TaraturaDellaRicerca>;
};

/**
 * L'esito, **sempre dichiarato**: anche quando non c'è niente da costruire, chi
 * chiama riceve una risposta e non un'eccezione.
 */
export type Esito =
  /** C'è un mazzo, e il tema aveva carte a sufficienza per riempirlo. */
  | "costruito"
  /** C'è un mazzo, ma il tema non bastava: il resto viene da fuori tema. */
  | "costruito-fuori-tema"
  /** Non c'è un tema: non c'è niente da costruire, e non è un guasto. */
  | "tema-non-dichiarato"
  /** Nemmeno il pool intero, tolte le esclusioni, riempie un mazzo legale. */
  | "niente-da-costruire";

export type MazzoCostruito = {
  /** Le carte non-terra, per costo e poi per nome: si legge come una lista. */
  carte: CopieDiCarta[];
  terre: CopieDiCarta[];
  /** La quota di copie non-terra che appartengono al tema, da `tema.ts`. */
  purezza: number;
  /** Le cinque componenti, **separate**: le spiegazioni ci pescheranno dentro. */
  punteggio: Punteggio;
  base: BaseDiTerre;
  simulazione: EsitoDellaSimulazione;
  /**
   * Le cinque componenti combinate in un numero: la **potenza**, l'asse contro
   * cui si legge la purezza lungo la frontiera. Si mostra accanto alle
   * componenti, non al posto loro — è la componente separata che spiega, questo
   * numero serve solo a dire quale mazzo è più forte di quale.
   */
  potenza: number;
  /**
   * La combo dichiarata, misurata su **questo** mazzo: quante copie di ogni
   * pezzo ci sono finite e che probabilità danno di averla assemblata al turno
   * della taratura. `null` quando l'utente non ne ha dichiarata nessuna — e
   * `null` e non zero, perché zero sarebbe la risposta a una domanda che
   * nessuno ha fatto.
   */
  combo: EsitoDellaCombo | null;
  /**
   * Il peso della purezza con cui **questo** mazzo è stato cercato. Sta qui
   * perché la frontiera sia verificabile: è la manopola che l'ha prodotto.
   */
  peso: number;
  /**
   * Quanto costa il passo dal mazzo precedente della frontiera: tema ceduto e
   * potenza guadagnata. `null` sul primo, che un precedente non ce l'ha.
   *
   * Sono le due differenze già fatte, e non due numeri da rifare a mano nella
   * schermata: il ticket chiede che l'utente le legga, e si leggono da qui.
   */
  passo: PassoDellaFrontiera | null;
  /**
   * Il numero solo con cui la ricerca ha ordinato i mazzi: la potenza più la
   * purezza per il suo peso. Sta qui perché sia verificabile, non perché si
   * mostri — quel che si mostra sono le componenti.
   */
  totale: number;
};

/** Il baratto fra un mazzo della frontiera e quello prima di lui. */
export type PassoDellaFrontiera = {
  /** Il tema ceduto: quota di copie non-terra, sempre maggiore di zero. */
  purezzaCeduta: number;
  /** La potenza guadagnata in cambio: sempre maggiore di zero. */
  potenzaGuadagnata: number;
};

export type Frontiera = {
  esito: Esito;
  /** La frase che dice l'esito, riempita di numeri veri e mai inventata. */
  motivo: string;
  /** Il verdetto sul tema, lo stesso che la schermata dei vincoli ha mostrato. */
  ampiezza: Ampiezza;
  /**
   * La combo dichiarata come il pool di oggi la vede: i pezzi trovati e i guai
   * — un nome sparito, uno che il tema esclude, una terra. I guai stanno qui e
   * non nei mazzi perché non dipendono dal mazzo: sono della richiesta.
   */
  combo: ComboRisolta;
  /**
   * I mazzi, **dal più fedele al tema al più forte**: purezza che scende e
   * potenza che sale, passo dopo passo. Vuota quando non c'è niente da
   * costruire; mai più lunga dei pesi provati, e più corta quando due pesi
   * hanno trovato lo stesso mazzo o quando il tempo è scaduto per strada.
   */
  mazzi: MazzoCostruito[];
  allargamentiApplicati: readonly Allargamento[];
  troncataPerTempo: boolean;
  /**
   * Le partenze di **ogni passo** della frontiera: dentro un passo la ricerca
   * si rifà da più parti e tiene la migliore. Le partenze davvero provate sono
   * queste per il numero di mazzi cercati, e quel numero è `mazzi.length` solo
   * quando nessun passo è stato scartato — per questo qui ce n'è una sola, ed è
   * quella di un passo.
   */
  partenze: number;
  scambiProvati: number;
  scambiTenuti: number;
};

/**
 * L'orologio vero, per chi non ne passa uno. Non è mai quello che i test usano.
 */
export function orologioDiSistema(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

/** Sotto questa differenza due mazzi si dicono pari, e lo scambio non si tiene. */
const PARI = 1e-9;

/**
 * Quanto rumore si aggiunge al merito delle carte per far partire la ricerca da
 * un'altra parte. Zero darebbe la stessa partenza tutte le volte; troppo,
 * partenze così brutte da sprecare il tempo che hanno.
 */
const RUMORE_DELLE_PARTENZE = 0.4;

/**
 * Quante volte, in una partenza, le terre possono tornare a seguire la curva.
 *
 * Un tetto serve: meno terre aprono posti per altre carte, altre carte
 * spostano il costo medio, e il costo medio ridice quante terre. Due
 * assestamenti tolgono la deriva grossa; il terzo girerebbe a vuoto.
 */
const ASSESTAMENTI_PER_PARTENZA = 2;

/** La selezione in lavorazione: quante copie per nome, e la carta dietro il nome. */
type Selezione = Map<string, { carta: Carta; copie: number }>;

export function costruisciMazzo(
  richiesta: Richiesta,
  pool: readonly Carta[],
  opzioni: Opzioni = {},
): Frontiera {
  const taratura: TaraturaDellaRicerca = { ...TARATURA_DELLA_RICERCA, ...opzioni.taratura };
  const orologio = opzioni.orologio ?? orologioDiSistema;
  const inizio = orologio();
  const scaduto = (): boolean => orologio() - inizio >= richiesta.tempoMassimoMs;

  const tema = richiesta.tema;
  const ampiezza = valutaTema(pool, tema);
  // La combo si risolve **prima** di qualunque conto, e sul pool intero: un
  // nome sparito va detto anche quando poi non si costruisce niente.
  const comboRisolta = risolviCombo(richiesta.combo, pool, tema);

  const niente = (esito: Esito, motivo: string): Frontiera => ({
    esito,
    motivo,
    ampiezza,
    combo: comboRisolta,
    mazzi: [],
    allargamentiApplicati: tema.allargamenti,
    troncataPerTempo: false,
    partenze: 0,
    scambiProvati: 0,
    scambiTenuti: 0,
  });

  if (!temaDichiarato(tema)) {
    return niente(
      "tema-non-dichiarato",
      "Non hai ancora detto che mazzo vuoi: senza un tema non c'è niente da costruire.",
    );
  }

  // Le esclusioni vincono su tutto e valgono anche per le terre: la base la
  // sceglie l'app, ma dentro i limiti che l'utente ha dichiarato.
  const terreDelPool = pool.filter((carta) => carta.terra !== null && !escluso(carta, tema));
  const giocabili = pool.filter(
    (carta) => carta.terra === null && !eTerra(carta) && !escluso(carta, tema),
  );

  if (terreDelPool.length === 0) {
    return niente(
      "niente-da-costruire",
      "Non è rimasta nessuna terra fra quelle che il tema permette, e un mazzo senza terre non si gioca.",
    );
  }

  // La capienza si conta con **lo stesso tetto** con cui poi si riempie il
  // mazzo: quattro copie per carta, anche per le carte che se ne concedono
  // infinite. Contarle diversamente vorrebbe dire rispondere «si fa» e poi
  // consegnare un mazzo da cinquantotto carte, che non e legale.
  const capienza = capienzaDi(giocabili);
  if (capienza < POSTI_NON_TERRA) {
    return niente(
      "niente-da-costruire",
      `Restano ${giocabili.length} carte giocabili, buone per ${capienza} posti: un mazzo ne chiede almeno ${POSTI_NON_TERRA}.`,
    );
  }

  const risolto = risolviTema(tema, pool);

  /**
   * I pezzi della combo, che nel mazzo entrano **al massimo delle copie** e non
   * si scambiano via: è tutto quel che «crederci» vuol dire, e da lì esce la
   * probabilità più alta che un mazzo da sessanta carte permetta.
   */
  const obbligate = comboRisolta.pezzi;
  const copieObbligate = obbligate.reduce((somma, carta) => somma + copieAlMassimo(carta), 0);
  const nomiObbligati = new Set(obbligate.map((carta) => carta.nome));

  // Non può succedere coi quattro pezzi che l'interfaccia concede — sedici
  // copie sui trentatré posti più stretti — ma una richiesta arriva anche
  // da un file, e un mazzo che non ci sta va detto invece che consegnato monco.
  if (copieObbligate > POSTI_NON_TERRA) {
    return niente(
      "niente-da-costruire",
      `I ${obbligate.length} pezzi rimasti della combo vogliono ${copieObbligate} posti, e un mazzo ne ha ${POSTI_NON_TERRA} da riempire oltre alle terre.`,
    );
  }

  /* --- La ricerca ------------------------------------------------------- */

  let scambiProvati = 0;
  let scambiTenuti = 0;
  let valutazioni = 0;
  let troncata = false;

  /**
   * Il punteggio di una selezione **col peso che questo passo dà al tema**.
   *
   * `totale` è il numero solo con cui la ricerca ordina i mazzi: la potenza più
   * la purezza per il suo peso. Far scorrere quel peso è tutta la frontiera.
   */
  const punteggioDi = (
    selezione: Selezione,
    posti: number,
    peso: number,
    partite: number | undefined,
  ) => {
    const carte = voci(selezione);
    const valutato = valutaMazzo(carte, terreDelPool, {
      seme: richiesta.seme,
      // Le terre non si contrattano qui: il numero viene dalla curva, e i posti
      // non-terra sono quel che resta. Passarlo esplicitamente è ciò che tiene
      // il mazzo esattamente a sessanta carte a ogni scambio provato.
      terreVolute: DIMENSIONE_MAZZO - posti,
      ...(partite === undefined ? {} : { partite }),
    });
    const pura = purezza(carte, risolto);
    const potenza = combina(valutato.punteggio);
    return { carte, valutato, purezza: pura, potenza, totale: potenza + peso * pura };
  };

  /**
   * Una ricerca intera con **un** peso: le partenze, gli scambi, e il mazzo
   * migliore che ne esce, rivalutato per intero.
   *
   * Il seme riparte da capo a ogni peso, e non prosegue da dove il peso prima
   * l'aveva lasciato: due passi della frontiera devono partire dagli stessi
   * posti, se no la differenza che l'utente legge fra un mazzo e il precedente
   * sarebbe in parte la differenza fra due mescolate.
   */
  const cerca = (peso: number, passo: number, passi: number): MazzoCostruito | null => {
    const semi = caso(richiesta.seme);
    const candidati = scegliCandidati(giocabili, risolto, taratura, peso);
    let migliore: { selezione: Selezione; posti: number; totale: number } | null = null;

    const valuta = (selezione: Selezione, posti: number): number => {
      valutazioni += 1;
      return punteggioDi(selezione, posti, peso, taratura.partiteInRicerca).totale;
    };

    const racconta = (partenza: number): void => {
      opzioni.avanzamento?.({
        passo,
        passi,
        partenza,
        partenze: taratura.partenze,
        valutazioni,
        migliore: migliore?.totale ?? 0,
      });
    };

    for (let partenza = 0; partenza < taratura.partenze; partenza++) {
      // Ogni partenza ha il suo generatore, derivato dal seme della richiesta:
      // partenze diverse, ma nessuna casuale.
      const generatore = caso(semi.intero(0x100000000));
      const ordine = ordinaPerPartenza(candidati, risolto, peso, partenza, generatore);
      // I posti non-terra non sono liberi: sono sessanta meno le terre che la
      // curva chiede, e non possono superare le copie che il pool sa dare.
      let posti = assestaIPosti(ordine, capienza, obbligate);
      let selezione = riempi(ordine, posti, obbligate);

      // La prima valutazione si fa **sempre**, anche col tempo già scaduto:
      // senza di lei non ci sarebbe nessun mazzo da restituire, e restituire un
      // mazzo c'è scritto nel ticket.
      let corrente = valuta(selezione, posti);
      if (migliore === null || corrente > migliore.totale + PARI) {
        migliore = { selezione, posti, totale: corrente };
      }
      racconta(partenza);

      if (scaduto()) {
        troncata = true;
        break;
      }

      let valutazioniQui = 1;
      let assestamenti = 0;
      let migliorato = true;
      while (migliorato) {
        migliorato = false;
        for (const scambio of scambi(selezione, candidati, generatore, nomiObbligati)) {
          if (valutazioniQui >= taratura.valutazioniMassimePerPartenza) break;
          if (scaduto()) {
            troncata = true;
            break;
          }

          const prova = conLoScambio(selezione, scambio);
          if (prova === null) continue;

          scambiProvati += 1;
          valutazioniQui += 1;
          const totale = valuta(prova, posti);
          if (totale > corrente + PARI) {
            selezione = prova;
            corrente = totale;
            scambiTenuti += 1;
            migliorato = true;
            if (corrente > migliore.totale + PARI) {
              migliore = { selezione, posti, totale: corrente };
            }
            racconta(partenza);
            // Primo miglioramento: si riparte a guardare gli scambi dal mazzo
            // nuovo, invece di finire un giro su un mazzo che non c'è più.
            break;
          }
        }
        if (troncata || valutazioniQui >= taratura.valutazioniMassimePerPartenza) break;

        // Quando nessuno scambio migliora più, le terre tornano a seguire la
        // curva, e se cambiano la ricerca riprende sul mazzo nuovo.
        //
        // Si fa **qui** e non dentro la passata di proposito: durante la
        // passata la base non si tocca, se no quel che si misura fra due mazzi
        // è il cambio di terre e non il cambio di carte. Ma un mazzo che ha
        // finito di migliorare e che nel frattempo ha spostato il suo costo
        // medio vuole un altro numero di terre, e consegnarlo con quelle
        // vecchie vorrebbe dire consegnare un mazzo che l'app stessa direbbe
        // sbagliato.
        if (migliorato || assestamenti >= ASSESTAMENTI_PER_PARTENZA) continue;
        const nuoviPosti = postiPerLaCurva(voci(selezione), capienza);
        if (nuoviPosti === posti) break;
        assestamenti += 1;
        selezione = adatta(selezione, ordine, nuoviPosti, nomiObbligati);
        posti = nuoviPosti;
        corrente = valuta(selezione, posti);
        migliorato = true;
        if (corrente > migliore.totale + PARI) {
          migliore = { selezione, posti, totale: corrente };
        }
      }

      if (troncata) break;
    }

    // `migliore` non è mai nullo qui: il ciclo delle partenze gira almeno una
    // volta e la sua prima valutazione non è sotto nessuna condizione. Se un
    // giorno lo diventasse, questo sarebbe il posto in cui accorgersene.
    if (migliore === null) return null;

    // Il mazzo che vince si rivaluta **per intero**, con le partite piene: i
    // numeri che l'utente legge non sono quelli sbrigativi della ricerca. E si
    // rivaluta qui, dentro il passo, non alla fine: purezza e potenza dei mazzi
    // della frontiera si confrontano fra loro, e confrontare una misura piena
    // con una sbrigativa direbbe che un passo ha guadagnato quando invece ha
    // solo misurato meglio.
    const finale = punteggioDi(migliore.selezione, migliore.posti, peso, undefined);
    return {
      carte: [...finale.carte].sort(
        (a, b) =>
          a.carta.valoreDiMana - b.carta.valoreDiMana ||
          a.carta.nome.localeCompare(b.carta.nome, "en"),
      ),
      terre: finale.valutato.base.terre,
      purezza: finale.purezza,
      punteggio: finale.valutato.punteggio,
      base: finale.valutato.base,
      simulazione: finale.valutato.simulazione,
      potenza: finale.potenza,
      combo: comboDichiarata(richiesta.combo)
        ? misuraLaCombo(comboRisolta, finale.carte, finale.valutato.base.dimensioneMazzo)
        : null,
      peso,
      passo: null,
      totale: finale.totale,
    };
  };

  /* --- La frontiera ----------------------------------------------------- */

  // Un passo per peso, dal tema inviolabile al tema quasi ignorato. Il tetto di
  // tempo è quello della **frontiera intera** — `inizio` è stato letto una
  // volta sola, prima di tutto — e quando scade si esce con i mazzi trovati fin
  // lì, che è quel che il ticket chiede.
  const pesi = taratura.pesiDellaPurezza;
  const trovati: MazzoCostruito[] = [];
  for (let passo = 0; passo < pesi.length; passo++) {
    const mazzo = cerca(pesi[passo]!, passo, pesi.length);
    if (mazzo !== null) trovati.push(mazzo);
    if (troncata) break;
  }

  const mazzi = allineaLaFrontiera(trovati);
  const primo = mazzi[0];
  if (primo === undefined) {
    return niente("niente-da-costruire", "La ricerca non ha potuto provare nemmeno un mazzo.");
  }

  /* --- L'esito, che si legge dal mazzo più puro -------------------------- */

  // La domanda «il tema bastava?» si fa sul **primo** mazzo della frontiera,
  // quello cercato col tema inviolabile: se nemmeno lì il tema ha riempito i
  // posti, non li riempirà da nessun'altra parte. Negli altri mazzi le carte
  // fuori tema ci sono per scelta, ed è la frontiera stessa a dire quanto
  // costano: chiamarle una mancanza sarebbe dire il falso.
  const nelTema = primo.carte.filter((voce) => appartiene(voce.carta, risolto));
  const copieNelTema = nelTema.reduce((somma, voce) => somma + voce.copie, 0);
  const copieTotali = primo.carte.reduce((somma, voce) => somma + voce.copie, 0);
  // Le terre si contano da quelle **scelte**, non da quante se ne erano
  // chieste: la frase deve dire il mazzo che c'è, non quello che si sperava.
  const copieDiTerra = primo.base.terre.reduce((somma, voce) => somma + voce.copie, 0);

  // Il tema bastava a riempire **questo** mazzo? La domanda si fa sui posti
  // che il mazzo ha davvero, non sui trentatre del verdetto di `ampiezza.ts`,
  // che prende il caso piu favorevole al tema e risponde a un'altra domanda.
  const capienzaDelTema = capienzaDi(giocabili.filter((carta) => appartiene(carta, risolto)));
  const fuoriTema = capienzaDelTema < copieTotali;
  const esito: Esito = fuoriTema ? "costruito-fuori-tema" : "costruito";
  const motivo = fuoriTema
    ? `Il tema prende ${ampiezza.carteDisponibili} carte dal pool, buone per ${capienzaDelTema} posti sui ${copieTotali} da riempire: nemmeno il mazzo più fedele si è potuto finire senza carte fuori tema.`
    : `Il mazzo più fedele: ${copieTotali + copieDiTerra} carte, di cui ${copieDiTerra} terre, e ${copieNelTema} delle ${copieTotali} carte non-terra sono del tema.`;

  return {
    esito,
    motivo,
    ampiezza,
    combo: comboRisolta,
    mazzi,
    allargamentiApplicati: tema.allargamenti,
    troncataPerTempo: troncata,
    partenze: taratura.partenze,
    scambiProvati,
    scambiTenuti,
  };
}

/* --- L'allineamento della frontiera --------------------------------------- */

/**
 * I mazzi trovati, messi in fila **dal più puro al più forte**, con i duplicati
 * e i dominati tolti di mezzo e il passo calcolato per ognuno.
 *
 * Due tagli, e ognuno risponde a una promessa del ticket:
 *
 * - **il duplicato**: due pesi vicini che convergono sullo stesso mazzo
 *   compaiono una volta sola. Mostrarlo due volte direbbe che fra i due c'è un
 *   passo, e un passo che non costa e non rende non è un passo.
 * - **il dominato**: un mazzo che cede tema senza guadagnare potenza non sta
 *   nella lista. È quel taglio a rendere vera la lettura promessa — purezza che
 *   scende e potenza che sale — invece di lasciarla alla fortuna: senza,
 *   la frontiera sarebbe l'elenco di quel che la ricerca ha trovato, e non il
 *   tasso di cambio che l'utente è venuto a leggere.
 *
 * Il mazzo più puro sopravvive sempre a entrambi i tagli: è il primo della fila
 * e non ha nessuno prima di sé che possa dominarlo.
 */
function allineaLaFrontiera(trovati: readonly MazzoCostruito[]): MazzoCostruito[] {
  const visti = new Set<string>();
  const distinti = trovati.filter((mazzo) => {
    const impronta = improntaDelMazzo(mazzo);
    if (visti.has(impronta)) return false;
    visti.add(impronta);
    return true;
  });

  // Purezza in giù; a parità di purezza, il più forte per primo — così che il
  // gemello più debole cada subito dopo, come un dominato qualunque.
  const ordinati = [...distinti].sort((a, b) => b.purezza - a.purezza || b.potenza - a.potenza);

  const frontiera: MazzoCostruito[] = [];
  for (const mazzo of ordinati) {
    const prima = frontiera[frontiera.length - 1];
    if (prima === undefined) {
      frontiera.push(mazzo);
      continue;
    }
    if (mazzo.potenza <= prima.potenza + PARI) continue;
    frontiera.push({
      ...mazzo,
      passo: {
        purezzaCeduta: prima.purezza - mazzo.purezza,
        potenzaGuadagnata: mazzo.potenza - prima.potenza,
      },
    });
  }
  return frontiera;
}

/** Due mazzi sono lo stesso mazzo quando hanno le stesse copie degli stessi nomi. */
function improntaDelMazzo(mazzo: MazzoCostruito): string {
  return [...mazzo.carte, ...mazzo.terre]
    .map((voce) => `${voce.carta.nome} × ${voce.copie}`)
    .sort()
    .join(" | ");
}

/* --- Le candidate --------------------------------------------------------- */

/**
 * Il merito di partenza di una carta: la sua qualità, più il peso del tema se
 * ci appartiene.
 *
 * È un **ordine di partenza**, non un giudizio: il giudizio lo dà il punteggio
 * del mazzo intero, che guarda curva, colori e sinergie e che una carta sola
 * non può portare. Serve a non far cominciare la ricerca da un mazzo a caso,
 * che con un tetto di tempo addosso vorrebbe dire finire su un mazzo a caso.
 */
function merito(carta: Carta, risolto: TemaRisolto, peso: number): number {
  return qualitaDiCarta(carta) + (appartiene(carta, risolto) ? peso : 0);
}

/**
 * Le candidate si scelgono **col peso di questo passo**, non una volta per
 * tutta la frontiera: col tema inviolabile le carte del tema devono entrare
 * tutte nel giro, col tema quasi ignorato devono entrarci le più forti. Un
 * elenco solo, scelto a un peso di mezzo, taglierebbe fuori proprio le carte su
 * cui i due estremi della frontiera si giocano.
 */
function scegliCandidati(
  giocabili: readonly Carta[],
  risolto: TemaRisolto,
  taratura: TaraturaDellaRicerca,
  peso: number,
): Carta[] {
  // Il merito si calcola **una volta per carta** e non dentro il confronto: un
  // ordinamento ne fa una dozzina per carta, e su quattromilaottocento carte
  // erano cinquanta millesimi di secondo per peso invece di cinque. L'ordine che
  // ne esce è lo stesso — il merito di una carta non cambia mentre si ordina.
  const conMerito = giocabili.map((carta) => ({ carta, merito: merito(carta, risolto, peso) }));
  const ordinate = conMerito
    .sort((a, b) => b.merito - a.merito || a.carta.nome.localeCompare(b.carta.nome, "en"))
    .map((voce) => voce.carta);

  // Il tetto vale se resta comunque di che riempire un mazzo: meglio una
  // ricerca lenta di una ricerca che non ha abbastanza carte per finire.
  let quante = Math.min(taratura.candidatiMassimi, ordinate.length);
  while (
    quante < ordinate.length &&
    ordinate.slice(0, quante).reduce((somma, carta) => somma + copieAlMassimo(carta), 0) <
      DIMENSIONE_MAZZO - TERRE_MINIME
  ) {
    quante += 1;
  }
  return ordinate.slice(0, quante);
}

/**
 * L'ordine con cui una partenza riempie il mazzo. La prima prende le carte
 * migliori e basta; le altre le mescolano un po', per finire in un'altra valle.
 */
function ordinaPerPartenza(
  candidati: readonly Carta[],
  risolto: TemaRisolto,
  peso: number,
  partenza: number,
  generatore: ReturnType<typeof caso>,
): Carta[] {
  if (partenza === 0) return [...candidati];
  const conRumore = candidati.map((carta) => ({
    carta,
    voto: merito(carta, risolto, peso) + generatore.frazione() * RUMORE_DELLE_PARTENZE,
  }));
  return conRumore
    .sort((a, b) => b.voto - a.voto || a.carta.nome.localeCompare(b.carta.nome, "en"))
    .map((voce) => voce.carta);
}

/* --- Il mazzo in lavorazione ---------------------------------------------- */

/**
 * Quante copie non-terra un gruppo di carte sa dare, col tetto con cui il mazzo
 * si riempie davvero: quattro per carta, **anche** per quelle che se ne
 * concedono infinite. Trentatre copie della stessa carta fanno un mazzo legale
 * che non e un mazzo, e non e da li che si costruisce.
 */
function capienzaDi(carte: readonly Carta[]): number {
  return carte.reduce((somma, carta) => somma + copieAlMassimo(carta), 0);
}

/**
 * La partenza riempita: prima i pezzi della combo, che non si contrattano, poi
 * le carte migliori dell'ordine finché i posti bastano.
 *
 * I pezzi vanno **per primi** e non in fondo: se i posti finissero prima di
 * arrivarci, il mazzo uscirebbe senza la combo che l'utente ha chiesto.
 */
function riempi(
  ordine: readonly Carta[],
  posti: number,
  obbligate: readonly Carta[] = [],
): Selezione {
  const selezione: Selezione = new Map();
  let messe = 0;
  for (const carta of obbligate) {
    const copie = Math.min(copieAlMassimo(carta), posti - messe);
    if (copie <= 0) continue;
    selezione.set(carta.nome, { carta, copie });
    messe += copie;
  }
  for (const carta of ordine) {
    if (messe >= posti) break;
    if (selezione.has(carta.nome)) continue;
    const copie = Math.min(copieAlMassimo(carta), posti - messe);
    if (copie <= 0) continue;
    selezione.set(carta.nome, { carta, copie });
    messe += copie;
  }
  return selezione;
}

function voci(selezione: Selezione): CopieDiCarta[] {
  return [...selezione.values()].map((voce) => ({ carta: voce.carta, copie: voce.copie }));
}

/**
 * I posti non-terra che questo mazzo chiede: sessanta meno le terre che la
 * curva vuole, e mai piu di quante copie il pool sa dare.
 *
 * Il tetto della capienza non e un dettaglio: senza, un pool ridotto all'osso
 * da esclusioni larghe farebbe uscire un mazzo da cinquantotto carte,
 * annunciato come se fosse a posto.
 */
function postiPerLaCurva(carte: readonly CopieDiCarta[], capienza: number): number {
  const copie = carte.reduce((somma, voce) => somma + voce.copie, 0);
  const costoMedio =
    copie === 0
      ? 0
      : carte.reduce((somma, voce) => somma + voce.carta.valoreDiMana * voce.copie, 0) / copie;
  return Math.min(capienza, DIMENSIONE_MAZZO - terreDallaCurva(costoMedio));
}

/**
 * Quanti posti non-terra ha la partenza.
 *
 * È un punto fisso e si cerca come tale — le terre dipendono dal costo medio,
 * che dipende da quante carte ci stanno — e i giri si contano: due o tre bastano
 * sempre, e se una volta oscillasse ci si ferma con l'ultima risposta invece di
 * girare per sempre.
 */
function assestaIPosti(
  ordine: readonly Carta[],
  capienza: number,
  obbligate: readonly Carta[] = [],
): number {
  let posti = Math.min(capienza, DIMENSIONE_MAZZO - TERRE_MINIME);
  for (let giro = 0; giro < 5; giro++) {
    const nuovi = postiPerLaCurva(voci(riempi(ordine, posti, obbligate)), capienza);
    if (nuovi === posti) break;
    posti = nuovi;
  }
  return posti;
}

/**
 * Il mazzo portato a un altro numero di posti, senza rifarlo da capo.
 *
 * Si toglie dalle carte peggiori dell'ordine di partenza e si aggiunge alle
 * migliori: e lo stesso criterio con cui la partenza era stata riempita, e non
 * e un giudizio finale — il giudizio lo dà il punteggio, e la passata dopo
 * rimette mano a queste copie come a tutte le altre.
 */
function adatta(
  selezione: Selezione,
  ordine: readonly Carta[],
  posti: number,
  obbligate: ReadonlySet<string> = new Set(),
): Selezione {
  const dopo: Selezione = new Map(selezione);
  let copie = [...dopo.values()].reduce((somma, voce) => somma + voce.copie, 0);

  for (let i = ordine.length - 1; i >= 0 && copie > posti; i--) {
    const carta = ordine[i]!;
    // I pezzi della combo non pagano il conto delle terre: sono la ragione per
    // cui questo mazzo esiste.
    if (obbligate.has(carta.nome)) continue;
    const dentro = dopo.get(carta.nome);
    if (dentro === undefined) continue;
    const via = Math.min(dentro.copie, copie - posti);
    if (dentro.copie === via) dopo.delete(carta.nome);
    else dopo.set(carta.nome, { carta: dentro.carta, copie: dentro.copie - via });
    copie -= via;
  }

  for (const carta of ordine) {
    if (copie >= posti) break;
    const gia = dopo.get(carta.nome)?.copie ?? 0;
    const ancora = Math.min(copieAlMassimo(carta) - gia, posti - copie);
    if (ancora <= 0) continue;
    dopo.set(carta.nome, { carta, copie: gia + ancora });
    copie += ancora;
  }

  return dopo;
}

/* --- Gli scambi ----------------------------------------------------------- */

type Scambio = { fuori: string; dentro: Carta };

/**
 * Gli scambi da provare, in ordine mescolato dal generatore della partenza.
 *
 * Mescolato e non ordinato per merito: la ricerca tiene il **primo**
 * miglioramento che trova, e provare sempre nello stesso ordine vorrebbe dire
 * guardare sempre le stesse carte prima delle altre. L'ordine è comunque
 * deterministico, perché il generatore lo è.
 */
function scambi(
  selezione: Selezione,
  candidati: readonly Carta[],
  generatore: ReturnType<typeof caso>,
  obbligate: ReadonlySet<string> = new Set(),
): Scambio[] {
  const tutti: Scambio[] = [];
  for (const fuori of selezione.keys()) {
    // Un pezzo dichiarato non esce mai dal mazzo, nemmeno se il punteggio
    // salirebbe: l'app non giudica la combo, ci crede.
    if (obbligate.has(fuori)) continue;
    for (const dentro of candidati) {
      if (dentro.nome === fuori) continue;
      // E non ci **entra** nemmeno: al massimo delle copie ci è già, e le
      // poche carte che se ne concedono infinite potrebbero altrimenti
      // salirci sopra senza che niente le rimetta giù — `adatta` non le
      // tocca — fino a sfondare i sessanta.
      if (obbligate.has(dentro.nome)) continue;
      tutti.push({ fuori, dentro });
    }
  }
  // Fisher-Yates con il generatore della partenza: la stessa mescolata a ogni
  // esecuzione, e una diversa a ogni giro.
  for (let i = tutti.length - 1; i > 0; i--) {
    const j = generatore.intero(i + 1);
    const scambio = tutti[i]!;
    tutti[i] = tutti[j]!;
    tutti[j] = scambio;
  }
  return tutti;
}

/**
 * Il mazzo con una copia in meno di una carta e una in più di un'altra, oppure
 * `null` se lo scambio non si può fare — la carta che entra è già al suo tetto
 * di copie, e quel tetto lo dice la carta, non il codice (`mazzo/copie.ts`).
 */
function conLoScambio(selezione: Selezione, scambio: Scambio): Selezione | null {
  const esce = selezione.get(scambio.fuori);
  if (esce === undefined) return null;

  const gia = selezione.get(scambio.dentro.nome)?.copie ?? 0;
  if (gia + 1 > copieMassime(scambio.dentro)) return null;

  const dopo: Selezione = new Map(selezione);
  if (esce.copie === 1) dopo.delete(scambio.fuori);
  else dopo.set(scambio.fuori, { carta: esce.carta, copie: esce.copie - 1 });
  dopo.set(scambio.dentro.nome, { carta: scambio.dentro, copie: gia + 1 });
  return dopo;
}
