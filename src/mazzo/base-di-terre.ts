/**
 * La base di terre di un mazzo, e le probabilità reali che ne discendono.
 *
 * È la cucitura della schermata «Mazzo» (ticket 06): si dà il gruppo di carte
 * non-terra che l'utente ha messo insieme a mano, e si riceve **quante** terre
 * servono, **quali**, e per ogni carta la probabilità di poterla lanciare al
 * suo turno con quella base. Funzione pura: niente rete, niente orologio,
 * niente caso. Stesso mazzo, stessi numeri.
 *
 * Le tre decisioni che prende, tutte con i numeri in chiaro:
 *
 * 1. **Quante terre** — dalla curva del mazzo, non da una tabella per
 *    archetipo (`taratura.ts`).
 * 2. **Quali terre** — le terre a due colori legali che producono i colori
 *    chiesti, con una penalità dichiarata per quelle che entrano girate; poi le
 *    **terre di utilità**, quelle che fanno qualcosa invece che i colori; il
 *    resto in terre base, divise secondo quanto ogni colore è chiesto.
 * 3. **Le probabilità** — calcolate in `probabilita.ts`, non stimate.
 *
 * ## Le terre di utilità
 *
 * Su questo formato una fetta delle terre non fa colori: fa altro — picchia,
 * previene un danno, distrugge la terra dell'avversario. Fino al ticket 08
 * nessuna di quelle poteva entrare in un mazzo per nessuna strada, e un motore
 * che non le sa mettere costruisce mazzi legali e sbagliati.
 *
 * Entrano di qui, e non dalla porta degli incantesimi, perché sono terre: sono
 * la terra che si cala al proprio turno, e chi sceglie le terre è questo
 * modulo. **Quali** entrino non lo decide un elenco di nomi — sarebbe verità di
 * formato nel sorgente (`CLAUDE.md`) — ma i tag di sinergia che la carta porta:
 * una terra entra se fa qualcosa che il mazzo già fa **in abbastanza copie**.
 * Le copie contano, e non le carte: una terra di utilità costa un posto alla
 * base di mana, e una carta sola che per caso porti quel tag non lo paga.
 *
 * Una terra che non porta nessun tag non entra: l'app non legge il testo delle
 * carte (ADR-0002), e di quella terra non sa dire niente. È un silenzio onesto,
 * non una svista.
 */

import type { Carta, ColoreMana, Tag } from "../dati/pool.js";
import { copieAlMassimo } from "./copie.js";
import { simboliDiColore } from "./costo.js";
import { probabilitaDiLanciare, type GruppoDiTerre, type Pip } from "./probabilita.js";
import { prezzoDelMazzo, prezzoDiUnaCopia } from "./spesa.js";
import {
  COPIE_MINIME_PER_UNA_TERRA_DI_UTILITA,
  DIMENSIONE_MAZZO,
  PENALITA_ENTRA_GIRATA,
  PENALITA_ENTRA_GIRATA_A_VOLTE,
  PERDITA_MASSIMA_PER_I_COLORI,
  TERRE_A_COSTO_ZERO,
  TERRE_DI_UTILITA_MASSIME,
  TERRE_MASSIME,
  TERRE_MINIME,
  TERRE_NON_BASE_PER_COLORE_IN_PIU,
  TERRE_PER_COSTO_MEDIO,
  TERRE_SENZA_MANA_MASSIME,
} from "./taratura.js";

/** Una carta e quante copie ne stanno nel mazzo. */
export type CopieDiCarta = { carta: Carta; copie: number };

export type Opzioni = {
  /** Quante terre vuole l'utente; `null` per lasciar decidere alla curva. */
  terreVolute: number | null;
  /**
   * Quanti euro la base può spendere; `null` quando il tetto di spesa è spento.
   *
   * Obbligatorio e non facoltativo, di proposito: la base è una voce di spesa
   * grossa — su questo pool trentadue terre su trentasette non sono base — e
   * ogni schermata che la chiede deve **dire** se un tetto c'è. Un campo che si
   * può omettere si omette, e il tetto di ieri resta appiccicato al mazzo di
   * oggi senza che nessuno lo veda.
   *
   * `null` non è «zero»: è «nessuno ha chiesto un tetto», e allora la base
   * sceglie come ha sempre scelto, senza guardare il prezzo.
   */
  budget: number | null;
};

/**
 * Una copia che il budget ha tolto alla base, e quanto ha liberato togliendola.
 *
 * Esiste perché l'app lo deve **dire**: quando il tetto costa al mazzo una
 * terra che avrebbe voluto, il giocatore ha diritto di sapere quale e quanto,
 * o legge una base peggiore senza sapere perché (ticket 20). Sono numeri, e le
 * frasi le compone chi mostra.
 */
