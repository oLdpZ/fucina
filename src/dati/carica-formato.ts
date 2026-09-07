/**
 * La lettura del documento di formato.
 *
 * Il documento dice **quale gioco si sta giocando**: quali edizioni sono
 * ammesse e con che criterio, quali carte stanno a una copia, quali non si
 * giocano affatto, e come si chiama tutto questo. Lo scrive una persona a mano
 * ([ADR-0004](../../docs/adr/0004-nessuna-verita-di-formato-nel-sorgente.md)),
 * e questo modulo è l'unico posto che lo apre.
 *
 * Da qui non esce mai un nome di carta scritto nel sorgente: escono i nomi
 * **letti**. La differenza è tutta la decisione di ADR-0004.
 *
 * ## Perché qui si controlla, e nel pool no
 *
 * `carica-pool.ts` si rifiuta di verificare il pool carta per carta, e ha
 * ragione: il pool lo scrive un comando, e un secondo posto in cui è scritta la
 * forma dei dati si scorderebbe di crescere.
 *
 * Questo documento lo scrive una **mano**, e sbaglia in altri modi: una riga
 * aggiunta senza il suo perché, una virgola in meno, un nome scritto storto. I
 * primi due si vedono qui. Il terzo — il nome che non esiste — non si vede
 * affatto senza le carte davanti, ed è per questo che `verificaCarteEsistenti`
 * è una funzione a parte, che chiama chi le carte ce le ha.
 */

import type {
  Criterio,
  DaConfermare,
  Edizione,
  ElencoDiCarte,
  Formato,
  VoceDiCarta,
} from "./formato.js";

/**
 * Dov'è il documento, relativo alla base dell'app: l'app gira anche in
 * sottocartella.
 *
 * È una funzione e non una costante di modulo perché `import.meta.env` esiste
 * solo dentro Vite: scritta fuori, la sola **importazione** di questo modulo
 * farebbe cadere gli strumenti del manutentore, che girano su Node nudo — ed è
 * proprio da lì che `verificaCarteEsistenti` va chiamata, perché è l'unico
 * posto che ha davanti i nomi di tutte le carte prima che le bandite escano.
 */
function percorsoDelFormato(): string {
  return `${import.meta.env.BASE_URL}dati/formato.json`;
}

/** I criteri che il codice sa eseguire. Quale valga lo dice il documento. */
const CRITERI: readonly Criterio["regola"][] = ["stampa-italiana", "solo-edizioni"];

/**
 * Controlla che quel che si è letto sia davvero un documento di formato, e lo
 * consegna tipato.
 *
 * Ogni rifiuto dice **quale campo** manca, e non «documento non valido»: chi
 * legge il messaggio ha il file aperto davanti e deve sapere quale riga
 * guardare.
 */
export function interpretaFormato(dati: unknown): Formato {
  if (typeof dati !== "object" || dati === null) {
    throw new Error("Il documento di formato non si legge.");
  }

  const grezzo = dati as Record<string, unknown>;

  const nome = testo(grezzo["nome"]);
  if (nome === null) {
    throw new Error("Il documento di formato non dice il nome del formato.");
  }

  const aggiornatoIl = testo(grezzo["aggiornatoIl"]);
  if (aggiornatoIl === null) {
    throw new Error("Il documento di formato non porta la data della sua lista.");
  }

  const fonte = testo(grezzo["fonte"]);
  if (fonte === null) {
    throw new Error("Il documento di formato non dice da quale fonte viene la sua lista.");
  }

  const edizioni = leggiEdizioni(grezzo["edizioni"]);
  controllaEdizioniRipetute(edizioni);

  const limitate = leggiElenco(grezzo["limitate"], "limitate");
  const bandite = leggiElenco(grezzo["bandite"], "bandite");
  controllaNomiRipetuti(limitate, bandite);

  return {
    nome,
    daConfermare: testo(grezzo["daConfermare"]),
    aggiornatoIl,
    fonte,
    // A differenza delle tre sopra, il regolamento di riferimento può mancare:
    // un formato che non ne ha nessuno è un formato legittimo, e le divergenze
    // semplicemente non hanno rispetto a che cosa essere dichiarate.
    regolamentoDiRiferimento: testo(grezzo["regolamentoDiRiferimento"]) ?? "",
    criterio: leggiCriterio(grezzo["criterio"]),
    edizioni,
    limitate,
    bandite,
  };
}

