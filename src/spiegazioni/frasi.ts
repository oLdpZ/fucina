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

/** «2,4»: il numero con la virgola, come si scrive in italiano. */
export function decimale(valore: number, cifre = 2): string {
  return valore.toFixed(cifre).replace(".", ",");
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
  /** Toglie di mezzo le carte avversarie. */
  | {
      ruolo: "rimozione";
      /** Falsa quando il testo della carta pone condizioni a chi può colpire. */
      incondizionata: boolean;
      /** Le copie del mazzo che fanno lo stesso mestiere, alle stesse condizioni. */
      copieCheLoFanno: number;
      copieNonTerra: number;
    }
  /** Rimette carte in mano. */
  | {
      ruolo: "vantaggio";
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
    case "rimozione":
      return grezzi.incondizionata
        ? `Toglie di mezzo una carta avversaria e può colpire quello che vuole: nel mazzo ci sono ${copie(grezzi.copieCheLoFanno)} che lo sanno fare, sulle ${grezzi.copieNonTerra} che non sono terre.`
        : `Toglie di mezzo una carta avversaria, ma solo se ha le caratteristiche giuste: nel mazzo ci sono ${copie(grezzi.copieCheLoFanno)} che lo sanno fare alle stesse condizioni, sulle ${grezzi.copieNonTerra} che non sono terre.`;
    case "vantaggio":
      return `Ti rimette carte in mano, e chi ha più carte ha più scelte: nel mazzo ci sono ${copie(grezzi.copieCheLoFanno)} che lo fanno, sulle ${grezzi.copieNonTerra} che non sono terre.`;
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
