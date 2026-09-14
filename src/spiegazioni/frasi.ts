/**
 * **I modelli di frase**: l'unico posto in cui l'app scrive in italiano quel
 * che ha deciso (ticket 13).
 *
 * Sono qui tutti insieme apposta. Il ticket lo chiede alla lettera — «i modelli
 * di frase stanno in un unico posto, in italiano, leggibili tutti insieme senza
 * leggere il codice che li usa» — e la ragione è che le frasi si rileggono con
 * l'orecchio, non col debugger: sparse fra i conti che le riempiono, nessuno
 * potrebbe più rispondere alla domanda «che cosa dice l'app al giocatore?»
 * senza leggere mille righe di calcolo.
 *
 * Tre regole, e sono di `CLAUDE.md`:
 *
 * - **nessun testo libero, nessun modello linguistico.** Ogni frase è un
 *   modello con dei buchi, e i buchi si riempiono di numeri già calcolati dal
 *   punteggio, dalla base di terre e dalla simulazione;
 * - **nessuna frase senza un numero dentro.** Una frase senza numero è
 *   un'opinione, e questa app non ne ha;
 * - **italiano semplice, senza gergo.** Chi legge è un giocatore poco esperto:
 *   deve imparare, non eseguire. Niente «efficienza», «densità», «euristica»:
 *   le cose si dicono con le parole del tavolo.
 *
 * Ogni modello prende **un solo oggetto di numeri grezzi** e ne restituisce una
 * frase. I tipi di quegli oggetti stanno qui e non altrove: un modello è
 * definito dai numeri che chiede, e `spiegazioni.ts` — che quei numeri li
 * calcola — li importa da qui.
 *
 * Nessun modello sceglie mai **se** dire una cosa in base a un giudizio: sceglie
 * solo la forma giusta per i numeri che riceve — singolare o plurale, con
 * l'articolo elidato o no, e la variante che non finisca per dire «cinque
 * invece che cinque» quando due numeri arrotondati coincidono.
 *
 * Le percentuali si scrivono a mano e non con `Intl`: una frase che cambiasse
 * con la lingua del telefono non sarebbe più verificabile da un test, e il
 * determinismo è un vincolo non negoziabile.
 */

import { NOMI_DEI_COLORI } from "../catalogo/vocabolario.js";
import type { GuaioDellaCombo } from "../combo/combo.js";
import type { ColoreMana } from "../dati/pool.js";

/* --- Come si scrivono i numeri -------------------------------------------- */

/** «41%»: la percentuale tonda, per le probabilità e le quote. */
export function percento(quota: number): string {
  return `${Math.round(quota * 100)}%`;
}

/**
 * «79,2%»: la percentuale con un decimale, per purezza e potenza.
 *
 * Il decimale non è un vezzo: lungo la frontiera i guadagni di potenza veri
 * stanno intorno all'uno per cento, e arrotondati all'intero due mazzi diversi
 * si direbbero uguali proprio nella frase che esiste per distinguerli.
 */
export function percentoFine(quota: number): string {
  return `${(quota * 100).toFixed(1).replace(".", ",")}%`;
}

/**
 * «80%», «99,8%», «0,2%»: la percentuale di una **parte**, che non può dire né
 * «100%» né «0%».
 *
 * La usa chi, accanto alla percentuale, dice quel che è successo nel resto delle
 * volte — «le altre non chiude affatto» — o a che turno succede la cosa di cui
 * sta dando la quota. Arrotondata all'intero, una parte quasi intera si scrive
 * «100%» e una parte piccolissima «0%», e in tutti e due i casi la frase si
 * contraddice da sola: 499 partite su 500 fanno 0,998 e una su 500 fa 0,002, e
 * sono i due capi dello stesso guasto (ticket 43).
 *
 * Quando succede si scende di un decimale, che sulle cinquecento partite della
 * simulazione è una cifra vera e non una precisione inventata: le due quote
 * estreme che non siano il tutto e il niente sono appunto 99,8% e 0,2%. I due
 * tagli — 99,9% e 0,1% — servono alle quote che arrivassero da conti più fini:
 * sono i numeri più alto e più basso che una parte possa mostrare restando una
 * parte.
 *
 * Il tutto e il niente esatti restano «100%» e «0%», perché lì non c'è niente da
 * arrotondare e nessuna frase da contraddire.
 */
export function percentoDiUnaParte(quota: number): string {
  if (quota <= 0 || quota >= 1) return percento(quota);
  const tondo = Math.round(quota * 100);
  if (tondo > 0 && tondo < 100) return `${tondo}%`;
  const fine = comeSiScrive(quota * 100, 1);
  return `${decimale(Math.min(Math.max(fine, 0.1), 99.9), 1)}%`;
}

/** «2,4»: il numero con la virgola, come si scrive in italiano. */
export function decimale(valore: number, cifre = 2): string {
  return valore.toFixed(cifre).replace(".", ",");
}

/**
 * Il numero **com'è scritto nella frase**, riportato a numero.
 *
 * Serve alle guardie. Un modello che decidesse sul valore grezzo e ne stampasse
 * uno arrotondato finirebbe per scrivere frasi che si contraddicono da sole: «ci
 * arriva 100% delle volte — le altre non chiude affatto» con 499 partite su 500,
 * «che diventa 5,0 contando 0,0 per le sue rimozioni», due turni identici a
 * schermo e uno dei due dichiarato perdente. Sono tutte e tre girate nell'app
 * (ticket 43), e sono la stessa cosa: la guardia guardava un numero e la frase
 * ne mostrava un altro.
 *
 * La regola, da qui in avanti: **si arrotonda una volta sola, in cima al
 * modello**, e da lì in giù guardie e frasi guardano lo stesso valore. Dove una
 * guardia debba restare sul grezzo, la sua soglia va scritta con la sua ragione
 * accanto — divergere in silenzio non è più permesso.
 *
 * L'arrotondamento è quello di `toFixed`, e non un `Math.round` sulle cifre
 * spostate, perché è `toFixed` che scrive la frase: sui casi al limite i due non
 * danno la stessa cifra — 5,05 in binario è poco meno di 5,05 e si scrive «5,0»
 * — e prendere l'altro rimetterebbe dentro proprio la divergenza che questa
 * funzione esiste per chiudere.
 */
export function comeSiScrive(valore: number, cifre = 2): number {
  return Number(valore.toFixed(cifre));
}

/**
 * «3», «2,5»: una quantità che di solito è intera ma non sempre.
 *
 * I simboli di mana chiesti da un mazzo sono mezzi quando la carta porta un
 * simbolo ibrido — l'uno **o** l'altro colore, e allora pesa metà per ciascuno.
 * Scriverli con la virgola solo quando serve tiene la frase leggibile senza
 * mentire sul numero.
 */
export function quantita(valore: number): string {
  return Number.isInteger(valore) ? String(valore) : decimale(valore, 1);
}

/** Le preposizioni articolate che possono elidersi davanti a un numero. */
const ELISIONE = { il: "l'", al: "all'", dal: "dall'", del: "dell'" } as const;

/** Le stesse, davanti a *zero*: non si elidono, si allungano. */
const DAVANTI_ALLO_ZERO = { il: "lo", al: "allo", dal: "dallo", del: "dello" } as const;

/**
 * «il 77%», ma «l'87%»: l'articolo davanti a un numero, elidato quando serve.
 *
 * Un numero si legge ad alta voce, e in italiano l'articolo cambia con la
 * lettera che lo apre: *otto*, *undici*, *uno* e gli *ottanta* cominciano per
 * vocale, tutti gli altri no. Senza questa regoletta l'app scriverebbe «il 87%»
 * in mezzo a frasi altrimenti curate, e chi legge se ne accorgerebbe subito.
 */
export function conArticolo(articolo: keyof typeof ELISIONE, scritto: string): string {
  const intero = Number.parseInt(scritto, 10);
  // Lo zero non è un numero come gli altri: *zero* comincia per z, e in italiano
  // la z vuole «lo». Ci si arriva davvero — un mazzo che non chiude mai una
  // partita, l'ultimo mazzo di una frontiera che ha ceduto tutto il tema.
  if (intero === 0) return `${DAVANTI_ALLO_ZERO[articolo]} ${scritto}`;
  const vocale =
    intero === 1 || intero === 8 || intero === 11 || (intero >= 80 && intero <= 89);
  return vocale ? `${ELISIONE[articolo]}${scritto}` : `${articolo} ${scritto}`;
}

/** «1 copia», «4 copie». */
export function copie(quante: number): string {
  return quante === 1 ? "1 copia" : `${quante} copie`;
}

