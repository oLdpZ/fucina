/**
 * Il tema **riletto da fuori** (ticket 31).
 *
 * Da quando un mazzo salvato porta con sé il tema con cui è stato costruito, il
 * tema smette di essere solo uno stato dell'app e diventa un dato che rientra:
 * dal deposito del dispositivo, o dal testo che un amico ha mandato. Quel che
 * rientra si ricontrolla, sempre, e per la ragione di questo ticket in
 * particolare: dalle **esclusioni** del tema dipende la base di terre, e un tema
 * riletto a metà produrrebbe in silenzio una base diversa da quella di allora —
 * che è esattamente il guasto che il ticket chiude.
 *
 * Due letture, come per il formato di gioco (`dati/ambito.ts`), e per le stesse
 * ragioni: **severa** per il testo che arriva da fuori, dove il mazzo non è
 * ancora di nessuno ed è il momento di dire che non torna; **indulgente** per il
 * deposito, dove il mazzo è già dell'utente e un campo scritto a metà non deve
 * poter far sparire dall'elenco tutto il resto.
 *
 * ## Che cosa si controlla e che cosa no
 *
 * I **colori** sono cinque e si sanno: uno che non è uno di quelli è un testo
 * corrotto, e si dice. I **tag** no: il vocabolario dei tag si riscrive col pool
 * (`PROGETTO.md` §7, Q13), e un mazzo salvato dura più a lungo di lui. Un tag
 * che oggi non esiste più si rilegge come sé stesso e semplicemente non prende
 * nessuna carta — che è la risposta onesta — invece di far cadere il mazzo che
 * lo porta. Vale lo stesso per tipi e sottotipi, che sono parole del pool.
 *
 * È la stessa lezione dell'identità di formato: **la verità di formato non vive
 * qui** (ADR-0004), e questo modulo non sa e non deve sapere quali tag, tipi o
 * sottotipi esistano oggi.
 */

import { ORDINE_DEI_COLORI } from "../catalogo/vocabolario.js";
import type { Colore, Tag } from "../dati/pool.js";
import {
  FILTRO_TEMA_VUOTO,
  temaDichiarato,
  type Allargamento,
  type CriterioAllargamento,
  type FiltroTema,
  type Tema,
} from "./tema.js";

/**
 * Il tema riletto, o `undefined` se non ce n'è uno.
 *
 * `undefined` in due casi che sono lo stesso caso: il campo non c'è — un mazzo
 * salvato prima che l'app scrivesse il tema — oppure c'è e non dichiara niente.
 * Un tema vuoto è l'assenza di tema (`temaDichiarato`), e restituirlo come
 * oggetto vorrebbe dire far credere a chi lo riceve che il mazzo sia stato
 * costruito sotto un vincolo che nessuno ha mai posto.
 */
export function interpretaTema(dati: unknown): Tema | undefined {
  if (dati === undefined || dati === null) return undefined;
  // Un elenco non è un tema, e va detto invece di essere spogliato: gli array
  // sono oggetti, e lasciarli passare di qui vorrebbe dire estrarne campi che
  // non esistono finché non resta un tema vuoto — cioè «nessun vincolo», letto
  // in silenzio da un testo che un vincolo lo dichiarava.
  if (typeof dati !== "object" || Array.isArray(dati)) {
    throw new Error(
      "Questo mazzo dice il tema con cui è stato costruito in un modo che non si capisce.",
    );
  }

  const { inclusioni, seme, esclusioni, allargamenti } = dati as {
    inclusioni?: unknown;
    seme?: unknown;
    esclusioni?: unknown;
    allargamenti?: unknown;
  };

  const tema: Tema = {
    inclusioni: interpretaFiltro(inclusioni, "inclusioni"),
    seme: interpretaSeme(seme),
    esclusioni: interpretaFiltro(esclusioni, "esclusioni"),
    allargamenti: interpretaAllargamenti(allargamenti),
  };

  return temaDichiarato(tema) ? tema : undefined;
}

