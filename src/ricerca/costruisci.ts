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
 * `costruisciMazzo(richiesta, pool) → frontiera`. A questo ticket la frontiera
 * contiene un mazzo solo; i quattro o cinque allineati da puro a forte
 * arriveranno dal ticket 12, facendo scorrere il peso della purezza.
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
import type { Carta } from "../dati/pool.js";
import { terreDallaCurva, type BaseDiTerre, type CopieDiCarta } from "../mazzo/base-di-terre.js";
import { copieMassime } from "../mazzo/copie.js";
import type { EsitoDellaSimulazione } from "../mazzo/simulazione.js";
import { COPIE_MASSIME, DIMENSIONE_MAZZO, TERRE_MINIME } from "../mazzo/taratura.js";
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
  /** Il seme del caso: senza, niente di quel che segue è verificabile. */
  seme: number;
  /** Il tetto di tempo, perché la ricerca gira sul telefono. */
  tempoMassimoMs: number;
  formato: "standard";
};

/** Quel che la ricerca racconta di sé mentre lavora, per chi mostra una barra. */
export type Avanzamento = {
  /** La partenza in corso, contata da zero. */
  partenza: number;
  partenze: number;
  /** I mazzi provati finora, da tutte le partenze insieme. */
  valutazioni: number;
  /** Il punteggio del migliore trovato finora: sale e non scende mai. */
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
   * Il numero solo con cui la ricerca ha ordinato i mazzi: le cinque componenti
   * combinate più la purezza per il suo peso. Sta qui perché sia verificabile,
   * non perché si mostri — quel che si mostra sono le componenti.
   */
  totale: number;
};