/**
 * «c'è», «ci sono»: il verbo che si accorda col numero che gli viene dietro.
 *
 * Esiste perché `copie()` da sola non basta. Accordava il nome — «1 copia» — e
 * lasciava al plurale il verbo scritto a mano intorno, così l'app diceva «nel
 * mazzo ci sono 1 copia» (ticket 79). Le frasi si leggono a voce alta
 * (ticket 13), e una riga così non regge la prova.
 */
export function esserci(quante: number): string {
  return quante === 1 ? "c'è" : "ci sono";
}

/**
 * «c'è 1 copia che spazza», «ci sono 5 copie che spazzano anche loro»: il
 * numero delle copie col verbo davanti e il verbo della relativa dietro, tutto
 * accordato in un colpo solo.
 *
 * I due verbi li porta chi chiama, perché sono parole sue e cambiano di ramo in
 * ramo; l'accordo invece sta qui, in un posto solo, che era il difetto da
 * togliere. Il singolare non è il plurale con la desinenza cambiata: con una
 * copia sola quella copia **è** la carta che si sta guardando, e «anche loro»
 * — che vuol dire *oltre a questa* — diventa falso e sparisce.
 *
 * Il nome dice il plurale perché è il caso che si legge nove volte su dieci, e
 * perché è così che si legge la riga di chi chiama: `nel mazzo ${…}`.
 */
export function ciSonoCopieChe(
  quante: number,
  singolare: string,
  plurale: string,
): string {
  return `${esserci(quante)} ${copie(quante)} che ${quante === 1 ? singolare : plurale}`;
}

/** «1 simbolo», «2,5 simboli»: i simboli di mana, che possono essere mezzi. */
export function simboli(quanti: number): string {
  return quanti === 1 ? "1 simbolo" : `${quantita(quanti)} simboli`;
}

/** «1 terra», «22 terre». */
export function terre(quante: number): string {
  return quante === 1 ? "1 terra" : `${quante} terre`;
}

/** «1 carta», «12 carte». */
export function carte(quante: number): string {
  return quante === 1 ? "1 carta" : `${quante} carte`;
}

/** «rosso», «nero», «incolore»: il colore detto in italiano. */
export function nomeDelColore(colore: ColoreMana): string {
  return colore === "C" ? "incolore" : NOMI_DEI_COLORI[colore];
}

/** «uno, due e tre»: l'elenco con la e prima dell'ultimo. */
export function elenco(voci: readonly string[]): string {
  if (voci.length <= 1) return voci[0] ?? "";
  return `${voci.slice(0, -1).join(", ")} e ${voci[voci.length - 1] as string}`;
}

/* --- Perché questa carta è nel mazzo -------------------------------------- */

/**
 * Il mestiere che la carta fa nel mazzo: è la seconda metà della frase che dice
 * perché è dentro, e viene tutta dai valori grezzi della **qualità delle
 * singole carte** e della **salute dei colori**.
 */
export type GrezziDelRuolo =
  /** Risponde alle carte avversarie: in campo, o prima che ci arrivino. */
  | {
      ruolo: "risposta";
      /** Falsa quando il testo della carta pone condizioni a chi può colpire. */
      incondizionata: boolean;
      /**
       * Le copie del mazzo che rispondono anche loro, **condizionate come
       * questa o no**: è una conta sui due modi insieme — chi toglie di mezzo e
       * chi annulla — e non sulle carte che pongono la stessa condizione.
       */
      copieCheLoFanno: number;
      copieNonTerra: number;
    }
  /** Guadagna carte: rimettendole in mano, oppure spazzando il campo. */
  | {
      ruolo: "vantaggio";
      /**
       * Quale dei due modi il punteggio le ha pesato. Non è un dettaglio del
       * numero: chi spazza non rimette in mano niente, e raccontarlo con la
       * frase della pesca è una frase falsa (ticket 78).
       */
      modo: "pesca" | "spazza-via";
      /** Le copie che fanno **quel** modo, non i due modi insieme. */
      copieCheLoFanno: number;
      copieNonTerra: number;
    }
  /** È una creatura, e il suo corpo vale per quel che costa. */
  | {
      ruolo: "corpo";
      valoreDiMana: number;
      forza: string | null;
      costituzione: string | null;
      /** Corpo per mana speso, come lo misura il punteggio. */
      efficienza: number;
      /** La stessa misura, media sulle creature del mazzo. */
      efficienzaMedia: number;
    }
  /** Nessuno dei tre mestieri: riempie un posto, e al suo turno si lancia. */
  | {
      ruolo: "posto";
      turno: number;
      /** La probabilità di avere il mana per lanciarla a quel turno. */
      probabilitaDiMana: number;
    };

export type GrezziDiPresenza = {
  nome: string;
  copie: number;
  nelTema: boolean;
  /** Le copie non-terra del mazzo che appartengono al tema. */
  copieNelTema: number;
  copieNonTerra: number;
  ruolo: GrezziDelRuolo;
};

/** Che mestiere fa la carta, detto senza gergo e con un numero dentro. */
function fraseDelRuolo(grezzi: GrezziDelRuolo): string {
  switch (grezzi.ruolo) {
    case "risposta":
      // «Risponde» e non «toglie di mezzo»: da quando questo ruolo raccoglie
      // anche le contromagie (ticket 73), una carta su due qui dentro non
      // toglie niente dal campo — ferma la carta prima che ci arrivi. E la
      // conta accanto tiene insieme i due modi, quindi dice «anche loro a certe
      // carte sole» e non «alle stesse condizioni», che sarebbe falso di una
      // rimozione contata insieme a una contromagia.
      return grezzi.incondizionata
        ? `Risponde a una carta avversaria e può prendere quello che vuole: nel mazzo ${ciSonoCopieChe(grezzi.copieCheLoFanno, "risponde senza condizioni", "rispondono senza condizioni")}, sulle ${grezzi.copieNonTerra} che non sono terre.`
        : `Risponde a una carta avversaria, ma solo se ha le caratteristiche giuste: nel mazzo ${ciSonoCopieChe(grezzi.copieCheLoFanno, "risponde a certe carte sole", "rispondono anche loro a certe carte sole")}, sulle ${grezzi.copieNonTerra} che non sono terre.`;
    case "vantaggio":
      // Due frasi e non una vaga che le copra tutt'e due: il vantaggio in carte
      // si guadagna in due modi (ticket 73) che al tavolo non si somigliano.
      // Quella dello spazzino tace **di chi** sono le creature che prende,
      // perché lo spazzino è simmetrico — Wrath of God prende anche le tue, e
      // il danno a tutto il campo tocca anche te.
      return grezzi.modo === "pesca"
        ? `Ti rimette carte in mano, e chi ha più carte ha più scelte: nel mazzo ${ciSonoCopieChe(grezzi.copieCheLoFanno, "lo fa", "lo fanno")}, sulle ${grezzi.copieNonTerra} che non sono terre.`
        : `Spazza il campo, e una carta sola può prenderne più d'una: nel mazzo ${ciSonoCopieChe(grezzi.copieCheLoFanno, "spazza", "spazzano anche loro")}, sulle ${grezzi.copieNonTerra} che non sono terre.`;
    case "corpo":
      return `Per ${grezzi.valoreDiMana} mana mette in campo un ${grezzi.forza ?? "?"}/${grezzi.costituzione ?? "?"}: quanto corpo rende per il mana che costa vale ${decimale(grezzi.efficienza)}, contro una media di ${decimale(grezzi.efficienzaMedia)} fra le creature del mazzo.`;
    case "posto":
      return `Riempie un posto al turno ${grezzi.turno}, e a quel turno il mana per lanciarla c'è ${conArticolo("il", percento(grezzi.probabilitaDiMana))} delle volte.`;
  }
}

/**
 * Perché la carta è nel mazzo: prima da che parte sta rispetto al tema, poi che
 * mestiere fa. Due frasi corte, due numeri veri.
 */
export function frasePerLaPresenza(grezzi: GrezziDiPresenza): string {
  const fuoriTema = grezzi.copieNonTerra - grezzi.copieNelTema;
  const tema = grezzi.nelTema
    ? `È una carta del tema: di copie del tema il mazzo ne ha ${grezzi.copieNelTema} sulle ${grezzi.copieNonTerra} che non sono terre.`
    : `Non è una carta del tema: di copie fuori tema il mazzo ne ha ${fuoriTema} sulle ${grezzi.copieNonTerra} che non sono terre.`;
  return `${tema} ${fraseDelRuolo(grezzi.ruolo)}`;
}

/* --- Perché tante copie e non un altro numero ----------------------------- */

