/**
 * Gli allargamenti proposti quando il tema è troppo stretto (ticket 08, Q26).
 *
 * Sono generati da **regole sul tema stesso**, non da un elenco di idee scritto
 * a mano: le carte che producono pedine del sottotipo scelto, quelle che il
 * sottotipo lo nominano nel testo, il tag che il tema già fa più spesso, e il
 * passo più largo — tutte le carte dello stesso tipo nei colori del tema.
 *
 * Ogni proposta porta la sua frase, e la frase porta il suo numero: le carte
 * che entrerebbero. Sono modelli di frase riempiti con numeri veri, mai testo
 * inventato — è un vincolo non negoziabile di `CLAUDE.md`. E nessuna proposta
 * si applica da sola: questo modulo le propone e basta. Il tema cambia solo in
 * `accetta`, cioè solo quando l'utente ha detto di sì.
 */

import {
  ORDINE_DEI_COLORI,
  NOMI_DEI_COLORI,
  azioneDelTag,
  etichettaTipo,
  tipoPrincipaleInglese,
} from "../catalogo/vocabolario.js";
import type { Carta, Colore, Tag } from "../dati/pool.js";
import {
  accetta,
  carteDelTema,
  risolviTema,
  type Allargamento,
  type CriterioAllargamento,
  type Tema,
} from "./tema.js";

/** «1 carta», «12 carte»: l'accordo si fa qui, non in ogni frase. */
function carte(quante: number): string {
  return quante === 1 ? "1 carta" : `${quante} carte`;
}

/** «rosso», «nero e rosso», «bianco, blu e nero»: un elenco che si legge. */
function elencoDiColori(colori: readonly Colore[]): string {
  const nomi = ORDINE_DEI_COLORI.filter((colore) => colori.includes(colore)).map(
    (colore) => NOMI_DEI_COLORI[colore],
  );
  if (nomi.length === 0) return "senza colore";
  if (nomi.length === 1) return nomi[0] as string;
  return `${nomi.slice(0, -1).join(", ")} e ${nomi[nomi.length - 1] as string}`;
}

/**
 * Quante carte entrerebbero nel tema accettando questo criterio.
 *
 * Si conta passando dal tema allargato, non dal criterio da solo: così le
 * esclusioni continuano a vincere anche qui, e il numero nella frase è
 * esattamente il numero di carte che l'utente si troverebbe dentro.
 */
function quanteAggiunge(
  nonTerre: readonly Carta[],
  tema: Tema,
  criterio: CriterioAllargamento,
  giaNelTema: number,
): number {
  const provvisorio: Allargamento = { criterio, descrizione: "", carteAggiunte: 0 };
  const allargato = risolviTema(accetta(tema, provvisorio), nonTerre);
  return carteDelTema(nonTerre, allargato).length - giaNelTema;
}

/**
 * I sottotipi da cui partire: quelli chiesti nelle inclusioni, più quelli della
 * carta-seme. Sono la parte del tema su cui si può ragionare a parole — «i
 * Goblin» — e sono quindi la sorgente delle proposte più fedeli.
 */
function sottotipiDelTema(tema: Tema, seme: Carta | null): string[] {
  const visti = new Set<string>();
  const ordinati: string[] = [];
  for (const sottotipo of [...tema.inclusioni.sottotipi, ...(seme?.sottotipi ?? [])]) {
    if (visti.has(sottotipo)) continue;
    visti.add(sottotipo);
    ordinati.push(sottotipo);
  }
  return ordinati;
}

/**
 * Il tag che il tema fa più spesso, fra quelli che non ha già chiesto.
 *
 * A pari merito vince il primo in ordine alfabetico: due temi uguali devono
 * dare le stesse proposte, e l'ordine in cui il pool è capitato non è una
 * ragione per cambiarle.
 */
function tagPiuFrequente(nelTema: readonly Carta[], gia: readonly Tag[]): [Tag, number] | null {
  const conteggio = new Map<Tag, number>();
  for (const carta of nelTema) {
    for (const tag of new Set(carta.tag)) {
      if (gia.includes(tag)) continue;
      conteggio.set(tag, (conteggio.get(tag) ?? 0) + 1);
    }
  }

  const ordinati = [...conteggio.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it"),
  );
  return ordinati[0] ?? null;
}

