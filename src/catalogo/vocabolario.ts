/**
 * Le voci offerte dai filtri, ricavate **dal pool**.
 *
 * Nessun elenco di tipi o di sottotipi scritto nel codice: quando esce un set
 * con un tipo di creatura nuovo, il filtro lo conosce senza che nessuno tocchi
 * niente. È lo stesso principio della legalità letta dai dati (`CLAUDE.md`), e
 * vale la pena qui perché i sottotipi di creatura in Standard sono centinaia e
 * cambiano a ogni uscita.
 *
 * Le sole cose scritte a mano sono i nomi italiani da mostrare e l'ordine in
 * cui i tipi compaiono: tradurre e ordinare sono scelte, non dati.
 */

import type { Carta } from "../dati/pool.js";

/**
 * I tipi di carta nell'ordine in cui un giocatore se li aspetta — quello in cui
 * si elenca un mazzo — col loro nome italiano al plurale.
 *
 * Un tipo che non è qui (ne escono di nuovi: `Battle`, `Kindred`) non sparisce:
 * viene in fondo, col suo nome inglese.
 */
const TIPI_NOTI: readonly { tipo: string; etichetta: string; singolare: string }[] = [
  { tipo: "Creature", etichetta: "Creature", singolare: "Creatura" },
  { tipo: "Planeswalker", etichetta: "Planeswalker", singolare: "Planeswalker" },
  { tipo: "Instant", etichetta: "Istantanei", singolare: "Istantaneo" },
  { tipo: "Sorcery", etichetta: "Stregonerie", singolare: "Stregoneria" },
  { tipo: "Artifact", etichetta: "Artefatti", singolare: "Artefatto" },
  { tipo: "Enchantment", etichetta: "Incantesimi", singolare: "Incantesimo" },
  { tipo: "Battle", etichetta: "Battaglie", singolare: "Battaglia" },
  { tipo: "Land", etichetta: "Terre", singolare: "Terra" },
];

/**
 * I supertipi non sono tipi di carta e non vanno fra i filtri: nessuno cerca
 * «tutte le leggendarie» per comporre le proporzioni del mazzo (storia 10).
 */
const SUPERTIPI = new Set(["Legendary", "Basic", "Snow", "World", "Host", "Ongoing", "Token"]);

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