export type GrezziDelleCopie = {
  nome: string;
  copie: number;
  /**
   * Il tetto del regolamento per questa carta: quattro, o infinito per le carte
   * che se lo concedono («A deck can have any number of cards named …»).
   */
  massimo: number;
  /** Il turno a cui si prova a lanciarla: il suo valore di mana. */
  turno: number;
  /**
   * La probabilità di averne pescata **almeno una** entro quel turno: è il
   * numero che dipende dalle copie, ed è quindi quello che risponde alla
   * domanda «perché quattro e non due».
   */
  probabilitaDiPescarla: number;
  /**
   * La probabilità di avere il **mana** per lanciarla a quel turno. Non dipende
   * dalle copie ma dalle terre, e sta accanto all'altra perché una carta in
   * mano che non si può lanciare non è ancora una carta giocata.
   */
  probabilitaDiMana: number;
  /** Le carte su cui i due conti sono presi: sessanta, a mazzo legale. */
  dimensioneMazzo: number;
  /** I posti del mazzo che non sono terre. */
  copieNonTerra: number;
  /** Quante carte diverse se li dividono. */
  carteDiverse: number;
};

/**
 * Perché **quel** numero di copie: che cosa comprano, e che cosa impedisce di
 * metterne di più — il regolamento, o i posti che ci sono.
 */
export function frasePerLeCopie(grezzi: GrezziDelleCopie): string {
  const effetto = `Con ${copie(grezzi.copie)} su ${grezzi.dimensioneMazzo} carte, entro il turno ${grezzi.turno} te ne capita almeno una ${conArticolo("il", percento(grezzi.probabilitaDiPescarla))} delle volte, e a quel turno il mana per lanciarla c'è ${conArticolo("il", percento(grezzi.probabilitaDiMana))} delle volte.`;
  if (!Number.isFinite(grezzi.massimo)) {
    return `${effetto} Di questa carta il regolamento non limita le copie: le ${grezzi.copie} le ha scelte l'app.`;
  }
  if (grezzi.copie >= grezzi.massimo) {
    return `${effetto} Di più non se ne possono mettere: il regolamento ne concede ${grezzi.massimo}.`;
  }
  // Qui non si dice «di più non ne entrano», perché non è vero: i posti non sono
  // assegnati a nessuno, e una copia in più ci starebbe togliendone un'altra. Si
  // dice il baratto, che è la cosa vera e che è anche quel che l'utente deve
  // capire per cambiare idea da sé.
  return `${effetto} Una copia in più vorrebbe dire una carta in meno fra le altre: i posti che non sono terre sono ${grezzi.copieNonTerra}, se li dividono ${carte(grezzi.carteDiverse)} diverse, e sono tutti presi.`;
}

/* --- Perché una carta del tema è rimasta fuori ---------------------------- */

/**
 * Le tre ragioni per cui una carta del tema non è entrata. Sono in ordine di
 * evidenza: la curva prima di tutto, perché è la ragione che si vede a occhio;
 * poi la qualità, che è un confronto con una carta entrata; e per ultima quella
 * che resta, cioè che i posti erano finiti.
 */
export type GrezziDiEsclusione = {
  nome: string;
} & (
  | {
      motivo: "curva";
      valoreDiMana: number;
      /**
       * Come si chiama la casella della curva in cui la carta cade: «3», ma
       * anche «1 o meno» e «6 o più». È l'etichetta che il punteggio stesso
       * scrive (`curva.grezzi.caselle`), e sta qui perché le due quote sono
       * prese su **quella** casella: dire «di carte che costano 7 mana» quando
       * il conto è sulle carte da sei in su sarebbe un numero giusto sotto una
       * frase sbagliata.
       */
      casella: string;
      /** La quota di copie del mazzo che stanno già in quella casella. */
      quotaVera: number;
      /** La quota che lì servirebbe, per la velocità di questo mazzo. */
      quotaAttesa: number;
    }
  | {
      motivo: "qualita";
      /** Quanto vale la carta, fra zero e uno, nella misura del punteggio. */
      qualita: number;
      /** La carta più debole che invece è entrata, per fare il confronto. */
      nomePiuDebole: string;
      qualitaPiuDebole: number;
    }
  | {
      motivo: "posti";
      qualita: number;
      copieNonTerra: number;
      carteDiverse: number;
    }
);

export function frasePerLEsclusione(grezzi: GrezziDiEsclusione): string {
  switch (grezzi.motivo) {
    case "curva":
      return `${grezzi.nome} costa ${grezzi.valoreDiMana} mana, e di carte che costano ${grezzi.casella} mana il mazzo ne ha già ${conArticolo("il", percento(grezzi.quotaVera))}, mentre per la sua velocità gliene basterebbe ${conArticolo("il", percento(grezzi.quotaAttesa))}: un'altra lo appesantirebbe.`;
    case "qualita": {
      // Due numeri scritti uguali non possono reggere un «meno di»: la qualità
      // si scrive con due decimali e i pareggi capitano spesso. A parità la
      // frase dice la parità, che è quel che è successo davvero.
      const sua = decimale(grezzi.qualita);
      const entrata = decimale(grezzi.qualitaPiuDebole);
      return sua === entrata
        ? `${grezzi.nome} vale ${sua} su 1 nel conto che l'app fa delle singole carte, quanto la più debole fra quelle entrate — ${grezzi.nomePiuDebole}, che vale ${entrata}: a parità il posto è andato all'altra.`
        : `${grezzi.nome} vale ${sua} su 1 nel conto che l'app fa delle singole carte, meno della più debole fra quelle entrate — ${grezzi.nomePiuDebole}, che vale ${entrata}.`;
    }
    case "posti":
      return `${grezzi.nome} vale ${decimale(grezzi.qualita)} su 1, ed è rimasta fuori lo stesso: i ${grezzi.copieNonTerra} posti che non sono terre sono andati a ${carte(grezzi.carteDiverse)} diverse, e prenderla vorrebbe dire togliere una di quelle.`;
  }
}

/* --- Com'è stata scelta la base di terre ---------------------------------- */

export type GrezziDelleTerre = {
  numeroTerre: number;
  /** Quante ne direbbe la curva, che non sempre sono quelle messe. */
  numeroTerreDallaCurva: number;
  dimensioneMazzo: number;
  copieNonTerra: number;
  /** Il costo medio delle carte che non sono terre: è da lì che viene il numero. */
  costoMedio: number;
  /** Quanto ogni colore è chiesto, e quante terre lo producono. */
  colori: readonly { colore: ColoreMana; simboli: number; fonti: number }[];
  terreCheEntranoGirate: number;
  terreGirateSoloAVolte: number;
  /** La probabilità media, sulle copie, di avere il mana per una carta al suo turno. */
  probabilitaMedia: number;
  /** I nomi delle carte che questa base non regge bene. */
  difficili: readonly string[];
};

/* --- Quel che il tetto di spesa è costato alla base ------------------------ */

export type GrezziDelleRinunce = {
  /** Il tetto chiesto, in euro. */
  tetto: number;
  /** Le copie che il budget ha tolto, dalla più cara: nome, copie, euro. */
  rinunce: readonly { nome: string; copie: number; euro: number }[];
};

/**
 * Che cosa il tetto di spesa ha tolto alla base di terre.
 *
 * Si chiama solo quando qualcosa è stato tolto davvero: una frase che dicesse
 * «non ti ho tolto niente» a ogni mazzo insegnerebbe a saltarla proprio le
 * volte che conta. Vuota quando non c'è nulla da dire (ticket 20).
 *
 * Il numero c'è, come in ogni frase di questo file, ed è quello che rende la
 * cosa verificabile: quante copie e quanti euro. Senza, il giocatore leggerebbe
 * che il tetto gli è costato qualcosa senza poter decidere se valga la pena
 * alzarlo.
 */
export function frasePerLeRinunceDelBudget(grezzi: GrezziDelleRinunce): string {
  if (grezzi.rinunce.length === 0) return "";

  const totale = grezzi.rinunce.reduce((somma, voce) => somma + voce.euro, 0);
  const dette = grezzi.rinunce.map(
    (voce) => `${copie(voce.copie)} di ${voce.nome} (${decimale(voce.euro)} €)`,
  );

  return (
    `Per stare dentro ${decimale(grezzi.tetto)} € la base ha lasciato fuori ${elenco(dette)}: ` +
    `${decimale(totale)} € di terre che il mazzo avrebbe voluto. Al loro posto ci sono terre base.`
  );
}

/* --- Il tetto che vale sul mazzo che si ha in mano ------------------------- */