export type RinunciaDelBudget = {
  carta: Carta;
  /** Quante copie di questa terra il budget ha tolto. */
  copie: number;
  /** Quanto costavano quelle copie: è il numero che rende la frase verificabile. */
  euro: number;
};

/** Quanto un colore è chiesto dal mazzo, in simboli contati sulle copie vere. */
export type RichiestaDiColore = { colore: ColoreMana; simboli: number; fonti: number };

/** Una carta del mazzo con la sua probabilità di partire al turno giusto. */
export type RigaDelMazzo = {
  carta: Carta;
  copie: number;
  /** Il turno a cui si prova a lanciarla: il suo valore di mana. */
  turno: number;
  probabilita: number;
  /**
   * La stessa probabilità per una carta che costasse lo stesso **senza simboli
   * colorati**: è il tetto che il numero di terre da solo permette, e la
   * distanza fra i due numeri è quanto costano i colori.
   */
  probabilitaSenzaColori: number;
  /**
   * Vera quando i colori costano più di quanto `taratura.ts` dichiari
   * accettabile: è la carta che questa **base** non regge, distinta da quella
   * che costa semplicemente tanto.
   */
  difficile: boolean;
};

export type BaseDiTerre = {
  /** Le terre effettivamente messe, a mano o dalla curva. */
  numeroTerre: number;
  /** Quante ne direbbe la curva: resta in vista anche quando si scavalca. */
  numeroTerreDallaCurva: number;
  /** Il costo medio delle carte non-terra, che è ciò da cui viene il numero. */
  costoMedio: number;
  terre: CopieDiCarta[];
  copieNonTerra: number;
  dimensioneMazzo: number;
  coloriRichiesti: RichiestaDiColore[];
  /**
   * Le terre di utilità che ci sono finite: quelle che la base ha preso **per
   * quel che fanno**, non per i colori che danno.
   *
   * È quel che il passo dell'utilità ha aggiunto, meno quel che il budget gli ha
   * tolto — e non un conto rifatto col predicato su tutte le terre scelte. Una
   * terra doppia presa per i suoi colori, che per caso porta anche un tag, non è
   * una terra che il mazzo ha scelto per il tag, e contarla lì farebbe superare
   * al numero il tetto che `taratura.ts` gli dichiara (ticket 17).
   */
  terreDiUtilita: number;
  /**
   * Di quelle, quante non fanno mana affatto: sono posti che non lanciano.
   *
   * «Di quelle» alla lettera: si legge dalla stessa scelta di `terreDiUtilita`,
   * così il sottoinsieme è una proprietà della struttura e non un caso che
   * regge finché nessuno tocca i predicati.
   */
  terreSenzaMana: number;
  terreCheEntranoGirate: number;
  /** Di quelle girate, quante entrano girate **solo a certe condizioni**. */
  terreGirateSoloAVolte: number;
  /**
   * Le copie che il budget ha tolto. Vuota quando il budget non ha morso, e
   * vuota sempre quando è `null`: senza tetto non c'è niente a cui rinunciare.
   */
  rinunceDelBudget: RinunciaDelBudget[];
  righe: RigaDelMazzo[];
  /** Le righe difficili, dalla più difficile in giù: l'avviso all'utente. */
  difficili: RigaDelMazzo[];
};

/** L'ordine dei colori è quello delle carte, non l'alfabeto. */
const ORDINE_COLORI: readonly ColoreMana[] = ["W", "U", "B", "R", "G", "C"];

