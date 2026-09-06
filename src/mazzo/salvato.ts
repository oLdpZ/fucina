/**
 * La forma di un mazzo salvato sul dispositivo (ticket 07).
 *
 * Un mazzo salvato non è solo la sua lista: porta con sé **la richiesta che lo
 * ha prodotto**, così che più avanti — quando il motore esisterà — lo stesso
 * mazzo si possa rigenerare identico invece di essere solo riletto
 * (`spec.md`, «Salvataggio», Q22).
 *
 * Le carte si tengono **per nome**, mai come oggetti del pool: i dati si
 * aggiornano da soli in sottofondo (ticket 05), e un mazzo legato agli oggetti
 * di un pool vecchio si svuoterebbe da sé. Un nome che sparisce dal pool —
 * rotazione, bando — esce dal mazzo da solo, ed è quel che deve succedere:
 * quella carta non è più giocabile.
 *
 * Un mazzo salvato dice anche **di che formato è**: quale gioco lo ha prodotto.
 * Serve al giorno in cui il formato cambia — e cambierà, perché è un documento
 * che si corregge — così che un mazzo di un altro gioco si riconosca come tale
 * invece di aprirsi mezzo vuoto senza dire perché.
 *
 * Le terre non si salvano: le sceglie l'app dalla curva del mazzo (ticket 06),
 * e ricalcolarle sui dati di oggi è più giusto che ripescare quelle di ieri.
 * Della base si salva la sola cosa che l'utente ha deciso: quante terre voleva.
 */

import { identitaSeSiLegge, type IdentitaDiFormato } from "../dati/ambito.js";
import { DIMENSIONE_MAZZO } from "./taratura.js";

/** Una carta del mazzo, per nome, e quante copie. */
export type VoceSalvata = { nome: string; copie: number };

/**
 * Che cosa ha prodotto il mazzo.
 *
 * Oggi c'è una sola origine — messo insieme a mano dal catalogo — perché il
 * motore non esiste ancora. Quando esisterà (ticket 08-13) questa unione
 * cresce di un ramo, con il tema, il seme e il tetto di spesa dentro; il
 * formato di scambio porta un numero di formato proprio per quel giorno.
 */
export type Richiesta = {
  origine: "a-mano";
  /** Le terre chieste a mano; `null` quando le decide la curva del mazzo. */
  terreVolute: number | null;
};

/** Il mazzo come si scambia: tutto tranne il posto che occupa nel deposito. */
export type ContenutoMazzo = {
  nome: string;
  /** Quando l'utente l'ha salvato, in ISO. */
  salvatoIl: string;
  /** La data dei dati con cui è stato costruito: la legalità e i prezzi di allora. */
  datiDel: string;
  richiesta: Richiesta;
  /**
   * Il formato che ha prodotto il mazzo.
   *
   * **Manca** nei mazzi salvati prima che l'app lo scrivesse, e non è un
   * guasto: quei mazzi si aprono lo stesso, e chi li apre sa che il formato non
   * lo dichiarano. Perciò è un campo facoltativo e non un campo che a volte è
   * nullo — un mazzo che dicesse «formato: nessuno» direbbe una cosa che nessuno
   * ha mai scritto.
   */
  // Scritto `| undefined` e non solo col punto interrogativo: il progetto
  // distingue il campo assente dal campo scritto assente
  // (`exactOptionalPropertyTypes`), e qui vanno bene tutti e due — un mazzo
  // vecchio non ha la voce, uno riletto ce l'ha vuota, e sono la stessa cosa.
  formato?: IdentitaDiFormato | undefined;
  carte: VoceSalvata[];
};

/** Il mazzo nel deposito: il contenuto, più il nome interno che lo distingue. */
export type MazzoSalvato = ContenutoMazzo & { id: string };

/**
 * Quanto può essere lungo il nome scelto dall'utente. Non è una regola del
 * gioco: è quanto ne sta in una riga dell'elenco senza spingerlo fuori dallo
 * schermo del telefono.
 */
export const NOME_MASSIMO = 60;

/**
 * Il nome come finisce nell'elenco: senza spazi ai bordi né spazi doppi in
 * mezzo — non si vedono, e due mazzi che sembrano avere lo stesso nome sono
 * peggio di due che ce l'hanno davvero.
 */
export function nomePulito(nome: string): string {
  return nome.replace(/\s+/gu, " ").trim().slice(0, NOME_MASSIMO);
}

/**
 * Un nome interno diverso per ogni mazzo salvato.
 *
 * Non è il nome che l'utente vede: due mazzi possono chiamarsi uguale, e
 * salvare il secondo non deve cancellare il primo.
 */
export function nuovoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Browser vecchi e contesti non sicuri: basta che non si ripeta.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Controlla che quel che si è riletto sia davvero un mazzo salvato.
 *
 * Vale per il deposito e per un file arrivato da un amico: in entrambi i casi
 * i dati vengono da fuori, e un mazzo troncato deve dirlo con parole invece di
 * comparire a metà.
 */
