/**
 * Le voci offerte dai filtri, ricavate **dal pool**.
 *
 * Nessun elenco di tipi o di sottotipi scritto nel codice: il filtro conosce
 * quel che il pool contiene, senza che nessuno tocchi niente. È lo stesso
 * principio di ADR-0004 — nessuna verità di formato nel sorgente — e il cambio
 * di formato del 6 settembre 2026 ha mostrato quanto valga: il pool è cambiato
 * da capo a fondo, i sottotipi di prima sono spariti e quelli nuovi sono
 * comparsi, e questo file non è stato toccato di una riga. Un elenco scritto a
 * mano avrebbe continuato a offrire i sottotipi di un gioco che non si gioca
 * più, con la faccia di chi ha ragione.
 *
 * Le sole cose scritte a mano sono i nomi italiani da mostrare e l'ordine in
 * cui i tipi compaiono: tradurre e ordinare sono scelte, non dati.
 */

import type { Carta, Colore, Tag } from "../dati/pool.js";

/**
 * I tipi di carta nell'ordine in cui un giocatore se li aspetta — quello in cui
 * si elenca un mazzo — col loro nome italiano al plurale.
 *
 * Un tipo che non è qui (ne escono di nuovi: `Battle`, `Kindred`) non sparisce:
 * viene in fondo, col suo nome inglese.
 */
const TIPI_NOTI: readonly {
  tipo: string;
  etichetta: string;
  singolare: string;
  /** «tutte le creature», «tutti gli artefatti»: l'italiano non perdona. */
  tutti: string;
}[] = [
  { tipo: "Creature", etichetta: "Creature", singolare: "Creatura", tutti: "tutte le creature" },
  {
    tipo: "Planeswalker",
    etichetta: "Planeswalker",
    singolare: "Planeswalker",
    tutti: "tutti i planeswalker",
  },
  { tipo: "Instant", etichetta: "Istantanei", singolare: "Istantaneo", tutti: "tutti gli istantanei" },
  { tipo: "Sorcery", etichetta: "Stregonerie", singolare: "Stregoneria", tutti: "tutte le stregonerie" },
  { tipo: "Artifact", etichetta: "Artefatti", singolare: "Artefatto", tutti: "tutti gli artefatti" },
  {
    tipo: "Enchantment",
    etichetta: "Incantesimi",
    singolare: "Incantesimo",
    tutti: "tutti gli incantesimi",
  },
  { tipo: "Battle", etichetta: "Battaglie", singolare: "Battaglia", tutti: "tutte le battaglie" },
  { tipo: "Land", etichetta: "Terre", singolare: "Terra", tutti: "tutte le terre" },
];

/**
 * I supertipi non sono tipi di carta e non vanno fra i filtri: nessuno cerca
 * «tutte le leggendarie» per comporre le proporzioni del mazzo (storia 10).
 */
const SUPERTIPI = new Set(["Legendary", "Basic", "Snow", "World", "Host", "Ongoing", "Token"]);

/**
 * I colori col loro nome italiano: l'unico posto in cui la lettera diventa una
 * parola. Le lettere sono quelle stampate sulle carte e non si traducono; i
 * nomi servono a chi legge una frase, e a chi usa il filtro senza saperle.
 */
export const NOMI_DEI_COLORI: Readonly<Record<Colore, string>> = {
  W: "bianco",
  U: "blu",
  B: "nero",
  R: "rosso",
  G: "verde",
};

/** L'ordine in cui i colori si dicono e si mostrano: quello delle carte. */
export const ORDINE_DEI_COLORI: readonly Colore[] = ["W", "U", "B", "R", "G"];

/**
 * I quindici tag di sinergia in italiano, in due forme perché servono in due
 * posti: `etichetta` sta su un bottone del filtro, `azione` sta dentro una
 * frase dopo «le carte che…». Tradurre è una scelta, e come i nomi dei tipi sta
 * scritta a mano qui e in nessun altro posto.
 */
const TAG_NOTI: Readonly<Record<Tag, { etichetta: string; azione: string }>> = {
  "danno-diretto": { etichetta: "Danno diretto", azione: "tirano danno addosso a chi gioca" },
  "rimozione-mirata": { etichetta: "Rimozione mirata", azione: "tolgono di mezzo una carta sola" },
  "spazza-via": { etichetta: "Spazza via", azione: "spazzano via il campo" },
  "attacca-le-terre": { etichetta: "Attacca le terre", azione: "attaccano la base di terre" },
  "colpisce-gli-artefatti": {
    etichetta: "Artefatti",
    azione: "si occupano degli artefatti",
  },
  controincantesimo: { etichetta: "Controincantesimo", azione: "annullano gli incantesimi" },
  scarta: { etichetta: "Scarta", azione: "fanno scartare" },
  imbriglia: { etichetta: "Imbriglia", azione: "tengono fermo il campo avversario" },
  "previene-il-danno": { etichetta: "Previene il danno", azione: "prevengono il danno" },
  potenzia: { etichetta: "Potenzia", azione: "ingrossano le creature" },
  evasione: { etichetta: "Evasione", azione: "passano oltre i bloccanti" },
  pesca: { etichetta: "Pesca", azione: "fanno pescare" },
  "accelerazione-di-mana": { etichetta: "Accelera il mana", azione: "accelerano il mana" },
  "si-cura-del-cimitero": { etichetta: "Si cura del cimitero", azione: "si curano del cimitero" },
  rigenera: { etichetta: "Rigenera", azione: "rigenerano" },
};

