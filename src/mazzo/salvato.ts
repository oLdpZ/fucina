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
 *
 * Ricalcolarle però vuol dire ricalcolarle **con che cosa**, e per una versione
 * intera dell'app la risposta è stata «con quel che c'è adesso»: il tema di
 * adesso, il tetto di adesso. Fra due schermate della stessa sessione era la
 * stessa cosa; fra due sessioni no — chi salvava un mazzo dicendo «niente nero»
 * e lo riapriva dopo aver cambiato tema si ritrovava le paludi, senza un avviso
 * e senza modo di accorgersene. Perciò la richiesta salvata porta anche **il
 * tema e il tetto** con cui il mazzo è stato costruito (ticket 31): non per
 * rimetterli in vigore nell'app, ma per restare attaccati a quel mazzo e
 * rifargli le sue terre. Chi li riceve è `mazzo/in-vigore.ts`.
 */

import { identitaSeSiLegge, type IdentitaDiFormato } from "../dati/ambito.js";
import { temaSeSiLegge } from "../tema/interpreta.js";
import type { Tema } from "../tema/tema.js";
import { DIMENSIONE_MAZZO } from "./taratura.js";

/** Una carta del mazzo, per nome, e quante copie. */
export type VoceSalvata = { nome: string; copie: number };

/**
 * Che cosa ha prodotto il mazzo.
 *
 * Oggi c'è una sola **origine** — messo insieme a mano dal catalogo — e la
 * cosa da non confondere è che l'origine non è la richiesta: il tema e il tetto
 * qui sotto ci sono già, e ci sono per tutti i mazzi, perché dicono sotto quale
 * vincolo le terre di questo mazzo sono state scelte e non chi lo ha messo
 * insieme. Il giorno in cui il motore avrà la sua origine, questa unione cresce
 * di un ramo con dentro quel che è davvero suo — il seme, gli orologi — e il
 * formato di scambio porta un numero di formato proprio per quel giorno.
 */
export type Richiesta = {
  origine: "a-mano";
  /** Le terre chieste a mano; `null` quando le decide la curva del mazzo. */
  terreVolute: number | null;
  /**
   * Il tema sotto il quale la base di terre di questo mazzo è stata decisa
   * (ticket 31).
   *
   * Sta nella richiesta e non accanto alle carte perché è **una richiesta**: è
   * la domanda a cui questo mazzo è la risposta. Sta qui anche se l'origine
   * resta una sola, perché quel che registra non è chi ha messo insieme il
   * mazzo ma sotto quale vincolo le sue terre sono state scelte — e quel
   * vincolo è un fatto del mazzo, non del suo autore. Il giorno che l'origine
   * del motore arriverà, arriverà con il seme e con gli orologi, non con
   * questo: questo c'è già.
   *
   * **Manca** nei mazzi salvati prima che l'app lo scrivesse, e non è un
   * guasto: quei mazzi si aprono lo stesso, e le loro terre si rifanno col tema
   * di adesso — che è quel che facevano tutti prima di questo ticket. Chi li
   * apre lo sa, perché la schermata non dichiara nulla su come sono state
   * scelte.
   */
  tema?: Tema | undefined;
  /**
   * Il tetto di spesa in vigore su questo mazzo quando è stato salvato, in
   * euro; assente quando nessun tetto lo ha prodotto.
   *
   * È il tetto **in vigore sul mazzo** (`tettoInVigore`) e mai l'interruttore
   * della schermata di costruzione: quello dice che cosa l'utente sta chiedendo
   * adesso al motore, non con che cifra il mazzo che sta salvando è nato.
   */
  tetto?: number | undefined;
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
  const { tema, tetto } = dati as { tema?: unknown; tetto?: unknown };
  return {
    origine,
    terreVolute: terreVolute as number | null,
    // Letti **con indulgenza**, per la stessa ragione del formato di gioco qui
    // sopra: di qui passa anche il deposito, chi lo rilegge lascia fuori
    // dall'elenco i mazzi che non si leggono, e un tema scritto a metà farebbe
    // sparire il mazzo intero senza dirlo a nessuno. Un mazzo che non sa più
    // dire come sono state scelte le sue terre è un mazzo che si vede, si apre
    // e si risalva; un mazzo scomparso in silenzio non è niente di tutto ciò.
    // Il testo che arriva da fuori è severo dove deve, cioè prima di qui.
    tema: temaSeSiLegge(tema),
    tetto: tettoSeSiLegge(tetto),
  };
}

/**
 * Il tetto riletto: una cifra da spendere, o niente.
 *
 * Zero **è** un tetto e non l'assenza di uno, come già in `in-vigore.ts`: zero
 * euro è una richiesta legittima — «solo carte senza prezzo» — e leggerla come
 * «nessun tetto» la tradirebbe in silenzio, riaprendo il mazzo con dentro
 * proprio le terre che quella richiesta escludeva. «Nessun tetto» è l'assenza
 * del campo, che è un'altra cosa e si scrive in un altro modo.
 */
function tettoSeSiLegge(dati: unknown): number | undefined {
  if (typeof dati !== "number" || !Number.isFinite(dati) || dati < 0) return undefined;
  return dati;
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