export function analizzaBaseDiTerre(
  mazzo: readonly CopieDiCarta[],
  terreDelPool: readonly Carta[],
  opzioni: Opzioni,
): BaseDiTerre {
  // Le terre non entrano nel conto delle carte da lanciare: la base la sceglie
  // l'app, ed è il senso di questa schermata.
  const nonTerre = mazzo.filter((voce) => voce.carta.terra === null && voce.copie > 0);
  const copieNonTerra = nonTerre.reduce((somma, voce) => somma + voce.copie, 0);

  const costoMedio =
    copieNonTerra === 0
      ? 0
      : nonTerre.reduce((somma, voce) => somma + voce.carta.valoreDiMana * voce.copie, 0) /
        copieNonTerra;

  const numeroTerreDallaCurva = terreDallaCurva(costoMedio);
  const numeroTerre =
    opzioni.terreVolute === null
      ? numeroTerreDallaCurva
      : Math.max(0, Math.min(DIMENSIONE_MAZZO, Math.round(opzioni.terreVolute)));

  const simboliPerCarta = new Map<Carta, Pip[]>();
  const simboliPerColore = new Map<ColoreMana, number>();
  for (const voce of nonTerre) {
    const pips = simboliDiColore(voce.carta.costoDiMana);
    simboliPerCarta.set(voce.carta, pips);
    for (const pip of pips) {
      // Un simbolo ibrido chiede l'uno **o** l'altro: pesa su entrambi i
      // colori, ma per metà ciascuno, così non gonfia la richiesta.
      for (const colore of pip) {
        simboliPerColore.set(
          colore,
          (simboliPerColore.get(colore) ?? 0) + voce.copie / pip.length,
        );
      }
    }
  }

  const coloriRichiesti = [...simboliPerColore.entries()]
    .filter(([, simboli]) => simboli > 0)
    .sort(
      ([coloreA, a], [coloreB, b]) =>
        b - a || ORDINE_COLORI.indexOf(coloreA) - ORDINE_COLORI.indexOf(coloreB),
    )
    .map(([colore]) => colore);

  // Quel che il mazzo **fa**, carta per carta: è con questo che si scelgono le
  // terre di utilità, e non con un elenco di nomi. Si tiene la carta e non la
  // somma per tag, perché una carta che porta due tag della terra resta una
  // carta sola e va contata una volta (ticket 16).
  const carteConTag = new Map<Tag, CopieDiCarta[]>();
  for (const voce of nonTerre) {
    for (const tag of voce.carta.tag) {
      const gia = carteConTag.get(tag);
      if (gia) gia.push(voce);
      else carteConTag.set(tag, [voce]);
    }
  }

  const { terre, rinunceDelBudget, terreDiUtilita, terreSenzaMana } = scegliTerre(
    terreDelPool,
    coloriRichiesti,
    simboliPerColore,
    numeroTerre,
    carteConTag,
    opzioni.budget,
  );
  const gruppi = raggruppa(terre, coloriRichiesti);

  const dimensioneMazzo = Math.max(DIMENSIONE_MAZZO, copieNonTerra + numeroTerre);

  // Due carte con lo stesso costo hanno la stessa probabilità: il conto è
  // pesante e non va rifatto per ognuna.
  const gia = new Map<string, number>();
  const conto = (pips: readonly Pip[], valoreDiMana: number, turno: number): number => {
    const chiave = `${valoreDiMana}|${turno}|${pips.map((pip) => pip.join("/")).join(",")}`;
    let probabilita = gia.get(chiave);
    if (probabilita === undefined) {
      probabilita = probabilitaDiLanciare({
        dimensioneMazzo,
        terre: gruppi,
        pips,
        valoreDiMana,
        turno,
      });
      gia.set(chiave, probabilita);
    }
    return probabilita;
  };

  const righe: RigaDelMazzo[] = nonTerre.map((voce) => {
    const turno = Math.max(1, voce.carta.valoreDiMana);
    const pips = simboliPerCarta.get(voce.carta) ?? [];
    const probabilita = conto(pips, voce.carta.valoreDiMana, turno);
    // Lo stesso costo senza simboli colorati: è quel che il solo numero di
    // terre concede, e serve a separare «i colori non ci sono» da «questa carta
    // costa tanto», che sono due problemi diversi con due rimedi diversi.
    const probabilitaSenzaColori = conto([], voce.carta.valoreDiMana, turno);
    return {
      carta: voce.carta,
      copie: voce.copie,
      turno,
      probabilita,
      probabilitaSenzaColori,
      difficile: probabilitaSenzaColori - probabilita > PERDITA_MASSIMA_PER_I_COLORI,
    };
  });

  const fontiPerColore = new Map<ColoreMana, number>();
  for (const voce of terre) {
    for (const colore of voce.carta.terra?.coloriProdotti ?? []) {
      fontiPerColore.set(colore, (fontiPerColore.get(colore) ?? 0) + voce.copie);
    }
  }

  return {
    numeroTerre,
    numeroTerreDallaCurva,
    costoMedio,
    terre,
    copieNonTerra,
    dimensioneMazzo,
    coloriRichiesti: coloriRichiesti.map((colore) => ({
      colore,
      simboli: simboliPerColore.get(colore) ?? 0,
      fonti: fontiPerColore.get(colore) ?? 0,
    })),
    terreDiUtilita,
    terreSenzaMana,
    terreCheEntranoGirate: terre
      .filter((voce) => voce.carta.terra?.entraGirata === true)
      .reduce((somma, voce) => somma + voce.copie, 0),
    terreGirateSoloAVolte: terre
      .filter((voce) => voce.carta.terra?.condizione != null)
      .reduce((somma, voce) => somma + voce.copie, 0),
    rinunceDelBudget,
    righe,
    difficili: righe
      .filter((riga) => riga.difficile)
      .sort((a, b) => a.probabilita - b.probabilita),
  };
}