export type GrezziDelTettoInVigore = {
  /** Il tetto con cui il mazzo in mano è stato costruito, in euro. */
  tetto: number;
  /**
   * Se sul mazzo in mano è in vigore anche **il tema con cui è stato
   * costruito** (ticket 31).
   *
   * Cambia una sola cosa, ed è la coda della frase: quel che succede levando il
   * tetto. Il solo comando che lo leva scioglie il mazzo da **tutti e due** i
   * vincoli insieme — è un fatto solo, e `in-vigore.ts` dice perché — quindi la
   * base non si rifà affatto «sulle terre che il tema permette»: si rifà su
   * quelle che permette il tema dichiarato adesso, che è un altro. Promettere
   * la prima cosa sarebbe promettere quel che non succede; la frase perciò tace
   * e lascia dirlo a quella accanto, che quel tema lo conta.
   */
  conIlSuoTema?: boolean;
  /**
   * I nomi delle carte del mazzo di cui l'app oggi non sa il prezzo
   * (`BudgetDelleTerre.incontabili`, ticket 38). Vuoto o assente è il caso
   * normale, e la frase è quella di sempre.
   *
   * Cambia **la frase intera** e non una coda, perché quel che cade è la
   * promessa: non si può dire che le terre sono scelte per stare dentro una
   * cifra quando la cifra da cui si parte non si sa raggiungere.
   */
  incontabili?: readonly string[];
};

/**
 * Che un tetto di spesa sia ancora in vigore sul mazzo che si guarda
 * (ticket 21).
 *
 * Esiste perché finora quel tetto non lo diceva nessuno: la schermata filtrava
 * le terre e ne contava le copie con una cifra che non compariva da nessuna
 * parte, e chi non se la ricordava vedeva una base senza sapere perché fosse
 * quella. Metà del difetto era questa.
 *
 * Non è come `frasePerLeRinunceDelBudget`, che parla solo quando il tetto ha
 * tolto qualcosa: questa parla **ogni volta che un tetto c'è**, anche quando
 * non è costato niente. Un vincolo in vigore va dichiarato mentre vale, non
 * quando morde.
 *
 * ## Quando il mazzo non si sa più contare (ticket 38)
 *
 * Un mazzo salvato si riapre col pool di oggi, e il pool si rigenera da solo:
 * una carta può aver perso il listino da quando è stato costruito — delistata
 * la copia più economica che ce l'aveva, e nessun'altra copia ammessa ne ha.
 * Le carte non sono cambiate, quindi il tetto è ancora in vigore
 * (`in-vigore.ts`) e va detto; ma quel che resta alle terre non si sa più, e
 * la promessa «sono scelte per starci dentro» diventa una cosa che nessuno può
 * mantenere. È lo stesso danno del ticket 34 — una lista che esce dal negozio
 * con un numero sotto che non tiene — sulla strada del mazzo riaperto.
 *
 * Deciso: **cade la promessa, non il mazzo**. Là c'era un mazzo da non
 * consegnare; qui c'è un mazzo che esiste già e che l'utente ha in mano, e
 * rifiutarsi di mostrarlo non è fra le risposte oneste. Non si fa sparire la
 * carta, non si rifà la base, e i vincoli non decadono — farli decadere
 * porterebbe via anche il tema, che si stacca insieme al tetto, e riempirebbe
 * di paludi un mazzo nato «niente nero» per via di un prezzo mancante. Cade la
 * riga: dice la cifra con cui il mazzo è nato, nomina la carta che non si sa
 * contare, e non promette niente sulle terre.
 */
/**
 * Quante carte incontabili si nominano prima di passare a contarle.
 *
 * Il pool si rigenera da solo, e una rigenerazione che perde i listini di
 * un'edizione intera darebbe un paragrafo lungo quanto il mazzo: una riga che
 * non si legge non avvisa nessuno. Quattro nomi bastano a far capire di che
 * carte si tratti; per il resto vale il numero, che è la misura del guasto.
 */
const NOMI_INCONTABILI_DA_DIRE = 4;

/** «Serra Angel, Cleanse e altre 8 carte»: i nomi, e quante non ci stanno. */
function incontabiliDette(nomi: readonly string[]): string {
  if (nomi.length <= NOMI_INCONTABILI_DA_DIRE) return elenco(nomi);
  const dette = nomi.slice(0, NOMI_INCONTABILI_DA_DIRE);
  const restanti = nomi.length - dette.length;
  // Con esattamente cinque carte senza listino il resto è uno, e il plurale
  // scritto a mano leggeva «e altre 1 carte» — sulla schermata del mazzo e sul
  // foglio per l'arbitro, cioè nei due posti in cui l'app chiede di essere
  // creduta sui numeri (ticket 43).
  const resto = restanti === 1 ? "un’altra carta" : `altre ${carte(restanti)}`;
  return elenco([...dette, resto]);
}

export function frasePerIlTettoInVigore(grezzi: GrezziDelTettoInVigore): string {
  // Il mazzo è ancora quello che il motore ha consegnato — le carte non sono
  // cambiate — ma il pool di oggi non lo sa più prezzare tutto, e allora la
  // riga non promette: dice la cifra con cui il mazzo è nato, nomina la carta
  // che non sa contare, e lascia all'utente le due strade che restano. Il nome
  // c'è perché senza il nome non si prende né l'una né l'altra, com'è per il no
  // del ticket 34.
  if (grezzi.incontabili !== undefined && grezzi.incontabili.length > 0) {
    return (
      `Questo mazzo è stato costruito con un tetto di ${decimale(grezzi.tetto)} €, ` +
      `ma oggi l’app non sa il prezzo di ${incontabiliDette(grezzi.incontabili)}: ` +
      "quanto costi davvero non si sa dire, e le terre qui sotto non si possono promettere " +
      "dentro quella cifra. Sono rimaste quelle con cui il mazzo è stato costruito: " +
      "un listino sparito non è una ragione per riscriverti il mazzo. " +
      // La coda sul tema resta anche qui, e non è un ripensamento: dice che cosa
      // fa **il tasto**, non che cosa promette il tetto, e il tasto c'è lo
      // stesso. Tacerla lascerebbe l'utente a premere «Rifà le terre coi
      // vincoli di adesso» senza sapere che si porta via anche il tema, cioè
      // rimetterebbe dentro la cifra invisibile dei ticket 21 e 31.
      (grezzi.conIlSuoTema === true
        ? "Anche il tema con cui è stato costruito vale ancora, e si levano insieme."
        : "Togliendo il tetto, la base si rifà su tutte le terre che il tema permette.")
    );
  }

  return (
    `Questo mazzo è stato costruito con un tetto di ${decimale(grezzi.tetto)} €, ` +
    "e il tetto vale ancora: le terre qui sotto sono scelte per starci dentro. " +
    // «Che il tema permette» e non «del pool»: le esclusioni del tema valgono
    // sulle terre prima del prezzo, e chi ha detto «niente verde» non vedrebbe
    // comparire una foresta nemmeno a tetto levato. Promettergliela sarebbe
    // inventare, che è la cosa che questo file non fa.
    (grezzi.conIlSuoTema === true
      ? "Anche il tema con cui è stato costruito vale ancora, e si levano insieme."
      : "Togliendolo, la base si rifà su tutte le terre che il tema permette.")
  );
}

/* --- Il tema che sceglie le terre del mazzo che si ha in mano -------------- */

export type GrezziDelTemaInVigore = {
  /** Quante terre del formato ammette il tema con cui il mazzo è stato fatto. */
  terreAmmesse: number;
  /** Quante terre ha il formato in tutto, prima di qualunque esclusione. */
  terreDelFormato: number;
  /** Quante ne ammetterebbe il tema dichiarato adesso nei Vincoli. */
  terreColTemaDiAdesso: number;
  /**
   * Quante ne ammette il tema del mazzo che quello di adesso non ammette.
   *
   * Serve al caso in cui i due conti coincidono: due temi possono ammettere
   * altrettante terre senza ammettere **le stesse**, e la frase che si limitasse
   * ai totali direbbe «ne ammette 28 delle 40; col tema di adesso ne avrebbe 28»
   * — un avviso i cui numeri non mostrano nessuna differenza, cioè un avviso che
   * insegna a non leggere gli avvisi. Questo è il numero che la differenza ce
   * l'ha dentro.
   */
  terreSoloSue: number;
};

