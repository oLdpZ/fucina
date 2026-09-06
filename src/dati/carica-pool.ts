/**
 * La lettura del pool da parte dell'app.
 *
 * L'app **legge** il pool e non lo produce mai (`spec.md`, «I due programmi»):
 * qui c'è tutto ciò che serve per farlo, e niente che sappia come il pool è
 * stato costruito.
 *
 * Il file è dentro il pacchetto e il service worker lo tiene in cache, quindi
 * questa lettura riesce anche senza rete (storia 15). Se però il file manca o è
 * rotto, l'app deve dirlo con parole: una lista vuota senza spiegazioni
 * sembrerebbe un pool senza carte, e manderebbe a cercare il guasto dalla parte
 * sbagliata.
 */

import { leggiTettoDiCopie } from "../mazzo/copie.js";
import type { Carta, Pool, TagDiScryfall } from "./pool.js";

/** Dov'è il pool, relativo alla base dell'app: l'app gira anche in sottocartella. */
const PERCORSO_POOL = `${import.meta.env.BASE_URL}dati/pool.json`;

/**
 * Controlla che quel che si è letto sia davvero un pool, e lo consegna tipato.
 *
 * Non verifica carta per carta: sarebbe un secondo posto in cui è scritta la
 * forma dei dati, e si scorderebbe di crescere. Verifica le due cose che
 * distinguono un pool da un file qualunque — che abbia una data e che abbia
 * carte.
 */
export function interpretaPool(dati: unknown): Pool {
  if (typeof dati !== "object" || dati === null) {
    throw new Error("Il file del pool delle carte non si legge.");
  }

  const { generatoIl, carte, registroTagScryfall } = dati as {
    generatoIl?: unknown;
    carte?: unknown;
    registroTagScryfall?: unknown;
  };

  if (typeof generatoIl !== "string" || generatoIl === "") {
    throw new Error("Il pool delle carte non dice di che data sono i suoi dati.");
  }
  if (!Array.isArray(carte)) {
    throw new Error("Il pool non contiene un elenco di carte.");
  }
  if (carte.length === 0) {
    throw new Error("Il pool delle carte è vuoto.");
  }

  // Due campi si possono non trovare, e sono i due che sono nati dopo il pool.
  // Non è il controllo carta per carta che questo modulo rifiuta di fare —
  // quello sarebbe un secondo posto in cui è scritta la forma dei dati — è il
  // rattoppo di un pool di ieri alla forma di oggi. E i pool di ieri arrivano
  // per davvero: uno più fresco di quello incluso resta nel deposito del
  // dispositivo e vince all'apertura (`aggiornamento.ts`), anche quando l'app
  // attorno è stata nel frattempo aggiornata.
  //
  // Il **registro dei tag** di Scryfall manca nei pool scritti prima che i tag
  // della comunità entrassero nel file (ADR-0003): un registro che manca vuol
  // dire soltanto nessun tag, e mancherà anche sulle carte.
  //
  // Il **tetto di copie** manca nei pool scritti prima che diventasse un dato
  // della carta. Qui si riscrive con la regola del gioco, che è la stessa che
  // lo scrive in preparazione: non è un ripiego, è la risposta giusta per un
  // pool a cui nessun formato aveva ancora messo mano. Senza questo rattoppo
  // un tetto assente varrebbe «nessun tetto», e l'app costruirebbe in silenzio
  // mazzi con sessanta copie della stessa carta.
  const senzaTag = !Array.isArray(registroTagScryfall);
  const senzaTetto = (carte as Carta[])[0]?.tettoDiCopie === undefined;

  return {
    generatoIl,
    registroTagScryfall: senzaTag ? [] : (registroTagScryfall as TagDiScryfall[]),
    carte:
      senzaTag || senzaTetto
        ? (carte as Carta[]).map((carta) => ({
            ...carta,
            ...(senzaTag ? { tagScryfall: [] } : {}),
            // Testo e tipi si prendono col beneficio del dubbio: rattoppare un
            // pool di ieri vuol dire anche non cadere su un campo che quel pool
            // non aveva. Una carta senza testo e senza tipi prende il tetto di
            // tutti, che è la risposta giusta per quel che se ne sa.
            ...(senzaTetto
              ? { tettoDiCopie: leggiTettoDiCopie(carta.testo ?? "", carta.tipi ?? []) }
              : {}),
          }))
        : (carte as Carta[]),
  };
}

/** Legge il pool incluso nell'app. */
export async function caricaPool(): Promise<Pool> {
  const risposta = await fetch(PERCORSO_POOL);
  if (!risposta.ok) {
    throw new Error(`Il pool delle carte non è raggiungibile (${risposta.status}).`);
  }
  let letto: unknown;
  try {
    letto = await risposta.json();
  } catch {
    // Capita per davvero: un server che risponde con la pagina dell'app al
    // posto di un file mancante. Il messaggio del browser parlerebbe di
    // parentesi angolari, e non aiuterebbe nessuno.
    throw new Error("Il file del pool delle carte non si legge.");
  }
  return interpretaPool(letto);
}

/**
 * Chiede alla rete il file del pool, per vedere se ne esiste uno più fresco
 * (storia 18).
 *
 * `no-cache` e non `no-store`: si vuole che il server dica se il file è
 * cambiato, non che i quattro megabyte riscendano a ogni apertura dell'app. Se
 * non è cambiato la risposta arriva vuota e il corpo lo mette il browser, che
 * ce l'ha già. È anche il segnale con cui il service worker riconosce questa
 * richiesta e la lascia passare invece di rispondere dalla sua cache: chiedere
 * a sé stessi se si è aggiornati non direbbe mai di no.
 *
 * È l'unica richiesta di rete che l'app fa oltre alle immagini delle carte.
 */
export async function scaricaPool(): Promise<unknown> {
  const risposta = await fetch(PERCORSO_POOL, { cache: "no-cache" });
  if (!risposta.ok) {
    throw new Error(`Il pool delle carte non è raggiungibile (${risposta.status}).`);
  }
  return risposta.json();
}

/**
 * La data dei dati, come si direbbe a voce (storia 17).
 *
 * Si legge sempre nel fuso di Greenwich, quello in cui la data è scritta: letta
 * nel fuso di chi guarda, un pool generato di prima mattina diventerebbe del
 * giorno prima per metà del mondo.
 */
export function dataInItaliano(iso: string): string {
  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) return "data sconosciuta";
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(quando);
}
