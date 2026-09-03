/**
 * Il tema come vincolo (ticket 08).
 *
 * Un tema è un **oggetto**, non una frase: filtri strutturati, una carta-seme,
 * e vincoli negativi. Non c'è nessun modello linguistico di mezzo, e non ce ne
 * sarà mai — è un vincolo non negoziabile di `CLAUDE.md`: stessi ingressi,
 * stessa risposta, e ogni cosa che l'app dirà all'utente si potrà ricondurre a
 * un conto fatto qui.
 *
 * Da un tema si ricavano le due domande che il motore farà in continuazione:
 *
 * - **appartiene(carta)** — questa carta è dentro il tema?
 * - **purezza(mazzo)** — quanto di questo mazzo sta dentro il tema?
 *
 * Il vincolo è **morbido** (Q14): un mazzo può contenere carte fuori tema, e la
 * purezza è proprio la misura di quanto ne contiene. Il costo di sconfinare lo
 * dirà il punteggio, non questo modulo.
 *
 * Una sola regola qui non ha eccezioni: **le esclusioni vincono sempre**. Su
 * ogni inclusione, sulla carta-seme, e su ogni allargamento accettato. Chi dice
 * «niente controincantesimi» deve poter contare su quel «niente».
 */

import { normalizza, paroleDelTesto, testoNormalizzato } from "../catalogo/ricerca.js";
import type { Carta, Colore, Tag } from "../dati/pool.js";
import type { CopieDiCarta } from "../mazzo/base-di-terre.js";

/**
 * Un filtro strutturato: le stesse leve del catalogo, più i tag di sinergia e
 * un intervallo di costo.
 *
 * Voci dello stesso filtro si sommano (due sottotipi sono due sottotipi, non
 * una carta che li ha entrambi); filtri diversi si restringono a vicenda. È la
 * regola del catalogo, e cambiarla qui vorrebbe dire che la stessa selezione
 * mostra un numero di carte nel catalogo e un altro nel tema.
 */
export type FiltroTema = {
  /** Chi non sconfina da questi colori, come nel catalogo (storia 7). */
  readonly colori: readonly Colore[];
  readonly tipi: readonly string[];
  readonly sottotipi: readonly string[];
  readonly tag: readonly Tag[];
  /** Una parola nel testo delle regole, cercata come la cerca il catalogo. */
  readonly testo: string;
  readonly costoMinimo: number | null;
  readonly costoMassimo: number | null;
};

export const FILTRO_TEMA_VUOTO: FiltroTema = {
  colori: [],
  tipi: [],
  sottotipi: [],
  tag: [],
  testo: "",
  costoMinimo: null,
  costoMassimo: null,
};

/** Un filtro che non filtra niente: dirlo una volta sola evita di sbagliarlo. */
export function filtroVuoto(filtro: FiltroTema): boolean {
  return (
    filtro.colori.length === 0 &&
    filtro.tipi.length === 0 &&
    filtro.sottotipi.length === 0 &&
    filtro.tag.length === 0 &&
    normalizza(filtro.testo) === "" &&
    filtro.costoMinimo === null &&
    filtro.costoMassimo === null
  );
}

/**
 * Il criterio di un allargamento: la regola, non l'elenco delle carte.
 *
 * Si conserva la regola perché il pool cambia sotto i piedi — i dati si
 * aggiornano da soli (ticket 05) — e un tema che avesse memorizzato dei nomi si
 * svuoterebbe da sé. La regola invece regge: le carte nuove che la soddisfano
 * entrano, quelle uscite dallo Standard escono.
 */
export type CriterioAllargamento =
  | { readonly tipo: "produce-pedine-del-sottotipo"; readonly sottotipo: string }
  | { readonly tipo: "nomina-il-sottotipo"; readonly sottotipo: string }
  | { readonly tipo: "tag-affine"; readonly tag: Tag }
  | {
      readonly tipo: "colori-e-tipo";
      readonly colori: readonly Colore[];
      readonly tipoDiCarta: string;
    };