/**
 * Che le terre del mazzo che si guarda le sceglie **il tema con cui è stato
 * costruito**, e non quello dichiarato adesso (ticket 31).
 *
 * È la seconda metà della dichiarazione cominciata col tetto (ticket 21), e
 * chiude lo stesso difetto un passo più in là: la base di terre si filtra con le
 * esclusioni del tema prima ancora che col prezzo, e finché quel tema veniva
 * letto dalla manopola dei Vincoli, un mazzo salvato dicendo «niente nero» si
 * riapriva pieno di paludi — senza un avviso, perché la schermata mostrava la
 * base che aveva appena ricalcolato e non aveva modo di sapere che non era
 * quella di prima.
 *
 * I numeri sono due terre contate sullo stesso pool, e servono a rendere la
 * differenza guardabile invece che da credere sulla parola: quante ne ammette il
 * tema di quel mazzo, e quante ne ammetterebbe quello di adesso. Chi legge può
 * contarle nell'elenco qui sotto e ritrovarle.
 *
 * **Quando dirla non lo decide questa frase**: la decide chi la chiama, e la
 * decide su quei due numeri — se i due temi ammettono le stesse terre, la base
 * è la stessa e non c'è niente da dichiarare.
 */
export function frasePerIlTemaInVigore(grezzi: GrezziDelTemaInVigore): string {
  return (
    `Le terre qui sotto le sceglie il tema con cui questo mazzo è stato costruito: ${quanteAmmette(grezzi)}. ` +
    `${confrontoColTemaDiAdesso(grezzi)}`
  );
}

/** «ne ammette 25 delle 33 del formato», o la variante che non dice «33 delle 33». */
function quanteAmmette(grezzi: GrezziDelTemaInVigore): string {
  return grezzi.terreAmmesse === grezzi.terreDelFormato
    ? `non ne esclude nessuna delle ${grezzi.terreDelFormato} del formato`
    : `ne ammette ${grezzi.terreAmmesse} delle ${grezzi.terreDelFormato} del formato`;
}

/**
 * Il confronto col tema di adesso, in una forma che mostra sempre la differenza.
 *
 * A conti diversi basta il secondo totale. A conti uguali no — sarebbero due
 * volte lo stesso numero — e allora si dice **quante non sono le stesse**, che è
 * la differenza vera e l'unica ragione per cui l'avviso compare.
 */
function confrontoColTemaDiAdesso(grezzi: GrezziDelTemaInVigore): string {
  if (grezzi.terreAmmesse !== grezzi.terreColTemaDiAdesso) {
    return `Col tema dichiarato adesso ne avrebbe ${grezzi.terreColTemaDiAdesso}.`;
  }
  const una = grezzi.terreSoloSue === 1;
  return (
    `Il tema dichiarato adesso ne ammetterebbe altrettante, ma ${terre(grezzi.terreSoloSue)} ` +
    `di queste ${una ? "non sarebbe" : "non sarebbero"} fra quelle.`
  );
}

/**
 * La stessa cosa, dove il mazzo non si tocca ma si **scrive**: la lista per
 * l'arbitro e il testo da mandare a un amico.
 *
 * Vale la ragione già scritta per il tetto qui sotto: quelle due liste elencano
 * terre scelte da un vincolo che in questa pagina non compare, e senza una riga
 * che lo dica il foglio uscirebbe deciso da qualcosa di invisibile. Il vincolo
 * qui non si leva — si leva dove il mazzo si tocca, e la frase dice dove.
 */
export function frasePerIlTemaSuQuelCheEsce(grezzi: GrezziDelTemaInVigore): string {
  return (
    `Le terre di queste liste le sceglie il tema con cui questo mazzo è stato costruito: ` +
    `${quanteAmmette(grezzi)}. ${confrontoColTemaDiAdesso(grezzi)} ` +
    "Si cambia dalla schermata «Mazzo»."
  );
}

/**
 * Che il tetto vale anche su quel che esce di qui: la lista per l'arbitro e il
 * mazzo da mandare a un amico (ticket 21).
 *
 * La schermata dei salvati non sceglie le terre, ma le **scrive** — e le scrive
 * filtrate col tetto, come la schermata del mazzo. Senza questa frase quel
 * foglio uscirebbe con una base decisa da una cifra che nella pagina non
 * compare da nessuna parte.
 *
 * Il tetto qui non si leva: si leva dove il mazzo si tocca, e la frase dice
 * dove. Due tasti che fanno la stessa cosa in due pagine sono due posti in cui
 * ricordarsi di cambiarla.
 */
export function frasePerIlTettoSuQuelCheEsce(grezzi: GrezziDelTettoInVigore): string {
  // Il ticket 38 qui **più** che nella schermata del mazzo: queste sono le liste
  // che escono di casa. Un foglio consegnato all'arbitro con sotto una cifra che
  // non tiene è il danno del ticket 34 arrivato fino in fondo, e la cifra non
  // tiene appena una carta del mazzo il pool di oggi non sa prezzarla.
  if (grezzi.incontabili !== undefined && grezzi.incontabili.length > 0) {
    return (
      `Queste liste vengono da un mazzo costruito con un tetto di ${decimale(grezzi.tetto)} €, ` +
      `ma oggi l’app non sa il prezzo di ${incontabiliDette(grezzi.incontabili)}: ` +
      "quanto costino davvero non si sa dire, e le terre qui elencate non si possono " +
      "promettere dentro quella cifra. Sono le stesse che vedi nella schermata «Mazzo»."
    );
  }

  return (
    `Le terre di queste liste stanno dentro il tetto di ${decimale(grezzi.tetto)} € ` +
    // «È stato costruito» e non «l'ha costruito il motore»: da quando un mazzo
    // riaperto si riporta dietro il tetto con cui era stato salvato (ticket
    // 31), quella cifra può benissimo appartenere a un mazzo messo insieme a
    // mano, e nominare il motore sarebbe raccontare una storia che non c'è
    // stata.
    "con cui questo mazzo è stato costruito. Si leva dalla schermata «Mazzo»."
  );
}

export function frasePerLeTerre(grezzi: GrezziDelleTerre): string {
  const parti = [
    grezzi.numeroTerre === grezzi.numeroTerreDallaCurva
      ? `${grezzi.numeroTerre} terre su ${grezzi.dimensioneMazzo} carte: le altre ${grezzi.copieNonTerra} costano in media ${decimale(grezzi.costoMedio, 1)} mana, e a quel costo ne servono ${grezzi.numeroTerreDallaCurva}.`
      : `${grezzi.numeroTerre} terre su ${grezzi.dimensioneMazzo} carte: al costo medio delle altre, che è ${decimale(grezzi.costoMedio, 1)} mana, ne servirebbero ${grezzi.numeroTerreDallaCurva}, ma i posti da lasciare alle carte sono ${grezzi.copieNonTerra}.`,
  ];

  if (grezzi.colori.length > 0) {
    // Un colore per pezzo, separati dal punto e virgola e non dalla virgola: su
    // un mazzo a quattro colori l'elenco con le virgole diventava una filza in
    // cui non si capiva più quale numero andasse con quale colore.
    const chieste = grezzi.colori.map((voce, indice) =>
      indice === 0
        ? `${simboli(voce.simboli)} di mana ${nomeDelColore(voce.colore)} e ha ${terre(voce.fonti)} che ${voce.fonti === 1 ? "lo produce" : "lo producono"}`
        : `${simboli(voce.simboli)} di mana ${nomeDelColore(voce.colore)} e ${terre(voce.fonti)}`,
    );
    parti.push(`Il mazzo chiede ${chieste.join("; ")}.`);
  }

  parti.push(
    `Con questa base, al proprio turno le carte del mazzo hanno il mana per partire in media ${conArticolo("il", percento(grezzi.probabilitaMedia))} delle volte.`,
  );

  if (grezzi.terreCheEntranoGirate > 0) {
    parti.push(
      grezzi.terreCheEntranoGirate === 1
        ? `1 di queste terre entra girata e fa perdere un turno${grezzi.terreGirateSoloAVolte > 0 ? ", ma solo a certe condizioni" : ""}.`
        : grezzi.terreGirateSoloAVolte > 0
          ? `${grezzi.terreCheEntranoGirate} di queste terre entrano girate e fanno perdere un turno, ma ${grezzi.terreGirateSoloAVolte} solo a certe condizioni.`
          : `${grezzi.terreCheEntranoGirate} di queste terre entrano girate e fanno perdere un turno.`,
    );
  }

  if (grezzi.difficili.length > 0) {
    parti.push(
      grezzi.difficili.length === 1
        ? `1 carta questa base la regge male, perché chiede troppi simboli colorati: ${elenco(grezzi.difficili)}.`
        : `${carte(grezzi.difficili.length)} questa base le regge male, perché chiedono troppi simboli colorati: ${elenco(grezzi.difficili)}.`,
    );
  }

  return parti.join(" ");
}

/* --- Che cosa cambia rispetto al mazzo precedente ------------------------- */

