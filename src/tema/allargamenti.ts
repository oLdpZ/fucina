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
  NOMI_DEI_COLORI,
  ORDINE_DEI_COLORI,
  azioneDelTag,
  tipoPrincipaleInglese,
  tuttiDelTipo,
} from "../catalogo/vocabolario.js";
import type { Carta, Colore, Tag } from "../dati/pool.js";
import {
  accetta,
  carteDelTema,
  type Allargamento,
  type CriterioAllargamento,
  type Tema,
} from "./tema.js";

/** «1 carta», «12 carte»: l'accordo si fa qui, non in ogni frase. */
function carte(quante: number): string {
  return quante === 1 ? "1 carta" : `${quante} carte`;
}

/** «di colore rosso», «di colore nero e rosso», «senza colore». */
function clausolaDiColore(colori: readonly Colore[]): string {
  const nomi = ORDINE_DEI_COLORI.filter((colore) => colori.includes(colore)).map(
    (colore) => NOMI_DEI_COLORI[colore],
  );
  if (nomi.length === 0) return "senza colore";
  if (nomi.length === 1) return `di colore ${nomi[0] as string}`;
  return `di colore ${nomi.slice(0, -1).join(", ")} e ${nomi[nomi.length - 1] as string}`;
}

/**
 * Che cosa un allargamento prende, detto in italiano e **senza numeri**.
 *
 * Sta separata dalla proposta perché serve due volte: dentro la proposta, dove
 * il numero c'è, e accanto a un allargamento già accettato, dove il numero non
 * ci deve essere. Un conteggio congelato al momento in cui si è accettato
 * smetterebbe di corrispondere a qualcosa appena il tema cambia ancora, e una
 * frase con dentro un numero che non torna è peggio di una frase senza numeri.
 */
export function frasePerCriterio(criterio: CriterioAllargamento): string {
  switch (criterio.tipo) {
    case "produce-pedine-del-sottotipo":
      return `le carte che producono pedine ${criterio.sottotipo} pur non essendolo`;
    case "nomina-il-sottotipo":
      return `le carte che nominano ${criterio.sottotipo} nel loro testo`;
    case "tag-affine":
      return `le carte che ${azioneDelTag(criterio.tag)}`;
    case "colori-e-tipo":
      return `${tuttiDelTipo(criterio.tipoDiCarta)} ${clausolaDiColore(criterio.colori)}`;
  }
}

/**
 * Quante carte entrerebbero nel tema accettando questo criterio.
 *
 * Si conta passando dal tema allargato, non dal criterio da solo: così le
 * esclusioni continuano a vincere anche qui, e il numero nella frase è
 * esattamente il numero di carte che l'utente si troverebbe dentro.
 *
 * Il seme arriva già risolto, e non si ricerca qui: cercarlo fra le sole
 * non-terre darebbe un tema diverso da quello con cui si è contato `giaNelTema`
 * — un seme che fosse una terra sparirebbe per strada — e la differenza fra i
 * due conti non sarebbe più quel che l'allargamento aggiunge.
 */
function quanteAggiunge(
  nonTerre: readonly Carta[],
  tema: Tema,
  seme: Carta | null,
  criterio: CriterioAllargamento,
  giaNelTema: number,
): number {
  const provvisorio: Allargamento = { criterio, descrizione: "", carteAggiunte: 0 };
  const allargato = { tema: accetta(tema, provvisorio), seme };
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
function tagPiuFrequente(nelTema: readonly Carta[], gia: readonly Tag[]): Tag | null {
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
  return ordinati[0]?.[0] ?? null;
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
  const criteri: CriterioAllargamento[] = [];

  for (const sottotipo of sottotipiDelTema(tema, seme)) {
    criteri.push({ tipo: "produce-pedine-del-sottotipo", sottotipo });
    criteri.push({ tipo: "nomina-il-sottotipo", sottotipo });
  }

  const affine = tagPiuFrequente(nelTema, tema.inclusioni.tag);
  if (affine !== null) criteri.push({ tipo: "tag-affine", tag: affine });

  const tipoDiCarta = tipoPiuFrequente(nelTema);
  if (tipoDiCarta !== null) {
    criteri.push({ tipo: "colori-e-tipo", colori: coloriDelTema(nelTema), tipoDiCarta });
  }

  const proposte: Allargamento[] = [];
  for (const criterio of criteri) {
    const carteAggiunte = quanteAggiunge(nonTerre, tema, seme, criterio, nelTema.length);
    if (carteAggiunte <= 0) continue;
    proposte.push({
      criterio,
      descrizione: `Prendo anche ${frasePerCriterio(criterio)}: ${carte(carteAggiunte)} in più.`,
      carteAggiunte,
    });
  }

  // A pari numero decide la frase: due temi uguali devono dare le proposte
  // nello stesso ordine, sempre.
  return proposte.sort(
    (a, b) => a.carteAggiunte - b.carteAggiunte || a.descrizione.localeCompare(b.descrizione, "it"),
  );
}