/**
 * La stessa carta nominata due volte.
 *
 * Dentro un elenco solo è una riga di troppo, e si vede. Fra i due elenchi è una
 * **contraddizione**: una carta limitata a una copia e insieme bandita non ha un
 * comportamento giusto, ne ha due, e quale dei due valga lo deciderebbe l'ordine
 * in cui il codice legge il file. È il genere di errore che una mano fa
 * spostando una riga da un elenco all'altro e dimenticando di cancellarla.
 */
function controllaNomiRipetuti(limitate: ElencoDiCarte, bandite: ElencoDiCarte): void {
  const viste = new Set<string>();
  const ripetute = new Set<string>();

  for (const voce of [...limitate.carte, ...bandite.carte]) {
    if (viste.has(voce.carta)) ripetute.add(voce.carta);
    viste.add(voce.carta);
  }

  if (ripetute.size > 0) {
    throw new Error(
      `Il documento di formato nomina più di una volta: ${[...ripetute].join(", ")}.`,
    );
  }
}

/**
 * La stessa edizione nominata due volte.
 *
 * Nell'impronta del formato sarebbe innocua — si deduplica — ma da quando
 * l'edizione porta le proprie `lingue` è una **contraddizione**: due righe
 * dicono quali copie sono legali, e quale delle due valga lo deciderebbe
 * l'ordine in cui il codice legge il file. È l'errore che fa una mano che
 * incolla una riga e dimentica di cancellare l'originale, e senza questo
 * controllo cambierebbe in silenzio la stampa che descrive ogni carta di
 * quell'edizione.
 *
 * Il confronto è sul codice ripulito, come lo ripuliscono l'impronta e la
 * preparazione: due righe che differiscono per uno spazio non sono due
 * edizioni.
 */
function controllaEdizioniRipetute(edizioni: Edizione[]): void {
  const viste = new Set<string>();
  const ripetute = new Set<string>();

  for (const edizione of edizioni) {
    const codice = edizione.codice.trim().toLowerCase();
    if (viste.has(codice)) ripetute.add(codice);
    viste.add(codice);
  }

  if (ripetute.size > 0) {
    throw new Error(
      `Il documento di formato ammette più di una volta l'edizione: ${[...ripetute].join(", ")}.`,
    );
  }
}

function leggiCriterio(grezzo: unknown): Criterio {
  const criterio = (grezzo ?? {}) as Record<string, unknown>;
  const regola = testo(criterio["regola"]);

  // Un criterio sconosciuto non si può ignorare: letto come «nessun criterio»
  // il pool uscirebbe con dentro tutto, e sarebbe un altro gioco.
  if (regola === null || !CRITERI.includes(regola as Criterio["regola"])) {
    throw new Error(
      `Il documento di formato chiede un criterio che il codice non sa eseguire: «${regola ?? ""}».`,
    );
  }

  // La descrizione a parole è obbligatoria come ogni altro perché, e più degli
  // altri: il criterio è il campo che decide quali carte esistono, e `regola`
  // da solo dice al codice cosa fare senza dire a nessuno perché.
  const descrizione = testo(criterio["descrizione"]);
  if (descrizione === null) {
    throw new Error("Il criterio del documento di formato non è scritto a parole.");
  }

  return {
    regola: regola as Criterio["regola"],
    descrizione,
    daConfermare: testo(criterio["daConfermare"]),
  };
}