/**
 * Il baratto fra un mazzo della frontiera e quello prima di lui, detto in
 * parole: è il fulcro dichiarato del progetto, e questa è la frase che lo dice.
 */
export type GrezziDelPasso = {
  purezzaPrima: number;
  purezzaDopo: number;
  potenzaPrima: number;
  potenzaDopo: number;
  copieFuoriTemaPrima: number;
  copieFuoriTemaDopo: number;
  copieNonTerra: number;
  /**
   * Le carte non-terra del mazzo **precedente**, che non sono sempre quelle di
   * questo: le terre le sceglie la curva, e lungo la frontiera il loro numero
   * si sposta. Senza questo, i due conti delle copie fuori tema si leggerebbero
   * sullo stesso denominatore e uno dei due sarebbe sbagliato.
   */
  copieNonTerraPrima: number;
  /** Il turno medio di chiusura, `null` quando il mazzo non chiude mai. */
  turnoPrima: number | null;
  turnoDopo: number | null;
  /** La quota di partite chiuse: si legge quando il turno medio non basta. */
  quotaChiusePrima: number;
  quotaChiuseDopo: number;
  /** Le partite simulate, che è il numero su cui le due quote sono prese. */
  partite: number;
};

/**
 * Che cosa si è comprato cedendo tema, in due tempi: il baratto in
 * percentuale, e poi la stessa cosa vista dal tavolo — in quanti turni il mazzo
 * chiude adesso.
 *
 * La seconda metà sceglie il numero che **dice qualcosa**: se i due turni medi,
 * scritti, coincidono, si passa alle partite chiuse; se coincidono anche
 * quelle, si dice che la velocità non è cambiata invece di scrivere due volte
 * lo stesso numero fingendo una differenza.
 */
export function frasePerIlPasso(grezzi: GrezziDelPasso): string {
  const inPiu = grezzi.copieFuoriTemaDopo - grezzi.copieFuoriTemaPrima;
  const baratto =
    inPiu > 0
      ? `Accettando ${copie(inPiu)} fuori tema in più — ${grezzi.copieFuoriTemaDopo} su ${grezzi.copieNonTerra}, invece di ${grezzi.copieFuoriTemaPrima} su ${grezzi.copieNonTerraPrima} — la fedeltà al tema scende ${conArticolo("dal", percentoFine(grezzi.purezzaPrima))} ${conArticolo("al", percentoFine(grezzi.purezzaDopo))} e la potenza sale ${conArticolo("dal", percentoFine(grezzi.potenzaPrima))} ${conArticolo("al", percentoFine(grezzi.potenzaDopo))}.`
      : `Cambiando le carte a parità di copie fuori tema, che restano ${grezzi.copieFuoriTemaDopo} su ${grezzi.copieNonTerra}, la fedeltà al tema scende ${conArticolo("dal", percentoFine(grezzi.purezzaPrima))} ${conArticolo("al", percentoFine(grezzi.purezzaDopo))} e la potenza sale ${conArticolo("dal", percentoFine(grezzi.potenzaPrima))} ${conArticolo("al", percentoFine(grezzi.potenzaDopo))}.`;

  const turnoPrima = grezzi.turnoPrima === null ? null : decimale(grezzi.turnoPrima, 1);
  const turnoDopo = grezzi.turnoDopo === null ? null : decimale(grezzi.turnoDopo, 1);
  const chiusePrima = percento(grezzi.quotaChiusePrima);
  const chiuseDopo = percento(grezzi.quotaChiuseDopo);

  let partite: string;
  if (turnoPrima !== null && turnoDopo !== null && turnoPrima !== turnoDopo) {
    partite = `Sulle ${grezzi.partite} partite giocate da solo, chiude in media al turno ${turnoDopo} invece che al turno ${turnoPrima}.`;
  } else if (chiusePrima !== chiuseDopo) {
    partite = `Sulle ${grezzi.partite} partite giocate da solo, chiude ${conArticolo("il", chiuseDopo)} delle volte invece ${conArticolo("del", chiusePrima)}.`;
  } else if (turnoDopo !== null) {
    partite = `Sulle ${grezzi.partite} partite giocate da solo chiude come prima, in media al turno ${turnoDopo}: la potenza in più viene dalle altre misure del punteggio.`;
  } else {
    partite = `Sulle ${grezzi.partite} partite giocate da solo non chiude mai, né prima né adesso: la potenza in più viene dalle altre misure del punteggio.`;
  }

  return `${baratto} ${partite}`;
}

/* --- La combo dichiarata --------------------------------------------------- */

/**
 * I numeri della combo dichiarata: i pezzi con le copie che sono finite nel
 * mazzo, il turno a cui si guarda, e la probabilità esatta di averli tutti in
 * mano entro quel turno.
 *
 * Arrivano da `misuraLaCombo`, e nessuno di loro si rifà qui.
 */
export type GrezziDellaCombo = {
  readonly pezzi: readonly { readonly nome: string; readonly copie: number }[];
  readonly turno: number;
  /**
   * `null` quando dei pezzi non ne è rimasto nessuno: di una combo che non
   * c'è più non esiste una probabilità, e scrivere un numero — qualunque —
   * vorrebbe dire rispondere a una domanda che non si può fare.
   */
  readonly probabilita: number | null;
  readonly dimensioneMazzo: number;
  readonly guai: readonly GuaioDellaCombo[];
};

/** «tutte e due», «tutte e tre»: quanti pezzi si vogliono in mano insieme. */
const TUTTE_E = ["", "", "tutte e due", "tutte e tre", "tutte e quattro"] as const;

/**
 * **Il patto, scritto sullo schermo.**
 *
 * È la frase che il ticket chiede alla lettera: *non giudico se questa combo
 * vinca, l'hai detto tu; ti dico che probabilità hai di averla in mano al turno
 * N*. Sta qui e non in un commento perché è una promessa fatta all'utente, e
 * una promessa che l'utente non legge non è stata fatta.
 *
 * Il numero che la accompagna è esatto — ipergeometrico, non simulato — e vale
 * per il mazzo che si sta guardando: le copie sono quelle che ci sono finite
 * davvero, non quelle che si erano volute.
 */
export function frasePerLaCombo(grezzi: GrezziDellaCombo): string {
  const nomi = grezzi.pezzi.map((pezzo) => `«${pezzo.nome}»`);

  // Dei pezzi non ne è rimasto nessuno: non c'è nessuna probabilità da dire, e
  // il conto non è nemmeno stato fatto (`misuraLaCombo` non lo chiede).
  if (grezzi.pezzi.length === 0 || grezzi.probabilita === null) {
    return `Dei pezzi che avevi nominato non ne è rimasto nessuno, 0 su ${grezzi.guai.length}: non c'è nessuna combo di cui dirti la probabilità.`;
  }

  const patto =
    grezzi.pezzi.length === 1
      ? `Non giudico se ${nomi[0] as string} vinca la partita: l'hai detto tu, e ti credo.`
      : `Non giudico se ${elenco(nomi)} vincano insieme: l'hai detto tu, e ti credo.`;

  const mancante = grezzi.pezzi.find((pezzo) => pezzo.copie === 0);
  if (mancante !== undefined) {
    return `${patto} Ma «${mancante.nome}» nel mazzo non è entrata, e senza di lei la probabilità di avere la combo in mano al turno ${grezzi.turno} è ${percento(0)}.`;
  }

  const dentro = elenco(
    grezzi.pezzi.map((pezzo) => `${copie(pezzo.copie)} di «${pezzo.nome}»`),
  );
  const tutte =
    grezzi.pezzi.length === 1
      ? "di averla in mano"
      : `di averle in mano ${TUTTE_E[grezzi.pezzi.length] ?? `tutte e ${grezzi.pezzi.length}`}`;

  // Il verbo si accorda col soggetto, che è l'elenco: con un pezzo solo lo
  // governa il numero delle sue copie — e una limitata del formato ne ha una —,
  // con due o più pezzi il soggetto è plurale comunque.
  const quanteGovernano =
    grezzi.pezzi.length === 1 ? grezzi.pezzi[0]!.copie : grezzi.pezzi.length;
  const conto = `${patto} Nel mazzo ${esserci(quanteGovernano)} ${dentro} su ${grezzi.dimensioneMazzo} carte, e al turno ${grezzi.turno} hai ${conArticolo("il", percento(grezzi.probabilita))} ${tutte}.`;

  // Se qualche pezzo è rimasto fuori, il numero vale per **meno carte** di
  // quelle nominate, ed è quindi più alto di quello della combo vera. Dirlo
  // senza dire questo sarebbe la bugia più facile da fare qui dentro.
  if (grezzi.guai.length === 0) return conto;
  const fuori = elenco(grezzi.guai.map((guaio) => `«${guaio.nome}»`));
  const restate =
    grezzi.guai.length === 1 ? "è rimasta fuori" : "sono rimaste fuori";
  return `${conto} Ma ${fuori} ${restate}: quel ${percento(grezzi.probabilita)} vale per i pezzi rimasti, non per la combo che avevi dichiarato.`;
}