/**
 * Come `interpretaTema`, ma un tema storto vale come assente.
 *
 * È la lettura del **deposito**, e la ragione è quella scritta per il formato di
 * gioco: là dentro il mazzo è già dell'utente, e chi rilegge l'elenco lascia
 * fuori i mazzi che non si leggono. Un tema scritto a metà si porterebbe via il
 * mazzo intero, e un mazzo scomparso in silenzio è la cosa che il progetto ha
 * promesso di non fare. Il mazzo si riapre; le sue terre sono quelle di oggi, e
 * la schermata lo dice perché non le dichiara costruite in altro modo.
 */
export function temaSeSiLegge(dati: unknown): Tema | undefined {
  try {
    return interpretaTema(dati);
  } catch {
    return undefined;
  }
}

/** Un filtro del tema: le stesse leve del catalogo, ognuna facoltativa. */
function interpretaFiltro(dati: unknown, quale: string): FiltroTema {
  if (dati === undefined || dati === null) return FILTRO_TEMA_VUOTO;
  if (typeof dati !== "object" || Array.isArray(dati)) {
    throw new Error(`Le ${quale} del tema di questo mazzo non si leggono.`);
  }

  const { colori, tipi, sottotipi, tag, testo, costoMinimo, costoMassimo } = dati as {
    colori?: unknown;
    tipi?: unknown;
    sottotipi?: unknown;
    tag?: unknown;
    testo?: unknown;
    costoMinimo?: unknown;
    costoMassimo?: unknown;
  };

  return {
    colori: interpretaColori(colori),
    tipi: parole(tipi, quale),
    sottotipi: parole(sottotipi, quale),
    // I tag passano come parole: il loro vocabolario non vive qui.
    tag: parole(tag, quale) as readonly Tag[],
    testo: interpretaTesto(testo, quale),
    costoMinimo: interpretaCosto(costoMinimo),
    costoMassimo: interpretaCosto(costoMassimo),
  };
}

/**
 * I colori, controllati contro i cinque che esistono.
 *
 * Qui il controllo si fa — e per i tag no — perché i colori del gioco non sono
 * vocabolario che invecchia: sono cinque dal 1993, e l'app li ha già scritti in
 * un posto solo. Un sesto colore è un testo corrotto, non un formato nuovo.
 */
function interpretaColori(dati: unknown): readonly Colore[] {
  if (dati === undefined || dati === null) return [];
  if (!Array.isArray(dati)) {
    throw new Error("I colori del tema di questo mazzo non sono un elenco di colori.");
  }
  for (const colore of dati as unknown[]) {
    if (typeof colore !== "string" || !ORDINE_DEI_COLORI.includes(colore as Colore)) {
      throw new Error(`Fra i colori del tema di questo mazzo c'è «${String(colore)}», che non è un colore del gioco.`);
    }
  }
  return dati as readonly Colore[];
}

/** Un elenco di parole del pool: tipi, sottotipi, tag. Vuote no: non filtrano. */
function parole(dati: unknown, quale: string): readonly string[] {
  if (dati === undefined || dati === null) return [];
  if (!Array.isArray(dati)) {
    throw new Error(`Una parte delle ${quale} del tema di questo mazzo non è un elenco.`);
  }
  for (const parola of dati as unknown[]) {
    if (typeof parola !== "string" || parola.trim() === "") {
      throw new Error(`Le ${quale} del tema di questo mazzo contengono una voce vuota.`);
    }
  }
  return dati as readonly string[];
}

function interpretaTesto(dati: unknown, quale: string): string {
  if (dati === undefined || dati === null) return "";
  if (typeof dati !== "string") {
    throw new Error(`Il testo cercato dalle ${quale} del tema di questo mazzo non è un testo.`);
  }
  return dati;
}