function leggiEdizioni(grezzo: unknown): Edizione[] {
  if (!Array.isArray(grezzo) || grezzo.length === 0) {
    throw new Error("Il documento di formato non dichiara nessuna edizione ammessa.");
  }

  return grezzo.map((riga: unknown, indice: number) => {
    const voce = (riga ?? {}) as Record<string, unknown>;
    const codice = testo(voce["codice"]);
    if (codice === null) {
      throw new Error(`L'edizione numero ${indice + 1} del documento non ha un codice.`);
    }
    const perché = testo(voce["perché"]);
    if (perché === null) {
      throw new Error(`L'edizione «${codice}» del documento non dice il proprio perché.`);
    }
    return {
      codice,
      nome: testo(voce["nome"]) ?? codice,
      perché,
      lingue: leggiLingue(voce["lingue"], codice),
      daConfermare: testo(voce["daConfermare"]),
    };
  });
}

/**
 * Le lingue ammesse di un'edizione, nell'ordine in cui sono scritte.
 *
 * Un elenco assente o vuoto **non** vale «tutte le lingue»: sarebbe una regola
 * di formato che il codice si inventa al posto del documento, e ADR-0004 la
 * vieta. Si rifiuta, e il rifiuto nomina l'edizione — chi legge il messaggio ha
 * il file aperto davanti e deve sapere quale riga guardare.
 *
 * L'ordine si conserva com'è scritto, perché **è la preferenza**: riordinarlo
 * qui sarebbe togliere metà del significato del campo senza dirlo.
 */
function leggiLingue(grezzo: unknown, codice: string): string[] {
  const lingue = Array.isArray(grezzo) ? grezzo.map((voce: unknown) => testo(voce)) : null;

  if (lingue === null || lingue.length === 0 || lingue.some((lingua) => lingua === null)) {
    throw new Error(
      `L'edizione «${codice}» del documento non dichiara le lingue delle copie ammesse. ` +
        `Un elenco assente o vuoto non vuol dire «tutte»: la regola va scritta, anche quando è generosa.`,
    );
  }

  return lingue as string[];
}

function leggiElenco(grezzo: unknown, quale: string): ElencoDiCarte {
  const elenco = (grezzo ?? {}) as Record<string, unknown>;
  const carte = elenco["carte"];

  if (!Array.isArray(carte)) {
    throw new Error(`Il documento di formato non contiene l'elenco delle carte ${quale}.`);
  }

  return {
    perché: testo(elenco["perché"]) ?? "",
    daConfermare: testo(elenco["daConfermare"]),
    carte: carte.map((riga: unknown, indice: number) => leggiVoce(riga, quale, indice)),
  };
}

function leggiVoce(grezzo: unknown, quale: string, indice: number): VoceDiCarta {
  const voce = (grezzo ?? {}) as Record<string, unknown>;

  const carta = testo(voce["carta"]);
  if (carta === null) {
    throw new Error(`La voce numero ${indice + 1} fra le ${quale} non nomina nessuna carta.`);
  }

  // Il perché non è decorazione: senza, fra un anno nessuno sa se la riga si
  // può togliere. Una riga senza ragione non entra.
  const perché = testo(voce["perché"]);
  if (perché === null) {
    throw new Error(`La carta «${carta}» fra le ${quale} non dice il proprio perché.`);
  }

  return {
    carta,
    perché,
    divergenza: testo(voce["divergenza"]),
    daConfermare: testo(voce["daConfermare"]),
  };
}

/**
 * Una stringa piena, o `null`.
 *
 * `null` è anche quel che si dice di un campo assente, e di uno scritto vuoto:
 * un `perché` fatto di spazi non è un perché, e chi l'ha scritto voleva dire
 * «poi lo riempio».
 */