/**
 * Quante terre, dalla curva. Nessuna tabella per archetipo: il costo medio del
 * mazzo è l'unica cosa che entra nel conto, e i tre numeri che lo governano
 * stanno tutti in `taratura.ts`.
 */
export function terreDallaCurva(costoMedio: number): number {
  const grezzo = TERRE_A_COSTO_ZERO + TERRE_PER_COSTO_MEDIO * costoMedio;
  return Math.max(TERRE_MINIME, Math.min(TERRE_MASSIME, Math.round(grezzo)));
}

/**
 * La scelta delle terre: prima quelle a due colori che il mazzo chiede davvero,
 * poi le terre base a riempire.
 */
function scegliTerre(
  terreDelPool: readonly Carta[],
  coloriRichiesti: readonly ColoreMana[],
  simboliPerColore: ReadonlyMap<ColoreMana, number>,
  numeroTerre: number,
  carteConTag: ReadonlyMap<Tag, readonly CopieDiCarta[]>,
  budget: number | null,
): {
  terre: CopieDiCarta[];
  rinunceDelBudget: RinunciaDelBudget[];
  terreDiUtilita: number;
  terreSenzaMana: number;
} {
  const niente = {
    terre: [] as CopieDiCarta[],
    rinunceDelBudget: [] as RinunciaDelBudget[],
    terreDiUtilita: 0,
    terreSenzaMana: 0,
  };
  if (numeroTerre <= 0) return niente;

  const base = new Map<ColoreMana, Carta>();
  for (const carta of terreDelPool) {
    const terra = carta.terra;
    if (terra === null || !carta.tipi.includes("Basic")) continue;
    if (terra.coloriProdotti.length !== 1) continue;
    const colore = terra.coloriProdotti[0]!;
    if (!base.has(colore)) base.set(colore, carta);
  }

  // Un mazzo senza nessun simbolo colorato (o un mazzo ancora vuoto) non ha un
  // colore da servire: gli si dà la terra incolore, o la prima base che c'è.
  const coloriDaServire =
    coloriRichiesti.length > 0
      ? coloriRichiesti
      : base.has("C")
        ? (["C"] as ColoreMana[])
        : [...base.keys()].slice(0, 1);
  if (coloriDaServire.length === 0) return niente;

  // Le terre base esistono per tutti e sei i colori, ma il pool arriva dai dati
  // e i dati possono sempre sorprendere. I colori che una terra base non ce
  // l'hanno restano ai duali: quel che conta è non restituire **meno** terre di
  // quante se ne sono promesse, che sarebbe una bugia nei numeri.
  const coloriConBase = coloriDaServire.filter((colore) => base.has(colore));
  const perRiempire =
    coloriConBase.length > 0 ? coloriConBase : [...base.keys()].slice(0, 1);
  if (perRiempire.length === 0) return niente;

  const scelte: CopieDiCarta[] = [];
  let restanti = numeroTerre;

  // 1. Le terre a due colori. Il tetto è dichiarato: nessuna per un mazzo di un
  //    colore solo, poi tanti posti per ogni colore in più. Si lascia comunque
  //    almeno una terra base per colore, altrimenti la base non farebbe i suoi
  //    stessi colori nei casi limite.
  const tetto = Math.max(
    0,
    Math.min(
      (coloriDaServire.length - 1) * TERRE_NON_BASE_PER_COLORE_IN_PIU,
      numeroTerre - perRiempire.length,
    ),
  );

  if (tetto > 0) {
    const candidate = terreDelPool
      .filter((carta) => utileComeTerraDoppia(carta, coloriDaServire))
      .map((carta) => ({ carta, punteggio: punteggioTerra(carta, coloriDaServire) }))
      .sort(
        (a, b) =>
          b.punteggio - a.punteggio ||
          prezzo(a.carta) - prezzo(b.carta) ||
          a.carta.nome.localeCompare(b.carta.nome, "en"),
      );

    let messe = 0;
    for (const { carta } of candidate) {
      if (messe >= tetto) break;
      // Quante copie ne stanno lo dice la carta, come dappertutto — ma mai
      // oltre le quattro, per la stessa ragione per cui non ci va oltre una
      // partenza della ricerca (`costruisci.ts`): una base fatta di dodici
      // copie della stessa terra doppia è una base legale che non è una base.
      const quante = Math.min(
        copieAlMassimo(carta),
        tetto - messe,
        restanti - perRiempire.length,
      );
      if (quante <= 0) break;
      scelte.push({ carta, copie: quante });
      messe += quante;
      restanti -= quante;
    }
  }

  // 2. Le terre di utilità: quelle che non servono a fare colori ma a fare
  //    qualcosa che il mazzo già fa, **in abbastanza copie** da essere un tema
  //    e non un caso. Il budget è dichiarato e **non** dipende dai colori, se no
  //    un mazzo monocolore non ne vedrebbe mai una.
  const presi = new Set(scelte.map((voce) => voce.carta.nome));
  /**
   * I nomi che **questo passo** aggiunge, e da cui si legge poi il numero
   * dichiarato. Sono disgiunti da quelli del passo dei colori (`presi` li
   * esclude) e dalle terre base del passo finale, che un tag non ce l'hanno.
   */
  const nomiDiUtilita = new Set<string>();
  const tettoUtilita = Math.max(
    0,
    Math.min(TERRE_DI_UTILITA_MASSIME, restanti - perRiempire.length),
  );

  if (tettoUtilita > 0) {
    const utili = terreDelPool
      .filter((carta) => !presi.has(carta.nome) && terraDiUtilita(carta))
      .filter((carta) => identitaDentro(carta, coloriDaServire))
      .map((carta) => ({ carta, condivisi: copieCheFannoLaStessaCosa(carta, carteConTag) }))
      .filter(({ condivisi }) => condivisi >= COPIE_MINIME_PER_UNA_TERRA_DI_UTILITA)
      .sort(
        (a, b) =>
          b.condivisi - a.condivisi ||
          // A pari sinergia si preferisce la terra che **fa anche mana**: l'altra
          // costa al mazzo un posto che non lancia niente.
          faMana(b.carta) - faMana(a.carta) ||
          prezzo(a.carta) - prezzo(b.carta) ||
          a.carta.nome.localeCompare(b.carta.nome, "en"),
      );

    let messe = 0;
    let senzaMana = 0;
    for (const { carta } of utili) {
      if (messe >= tettoUtilita) break;
      const spazioSenzaMana =
        faMana(carta) === 1 ? Number.POSITIVE_INFINITY : TERRE_SENZA_MANA_MASSIME - senzaMana;
      const quante = Math.min(
        copieAlMassimo(carta),
        tettoUtilita - messe,
        spazioSenzaMana,
        restanti - perRiempire.length,
      );
      if (quante <= 0) continue;
      scelte.push({ carta, copie: quante });
      nomiDiUtilita.add(carta.nome);
      messe += quante;
      restanti -= quante;
      if (faMana(carta) === 0) senzaMana += quante;
    }
  }

  // 3. Il budget, quando c'è: si scende finché la base ci sta. Sta **qui** e
  //    non dentro i due passi di sopra perché la scelta va fatta fra tutte le
  //    terre insieme — è la decisione del ticket 20: non «prima l'utilità» né
  //    «prima i colori», ma la base più forte che sta nei soldi.
  const basi = (quante: number): CopieDiCarta[] =>
    riempiConLeBasi(quante, perRiempire, simboliPerColore, base);

  const sceso = scendiNelBudget(scelte, restanti, budget, basi);

  /** Le copie del passo 2 **sopravvissute** al budget: da qui i due numeri. */
  const dellUtilita = sceso.scelte.filter((voce) => nomiDiUtilita.has(voce.carta.nome));

  // 4. Il resto in terre base.
  return {
    terre: [...sceso.scelte, ...basi(sceso.restanti)],
    rinunceDelBudget: sceso.rinunceDelBudget,
    // Le copie del passo 2 che sono **sopravvissute** al budget. Si guardano i
    // nomi che quel passo ha dichiarato e non il predicato: rifare il predicato
    // su tutte le terre scelte conterebbe come terra di utilità una doppia
    // presa al passo 1 per i suoi colori, che per caso porta anche un tag — e
    // il numero dichiarato supererebbe il proprio tetto (ticket 17). Si legge da
    // `sceso.scelte` e non da `scelte` perché il budget può averne tolte.
    terreDiUtilita: dellUtilita.reduce((somma, voce) => somma + voce.copie, 0),
    // «Di quelle»: il fratello si legge dalla **stessa** provenienza, e non dal
    // predicato su tutte le terre. Oggi i due conti coincidono lo stesso, ma per
    // un invariante che nessuno dichiara — una terra che non fa mana non può
    // entrare dal passo dei colori, che ne chiede due, né dal passo delle basi,
    // che ne fanno una. Allentato quel predicato, «di quelle» direbbe il falso
    // senza che niente lo fermi.
    terreSenzaMana: dellUtilita
      .filter((voce) => faMana(voce.carta) === 0)
      .reduce((somma, voce) => somma + voce.copie, 0),
  };
}