/** L'elenco dei tag nell'ordine in cui si mostrano: quello in cui sono scritti. */
export const TAG_IN_ORDINE: readonly Tag[] = Object.keys(TAG_NOTI) as Tag[];

/** Come si chiama un tag su un bottone. */
export function etichettaTag(tag: Tag): string {
  return TAG_NOTI[tag].etichetta;
}

/** Come si dice un tag dentro una frase, dopo «le carte che…». */
export function azioneDelTag(tag: Tag): string {
  return TAG_NOTI[tag].azione;
}

/** Come si chiama un tipo di carta al plurale: «Creature», «Istantanei». */
export function etichettaTipo(tipo: string): string {
  return TIPI_NOTI.find((noto) => noto.tipo === tipo)?.etichetta ?? tipo;
}

/**
 * Come si dice «tutte le carte di questo tipo» dentro una frase.
 *
 * L'articolo cambia col genere e con la lettera che segue — le creature, i
 * planeswalker, gli artefatti — e l'unico modo di non sbagliarlo è scriverlo a
 * mano accanto al nome, qui, dove i nomi italiani stanno già. Un tipo che non
 * è ancora in elenco prende una forma che regge comunque.
 */
export function tuttiDelTipo(tipo: string): string {
  const noto = TIPI_NOTI.find((cercato) => cercato.tipo === tipo);
  return noto === undefined ? `tutte le carte di tipo ${tipo}` : noto.tutti;
}

export type VoceTipo = { tipo: string; etichetta: string; quante: number };
export type VoceSottotipo = { sottotipo: string; quante: number };

/** I tipi di carta presenti nel pool, con quante carte per ciascuno. */
export function tipiPresenti(carte: readonly Carta[]): VoceTipo[] {
  const conteggio = new Map<string, number>();
  for (const carta of carte) {
    for (const tipo of new Set(carta.tipi)) {
      if (SUPERTIPI.has(tipo)) continue;
      conteggio.set(tipo, (conteggio.get(tipo) ?? 0) + 1);
    }
  }

  const ordine = new Map(TIPI_NOTI.map((noto, indice) => [noto.tipo, indice]));
  const etichette = new Map(TIPI_NOTI.map((noto) => [noto.tipo, noto.etichetta]));

  return [...conteggio.entries()]
    .map(([tipo, quante]) => ({ tipo, etichetta: etichette.get(tipo) ?? tipo, quante }))
    .sort(
      (a, b) =>
        (ordine.get(a.tipo) ?? TIPI_NOTI.length) - (ordine.get(b.tipo) ?? TIPI_NOTI.length) ||
        a.tipo.localeCompare(b.tipo, "en"),
    );
}

/**
 * I sottotipi delle creature, coi più numerosi davanti: sono quelli attorno a
 * cui si costruisce un mazzo, e in un elenco lungo devono essere i primi che si
 * vedono senza scorrere.
 */
export function sottotipiDiCreatura(carte: readonly Carta[]): VoceSottotipo[] {
  const conteggio = new Map<string, number>();
  for (const carta of carte) {
    if (!carta.tipi.includes("Creature")) continue;
    for (const sottotipo of new Set(carta.sottotipi)) {
      conteggio.set(sottotipo, (conteggio.get(sottotipo) ?? 0) + 1);
    }
  }

  return [...conteggio.entries()]
    .map(([sottotipo, quante]) => ({ sottotipo, quante }))
    .sort((a, b) => b.quante - a.quante || a.sottotipo.localeCompare(b.sottotipo, "en"));
}

/**
 * Come si chiama una carta in una riga sola: «Creatura», «Terra», «Istantaneo».
 *
 * Una carta può avere più tipi (un artefatto che è anche creatura): si sceglie
 * il primo secondo l'ordine in cui un giocatore li nomina, che è quello di
 * `TIPI_NOTI` — un Golem artefatto resta prima di tutto una creatura.
 */
export function tipoPrincipale(tipi: readonly string[]): string {
  for (const noto of TIPI_NOTI) {
    if (tipi.includes(noto.tipo)) return noto.singolare;
  }
  return tipi.find((tipo) => !SUPERTIPI.has(tipo)) ?? tipi[0] ?? "Carta";
}

/**
 * Lo stesso tipo principale, ma com'è scritto nei dati: serve a chi con quel
 * tipo ci deve filtrare, non a chi lo deve leggere.
 */
export function tipoPrincipaleInglese(tipi: readonly string[]): string | null {
  for (const noto of TIPI_NOTI) {
    if (tipi.includes(noto.tipo)) return noto.tipo;
  }
  return tipi.find((tipo) => !SUPERTIPI.has(tipo)) ?? null;
}