export function interpretaMazzoSalvato(dati: unknown): MazzoSalvato {
  if (typeof dati !== "object" || dati === null) {
    throw new Error("Questo mazzo salvato non si legge.");
  }
  const { id } = dati as { id?: unknown };
  if (typeof id !== "string" || id === "") {
    throw new Error("Questo mazzo salvato non ha un nome interno: non si sa a chi appartenga.");
  }
  return { id, ...interpretaContenuto(dati) };
}

/** Le stesse verifiche, sul solo contenuto: è ciò che viaggia in un file. */
export function interpretaContenuto(dati: unknown): ContenutoMazzo {
  if (typeof dati !== "object" || dati === null) {
    throw new Error("Questo mazzo non si legge.");
  }
  const { nome, salvatoIl, datiDel, richiesta, formato, carte } = dati as {
    nome?: unknown;
    salvatoIl?: unknown;
    datiDel?: unknown;
    richiesta?: unknown;
    formato?: unknown;
    carte?: unknown;
  };

  if (typeof nome !== "string" || nome.trim() === "") {
    throw new Error("Questo mazzo non ha un nome.");
  }
  if (typeof salvatoIl !== "string" || salvatoIl === "") {
    throw new Error("Questo mazzo non dice quando è stato salvato.");
  }
  if (typeof datiDel !== "string" || datiDel === "") {
    throw new Error("Questo mazzo non dice di che data erano le carte con cui è stato fatto.");
  }

  return {
    nome,
    salvatoIl,
    datiDel,
    richiesta: interpretaRichiesta(richiesta),
    // Letto **con indulgenza**: un formato scritto a metà vale come assente. Da
    // qui passa anche quel che si rilegge dal deposito, e chi lo rilegge lascia
    // fuori dall'elenco i mazzi che non si leggono — un campo storto qui
    // farebbe sparire il mazzo intero, senza dirlo a nessuno. Il testo che
    // arriva da fuori è severo dove deve, cioè prima di arrivare qui.
    formato: identitaSeSiLegge(formato),
    carte: interpretaCarte(carte),
  };
}

function interpretaRichiesta(dati: unknown): Richiesta {
  if (typeof dati !== "object" || dati === null) {
    throw new Error("Questo mazzo non porta con sé la richiesta che l'ha prodotto.");
  }
  const { origine, terreVolute } = dati as { origine?: unknown; terreVolute?: unknown };
  if (origine !== "a-mano") {
    // Il giorno in cui il motore aggiungerà la sua origine, questo messaggio è
    // esattamente quel che un'app vecchia deve dire di un mazzo nuovo.
    throw new Error(
      "La richiesta di questo mazzo non si riconosce: forse viene da una versione più recente dell’app.",
    );
  }
  // Zero terre non è «nessuna richiesta»: quello è `null`. Un mazzo che chiede
  // zero terre è un mazzo scritto a mano male, e non lo si prende per buono.
  if (terreVolute !== null && (!interoPositivo(terreVolute) || terreVolute === 0)) {
    throw new Error("Le terre chieste da questo mazzo non sono un numero di terre.");
  }
  return { origine, terreVolute: terreVolute as number | null };
}

function interpretaCarte(dati: unknown): VoceSalvata[] {
  if (!Array.isArray(dati)) {
    throw new Error("Questo mazzo non contiene un elenco di carte.");
  }
  if (dati.length === 0) {
    throw new Error("Questo mazzo non contiene carte.");
  }

  const carte: VoceSalvata[] = [];
  const gia = new Set<string>();
  for (const voce of dati as unknown[]) {
    if (typeof voce !== "object" || voce === null) {
      throw new Error("Una riga di questo mazzo non è una carta.");
    }
    const { nome, copie } = voce as { nome?: unknown; copie?: unknown };
    if (typeof nome !== "string" || nome.trim() === "") {
      throw new Error("Una carta di questo mazzo è senza nome.");
    }
    // Il tetto vero lo dice la carta — le poche senza limite di copie ce
    // l'hanno scritto sopra — e lo si sa solo col pool in mano. Qui si ferma
    // ciò che non può essere un mazzo comunque: più copie che carte in tutto.
    if (!interoPositivo(copie) || copie === 0 || copie > DIMENSIONE_MAZZO) {
      throw new Error(`Le copie di ${nome} in questo mazzo non sono un numero di copie.`);
    }
    if (gia.has(nome)) {
      throw new Error(`${nome} compare due volte in questo mazzo.`);
    }
    gia.add(nome);
    carte.push({ nome, copie });
  }
  return carte;
}

function interoPositivo(valore: unknown): valore is number {
  return typeof valore === "number" && Number.isInteger(valore) && valore >= 0;
}