/**
 * Le terre base che riempiono i posti rimasti, divise secondo quanto ogni
 * colore è chiesto.
 *
 * Il metodo del resto più grande: deterministico, e non perde né inventa terre
 * per colpa degli arrotondamenti.
 */
function riempiConLeBasi(
  restanti: number,
  perRiempire: readonly ColoreMana[],
  simboliPerColore: ReadonlyMap<ColoreMana, number>,
  base: ReadonlyMap<ColoreMana, Carta>,
): CopieDiCarta[] {
  if (restanti <= 0 || perRiempire.length === 0) return [];

  const pesi = perRiempire.map((colore) => Math.max(0, simboliPerColore.get(colore) ?? 1));
  const totalePesi = pesi.reduce((somma, peso) => somma + peso, 0);
  const quote = perRiempire.map((colore, i) => {
    const esatta =
      totalePesi > 0 ? (restanti * pesi[i]!) / totalePesi : restanti / perRiempire.length;
    return { colore, intera: Math.floor(esatta), resto: esatta - Math.floor(esatta) };
  });

  let assegnate = quote.reduce((somma, quota) => somma + quota.intera, 0);
  const perResto = [...quote].sort(
    (a, b) => b.resto - a.resto || ORDINE_COLORI.indexOf(a.colore) - ORDINE_COLORI.indexOf(b.colore),
  );
  for (let i = 0; assegnate < restanti; i = (i + 1) % perResto.length) {
    perResto[i]!.intera += 1;
    assegnate += 1;
  }

  const scelte: CopieDiCarta[] = [];
  for (const quota of quote) {
    if (quota.intera <= 0) continue;
    // `perRiempire` contiene solo colori che una terra base ce l'hanno: se
    // questa carta mancasse, le terre elencate sarebbero meno di quelle
    // promesse in cima alla schermata, e ogni probabilità sotto sarebbe
    // calcolata su un mazzo che non esiste.
    scelte.push({ carta: base.get(quota.colore)!, copie: quota.intera });
  }
  return scelte;
}