function testo(valore: unknown): string | null {
  if (typeof valore !== "string") return null;
  // Ripulito e non com'è scritto: su un file che si corregge a mano, uno spazio
  // in coda a un nome di carta è invisibile a chi legge il messaggio d'errore —
  // «la carta “Anello di Prova ” non esiste» sembrerebbe una bugia dell'app.
  const pulito = valore.trim();
  return pulito === "" ? null : pulito;
}

/**
 * Tutti i nomi di carta che il documento nomina, limitate e bandite insieme.
 *
 * Serve a chi ha le carte davanti: è la lista da confrontare con quel che
 * esiste davvero.
 */
export function cartePerNome(formato: Formato): string[] {
  return [...formato.limitate.carte, ...formato.bandite.carte].map((voce) => voce.carta);
}

/**
 * Il documento nomina una carta che non esiste? Allora si ferma tutto.
 *
 * È l'errore che senza controllo non si vedrebbe mai: «Anelo di Prova» resta
 * una limitata che non limita niente, il documento dice una cosa e il gioco ne
 * fa un'altra, e nessuno se ne accorge finché qualcuno non gioca due copie di
 * una carta che doveva starci una volta sola.
 *
 * I nomi che non esistono si dicono **tutti insieme**: chi corregge il
 * documento lo apre una volta sola.
 *
 * `nomiEsistenti` sono i nomi delle carte che esistono nelle edizioni ammesse,
 * **prima** di togliere le bandite — che per definizione nel pool finito non ci
 * sono, e verrebbero segnalate tutte come errori di battitura.
 */
export function verificaCarteEsistenti(
  formato: Formato,
  nomiEsistenti: Iterable<string>,
): void {
  const esistono = new Set(nomiEsistenti);
  const ignote = cartePerNome(formato).filter((nome) => !esistono.has(nome));

  if (ignote.length === 0) return;

  throw new Error(
    `Il documento di formato nomina ${ignote.length === 1 ? "una carta che non esiste" : `${ignote.length} carte che non esistono`}: ${ignote.join(", ")}.`,
  );
}

/**
 * Le voci ancora da confermare col gruppo, ognuna con la sua domanda.
 *
 * Un dato incerto dichiarato incerto è un dato; scritto senza dirlo è un errore
 * che aspetta. Questa funzione è il modo in cui l'incertezza si conta invece di
 * restare sparsa nel file.
 */
export function vociDaConfermare(formato: Formato): DaConfermare[] {
  const aperte: DaConfermare[] = [];

  const aggiungi = (voce: string, domanda: string | null): void => {
    if (domanda !== null) aperte.push({ voce, domanda });
  };

  aggiungi("il nome del formato", formato.daConfermare);
  aggiungi("il criterio del pool", formato.criterio.daConfermare);
  for (const edizione of formato.edizioni) {
    aggiungi(`l'edizione ${edizione.nome}`, edizione.daConfermare);
  }
  aggiungi("le carte limitate", formato.limitate.daConfermare);
  for (const carta of formato.limitate.carte) {
    aggiungi(`la limitata ${carta.carta}`, carta.daConfermare);
  }
  aggiungi("le carte bandite", formato.bandite.daConfermare);
  for (const carta of formato.bandite.carte) {
    aggiungi(`la bandita ${carta.carta}`, carta.daConfermare);
  }

  return aperte;
}

/** Legge il documento di formato incluso nell'app. */
export async function caricaFormato(): Promise<Formato> {
  const risposta = await fetch(percorsoDelFormato());
  if (!risposta.ok) {
    throw new Error(`Il documento di formato non è raggiungibile (${risposta.status}).`);
  }
  let letto: unknown;
  try {
    letto = await risposta.json();
  } catch {
    // Come per il pool: un server che risponde con la pagina dell'app al posto
    // di un file mancante. Il messaggio del browser parlerebbe di parentesi
    // angolari, e manderebbe a cercare il guasto dalla parte sbagliata.
    throw new Error("Il documento di formato non si legge.");
  }
  return interpretaFormato(letto);
}