/**
 * Un ampliamento del tema, con la frase che lo dice ad alta voce.
 *
 * `descrizione` è un modello di frase riempito con numeri veri, mai un testo
 * inventato (`CLAUDE.md`), e `carteAggiunte` è il numero che ci sta dentro: chi
 * legge la frase può contare le carte e ritrovarlo.
 */
export type Allargamento = {
  readonly criterio: CriterioAllargamento;
  readonly descrizione: string;
  /** Quante carte del pool entrerebbero nel tema, che prima non c'erano. */
  readonly carteAggiunte: number;
};

/**
 * Il tema: tre parti, tutte facoltative, ma almeno una obbligatoria.
 *
 * `allargamenti` non è una quarta parte che l'utente compila: è il registro di
 * quelli che ha **accettato**, e sta nel tema perché ci vada anche quando il
 * tema viene salvato o scambiato. Un tema allargato di nascosto sarebbe un tema
 * che mente.
 */
export type Tema = {
  readonly inclusioni: FiltroTema;
  /** Il **nome** della carta-seme, mai l'oggetto: i pool si aggiornano. */
  readonly seme: string | null;
  readonly esclusioni: FiltroTema;
  readonly allargamenti: readonly Allargamento[];
};

export const TEMA_VUOTO: Tema = {
  inclusioni: FILTRO_TEMA_VUOTO,
  seme: null,
  esclusioni: FILTRO_TEMA_VUOTO,
  allargamenti: [],
};

/** Se l'utente ha detto almeno una delle tre cose. Se no, non c'è un tema. */
export function temaDichiarato(tema: Tema): boolean {
  return !filtroVuoto(tema.inclusioni) || tema.seme !== null || !filtroVuoto(tema.esclusioni);
}

/**
 * Il tema con la sua carta-seme già trovata nel pool di oggi.
 *
 * Risolvere una volta sola serve a due cose: non ricercare il seme per ogni
 * carta che si valuta — il motore ne valuterà milioni — e dare una risposta
 * onesta quando il seme dal pool è sparito. Un seme sparito vale `null`: quella
 * carta non è più giocabile, e fingere che il tema sia ancora quello sarebbe
 * peggio che dirlo.
 */
export type TemaRisolto = {
  readonly tema: Tema;
  readonly seme: Carta | null;
};

export function risolviTema(tema: Tema, carte: readonly Carta[]): TemaRisolto {
  const seme = tema.seme === null ? null : (carte.find((c) => c.nome === tema.seme) ?? null);
  return { tema, seme };
}

/** Una carta è una terra: le terre stanno fuori dai conti sul tema. */
export function eTerra(carta: Carta): boolean {
  return carta.tipi.includes("Land");
}

/**
 * Se il testo della carta nomina una parola — quella intera, non un pezzo, e
 * anche al plurale.
 *
 * Il plurale non è un vezzo: le carte tribali parlano quasi sempre di «other
 * Goblins you control», e nel pool di oggi ci sono carte che dicono soltanto
 * «Goblins» e mai «Goblin». Cercare la parola dentro il testo le prenderebbe
 * tutte in un colpo, ma prenderebbe anche «Bat» dentro «Battle» e «Ape» dentro
 * «escape»: si aggiunge quindi la sola *s* finale, e i plurali irregolari
 * («Elves») restano fuori — meglio tacere che sbagliare.
 */
function nomina(carta: Carta, parola: string): boolean {
  const cercata = normalizza(parola);
  if (cercata === "") return false;
  // Un sottotipo di due parole («Time Lord») non sta nell'insieme delle parole:
  // per quello si torna al testo intero.
  if (cercata.includes(" ")) return testoNormalizzato(carta).includes(cercata);
  const parole = paroleDelTesto(carta);
  return parole.has(cercata) || parole.has(`${cercata}s`);
}