export type Frontiera = {
  esito: Esito;
  /** La frase che dice l'esito, riempita di numeri veri e mai inventata. */
  motivo: string;
  /** Il verdetto sul tema, lo stesso che la schermata dei vincoli ha mostrato. */
  ampiezza: Ampiezza;
  /** A questo ticket, zero mazzi o uno solo. */
  mazzi: MazzoCostruito[];
  allargamentiApplicati: readonly Allargamento[];
  troncataPerTempo: boolean;
  /** Le partenze provate: la ricerca si rifà da più parti e tiene la migliore. */
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

  const niente = (esito: Esito, motivo: string): Frontiera => ({
    esito,
    motivo,
    ampiezza,
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
  const candidati = scegliCandidati(giocabili, risolto, taratura);

  /* --- La ricerca ------------------------------------------------------- */

  const semi = caso(richiesta.seme);
  let scambiProvati = 0;
  let scambiTenuti = 0;
  let valutazioni = 0;
  let troncata = false;
  let migliore: { selezione: Selezione; posti: number; totale: number } | null = null;

  const valuta = (selezione: Selezione, posti: number): number => {
    valutazioni += 1;
    return punteggioDi(selezione, posti, taratura.partiteInRicerca).totale;
  };

  const punteggioDi = (selezione: Selezione, posti: number, partite: number | undefined) => {
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
    return {
      carte,
      valutato,
      purezza: pura,
      totale: combina(valutato.punteggio) + taratura.pesoDellaPurezza * pura,
    };
  };

  for (let partenza = 0; partenza < taratura.partenze; partenza++) {
    // Ogni partenza ha il suo generatore, derivato dal seme della richiesta:
    // partenze diverse, ma nessuna casuale.
    const generatore = caso(semi.intero(0x100000000));
    const ordine = ordinaPerPartenza(candidati, risolto, taratura, partenza, generatore);
    // I posti non-terra non sono liberi: sono sessanta meno le terre che la
    // curva chiede, e non possono superare le copie che il pool sa dare.
    let posti = assestaIPosti(ordine, capienza);
    let selezione = riempi(ordine, posti);

    // La prima valutazione si fa **sempre**, anche col tempo già scaduto: senza
    // di lei non ci sarebbe nessun mazzo da restituire, e restituire un mazzo
    // c'è scritto nel ticket.
    let corrente = valuta(selezione, posti);
    if (migliore === null || corrente > migliore.totale + PARI) {
      migliore = { selezione, posti, totale: corrente };
    }
    opzioni.avanzamento?.({
      partenza,
      partenze: taratura.partenze,
      valutazioni,
      migliore: migliore.totale,
    });

    if (scaduto()) {
      troncata = true;
      break;
    }

    let valutazioniQui = 1;
    let assestamenti = 0;
    let migliorato = true;
    while (migliorato) {
      migliorato = false;
      for (const scambio of scambi(selezione, candidati, generatore)) {
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
          opzioni.avanzamento?.({
            partenza,
            partenze: taratura.partenze,
            valutazioni,
            migliore: migliore.totale,
          });
          // Primo miglioramento: si riparte a guardare gli scambi dal mazzo
          // nuovo, invece di finire un giro su un mazzo che non c'è più.
          break;
        }
      }
      if (troncata || valutazioniQui >= taratura.valutazioniMassimePerPartenza) break;

      // Quando nessuno scambio migliora più, le terre tornano a seguire la
      // curva, e se cambiano la ricerca riprende sul mazzo nuovo.
      //
      // Si fa **qui** e non dentro la passata di proposito: durante la passata
      // la base non si tocca, se no quel che si misura fra due mazzi è il
      // cambio di terre e non il cambio di carte. Ma un mazzo che ha finito di
      // migliorare e che nel frattempo ha spostato il suo costo medio vuole un
      // altro numero di terre, e consegnarlo con quelle vecchie vorrebbe dire
      // consegnare un mazzo che l'app stessa direbbe sbagliato.
      if (migliorato || assestamenti >= ASSESTAMENTI_PER_PARTENZA) continue;
      const nuoviPosti = postiPerLaCurva(voci(selezione), capienza);
      if (nuoviPosti === posti) break;
      assestamenti += 1;
      selezione = adatta(selezione, ordine, nuoviPosti);
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
  if (migliore === null) {
    return niente("niente-da-costruire", "La ricerca non ha potuto provare nemmeno un mazzo.");
  }

  // Il mazzo che vince si rivaluta **per intero**, con le partite piene: i
  // numeri che l'utente legge non sono quelli sbrigativi della ricerca.
  const finale = punteggioDi(migliore.selezione, migliore.posti, undefined);
  const nelTema = finale.carte.filter((voce) => appartiene(voce.carta, risolto));
  const copieNelTema = nelTema.reduce((somma, voce) => somma + voce.copie, 0);
  const copieTotali = finale.carte.reduce((somma, voce) => somma + voce.copie, 0);
  // Le terre si contano da quelle **scelte**, non da quante se ne erano
  // chieste: la frase deve dire il mazzo che c'è, non quello che si sperava.
  const copieDiTerra = finale.valutato.base.terre.reduce((somma, voce) => somma + voce.copie, 0);

  // Il tema bastava a riempire **questo** mazzo? La domanda si fa sui posti
  // che il mazzo ha davvero, non sui trentatre del verdetto di `ampiezza.ts`,
  // che prende il caso piu favorevole al tema e risponde a un'altra domanda.
  const capienzaDelTema = capienzaDi(giocabili.filter((carta) => appartiene(carta, risolto)));
  const fuoriTema = capienzaDelTema < copieTotali;
  const esito: Esito = fuoriTema ? "costruito-fuori-tema" : "costruito";
  const motivo = fuoriTema
    ? `Il tema prende ${ampiezza.carteDisponibili} carte dal pool, buone per ${capienzaDelTema} posti sui ${copieTotali} da riempire: il mazzo è stato completato con carte fuori tema.`
    : `${copieTotali + copieDiTerra} carte, di cui ${copieDiTerra} terre: ${copieNelTema} delle ${copieTotali} carte non-terra sono del tema.`;

  return {
    esito,
    motivo,
    ampiezza,
    mazzi: [
      {
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
        totale: finale.totale,
      },
    ],
    allargamentiApplicati: tema.allargamenti,
    troncataPerTempo: troncata,
    partenze: taratura.partenze,
    scambiProvati,
    scambiTenuti,
  };
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
function merito(carta: Carta, risolto: TemaRisolto, taratura: TaraturaDellaRicerca): number {
  return qualitaDiCarta(carta) + (appartiene(carta, risolto) ? taratura.pesoDellaPurezza : 0);
}

function scegliCandidati(
  giocabili: readonly Carta[],
  risolto: TemaRisolto,
  taratura: TaraturaDellaRicerca,
): Carta[] {
  const ordinate = [...giocabili].sort(
    (a, b) =>
      merito(b, risolto, taratura) - merito(a, risolto, taratura) ||
      a.nome.localeCompare(b.nome, "en"),
  );

  // Il tetto vale se resta comunque di che riempire un mazzo: meglio una
  // ricerca lenta di una ricerca che non ha abbastanza carte per finire.
  let quante = Math.min(taratura.candidatiMassimi, ordinate.length);
  while (
    quante < ordinate.length &&
    ordinate.slice(0, quante).reduce((somma, carta) => somma + Math.min(copieMassime(carta), COPIE_MASSIME), 0) <
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
  taratura: TaraturaDellaRicerca,
  partenza: number,
  generatore: ReturnType<typeof caso>,
): Carta[] {
  if (partenza === 0) return [...candidati];
  const conRumore = candidati.map((carta) => ({
    carta,
    voto: merito(carta, risolto, taratura) + generatore.frazione() * RUMORE_DELLE_PARTENZE,
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
  return carte.reduce((somma, carta) => somma + copieDiPartenza(carta), 0);
}

/** Le copie di una carta che una **partenza** si concede: mai oltre le quattro. */
function copieDiPartenza(carta: Carta): number {
  return Math.min(copieMassime(carta), COPIE_MASSIME);
}

function riempi(ordine: readonly Carta[], posti: number): Selezione {
  const selezione: Selezione = new Map();
  let messe = 0;
  for (const carta of ordine) {
    if (messe >= posti) break;
    const copie = Math.min(copieDiPartenza(carta), posti - messe);
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
function assestaIPosti(ordine: readonly Carta[], capienza: number): number {
  let posti = Math.min(capienza, DIMENSIONE_MAZZO - TERRE_MINIME);
  for (let giro = 0; giro < 5; giro++) {
    const nuovi = postiPerLaCurva(voci(riempi(ordine, posti)), capienza);
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
function adatta(selezione: Selezione, ordine: readonly Carta[], posti: number): Selezione {
  const dopo: Selezione = new Map(selezione);
  let copie = [...dopo.values()].reduce((somma, voce) => somma + voce.copie, 0);

  for (let i = ordine.length - 1; i >= 0 && copie > posti; i--) {
    const carta = ordine[i]!;
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
    const ancora = Math.min(copieDiPartenza(carta) - gia, posti - copie);
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
): Scambio[] {
  const tutti: Scambio[] = [];
  for (const fuori of selezione.keys()) {
    for (const dentro of candidati) {
      if (dentro.nome === fuori) continue;
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
