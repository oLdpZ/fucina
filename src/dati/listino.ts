/**
 * Il listino dei prezzi: quel che invecchia davvero di una carta del 1994.
 *
 * Le carte non cambiano, e il pool si congela nell'app. I prezzi di Cardmarket
 * invece cambiano ogni giorno, ed è per loro — e per il documento di formato —
 * che l'aggiornamento in sottofondo esiste ancora (ticket 11, `PROGETTO.md` §7
 * alla voce Q29). Il listino è il file che l'app scarica **al posto delle
 * carte**: per ogni nome, l'euro e la copia da cui viene, e una data sola.
 *
 * Lo scrive `npm run dati` accanto al pool, dalla stessa preparazione: chi entra
 * e quale copia prezza una carta lo decidono le stesse regole, e il listino se
 * ne porta dietro l'impronta come il pool.
 *
 * Quale **stampa descrive** la carta resta nel pool e non cambia con un listino
 * nuovo: a pari lingua la sceglie la preparazione guardando il prezzo del giorno
 * (ADR-0007). Se il giorno dopo a prezzare è un'altra copia, lo dice
 * `Prezzo.stampa`, come lo diceva già.
 */

import type { Pool, Prezzo, Stampa } from "./pool.js";

/**
 * Il listino letto. I prezzi portano già la loro data, che è quella del listino:
 * chi li mostra non deve sapere da dove siano arrivati.
 */
export type Listino = {
  /** La data dei dati di Scryfall da cui vengono i prezzi. */
  generatoIl: string;
  /**
   * Da quale documento di formato viene (`impronta-del-documento.ts`): un
   * listino di un altro criterio prezza copie che qui non si giocano.
   */
  improntaDelDocumento: string;
  /** Per nome di carta. */
  prezzi: ReadonlyMap<string, Prezzo>;
};

/** Il listino come si scrive nel file: una voce per carta. */
export type ListinoScritto = {
  generatoIl: string;
  improntaDelDocumento: string;
  prezzi: { nome: string; euro: number | null; stampa: Stampa | null }[];
};

/**
 * Il listino di un pool appena preparato: i suoi stessi prezzi, staccati dalle
 * carte.
 *
 * Le voci stanno in ordine alfabetico, perché il file entra in git e un diff
 * deve mostrare i prezzi cambiati, non come le carte erano ordinate.
 */
export function listinoDelPool(pool: Pool): ListinoScritto {
  return {
    generatoIl: pool.generatoIl,
    improntaDelDocumento: pool.improntaDelDocumento,
    prezzi: pool.carte
      .map((carta) => ({ nome: carta.nome, euro: carta.prezzo.euro, stampa: carta.prezzo.stampa }))
      .sort((a, b) => (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0)),
  };
}

/**
 * Controlla che quel che si è letto sia davvero un listino, e lo consegna.
 *
 * Qui si guarda **voce per voce**, al contrario del pool: il listino arriva
 * dalla rete e non dal pacchetto, e un listino a metà non deve poter mettere
 * un euro inventato accanto a una carta. Ogni rifiuto è una frase che si può
 * leggere all'utente così com'è.
 */
export function interpretaListino(dati: unknown): Listino {
  if (typeof dati !== "object" || dati === null || Array.isArray(dati)) {
    throw new Error("Il listino dei prezzi non si legge.");
  }

  const { generatoIl, improntaDelDocumento, prezzi } = dati as Record<string, unknown>;

  if (typeof generatoIl !== "string" || Number.isNaN(Date.parse(generatoIl))) {
    throw new Error("Il listino dei prezzi non dice di che data sono i suoi prezzi.");
  }
  if (typeof improntaDelDocumento !== "string" || improntaDelDocumento === "") {
    throw new Error("Il listino dei prezzi non dice per quale formato è fatto.");
  }
  if (!Array.isArray(prezzi) || prezzi.length === 0) {
    throw new Error("Il listino dei prezzi non contiene nessun prezzo.");
  }

  const perNome = new Map<string, Prezzo>();
  prezzi.forEach((voce: unknown, indice: number) => {
    const letta = leggiVoce(voce, generatoIl);
    if (letta === null) {
      throw new Error(`La voce numero ${indice + 1} del listino dei prezzi non si legge.`);
    }
    if (perNome.has(letta.nome)) {
      throw new Error(`Il listino dei prezzi dà due prezzi a «${letta.nome}».`);
    }
    perNome.set(letta.nome, letta.prezzo);
  });

  return { generatoIl, improntaDelDocumento, prezzi: perNome };
}

/**
 * Una voce del listino, o `null` se non si legge.
 *
 * Euro e provenienza vanno a coppia come nel pool (`Prezzo`): un euro senza la
 * copia da cui viene è una mezza verità, e una copia senza euro non prezza
 * niente.
 */
function leggiVoce(
  grezza: unknown,
  aggiornatoIl: string,
): { nome: string; prezzo: Prezzo } | null {
  if (typeof grezza !== "object" || grezza === null) return null;
  const { nome, euro, stampa } = grezza as Record<string, unknown>;

  if (typeof nome !== "string" || nome === "") return null;
  if (euro === null && stampa === null) {
    return { nome, prezzo: { euro: null, aggiornatoIl, stampa: null } };
  }
  if (typeof euro !== "number" || !Number.isFinite(euro) || euro < 0) return null;
  const letta = leggiStampa(stampa);
  if (letta === null) return null;
  return { nome, prezzo: { euro, aggiornatoIl, stampa: letta } };
}

function leggiStampa(grezza: unknown): Stampa | null {
  if (typeof grezza !== "object" || grezza === null) return null;
  const { edizione, numeroDiCollezione, lingua } = grezza as Record<string, unknown>;
  if (
    typeof edizione !== "string" ||
    typeof numeroDiCollezione !== "string" ||
    typeof lingua !== "string"
  ) {
    return null;
  }
  return { edizione, numeroDiCollezione, lingua };
}

/**
 * Dov'è il listino, relativo alla base dell'app. Una funzione e non una costante
 * per la ragione del documento di formato: `import.meta.env` esiste solo dentro
 * Vite, e questo modulo lo importano anche gli strumenti del manutentore.
 */
export function percorsoDelListino(): string {
  return `${import.meta.env.BASE_URL}dati/prezzi.json`;
}
