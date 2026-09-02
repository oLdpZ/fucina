import type { Carta, Tag } from "../src/dati/pool.ts";

/**
 * I tag di sinergia: due sorgenti, mai una terza (`PROGETTO.md` Q13).
 *
 * 1. **Regole meccaniche deterministiche**, scritte qui sotto sul testo e sui
 *    tipi della carta. Stessa carta, stesso tag, sempre: sono espressioni
 *    regolari su un testo che nel pool è già fissato, senza orologio, senza
 *    caso e senza rete.
 * 2. **Un file di correzioni a mano**, che il manutentore apre e modifica senza
 *    toccare il codice. Si applica **dopo** le regole e le sovrascrive.
 *
 * Vietato per decisione di progetto: dedurre sinergie dalle decklist vincenti.
 * Riporterebbe al meta, cioè all'opposto dello scopo dell'app.
 *
 * Questo modulo gira solo nella preparazione dati, mai nel browser: l'app i tag
 * li trova già scritti nel pool.
 */

/**
 * Il testo su cui le regole lavorano: quello della carta **senza i promemoria
 * fra parentesi**.
 *
 * Il testo fra parentesi ripete regole del gioco che il giocatore potrebbe non
 * ricordare — cosa fa una pedina Tesoro, cosa vuol dire equipaggiare — e non è
 * quel che la carta fa. Leggerlo vorrebbe dire che ogni carta che regala un
 * Tesoro «sacrifica», e allora il tag non distinguerebbe più niente.
 */
function testoDelleRegole(carta: Carta): string {
  return carta.testo.replace(/\([^)]*\)/g, " ");
}

/**
 * I tipi della **faccia giocabile per prima**, che è quella con cui la carta si
 * gioca: sono quelli che dicono cos'è la carta in mano.
 *
 * `carta.tipi` unisce invece i tipi di tutte le facce, perché chi cerca «tutti i
 * Goblin» deve trovare anche chi è Goblin solo sul retro (ticket 02). Le due
 * cose servono a scopi diversi: usare l'unione qui vorrebbe dire trattare come
 * terra un incantesimo che *diventa* una terra girandosi.
 */
function tipiGiocabili(carta: Carta): string[] {
  return carta.facce?.[0]?.tipi ?? carta.tipi;
}

function eUnaTerra(carta: Carta): boolean {
  return tipiGiocabili(carta).includes("Land");
}

/**
 * Le regole, una per tag, lette sul testo inglese delle regole della carta —
 * quello di tutte le facce, perché una carta è anche il suo retro.
 *
 * Sono volutamente letterali: leggono le formule che le carte usano davvero, e
 * quando non sono sicure **non** mettono il tag. Un tag mancante lo aggiunge il
 * manutentore in una riga del file delle correzioni; un tag di troppo, sparso
 * su decine di carte, avvelena il punteggio di sinergia senza farsi vedere.
 *
 * Le formule sono state guardate sul pool vero prima di essere scritte così, e
 * ogni caso che le ha fatte stringere è nel materiale di prova col nome della
 * trappola che rappresenta.
 */