/** Le terre che un mazzo importato portava e che nell'elenco non entrano. */
export type GrezziDelleTerreScartate = {
  readonly terre: readonly { readonly nome: string; readonly copie: number }[];
};

/**
 * **Le terre di un mazzo che arriva da fuori.**
 *
 * Chi importa il testo di un amico si aspetta il mazzo dell'amico. Le terre
 * però non entrano nell'elenco delle carte che si tengono in mano — la base la
 * ricalcola l'app dalla curva — e finché è così l'app deve **dirlo**: senza
 * questa frase si legge «è stato importato, ed è il mazzo che hai in mano» e ci
 * si ritrova con delle carte in meno, che il primo salvataggio poi consolida.
 *
 * La frase esiste per essere tolta: il giorno che le terre nominate si sapranno
 * tenere, sparisce con la riga che le scarta.
 */
export function frasePerLeTerreScartate(grezzi: GrezziDelleTerreScartate): string {
  const copieTotali = grezzi.terre.reduce((somma, voce) => somma + voce.copie, 0);
  const quali = elenco(grezzi.terre.map((voce) => `${copie(voce.copie)} di «${voce.nome}»`));
  const una = grezzi.terre.length === 1;
  const soggetto = una ? "La terra" : `Le ${grezzi.terre.length} terre`;
  // Il mazzo **non** resta più corto: la base si rifà dalla curva, e le terre
  // tornano al loro numero. Quel che si perde è *quali* erano, e la frase deve
  // dire quello — dire «hai N carte in meno» sarebbe un allarme falso.
  // Lo stesso accordo del ticket 79: il participio e il pronome che seguono il
  // conto delle copie stavano al plurale anche quando la copia è una sola — una
  // terra di utilità limitata entra così, e la frase diceva «1 copia scritte».
  const scritte =
    copieTotali === 1
      ? "1 copia scritta in una lista non la so ancora tenere"
      : `${copie(copieTotali)} scritte in una lista non le so ancora tenere`;
  return `${soggetto} che il mazzo portava — ${quali} — ${una ? "non è quella che rimetto" : "non sono quelle che rimetto"} nel mazzo: la base di terre la scelgo io dalla curva, e ${scritte}. Il numero di terre torna quello che serve, la scelta è la mia.`;
}

/**
 * L'annuncio di un mazzo rimesso in mano, e le terre che quel gesto gli è
 * costato.
 *
 * `annuncio` assente è il tasto dell'elenco: si riapre un mazzo e non c'è altro
 * da dire che quel che si è perso per strada.
 */
export type GrezziDiQuelCheTornaInMano = GrezziDelleTerreScartate & {
  readonly annuncio: string | null;
};

/**
 * **Le due notizie di un mazzo rimesso in mano, in un messaggio solo.**
 *
 * Tre gesti rimettono un mazzo in mano — si importa, si riapre dall'elenco, si
 * salva — e tutti e tre passano dalla riga che scarta le terre. Quel che
 * cambia fra loro è solo se ci sia anche dell'altro da annunciare; la regola su
 * *come* le due notizie stanno insieme è una, e sta qui perché nessuno dei tre
 * se la riscriva a modo suo. Uno se l'era già scritta a modo suo: il
 * salvataggio annunciava «è salvato» e delle terre buttate non diceva niente
 * (ticket 48).
 *
 * L'annuncio viene **prima**: chi ha premuto un tasto sta aspettando di sapere
 * com'è andata, e il prezzo si legge dopo aver saputo che il gesto è riuscito.
 *
 * Torna `null` quando non c'è niente da dire, che non è lo stesso di una riga
 * vuota: un avviso che non avvisa di nulla insegna a saltare gli avvisi.
 */
export function fraseConLeTerreScartate(grezzi: GrezziDiQuelCheTornaInMano): string | null {
  if (grezzi.terre.length === 0) return grezzi.annuncio;
  const terre = frasePerLeTerreScartate({ terre: grezzi.terre });
  return grezzi.annuncio === null ? terre : `${grezzi.annuncio} ${terre}`;
}

/**
 * I pezzi dichiarati, con **quante copie ciascuno ne entrerà davvero**: il
 * numero che il patto qui sotto promette.
 */
export type GrezziDelPattoDellaCombo = {
  readonly pezzi: readonly { readonly nome: string; readonly copie: number }[];
  readonly turno: number;
};

/**
 * **Il patto, prima che il mazzo esista**: la frase in cima alla schermata della
 * combo, quella che l'utente legge *prima* di dare un numero per un giudizio.
 *
 * Il numero di copie non è una costante e non lo può essere: il formato limita
 * certe carte a una copia sola, e una frase che promettesse quattro copie di una
 * carta limitata direbbe una cosa che il mazzo poi non fa — l'app violerebbe il
 * formato a parole, avendolo rispettato nei fatti. Le copie arrivano quindi dai
 * **tetti dei pezzi dichiarati**, letti con la stessa funzione con cui il motore
 * li mette nel mazzo (`copieAlMassimo`).
 *
 * Tre forme, e nessuna è un giudizio: senza pezzi si promette il massimo senza
 * dire un numero che non c'è ancora; con pezzi tutti uguali si dice quel numero;
 * con pezzi diversi si dice **carta per carta**, che è l'unico modo di non
 * mentire su nessuna delle due.
 */
export function frasePerIlPattoDellaCombo(grezzi: GrezziDelPattoDellaCombo): string {
  const una = grezzi.pezzi.length === 1;
  const patto = una
    ? "Non giudico se la carta che nomini vinca la partita: quello lo dici tu, e ti credo."
    : "Non giudico se le carte che nomini vincano la partita insieme: quello lo dici tu, e ti credo.";
  const probabilita = `Ti dico che probabilità hai di ${una ? "averla" : "averle"} in mano${una ? "" : " tutte"} entro il turno ${grezzi.turno}`;

  if (grezzi.pezzi.length === 0) {
    return `${patto} ${probabilita}, e le metto nel mazzo al massimo delle copie che il tuo formato concede, senza mai scambiarle via.`;
  }

  const tetti = new Set(grezzi.pezzi.map((pezzo) => pezzo.copie));
  if (tetti.size === 1) {
    const quante = copie(grezzi.pezzi[0]!.copie);
    return una
      ? `${patto} ${probabilita}, e la metto nel mazzo in ${quante} senza mai scambiarla via.`
      : `${patto} ${probabilita}, e le metto nel mazzo in ${quante} ciascuna senza mai scambiarle via.`;
  }

  const dettaglio = elenco(
    grezzi.pezzi.map((pezzo) => `${copie(pezzo.copie)} di «${pezzo.nome}»`),
  );
  return `${patto} ${probabilita}, e nel mazzo ne metto quante il tuo formato ne concede — ${dettaglio} — senza mai scambiarle via.`;
}

/**
 * Un pezzo dichiarato che nel mazzo non ci va, e perché.
 *
 * Si dice sempre, come si dice il seme sparito: una combo che cambia sotto le
 * mani dell'utente senza che nessuno glielo dica sarebbe peggio di una combo
 * che non si può fare.
 */
export function frasePerIlGuaioDellaCombo(guaio: GuaioDellaCombo): string {
  switch (guaio.tipo) {
    case "sparita":
      return `«${guaio.nome}» non è più fra le carte legali: la combo che avevi dichiarato oggi non è più quella.`;
    case "esclusa":
      return `«${guaio.nome}» la esclude il tema, e le esclusioni vincono sempre: dalla combo resta fuori.`;
    case "terra":
      return `«${guaio.nome}» è una terra: la base di terre la scelgo io dalla curva del mazzo, e una terra nominata non la so ancora forzare.`;
  }
}

/**
 * Quel che serve a spiegare una frontiera lunga **uno**.
 *
 * Sono tre numeri e non tre frasi, come tutto quel che entra qui: la frase la
 * compone questo modello, e chi mostra non ne inventa nessuna.
 */
export type GrezziDelMazzoSolo = {
  /** Se il tempo concesso è finito prima che la ricerca si fermasse da sé. */
  troncataPerTempo: boolean;
  /**
   * Il tetto di spesa e quanti passi ha lasciato senza mazzo; `null` quando il
   * tetto è spento, e allora di soldi non si parla affatto.
   */
  tetto: { euro: number; passiSenzaMazzo: number } | null;
};