/** Un estremo di costo: un numero di mana, o nessun estremo. */
function interpretaCosto(dati: unknown): number | null {
  if (dati === undefined || dati === null) return null;
  if (typeof dati !== "number" || !Number.isFinite(dati) || dati < 0) {
    throw new Error("Un costo di mana del tema di questo mazzo non è un costo di mana.");
  }
  return dati;
}

/** La carta-seme, per nome. Mai l'oggetto: i pool cambiano sotto i piedi. */
function interpretaSeme(dati: unknown): string | null {
  if (dati === undefined || dati === null) return null;
  if (typeof dati !== "string" || dati.trim() === "") {
    throw new Error("La carta-seme del tema di questo mazzo non è il nome di una carta.");
  }
  return dati;
}

/**
 * Gli allargamenti accettati, con la frase che li dice.
 *
 * Si rileggono interi — criterio, frase e conto — e non solo il criterio: un
 * allargamento è quel che l'app ha **detto** all'utente e lui ha accettato, e un
 * tema che se ne portasse dietro la regola senza la frase sarebbe un tema
 * allargato di nascosto, cioè la cosa che `tema.ts` dichiara di non fare.
 */
function interpretaAllargamenti(dati: unknown): readonly Allargamento[] {
  if (dati === undefined || dati === null) return [];
  if (!Array.isArray(dati)) {
    throw new Error("Gli allargamenti del tema di questo mazzo non sono un elenco.");
  }

  return (dati as unknown[]).map((voce): Allargamento => {
    if (typeof voce !== "object" || voce === null) {
      throw new Error("Un allargamento del tema di questo mazzo non si legge.");
    }
    const { criterio, descrizione, carteAggiunte } = voce as {
      criterio?: unknown;
      descrizione?: unknown;
      carteAggiunte?: unknown;
    };
    if (typeof descrizione !== "string" || descrizione.trim() === "") {
      throw new Error("Un allargamento del tema di questo mazzo non dice che cosa allarga.");
    }
    if (
      typeof carteAggiunte !== "number" ||
      !Number.isInteger(carteAggiunte) ||
      carteAggiunte < 0
    ) {
      throw new Error("Un allargamento del tema di questo mazzo non dice quante carte aggiunge.");
    }
    return { criterio: interpretaCriterio(criterio), descrizione, carteAggiunte };
  });
}

function interpretaCriterio(dati: unknown): CriterioAllargamento {
  if (typeof dati !== "object" || dati === null) {
    throw new Error("Un allargamento del tema di questo mazzo non dice con che regola allarga.");
  }
  const grezzo = dati as Record<string, unknown>;

  switch (grezzo["tipo"]) {
    case "nomina-il-sottotipo": {
      const [sottotipo] = parole([grezzo["sottotipo"]], "allargamenti");
      return { tipo: "nomina-il-sottotipo", sottotipo: sottotipo as string };
    }
    case "tag-affine": {
      const [tag] = parole([grezzo["tag"]], "allargamenti");
      return { tipo: "tag-affine", tag: tag as Tag };
    }
    case "colori-e-tipo": {
      const [tipoDiCarta] = parole([grezzo["tipoDiCarta"]], "allargamenti");
      // I colori qui sono obbligatori, e sono il solo elenco di tutto il file a
      // esserlo: un elenco vuoto non vuol dire «nessun filtro sui colori» ma
      // «solo le carte senza colori», perché `[].every(...)` è vero per loro.
      // Assente varrebbe quindi «tutte e sole le incolori» — un allargamento
      // diverso da quello che l'utente aveva letto e accettato.
      if (grezzo["colori"] === undefined || grezzo["colori"] === null) {
        throw new Error(
          "Un allargamento del tema di questo mazzo non dice su quali colori allarga.",
        );
      }
      return {
        tipo: "colori-e-tipo",
        colori: interpretaColori(grezzo["colori"]),
        tipoDiCarta: tipoDiCarta as string,
      };
    }
    default:
      throw new Error(
        "Un allargamento del tema di questo mazzo allarga con una regola che non si conosce: forse viene da una versione più recente dell’app.",
      );
  }
}