const REGOLE: Record<Tag, (carta: Carta, testo: string) => boolean> = {
  /** «create a 1/1 red Goblin creature token» — la formula è sempre questa. */
  "produce-pedine": (_, testo) => /\bcreates?\b[^.]*\btokens?\b/i.test(testo),

  /**
   * Sia il costo («Sacrifice a creature:») sia l'innesco («Whenever you
   * sacrifice…»): al motore interessa che la carta stia in un mazzo che
   * sacrifica, non da che parte del sacrificio stia. Anche chi sacrifica **se
   * stesso** è del tema: è un corpo che muore quando serve.
   *
   * Con un'eccezione, trovata sul pool vero: le terre. Quarantasei terre si
   * sacrificano da sole per un effetto, e col tag ogni base di mana risulterebbe
   * un mazzo da sacrifici. Da una terra il tema lo prende solo chi sacrifica
   * **altro**.
   */
  sacrifica: (carta, testo) =>
    eUnaTerra(carta) ? SACRIFICA_ALTRO.test(testo) : /\bsacrifices?\b/i.test(testo),

  /**
   * «You gain 2 life», «you gain life equal to its power», «Whenever you gain
   * life», e il legame vitale, che è la stessa cosa detta in una parola. Il
   * numero scritto in cifre non c'è quasi mai: chiederlo lasciava fuori i
   * quaranta bersagli veri del tema.
   */
  "guadagna-punti-vita": (_, testo) =>
    (/\bgains?\b[^.]*\blife\b/i.test(testo) && !/\bcan't gain life\b/i.test(testo)) ||
    /\blifelink\b/i.test(testo),

  /**
   * Rimozione con un bersaglio: toglie di mezzo un permanente. Il danno conta
   * solo quando può andare su una creatura o su un planeswalker — un punto di
   * danno all'avversario non rimuove niente, e ce l'hanno decine di terre.
   * «Return target creature» non c'è: rimbalzare non è rimuovere.
   *
   * «Fino a un bersaglio» e «danno pari alla sua forza» sono due modi normali
   * di scrivere una rimozione, e chiederli in cifre lasciava fuori più di cento
   * carte, fra cui rimozioni che in Standard giocano tutti.
   */
  "rimozione-mirata": (_, testo) =>
    /\b(?:destroy|exile)\s+(?:up to \w+\s+)?target\b/i.test(testo) ||
    /\bdeals?\b[^.]*\bdamage\b[^.]*\bto\s+(?:any target|target (?:creature|planeswalker|battle|permanent))\b/i.test(
      testo,
    ) ||
    /\btarget\s+creature[^.]*\bgets?\s+-/i.test(testo),

  /**
   * Lo spazzino: colpisce una **categoria intera** di permanenti, non un
   * bersaglio e non le sole pedine di chi lo lancia.
   */
  "spazza-via": (_, testo) =>
    /\b(?:destroy|exile)\s+(?:all|each)(?:\s+other)?\s+(?:nonland\s+)?(?:creatures?|permanents?|artifacts?|enchantments?|planeswalkers?|lands?)\b/i.test(
      testo,
    ) ||
    /\ball\s+creatures?\b[^.]*\bgets?\s+-/i.test(testo) ||
    /\beach\s+(?:player|opponent)\s+sacrifices\b/i.test(testo),

  /**
   * «Draw a card», «draw two cards», «draw cards equal to…», e l'innesco
   * «whenever you draw your second card each turn», che è un tema intero dello
   * Standard di adesso.
   */
  pesca: (_, testo) => /\bdraws?\b[^.]*\bcards?\b/i.test(testo),

  /**
   * Mana in più, ma **non** dalle terre: una terra il mana lo produce per
   * mestiere, e chiamarla accelerazione vorrebbe dire dare il tag a tutte.
   * Contano l'aggiungere mana, l'andare a prendere una terra dal mazzo, e il
   * Tesoro, che è mana rimandato di un turno.
   */
  "accelerazione-di-mana": (carta, testo) =>
    !eUnaTerra(carta) &&
    (/\badd\s+\{/i.test(testo) ||
      /\badd\s+(?:one|two|three|X)\b/i.test(testo) ||
      /\bTreasure tokens?\b/i.test(testo) ||
      /\bsearch your library for a[^.]*\bland card\b[^.]*\bbattlefield\b/i.test(testo)),

  /** Carte il cui effetto cresce col numero di creature in gioco. */
  "conta-le-creature": (_, testo) =>
    /\bfor each creature\b/i.test(testo) || /\bnumber of creatures\b/i.test(testo),

  /**
   * Il cimitero come risorsa: nominarlo, o riempirlo con il macinare. Non conta
   * la formula dei controincantesimi che il cimitero lo **evitano** («exile it
   * instead of putting it into its owner's graveyard»).
   */
  "si-cura-del-cimitero": (_, testo) =>
    /\bgraveyard\b/i.test(testo.replace(CIMITERO_EVITATO, " ")) || /\bmills?\b/i.test(testo),
};

/**
 * Sacrificare qualcosa che non sia la carta stessa: è il «sacrifice» che fa
 * tema. Serve solo alle terre, che altrimenti lo sarebbero quasi tutte.
 */
const SACRIFICA_ALTRO = /\bsacrifices?\s+(?!this\b|it\b)/i;

/** «…exile it instead of putting it into its owner's graveyard.» */
const CIMITERO_EVITATO = /instead of putting (?:it|them) into (?:its owner's|their owner's|their) graveyards?/gi;

/**
 * L'elenco chiuso dei tag, nell'ordine in cui compaiono su ogni carta. È anche
 * il vocabolario che il file delle correzioni accetta: scriverne uno che non è
 * qui dentro è un errore segnalato, non un tag nuovo.
 *
 * Viene dalle chiavi delle regole e non da un secondo elenco scritto a mano:
 * `REGOLE` è indicizzato su `Tag`, quindi il compilatore garantisce che ci
 * siano tutti, e un tag nuovo non può nascere spento per dimenticanza.
 */
export const TAG: readonly Tag[] = Object.keys(REGOLE) as Tag[];

/** I tag che le regole meccaniche danno a una carta, nell'ordine di `TAG`. */
export function tagMeccanici(carta: Carta): Tag[] {
  const testo = testoDelleRegole(carta);
  return TAG.filter((tag) => REGOLE[tag](carta, testo));
}

/**
 * Una riga del file delle correzioni: una carta, i tag da aggiungere e quelli
 * da togliere. La carta è identificata **per nome**, perché è l'unica cosa che
 * il manutentore ha sotto gli occhi.
 */
export type Correzione = {
  nome: string;
  aggiunge: Tag[];
  toglie: Tag[];
};

export type LetturaCorrezioni = {
  correzioni: Correzione[];
  /** Le righe che non si capiscono, dette in italiano e col loro numero. */
  problemi: string[];
};

/**
 * Il file delle correzioni, letto. Una riga per correzione:
 *
 *     # le righe che iniziano con # sono commenti, e servono a dire perché
 *     Kuldotha Cackler: +produce-pedine, -pesca
 *
 * Il formato è questo e non JSON per un motivo solo: il file lo scrive una
 * persona a mano, e una persona ha bisogno di poter scrivere accanto alla
 * correzione il motivo per cui l'ha fatta.
 *
 * Il motivo si può scrivere anche in fondo alla riga, dopo un `#`.
 *
 * Il nome sta prima dell'**ultimo** due punti di quel che resta: esistono carte
 * che i due punti ce l'hanno nel nome, e sarebbe scortese non poterle
 * correggere.
 */
export function leggiCorrezioni(testo: string): LetturaCorrezioni {
  const correzioni: Correzione[] = [];
  const problemi: string[] = [];

  testo.split(/\r?\n/).forEach((riga, indice) => {
    const numero = indice + 1;
    // Il commento in coda si toglie prima di tutto: il file esiste perché una
    // persona possa scrivere accanto alla correzione il motivo per cui l'ha
    // fatta, e un motivo che contiene due punti non deve rovinare il nome.
    const pulita = riga.replace(/#.*$/, "").trim();
    if (pulita === "") return;

    const taglio = pulita.lastIndexOf(":");
    if (taglio === -1) {
      problemi.push(
        `riga ${numero}: «${pulita}» non ha i due punti. ` +
          `Si scrive «Nome della carta: +tag, -altro-tag».`,
      );
      return;
    }

    const nome = pulita.slice(0, taglio).trim();
    const aggiunge: Tag[] = [];
    const toglie: Tag[] = [];
    let sana = nome !== "";

    if (!sana) problemi.push(`riga ${numero}: manca il nome della carta.`);

    const voci = pulita
      .slice(taglio + 1)
      .split(/[,\s]+/)
      .filter((voce) => voce !== "");

    if (voci.length === 0) {
      problemi.push(`riga ${numero}: a «${nome}» non è stato chiesto nessun tag.`);
      sana = false;
    }

    for (const voce of voci) {
      const segno = voce[0];
      const tag = voce.slice(1);
      if (segno !== "+" && segno !== "-") {
        problemi.push(
          `riga ${numero}: «${voce}» non dice se il tag va aggiunto o tolto. ` +
            `Serve un + o un - davanti.`,
        );
        sana = false;
      } else if (!(TAG as readonly string[]).includes(tag)) {
        problemi.push(
          `riga ${numero}: il tag «${tag}» non esiste. Quelli che esistono sono: ` +
            `${TAG.join(", ")}.`,
        );
        sana = false;
      } else if (segno === "+") {
        aggiunge.push(tag as Tag);
      } else {
        toglie.push(tag as Tag);
      }
    }

    for (const tag of aggiunge) {
      if (toglie.includes(tag)) {
        problemi.push(
          `riga ${numero}: il tag «${tag}» è chiesto e tolto nella stessa riga, ` +
            `e non si capisce quale dei due valga.`,
        );
        sana = false;
      }
    }

    // Una riga sbagliata si segnala e si salta intera: applicarla a metà
    // vorrebbe dire fare alla carta qualcosa che nessuno ha chiesto.
    if (sana) correzioni.push({ nome, aggiunge, toglie });
  });

  return { correzioni, problemi };
}

export type EsitoCorrezioni = {
  carte: Carta[];
  /** I nomi corretti che nel pool non esistono più: quasi sempre, carte ruotate fuori. */
  orfane: string[];
};

/**
 * Le correzioni applicate al pool, **dopo** le regole meccaniche e sopra di
 * esse. Le carte in ingresso non vengono toccate: ne escono di nuove.
 *
 * Una correzione che non trova la sua carta non viene ignorata: il suo nome
 * esce di qui e finisce a schermo, perché è il modo in cui il manutentore
 * scopre che una carta è uscita di Standard e che quella riga si può cancellare.
 */
export function applicaCorrezioni(carte: Carta[], correzioni: Correzione[]): EsitoCorrezioni {
  const perNome = new Map<string, Correzione[]>();
  for (const correzione of correzioni) {
    const gruppo = perNome.get(correzione.nome);
    if (gruppo) gruppo.push(correzione);
    else perNome.set(correzione.nome, [correzione]);
  }

  const corrette = carte.map((carta) => {
    const gruppo = perNome.get(carta.nome);
    if (!gruppo) return carta;

    const tag = new Set(carta.tag);
    for (const correzione of gruppo) {
      for (const aggiunto of correzione.aggiunge) tag.add(aggiunto);
      for (const tolto of correzione.toglie) tag.delete(tolto);
    }
    // L'ordine resta quello dichiarato: un tag aggiunto a mano non deve far
    // sembrare diversa una carta che è cambiata solo in quello.
    return { ...carta, tag: TAG.filter((t) => tag.has(t)) };
  });

  const presenti = new Set(carte.map((c) => c.nome));
  const orfane = [...perNome.keys()].filter((nome) => !presenti.has(nome));

  return { carte: corrette, orfane };
}

/**
 * Quel che il manutentore deve leggere a schermo dopo un aggiornamento dati.
 * Vuoto quando non c'è niente da dire, così chi chiama non stampa una riga per
 * dire che va tutto bene.
 */
export function raccontaCorrezioni(esito: { problemi: string[]; orfane: string[] }): string {
  const righe: string[] = [];

  if (esito.problemi.length > 0) {
    righe.push(`Righe non capite nel file delle correzioni (${esito.problemi.length}):`);
    for (const problema of esito.problemi) righe.push(`  ${problema}`);
  }

  if (esito.orfane.length > 0) {
    if (righe.length > 0) righe.push("");
    righe.push(
      `Correzioni a carte che nel pool non ci sono più (${esito.orfane.length}) —` +
        ` probabilmente sono ruotate fuori, e le righe si possono cancellare:`,
    );
    for (const nome of esito.orfane) righe.push(`  ${nome}`);
  }

  return righe.join("\n");
}