/**
 * La base scende finché sta nel budget: ogni giro se ne va **una copia**, e al
 * suo posto entra una terra base.
 *
 * ## Quale copia se ne va: quella che fa scendere di più il conto
 *
 * La decisione del ticket 20 è «la base più forte che sta nel budget», senza un
 * ordine fisso fra terre doppie e terre di utilità. Metterle in fila per forza
 * vorrebbe dire confrontare i loro punteggi, e quei punteggi **non sono sulla
 * stessa scala**: una terra doppia vale i colori utili che produce — due, tre —
 * e una di utilità vale le copie del mazzo che fanno quel che fa lei — quattro,
 * quaranta. Convertire l'una nell'altra sarebbe inventare un cambio che nessuno
 * ha misurato, ed è esattamente quel che questo progetto non fa.
 *
 * Il denaro invece è la stessa cosa per tutte e due, ed è il vincolo vero. Ma
 * **non basta togliere la copia più cara**: al suo posto entra una terra base,
 * che un prezzo ce l'ha anche lei, e su questo pool ci sono terre non base che
 * costano **meno** di ogni terra base — `Oasis` sta a 0,28 € dove l'Isola sta a
 * 0,45 €. Toglierla per far posto a un'Isola alzerebbe il conto invece di
 * abbassarlo, e la base scenderebbe di qualità pagandola di più.
 *
 * Perciò si guarda il conto **dopo**: si prova a togliere una copia per ogni
 * terra rimasta, si tiene la prova che dà il totale più basso, e se nessuna lo
 * abbassa si smette. È la stessa regola cieca alla famiglia che il committente
 * ha chiesto — decide quanto costa la copia, non a che famiglia appartiene — ma
 * misurata sul risultato invece che sul cartellino.
 *
 * Su questo pool la differenza si vede: se ne va Taiga a 470,95 € prima di una
 * terra di utilità da un euro che il mazzo usa davvero, e se ne andrebbe
 * un'utilità cara prima di una doppia da pochi centesimi.
 *
 * ## È avida, e va detto
 *
 * Cercare la base migliore che sta in una cifra è uno zaino, e uno zaino esatto
 * dentro il ciclo degli scambi non lo si paga. Questa scende un gradino per
 * volta e non promette l'ottimo: promette che la base **ci sta** se ci può
 * stare, che scendendo il conto non sale mai, e che si è perso il meno
 * possibile un passo alla volta.
 *
 * Quando nessuna rinuncia abbassa più il conto, si smette e si restituisce una
 * base intera lo stesso, anche se sopra il budget: dire di no non è compito
 * suo. La promessa dura — un mazzo sopra il tetto non si consegna — la fa la
 * ricerca, sul mazzo finito.
 */