/** I colori toccati dalle carte già nel tema: è il colore del mazzo che verrà. */
function coloriDelTema(nelTema: readonly Carta[]): Colore[] {
  const colori = new Set<Colore>();
  for (const carta of nelTema) {
    for (const colore of carta.identitaDiColore) colori.add(colore);
  }
  return ORDINE_DEI_COLORI.filter((colore) => colori.has(colore));
}

/** Il tipo di carta più rappresentato nel tema: quasi sempre le creature. */
function tipoPiuFrequente(nelTema: readonly Carta[]): string | null {
  const conteggio = new Map<string, number>();
  for (const carta of nelTema) {
    const tipo = tipoPrincipaleInglese(carta.tipi);
    if (tipo === null) continue;
    conteggio.set(tipo, (conteggio.get(tipo) ?? 0) + 1);
  }

  const ordinati = [...conteggio.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"),
  );
  return ordinati[0]?.[0] ?? null;
}

/**
 * Le proposte, dal passo più piccolo al più grande.
 *
 * L'ordine è quello delle carte che entrerebbero, dalla proposta che ne porta
 * meno a quella che ne porta di più: il passo più piccolo è quello che lascia
 * il tema più riconoscibile, e chi legge la prima legge quella che cambia meno
 * l'idea di partenza. Una proposta che non aggiungerebbe nessuna carta non si
 * mostra — sarebbe una strada che non porta da nessuna parte — e quelle già
 * accettate nemmeno.
 *
 * `nelTema` sono le carte non-terra che il tema prende **adesso**: le proposte
 * si costruiscono su quelle, perché è dal tema che devono nascere.
 */
export function proponiAllargamenti(
  nonTerre: readonly Carta[],
  tema: Tema,
  seme: Carta | null,
  nelTema: readonly Carta[],
): Allargamento[] {
  const criteri: { criterio: CriterioAllargamento; frase: (quante: number) => string }[] = [];

  for (const sottotipo of sottotipiDelTema(tema, seme)) {
    criteri.push({
      criterio: { tipo: "produce-pedine-del-sottotipo", sottotipo },
      frase: (quante) =>
        `Prendo anche le carte che producono pedine ${sottotipo} pur non essendolo: ` +
        `${carte(quante)} in più.`,
    });
    criteri.push({
      criterio: { tipo: "nomina-il-sottotipo", sottotipo },
      frase: (quante) =>
        `Prendo anche le carte che nominano ${sottotipo} nel loro testo: ${carte(quante)} in più.`,
    });
  }

  const affine = tagPiuFrequente(nelTema, tema.inclusioni.tag);
  if (affine !== null) {
    const [tag, quanteLoFanno] = affine;
    criteri.push({
      criterio: { tipo: "tag-affine", tag },
      frase: (quante) =>
        `Prendo anche le carte che ${azioneDelTag(tag)}, come ${carte(quanteLoFanno)} ` +
        `che il tema ha già: ${carte(quante)} in più.`,
    });
  }

  const tipoDiCarta = tipoPiuFrequente(nelTema);
  if (tipoDiCarta !== null) {
    const colori = coloriDelTema(nelTema);
    criteri.push({
      criterio: { tipo: "colori-e-tipo", colori, tipoDiCarta },
      frase: (quante) =>
        `Allargo a tutte le ${etichettaTipo(tipoDiCarta).toLowerCase()} ` +
        `di colore ${elencoDiColori(colori)}: ${carte(quante)} in più.`,
    });
  }

  const proposte: Allargamento[] = [];
  for (const { criterio, frase } of criteri) {
    const carteAggiunte = quanteAggiunge(nonTerre, tema, criterio, nelTema.length);
    if (carteAggiunte <= 0) continue;
    proposte.push({ criterio, descrizione: frase(carteAggiunte), carteAggiunte });
  }

  // A pari numero decide la frase: due temi uguali devono dare le proposte
  // nello stesso ordine, sempre.
  return proposte.sort(
    (a, b) => a.carteAggiunte - b.carteAggiunte || a.descrizione.localeCompare(b.descrizione, "it"),
  );
}