/** Se una carta soddisfa un filtro. Un filtro vuoto non lo soddisfa nessuno. */
function soddisfa(carta: Carta, filtro: FiltroTema): boolean {
  if (filtroVuoto(filtro)) return false;

  if (
    filtro.colori.length > 0 &&
    !carta.identitaDiColore.every((colore) => filtro.colori.includes(colore))
  ) {
    return false;
  }
  if (filtro.tipi.length > 0 && !filtro.tipi.some((tipo) => carta.tipi.includes(tipo))) {
    return false;
  }
  if (
    filtro.sottotipi.length > 0 &&
    !filtro.sottotipi.some((sottotipo) => carta.sottotipi.includes(sottotipo))
  ) {
    return false;
  }
  if (filtro.tag.length > 0 && !filtro.tag.some((tag) => carta.tag.includes(tag))) return false;
  if (filtro.costoMinimo !== null && carta.valoreDiMana < filtro.costoMinimo) return false;
  if (filtro.costoMassimo !== null && carta.valoreDiMana > filtro.costoMassimo) return false;

  const testoCercato = normalizza(filtro.testo);
  if (testoCercato !== "" && !testoNormalizzato(carta).includes(testoCercato)) return false;

  return true;
}

/**
 * Il vicinato della carta-seme: le carte che con lei condividono un sottotipo
 * di creatura o un tag di sinergia.
 *
 * È volutamente stretto. Le carte che si limitano a **nominare** il sottotipo
 * del seme — quelle che ne fanno le pedine, per dire — non entrano di qui:
 * entrano da un allargamento, cioè solo dopo che l'app l'ha detto e l'utente ha
 * accettato.
 */
function nelVicinato(carta: Carta, seme: Carta): boolean {
  if (carta.nome === seme.nome) return true;
  if (carta.sottotipi.some((sottotipo) => seme.sottotipi.includes(sottotipo))) return true;
  return carta.tag.some((tag) => seme.tag.includes(tag));
}

/** Se una carta soddisfa il criterio di un allargamento accettato. */
export function soddisfaCriterio(carta: Carta, criterio: CriterioAllargamento): boolean {
  switch (criterio.tipo) {
    case "produce-pedine-del-sottotipo":
      return carta.tag.includes("produce-pedine") && nomina(carta, criterio.sottotipo);
    case "nomina-il-sottotipo":
      return nomina(carta, criterio.sottotipo);
    case "tag-affine":
      return carta.tag.includes(criterio.tag);
    case "colori-e-tipo":
      return (
        carta.tipi.includes(criterio.tipoDiCarta) &&
        carta.identitaDiColore.every((colore) => criterio.colori.includes(colore))
      );
  }
}

/**
 * Se una carta cade sotto le **esclusioni** del tema.
 *
 * È metà di `appartiene`, e sta a sé perché la ricerca (ticket 11) ha bisogno
 * proprio di questa metà: il vincolo del tema è morbido — un mazzo può
 * contenere carte fuori tema, e il costo si legge nella purezza — ma le
 * esclusioni no, non si violano mai, nemmeno quando violarle alzerebbe il
 * punteggio. Chiedere `appartiene` al loro posto direbbe di no anche alle carte
 * semplicemente fuori tema, che invece la ricerca può prendere.
 *
 * Vale anche per le terre: se l'utente ha detto «niente verde», dal verde non
 * deve arrivare nemmeno una foresta.
 */
export function escluso(carta: Carta, tema: Tema): boolean {
  return soddisfa(carta, tema.esclusioni);
}

/**
 * La prima delle due domande del motore: **questa carta appartiene al tema?**
 *
 * L'ordine delle risposte è l'ordine delle regole. Prima le esclusioni, che
 * vincono su tutto. Poi il caso del tema fatto di sole esclusioni, che vuol dire
 * «tutto il resto». Poi le tre vie per starci dentro — le inclusioni, il
 * vicinato del seme, gli allargamenti accettati — che si sommano fra loro:
 * chiedere un sottotipo **e** una carta-seme vuol dire volerli tutti e due, non
 * l'incrocio dei due.
 */