function scendiNelBudget(
  scelte: readonly CopieDiCarta[],
  restanti: number,
  budget: number | null,
  basi: (quante: number) => CopieDiCarta[],
): { scelte: CopieDiCarta[]; restanti: number; rinunceDelBudget: RinunciaDelBudget[] } {
  const vuoto = { scelte: [...scelte], restanti, rinunceDelBudget: [] };
  if (budget === null) return vuoto;

  const rimaste = scelte.map((voce) => ({ ...voce }));
  const rinunce = new Map<string, RinunciaDelBudget>();

  for (;;) {
    const costo = prezzoDelMazzo([...rimaste, ...basi(restanti)]);
    if (costo <= budget) break;

    // Si prova a togliere una copia per ogni terra rimasta e si guarda quanto
    // verrebbe a costare la base **intera**, terra base di rimpiazzo compresa.
    // Vince la prova che costa meno; a parità se ne va quella scelta **dopo**,
    // che dentro la sua famiglia era la meno buona, e a parità di tutto il
    // nome — due giri sugli stessi dati devono dare la stessa base.
    let peggiore = -1;
    let costoDopo = costo;
    for (let i = 0; i < rimaste.length; i++) {
      const voce = rimaste[i]!;
      if (voce.copie <= 0) continue;
      voce.copie -= 1;
      const prova = prezzoDelMazzo([...rimaste, ...basi(restanti + 1)]);
      voce.copie += 1;
      if (prova < costoDopo || (prova === costoDopo && peggiore >= 0)) {
        costoDopo = prova;
        peggiore = i;
      }
    }

    // Nessuna rinuncia abbassa il conto: o non è rimasto niente da togliere, o
    // quel che resta costa meno delle terre base che lo sostituirebbero.
    // Scendere ancora vorrebbe dire pagare di più per una base peggiore.
    if (peggiore < 0) break;

    const voce = rimaste[peggiore]!;
    const euro = prezzoDiUnaCopia(voce.carta) ?? 0;
    voce.copie -= 1;
    restanti += 1;

    const gia = rinunce.get(voce.carta.nome);
    if (gia) {
      gia.copie += 1;
      gia.euro += euro;
    } else {
      rinunce.set(voce.carta.nome, { carta: voce.carta, copie: 1, euro });
    }
  }

  return {
    scelte: rimaste.filter((voce) => voce.copie > 0),
    restanti,
    // In ordine di spesa liberata, che è l'ordine in cui una frase le nomina:
    // la rinuncia che è costata di più si legge per prima.
    rinunceDelBudget: [...rinunce.values()].sort(
      (a, b) => b.euro - a.euro || a.carta.nome.localeCompare(b.carta.nome, "en"),
    ),
  };
}

/**
 * Una terra è utile come terra doppia se la sua **identità di colore** sta
 * dentro i colori del mazzo e ne produce almeno due.
 *
 * L'identità, e non i soli colori prodotti: le terre che «producono un mana di
 * un colore qualsiasi» hanno identità incolore, e nei dati risultano produrre
 * tutti e cinque i colori. Prenderle per terre doppie vorrebbe dire contarle
 * per quello che **non** sono, perché quel mana ha quasi sempre una condizione
 * che i dati non raccontano.
 */
function utileComeTerraDoppia(carta: Carta, colori: readonly ColoreMana[]): boolean {
  const terra = carta.terra;
  if (terra === null || carta.tipi.includes("Basic")) return false;
  if (carta.identitaDiColore.length < 2) return false;
  if (!carta.identitaDiColore.every((colore) => colori.includes(colore))) return false;
  return terra.coloriProdotti.filter((colore) => colori.includes(colore)).length >= 2;
}