/**
 * Perché la frontiera ha un mazzo solo, che sono **tre** risposte diverse e non
 * una.
 *
 * La frase storica — «cedendo tema, qui, non si guadagna potenza da nessuna
 * parte» — è una frase sul **tasso di cambio**, cioè sul fulcro di quest'app, ed
 * era vera finché un passo poteva mancare solo per quella ragione. Col tetto di
 * spesa acceso non lo è più: un passo può mancare perché il mazzo che avrebbe
 * trovato costa più di quanto il giocatore ha chiesto, e dirgli che un baratto
 * non esiste quando a toglierlo è stato il suo stesso tetto è dire il falso su
 * quel che l'app esiste per mostrare.
 *
 * La differenza è fra «non c'è niente da guadagnare» e «con questi soldi non si
 * compra quel che si guadagnerebbe». La seconda è una risposta che si può
 * agire: alza il tetto e il baratto ricompare. Per questo porta dentro il
 * numero — senza, sarebbe un no come gli altri.
 *
 * L'ordine delle tre non è casuale: il tempo viene prima del tetto perché una
 * ricerca troncata non ha nemmeno **provato** i passi che mancano, e dire che
 * il tetto li ha tolti sarebbe accusare il portafoglio di una cosa che ha fatto
 * l'orologio.
 */
export function frasePerIlMazzoSolo(grezzi: GrezziDelMazzoSolo): string {
  if (grezzi.troncataPerTempo) {
    return "Un mazzo solo: il tempo è finito prima che l’app potesse cercare gli altri. Non vuol dire che un baratto non ci sia — vuol dire che non è stato cercato.";
  }
  const tetto = grezzi.tetto;
  if (tetto !== null && tetto.passiSenzaMazzo > 0) {
    const passi =
      tetto.passiSenzaMazzo === 1
        ? "un altro passo, e il mazzo che avrebbe trovato costava"
        : `altri ${tetto.passiSenzaMazzo} passi, e i mazzi che avrebbero trovato costavano`;
    return `Un mazzo solo, e a lasciarlo solo è stato il tetto: l’app ha cercato ${passi} più di ${decimale(tetto.euro)} €. Non vuol dire che un baratto non ci sia — vuol dire che con questi soldi non si compra. Alza il tetto e ricompare.`;
  }
  return "Un mazzo solo: cedendo tema, qui, non si guadagna potenza da nessuna parte.";
}

/* --- La corsa contro gli orologi ------------------------------------------ */

/**
 * **Il patto della corsa**, scritto dove si legge senza scorrere.
 *
 * Non è una cortesia ed è la riga più importante di tutta questa funzionalità.
 * ADR-0002 lo dice alla lettera: ogni posto che mostra un esito di corsa deve
 * dichiarare che l'avversario è una caricatura, perché un numero che sembra un
 * tasso di vittoria senza esserlo sarebbe la bugia peggiore che quest'app possa
 * dire.
 *
 * È una costante e non una frase composta perché non ha numeri dentro: dev'essere
 * la stessa dappertutto, parola per parola, e chi ne scrivesse una variante
 * finirebbe per ammorbidirla.
 */
export const PATTO_DELLA_CORSA =
  "L’avversario qui è una caricatura: tre numeri scritti a mano, non un mazzo. " +
  "Nessuna sua rimozione uccide una carta scelta, nessuno blocca, nessuno tiene " +
  "in mano la contromagia per il turno giusto. Quel che segue non è un tasso di " +
  "vittoria e non ci somiglia: è un confronto fra due orologi.";

/** I numeri di una corsa, come chi la mostra li ha in mano. */
export type GrezziDellaCorsa = {
  contro: string;
  turnoMio: number | null;
  turnoSuo: number;
  ritardoDaRimozioni: number;
  ritardoDaContromagie: number;
  turnoMioRitardato: number | null;
  quotaPartiteChiuse: number;
};

/**
 * Com'è andata contro un orologio, detto con dentro i numeri che lo dicono.
 *
 * La frase cita **tutti** i pezzi del conto — il mio turno, il suo, e quanto mi
 * costano le sue rimozioni e le sue contromagie — perché è l'unico modo di
 * renderla verificabile: chi la legge può rifare la somma. Una frase che dicesse
 * «vai male contro il mono rosso» non si potrebbe né controllare né usare.
 *
 * Il ritardo si nomina solo quando c'è. Scrivere «le sue rimozioni ti costano
 * zero turni» sarebbe rumore, e insegnerebbe a saltare la riga proprio le volte
 * che il numero non è zero.
 */
export function frasePerLaCorsa(grezzi: GrezziDellaCorsa): string {
  if (grezzi.turnoMio === null || grezzi.turnoMioRitardato === null) {
    return `Contro ${grezzi.contro}, che chiude al turno ${grezzi.turnoSuo}, questo mazzo non chiude mai entro il tempo che la simulazione guarda: la corsa non la corre.`;
  }

  // Qui, una volta sola, i numeri diventano quelli che l'utente leggerà: da
  // questa riga in giù nessuna guardia guarda più il grezzo (`comeSiScrive`, e
  // il ticket 43 per le tre frasi che ne uscivano contraddette). Il turno suo
  // non è in lista perché non ha un arrotondamento da condividere: l'orologio lo
  // valida intero, e intero si scrive.
  const mio = comeSiScrive(grezzi.turnoMio, 1);
  const daRimozioni = comeSiScrive(grezzi.ritardoDaRimozioni, 1);
  const daContromagie = comeSiScrive(grezzi.ritardoDaContromagie, 1);
  // Il turno ritardato si rifà **dai numeri mostrati**, e non si arrotonda
  // `turnoMioRitardato`: un ritardo che si mostra «0,0» esce dall'elenco, e se
  // restasse dentro la somma la frase mostrerebbe un «diventa» che con i suoi
  // stessi addendi non torna. È il patto scritto sopra — chi legge può rifare la
  // somma — e qui è anche l'unico modo di tenerlo.
  const ritardato = comeSiScrive(mio + daRimozioni + daContromagie, 1);

  const ritardi: string[] = [];
  if (daRimozioni > 0) {
    ritardi.push(`${decimale(daRimozioni, 1)} per le sue rimozioni`);
  }
  if (daContromagie > 0) {
    ritardi.push(`${decimale(daContromagie, 1)} per le sue contromagie`);
  }

  // Il «diventa» si scrive solo se il turno **diventa** qualcos'altro. Un
  // ritardo può mostrarsi e non spostare il turno mostrato — mezzo centesimo di
  // turno fa «0,1» e lascia «5,0» dov'era — e la frase che lo contasse
  // prometterebbe un cambiamento che accanto non si vede.
  const diventa = ritardi.length > 0 && ritardato > mio;
  const arrivo = diventa
    ? `chiude al turno ${decimale(mio, 1)}, che diventa ${decimale(ritardato, 1)} contando ${elenco(ritardi)}`
    : `chiude al turno ${decimale(mio, 1)}`;

  // Chi arriva prima si decide sul turno che la frase ha appena scritto: due
  // numeri identici a schermo non possono avere un vincitore, chiunque sia
  // avanti alla terza cifra.
  const arrivoMostrato = diventa ? ritardato : mio;
  const chi =
    arrivoMostrato < grezzi.turnoSuo
      ? "arriva prima lui"
      : arrivoMostrato > grezzi.turnoSuo
        ? "arriva prima l’avversario"
        : "arrivano insieme";

  // Quante volte ci arriva si dice **sempre**, perché senza di lei il turno
  // medio mente: chiudere al quarto turno una volta su cinque non è arrivare
  // primi. Ma «le altre volte non chiude affatto» si dice solo quando le altre
  // volte esistono: scriverlo sotto un 100% sarebbe una frase che si contraddice
  // da sola, ed è il genere di riga che insegna a non leggere le altre. Il tutto
  // è esatto — una partita non chiusa su cinquecento è una parte, e
  // `percentoDiUnaParte` la scrive come tale invece di arrotondarla al tutto.
  const quanteVolte =
    grezzi.quotaPartiteChiuse >= 1
      ? `E ci arriva tutte le volte.`
      : `E ci arriva ${percentoDiUnaParte(grezzi.quotaPartiteChiuse)} delle volte — le altre non chiude affatto, e la corsa non si vince nemmeno partendo bene.`;

  return `Contro ${grezzi.contro}, che chiude al turno ${grezzi.turnoSuo}, questo mazzo ${arrivo}: ${chi}. ${quanteVolte}`;
}