export function appartiene(carta: Carta, risolto: TemaRisolto): boolean {
  const { tema, seme } = risolto;

  if (escluso(carta, tema)) return false;

  const haInclusioni = !filtroVuoto(tema.inclusioni);
  // Il seme si guarda **come è stato dichiarato**, non come si è risolto: un
  // seme uscito dal pool lascia un tema che non prende niente, e va bene così.
  // Guardare la carta trovata, invece, farebbe cadere questo tema nel ramo
  // «solo esclusioni», e da un giorno all'altro il tema di una carta sparita
  // diventerebbe in silenzio il tema di tutte le carte che esistono.
  //
  // Gli allargamenti non contano qui, ed è la loro natura: un allargamento è
  // un'aggiunta a un nucleo, non un nucleo. Se facesse le veci del nucleo,
  // accettare una proposta che dice «prendo **anche** queste» su un tema di
  // sole esclusioni lo restringerebbe da quasi tutte le carte a una manciata:
  // l'esatto contrario di quel che la proposta dice di fare.
  if (!haInclusioni && tema.seme === null) return true;

  if (haInclusioni && soddisfa(carta, tema.inclusioni)) return true;
  if (seme !== null && nelVicinato(carta, seme)) return true;
  return tema.allargamenti.some((allargamento) => soddisfaCriterio(carta, allargamento.criterio));
}

/** Le carte del pool che appartengono al tema, nell'ordine in cui stavano. */
export function carteDelTema(carte: readonly Carta[], risolto: TemaRisolto): Carta[] {
  return carte.filter((carta) => appartiene(carta, risolto));
}

/**
 * La seconda domanda del motore: **quanto è puro questo mazzo?**
 *
 * La quota di carte non-terra che appartengono al tema, pesata per copie: due
 * copie fuori tema pesano il doppio di una. Le terre non contano né sopra né
 * sotto la linea — le sceglie l'app dalla curva (ticket 06), non l'utente, e
 * farle pesare vorrebbe dire misurare una scelta che non è di nessuno.
 *
 * Un mazzo senza carte non-terra ha purezza 1: non c'è niente che tradisca il
 * tema. È il caso del mazzo vuoto, che il motore incontra al primo passo.
 */
export function purezza(mazzo: readonly CopieDiCarta[], risolto: TemaRisolto): number {
  let copieTotali = 0;
  let copieNelTema = 0;

  for (const voce of mazzo) {
    if (eTerra(voce.carta)) continue;
    copieTotali += voce.copie;
    if (appartiene(voce.carta, risolto)) copieNelTema += voce.copie;
  }

  return copieTotali === 0 ? 1 : copieNelTema / copieTotali;
}

/** Due criteri dicono la stessa cosa: serve a non accettare due volte la stessa proposta. */
function stessoCriterio(a: CriterioAllargamento, b: CriterioAllargamento): boolean {
  if (a.tipo === "colori-e-tipo" && b.tipo === "colori-e-tipo") {
    return (
      a.tipoDiCarta === b.tipoDiCarta &&
      a.colori.length === b.colori.length &&
      a.colori.every((colore) => b.colori.includes(colore))
    );
  }
  if (a.tipo === "tag-affine" && b.tipo === "tag-affine") return a.tag === b.tag;
  if (
    (a.tipo === "produce-pedine-del-sottotipo" || a.tipo === "nomina-il-sottotipo") &&
    a.tipo === b.tipo
  ) {
    return a.sottotipo === b.sottotipo;
  }
  return false;
}

/**
 * Il tema con un allargamento in più, accettato dall'utente.
 *
 * Il tema di partenza non si tocca: chi l'aveva in mano continua ad avere
 * quello, e la differenza fra prima e dopo resta visibile. Accettare due volte
 * la stessa proposta non la scrive due volte.
 */
export function accetta(tema: Tema, allargamento: Allargamento): Tema {
  const gia = tema.allargamenti.some((esistente) =>
    stessoCriterio(esistente.criterio, allargamento.criterio),
  );
  if (gia) return tema;
  return { ...tema, allargamenti: [...tema.allargamenti, allargamento] };
}

/** Il tema senza un allargamento: ci si ripensa, e il tema torna com'era. */
export function rifiuta(tema: Tema, allargamento: Allargamento): Tema {
  return {
    ...tema,
    allargamenti: tema.allargamenti.filter(
      (esistente) => !stessoCriterio(esistente.criterio, allargamento.criterio),
    ),
  };
}