/**
 * Una **terra di utilità**: una terra non base che porta almeno un tag di
 * sinergia, cioè che l'app sa dire che *fa* qualcosa oltre a fare mana.
 *
 * Il tag è l'unica cosa che l'app legge di una carta oltre ai suoi numeri
 * (ADR-0002), e quindi è l'unico criterio possibile che non sia un elenco di
 * nomi scritto nel sorgente. Una terra senza tag resta fuori: non è che sia
 * cattiva, è che di lei non si sa niente, e metterla sarebbe indovinare.
 */
function terraDiUtilita(carta: Carta): boolean {
  return carta.terra !== null && !carta.tipi.includes("Basic") && carta.tag.length > 0;
}

/** L'identità della carta sta dentro i colori del mazzo. Incolore sta sempre. */
function identitaDentro(carta: Carta, colori: readonly ColoreMana[]): boolean {
  return carta.identitaDiColore.every((colore) => colori.includes(colore));
}

/**
 * Quante **copie** del mazzo fanno quel che questa terra fa: è la sinergia,
 * contata e non stimata.
 *
 * Si contano le copie e non le carte, ed è la differenza fra «il mazzo gioca
 * questo tema» e «il mazzo ha una carta che per caso ce l'ha». Una terra di
 * utilità costa un posto alla base di mana, e una carta sola non lo paga: sotto
 * `COPIE_MINIME_PER_UNA_TERRA_DI_UTILITA` la terra resta fuori.
 *
 * Le carte si contano in **unione**, non tag per tag: una carta che condivide
 * due tag con la terra è pur sempre una carta, e sommarla due volte le farebbe
 * pagare da sola una soglia fatta apposta perché una carta sola non la paghi.
 */
function copieCheFannoLaStessaCosa(
  carta: Carta,
  carteConTag: ReadonlyMap<Tag, readonly CopieDiCarta[]>,
): number {
  const viste = new Set<Carta>();
  let copie = 0;
  for (const tag of carta.tag) {
    for (const voce of carteConTag.get(tag) ?? []) {
      if (viste.has(voce.carta)) continue;
      viste.add(voce.carta);
      copie += voce.copie;
    }
  }
  return copie;
}

/** Uno se la terra fa mana, zero se non ne fa affatto: si ordina con questo. */
function faMana(carta: Carta): number {
  return (carta.terra?.coloriProdotti.length ?? 0) > 0 ? 1 : 0;
}

/** I colori utili che produce, meno la penalità dichiarata per l'entrata girata. */
function punteggioTerra(carta: Carta, colori: readonly ColoreMana[]): number {
  const terra = carta.terra!;
  const utili = terra.coloriProdotti.filter((colore) => colori.includes(colore)).length;
  if (!terra.entraGirata) return utili;
  return utili - (terra.condizione === null ? PENALITA_ENTRA_GIRATA : PENALITA_ENTRA_GIRATA_A_VOLTE);
}

/** Le terre senza prezzo vanno in fondo a parità di punteggio, non in cima. */
function prezzo(carta: Carta): number {
  return carta.prezzo.euro ?? Number.POSITIVE_INFINITY;
}

/**
 * Le terre scelte, raggruppate come le vuole il calcolo: contano solo i colori
 * che il mazzo chiede davvero e se la terra entra girata.
 *
 * Le terre che entrano girate **solo a volte** contano come girate: è la
 * lettura pessimistica, ed è la sola che non può promettere all'utente più di
 * quel che avrà.
 *
 * Le terre che **non fanno mana affatto** non compaiono qui, e non è una
 * dimenticanza: nel conto delle probabilità ogni terra elencata paga almeno il
 * mana generico, e una terra che non fa mana non lo paga. Restando fuori
 * finisce nel mucchio delle carte che non sono fonti, che è esattamente quel
 * che è. Nel mazzo c'è lo stesso — `dimensioneMazzo` la conta — ma come posto
 * che non lancia niente.
 */
function raggruppa(
  terre: readonly CopieDiCarta[],
  coloriRichiesti: readonly ColoreMana[],
): GruppoDiTerre[] {
  const gruppi = new Map<string, GruppoDiTerre>();
  for (const voce of terre) {
    const terra = voce.carta.terra;
    if (terra === null || terra.coloriProdotti.length === 0) continue;
    const produce = ORDINE_COLORI.filter(
      (colore) => coloriRichiesti.includes(colore) && terra.coloriProdotti.includes(colore),
    );
    const girata = terra.entraGirata;
    const chiave = `${produce.join("")}|${girata ? "girata" : "dritta"}`;
    const gia = gruppi.get(chiave);
    if (gia) gia.copie += voce.copie;
    else gruppi.set(chiave, { copie: voce.copie, produce, girata });
  }
  return [...gruppi.values()];
}
